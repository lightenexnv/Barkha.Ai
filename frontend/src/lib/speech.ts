// Thin wrappers over the browser's built-in speech APIs: text-to-speech
// (speechSynthesis) and speech recognition (webkitSpeechRecognition, available
// in Chrome/Edge and on Android). Both degrade gracefully: callers always
// offer tap-to-answer, so voice is a convenience, never a requirement.

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionConstructor = new () => Recognition;

const recognitionClass = (): RecognitionConstructor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const canListen = () => recognitionClass() !== null;
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

let voices: SpeechSynthesisVoice[] = [];
const loadVoices = () => {
  if (!canSpeak()) return;
  voices = window.speechSynthesis.getVoices();
};
if (canSpeak()) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

/** Best installed voice for a BCP 47 tag such as "hi-IN" (exact, then same language). */
const voiceFor = (lang: string) => {
  if (!voices.length) loadVoices();
  const base = lang.split("-")[0];
  return (
    voices.find((v) => v.lang === lang && /google|natural|online/i.test(v.name)) ??
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.replace("_", "-").startsWith(`${base}-`)) ??
    null
  );
};

/** True when the device has a voice that can actually speak this language. */
export const hasVoiceFor = (lang: string) => canSpeak() && voiceFor(lang) !== null;

/** Stop anything currently being spoken. */
export const stopSpeaking = () => {
  if (canSpeak()) window.speechSynthesis.cancel();
};

/**
 * Speak text and resolve when finished. Resolves (never rejects) on errors and
 * after a length-based timeout, because some browsers skip the `end` event.
 */
export const speak = (text: string, lang: string, rate = 0.92): Promise<void> =>
  new Promise((resolve) => {
    if (!canSpeak() || !text.trim()) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    const voice = voiceFor(lang);
    if (voice) utterance.voice = voice;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, 2500 + text.length * 110);
    utterance.onend = done;
    utterance.onerror = done;
    synth.speak(utterance);
  });

export class ListenError extends Error {
  constructor(public readonly code: "unsupported" | "no-speech" | "denied" | "aborted" | "failed") {
    super(code);
    this.name = "ListenError";
  }
}

export interface ListenHandle {
  result: Promise<string[]>;
  stop: () => void;
}

/**
 * Listen for one phrase. Resolves with the recogniser's alternatives (best
 * first), or rejects with a ListenError. `stop()` ends listening early.
 */
export const listen = (lang: string, timeoutMs = 9000): ListenHandle => {
  const Ctor = recognitionClass();
  if (!Ctor) return { result: Promise.reject(new ListenError("unsupported")), stop: () => {} };
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 4;
  recognition.continuous = false;

  let timer = 0;
  const result = new Promise<string[]>((resolve, reject) => {
    let heard: string[] | null = null;
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      heard = Array.from({ length: last.length }, (_, i) => last[i].transcript.trim()).filter(Boolean);
    };
    recognition.onerror = (event) => {
      window.clearTimeout(timer);
      const code = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "denied"
        : event.error === "no-speech"
          ? "no-speech"
          : event.error === "aborted"
            ? "aborted"
            : "failed";
      reject(new ListenError(code));
    };
    recognition.onend = () => {
      window.clearTimeout(timer);
      if (heard && heard.length) resolve(heard);
      else reject(new ListenError("no-speech"));
    };
    try {
      recognition.start();
    } catch {
      reject(new ListenError("failed"));
    }
    timer = window.setTimeout(() => recognition.stop(), timeoutMs);
  });
  return { result, stop: () => recognition.stop() };
};
