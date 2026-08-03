// Synthesised celebration sound — a cash-register "cha-ching" followed by a
// scatter of coin clinks.
//
// Generated with the Web Audio API rather than shipped as an audio file: no
// asset to download, nothing to license, and no bundle weight. Everything is
// created on demand and torn down when it finishes.
//
// Browsers block audio that isn't tied to a user gesture. This only ever plays
// as a result of the user logging income, so the page already has activation —
// but the call is still wrapped defensively, because a blocked or unsupported
// AudioContext must never break the animation it accompanies.

/** Short bell-like tone with a quick exponential decay — one "clink". */
function clink(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  startAt: number,
  duration: number,
  gain: number
) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  // Triangle has more upper harmonics than a sine, which is what makes it read
  // as metallic rather than as a plain beep.
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, startAt);

  env.gain.setValueAtTime(0, startAt);
  env.gain.linearRampToValueAtTime(gain, startAt + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(env).connect(destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

export function playCashSound(): void {
  if (typeof window === "undefined") return;

  // Someone who asked the OS for reduced motion probably doesn't want a
  // surprise noise either.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  // Nothing to celebrate in a background tab.
  if (typeof document !== "undefined" && document.hidden) return;

  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    void ctx.resume();

    const master = ctx.createGain();
    // Kept low on purpose: this is a flourish, not an alarm.
    master.gain.value = 0.14;
    master.connect(ctx.destination);

    const t0 = ctx.currentTime + 0.02;

    // "Cha-ching": two bright tones a fifth apart, the second just behind the
    // first — the interval is what makes it sound like a register rather than
    // two unrelated beeps.
    clink(ctx, master, 1046, t0, 0.18, 0.9);
    clink(ctx, master, 1568, t0 + 0.11, 0.5, 1);

    // Coins scattering, spread across the first part of the rain. Frequencies
    // are jittered so no two clinks sound identical.
    for (let i = 0; i < 14; i++) {
      const at = t0 + 0.35 + Math.random() * 1.7;
      const freq = 1700 + Math.random() * 1500;
      clink(ctx, master, freq, at, 0.12 + Math.random() * 0.1, 0.28 + Math.random() * 0.22);
    }

    // Release the hardware once the last tail has died away.
    window.setTimeout(() => void ctx.close().catch(() => {}), 3500);
  } catch {
    // Audio is optional; a failure here is not worth surfacing.
  }
}
