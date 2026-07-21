/**
 * Browsers whose acoustic echo cancellation cannot be trusted: Safari
 * (WebKit), Firefox, and every iOS browser (they are all WebKit under
 * the hood, whatever the brand). On these, playback of the patient's
 * voice leaks back into the microphone loudly enough that Azure's
 * server VAD hears the patient as the doctor — it gets transcribed as
 * a candidate turn and the patient starts answering itself.
 *
 * Two defences key off this predicate:
 *  - server-side: the realtime session is minted with
 *    `interrupt_response: false` so the echo can never cancel the
 *    patient mid-sentence (realtimeToken.ts);
 *  - client-side: the mic track is hard-disabled while patient audio is
 *    playing, so the echo never reaches Azure at all
 *    (useRealtimeSession.ts).
 *
 * Chrome-family desktop/Android browsers have reliable AEC and keep
 * full-duplex behaviour, including barge-in.
 */
export function unreliableEchoCancellation(userAgent: string | null): boolean {
  if (!userAgent) return false;
  if (/firefox|fxios/i.test(userAgent)) return true;
  if (/iphone|ipad|ipod/i.test(userAgent)) return true;
  return /safari/i.test(userAgent) && !/chrome|chromium|crios|edg|android/i.test(userAgent);
}
