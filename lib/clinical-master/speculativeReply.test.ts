import { describe, expect, it } from 'vitest';
import {
    DEFAULT_SPECULATIVE_REPLY_DELAY_MS,
    INITIAL_SPECULATIVE_STATE,
    parseSpeculativeDelayMs,
    reduceSpeculative,
    respondVerdict,
    type SpeculativeAction,
    type SpeculativeEvent,
    type SpeculativeState,
} from './speculativeReply';

/** Action type names, in order — what the hook would actually do. */
function actionTypes(actions: readonly SpeculativeAction[]): string[] {
    return actions.map((a) => a.type);
}

/** The `log` actions, flattened to `[event, data]` pairs. */
function logs(actions: readonly SpeculativeAction[]): Array<[string, unknown]> {
    return actions
        .filter((a): a is Extract<SpeculativeAction, { type: 'log' }> => a.type === 'log')
        .map((a) => [a.event, a.data]);
}

/** Drive a sequence of events from the initial state, collecting every action. */
function run(events: readonly SpeculativeEvent[]): {
    state: SpeculativeState;
    actions: SpeculativeAction[];
    handled: boolean[];
} {
    let state = INITIAL_SPECULATIVE_STATE;
    const actions: SpeculativeAction[] = [];
    const handled: boolean[] = [];
    for (const event of events) {
        const result = reduceSpeculative(state, event);
        state = result.next;
        actions.push(...result.actions);
        handled.push(result.handled);
    }
    return { state, actions, handled };
}

const committed: SpeculativeEvent = { type: 'turn-committed', enabled: true };
const elapsedClear: SpeculativeEvent = {
    type: 'delay-elapsed',
    ended: false,
    doctorResumed: false,
    responseActive: false,
};

describe('parseSpeculativeDelayMs — NEXT_PUBLIC_VOICE_SPECULATIVE_MS', () => {
    it('defaults to 400ms when unset or blank', () => {
        expect(parseSpeculativeDelayMs(undefined)).toBe(DEFAULT_SPECULATIVE_REPLY_DELAY_MS);
        expect(parseSpeculativeDelayMs('')).toBe(DEFAULT_SPECULATIVE_REPLY_DELAY_MS);
        expect(parseSpeculativeDelayMs('   ')).toBe(DEFAULT_SPECULATIVE_REPLY_DELAY_MS);
        expect(DEFAULT_SPECULATIVE_REPLY_DELAY_MS).toBe(400);
    });

    it('accepts an explicit delay', () => {
        expect(parseSpeculativeDelayMs('250')).toBe(250);
        expect(parseSpeculativeDelayMs('400')).toBe(400);
        expect(parseSpeculativeDelayMs(' 700 ')).toBe(700);
    });

    it('treats 0 as OFF', () => {
        expect(parseSpeculativeDelayMs('0')).toBe(0);
    });

    it('falls back to the default on junk rather than disabling or hanging', () => {
        expect(parseSpeculativeDelayMs('abc')).toBe(DEFAULT_SPECULATIVE_REPLY_DELAY_MS);
        expect(parseSpeculativeDelayMs('-1')).toBe(DEFAULT_SPECULATIVE_REPLY_DELAY_MS);
        expect(parseSpeculativeDelayMs('NaN')).toBe(DEFAULT_SPECULATIVE_REPLY_DELAY_MS);
        expect(parseSpeculativeDelayMs('Infinity')).toBe(DEFAULT_SPECULATIVE_REPLY_DELAY_MS);
    });
});

describe('respondVerdict — the same gate the transcript path has always used', () => {
    const open = { ended: false, doctorResumed: false };

    it('replies to a finished question', () => {
        expect(respondVerdict('What brings you in today?', false, open)).toEqual({ reply: true });
        // No terminal punctuation, still a real prompt (doctorTurn.ts rule).
        expect(respondVerdict('Tell me more', false, open)).toEqual({ reply: true });
    });

    it('withholds after the buzzer, ahead of everything else', () => {
        expect(
            respondVerdict('What brings you in today?', false, { ended: true, doctorResumed: false })
        ).toEqual({ reply: false, reason: 'ended' });
    });

    it('withholds when the doctor has started talking again', () => {
        expect(
            respondVerdict('What brings you in today?', false, { ended: false, doctorResumed: true })
        ).toEqual({ reply: false, reason: 'doctor-resumed' });
    });

    it('withholds a turn the ASR filter already dropped', () => {
        expect(respondVerdict('Bye.', true, open)).toEqual({ reply: false, reason: 'dropped' });
    });

    it('withholds filler and half-finished thoughts', () => {
        expect(respondVerdict('Okay and um', false, open)).toEqual({
            reply: false,
            reason: 'incomplete',
        });
        expect(respondVerdict('', false, open)).toEqual({ reply: false, reason: 'incomplete' });
    });

    it('checks ended before doctor-resumed before content', () => {
        expect(respondVerdict('Okay and um', true, { ended: true, doctorResumed: true })).toEqual({
            reply: false,
            reason: 'ended',
        });
        expect(respondVerdict('Okay and um', true, { ended: false, doctorResumed: true })).toEqual({
            reply: false,
            reason: 'doctor-resumed',
        });
    });
});

describe('speculative reply — flag off (delay 0)', () => {
    it('never arms a timer, so the transcript path is the only path', () => {
        const { state, actions, handled } = run([
            { type: 'turn-committed', enabled: false },
            elapsedClear,
            { type: 'transcript', verdict: { reply: true } },
        ]);
        expect(actionTypes(actions)).toEqual([]);
        expect(state).toEqual({ kind: 'idle' });
        // Nothing was handled here, so resolveRespondDecision runs as it always has.
        expect(handled).toEqual([false, false, false]);
    });
});

describe('speculative reply — transcript arrives first', () => {
    it('clears the timer and defers to the ordinary decision', () => {
        const { state, actions, handled } = run([
            committed,
            { type: 'transcript', verdict: { reply: true } },
        ]);
        expect(actionTypes(actions)).toEqual(['start-timer', 'clear-timer', 'log']);
        expect(logs(actions)).toEqual([['spec:transcript-first', undefined]]);
        expect(state).toEqual({ kind: 'idle' });
        // handled=false — the ordinary path sends response.create exactly as today.
        expect(handled[1]).toBe(false);
    });

    it('defers to the ordinary decision on a withhold too', () => {
        const { actions, handled } = run([
            committed,
            { type: 'transcript', verdict: { reply: false, reason: 'incomplete' } },
        ]);
        expect(actionTypes(actions)).toEqual(['start-timer', 'clear-timer', 'log']);
        expect(handled[1]).toBe(false);
    });
});

describe('speculative reply — timer fires first', () => {
    it('sends the reply and logs spec:sent', () => {
        const { state, actions } = run([committed, elapsedClear]);
        expect(actionTypes(actions)).toEqual(['start-timer', 'log', 'send-create']);
        expect(logs(actions)).toEqual([['spec:sent', undefined]]);
        expect(state).toEqual({ kind: 'sent', audioStarted: false });
    });

    it('is confirmed by a transcript that earns a reply, and sends nothing more', () => {
        const { state, actions, handled } = run([
            committed,
            elapsedClear,
            { type: 'transcript', verdict: { reply: true } },
        ]);
        expect(actionTypes(actions)).toEqual([
            'start-timer',
            'log',
            'send-create',
            'log',
            'clear-pending',
        ]);
        expect(logs(actions)[1]).toEqual(['spec:confirmed', undefined]);
        expect(state).toEqual({ kind: 'idle' });
        // handled=true — the ordinary path must NOT fire a second response.create.
        expect(handled[2]).toBe(true);
    });

    it('cancels when the transcript turns out to be filler', () => {
        const { state, actions, handled } = run([
            committed,
            elapsedClear,
            { type: 'transcript', verdict: { reply: false, reason: 'incomplete' } },
        ]);
        expect(actionTypes(actions)).toEqual([
            'start-timer',
            'log',
            'send-create',
            'log',
            'cancel-response',
            'release-pending',
        ]);
        expect(logs(actions)[1]).toEqual([
            'spec:cancelled',
            { reason: 'incomplete', audioStarted: false },
        ]);
        expect(state).toEqual({ kind: 'idle' });
        expect(handled[2]).toBe(true);
    });

    it('reports audioStarted on the cancel — the clash metric', () => {
        const { actions } = run([
            committed,
            elapsedClear,
            { type: 'audio-started' },
            { type: 'transcript', verdict: { reply: false, reason: 'dropped' } },
        ]);
        expect(logs(actions)[1]).toEqual([
            'spec:cancelled',
            { reason: 'dropped', audioStarted: true },
        ]);
    });

    it('cancels on every withhold reason, including ended', () => {
        for (const reason of ['ended', 'doctor-resumed', 'dropped', 'incomplete'] as const) {
            const { actions, state } = run([
                committed,
                elapsedClear,
                { type: 'transcript', verdict: { reply: false, reason } },
            ]);
            expect(actionTypes(actions)).toContain('cancel-response');
            expect(logs(actions)[1]).toEqual([
                'spec:cancelled',
                { reason, audioStarted: false },
            ]);
            expect(state).toEqual({ kind: 'idle' });
        }
    });
});

describe('speculative reply — the doctor keeps talking', () => {
    it('resumes within the delay: cancel the timer, send nothing', () => {
        const { state, actions, handled } = run([committed, { type: 'doctor-resumed' }]);
        expect(actionTypes(actions)).toEqual(['start-timer', 'clear-timer', 'log']);
        expect(logs(actions)).toEqual([['spec:resumed-within-delay', undefined]]);
        expect(state).toEqual({ kind: 'idle' });
        expect(handled).toEqual([false, false]);
    });

    it('a stale timer after a resume does nothing', () => {
        const { state, actions } = run([committed, { type: 'doctor-resumed' }, elapsedClear]);
        expect(actionTypes(actions)).not.toContain('send-create');
        expect(state).toEqual({ kind: 'idle' });
    });

    it('resumes after the send: cancel the in-flight speculative response', () => {
        const { state, actions } = run([committed, elapsedClear, { type: 'doctor-resumed' }]);
        expect(actionTypes(actions)).toEqual([
            'start-timer',
            'log',
            'send-create',
            'log',
            'cancel-response',
        ]);
        expect(logs(actions)[1]).toEqual([
            'spec:cancelled',
            { reason: 'doctor-resumed', audioStarted: false },
        ]);
        expect(state).toEqual({ kind: 'idle' });
    });

    it('resumes over audible speech: the clash is recorded', () => {
        const { actions } = run([
            committed,
            elapsedClear,
            { type: 'audio-started' },
            { type: 'doctor-resumed' },
        ]);
        expect(logs(actions)[1]).toEqual([
            'spec:cancelled',
            { reason: 'doctor-resumed', audioStarted: true },
        ]);
    });

    it('leaves the still-pending transcript to the ordinary path after a resume-cancel', () => {
        const { handled } = run([
            committed,
            elapsedClear,
            { type: 'doctor-resumed' },
            { type: 'transcript', verdict: { reply: false, reason: 'doctor-resumed' } },
        ]);
        // Back to idle, so resolveRespondDecision does its own bookkeeping.
        expect(handled[3]).toBe(false);
    });
});

describe('speculative reply — guards at the moment the timer fires', () => {
    it('never speculates after the consultation has ended', () => {
        const { state, actions } = run([
            committed,
            { type: 'delay-elapsed', ended: true, doctorResumed: false, responseActive: false },
        ]);
        expect(actionTypes(actions)).toEqual(['start-timer', 'log']);
        expect(logs(actions)).toEqual([['spec:skipped', { reason: 'ended' }]]);
        expect(state).toEqual({ kind: 'idle' });
    });

    it('never speculates while a response is already active', () => {
        const { state, actions } = run([
            committed,
            { type: 'delay-elapsed', ended: false, doctorResumed: false, responseActive: true },
        ]);
        expect(actionTypes(actions)).toEqual(['start-timer', 'log']);
        expect(logs(actions)).toEqual([['spec:skipped', { reason: 'response-active' }]]);
        expect(state).toEqual({ kind: 'idle' });
    });

    it('never speculates over a doctor who is mid-utterance at the deadline', () => {
        const { state, actions } = run([
            committed,
            { type: 'delay-elapsed', ended: false, doctorResumed: true, responseActive: false },
        ]);
        expect(actionTypes(actions)).toEqual(['start-timer', 'log']);
        expect(logs(actions)).toEqual([['spec:resumed-within-delay', undefined]]);
        expect(state).toEqual({ kind: 'idle' });
    });

    it('checks ended before everything else', () => {
        const { actions } = run([
            committed,
            { type: 'delay-elapsed', ended: true, doctorResumed: true, responseActive: true },
        ]);
        expect(logs(actions)).toEqual([['spec:skipped', { reason: 'ended' }]]);
    });
});

describe('speculative reply — housekeeping', () => {
    it('re-arms on a second commit so the delay runs from the doctor’s last words', () => {
        const { state, actions } = run([committed, committed]);
        expect(actionTypes(actions)).toEqual(['start-timer', 'clear-timer', 'start-timer']);
        expect(state).toEqual({ kind: 'armed' });
    });

    it('does not arm a second speculation while one is in flight', () => {
        const { state, actions } = run([committed, elapsedClear, committed]);
        expect(actionTypes(actions)).toEqual(['start-timer', 'log', 'send-create']);
        expect(state).toEqual({ kind: 'sent', audioStarted: false });
    });

    it('releases the pending state when the response finishes without a transcript', () => {
        const { state } = run([committed, elapsedClear, { type: 'response-settled' }]);
        expect(state).toEqual({ kind: 'idle' });
    });

    it('reset clears a pending timer from any state', () => {
        expect(actionTypes(run([committed, { type: 'reset' }]).actions)).toEqual([
            'start-timer',
            'clear-timer',
        ]);
        expect(run([committed, { type: 'reset' }]).state).toEqual({ kind: 'idle' });
        expect(run([committed, elapsedClear, { type: 'reset' }]).state).toEqual({ kind: 'idle' });
    });

    it('ignores events that do not apply to the current state', () => {
        const noop: SpeculativeEvent[] = [
            elapsedClear,
            { type: 'doctor-resumed' },
            { type: 'audio-started' },
            { type: 'response-settled' },
            { type: 'transcript', verdict: { reply: true } },
        ];
        for (const event of noop) {
            const result = reduceSpeculative(INITIAL_SPECULATIVE_STATE, event);
            expect(result.actions).toEqual([]);
            expect(result.next).toEqual({ kind: 'idle' });
            expect(result.handled).toBe(false);
        }
    });

    it('never mutates the state it is handed', () => {
        const state: SpeculativeState = { kind: 'sent', audioStarted: false };
        const frozen = Object.freeze({ ...state });
        const result = reduceSpeculative(frozen, { type: 'audio-started' });
        expect(frozen).toEqual({ kind: 'sent', audioStarted: false });
        expect(result.next).toEqual({ kind: 'sent', audioStarted: true });
        expect(result.next).not.toBe(frozen);
    });
});
