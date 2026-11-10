/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, X, Bot, Loader2, Mic, Square, Volume2, VolumeX, Play, Pause, Trash2 } from 'lucide-react';
import { Product } from '../types';
import { speakText, stopSpeaking, isSpeechSupported } from '../utils/speechUtils';
import { BrowserSpeechRecognition, createTagalogSpeechRecognition } from '../utils/browserSpeechRecognition';

type SpeechProvider = 'mms' | 'piper' | 'browser';

interface LoggedInUser {
  username: string;
  role: 'admin' | 'customer' | 'rider' | 'supplier';
  name: string;
}

interface AIAssistantProps {
  loggedInUser: LoggedInUser | null;
  categories: string[];
  products: Product[];
}

interface CartAction {
  productId: string;
  quantity: number;
  productName: string;
  unitName: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  cartActions?: CartAction[];
  cartActionDone?: boolean;
  audioUrl?: string;
  isVoiceMessage?: boolean;
  transcription?: string;
}

export default function AIAssistant({ loggedInUser, categories, products }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Text-to-speech states
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [speechProvider, setSpeechProvider] = useState<SpeechProvider>('browser');
  const [availableSpeechProviders, setAvailableSpeechProviders] = useState<SpeechProvider[]>([]);
  const [transcriptionAvailable, setTranscriptionAvailable] = useState(false);
  const [speechError, setSpeechError] = useState<{ messageId: string; message: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recognitionTranscriptRef = useRef('');
  const submitRecognitionRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    void fetch('/api/speech/providers')
      .then(async response => {
        if (!response.ok) throw new Error(`Unable to load speech providers (${response.status}).`);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data.providers) || !data.providers.every((provider: unknown) => provider === 'mms' || provider === 'piper' || provider === 'browser')) {
          throw new Error('The server returned an invalid speech provider list.');
        }
        if (isMounted) {
          setTranscriptionAvailable(data.transcriptionAvailable === true);
          setAvailableSpeechProviders(data.providers);
          if (data.providers.includes(data.defaultProvider)) {
            setSpeechProvider(data.defaultProvider);
          } else if (data.providers.length > 0) {
            setSpeechProvider(data.providers[0]);
          }
        }
      })
      .catch(error => console.error('Unable to load chatbot speech providers:', error));
    return () => {
      isMounted = false;
    };
  }, []);

  const activeRole = loggedInUser?.role || 'customer';
  const activeName = loggedInUser?.name || 'Tamu-tao / Guest';

  // Role-specific AI Identity Definitions
  const aiProfiles: Record<string, { name: string; title: string; avatar: string; description: string; suggestions: string[] }> = {
    admin: {
      name: 'Ka-Sosyong AI',
      title: 'AI Business Advisor & Co-pilot',
      avatar: '💼',
      description: 'Handang tumulong sa business analytics, seguridad, imbentaryo, at pagpapalago ng Silang Mini Mart.',
      suggestions: [
        'Suriin ang mga low-stock items ngayon.',
        'Paano mapapabuti ang kita ng Bypass Branch?',
        'Ipaliwanag ang role security at login protection.',
        'Magbigay ng marketing strategies para sa Silang.'
      ]
    },
    customer: {
      name: 'Ate Digy',
      title: 'Silang Mini Mart Shopping Helper',
      avatar: '💁‍♀️',
      description: 'Sasamahan ka sa pag-browse, magre-recommend ng masusustansya at murang pagkain, at magpapaliwanag ng discounts!',
      suggestions: [
        'Ano ang mga sikat na de-lata rito?',
        'Paano makatipid gamit ang Tingi vs Pakyaw?',
        'Libre ba ang delivery sa Brgy. Sabutan?',
        'Ano ang inyong mga de-kalidad na bigas?'
      ]
    },
    rider: {
      name: 'Kuya Dispatch',
      title: 'Rider Dispatch Assistant',
      avatar: '🏍️',
      description: 'Ka-tropa mo sa kalsada. Alamin ang ruta ng inyong store, delivery updates, at safety tips sa pagbibyahe.',
      suggestions: [
        'Paano i-optimize ang ruta sa Bypass Road?',
        'Magbigay ng tips para sa ligtas na pagbiyahe sa ulan.',
        'Ano ang aking insentibo sa bawat delivery?',
        'Paano kausapin ang customer kapag naliligaw?'
      ]
    },
    staff: {
      name: 'Ka-Ate Lorna Bot',
      title: 'Store Operations Guide',
      avatar: '🏪',
      description: 'Katulong ng mga cashier sa pag-manage ng POS, pag-proseso ng remittances, bills payment, at e-load.',
      suggestions: [
        'Paano mag-apply ng Senior/PWD discount sa POS?',
        'Paano gagawin kapag nagka-error ang GCash payment?',
        'Gabay sa pag-log ng Cebuana at Palawan Remittance.',
        'Ano ang gagawin kapag kulang ang sukli ng customer?'
      ]
    }
  };

  const currentProfile = aiProfiles[loggedInUser ? activeRole : 'customer'];

  // Initialize role-specific chat history
  useEffect(() => {
    let initialGreeting = '';
    
    if (activeRole === 'admin') {
      initialGreeting = `Mabuhay, Manager ${activeName}! Ako ang iyong AI Business Co-pilot. Handa akong magbigay ng pagsusuri tungkol sa security logs, stock levels, sales analytics, at mga diskarte para lumago pa ang Silang Mini Mart. Puwede kang mag-type o mag-iwan ng voice message gamit ang mikropono!`;
    } else if (activeRole === 'rider') {
      initialGreeting = `Magandang araw, Kuya Rider ${activeName}! Handang-handa na ang iyong Dispatch Co-pilot. May tanong ka ba tungkol sa mga ruta sa Silang, traffic, o delivery safety? Puwede kang magsalita sa voice message habang naghahanda sa biyahe!`;
    } else if (activeRole === 'customer') {
      initialGreeting = `Kumusta po, ${activeName}! Ako po si Ate Digy, ang inyong shopping helper. Tutulungan ko kayong makapili ng pinaka-sulit na bilihin. Puwede po kayong mag-type o mag-voice message lang gamit ang mic icon kung nais ninyong magsalita sa Tagalog!`;
    } else {
      initialGreeting = `Kumusta, Ate/Kuya ${activeName}! Handa akong gabayan ka sa mabilisang store operations, POS, e-load transactions, at remittances. Puwede kang magtanong sa chat o magpadala ng voice note!`;
    }

    setMessages([
      {
        id: 'greet-1',
        sender: 'ai',
        text: initialGreeting,
        timestamp: new Date()
      }
    ]);
  }, [activeRole, activeName]);

  // Clean up recording timer and audio playback on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      submitRecognitionRef.current = false;
      speechRecognitionRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isRecording]);

  const detectLanguage = (text: string): 'tl' | 'taglish' | 'en' => {
    const filipinoWords = /\b(ako|ikaw|siya|kami|tayo|po|ba|ang|ng|sa|mga|may|wala|gusto|paano|ano|maaari|pwede|kumusta|salamat|para|itong|ito|yan|iyon|namin|nila|atin|hindi|oo|meron|pabili|sako|kilo)\b/i;
    const hasFilipino = filipinoWords.test(text);
    const hasEnglish = /\b(the|and|please|what|how|where|can|could|have|with|order|price|delivery|product|available)\b/i.test(text);
    if (hasFilipino && hasEnglish) return 'taglish';
    return hasEnglish && !hasFilipino ? 'en' : 'tl';
  };

  const handleToggleSpeak = (messageId: string, text: string) => {
    if (speakingMessageId === messageId) {
      stopSpeaking();
      setSpeakingMessageId(null);
    } else {
      stopSpeaking();
      setSpeakingMessageId(messageId);
      setSpeechError(null);
      speakText(text, {
        provider: speechProvider,
        onEnd: () => setSpeakingMessageId(null),
        onError: (error) => {
          console.error('Tagalog speech generation failed:', error);
          setSpeakingMessageId(null);
          setSpeechError({ messageId, message: error.message });
        }
      });
    }
  };

  const resolveCartActions = (userQuery: string, returnedCartItems: any[]): CartAction[] => {
    if (activeRole !== 'customer') return [];
    let cartItems = Array.isArray(returnedCartItems) ? returnedCartItems : [];

    if (cartItems.length === 0 && userQuery) {
      const normalizedMessage = userQuery.toLowerCase();
      const hasOrderIntent = /\b(order|add|lagay|ilagay|pabili|pakiadd|paki-add|bili|bilhin|kuha|kunin|gusto ko|mag-order)\b|\d+\s*(?:kilos?|kgs?|kilo)\b/i.test(normalizedMessage);
      if (hasOrderIntent) {
        cartItems = products.flatMap((product) => {
          const productName = product.name.toLowerCase().trim();
          if (!productName || !normalizedMessage.includes(productName)) return [];

          const quantityMatch = normalizedMessage.match(/(?:\D|^)(\d{1,3})\s*(?:kilos?|kgs?|kilo)\b/i)
            || normalizedMessage.match(/\b(isa|isang|dalawa|tatlo|apat|lima|anim|pito|walo|siyam|sampu)\s*(?:kilos?|kgs?|kilo)\b/i);
          const numberWords: Record<string, number> = {
            isa: 1, isang: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5,
            anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10
          };
          const quantity = quantityMatch
            ? (/^\d+$/.test(quantityMatch[1]) ? Number(quantityMatch[1]) : numberWords[quantityMatch[1]] || 1)
            : 1;

          return [{ productId: String(product.id), quantity: Math.max(1, Math.min(quantity, 99)) }];
        });
      }
    }

    return cartItems.flatMap((item: { productId: string; quantity: number }) => {
      const product = products.find(candidate => String(candidate.id) === String(item.productId));
      if (!product) return [];
      return [{ productId: String(product.id), quantity: Number(item.quantity) || 1, productName: product.name, unitName: product.unit }];
    });
  };

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: activeRole,
          name: activeName,
          messages: messages.slice(-10).map(m => ({ sender: m.sender, text: m.text })),
          userMessage: trimmed,
          responseLanguage: detectLanguage(trimmed)
        })
      });

      if (!response.ok) throw new Error('Server error');
      const data = await response.json();
      const cartActions = resolveCartActions(trimmed, data.cartItems);

      const aiMsgId = `msg-ai-${Date.now()}`;
      const aiMsg: Message = {
        id: aiMsgId,
        sender: 'ai',
        text: data.reply,
        timestamp: new Date(),
        cartActions
      };
      setMessages(prev => [...prev, aiMsg]);

      // Speak AI response if sound enabled
      if (isSpeechEnabled && isSpeechSupported()) {
        speakText(data.reply, {
          provider: speechProvider,
          onStart: () => setSpeakingMessageId(aiMsgId),
          onEnd: () => setSpeakingMessageId(null),
          onError: (error) => {
            console.error('Tagalog speech generation failed:', error);
            setSpeakingMessageId(null);
            setSpeechError({ messageId: aiMsgId, message: error.message });
          }
        });
      }
      return data.reply;
    } catch (err) {
      console.error('Chatbot error:', err);
      const fallbackMsg = `Paumanhin, nagkaroon ng saglit na aberya sa koneksyon. Maaari po bang subukan muli o mag-type ng inyong katanungan?`;
      setMessages(prev => [...prev, {
        id: `msg-ai-err-${Date.now()}`,
        sender: 'ai',
        text: fallbackMsg,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Voice Recording Handlers ──
  const startRecording = async () => {
    const recognition = createTagalogSpeechRecognition();
    if (recognition) {
      recognitionTranscriptRef.current = '';
      submitRecognitionRef.current = true;
      recognition.onresult = event => {
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal && result[0]?.transcript) {
            recognitionTranscriptRef.current += `${result[0].transcript} `;
          }
        }
      };
      recognition.onerror = event => {
        submitRecognitionRef.current = false;
        const message = event.error === 'not-allowed'
          ? 'Payagan ang microphone access sa browser at subukang muli.'
          : `Hindi gumana ang browser voice recognition (${event.error}).`;
        setMessages(prev => [...prev, {
          id: `msg-ai-voice-error-${Date.now()}`,
          sender: 'ai',
          text: message,
          timestamp: new Date()
        }]);
      };
      recognition.onend = () => {
        const shouldSubmit = submitRecognitionRef.current;
        submitRecognitionRef.current = false;
        speechRecognitionRef.current = null;
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setIsRecording(false);
        setRecordingSeconds(0);
        const transcript = recognitionTranscriptRef.current.trim();
        recognitionTranscriptRef.current = '';
        if (shouldSubmit) {
          if (transcript) void handleSendMessage(transcript);
          else setMessages(prev => [...prev, {
            id: `msg-ai-voice-empty-${Date.now()}`,
            sender: 'ai',
            text: 'Walang malinaw na boses na na-detect. Pindutin ang mikropono at subukang magsalita muli.',
            timestamp: new Date()
          }]);
        }
      };

      try {
        recognition.start();
        speechRecognitionRef.current = recognition;
        setIsRecording(true);
        setRecordingSeconds(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingSeconds(sec => sec + 1);
        }, 1000);
      } catch (error) {
        submitRecognitionRef.current = false;
        recognition.abort();
        const message = error instanceof Error ? error.message : String(error);
        setMessages(prev => [...prev, {
          id: `msg-ai-voice-error-${Date.now()}`,
          sender: 'ai',
          text: `Hindi masimulan ang browser voice recognition: ${message}`,
          timestamp: new Date()
        }]);
      }
      return;
    }

    if (!transcriptionAvailable) {
      alert('Hindi suportado ng browser na ito ang built-in voice recognition. Gumamit ng Chrome o Edge, o i-configure ang HUGGINGFACE_API_TOKEN para sa voice transcription.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200); // 200ms slices
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(sec => sec + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access denied or error:', err);
      alert('Kailangan po ng pahintulot sa Mikropono upang makapag-voice message. Pakitiyak na pinayagan ang microphone access sa inyong browser.');
    }
  };

  const cancelRecording = () => {
    if (speechRecognitionRef.current) {
      submitRecognitionRef.current = false;
      speechRecognitionRef.current.abort();
      speechRecognitionRef.current = null;
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setRecordingSeconds(0);
      recognitionTranscriptRef.current = '';
      return;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const stopAndSendRecording = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      return;
    }
    if (!mediaRecorderRef.current || !isRecording) return;

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);

    const mediaRecorder = mediaRecorderRef.current;

    // Flush any remaining buffered data
    if (mediaRecorder.state === 'recording') {
      try {
        mediaRecorder.requestData();
      } catch (e) {
        // ignore
      }
    }

    mediaRecorder.onstop = async () => {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      const rawMimeType = mediaRecorder.mimeType || 'audio/webm';
      const cleanMimeType = rawMimeType.split(';')[0].trim();
      const audioBlob = new Blob(audioChunksRef.current, { type: cleanMimeType });

      if (audioBlob.size < 100) {
        alert('Masyadong maikli ang voice message o walang narinig. Pakisubukang magsalita muli nang malinaw.');
        setIsLoading(false);
        setRecordingSeconds(0);
        return;
      }

      const localAudioUrl = URL.createObjectURL(audioBlob);

      const userMsgId = `msg-user-voice-${Date.now()}`;
      const userMsg: Message = {
        id: userMsgId,
        sender: 'user',
        text: '🎤 Voice message',
        audioUrl: localAudioUrl,
        isVoiceMessage: true,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);

      // Convert Blob to Base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const resultStr = (reader.result as string) || '';
          const base64Data = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;

          const response = await fetch('/api/chatbot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: activeRole,
              name: activeName,
              messages: messages.slice(-10).map(m => ({ sender: m.sender, text: m.text })),
              userMessage: '🎤 Boses na mensahe',
              audioData: {
                data: base64Data,
                mimeType: cleanMimeType
              },
              responseLanguage: 'tl'
            })
          });

          if (!response.ok) {
            const errorBody = await response.json().catch(() => null);
            throw new Error(errorBody?.error || `Voice transcription failed (${response.status}).`);
          }
          const data = await response.json();

          // Update user message with the transcribed speech
          if (data.transcription) {
            setMessages(prev => prev.map(m =>
              m.id === userMsgId ? { ...m, transcription: data.transcription, text: data.transcription } : m
            ));
          }

          const cartActions = resolveCartActions(data.transcription || '', data.cartItems);
          const aiMsgId = `msg-ai-${Date.now()}`;
          const aiMsg: Message = {
            id: aiMsgId,
            sender: 'ai',
            text: data.reply,
            timestamp: new Date(),
            cartActions
          };
          setMessages(prev => [...prev, aiMsg]);

          // Automatically speak response in Tagalog/multilingual if audio enabled
          if (isSpeechEnabled && isSpeechSupported()) {
            speakText(data.reply, {
              provider: speechProvider,
              onStart: () => setSpeakingMessageId(aiMsgId),
              onEnd: () => setSpeakingMessageId(null),
              onError: (error) => {
                console.error('Tagalog speech generation failed:', error);
                setSpeakingMessageId(null);
                setSpeechError({ messageId: aiMsgId, message: error.message });
              }
            });
          }
        } catch (err) {
          console.error('Voice send error:', err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          setMessages(prev => [...prev, {
            id: `msg-ai-err-${Date.now()}`,
            sender: 'ai',
            text: `Paumanhin, hindi naproseso ang voice message. ${errorMessage}`,
            timestamp: new Date()
          }]);
        } finally {
          setIsLoading(false);
          setRecordingSeconds(0);
        }
      };
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorder.stop();
  };

  const handlePlayVoiceClip = (msgId: string, url: string) => {
    if (playingAudioId === msgId && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      setPlayingAudioId(msgId);
      audio.onended = () => setPlayingAudioId(null);
      audio.onerror = () => setPlayingAudioId(null);
      audio.play().catch(() => setPlayingAudioId(null));
    }
  };

  const handleAddToCart = (messageId: string, actions: CartAction[]) => {
    window.dispatchEvent(new CustomEvent('chatbot:add-to-cart', {
      detail: actions.map(action => ({ productId: action.productId, quantity: action.quantity }))
    }));
    setMessages(prev => prev.map(message =>
      message.id === messageId ? { ...message, cartActionDone: true } : message
    ));
  };

  const formatSeconds = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed bottom-12 right-6 z-50 flex flex-col items-end">
      {/* Expanded Chat Window */}
      {isOpen && (
        <div className="w-[340px] sm:w-[390px] h-[530px] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Chat Window Header */}
          <div className="bg-slate-900 text-white p-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl bg-slate-800 p-1.5 rounded-xl block leading-none">{currentProfile.avatar}</span>
              <div>
                <h4 className="font-extrabold text-xs sm:text-sm text-orange-400 flex items-center gap-1.5">
                  <span>{currentProfile.name}</span>
                  <span className="bg-emerald-500 w-1.5 h-1.5 rounded-full inline-block animate-pulse" title="Online"></span>
                </h4>
                <p className="text-[10px] text-slate-300 font-medium leading-none mt-0.5">{currentProfile.title}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {availableSpeechProviders.length > 1 && (
                <select
                  aria-label="Tagalog voice provider"
                  value={speechProvider}
                  onChange={event => {
                    const provider = event.target.value;
                    if (provider === 'mms' || provider === 'piper') {
                      stopSpeaking();
                      setSpeakingMessageId(null);
                      setSpeechProvider(provider);
                    }
                  }}
                  className="max-w-[86px] rounded-md border border-slate-700 bg-slate-800 px-1.5 py-1 text-[10px] font-semibold text-slate-200"
                  title="Pumili ng Tagalog voice provider"
                >
                  {availableSpeechProviders.map(provider => (
                    <option key={provider} value={provider}>
                      {provider === 'mms' ? 'MMS-TTS' : provider === 'piper' ? 'Piper' : 'Browser'}
                    </option>
                  ))}
                </select>
              )}
              {/* Text-to-Speech Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (isSpeechEnabled) stopSpeaking();
                  setIsSpeechEnabled(!isSpeechEnabled);
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isSpeechEnabled 
                    ? 'text-orange-400 hover:text-orange-300 bg-slate-800/80' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title={isSpeechEnabled ? 'Boses: Naka-ON (Click para i-mute)' : 'Boses: Naka-MUTE (Click para i-on ang Tagalog speech)'}
              >
                {isSpeechEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>

              <button
                onClick={() => {
                  stopSpeaking();
                  setIsOpen(false);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Isara ang chat"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Profile Overview Block */}
          <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 shrink-0 text-left flex items-center justify-between">
            <p className="text-[10px] text-slate-500 font-medium italic truncate">
              {currentProfile.description}
            </p>
            <span className="text-[9px] bg-orange-100 text-orange-800 font-semibold px-1.5 py-0.5 rounded-md ml-2 shrink-0">
              🎤 Voice & Tagalog
            </span>
          </div>

          {/* Message Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-100/30">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              const isSpeakingThis = speakingMessageId === m.id;
              const isPlayingVoiceClip = playingAudioId === m.id;

              return (
                <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} text-left`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-xs ${
                    isUser 
                      ? 'bg-slate-900 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none leading-relaxed'
                  }`}>
                    {/* Bot/User Tag */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] font-mono opacity-50 uppercase tracking-wider">
                        {isUser ? 'IKAW' : currentProfile.name.toUpperCase()}
                      </span>
                      {m.isVoiceMessage && (
                        <span className="text-[8px] bg-orange-500/20 text-orange-300 font-semibold px-1.5 py-0.2 rounded">
                          🎤 Voice Note
                        </span>
                      )}
                    </div>

                    {/* Audio Player if this was a voice message */}
                    {m.audioUrl && (
                      <div className="mb-2 p-2 bg-slate-800/80 rounded-xl flex items-center gap-2 border border-slate-700">
                        <button
                          type="button"
                          onClick={() => handlePlayVoiceClip(m.id, m.audioUrl!)}
                          className="h-7 w-7 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center text-white shrink-0 shadow cursor-pointer transition"
                          title="Pakinggan ang boses"
                        >
                          {isPlayingVoiceClip ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                            <span className="text-[10px] text-slate-200 font-medium">Boses na Mensahe</span>
                          </div>
                          <div className="h-1 bg-slate-700 rounded-full overflow-hidden mt-1">
                            <div className={`h-full bg-orange-400 ${isPlayingVoiceClip ? 'w-full animate-pulse' : 'w-1/3'}`}></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Transcribed text for user voice message */}
                    {m.isVoiceMessage ? (
                      <div className="text-[11px] leading-relaxed">
                        {m.transcription ? (
                          <div>
                            <span className="text-orange-300 font-semibold block text-[9px] uppercase tracking-wide">
                              Naisalin (Transcript):
                            </span>
                            <span className="italic text-slate-200">"{m.transcription}"</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 italic">
                            <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
                            <span>Isinasalin ang inyong boses...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Main content text split by newline */
                      <div className="whitespace-pre-wrap font-sans">
                        {m.text}
                      </div>
                    )}

                    {/* Speech Player for AI responses */}
                    {!isUser && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleToggleSpeak(m.id, m.text)}
                          className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                            isSpeakingThis 
                              ? 'bg-red-50 text-red-600 border border-red-200' 
                              : 'bg-orange-50 hover:bg-orange-100 text-orange-700'
                          }`}
                          title="Pakinggan ang sagot sa Tagalog"
                        >
                          {isSpeakingThis ? (
                            <>
                              <VolumeX className="h-3 w-3 animate-pulse text-red-600" />
                              <span>Ihinto ang Boses</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3 w-3 text-orange-600" />
                              <span>🔊 Pakinggan (Tagalog)</span>
                            </>
                          )}
                        </button>
                        {speechError?.messageId === m.id && (
                          <p role="alert" className="mt-1 text-[10px] font-medium text-red-600">
                            Hindi mapatugtog ang boses: {speechError.message}
                          </p>
                        )}
                        {isSpeakingThis && (
                          <div className="flex items-center gap-0.5">
                            <span className="h-2 w-0.5 bg-orange-500 animate-bounce"></span>
                            <span className="h-3 w-0.5 bg-orange-500 animate-bounce delay-75"></span>
                            <span className="h-2 w-0.5 bg-orange-500 animate-bounce delay-150"></span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Add to Cart Actions */}
                    {!isUser && m.cartActions && m.cartActions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {m.cartActions.map((action, actionIndex) => (
                          <button
                            key={`${action.productId}-${actionIndex}`}
                            type="button"
                            disabled={m.cartActionDone}
                            onClick={() => handleAddToCart(m.id, m.cartActions || [])}
                            className="w-full rounded-lg bg-orange-500 px-3 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-emerald-500 cursor-pointer"
                          >
                            {m.cartActionDone
                              ? '✓ Naisama na sa Delivery Bag'
                              : `Add ${action.quantity} ${action.unitName} of ${action.productName} to Cart`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex justify-start text-left">
                <div className="bg-white text-slate-800 border rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                  <span className="text-[10px] font-semibold text-slate-500">
                    Pinoproseso at sinasagot ni {currentProfile.name}...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions Tray */}
          {messages.length === 1 && !isRecording && (
            <div className="p-2 border-t border-slate-100 bg-white shrink-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1 px-1 text-left">
                Gusto mo bang itanong:
              </span>
              <div className="flex flex-wrap gap-1">
                {currentProfile.suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(sug)}
                    className="px-2 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer text-left transition-colors truncate max-w-full"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Typing & Voice Recording Bar */}
          <div className="p-2 bg-white border-t border-slate-200 shrink-0">
            {isRecording ? (
              /* Live Audio Recording Panel */
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 animate-pulse">
                <div className="flex items-center gap-2 flex-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping"></span>
                  <span className="text-xs font-bold text-red-700">Nagre-record ng boses...</span>
                  <span className="text-xs font-mono font-bold text-red-600 ml-auto">
                    {formatSeconds(recordingSeconds)}
                  </span>
                </div>

                {/* Cancel Recording */}
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition cursor-pointer"
                  title="Kanselahin ang voice recording"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                {/* Stop & Send Recording */}
                <button
                  type="button"
                  onClick={stopAndSendRecording}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow cursor-pointer transition"
                  title="Ipadala ang voice note"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>Ipadala</span>
                </button>
              </div>
            ) : (
              /* Standard Input Form with Mic Button */
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputText);
                }}
                className="flex items-center gap-1.5"
              >
                {/* Voice Record Trigger Button */}
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isLoading}
                  className="p-2 rounded-xl text-slate-600 hover:text-orange-600 hover:bg-orange-50 border border-slate-200 transition cursor-pointer disabled:opacity-50"
                  title="Pindutin para mag-voice message (Magsalita sa Tagalog)"
                >
                  <Mic className="h-4 w-4 text-orange-500" />
                </button>

                <input
                  type="text"
                  placeholder={`Magtanong kay ${currentProfile.name} o mag-voice message...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500"
                />

                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className={`p-2 rounded-xl text-white transition-all cursor-pointer ${
                    !inputText.trim() || isLoading 
                      ? 'bg-slate-200 cursor-not-allowed text-slate-400' 
                      : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                  title="Ipadala ang mensahe"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Floating Sparkly Assistant Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 w-12 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer relative group"
        title="Bukas AI Assistant Co-pilot (Voice & Chat)"
        id="floating-ai-assistant-button"
      >
        {isOpen ? (
          <X className="h-5 w-5 text-orange-400" />
        ) : (
          <>
            <Bot className="h-5 w-5 text-orange-400" />
            <Sparkles className="h-3 w-3 text-yellow-300 absolute -top-1 -right-1 animate-bounce" />
          </>
        )}
      </button>
    </div>
  );
}
