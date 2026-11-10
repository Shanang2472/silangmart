/**
 * Sound Manager — Web Audio API synthetic notification sounds
 * No external audio files required. Generates chimes programmatically.
 */

type SoundLevel = 'normal' | 'important' | 'critical';

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

/** Call this on the first user interaction to unlock audio context */
export function initAudio(): void {
  if (audioUnlocked) return;
  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Resume if suspended (required by some browsers)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    audioUnlocked = true;
  } catch {
    // Browser does not support Web Audio API
  }
}

/** Returns true if audio is ready to play */
export function isAudioReady(): boolean {
  return audioUnlocked && audioCtx !== null && audioCtx.state === 'running';
}

/**
 * Plays a tone using Web Audio API oscillator
 * @param freq  Frequency in Hz
 * @param start Start time (AudioContext time)
 * @param dur   Duration in seconds
 * @param vol   Volume 0–1
 * @param type  Oscillator waveform type
 */
function playTone(
  ctx: AudioContext,
  freq: number,
  start: number,
  dur: number,
  vol = 0.35,
  type: OscillatorType = 'sine'
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  // Gentle attack & decay envelope
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.02);
  gain.gain.setValueAtTime(vol, start + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0, start + dur);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur);
}

/**
 * Normal — single soft chime (order update, read notification)
 * C5 → E5
 */
function playSoundNormal(ctx: AudioContext): void {
  const t = ctx.currentTime;
  playTone(ctx, 523.25, t, 0.25, 0.28);         // C5
  playTone(ctx, 659.25, t + 0.15, 0.30, 0.22);  // E5
}

/**
 * Important — two-note ascending chime (new order, rider assigned)
 * C5 → G5 → C6
 */
function playSoundImportant(ctx: AudioContext): void {
  const t = ctx.currentTime;
  playTone(ctx, 523.25, t, 0.20, 0.35);          // C5
  playTone(ctx, 783.99, t + 0.18, 0.22, 0.35);   // G5
  playTone(ctx, 1046.5, t + 0.36, 0.35, 0.30);   // C6
}

/**
 * Critical — three-note urgent alert (payment failure, system alert, cancellation)
 * A4 → A4 → A4 (triple pulse), slightly dissonant
 */
function playSoundCritical(ctx: AudioContext): void {
  const t = ctx.currentTime;
  playTone(ctx, 880, t,        0.12, 0.50, 'square');  // A5
  playTone(ctx, 880, t + 0.18, 0.12, 0.45, 'square');  // A5
  playTone(ctx, 659, t + 0.36, 0.20, 0.40, 'square');  // E5 (resolve down)
}

/**
 * Play a notification sound by priority level.
 * @param level 'normal' | 'important' | 'critical'
 * @returns true if sound played, false if audio not ready
 */
export function playSound(level: SoundLevel = 'normal'): boolean {
  if (!audioCtx || !audioUnlocked) return false;

  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => playSound(level));
      return false;
    }

    switch (level) {
      case 'normal':
        playSoundNormal(audioCtx);
        break;
      case 'important':
        playSoundImportant(audioCtx);
        break;
      case 'critical':
        playSoundCritical(audioCtx);
        break;
    }
    return true;
  } catch (err) {
    console.warn('[SoundManager] Playback error:', err);
    return false;
  }
}

/** Map notification category + priority to sound level */
export function getSoundLevel(
  category: string,
  priority: string | undefined
): SoundLevel {
  if (priority === 'critical') return 'critical';
  if (priority === 'important') return 'important';

  switch (category) {
    case 'orders':
      return 'important';
    case 'payment':
      return 'important';
    case 'delivery':
      return 'normal';
    case 'inventory':
      return 'normal';
    case 'security':
    case 'system':
      return 'critical';
    default:
      return 'normal';
  }
}
