// 🔊 Reading a card out loud.
//
// The first attempt at this used `speechSynthesis.speak()` with no voice set, which
// means the platform default — on Apple that is **Samantha**, a voice from the old
// macOS set that sounds like a train station announcement. Devin's verdict was "so
// robotic", and he was right, so read-aloud was pulled entirely.
//
// This is the fix: choose deliberately. A typical Mac exposes ~180 voices, most of
// them either novelty toys (Bad News, Bubbles, Zarvox) or dated. The good ones are
// findable if you rank rather than take what you are given.
//
// Read-aloud is not a nice-to-have here: the audience is third graders and the cards
// ARE the lesson, so a kid who cannot read one yet still needs a way in. Better audio,
// not none.

const NOVELTY = /bad news|good news|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|bells|pipe|deranged|albert|fred|junior|ralph|kathy|princess|bruce|agnes|grandma|grandpa/i;

// Best first. Anything matching an earlier rule beats anything matching a later one.
const RANKS: RegExp[] = [
  /natural/i,                                   // Microsoft "… (Natural)" — genuinely good
  /neural|premium|enhanced/i,                   // Apple Enhanced/Premium downloads, Edge neural
  /^Google (US|UK) English/i,                   // Chrome's network voices
  /^Microsoft (Aria|Jenny|Michelle|Sonia|Libby)/i,
  /^(Ava|Allison|Susan|Serena|Nicky|Zoe)\b/i,   // modern Apple, if installed
  /^(Sandy|Shelley|Flo|Reed)\b/i,               // Apple's newer set — warmer than Samantha
  /^(Karen|Moira|Tessa|Daniel)\b/i,             // regional, dated but human
  /^Samantha\b/i,                               // the default, and the floor
];

let chosen: SpeechSynthesisVoice | null = null;
let resolved = false;

function pick(): SpeechSynthesisVoice | null {
  let voices: SpeechSynthesisVoice[] = [];
  try { voices = window.speechSynthesis.getVoices(); } catch { return null; }
  const en = voices.filter((v) => /^en(-|$)/i.test(v.lang) && !NOVELTY.test(v.name));
  if (!en.length) return null;
  const score = (v: SpeechSynthesisVoice) => {
    for (let i = 0; i < RANKS.length; i++) if (RANKS[i].test(v.name)) return i;
    return RANKS.length;
  };
  return en.slice().sort((a, b) => {
    const d = score(a) - score(b);
    if (d) return d;
    // a network voice is almost always the neural one; prefer it on a tie
    if (a.localService !== b.localService) return a.localService ? 1 : -1;
    // then US English, purely because these towns are in Massachusetts
    const au = /^en-US/i.test(a.lang) ? 0 : 1, bu = /^en-US/i.test(b.lang) ? 0 : 1;
    return au - bu;
  })[0] || null;
}

// Voices load asynchronously in every browser and are EMPTY on first call in most —
// hence the voiceschanged listener rather than a single read at startup.
export function primeVoice() {
  if (resolved) return;
  const attempt = () => {
    const v = pick();
    if (v) { chosen = v; resolved = true; }
  };
  attempt();
  try {
    window.speechSynthesis.addEventListener('voiceschanged', attempt);
  } catch { /* older engines */ }
}

export function voiceName(): string | null {
  return chosen?.name ?? null;
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, onDone?: () => void) {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
    if (!chosen) primeVoice();
    const u = new SpeechSynthesisUtterance(text);
    if (chosen) { u.voice = chosen; u.lang = chosen.lang; }
    // a shade under natural pace: these are read-along cards for eight-year-olds,
    // and the default clip is faster than a kid can track a line of text
    u.rate = 0.92;
    u.pitch = 1.02;
    if (onDone) { u.onend = onDone; u.onerror = onDone; }
    window.speechSynthesis.speak(u);
  } catch { onDone?.(); }
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* fine */ }
}
