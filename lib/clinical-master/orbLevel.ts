/**
 * The patient's voice, turned into something an orb can breathe with.
 *
 * The raw number comes from `receiverAudioLevel` in `useRealtimeSession`: the
 * RFC 6464 header extension, surfaced by the RTP receiver as a LINEAR 0..1
 * value where 1.0 is 0 dBov. Linear is the wrong space to draw in — ordinary
 * speech lands somewhere between 0.03 and 0.3, so a straight `scale(level)`
 * would spend nine tenths of its travel on silence and barely twitch while the
 * patient is talking. Everything here exists to fix that:
 *
 *  1. `normaliseLevel` — back to decibels, then a window that puts quiet speech
 *     at the bottom of the orb's travel and loud speech at the top.
 *  2. `followEnvelope` — asymmetric smoothing. Voice is spiky: a symmetric
 *     filter either lags the attack (mushy) or strobes on the decay (jittery).
 *  3. The `*Scale` / `*Opacity` mappings — the 0..1 envelope onto `transform`
 *     and `opacity` and nothing else, because those are the only two properties
 *     the render loop is allowed to touch. See PatientOrb for why.
 *
 * All of it is pure and frame-rate agnostic apart from `followEnvelope`, whose
 * coefficients assume the ~30Hz cadence PatientOrb drives it at.
 */

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function lerp(from: number, to: number, fraction: number): number {
  return from + (to - from) * clamp01(fraction);
}

/**
 * Bottom of the useful window. Below roughly -45 dBov the receiver is reporting
 * line noise and room tone between words, not the patient.
 */
export const LEVEL_FLOOR_DB = -45;

/**
 * Top of the useful window. A speech-to-speech TTS voice rarely exceeds about
 * -12 dBov, so anchoring the ceiling there means a normal sentence uses most of
 * the orb's range instead of a sliver at the bottom.
 */
export const LEVEL_CEILING_DB = -12;

/**
 * A raw linear RTP audio level as a 0..1 position in the useful speech window.
 * Silence, absent readings and nonsense all collapse to 0.
 */
export function normaliseLevel(
  raw: number,
  floorDb: number = LEVEL_FLOOR_DB,
  ceilingDb: number = LEVEL_CEILING_DB
): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (ceilingDb <= floorDb) return 0;
  const db = 20 * Math.log10(Math.min(1, raw));
  return clamp01((db - floorDb) / (ceilingDb - floorDb));
}

/** Rise coefficient per frame. Reaches ~90% of a step in about four frames. */
export const ENVELOPE_ATTACK = 0.4;

/** Fall coefficient per frame. Roughly a half-second glide back to rest. */
export const ENVELOPE_RELEASE = 0.12;

/**
 * One step of an asymmetric envelope follower: quick to rise, slow to fall.
 *
 * Speech energy drops to nothing between syllables. Following that faithfully
 * makes the orb flicker; following it symmetrically slowly makes it feel
 * detached from the voice. Fast attack plus slow release is the same shape a
 * compressor uses, and for the same reason.
 */
export function followEnvelope(
  current: number,
  target: number,
  attack: number = ENVELOPE_ATTACK,
  release: number = ENVELOPE_RELEASE
): number {
  const from = Number.isFinite(current) ? current : 0;
  const to = clamp01(target);
  const alpha = clamp01(to > from ? attack : release);
  return from + (to - from) * alpha;
}

/**
 * A voice-shaped envelope invented from the clock, for browsers whose RTP
 * receiver never reports `audioLevel`.
 *
 * Without this the orb would sit dead still on those browsers while the patient
 * talks — a regression against the 48-bar waveform it replaces, which animated
 * off the speaking flag alone and therefore worked everywhere. Two detuned
 * sines beat against each other so it never settles into a visible loop.
 */
export function syntheticEnvelope(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs)) return 0;
  const slow = Math.sin(elapsedMs / 340);
  const fast = Math.sin(elapsedMs / 97 + 1.7);
  return clamp01(0.45 + 0.3 * slow + 0.18 * fast);
}

/** Resting scale of the sphere. */
export const ORB_MIN_SCALE = 1;
/** Scale at full voice. Deliberately small — the initials sit on top of it. */
export const ORB_MAX_SCALE = 1.12;

/** The sphere's scale for a 0..1 envelope. */
export function orbScale(envelope: number): number {
  return lerp(ORB_MIN_SCALE, ORB_MAX_SCALE, envelope);
}

export const HALO_MIN_SCALE = 0.88;
export const HALO_MAX_SCALE = 1.22;

/** The surrounding glow's scale for a 0..1 envelope. */
export function haloScale(envelope: number): number {
  return lerp(HALO_MIN_SCALE, HALO_MAX_SCALE, envelope);
}

export const HALO_MIN_OPACITY = 0.22;
export const HALO_MAX_OPACITY = 0.72;

/** The surrounding glow's opacity for a 0..1 envelope. */
export function haloOpacity(envelope: number): number {
  return lerp(HALO_MIN_OPACITY, HALO_MAX_OPACITY, envelope);
}

export const SHEEN_MIN_OPACITY = 0.35;
export const SHEEN_MAX_OPACITY = 0.85;

/**
 * The highlight on the sphere's shoulder for a 0..1 envelope.
 *
 * This is how the orb "brightens" without animating a colour or a box-shadow —
 * both of which repaint. Fading a pre-painted white gradient in and out is a
 * compositor-only operation.
 */
export function sheenOpacity(envelope: number): number {
  return lerp(SHEEN_MIN_OPACITY, SHEEN_MAX_OPACITY, envelope);
}
