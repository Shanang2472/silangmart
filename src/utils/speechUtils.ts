/**
 * Tagalog speech playback using browser speech, Piper, or Facebook MMS-TTS.
 */

export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
  provider?: 'mms' | 'piper' | 'browser';
}

let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeRequest: AbortController | null = null;
let activeCallbacks: SpeakOptions | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let speechRequestId = 0;

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' &&
    (typeof Audio !== 'undefined' || typeof window.speechSynthesis !== 'undefined');
}

export function cleanTextForSpeech(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#`~>]/g, ' ')
    .replace(/^\s*[-•*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/₱\s*(\d+(?:\.\d+)?)/g, '$1 pesos')
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function releaseActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.onplaying = null;
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
}

function splitSpeechIntoChunks(text: string, maxLength = 180): string[] {
  const sentences = text.match(/[^.!?;:]+[.!?;:]?|[.!?;:]+/g) || [text];
  const chunks: string[] = [];
  let current = '';

  const addWords = (sentence: string) => {
    for (const word of sentence.trim().split(/\s+/)) {
      if (!word) continue;
      if (current && current.length + word.length + 1 > maxLength) {
        chunks.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
  };

  for (const sentence of sentences) {
    const part = sentence.trim();
    if (!part) continue;
    if (current && current.length + part.length + 1 > maxLength) {
      chunks.push(current);
      current = '';
    }
    addWords(part);
  }

  if (current) chunks.push(current);
  return chunks;
}

export function speakText(text: string, options: SpeakOptions = {}): void {
  stopSpeaking();
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) {
    options.onEnd?.();
    return;
  }

  if (options.provider === 'browser') {
    if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') {
      options.onError?.(new Error('Browser speech is not supported. Use a recent version of Chrome or Edge.'));
      return;
    }

    const requestId = ++speechRequestId;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(candidate => /^fil(-|$)/i.test(candidate.lang))
      || voices.find(candidate => /^tl(-|$)/i.test(candidate.lang))
      || null;
    activeCallbacks = options;

    const chunks = splitSpeechIntoChunks(cleaned);
    let chunkIndex = 0;
    const speakNextChunk = () => {
      if (requestId !== speechRequestId) return;
      if (chunkIndex >= chunks.length) {
        activeUtterance = null;
        activeCallbacks = null;
        options.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex++]);
      utterance.lang = 'fil-PH';
      utterance.voice = voice;
      activeUtterance = utterance;
      utterance.onstart = () => {
        if (requestId === speechRequestId && chunkIndex === 1) options.onStart?.();
      };
      utterance.onend = speakNextChunk;
      utterance.onerror = event => {
        if (requestId !== speechRequestId) return;
        activeUtterance = null;
        activeCallbacks = null;
        options.onError?.(new Error(`Browser speech failed: ${event.error}.`));
      };
      window.speechSynthesis.speak(utterance);
    };

    speakNextChunk();
    return;
  }

  if (!isSpeechSupported() || typeof Audio === 'undefined') {
    options.onError?.(new Error('Audio playback is not supported in this browser.'));
    return;
  }

  const requestId = ++speechRequestId;
  const controller = new AbortController();
  activeRequest = controller;
  activeCallbacks = options;

  void (async () => {
    try {
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleaned, provider: options.provider || 'mms' }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || `Tagalog speech request failed (${response.status}).`);
      }

      const audioUrl = URL.createObjectURL(await response.blob());
      if (requestId !== speechRequestId) {
        URL.revokeObjectURL(audioUrl);
        return;
      }

      const audio = new Audio(audioUrl);
      activeAudioUrl = audioUrl;
      activeAudio = audio;
      activeRequest = null;
      audio.onplaying = () => options.onStart?.();
      audio.onended = () => {
        if (requestId !== speechRequestId) return;
        releaseActiveAudio();
        activeCallbacks = null;
        options.onEnd?.();
      };
      audio.onerror = () => {
        if (requestId !== speechRequestId) return;
        releaseActiveAudio();
        activeCallbacks = null;
        options.onError?.(new Error('Unable to play the generated Tagalog audio.'));
      };
      await audio.play();
    } catch (error) {
      if (requestId !== speechRequestId || (error instanceof DOMException && error.name === 'AbortError')) return;
      activeRequest = null;
      activeCallbacks = null;
      releaseActiveAudio();
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  })();
}

export function stopSpeaking(): void {
  speechRequestId += 1;
  activeRequest?.abort();
  activeRequest = null;
  releaseActiveAudio();
  if (activeUtterance && typeof window !== 'undefined') {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  }
  const callbacks = activeCallbacks;
  activeCallbacks = null;
  callbacks?.onEnd?.();
}

export function isCurrentlySpeaking(): boolean {
  return Boolean(activeRequest || activeAudio && !activeAudio.paused && !activeAudio.ended);
}
