/**
 * Browsers whose acoustic echo cancellation cannot be trusted: Safari
 * (WebKit), Firefox, and every iOS browser (all WebKit under the hood,
 * whatever the brand). On these, playback of the patient's voice leaks
 * back into the microphone loudly enough to register as doctor speech.
 *
 * CLIENT-SAFE module — imported by both the browser hook and the
 * server-side token minting. Keep it dependency-free.
 *
 * Defences keyed off this predicate:
 *  - server (realtimeToken.ts): session minted with far_field noise
 *    reduction and turn_detection: null — server VAD is off entirely on
 *    this path, so leaked echo is filtered before it can be mistaken for
 *    speech and cannot cancel the patient mid-sentence. (This previously
 *    read "VAD threshold 0.75 and interrupt_response: false"; that stopped
 *    being what the code does when server VAD was switched off.);
 *  - client (useRealtimeSession.ts): a double-talk detector compares
 *    mic energy against the playing patient audio and interrupts the
 *    patient client-side when the doctor genuinely talks over it —
 *    restoring barge-in without trusting the browser's AEC.
 *
 * Chrome-family desktop/Android browsers have reliable AEC and keep
 * native full-duplex behaviour, including server-side barge-in.
 */
export function unreliableEchoCancellation(userAgent: string | null): boolean {
  if (!userAgent) return false;
  if (/firefox|fxios/i.test(userAgent)) return true;
  if (/iphone|ipad|ipod/i.test(userAgent)) return true;
  return /safari/i.test(userAgent) && !/chrome|chromium|crios|edg|android/i.test(userAgent);
}
