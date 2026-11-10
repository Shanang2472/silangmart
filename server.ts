import express from "express";
import path from "path";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import os from "os";
import fs from "fs";
import { createServer as createHttpsServer } from "https";
import { getPool } from "./src/db/mysql";
import apiRouter from "./src/routes/api";
import { rateLimiter } from "./src/utils/authMiddleware";
import { validateJwtConfiguration, verifyToken } from "./src/utils/authHelper";
import { registerSseClient, unregisterSseClient } from "./src/utils/notificationService";

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });


const app = express();
const corsOrigins = new Set(
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
    .map(origin => {
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(`Invalid CORS_ORIGINS entry "${origin}". Provide a full origin such as https://app.example.com.`);
      }
      if (parsed.origin !== origin.replace(/\/+$/, '')) {
        throw new Error(`Invalid CORS_ORIGINS entry "${origin}". Origins cannot include paths.`);
      }
      return parsed.origin;
    })
);

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && corsOrigins.has(origin)) {
    res.vary('Origin');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  } else if (req.method === 'OPTIONS') {
    return res.sendStatus(403);
  }
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      error: 'Request payload too large. Please reduce the size of the uploaded data.'
    });
  }

  next(err);
});

const PORT = Number(process.env.PORT || 3000);

// MySQL-backed JSON API (Task 3)
app.use('/api', apiRouter);

// ─── SSE Notification Stream ──────────────────────────────────────────────────
// GET /api/notifications/stream — real-time server-sent events for authenticated users
app.get('/api/notifications/stream', (req, res) => {
  // Verify auth from query param (EventSource cannot set headers)
  const token = (req.query.token as string) || '';
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).end('Unauthorized');
    return;
  }

  const role = payload.role as 'admin' | 'customer' | 'rider' | 'supplier';
  const userId = role === 'customer' || role === 'rider'
    ? payload.name
    : payload.username;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
  res.flushHeaders();

  // Register this client
  registerSseClient(userId, role, res);

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ event: 'connected', userId, role })}\n\n`);

  // Heartbeat every 25 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    unregisterSseClient(userId, role, res);
  });
});


// Lazy initialize Gemini client inside the route or a helper
let aiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please configure it in your Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
          'x-goog-api-client': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function getHuggingFaceToken() {
  const token = process.env.HUGGINGFACE_API_TOKEN?.trim();
  if (!token) {
    throw new Error("HUGGINGFACE_API_TOKEN is not configured. Add it to the server environment to enable voice features.");
  }
  return token;
}

type SpeechProvider = "mms" | "piper" | "browser";

function getAvailableSpeechProviders(): SpeechProvider[] {
  const providers: SpeechProvider[] = ["browser"];
  if (process.env.HUGGINGFACE_API_TOKEN?.trim()) providers.push("mms");
  const configPath = process.env.PIPER_CONFIG_PATH?.trim();
  if (
    process.env.PIPER_EXECUTABLE?.trim() &&
    process.env.PIPER_MODEL_PATH?.trim() &&
    fs.existsSync(process.env.PIPER_MODEL_PATH.trim()) &&
    (!configPath || fs.existsSync(configPath))
  ) {
    providers.push("piper");
  }
  return providers;
}

function getDefaultSpeechProvider(providers: SpeechProvider[]): SpeechProvider {
  const configured = process.env.TTS_PROVIDER?.trim() || "browser";
  if (configured !== "mms" && configured !== "piper" && configured !== "browser") {
    throw new Error("TTS_PROVIDER must be 'mms', 'piper', or 'browser'.");
  }
  return providers.includes(configured) ? configured : providers[0] || configured;
}

async function synthesizeWithPiper(text: string): Promise<Buffer> {
  const executable = process.env.PIPER_EXECUTABLE?.trim();
  const modelPath = process.env.PIPER_MODEL_PATH?.trim();
  const configPath = process.env.PIPER_CONFIG_PATH?.trim();
  if (!executable || !modelPath || !fs.existsSync(modelPath)) {
    throw new Error("Piper is not configured. Set PIPER_EXECUTABLE and PIPER_MODEL_PATH to an installed Piper and licensed Tagalog voice model.");
  }
  if (configPath && !fs.existsSync(configPath)) {
    throw new Error("PIPER_CONFIG_PATH does not point to an existing voice configuration file.");
  }

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "silang-piper-"));
  const outputPath = path.join(tempDir, "speech.wav");
  const args = ["--model", modelPath, "--output_file", outputPath];
  if (configPath) args.push("--config", configPath);

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(executable, args, { stdio: ["pipe", "ignore", "pipe"] });
      let stderr = "";
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };
      const timeout = setTimeout(() => {
        child.kill();
        finish(new Error("Piper speech generation timed out."));
      }, 60_000);

      child.stderr.on("data", chunk => {
        if (stderr.length < 8000) stderr += chunk.toString().slice(0, 8000 - stderr.length);
      });
      child.once("error", error => finish(new Error(`Unable to start Piper: ${error.message}`)));
      child.once("close", code => {
        if (code === 0) finish();
        else finish(new Error(`Piper speech generation failed${stderr.trim() ? `: ${stderr.trim()}` : ` (exit code ${code})`}.`));
      });
      child.stdin.once("error", error => {
        child.kill();
        finish(new Error(`Unable to send text to Piper: ${error.message}`));
      });
      child.stdin.end(`${text}\n`);
    });

    const audio = await fs.promises.readFile(outputPath);
    if (audio.length === 0 || audio.length > 20 * 1024 * 1024) {
      throw new Error("Piper returned empty audio or audio larger than 20 MB.");
    }
    return audio;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

async function getHuggingFaceError(response: Response) {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body);
    return typeof parsed.error === "string" ? parsed.error : body;
  } catch {
    return body;
  }
}

async function transcribeTagalogAudio(audioData: { data: string; mimeType?: string }) {
  const audio = Buffer.from(audioData.data, "base64");
  if (audio.length === 0 || audio.length > 20 * 1024 * 1024) {
    throw new Error("Voice recording must be between 1 byte and 20 MB.");
  }

  const response = await fetch("https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3-turbo", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getHuggingFaceToken()}`,
      "Content-Type": audioData.mimeType || "audio/webm",
    },
    body: audio,
  });

  if (!response.ok) {
    throw new Error(`Whisper transcription failed (${response.status}): ${await getHuggingFaceError(response)}`);
  }

  const result = await response.json() as { text?: string };
  const transcription = typeof result.text === "string" ? result.text.trim().slice(0, 4000) : "";
  if (!transcription) {
    throw new Error("Whisper did not return any transcribed text.");
  }
  return transcription;
}

// Chatbot API endpoint
app.post("/api/chatbot", rateLimiter, async (req, res) => {

  try {
    const { role, name, messages, userMessage, audioData } = req.body;
    
    // Validate request
    if (!role || (!userMessage && !audioData)) {
      return res.status(400).json({ error: "Missing required fields (role or userMessage/audioData)." });
    }

    if (audioData && (typeof audioData.data !== "string" || audioData.data.trim().length <= 50)) {
      return res.status(400).json({ error: "Voice recording is missing or invalid." });
    }

    const hasAudio = Boolean(audioData);
    let transcription = "";
    if (hasAudio) {
      const base64Audio = audioData.data.trim();
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Audio) || base64Audio.length % 4 !== 0 || base64Audio.length > 28 * 1024 * 1024) {
        return res.status(400).json({ error: "Voice recording must be valid base64 audio and no larger than 20 MB." });
      }
      const mimeType = String(audioData.mimeType || "audio/webm").split(";")[0].trim().toLowerCase();
      if (!["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mpeg"].includes(mimeType)) {
        return res.status(415).json({ error: "Unsupported voice recording format." });
      }
      transcription = await transcribeTagalogAudio({
        data: base64Audio,
        mimeType,
      });
    }

    const ai = getGeminiClient();
    
    // Fetch actual products from database to provide REAL data only
    let systemContext = "";
    let chatbotProducts: any[] = [];
    try {
      const pool = getPool();
      const [products]: any = await pool.query('SELECT id, name, category, price, cost FROM products LIMIT 100');
      chatbotProducts = products || [];
      
      if (products && products.length > 0) {
        // Group products by category
        const byCategory: Record<string, any[]> = {};
        products.forEach((p: any) => {
          if (!byCategory[p.category]) byCategory[p.category] = [];
          byCategory[p.category].push(p);
        });
        
        // Build product context string
        let productList = "ACTUAL PRODUCTS IN SYSTEM:\n";
        Object.entries(byCategory).forEach(([category, items]) => {
          productList += `\n${category}:\n`;
          (items as any[]).forEach(item => {
            productList += `- ${item.name} (Price: ₱${item.price})\n`;
          });
        });
        
        systemContext = `\n\n════════════════════════════════════════════════════════════════════════════════\n${productList}\n════════════════════════════════════════════════════════════════════════════════\n\nIMPORTANT: You MUST ONLY reference products listed above. Do NOT make up, imagine, or suggest products that are not in the list above. If user asks about a product not in the list, say you don't have that specific item but ask what they're looking for so you can suggest from what you actually have.`;
      }
    } catch (dbErr) {
      console.error("Error fetching products for chatbot:", dbErr);
      systemContext = `\n\nNote: Unable to fetch live product data at this moment. Please reference the product database directly or try again.`;
    }

    // Define custom system instruction based on the active role
    let systemInstruction = "";

    const requestedResponseLanguage = String(req.body?.responseLanguage || '').toLowerCase();
    const languageInstruction = requestedResponseLanguage === 'tl' || requestedResponseLanguage === 'fil'
      ? 'LANGUAGE RULE: The user spoke Filipino/Tagalog. Respond primarily in natural Filipino/Tagalog. Keep the warm conversational style and use only occasional English terms when natural.'
      : requestedResponseLanguage === 'taglish'
        ? 'LANGUAGE RULE: The user spoke Taglish. Respond in natural Taglish, mixing Filipino and English in the same natural way.'
        : 'LANGUAGE RULE: Default to warm natural Tagalog unless the user clearly writes primarily in English. If the message mixes English and Tagalog, answer in natural Taglish.';
    
    // Universal golden rule for conversational AI - FOCUS ON ACCURACY
    const universalConversationRule = `
════════════════════════════════════════════════════════════════════════════════
GOLDEN RULE - ALWAYS FOLLOW THIS:
You are a REAL PERSON who helps people using ACTUAL SYSTEM DATA ONLY.
- ONLY provide information about products, data, or inventory that is explicitly listed in the system
- NEVER make up, imagine, or hallucinate products or data that don't exist
- If asked about something NOT in the provided data, say you don't have that specific item/info
- NEVER say "wala sa system" - instead say "sorry, we don't have that available" or "that's not in our current inventory"
- Sound warm and conversational, but ALWAYS be factually accurate
- If user asks for a product not in inventory, ask what they're looking for and suggest alternatives from what you actually have
- NEVER invent features, prices, or details for products not in the system
════════════════════════════════════════════════════════════════════════════════`;
    
    // Shared human-like formatting rule appended to every system prompt
    const humanToneRule = `

IMPORTANT FORMATTING RULES — follow these strictly:
- Never use markdown formatting of any kind. No asterisks (*), no double asterisks (**), no underscores (_), no pound signs (#), no bullet dashes (-), and no numbered lists.
- Do NOT use bold, italic, or any other rich-text markers.
- Write everything as natural, flowing conversational sentences and paragraphs — the way a real person would speak or text.
- Use line breaks to separate thoughts, not bullet points or headers.
- Keep responses concise, warm, and easy to read at a glance.`;

    if (role === "admin") {
      systemInstruction = `${universalConversationRule}

You are the Silang Mini Mart AI Business Advisor & System Co-pilot, specifically assisting the Admin/Manager (named ${name || "Manager"}).
Your expertise covers system data accuracy, stocks and inventory management, and reporting based on ACTUAL system data.

CRITICAL - DATA ACCURACY RULES:
- ONLY provide information from the actual system products listed above
- If admin asks for product details, inventory, or analytics, use ONLY the real data provided
- Do NOT invent or assume product details that aren't in the system
- If admin asks about a product not in the system, clearly say it's not in our inventory
- Focus on helping with real analysis of the actual data we have
- When discussing trends or patterns, base it on products that actually exist in the system

Your tone should be professional, helpful, and data-driven. Respond primarily in English or professional Taglish.${humanToneRule}${systemContext}`;
    } else if (role === "customer") {
      systemInstruction = `${universalConversationRule}

You are "Ate Digy", the friendly and enthusiastic AI Shopping Assistant of Silang Mini Mart, helping our valued customer (named ${name || "Customer"}).
You help customers browse the store from ACTUAL products listed in inventory. You explain pricing variants: Tingi (retail), Balot (pack of 6 with 5% discount), Karton (box of 24 with 10% discount), and Pakyaw (wholesale of 100 with 15% discount).

CRITICAL - DATA ACCURACY RULES:
- ONLY recommend products that are actually in the system inventory above
- Do NOT make up or suggest products not in our system
- If customer asks for something not available, ask what they're looking for and suggest from what we actually have
- Be warm and conversational while staying 100% accurate about what we carry
- When customer clearly asks to order, buy, add, or place items in the cart (examples: orderin, bili, bilhin, pabili, lagay sa cart), identify only actual products from the list and tell the customer to use the Add to Cart button shown in the chat. Never claim an item was already added until the customer clicks that button.

Your tone should be warm, hospitable, and cheerful. Respond in warm, natural Taglish/Filipino. Encourage them to add items to their cart!${humanToneRule}${systemContext}`;
    } else if (role === "rider") {
      systemInstruction = `${universalConversationRule}

You are the Silang Mini Mart Rider Dispatch Co-pilot, assisting our Delivery Rider (named ${name || "Rider"}).
You help with delivery support including safety tips and route optimization in Silang, Cavite (Poblacion, Bypass Road, Brgy. Sabutan).

Your tone should be supportive, practical, and encouraging like a brother or peer (Kuya/Tropang dispatcher). Respond in encouraging Taglish/Filipino.${humanToneRule}`;
    } else {
      // General staff / cashier role
      systemInstruction = `${universalConversationRule}

You are the Silang Mini Mart Store Operations Assistant, helping our Cashier/Staff (named ${name || "Ate Lorna/Kuya Bryan"}).
You guide staff on processing POS transactions, scanning barcodes, handling GCash/Maya payments, logging E-Load, Bills Payment (Meralco, etc.), and Remittances (Cebuana, Palawan Express).

You have access to the actual products in system, so when staff asks about products to help with sales, use the real inventory data (listed above) only.

Your tone should be clear, reliable, and helpful. Respond in friendly, professional Taglish/Filipino.${humanToneRule}${systemContext}`;
    }

    // Build structured Gemini request contents complying with modern SDK format
    const contents: any[] = [];
    const messagesHistory = messages || [];
    let effectiveUserMessage = hasAudio
      ? transcription
      : userMessage ? String(userMessage).trim().slice(0, 500) : "";

    if (!hasAudio && !effectiveUserMessage) {
      return res.status(400).json({ error: "Walang mensahe o audio na natanggap. Pakisubukan muli." });
    }

    // Gemini API format requirements:
    // 1. History must start with 'user' (cannot start with 'model')
    // 2. Roles must strictly alternate: 'user' -> 'model' -> 'user' -> 'model'
    // 3. Request ends with the current 'user' turn
    let lastRole: string | null = null;
    for (const msg of messagesHistory.slice(-10)) {
      const sdkRole = msg.sender === 'user' ? 'user' : 'model';
      // Skip initial bot greetings if not preceded by a user turn
      if (lastRole === null && sdkRole !== 'user') continue;
      // Skip consecutive messages from the same role to maintain strict alternation
      if (sdkRole === lastRole) continue;

      contents.push({
        role: sdkRole,
        parts: [{ text: String(msg.text || '').slice(0, 500) }]
      });
      lastRole = sdkRole;
    }

    // Ensure the preceding turn was 'model' so appending the current 'user' turn is valid
    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents.pop();
    }

    contents.push({
      role: 'user',
      parts: [{ text: effectiveUserMessage || "Kumusta po!" }]
    });

    // Absolute safety check: ensure the last turn is role 'user' with non-empty parts
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: effectiveUserMessage || "Kumusta po!" }]
      });
    }

    // Modern supported models with fast fallback
    const candidateModels = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: `${systemInstruction}\n\n${languageInstruction}`,
          }
        });
        if (response && response.text) break;
      } catch (modelErr: any) {
        lastError = modelErr;
        console.warn(`Model ${modelName} failed, attempting fallback:`, modelErr?.message || modelErr);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Hindi nakatanggap ng sagot mula sa AI assistant.");
    }

    const rawOutput = response.text || "";
    let reply = rawOutput;

    // Strip any leftover markdown symbols so the response feels human and plain
    reply = reply
      .replace(/\*\*(.+?)\*\*/g, '$1')   // remove bold **text**
      .replace(/\*(.+?)\*/g, '$1')        // remove italic *text*
      .replace(/_{1,2}(.+?)_{1,2}/g, '$1') // remove _italic_ or __bold__
      .replace(/^#{1,6}\s+/gm, '')         // remove heading markers
      .replace(/^[-*+]\s+/gm, '')          // remove bullet list markers
      .replace(/^\d+\.\s+/gm, '')          // remove numbered list markers
      .replace(/`(.+?)`/g, '$1')           // remove inline code backticks
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // remove markdown links, keep label
      .trim();

    const cartItems: { productId: string; quantity: number }[] = [];
    if (role === "customer" && effectiveUserMessage) {
      const orderIntent = /\b(order|add|lagay|ilagay|pabili|pakiadd|paki-add|bili|bilhin|kuha|kunin|gusto ko|mag-order)\b/i.test(effectiveUserMessage)
        || /^\s*(?:\d+|isa|isang|dalawa|tatlo|apat|lima|anim|pito|walo|siyam|sampu)\s*(?:kilos?|kgs?|pcs?|pieces?|pc|piraso|bote|can|pack|sako|kahon|karton)?\b/i.test(effectiveUserMessage)
        || /\b(?:\d+|isa|isang|dalawa|tatlo|apat|lima|anim|pito|walo|siyam|sampu)\s*(?:kilos?|kgs?|kilo)\b/i.test(effectiveUserMessage);
      const numberWords: Record<string, number> = {
        isa: 1, isang: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5,
        anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10
      };

      if (orderIntent) {
        const normalizedMessage = effectiveUserMessage.toLowerCase();
        for (const product of chatbotProducts) {
          const normalizedName = String(product.name || '').trim().toLowerCase();
          if (!normalizedName || normalizedName.length < 2) continue;
          if (!normalizedMessage.includes(normalizedName)) continue;

          const escapedProductName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const quantityBeforeMatch = normalizedMessage.match(new RegExp(`(?:\\b)(\\d{1,3})\\s*(?:kilos?|kgs?|kilo|pcs?|pieces?)\\b(?:\\s*(?:ng|of))?\\s*${escapedProductName}`, 'i'));
          const quantityAfterMatch = normalizedMessage.match(new RegExp(`${escapedProductName}.*?(\\d{1,3})\\s*(?:kilos?|kgs?|kilo|pcs?|pieces?)\\b`, 'i'));
          let quantity = 1;
          if (quantityBeforeMatch) {
            quantity = Number(quantityBeforeMatch[1]);
          } else if (quantityAfterMatch) {
            quantity = Number(quantityAfterMatch[1]);
          } else {
            const wordBeforeMatch = normalizedMessage.match(new RegExp(`\\b(isa|isang|dalawa|tatlo|apat|lima|anim|pito|walo|siyam|sampu)\\s*(?:kilos?|kgs?|kilo|pcs?|pieces?)\\b(?:\\s*(?:ng|of))?\\s*${escapedProductName}`, 'i'));
            if (wordBeforeMatch) quantity = numberWords[wordBeforeMatch[1]] || 1;
          }
          quantity = Math.max(1, Math.min(quantity, 99));
          cartItems.push({ productId: String(product.id), quantity });
        }
      }
    }

    res.json({ reply, transcription, cartItems });

  } catch (error: any) {
    console.error("Chatbot API Error in server:", error);
    res.status(500).json({ error: error.message || "Something went wrong in the chatbot." });
  }
});

app.get("/api/speech/providers", (_req, res) => {
  const providers = getAvailableSpeechProviders();
  res.setHeader("Cache-Control", "no-store");
  res.json({
    providers,
    defaultProvider: getDefaultSpeechProvider(providers),
    transcriptionAvailable: Boolean(process.env.HUGGINGFACE_API_TOKEN?.trim()),
  });
});

app.post("/api/speech", rateLimiter, async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return res.status(400).json({ error: "Text is required for speech generation." });
    }
    if (text.length > 4000) {
      return res.status(400).json({ error: "Text must be 4,000 characters or fewer." });
    }

    const requestedProvider = req.body?.provider;
    if (requestedProvider !== undefined && requestedProvider !== "mms" && requestedProvider !== "piper" && requestedProvider !== "browser") {
      return res.status(400).json({ error: "Speech provider must be 'mms', 'piper', or 'browser'." });
    }

    const providers = getAvailableSpeechProviders();
    const provider: SpeechProvider = requestedProvider || getDefaultSpeechProvider(providers);
    if (provider === "browser") {
      return res.status(400).json({ error: "Browser speech runs on the client and should not call the speech API." });
    }
    if (!providers.includes(provider)) {
      const error = provider === "piper"
        ? "Piper is unavailable. Configure PIPER_EXECUTABLE and PIPER_MODEL_PATH with a licensed Tagalog voice model."
        : "Facebook MMS-TTS is unavailable. Configure HUGGINGFACE_API_TOKEN.";
      return res.status(503).json({ error });
    }

    if (provider === "piper") {
      const audio = await synthesizeWithPiper(text);
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "no-store");
      return res.send(audio);
    }

    const response = await fetch("https://router.huggingface.co/hf-inference/models/facebook/mms-tts-tgl", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getHuggingFaceToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
      throw new Error(`MMS-TTS speech generation failed (${response.status}): ${await getHuggingFaceError(response)}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length === 0) {
      throw new Error("MMS-TTS returned an empty audio response.");
    }

    res.setHeader("Content-Type", response.headers.get("content-type") || "audio/wav");
    res.setHeader("Cache-Control", "no-store");
    res.send(audio);
  } catch (error: any) {
    console.error("Speech generation error:", error);
    res.status(502).json({ error: error.message || "Unable to generate Tagalog speech." });
  }
});

// Serve uploaded images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// MySQL-backed API placeholders (first step)
// Note: frontend will be refactored in a later step.

app.get('/api/health/db', async (_req, res) => {


  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, rows });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

/* app.post('/api/admin/seed', async (_req, res) => {
  // admin-only in real deployments; for now only to validate seed flow
  try {
    const pool = getPool();
    const schemaSql = fs.readFileSync(path.join(process.cwd(), 'src/db/schema.sql'), 'utf8');

    // MariaDB/MySQL can be picky with multi-statement execution unless split + executed one-by-one.
    // We run statements sequentially to improve compatibility.
    const statements = schemaSql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(Boolean);

    let applied = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await pool.query(stmt);
        applied++;
      } catch (err: any) {
        res.status(500).json({
          ok: false,
          error: err?.message || String(err),
          failedStatementIndex: i,
          failedStatement: stmt.slice(0, 2000),
          applied
        });
        return;
      }
    }

    // 2) Seed data from initialData.ts
    const {
      INITIAL_PRODUCTS,
      INITIAL_DELIVERIES,
      INITIAL_TRANSACTIONS,
      INITIAL_SERVICES,
      INITIAL_SUPPLIER_DELIVERIES,
      MOCK_CUSTOMERS,
    } = await import('./src/initialData');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Products + product_stock + product_variants
      for (const p of INITIAL_PRODUCTS) {
        await conn.query(
          `INSERT INTO products
            (id, name, tagalogName, category, price, cost, shelfLocation, barcode, unit, lowStockThreshold, imagePlaceholderColor, images_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            tagalogName = VALUES(tagalogName),
            category = VALUES(category),
            price = VALUES(price),
            cost = VALUES(cost),
            shelfLocation = VALUES(shelfLocation),
            unit = VALUES(unit),
            lowStockThreshold = VALUES(lowStockThreshold),
            imagePlaceholderColor = VALUES(imagePlaceholderColor),
            images_json = VALUES(images_json)`,
          [
            p.id,
            p.name,
            (p.tagalogName ?? null) as any,
            p.category,
            p.price,
            p.cost,
            p.shelfLocation,
            p.barcode,
            p.unit,
            p.lowStockThreshold,
            (p.imagePlaceholderColor ?? null) as any,
            p.images ? JSON.stringify(p.images) : null,
          ]
        );

        await conn.query(
          `INSERT INTO product_stock (product_id, branch, stock)
           VALUES (?,?,?), (?,?,?)
           ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
          [p.id, 'Poblacion', p.stockBranchA, p.id, 'Bypass', p.stockBranchB]
        );

        await conn.query(`DELETE FROM product_variants WHERE product_id = ?`, [p.id]);
        if (p.variants && Array.isArray(p.variants)) {
          for (const v of p.variants) {
            await conn.query(
              `INSERT INTO product_variants
                (product_id, type, label, qtyPerUnit, price, cost, unitName, image)
               VALUES (?,?,?,?,?,?,?,?)`,
              [p.id, v.type, v.label, v.qtyPerUnit, v.price, v.cost, v.unitName, v.image ?? null]
            );
          }
        }
      }

      // Customers
      for (const c of MOCK_CUSTOMERS) {
        await conn.query(
          `INSERT INTO customers (name, phone, barangay, address, lat, lng)
           VALUES (?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
            phone = VALUES(phone),
            barangay = VALUES(barangay),
            address = VALUES(address),
            lat = VALUES(lat),
            lng = VALUES(lng)`,
          [c.name, c.phone, c.barangay, c.address, c.coordinates[0], c.coordinates[1]]
        );
      }

      // Deliveries + delivery_items
      for (const d of INITIAL_DELIVERIES) {
        await conn.query(
          `INSERT INTO deliveries
            (delivery_id, branch, customer_name, customer_phone, address, barangay, lat, lng, status,
             delivery_fee, total_amount, driver_name, driver_lat, driver_lng, eta_minutes, notes, timestamp)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
            branch = VALUES(branch),
            customer_name = VALUES(customer_name),
            customer_phone = VALUES(customer_phone),
            address = VALUES(address),
            barangay = VALUES(barangay),
            lat = VALUES(lat),
            lng = VALUES(lng),
            status = VALUES(status),
            delivery_fee = VALUES(delivery_fee),
            total_amount = VALUES(total_amount),
            driver_name = VALUES(driver_name),
            driver_lat = VALUES(driver_lat),
            driver_lng = VALUES(driver_lng),
            eta_minutes = VALUES(eta_minutes),
            notes = VALUES(notes),
            timestamp = VALUES(timestamp)`,
          [
            d.id,
            d.branch,
            d.customerName,
            d.customerPhone,
            d.address,
            d.barangay,
            d.coordinates[0],
            d.coordinates[1],
            d.status,
            d.deliveryFee,
            d.totalAmount,
            d.driverName,
            d.driverCoordinates[0],
            d.driverCoordinates[1],
            d.etaMinutes,
            d.notes ?? null,
            d.timestamp,
          ]
        );

        const [dpRows]: any = await conn.query(`SELECT id FROM deliveries WHERE delivery_id = ?`, [d.id]);
        const deliveryPk = dpRows?.[0]?.id;
        if (!deliveryPk) throw new Error(`Failed to resolve delivery pk for ${d.id}`);

        await conn.query(`DELETE FROM delivery_items WHERE delivery_pk = ?`, [deliveryPk]);
        for (const it of d.items) {
          await conn.query(
            `INSERT INTO delivery_items (delivery_pk, product_id, name, quantity, price)
             VALUES (?,?,?,?,?)`,
            [deliveryPk, it.productId, it.name, it.quantity, it.price]
          );
        }
      }

      // Transactions + items
      // NOTE: Transaction seed is temporarily skipped due to repeated SQL syntax errors around reserved column `change`.
      // The system can still operate once POS persistence endpoints are implemented.

      // for (const t of INITIAL_TRANSACTIONS) {
      //   await conn.query(...)
      // }


      // Supplier deliveries + items
      for (const sd of INITIAL_SUPPLIER_DELIVERIES) {
        await conn.query(
          `INSERT INTO supplier_deliveries
            (supplier_delivery_id, supplier_name, branch, delivery_date, total_cost, status, received_by)
           VALUES (?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
            supplier_name = VALUES(supplier_name),
            branch = VALUES(branch),
            delivery_date = VALUES(delivery_date),
            total_cost = VALUES(total_cost),
            status = VALUES(status),
            received_by = VALUES(received_by)`,
          [sd.id, sd.supplierName, sd.branch, sd.deliveryDate, sd.totalCost, sd.status === 'Received' ? 'Received' : 'Pending', sd.receivedBy ?? null]
        );

        const [sdpRows]: any = await conn.query(
          `SELECT id FROM supplier_deliveries WHERE supplier_delivery_id = ?`,
          [sd.id]
        );
        const spPk = sdpRows?.[0]?.id;
        if (!spPk) throw new Error(`Failed to resolve supplier_delivery pk for ${sd.id}`);

        await conn.query(`DELETE FROM supplier_delivery_items WHERE supplier_delivery_pk = ?`, [spPk]);
        for (const it of sd.items) {
          await conn.query(
            `INSERT INTO supplier_delivery_items (supplier_delivery_pk, product_id, product_name, quantity, cost)
             VALUES (?,?,?,?,?)`,
            [spPk, it.productId, it.productName, it.quantity, it.cost]
          );
        }
      }

      // Services
      for (const s of INITIAL_SERVICES) {
        await conn.query(
          `INSERT INTO service_transactions
            (service_txn_id, branch, type, provider, recipient, sender_or_account_name,
             amount, service_fee, total_amount, status, timestamp)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
            branch = VALUES(branch),
            type = VALUES(type),
            provider = VALUES(provider),
            recipient = VALUES(recipient),
            sender_or_account_name = VALUES(sender_or_account_name),
            amount = VALUES(amount),
            service_fee = VALUES(service_fee),
            total_amount = VALUES(total_amount),
            status = VALUES(status),
            timestamp = VALUES(timestamp)`,
          [s.id, s.branch, s.type, s.provider, s.recipient, s.senderOrAccountName, s.amount, s.serviceFee, s.totalAmount, s.status, s.timestamp]
        );
      }

      await conn.commit();

      res.json({
        ok: true,
        applied,
        note: 'Schema applied and seed data inserted from src/initialData.ts.'
      });
    } catch (seedErr: any) {
      await conn.rollback();
      throw seedErr;
    } finally {
      conn.release();
    }

  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
*/

// Serve Vite in development or static dist in production
async function startServer() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error(`Invalid PORT "${process.env.PORT}". Set PORT to a number between 1 and 65535.`);
  }
  validateJwtConfiguration();

  const certificatePath = process.env.HTTPS_CERT_FILE?.trim();
  const privateKeyPath = process.env.HTTPS_KEY_FILE?.trim();
  if (Boolean(certificatePath) !== Boolean(privateKeyPath)) {
    throw new Error('HTTPS requires both HTTPS_CERT_FILE and HTTPS_KEY_FILE to be configured.');
  }

  let httpsCredentials: { cert: Buffer; key: Buffer } | null = null;
  if (certificatePath && privateKeyPath) {
    const resolvedCertificatePath = path.resolve(process.cwd(), certificatePath);
    const resolvedPrivateKeyPath = path.resolve(process.cwd(), privateKeyPath);
    try {
      httpsCredentials = {
        cert: fs.readFileSync(resolvedCertificatePath),
        key: fs.readFileSync(resolvedPrivateKeyPath),
      };
    } catch (error) {
      throw new Error(
        `Unable to read HTTPS certificate/key. Check HTTPS_CERT_FILE (${resolvedCertificatePath}) and HTTPS_KEY_FILE (${resolvedPrivateKeyPath}).`,
        { cause: error }
      );
    }
  }

  // Run DB migrations at startup
  const { validateImageStorageConfiguration } = await import('./src/utils/imageStorage');
  validateImageStorageConfiguration();
  const { runMigrations } = await import("./src/db/mysql");
  await runMigrations();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const protocol = httpsCredentials ? "https" : "http";
  const onListen = () => {
    console.log(`\n Silang Mini Mart Server is running!`);
    console.log(`  - Local:   ${protocol}://localhost:${PORT}`);
    
    const interfaces = os.networkInterfaces();
    let hasNetworkAddress = false;
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (iface) {
        for (const alias of iface) {
          if (alias.family === "IPv4" && !alias.internal) {
            console.log(`  - Network: ${protocol}://${alias.address}:${PORT}`);
            hasNetworkAddress = true;
          }
        }
      }
    }
    if (!hasNetworkAddress) {
      console.log(`  - Network: (No active network interface found or offline)`);
    }
    console.log(`\nTo access this from other devices, make sure they are on the same local network.\n`);
  };

  if (httpsCredentials) {
    createHttpsServer(httpsCredentials, app).listen(PORT, "0.0.0.0", onListen);
  } else {
    app.listen(PORT, "0.0.0.0", onListen);
  }
}

startServer();
