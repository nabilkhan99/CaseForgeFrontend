/**
 * Speculative reply — pay the ASR wait only when it turns out to matter.
 *
 * Since 26 Jul the patient's reply has been GATED on the doctor's transcript:
 * the buffer is committed at the end of a turn, but `response.create` waits
 * until `conversation.item.input_audio_transcription.completed` proves the turn
 * was a finished question rather than "Okay and um" (doctorTurn.ts explains why
 * that gate exists and what answering filler costs). It works, and it is slow:
 * across 5,100 real turns the transcript lands 0.55s median / 0.64s p90 after
 * `speech_stopped`, and every one of those milliseconds is added to the reply,
 * on every turn, including the ~95% that were going to be answered anyway.
 *
 * So: guess, then check. On a commit, wait a short breath
 * (SPECULATIVE_REPLY_DELAY_MS, 400ms) rather than the whole transcript round
 * trip. If the doctor has not started talking again by then, ask for the reply
 * and remember it is unverified. When the transcript arrives it runs the SAME
 * gate as before — if it says "reply", the reply is already on its way
 * (`spec:confirmed`); if it says "withhold", the speculative response is
 * cancelled (`spec:cancelled`).
 *
 * WHY 400ms, and why this is not just "answer everything faster": of the
 * doctors who resume talking within 2s of `speech_stopped`, 82% resume within
 * 1s and most within 0.5s. The breath is what separates "they stopped because
 * they finished" from "they stopped to think", and it costs a fraction of the
 * transcript wait. The transcript remains the authority — this only changes
 * whether the patient starts speaking before or after that authority rules.
 *
 * WHAT A WRONG GUESS COSTS: a cancelled response. If the cancel lands before
 * `output_audio_buffer.started` the doctor hears nothing at all; if it lands
 * after, they hear a fragment of a syllable. `spec:cancelled` carries
 * `audioStarted` precisely so that clash rate can be counted from
 * `voice_session_logs` rather than guessed at.
 *
 * FEATURE FLAG: `NEXT_PUBLIC_VOICE_SPECULATIVE_MS`.
 *   unset / invalid -> 400 (speculation on, the default)
 *   any positive N  -> N ms breath
 *   0               -> speculation OFF; the machine never leaves `idle`, no
 *                      action is ever emitted, and the transcript gate behaves
 *                      exactly as it did before this file existed.
 *
 * This module is pure. It owns no timers, sends no events and reads no refs —
 * the hook supplies the guards (`ended`, `doctorResumed`, `responseActive`) at
 * the instant they are needed and performs the actions it is handed back.
 *
 * INVARIANT THIS REDUCER RELIES ON, AND WHICH ONLY THE HOOK CAN KEEP:
 * every commit path is structurally preceded by its doctor-resumed equivalent,
 * because the doctor cannot commit a second turn without having started to
 * speak again first —
 *
 *   server VAD path   : `speech_started`            precedes `speech_stopped`
 *   client detector   : `turn-open` (or `BARGE-IN`) precedes `turn-commit`
 *
 * so `turn-committed` can never reach the `sent` state: the `doctor-resumed`
 * that must come first has already returned it to `idle`. That is why `sent`
 * treats a commit as a no-op instead of trying to queue a second speculation,
 * and why a second pending commit can never coexist with an unverified reply.
 * If a future change ever commits a turn WITHOUT a preceding resume signal
 * (a new watchdog, a synthetic commit), that assumption breaks and this reducer
 * needs a real queue rather than a single slot.
 */

import { isIncompleteDoctorTurn } from './doctorTurn';

/** Breath between the doctor stopping and the speculative reply. See above. */
export const DEFAULT_SPECULATIVE_REPLY_DELAY_MS = 400;

/**
 * Read the delay out of `NEXT_PUBLIC_VOICE_SPECULATIVE_MS`.
 *
 * Junk falls back to the default rather than to 0: a typo in a Vercel env var
 * should not silently revert a latency fix, and a negative or infinite delay is
 * a timer that never fires (i.e. a mute patient), which is far worse than
 * either intended behaviour.
 */
export function parseSpeculativeDelayMs(raw: string | undefined): number {
    const trimmed = (raw ?? '').trim();
    if (trimmed === '') return DEFAULT_SPECULATIVE_REPLY_DELAY_MS;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_SPECULATIVE_REPLY_DELAY_MS;
    return Math.floor(parsed);
}

/** Why a committed turn does not earn a patient reply. */
export type WithholdReason = 'ended' | 'doctor-resumed' | 'dropped' | 'incomplete';

export type RespondVerdict = { reply: true } | { reply: false; reason: WithholdReason };

/**
 * The reply gate, as a pure function of what was said and what is true right
 * now. This is the logic that has lived inline in `resolveRespondDecision`
 * since 26 Jul, lifted out unchanged so the speculative path and the ordinary
 * path can never drift apart.
 *
 * Order matters and is the original order: the buzzer beats everything (a
 * transcript can still land after the consultation ends — captureFinalTurn
 * holds the transport open for exactly that), then a doctor who has started
 * talking again, then what the words actually were.
 */
export function respondVerdict(
    said: string,
    dropped: boolean,
    ctx: { ended: boolean; doctorResumed: boolean }
): RespondVerdict {
    if (ctx.ended) return { reply: false, reason: 'ended' };
    if (ctx.doctorResumed) return { reply: false, reason: 'doctor-resumed' };
    if (dropped) return { reply: false, reason: 'dropped' };
    if (isIncompleteDoctorTurn(said)) return { reply: false, reason: 'incomplete' };
    return { reply: true };
}

/**
 * idle  — nothing outstanding. The only state reachable with the flag off.
 * armed — a turn is committed and the breath is running.
 * sent  — a speculative `response.create` is in flight, unverified.
 *         `audioStarted` records whether the doctor could actually hear it.
 *         `responseId` is the server's id for it, latched from `response.created`
 *         and null until that arrives. It exists so a LATE `response.done` for
 *         some earlier, already-cancelled response cannot be mistaken for this
 *         one settling — see the `response-settled` branch.
 */
export type SpeculativeState =
    | { kind: 'idle' }
    | { kind: 'armed' }
    | { kind: 'sent'; audioStarted: boolean; responseId: string | null };

export const INITIAL_SPECULATIVE_STATE: SpeculativeState = { kind: 'idle' };

export type SpeculativeEvent =
    /** A doctor turn was committed (`speech_stopped` on Chrome, `turn-commit`
     *  on the client-detector path). `enabled` is the feature flag. */
    | { type: 'turn-committed'; enabled: boolean }
    /** The breath elapsed. Guards are sampled by the hook at this instant. */
    | { type: 'delay-elapsed'; ended: boolean; doctorResumed: boolean; responseActive: boolean }
    /** The doctor started speaking again (`speech_started`, or the client
     *  detector opening a turn / calling a barge-in). */
    | { type: 'doctor-resumed' }
    /** `output_audio_buffer.started` — the patient became audible. */
    | { type: 'audio-started' }
    /** `response.created` — the server has named the response we just asked
     *  for. Latched so the settle below can be correlated. */
    | { type: 'response-created'; responseId: string }
    /** The transcript landed and the ordinary gate has ruled on it. */
    | { type: 'transcript'; verdict: RespondVerdict }
    /** `response.done` for the response named by `responseId` — nothing is in
     *  flight any more, whatever happened to the transcript. Without this a
     *  transcript that never arrives would leave the machine armed to cancel
     *  some later, legitimate reply. */
    | { type: 'response-settled'; responseId: string | null }
    /** Teardown / end of consultation. */
    | { type: 'reset' };

export type SpeculativeAction =
    | { type: 'start-timer' }
    | { type: 'clear-timer' }
    /** Send `response.create`. */
    | { type: 'send-create' }
    /** Cancel the in-flight response and flush its audio (the hook's existing
     *  barge-in plumbing). */
    | { type: 'cancel-response' }
    /** The turn is answered: drop every pending commit and the fallback timer.
     *  Mirrors the reply branch of `resolveRespondDecision`. */
    | { type: 'clear-pending' }
    /** The turn is resolved without a reply: release one pending commit.
     *  Mirrors the withhold branch of `resolveRespondDecision`. */
    | { type: 'release-pending' }
    | { type: 'log'; event: string; data?: Record<string, unknown> };

export interface SpeculativeResult {
    readonly next: SpeculativeState;
    readonly actions: readonly SpeculativeAction[];
    /**
     * Only ever true for a `transcript` event that resolved a speculative
     * response. The hook must then NOT run its ordinary respond path — the
     * reply is already in flight (or has just been cancelled), and a second
     * `response.create` would give the patient two voices.
     */
    readonly handled: boolean;
}

const NOTHING = { actions: [] as readonly SpeculativeAction[], handled: false };

/** Cancel whatever is in flight and say why. */
function cancel(state: { audioStarted: boolean }, reason: WithholdReason): SpeculativeResult {
    return {
        next: { kind: 'idle' },
        actions: [
            {
                type: 'log',
                event: 'spec:cancelled',
                data: { reason, audioStarted: state.audioStarted },
            },
            { type: 'cancel-response' },
        ],
        handled: false,
    };
}

/** The breath elapsed while armed: speculate, or explain why not. */
function onDelayElapsed(
    event: Extract<SpeculativeEvent, { type: 'delay-elapsed' }>
): SpeculativeResult {
    const idle = { next: { kind: 'idle' } as SpeculativeState, handled: false };
    if (event.ended) {
        return { ...idle, actions: [{ type: 'log', event: 'spec:skipped', data: { reason: 'ended' } }] };
    }
    if (event.doctorResumed) {
        return { ...idle, actions: [{ type: 'log', event: 'spec:resumed-within-delay' }] };
    }
    if (event.responseActive) {
        return {
            ...idle,
            actions: [{ type: 'log', event: 'spec:skipped', data: { reason: 'response-active' } }],
        };
    }
    return {
        next: { kind: 'sent', audioStarted: false, responseId: null },
        actions: [{ type: 'log', event: 'spec:sent' }, { type: 'send-create' }],
        handled: false,
    };
}

/** The transcript landed on an in-flight speculative reply: confirm or cancel. */
function onVerifiedTranscript(
    state: { audioStarted: boolean },
    verdict: RespondVerdict
): SpeculativeResult {
    if (verdict.reply) {
        return {
            next: { kind: 'idle' },
            actions: [{ type: 'log', event: 'spec:confirmed' }, { type: 'clear-pending' }],
            handled: true,
        };
    }
    const cancelled = cancel(state, verdict.reason);
    return {
        next: cancelled.next,
        actions: [...cancelled.actions, { type: 'release-pending' }],
        handled: true,
    };
}

/**
 * One transition. Pure: returns a NEW state plus the actions the hook should
 * perform, and never touches the state it was given.
 */
export function reduceSpeculative(
    state: SpeculativeState,
    event: SpeculativeEvent
): SpeculativeResult {
    if (event.type === 'reset') {
        return { next: { kind: 'idle' }, actions: [{ type: 'clear-timer' }], handled: false };
    }

    switch (state.kind) {
        case 'idle':
            // With the flag off this is the only branch ever taken, and it
            // emits nothing — the transcript gate is untouched.
            if (event.type === 'turn-committed' && event.enabled) {
                return { next: { kind: 'armed' }, actions: [{ type: 'start-timer' }], handled: false };
            }
            return { next: state, ...NOTHING };

        case 'armed':
            switch (event.type) {
                case 'turn-committed':
                    // Re-arm on the latest commit, matching armRespondDecision's
                    // fail-open-on-the-most-recent-words behaviour.
                    return event.enabled
                        ? {
                              next: state,
                              actions: [{ type: 'clear-timer' }, { type: 'start-timer' }],
                              handled: false,
                          }
                        : { next: state, ...NOTHING };
                case 'delay-elapsed':
                    return onDelayElapsed(event);
                case 'doctor-resumed':
                    return {
                        next: { kind: 'idle' },
                        actions: [
                            { type: 'clear-timer' },
                            { type: 'log', event: 'spec:resumed-within-delay' },
                        ],
                        handled: false,
                    };
                case 'transcript':
                    // Beat the breath. Nothing was risked, so fall straight
                    // through to the behaviour that predates this module.
                    return {
                        next: { kind: 'idle' },
                        actions: [
                            { type: 'clear-timer' },
                            { type: 'log', event: 'spec:transcript-first' },
                        ],
                        handled: false,
                    };
                default:
                    return { next: state, ...NOTHING };
            }

        case 'sent':
            switch (event.type) {
                case 'audio-started':
                    return { next: { ...state, audioStarted: true }, ...NOTHING };
                case 'response-created':
                    // First create after entering `sent` is ours: nothing else
                    // can be asking for a response while one is unverified (the
                    // fallback timer stands down, and the transcript path is
                    // short-circuited). Ignore any later one rather than
                    // re-pointing at a response we did not send.
                    return state.responseId === null
                        ? {
                              next: { ...state, responseId: event.responseId },
                              ...NOTHING,
                          }
                        : { next: state, ...NOTHING };
                case 'transcript':
                    return onVerifiedTranscript(state, event.verdict);
                case 'doctor-resumed':
                    // Chrome's server-side `interrupt_response` has very likely
                    // cancelled this already; the client detector's barge-in
                    // may have too. Cancelling again is a no-op that the hook's
                    // "no active response" error filter already swallows, and
                    // it is the ONLY cancel on the path where a speculative
                    // reply exists but has not yet made a sound (the detector's
                    // barge-in needs audible playback to fire).
                    return cancel(state, 'doctor-resumed');
                case 'response-settled':
                    // ONLY the response this speculation created may settle it.
                    // Otherwise: speculative X is sent, the doctor resumes and X
                    // is cancelled, the follow-up turn commits and speculative Y
                    // is sent — and X's late `response.done` would stand Y down,
                    // leaving Y with nothing to cancel it when its transcript
                    // says "withhold". The wrong audio then plays out in full.
                    // A null id means `response.created` never reached us, and
                    // the hook has already matched this against the live
                    // response, so accept it rather than strand the machine.
                    if (state.responseId !== null && event.responseId !== state.responseId) {
                        return { next: state, ...NOTHING };
                    }
                    // The response ran to completion and no transcript ever came
                    // to do the bookkeeping, so release this turn's pending
                    // commit here — otherwise the counter drifts up for the rest
                    // of the consultation.
                    return {
                        next: { kind: 'idle' },
                        actions: [{ type: 'release-pending' }],
                        handled: false,
                    };
                default:
                    // A second commit while one speculation is unverified —
                    // unreachable while the hook keeps the precedes-invariant in
                    // the file header, since the `doctor-resumed` that must come
                    // first would already have left this state. Nothing to arm;
                    // leave the in-flight reply alone.
                    return { next: state, ...NOTHING };
            }
    }
}
