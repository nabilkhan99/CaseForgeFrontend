import { describe, expect, it } from 'vitest';
import { buildSessionPayload, END_OF_TURN_SILENCE_MS } from './realtimeSession';

/**
 * The end-of-turn silence window is the dead air on the front of every patient
 * reply, and it is spent twice over: server VAD uses it on the reliable-AEC
 * path, and the client double-talk detector counts the same number of 50ms
 * frames on the Safari/Firefox/iOS path. These tests pin the single constant
 * both paths read, so a change to one can never silently leave the other
 * behind.
 */
describe('end-of-turn silence', () => {
  it('is 700ms', () => {
    expect(END_OF_TURN_SILENCE_MS).toBe(700);
  });

  it('is what server VAD waits for on the reliable-AEC path', () => {
    const payload = buildSessionPayload(null, { model: 'x', unreliableAec: false });
    const turnDetection = payload.session.audio.input.turn_detection;

    expect(turnDetection?.silence_duration_ms).toBe(700);
    expect(turnDetection?.silence_duration_ms).toBe(END_OF_TURN_SILENCE_MS);
  });

  it('divides into whole 50ms detector frames, so both paths agree', () => {
    // DT_FRAME_MS in useRealtimeSession.ts. 700 / 50 = 14 frames exactly; a
    // window that did not divide cleanly would round the client path off the
    // server one.
    expect(END_OF_TURN_SILENCE_MS % 50).toBe(0);
  });
});
