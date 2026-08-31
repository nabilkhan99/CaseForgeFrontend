'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MicError, classifyMicError, type SessionErrorKind } from '@/lib/clinical-master/micErrors';
import { TranscriptItem } from '@/lib/clinical-master/types';
import { unreliableEchoCancellation } from '@/lib/clinical-master/echoCancellation';
import { isIncompleteDoctorTurn } from '@/lib/clinical-master/doctorTurn';
import {
    extensionForMimeType,
    startSessionRecorder,
    type SessionRecorder,
} from '@/lib/clinical-master/sessionRecorder';

/**
 * Double-talk barge-in for browsers with unreliable echo cancellation
 * (Safari/Firefox/iOS — see echoCancellation.ts). Their AEC leaks the
 * patient's voice into the mic, so server-side barge-in is disabled for
 * them (interrupt_response: false) — otherwise the patient cancels
 * itself. To still let the doctor interrupt, we detect *deliberate*
 * speech over the patient locally: leaked echo can only ever be a
 * fraction of the playback level (an adaptively calibrated coupling
 * ratio), so sustained mic energy well above that prediction means a
 * real voice — and we cancel the patient client-side.
 */
const DT_FRAME_MS = 50;
/** Consecutive loud frames (~200ms) before we call it deliberate speech. */
const DT_SUSTAIN_FRAMES = 4;
/**
 * Voice test is on the RESIDUAL: mic energy left after subtracting the
 * predicted echo. Echo-only frames track the prediction (residual ≈ 0 ±
 * envelope jitter); a real voice adds energy on top. The residual must
 * exceed this fraction of the predicted echo (jitter guard) and the
 * absolute floor.
 */
const DT_RESIDUAL_MARGIN = 0.5;
/** Absolute mic RMS floor (~-40dBFS) so silence can never trigger. */
const DT_MIC_FLOOR = 0.01;
/**
 * Below this mean-token probability, a stock one-word transcription is treated
 * as a Whisper-on-silence artefact rather than something the doctor said.
 * Only applied to a small known phrase set — see the transcription handler.
 */
const ASR_ARTIFACT_CONFIDENCE = 0.5;
/** Minimum gap between client-side interrupts. */
const DT_COOLDOWN_MS = 1500;
/** Calibration warm-up after connect — no interrupts while the coupling
 *  ratio is still settling. */
const DT_WARMUP_MS = 1500;
/** EMA rate for the echo-coupling estimate. */
const DT_COUPLING_EMA = 0.05;
/** Sustained voice frames (~250ms) before we open a doctor turn. */
const DT_MIN_SPEECH_FRAMES = 5;
/** Silence frames (~900ms) that close the doctor's turn — mirrors the old
 *  server-VAD silence_duration_ms. */
const DT_END_SILENCE_FRAMES = 18;
/**
 * Guard window after patient audio ends (natural stop OR barge-in). The
 * mic keeps hearing the echo tail for hundreds of ms (Safari output
 * latency + room reverb) — session logs showed every barge-in being
 * followed ~250ms later by a phantom turn that committed a fragment of
 * the patient's own words ("heart going.", "of voiding."). During the
 * window no doctor turn may open, and at its end the input buffer is
 * flushed unconditionally.
 */
const DT_ECHO_TAIL_MS = 700;
/**
 * Frames of peak-hold on the patient tap (~400ms). The tap reads the
 * decoded stream instantaneously, but the mic hears it ~100–250ms later
 * (output latency + acoustics). Predicting echo from the recent PEAK
 * instead of the instant value keeps the prediction high through
 * intra-sentence pauses, so the lagging mic tail can't read as voice.
 */
const DT_PEAK_FRAMES = 8;
/** EMA rate for the smoothed envelopes used in coupling calibration —
 *  instantaneous ratios are meaningless under lag misalignment (observed
 *  k swinging 0.26→3.1 within seconds). */
const DT_ENV_EMA = 0.15;
/** Minimum patient-tap RMS for the echo reference to count as live. Below
 *  this during playback the tap is dead (Safari muted-track quirk) — no
 *  barge-in decisions are made on it, and the tap is re-attached. */
const DT_REF_LIVE_MIN = 0.02;
/** Minimum gap between patient-tap re-attach attempts. */
const DT_REATTACH_MS = 1000;
/**
 * Calibration window at the start of each patient turn. A doctor
 * essentially never interrupts within the first moments of the patient
 * starting to speak, so whatever the mic hears then IS the echo — learn
 * the mic/tap coupling aggressively from it and never barge-in during
 * the window. This breaks the chicken-and-egg failure where an
 * under-estimated coupling classifies echo as voice, which blocks the
 * echo-only calibration path, which keeps the estimate wrong (observed
 * in Safari session logs: mic echo 0.24–0.69 vs tap 0.004–0.11).
 */
const DT_CAL_WINDOW_MS = 600;
/** Fast EMA used inside the calibration window. */
const DT_CAL_EMA = 0.3;
/** Coupling ceiling. Safari's tap under-reports playback level, so the
 *  real mic-echo/tap ratio can far exceed 1. */
const DT_COUPLING_MAX = 8;

/**
 * Commit watchdog. Closing a turn normally needs DT_END_SILENCE_FRAMES
 * CONSECUTIVE silent frames, and room noise resets that counter — measured room
 * noise averaged 0.0134 against a DT_MIC_FLOOR of 0.01, so quiet rooms are
 * intermittently "voiced". A logged session opened a turn at mic 0.0156 and its
 * silence run went 4 → 1 → 3 → 6, reset by spikes every time; it never reached
 * 18, so nothing was ever committed and the patient never spoke again for the
 * rest of the consultation.
 *
 * A flat time cap would be wrong: a doctor explaining a management plan speaks
 * continuously for far longer than a few seconds, and cutting in on them would
 * trade one bug for another. The freeze has a signature a real turn does not —
 * lots of elapsed time, very little voice in it. Within a genuinely spoken turn
 * density is near 1 (a 900ms gap closes the turn anyway); the frozen turn was
 * mostly silence punctuated by blips.
 */
const TURN_WATCHDOG_MS = 5000;
/** Voiced frames / elapsed frames below which an open turn is a stuck one. */
const TURN_VOICED_DENSITY_MIN = 0.35;
/**
 * Hard ceiling, as a pure backstop against a turn that hangs open forever.
 *
 * This was 30s and that was WRONG — it fired three times in a 12-minute review
 * session, every time on `max-length` and never on `silent-turn`, chopping a
 * doctor mid-explanation at 0.77 voiced density. "Longer than any single
 * uninterrupted doctor utterance" was my assumption and it does not survive
 * contact with the management phase, where explaining a diagnosis and a plan
 * runs well past half a minute without a 900ms gap.
 *
 * The freeze this whole watchdog exists for is caught by the density arm, which
 * needs only 5s. So the ceiling can be far out of the way of real speech: two
 * minutes of continuous talking with no pause long enough to close a turn is not
 * a consultation, it is a stuck detector.
 */
const TURN_MAX_MS = 120000;

/**
 * Grace period between the countdown reaching zero and the line actually
 * dropping.
 *
 * Speech is only committed for transcription after ~900ms of silence. Hanging
 * up the instant the clock hit zero therefore threw away whatever the candidate
 * was still saying — measured across 108 timed-out consultations, 69% lost 6s
 * or more and a third lost 15s or more, and because safety netting is the thing
 * candidates say last it was being marked as absent when it had in fact been
 * said. One session lost 31 seconds of continuous speech.
 *
 * The countdown still shows 12:00 and still reaches zero on time; only the
 * teardown moves. Nothing else about these seconds is special — the session
 * behaves exactly as it does at any other point, which is deliberate: a
 * behavioural change here would be a second thing to get wrong.
 */
const SPILL_MS = 5000;

/**
 * How long to wait for a committed turn's transcription before replying anyway.
 * `input_audio_buffer.commit` does NOT create a response (per the Realtime API
 * reference), so the two are sent separately and the reply is gated on what the
 * doctor actually said — see doctorTurn.ts. The transcription is a side-channel
 * that can be slow, fail, or never arrive, so this fails OPEN: a missing
 * transcript behaves exactly as before this change.
 *
 * Measured in the 25 Jul session: transcriptions landed 483–1771ms after the
 * commit, 56/56 times. 1500ms answers most turns on the transcript and the rest
 * on the timer, and the cost of the timer path is only that a filler gets
 * answered — the old behaviour, not a new failure.
 */
const RESPOND_FALLBACK_MS = 1500;

/**
 * Frames of a hard-zero mic reading before the tap is presumed dead and rebuilt.
 *
 * A live microphone in a silent room does not read 0 — measured floors sit around
 * 0.005. Exactly 0.0000 means the analyser is no longer being fed. Observed in a
 * 12-minute review session: Safari's AudioContext went `interrupted` at 623s,
 * returned to `running` at 627s, and the mic read a flat 0 for the remaining 97
 * seconds. No mic means no turns open, nothing commits, and the patient never
 * speaks again — the reviewer reported it as "it stopped responding", and
 * correctly guessed it had "stopped processing my speech".
 *
 * 2s of dead air is long enough not to trip on a buffer hiccup and short enough
 * that a recovery is barely noticeable.
 */
const MIC_DEAD_FRAMES = 40;
/** Minimum gap between mic-tap rebuild attempts. */
const MIC_REARM_MS = 1000;

/** How often the transcript is checkpointed mid-consultation. */
const TRANSCRIPT_SAVE_MS = 20000;

/** Below this a "recording" is a broken stub, not audio worth storing. */
const MIN_RECORDING_BYTES = 2048;

/** Byte time-domain RMS (0..~1). getByteTimeDomainData works on every
 *  Safari version, unlike the float variant. */
function analyserRms(analyser: AnalyserNode, buf: Uint8Array): number {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
}

/** Mean token probability from transcription logprobs, as a 0..1 confidence. */
function meanProbFromLogprobs(logprobs: unknown): number | undefined {
    if (!Array.isArray(logprobs) || logprobs.length === 0) return undefined;
    const probs = logprobs.map((t) => {
        const lp = (t as { logprob?: number })?.logprob;
        return typeof lp === 'number' ? Math.exp(lp) : 1;
    });
    const mean = probs.reduce((a, b) => a + b, 0) / probs.length;
    return Math.max(0, Math.min(1, mean));
}

function asMs(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
}

/**
 * Compact one-line view of a `rate_limits.updated` payload.
 *
 * Azure re-sends the full budget for every limiter after each turn, so the raw
 * event is both large and mostly unchanged — storing it whole would flood the
 * 4000-entry ring. Only the headroom matters, so each entry collapses to
 * "name remaining/limit".
 *
 * This is the per-consultation token-headroom telemetry: a session that ran
 * near the ceiling shows up here as shrinking remaining counts, rather than
 * later as an unexplained mid-consultation failure.
 */
function summariseRateLimits(raw: unknown): string {
    if (!Array.isArray(raw)) return '';
    return raw
        .map((entry) => {
            const e = (entry ?? {}) as { name?: unknown; remaining?: unknown; limit?: unknown };
            return `${String(e.name ?? '?')} ${String(e.remaining ?? '?')}/${String(e.limit ?? '?')}`;
        })
        .join(' · ');
}

/**
 * A synchronization source older than this has no bearing on what the mic is
 * hearing now. getSynchronizationSources() reports the most recent packet per
 * SSRC and keeps entries for ~10s, so without this check a level from before a
 * silence gap would be read as current — over-predicting echo and swallowing
 * the doctor's next words.
 */
const REF_SOURCE_MAX_AGE_MS = 150;

/**
 * Patient playback level from the RTP receiver, 0..1, or undefined if this
 * browser/sender does not provide it.
 *
 * This replaces a WebAudio tap on the remote track as the echo reference. That
 * tap was created as `ctx.createMediaStreamSource(new MediaStream([track]))
 * .connect(analyser)` — both the stream and the source node were anonymous
 * temporaries, only the AnalyserNode was held in a ref, and the graph never
 * reached a destination, so the whole thing was garbage-collectable. Logs show
 * what that cost: ~20 `ref-dead:re-attach` per two minutes and a coupling
 * estimate drifting to 2.53, a ratio that is not physically possible (DT_COUPLING_MAX
 * exists only to absorb it). Every barge-in and turn-open decision downstream
 * was running on that.
 *
 * audioLevel comes from the RFC 6464 header extension, is linear (1.0 = 0 dBov)
 * and so is on the same footing as the analyser's RMS — and the coupling is
 * calibrated adaptively anyway, so a constant scale difference is absorbed.
 * There is nothing here to collect, nothing to re-attach, and no AudioContext.
 */
function receiverAudioLevel(receiver: RTCRtpReceiver | null): number | undefined {
    if (!receiver || typeof receiver.getSynchronizationSources !== 'function') return undefined;
    let sources: RTCRtpSynchronizationSource[];
    try {
        sources = receiver.getSynchronizationSources();
    } catch {
        return undefined;
    }
    const source = sources[0];
    if (!source || typeof source.audioLevel !== 'number') return undefined;
    // Stale entries mean RTP has stopped; treat that as silence, not as the
    // last level seen.
    if (performance.now() - source.timestamp > REF_SOURCE_MAX_AGE_MS) return 0;
    return source.audioLevel;
}

interface UseRealtimeSessionProps {
    sessionId: string;
    stationId?: string;
    userId?: string;
    /** Token endpoint that mints the Azure ephemeral key (default: '/api/realtime-token'). */
    tokenEndpoint?: string;
    /** Endpoint that persists the transcript on end (default: '/api/clinical-master/save-transcript'). */
    saveEndpoint?: string;
    onSessionStarted?: () => void;
    onConsultationEnded?: () => void;
    onError?: (error: string) => void;
}

type SessionStatus = 'disconnected' | 'connecting' | 'connected';

interface TokenResponse {
    ephemeralKey: string;
    callsUrl: string;
    model: string;
    voice: string;
    durationSeconds: number;
    /** Which Azure region minted the key — 'primary' or 'fallback'. Absent on
     *  responses from a deployment predating regional failover. */
    origin?: string;
}

/**
 * Connects the browser directly to Azure `gpt-realtime` over WebRTC for a
 * speech-to-speech patient consultation. Drop-in replacement for the former
 * useLiveKitSession — same return shape so the session pages and UI components
 * are unchanged.
 *
 * Flow: fetch ephemeral key → RTCPeerConnection (mic up, patient audio down) →
 * data channel for transcripts / speaking state / function tools. The patient
 * greets first (greeting only), then waits. On end (button, timer, or the
 * model's end_consultation tool) the transcript is saved and the session moves
 * to 'processing' so the existing feedback pipeline runs.
 */
export function useRealtimeSession({
    sessionId,
    stationId,
    tokenEndpoint = '/api/realtime-token',
    saveEndpoint = '/api/clinical-master/save-transcript',
    onSessionStarted,
    onConsultationEnded,
    onError,
}: UseRealtimeSessionProps) {
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [errorKind, setErrorKind] = useState<SessionErrorKind | null>(null);
    // Keep the screen on for the length of the consultation: the trainee is
    // talking, not touching, and a phone locking mid-station suspends the
    // tab and kills the call. Best-effort — unsupported browsers just skip it.
    const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
    const acquireWakeLock = useCallback(async () => {
        try {
            const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
            if (!nav.wakeLock || wakeLockRef.current) return;
            wakeLockRef.current = await nav.wakeLock.request('screen');
        } catch {
            /* denied or unsupported — not fatal */
        }
    }, []);
    const [status, setStatus] = useState<SessionStatus>('disconnected');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const dcRef = useRef<RTCDataChannel | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const micTrackRef = useRef<MediaStreamTrack | null>(null);
    const audioElRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const endDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const greetingWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const patientAudioStartedRef = useRef(false);
    const endedRef = useRef(false);
    const transcriptRef = useRef<TranscriptItem[]>([]);
    const messageCountRef = useRef(0);
    const sessionStartRef = useRef<number>(0);
    const vadRef = useRef<Record<string, { start_ms?: number; end_ms?: number }>>({});
    // --- double-talk barge-in state (unreliable-AEC browsers only) ---
    const audioCtxRef = useRef<AudioContext | null>(null);
    const micAnalyserRef = useRef<AnalyserNode | null>(null);
    /** Held so the mic tap's source node cannot be garbage-collected — the same
     *  hazard that killed the patient tap, and it was here too. */
    const micTapSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    /** Consecutive hard-zero mic frames, and the last rebuild attempt. */
    const micDeadFramesRef = useRef(0);
    const lastMicRearmAtRef = useRef(0);
    const patientAnalyserRef = useRef<AnalyserNode | null>(null);
    /** Held ONLY so the tap's graph is not garbage-collected — see
     *  receiverAudioLevel for what happened when they were temporaries. */
    const patientTapStreamRef = useRef<MediaStream | null>(null);
    const patientTapSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const analyserBufRef = useRef<Uint8Array | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    /** Receiver for the patient's audio — the primary echo reference. */
    const audioReceiverRef = useRef<RTCRtpReceiver | null>(null);
    /** Whether the receiver actually reports audioLevel on this browser; falls
     *  back to the WebAudio tap when it does not. Logged once. */
    const receiverRefUsableRef = useRef<boolean | null>(null);
    /** Latched once a real reading has ever been seen — see getPatientLevel. */
    const patientLevelSeenRef = useRef(false);
    const detectorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    /**
     * Output-side probe for the browsers the double-talk detector skips.
     *
     * The detector early-returns on reliable-AEC (Chrome-family) browsers and it
     * owns the AudioContext, so `snap`/`pat` levels — our only evidence that the
     * patient was audible — exist for Firefox and Safari and not for Chrome.
     * That is backwards: on 30 Aug 2026 a tester lost ten Chrome/Edge sessions to
     * silence and the flight recorder held 28 events with no audio data in any of
     * them, while her Firefox sessions were richly instrumented. This probe fills
     * that hole using the receiver's own RFC 6464 level, which needs no
     * AudioContext and happens to be Chromium-only — exactly where we were blind.
     */
    const levelProbeRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const detectorStartedAtRef = useRef(0);
    /** Echo-coupling estimate: micRms ≈ coupling × patientRms. Starts high
     *  (conservative — over-predicts echo) and calibrates down via EMA. */
    const couplingRef = useRef(0.2);
    const doubleTalkFramesRef = useRef(0);
    const lastInterruptAtRef = useRef(0);
    const lastReattachAtRef = useRef(0);
    /** Ring buffer of recent patient-tap RMS values for peak-hold. */
    const patRecentRef = useRef<number[]>([]);
    /** Smoothed envelopes for coupling calibration. */
    const micEnvRef = useRef(0);
    const patEnvRef = useRef(0);
    /** When patient audio last ended (stop, clear, or barge-in). */
    const lastPatientEndAtRef = useRef(0);
    const speakingRef = useRef(false);
    const speakingSinceRef = useRef(0);
    const activeResponseIdRef = useRef<string | null>(null);
    const lastAssistantItemRef = useRef<string | null>(null);
    /** A doctor turn is currently being captured (client-driven turn mode). */
    /** Doctor speech per the SERVER's VAD (reliable-AEC path). turnOpenRef is the
     *  client detector's equivalent; exactly one of the two is ever in use. */
    const doctorSpeakingRef = useRef(false);
    const turnOpenRef = useRef(false);
    const silenceFramesRef = useRef(0);
    /** When the open turn opened, and how many of its frames held voice — the
     *  commit watchdog's only inputs. */
    const turnOpenedAtRef = useRef(0);
    const turnVoicedFramesRef = useRef(0);
    const bufferClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /**
     * Committed doctor turns still waiting on a transcript before we decide
     * whether they earn a patient response. A COUNT, not a flag: commits are
     * only ~1.15s apart (250ms speech + 900ms silence) while transcripts land
     * 483–1771ms later, so "okay" and the real question that follows it can
     * both be in flight at once. Transcripts arrive in item order, so each one
     * resolves one pending commit.
     */
    const pendingCommitsRef = useRef(0);
    const respondFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // --- voice flight recorder ---
    // The event ring ALWAYS records; ?voicedebug=1 only adds the on-page
    // overlay. The ring uploads to /api/clinical-master/voice-log on a 60s
    // cadence, on errors/disconnects, and via sendBeacon on pagehide — so a
    // session that dies mid-call leaves evidence (a tester's session died
    // at ~8 min and left none).
    // --- consultation audio recording ---
    // Mixes mic + patient into one file for playback with the feedback. Owns a
    // separate AudioContext from the detector (see sessionRecorder.ts) and is
    // flushed exactly once per session.
    const recorderRef = useRef<SessionRecorder | null>(null);
    const recordingFlushedRef = useRef(false);
    const debugEnabledRef = useRef(false);
    const debugLogRef = useRef<Array<{ t: number; e: string; d?: unknown }>>([]);
    const debugElRef = useRef<HTMLDivElement | null>(null);
    const debugTickCountRef = useRef(0);
    const lastSentIndexRef = useRef(0);
    /** Turn count at the last transcript checkpoint, so interim saves are skipped
     *  when nothing new has been said. */
    const lastSavedTurnCountRef = useRef(0);
    const transcriptSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const voiceLogTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pagehideHandlerRef = useRef<(() => void) | null>(null);

    const relNow = useCallback((): number | undefined => {
        return sessionStartRef.current ? Date.now() - sessionStartRef.current : undefined;
    }, []);

    // Append one turn in the spec transcript shape (speaker/start_ms/end_ms/text/
    // asr_confidence) while keeping legacy role/content/timestamp so the live
    // transcript UI is unchanged.
    const appendTurn = useCallback(
        (turn: {
            speaker: 'candidate' | 'patient';
            text: string;
            start_ms?: number;
            end_ms?: number;
            asr_confidence?: number;
        }) => {
            const text = (turn.text || '').trim();
            if (!text) return;
            const item: TranscriptItem = {
                id: `rt-${Date.now()}-${messageCountRef.current++}`,
                speaker: turn.speaker,
                start_ms: turn.start_ms,
                end_ms: turn.end_ms,
                text,
                asr_confidence: turn.asr_confidence,
                role: turn.speaker === 'candidate' ? 'user' : 'assistant',
                content: text,
                timestamp: new Date().toISOString(),
            };
            transcriptRef.current = [...transcriptRef.current, item];
            setTranscript(transcriptRef.current);
        },
        []
    );

    /** Append to the in-memory voice event ring (always on). */
    const logDebug = useCallback((e: string, d?: unknown) => {
        const log = debugLogRef.current;
        log.push({ t: sessionStartRef.current ? Date.now() - sessionStartRef.current : 0, e, d });
        if (log.length > 4000) {
            log.splice(0, 1000);
            lastSentIndexRef.current = Math.max(0, lastSentIndexRef.current - 1000);
        }
    }, []);

    /**
     * One-shot snapshot of where the patient's voice is actually being sent.
     *
     * The transcript rides the data channel and the voice rides the media
     * track, so every signal we used to record could look perfect while the
     * user heard nothing — the failure sits in the last hop, into an output
     * device we never named. Device labels are readable here because the mic
     * prompt has already granted the permission they depend on, and "playing to
     * Headset while you are sitting in front of the speakers" is the entire
     * diagnosis in one string.
     */
    const logAudioOutput = useCallback(
        async (el: HTMLAudioElement) => {
            logDebug('audio:element', {
                paused: el.paused,
                muted: el.muted,
                volume: el.volume,
                readyState: el.readyState,
                sinkId: (el as HTMLAudioElement & { sinkId?: string }).sinkId || 'default',
            });
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const outputs = devices.filter((d) => d.kind === 'audiooutput');
                logDebug('audio:outputs', {
                    count: outputs.length,
                    devices: outputs.map((d) => ({
                        id: d.deviceId,
                        label: d.label || '(unlabelled)',
                    })),
                });
            } catch {
                /* enumerateDevices can reject in hardened contexts — diagnostics
                   must never break the consultation they are observing. */
            }
        },
        [logDebug]
    );

    /**
     * Log the patient's playback level once a second on the browsers the
     * double-talk detector skips. See levelProbeRef for why this exists.
     * `currentTime` advancing is the cheap proof that the element is not merely
     * un-paused but actually rendering.
     */
    const startLevelProbe = useCallback(() => {
        if (levelProbeRef.current) return;
        if (unreliableEchoCancellation(navigator.userAgent)) return;
        levelProbeRef.current = setInterval(() => {
            const level = receiverAudioLevel(audioReceiverRef.current);
            const el = audioElRef.current;
            logDebug('rx:level', {
                lvl: level === undefined ? null : Number(level.toFixed(4)),
                paused: el ? el.paused : null,
                t: el ? Number(el.currentTime.toFixed(1)) : null,
            });
        }, 1000);
    }, [logDebug]);

    /** Upload the unsent slice of the event ring. sendBeacon on pagehide
     *  (survives tab close); fetch keepalive everywhere else. Fire-and-forget:
     *  the recorder must never affect the session it observes. */
    /**
     * Checkpoint the transcript mid-consultation.
     *
     * It used to be written exactly once, at the very end. Three sessions on
     * 26 Jul were abandoned before that moment and lost everything — the patient
     * had spoken 6, 8 and 14 times, all three left stuck at status 'live' with an
     * empty transcript and no recording. About 5% of sessions. Nothing about the
     * consultation survived, so there was nothing to mark and nothing to review.
     *
     * Same lesson as the recording upload: do not stake a whole consultation on
     * one request at the end. `final: false` writes the transcript without
     * advancing the status, so marking is not triggered early.
     */
    const persistTranscript = useCallback(
        (final: boolean, useBeacon = false) => {
            const transcript = transcriptRef.current;
            if (!final && transcript.length === 0) return;
            if (!final && transcript.length === lastSavedTurnCountRef.current) return;
            lastSavedTurnCountRef.current = transcript.length;
            const payload = JSON.stringify({ sessionId, transcript, final });
            if (useBeacon && typeof navigator.sendBeacon === 'function') {
                navigator.sendBeacon(
                    saveEndpoint,
                    new Blob([payload], { type: 'application/json' })
                );
                return;
            }
            void fetch(saveEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true,
            }).catch(() => {
                /* interim saves are best-effort; the final one retries */
            });
        },
        [sessionId, saveEndpoint]
    );

    const flushVoiceLog = useCallback(
        (reason: string, useBeacon = false) => {
            const events = debugLogRef.current.slice(lastSentIndexRef.current);
            if (events.length === 0) return;
            lastSentIndexRef.current = debugLogRef.current.length;
            const payload = JSON.stringify({
                sessionId,
                reason,
                build: (process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'unknown').slice(0, 7),
                ua: navigator.userAgent,
                events,
                transcriptTurns: transcriptRef.current.length,
                transcriptTail: transcriptRef.current
                    .slice(-6)
                    .map((turn) => ({ role: turn.role, text: (turn.content ?? '').slice(0, 200) })),
            });
            if (useBeacon && typeof navigator.sendBeacon === 'function') {
                navigator.sendBeacon(
                    '/api/clinical-master/voice-log',
                    new Blob([payload], { type: 'application/json' })
                );
                return;
            }
            void fetch('/api/clinical-master/voice-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true,
            }).catch(() => {
                /* recorder is best-effort */
            });
        },
        [sessionId]
    );

    /**
     * Stop recording and upload the audio. Runs at most once per session.
     *
     * Fire-and-forget by design: stop() is requested synchronously so it
     * happens before teardown kills the mic, then the upload continues in the
     * background. A client-side route change to the feedback page does not
     * abort it (the JS context survives a soft navigation) — only closing the
     * tab does, and losing the audio there is preferable to making the user
     * wait on an upload before seeing their marks.
     */
    const flushRecording = useCallback(
        async (reason: string) => {
            const recorder = recorderRef.current;
            if (!recorder || recordingFlushedRef.current) return;
            recordingFlushedRef.current = true;
            try {
                const blob = await recorder.stop();
                if (!blob || blob.size < MIN_RECORDING_BYTES) {
                    logDebug('recording:empty', { reason, bytes: blob?.size ?? 0 });
                    return;
                }
                const extension = extensionForMimeType(recorder.mimeType);

                // Straight to Supabase Storage. Routing the blob through the
                // serverless function capped it at Vercel's ~4.5MB body limit,
                // so full-length consultations 413'd and were lost: an 11-minute
                // session produced 10.3MB and never reached storage, while every
                // short test upload succeeded and hid the bug.
                let uploaded = false;
                try {
                    const signRes = await fetch('/api/clinical-master/recording-upload-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId, extension }),
                    });
                    const signed = signRes.ok ? await signRes.json() : null;

                    if (signed?.status === 'signed' && signed.signedUrl) {
                        const putRes = await fetch(signed.signedUrl, {
                            method: 'PUT',
                            headers: { 'Content-Type': recorder.mimeType },
                            body: blob,
                        });
                        if (putRes.ok) {
                            const doneRes = await fetch(
                                '/api/clinical-master/recording-upload-url',
                                {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ sessionId, path: signed.path }),
                                }
                            );
                            uploaded = doneRes.ok;
                            logDebug('recording:upload', {
                                reason,
                                bytes: blob.size,
                                via: 'signed-url',
                                ok: uploaded,
                                status: doneRes.status,
                            });
                        } else {
                            logDebug('recording:signed-put-failed', { status: putRes.status });
                        }
                    } else if (signed?.status === 'exists') {
                        uploaded = true;
                        logDebug('recording:upload', { reason, via: 'signed-url', ok: true, status: 200 });
                    }
                } catch (err) {
                    logDebug('recording:signed-url-error', String(err));
                }

                // Fallback: the original multipart route. Works for anything
                // under the body limit, so a short consultation still lands even
                // if signing or the direct PUT fails.
                if (!uploaded) {
                    const form = new FormData();
                    form.append('sessionId', sessionId);
                    form.append('file', blob, `${sessionId}.${extension}`);
                    const res = await fetch('/api/clinical-master/save-recording', {
                        method: 'POST',
                        body: form,
                    });
                    logDebug('recording:upload', {
                        reason,
                        bytes: blob.size,
                        via: 'multipart-fallback',
                        ok: res.ok,
                        status: res.status,
                    });
                }
            } catch (err) {
                logDebug('recording:FAILED', String(err));
            } finally {
                recorder.dispose();
                recorderRef.current = null;
            }
        },
        [sessionId, logDebug]
    );

    /** Floating overlay with live detector numbers + a copy-log button. */
    const ensureDebugOverlay = useCallback(() => {
        if (!debugEnabledRef.current || debugElRef.current) return;
        const wrap = document.createElement('div');
        wrap.style.cssText =
            'position:fixed;bottom:8px;left:8px;z-index:99999;background:rgba(0,0,0,0.85);' +
            'color:#7CFC00;font:10px/1.5 monospace;padding:8px 10px;border-radius:8px;max-width:320px;pointer-events:auto;';
        const info = document.createElement('div');
        info.textContent = 'voice debug: waiting for session…';
        const buildLine = document.createElement('div');
        buildLine.style.cssText = 'opacity:0.7;margin-top:2px;';
        buildLine.textContent = `build ${(process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'unknown').slice(0, 7)}`;
        const btn = document.createElement('button');
        btn.textContent = 'Copy voice log';
        btn.style.cssText =
            'margin-top:6px;background:#7CFC00;color:#000;border:0;border-radius:4px;' +
            'padding:3px 8px;font:10px monospace;cursor:pointer;';
        btn.onclick = () => {
            const payload = JSON.stringify({ ua: navigator.userAgent, log: debugLogRef.current });
            void navigator.clipboard
                .writeText(payload)
                .then(() => {
                    btn.textContent = `Copied (${debugLogRef.current.length} entries)`;
                })
                .catch(() => {
                    // Clipboard blocked — show the JSON for manual copy.
                    window.prompt('Copy the voice log:', payload);
                });
        };
        wrap.appendChild(info);
        wrap.appendChild(buildLine);
        wrap.appendChild(btn);
        document.body.appendChild(wrap);
        debugElRef.current = wrap;
    }, []);

    const updateDebugOverlay = useCallback((text: string) => {
        const el = debugElRef.current?.firstElementChild;
        if (el) el.textContent = text;
    }, []);

    const sendEvent = useCallback(
        (event: Record<string, unknown>) => {
            const dc = dcRef.current;
            if (dc && dc.readyState === 'open') {
                dc.send(JSON.stringify(event));
                logDebug(`tx:${String(event.type)}`);
            } else {
                logDebug(`tx-dropped:${String(event.type)}`);
            }
        },
        [logDebug]
    );

    /**
     * Client-side barge-in: cancel the in-flight response (if any), sync the
     * model's context to the audio actually heard, and flush the buffered
     * WebRTC audio so the patient goes quiet immediately. Only the
     * double-talk detector calls this — on unreliable-AEC browsers server
     * barge-in is off (interrupt_response: false), so a deliberate
     * interruption has to be actioned from here.
     */
    const interruptPatient = useCallback(() => {
        lastPatientEndAtRef.current = Date.now();
        if (activeResponseIdRef.current) {
            sendEvent({ type: 'response.cancel' });
            activeResponseIdRef.current = null;
        }
        if (speakingRef.current && lastAssistantItemRef.current) {
            sendEvent({
                type: 'conversation.item.truncate',
                item_id: lastAssistantItemRef.current,
                content_index: 0,
                audio_end_ms: Math.max(0, Date.now() - speakingSinceRef.current),
            });
        }
        sendEvent({ type: 'output_audio_buffer.clear' });
        speakingRef.current = false;
        setIsSpeaking(false);
    }, [sendEvent]);

    /**
     * Build (or rebuild) the mic tap. Idempotent and safe to call at any time.
     *
     * Rebuilding is the recovery path for a dead microphone: Safari's
     * AudioContext can go `interrupted` (OS audio interruption, device switch,
     * a call arriving) and, even once it returns to `running`, the graph feeding
     * this analyser stays dead — the mic then reads a flat 0.0000 and every
     * turn-taking decision downstream silently stops happening.
     *
     * The source node is kept in a ref. It was previously an anonymous
     * temporary, exactly like the patient tap that provably got collected, so it
     * could have been dying on its own too.
     */
    const attachMicAnalyser = useCallback((): boolean => {
        const ctx = audioCtxRef.current;
        const stream = micStreamRef.current;
        if (!ctx || !stream) return false;
        const track = stream.getAudioTracks()[0];
        try {
            if (micTapSourceRef.current) {
                try {
                    micTapSourceRef.current.disconnect();
                } catch {
                    /* already disconnected */
                }
            }
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
            micTapSourceRef.current = source;
            micAnalyserRef.current = analyser;
            analyserBufRef.current = new Uint8Array(analyser.fftSize);
            micDeadFramesRef.current = 0;
            logDebug('mic-analyser:attached', {
                trackState: track?.readyState ?? 'none',
                trackMuted: track?.muted ?? null,
                trackEnabled: track?.enabled ?? null,
                ctxState: ctx.state,
            });
            return true;
        } catch (err) {
            logDebug('mic-analyser:FAILED', String(err));
            return false;
        }
    }, [logDebug]);

    /** Tap the patient's remote stream for level analysis. Analysis only —
     *  never connected to the destination, so playback is untouched. */
    const attachPatientAnalyser = useCallback(() => {
        const ctx = audioCtxRef.current;
        const stream = remoteStreamRef.current;
        if (!ctx || !stream) return;
        const track = stream.getAudioTracks()[0];
        if (!track || track.readyState !== 'live') return;
        // Safari: a MediaStreamSource created from a still-muted remote track
        // reads silence FOREVER (confirmed in session logs — trackMuted:true
        // at ontrack, pat 0 for the whole session). Only attach once RTP is
        // actually flowing; ontrack registers an 'unmute' listener that calls
        // back here, and detectorTick re-attaches if readings ever die.
        if (track.muted) {
            logDebug('patient-analyser:deferred (track muted)');
            return;
        }
        try {
            if (patientAnalyserRef.current) {
                try {
                    patientAnalyserRef.current.disconnect();
                } catch {
                    /* already disconnected */
                }
            }
            if (patientTapSourceRef.current) {
                try {
                    patientTapSourceRef.current.disconnect();
                } catch {
                    /* already disconnected */
                }
            }
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            // A fresh MediaStream wrapping the live track — more reliable on
            // WebKit than the ontrack-provided stream object. Both the stream
            // and the source node are held in refs: as anonymous temporaries in
            // a graph with no destination they were collectable, which is what
            // killed this tap ~20 times per two minutes.
            const tapStream = new MediaStream([track]);
            const source = ctx.createMediaStreamSource(tapStream);
            source.connect(analyser);
            patientTapStreamRef.current = tapStream;
            patientTapSourceRef.current = source;
            patientAnalyserRef.current = analyser;
            logDebug('patient-analyser:attached', {
                muted: track.muted,
                state: track.readyState,
                ctxState: ctx.state,
                ctxRate: ctx.sampleRate,
            });
        } catch (err) {
            logDebug('patient-analyser:FAILED', String(err));
        }
    }, [logDebug]);

    const clearRespondTimers = useCallback(() => {
        if (respondFallbackTimerRef.current) {
            clearTimeout(respondFallbackTimerRef.current);
            respondFallbackTimerRef.current = null;
        }
    }, []);

    /**
     * A doctor turn has just been committed. Hold the response request until we
     * know what was in it, with a fail-open timer so a missing transcript can
     * never leave the patient mute.
     */
    /** Set below, so the fallback timer can re-arm itself without a cycle. */
    const armRespondDecisionRef = useRef<(() => void) | null>(null);

    const armRespondDecision = useCallback(() => {
        clearRespondTimers();
        pendingCommitsRef.current += 1;
        // Fail open on the most recent commit: whatever else is in flight, the
        // patient replies within RESPOND_FALLBACK_MS of the doctor's last words
        // if no transcript ever explains them.
        respondFallbackTimerRef.current = setTimeout(() => {
            respondFallbackTimerRef.current = null;
            if (pendingCommitsRef.current === 0 || endedRef.current) return;
            // Fail open, but never over the doctor. If they are mid-utterance
            // when this fires (a slow transcript on a long explanation), stay
            // out of the way — they are still talking, so another commit is
            // coming and it will re-arm this.
            if (turnOpenRef.current || doctorSpeakingRef.current) {
                // Still mid-utterance. Do not give up — re-arm, or a doctor who
                // keeps talking through every deadline is never answered at all.
                logDebug('respond:fallback-deferred');
                armRespondDecisionRef.current?.();
                return;
            }
            pendingCommitsRef.current = 0;
            logDebug('respond:no-transcript');
            sendEvent({ type: 'response.create' });
        }, RESPOND_FALLBACK_MS);
    }, [clearRespondTimers, logDebug, sendEvent]);
    armRespondDecisionRef.current = armRespondDecision;

    /**
     * A committed turn's transcript arrived — reply to a finished thought, stay
     * quiet through a half-finished one. `dropped` covers the turns the ASR
     * filter already refused to put in the transcript: if it was not real
     * enough to grade, it is not real enough to answer.
     *
     * With several commits in flight, one complete thought anywhere in them
     * earns the reply, and the patient answers the lot together. The stall
     * guard is only armed once nothing is left pending, so a filler followed
     * quickly by a real question never waits on it.
     */
    const resolveRespondDecision = useCallback(
        (said: string, dropped: boolean) => {
            if (pendingCommitsRef.current === 0) return;
            pendingCommitsRef.current -= 1;

            // THE DOCTOR HAS STARTED TALKING AGAIN. Whatever was in that turn,
            // they are plainly not finished, so answering now talks over them.
            // This is a fact the code already holds and was ignoring: in one
            // review session the reply went out 353ms after a new turn opened,
            // and three more times a mid-sentence fragment ("It could well
            // take", "So for the next couple of weeks, what we'd do for you")
            // was answered while the doctor kept speaking. Reported as "when I
            // would start a question it would interrupt and then pause".
            //
            // Nothing is lost: the item stays in the conversation and the
            // model sees it when their next turn commits.
            if (turnOpenRef.current || doctorSpeakingRef.current) {
                logDebug('respond:withheld', { said, reason: 'doctor-resumed' });
                clearRespondTimers();
                return;
            }

            if (!dropped && !isIncompleteDoctorTurn(said)) {
                pendingCommitsRef.current = 0;
                clearRespondTimers();
                // If a response is already in flight the server produced one on
                // its own — i.e. create_response:false was not honoured. Adding
                // ours would give the patient two voices at once, which is the
                // exact bug we spent today tracing. Skip and log loudly.
                if (activeResponseIdRef.current) {
                    logDebug('respond:already-active', { said });
                    return;
                }
                sendEvent({ type: 'response.create' });
                return;
            }
            logDebug('respond:withheld', { said, dropped });
            if (pendingCommitsRef.current > 0) return;
            // No stall guard. Its one and only firing produced "Mm. I'm still
            // here. Take your time…" — a character break — plus a 29-second
            // hole, and the doctor's next real turn would have been answered
            // normally anyway. Silence is in character; a forced utterance is
            // not. Every path out of here now waits for the doctor.
            clearRespondTimers();
        },
        [clearRespondTimers, logDebug, sendEvent]
    );

    /**
     * Client-driven turn-taking (unreliable-AEC browsers). Every 50ms:
     * decide whether the mic holds a real voice (energy well above the
     * calibrated echo prediction), and from that drive the whole turn
     * lifecycle — barge-in while the patient speaks, opening a doctor turn
     * in silence, and committing the turn + requesting the response after
     * ~900ms of quiet. The server never decides anything, so the patient's
     * echo can never become a phantom doctor turn.
     */
    const detectorTick = useCallback(() => {
        const micAnalyser = micAnalyserRef.current;
        const buf = analyserBufRef.current;
        if (!micAnalyser || !buf) return;
        // Echo reference: the receiver's own audio level where the browser
        // reports it, the WebAudio tap where it does not. The receiver has
        // nothing to garbage-collect, so it cannot go dead mid-session.
        const receiverLevel = receiverAudioLevel(audioReceiverRef.current);
        const usingReceiver = receiverLevel !== undefined;
        if (receiverRefUsableRef.current === null && speakingRef.current) {
            receiverRefUsableRef.current = usingReceiver;
            logDebug('echo-ref', { source: usingReceiver ? 'receiver' : 'webaudio-tap' });
        }
        const patientAnalyser = patientAnalyserRef.current;
        const patientRms = usingReceiver
            ? receiverLevel
            : patientAnalyser
              ? analyserRms(patientAnalyser, buf)
              : 0;
        const micRms = analyserRms(micAnalyser, buf);
        const now = Date.now();

        // Dead-mic watchdog. A live mic never reads exactly 0 (real floors are
        // ~0.005), so a sustained hard zero means the graph is no longer fed and
        // every decision below has silently stopped working. Rebuild the tap.
        if (micRms === 0) {
            micDeadFramesRef.current += 1;
            if (
                micDeadFramesRef.current >= MIC_DEAD_FRAMES &&
                now - lastMicRearmAtRef.current > MIC_REARM_MS
            ) {
                lastMicRearmAtRef.current = now;
                const track = micStreamRef.current?.getAudioTracks()[0];
                logDebug('mic-dead:rebuild', {
                    frames: micDeadFramesRef.current,
                    trackState: track?.readyState ?? 'none',
                    trackMuted: track?.muted ?? null,
                    ctxState: audioCtxRef.current?.state ?? 'none',
                });
                if (audioCtxRef.current?.state !== 'running') {
                    void audioCtxRef.current?.resume().catch(() => {
                        /* may need a gesture; the log says so */
                    });
                }
                attachMicAnalyser();
                return; // next tick reads the new analyser
            }
        } else {
            micDeadFramesRef.current = 0;
        }

        // Peak-hold on the tap: the mic hears playback ~100–250ms late, so
        // all echo reasoning uses the recent PEAK, which stays high through
        // intra-sentence pauses and for ~400ms past the end of playback.
        const recent = patRecentRef.current;
        recent.push(patientRms);
        if (recent.length > DT_PEAK_FRAMES) recent.shift();
        const patPeak = Math.max(...recent);

        // Smoothed envelopes — the only sane basis for calibrating the
        // coupling under lag misalignment.
        micEnvRef.current = (1 - DT_ENV_EMA) * micEnvRef.current + DT_ENV_EMA * micRms;
        patEnvRef.current = (1 - DT_ENV_EMA) * patEnvRef.current + DT_ENV_EMA * patientRms;

        // The echo reference is only trustworthy while its recent peak reads
        // real signal. A dead tap (Safari muted-track quirk) means: no
        // barge-in decisions, no coupling updates, and periodic re-attach
        // attempts — but mic-side turn-taking below never depends on it.
        const refLive = patPeak >= DT_REF_LIVE_MIN;
        if (
            !usingReceiver &&
            speakingRef.current &&
            !refLive &&
            now - speakingSinceRef.current > 500 &&
            now - lastReattachAtRef.current > DT_REATTACH_MS
        ) {
            lastReattachAtRef.current = now;
            logDebug('ref-dead:re-attach', { pat: patientRms });
            attachPatientAnalyser();
        }

        // Echo-tail guard: after patient audio ends (stop or barge-in) the
        // mic keeps hearing the room for a while — no doctor turn may open,
        // and voiced frames don't accumulate.
        const inEchoTail =
            !speakingRef.current &&
            lastPatientEndAtRef.current > 0 &&
            now - lastPatientEndAtRef.current < DT_ECHO_TAIL_MS;

        // Periodic snapshot (~1s cadence) into the recorder; live overlay
        // only in ?voicedebug=1 mode.
        debugTickCountRef.current += 1;
        if (debugTickCountRef.current % 20 === 0) {
            const snap = {
                mic: Number(micRms.toFixed(4)),
                pat: Number(patientRms.toFixed(4)),
                peak: Number(patPeak.toFixed(4)),
                k: Number(couplingRef.current.toFixed(4)),
                ref: usingReceiver ? 'rx' : 'tap',
                speaking: speakingRef.current,
                turnOpen: turnOpenRef.current,
                dtFrames: doubleTalkFramesRef.current,
                silFrames: silenceFramesRef.current,
                // How long the open turn has been open, and how much of it held
                // voice — the watchdog's inputs, so a freeze is diagnosable from
                // the log rather than inferred.
                openMs: turnOpenRef.current ? now - turnOpenedAtRef.current : 0,
                turnVoiced: turnVoicedFramesRef.current,
                pending: pendingCommitsRef.current,
            };
            logDebug('snap', snap);
            updateDebugOverlay(
                `mic ${snap.mic} | pat ${snap.pat} | k ${snap.k}\n` +
                    `patientSpeaking ${snap.speaking} | turnOpen ${snap.turnOpen} | ` +
                    `voiced ${snap.dtFrames} sil ${snap.silFrames}`
            );
        }

        // Coupling calibration from smoothed envelopes. Fast inside the
        // turn-start window (the mic can only be hearing echo there), slow
        // and only on non-voiced frames otherwise.
        const inCalWindow =
            speakingRef.current && now - speakingSinceRef.current < DT_CAL_WINDOW_MS;
        const envRatioValid = speakingRef.current && patEnvRef.current >= DT_REF_LIVE_MIN;

        // Echo prediction from the coupling and the PEAK (lag-tolerant).
        // Predict even just after playback ends — the ring buffer decays the
        // peak naturally over ~400ms, covering the mic's lag.
        const predictedEcho = couplingRef.current * patPeak;
        const isVoice =
            micRms - predictedEcho > Math.max(DT_MIC_FLOOR, DT_RESIDUAL_MARGIN * predictedEcho);

        if (envRatioValid && (inCalWindow || !isVoice)) {
            const ratio = micEnvRef.current / patEnvRef.current;
            const ema = inCalWindow ? DT_CAL_EMA : DT_COUPLING_EMA;
            couplingRef.current = Math.min(
                DT_COUPLING_MAX,
                Math.max(0.05, (1 - ema) * couplingRef.current + ema * ratio)
            );
        }

        if (isVoice && !inEchoTail) {
            doubleTalkFramesRef.current += 1;
            silenceFramesRef.current = 0;
            if (turnOpenRef.current) turnVoicedFramesRef.current += 1;
            if (
                speakingRef.current &&
                refLive &&
                !inCalWindow &&
                doubleTalkFramesRef.current >= DT_SUSTAIN_FRAMES &&
                now - detectorStartedAtRef.current > DT_WARMUP_MS &&
                now - lastInterruptAtRef.current > DT_COOLDOWN_MS
            ) {
                // Barge-in: silence the patient and dump the echo-tainted
                // input buffer; the doctor's continuing speech is captured
                // from here and committed when they pause.
                lastInterruptAtRef.current = now;
                doubleTalkFramesRef.current = 0;
                logDebug('BARGE-IN', {
                    mic: micRms,
                    pat: patientRms,
                    patPeak,
                    k: couplingRef.current,
                });
                interruptPatient();
                sendEvent({ type: 'input_audio_buffer.clear' });
            } else if (
                !speakingRef.current &&
                !turnOpenRef.current &&
                doubleTalkFramesRef.current >= DT_MIN_SPEECH_FRAMES
            ) {
                turnOpenRef.current = true;
                turnOpenedAtRef.current = now;
                turnVoicedFramesRef.current = doubleTalkFramesRef.current;
                logDebug('turn-open', { mic: micRms });
            }
        } else {
            if (inEchoTail) doubleTalkFramesRef.current = 0;
            else if (!isVoice) doubleTalkFramesRef.current = 0;
            if (turnOpenRef.current) {
                silenceFramesRef.current += 1;
                if (silenceFramesRef.current >= DT_END_SILENCE_FRAMES) {
                    // End of the doctor's turn — hand the audio to the model,
                    // but not yet the instruction to reply. 900ms of quiet
                    // cannot tell "I'm done" from "I'm thinking", and commit
                    // does not itself create a response, so the reply waits for
                    // the transcript (armRespondDecision → doctorTurn.ts).
                    turnOpenRef.current = false;
                    silenceFramesRef.current = 0;
                    logDebug('turn-commit');
                    sendEvent({ type: 'input_audio_buffer.commit' });
                    armRespondDecision();
                }
            }
        }

        // Commit watchdog — the escape from a turn that can never close on its
        // own (see TURN_WATCHDOG_MS). Runs after the normal path, which has
        // already cleared turnOpenRef if it committed this tick, so the two can
        // never both fire. The forced commit goes through the same reply gate,
        // so a turn that was only room noise transcribes to nothing and the
        // patient stays quiet — the session is unstuck either way.
        if (turnOpenRef.current) {
            const openFor = now - turnOpenedAtRef.current;
            const density = turnVoicedFramesRef.current / Math.max(1, openFor / DT_FRAME_MS);
            const stuck = openFor >= TURN_WATCHDOG_MS && density < TURN_VOICED_DENSITY_MIN;
            if (stuck || openFor >= TURN_MAX_MS) {
                turnOpenRef.current = false;
                silenceFramesRef.current = 0;
                logDebug('turn-commit:watchdog', {
                    openFor,
                    density: Number(density.toFixed(2)),
                    reason: stuck ? 'silent-turn' : 'max-length',
                });
                sendEvent({ type: 'input_audio_buffer.commit' });
                armRespondDecision();
            }
        }
    }, [
        interruptPatient,
        sendEvent,
        logDebug,
        updateDebugOverlay,
        attachPatientAnalyser,
        attachMicAnalyser,
        armRespondDecision,
    ]);

    /** Arm the double-talk detector (unreliable-AEC browsers only). Called
     *  once the mic stream exists; a detector failure only ever degrades to
     *  the no-barge-in behaviour, never breaks the session. */
    const startDoubleTalkDetector = useCallback(() => {
        if (!unreliableEchoCancellation(navigator.userAgent)) return;
        if (audioCtxRef.current || !micStreamRef.current) return;
        try {
            const Ctor =
                window.AudioContext ??
                (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!Ctor) {
                logDebug('detector-arm:FAILED', 'no AudioContext constructor');
                return;
            }
            const ctx = new Ctor();
            audioCtxRef.current = ctx;
            // Safari can suspend OR interrupt a running AudioContext mid-session
            // (device switch, OS audio interruption, an incoming call). Resuming
            // is not enough: the graph feeding the analysers stays dead, the mic
            // reads a flat 0, turn-taking stops, and the patient goes silent for
            // the rest of the consultation. So on every return to `running`,
            // rebuild both taps.
            //
            // `interrupted` is a WebKit-only state and is absent from the DOM
            // typings, hence the widened comparison.
            ctx.onstatechange = () => {
                const state = String(ctx.state);
                logDebug(`audioctx:${state}`);
                if (endedRef.current) return;
                if (state === 'suspended' || state === 'interrupted') {
                    void ctx.resume().catch(() => {
                        /* resume may need a user gesture; the log tells us */
                    });
                } else if (state === 'running') {
                    attachMicAnalyser();
                    attachPatientAnalyser();
                }
            };
            if (!attachMicAnalyser()) {
                logDebug('detector-arm:FAILED', 'mic analyser would not attach');
                return;
            }
            // An OS interruption usually mutes the mic track rather than ending
            // it; the unmute is the earliest reliable moment to rebuild.
            const micTrack = micStreamRef.current.getAudioTracks()[0];
            micTrack?.addEventListener('mute', () => logDebug('mic-track:mute'));
            micTrack?.addEventListener('unmute', () => {
                logDebug('mic-track:unmute');
                attachMicAnalyser();
            });
            micTrack?.addEventListener('ended', () => logDebug('mic-track:ended'));
            attachPatientAnalyser();
            detectorStartedAtRef.current = Date.now();
            detectorIntervalRef.current = setInterval(detectorTick, DT_FRAME_MS);
            logDebug('detector-arm:ok', { ctxState: ctx.state, ctxRate: ctx.sampleRate });
            void ctx.resume().catch(() => {
                /* connect() runs from a user gesture, resume is belt-and-braces */
            });
        } catch (err) {
            logDebug('detector-arm:FAILED', String(err));
        }
    }, [attachPatientAnalyser, attachMicAnalyser, detectorTick, logDebug]);

    // Tear down media/connection without persisting (used for leave + unmount).
    const teardown = useCallback(() => {
        flushVoiceLog('teardown');
        if (voiceLogTimerRef.current) {
            clearInterval(voiceLogTimerRef.current);
            voiceLogTimerRef.current = null;
        }
        if (transcriptSaveTimerRef.current) {
            clearInterval(transcriptSaveTimerRef.current);
            transcriptSaveTimerRef.current = null;
        }
        if (pagehideHandlerRef.current) {
            window.removeEventListener('pagehide', pagehideHandlerRef.current);
            pagehideHandlerRef.current = null;
        }
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (endDelayRef.current) {
            clearTimeout(endDelayRef.current);
            endDelayRef.current = null;
        }
        if (greetingWatchdogRef.current) {
            clearTimeout(greetingWatchdogRef.current);
            greetingWatchdogRef.current = null;
        }
        if (wakeLockRef.current) {
            wakeLockRef.current.release().catch(() => {});
            wakeLockRef.current = null;
        }
        if (levelProbeRef.current) {
            clearInterval(levelProbeRef.current);
            levelProbeRef.current = null;
        }
        if (detectorIntervalRef.current) {
            clearInterval(detectorIntervalRef.current);
            detectorIntervalRef.current = null;
        }
        micAnalyserRef.current = null;
        micTapSourceRef.current = null;
        micDeadFramesRef.current = 0;
        lastMicRearmAtRef.current = 0;
        patientAnalyserRef.current = null;
        patientTapSourceRef.current = null;
        patientTapStreamRef.current = null;
        remoteStreamRef.current = null;
        audioReceiverRef.current = null;
        receiverRefUsableRef.current = null;
        speakingRef.current = false;
        activeResponseIdRef.current = null;
        lastAssistantItemRef.current = null;
        lastReattachAtRef.current = 0;
        turnOpenRef.current = false;
        doctorSpeakingRef.current = false;
        silenceFramesRef.current = 0;
        turnOpenedAtRef.current = 0;
        turnVoicedFramesRef.current = 0;
        patRecentRef.current = [];
        micEnvRef.current = 0;
        patEnvRef.current = 0;
        lastPatientEndAtRef.current = 0;
        if (bufferClearTimerRef.current) {
            clearTimeout(bufferClearTimerRef.current);
            bufferClearTimerRef.current = null;
        }
        pendingCommitsRef.current = 0;
        clearRespondTimers();
        if (audioCtxRef.current) {
            void audioCtxRef.current.close().catch(() => {
                /* already closed */
            });
            audioCtxRef.current = null;
        }
        try {
            dcRef.current?.close();
        } catch {
            /* ignore */
        }
        dcRef.current = null;
        try {
            pcRef.current?.close();
        } catch {
            /* ignore */
        }
        pcRef.current = null;
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        micTrackRef.current = null;
        if (audioElRef.current) {
            audioElRef.current.pause();
            audioElRef.current.srcObject = null;
            audioElRef.current.remove();
            audioElRef.current = null;
        }
        setIsSpeaking(false);
        setStatus('disconnected');
    }, [flushVoiceLog, clearRespondTimers]);

    // Graceful end: silence the patient immediately, then persist the
    // transcript and notify. Teardown must come FIRST — the save round-trip
    // can take seconds (cold start), and while it ran the WebRTC connection
    // used to stay live with the patient still talking.
    const endRoutine = useCallback(async () => {
        if (endedRef.current) return;
        endedRef.current = true;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        // Request the recorder stop BEFORE teardown stops the mic track, then
        // let the upload finish in the background while the transcript saves.
        void flushRecording('end');
        teardown();
        try {
            await fetch(saveEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    transcript: transcriptRef.current,
                    final: true,
                }),
            });
        } catch {
            /* best-effort — feedback route also tolerates retries */
        }
        onConsultationEnded?.();
    }, [saveEndpoint, sessionId, teardown, flushRecording, onConsultationEnded]);

    const handleFunctionCall = useCallback(
        (name: string, callId: string, _argsJson: string) => {
            if (name === 'end_consultation') {
                sendEvent({
                    type: 'conversation.item.create',
                    item: {
                        type: 'function_call_output',
                        call_id: callId,
                        output: 'Acknowledge warmly and say a brief goodbye to the doctor.',
                    },
                });
                sendEvent({ type: 'response.create' });
                // Let the goodbye play before tearing down (mirrors old delayed disconnect).
                endDelayRef.current = setTimeout(() => void endRoutine(), 7000);
            }
        },
        [sendEvent, endRoutine]
    );

    const handleServerEvent = useCallback(
        (raw: string) => {
            let evt: { type?: string; transcript?: string; [k: string]: unknown };
            try {
                evt = JSON.parse(raw);
            } catch {
                return;
            }
            {
                const t = String(evt.type ?? '');
                if (!t.endsWith('.delta')) {
                    if (t === 'error') logDebug('rx:error', evt.error);
                    else if (/transcript(ion)?\.(completed|done)$/.test(t))
                        logDebug(`rx:${t}`, String(evt.transcript ?? ''));
                    else if (t === 'rate_limits.updated')
                        logDebug('rx:rate_limits', summariseRateLimits(evt.rate_limits));
                    else logDebug(`rx:${t}`);
                }
            }
            switch (evt.type) {
                case 'input_audio_buffer.speech_started': {
                    doctorSpeakingRef.current = true;
                    const id = String(evt.item_id ?? '');
                    if (id) {
                        vadRef.current[id] = {
                            ...vadRef.current[id],
                            start_ms: asMs(evt.audio_start_ms),
                        };
                    }
                    break;
                }
                case 'input_audio_buffer.speech_stopped': {
                    doctorSpeakingRef.current = false;
                    // Reliable-AEC path: the server has committed the buffer but
                    // create_response is false, so the reply is ours to decide.
                    armRespondDecision();
                    const id = String(evt.item_id ?? '');
                    if (id) {
                        vadRef.current[id] = {
                            ...vadRef.current[id],
                            end_ms: asMs(evt.audio_end_ms),
                        };
                    }
                    break;
                }
                case 'conversation.item.input_audio_transcription.completed': {
                    const id = String(evt.item_id ?? '');
                    const vad = (id && vadRef.current[id]) || {};
                    const said = String(evt.transcript ?? '').trim();
                    const conf = meanProbFromLogprobs(evt.logprobs);

                    // Whisper invents a stock phrase when handed near-silence,
                    // and the marking engine grades THIS transcript — so a
                    // phantom "Bye." stands in for the doctor's real question
                    // and they lose the mark for it. Observed on 24 Jul: "Bye!"
                    // where photophobia was asked about, "Anyway, loss." for
                    // "any weight loss?", "Any nice words?" for "night sweats?".
                    //
                    // Deliberately NOT dropping on text alone — "bye", "thanks"
                    // and "thank you" are exactly what a doctor says closing a
                    // consultation, and "okay" is a normal backchannel. Only drop
                    // when it is a known stock phrase AND the ASR itself was
                    // unsure. Punctuation-only output is always noise.
                    let dropReason: string | null = null;
                    if (/^[\s.,!?—-]+$/.test(said)) {
                        dropReason = 'punctuation-only';
                    } else if (
                        /^(bye|thanks|thank you|you)[.!?]*$/i.test(said) &&
                        typeof conf === 'number' &&
                        conf < ASR_ARTIFACT_CONFIDENCE
                    ) {
                        dropReason = 'stock-phrase';
                    }

                    if (dropReason) {
                        logDebug(`asr-drop:${dropReason}`, {
                            said,
                            conf: typeof conf === 'number' ? Number(conf.toFixed(2)) : null,
                        });
                    } else {
                        appendTurn({
                            speaker: 'candidate',
                            text: said,
                            start_ms: vad.start_ms ?? relNow(),
                            end_ms: vad.end_ms,
                            asr_confidence: conf,
                        });
                    }
                    if (id) delete vadRef.current[id];
                    // Now that we know what was said, decide whether the turn
                    // this transcript belongs to earns a reply.
                    resolveRespondDecision(said, Boolean(dropReason));
                    break;
                }
                // GA emits response.output_audio_transcript.done; older builds use response.audio_transcript.done.
                // The patient turn is generated text, so its ASR confidence is 1.0.
                case 'response.output_audio_transcript.done':
                case 'response.audio_transcript.done':
                    appendTurn({
                        speaker: 'patient',
                        text: String(evt.transcript ?? ''),
                        start_ms: relNow(),
                        asr_confidence: 1,
                    });
                    break;
                case 'response.created': {
                    const responseId = (evt.response as { id?: string } | undefined)?.id;
                    activeResponseIdRef.current = responseId ? String(responseId) : null;
                    break;
                }
                case 'response.done': {
                    const responseId = (evt.response as { id?: string } | undefined)?.id;
                    if (responseId && responseId === activeResponseIdRef.current) {
                        activeResponseIdRef.current = null;
                    }
                    break;
                }
                case 'response.output_item.added': {
                    const item = evt.item as
                        | { id?: string; type?: string; role?: string }
                        | undefined;
                    if (item?.type === 'message' && item.role === 'assistant' && item.id) {
                        lastAssistantItemRef.current = item.id;
                    }
                    break;
                }
                case 'output_audio_buffer.started':
                    // First patient audio proves the session is genuinely live —
                    // stand down the greeting watchdog.
                    patientAudioStartedRef.current = true;
                    if (greetingWatchdogRef.current) {
                        clearTimeout(greetingWatchdogRef.current);
                        greetingWatchdogRef.current = null;
                    }
                    speakingRef.current = true;
                    speakingSinceRef.current = Date.now();
                    // The patient has taken the floor — abandon any half-open
                    // doctor turn so echo can never ride into a later commit.
                    turnOpenRef.current = false;
                    silenceFramesRef.current = 0;
                    turnVoicedFramesRef.current = 0;
                    doubleTalkFramesRef.current = 0;
                    // The patient is answering, so any turn still waiting on a
                    // reply decision has been answered — drop it rather than
                    // letting a stale timer fire a second response.
                    pendingCommitsRef.current = 0;
                    clearRespondTimers();
                    setIsSpeaking(true);
                    break;
                case 'output_audio_buffer.stopped':
                case 'output_audio_buffer.cleared':
                    speakingRef.current = false;
                    lastPatientEndAtRef.current = Date.now();
                    setIsSpeaking(false);
                    // Client-driven turn mode: the input buffer now holds the
                    // echo of the patient's turn, and the mic hears its tail
                    // for a while yet. Turn opens are blocked for the tail
                    // window (detectorTick), and at its end the buffer is
                    // flushed so the doctor's next turn starts clean.
                    if (audioCtxRef.current) {
                        if (bufferClearTimerRef.current) clearTimeout(bufferClearTimerRef.current);
                        bufferClearTimerRef.current = setTimeout(() => {
                            bufferClearTimerRef.current = null;
                            if (!turnOpenRef.current) {
                                sendEvent({ type: 'input_audio_buffer.clear' });
                            }
                        }, DT_ECHO_TAIL_MS);
                    }
                    break;
                case 'response.function_call_arguments.done':
                    handleFunctionCall(
                        String(evt.name ?? ''),
                        String(evt.call_id ?? ''),
                        String(evt.arguments ?? '{}')
                    );
                    break;
                case 'error': {
                    const message =
                        (evt.error as { message?: string } | undefined)?.message ?? 'Realtime error';
                    // Benign races from client-side barge-in / turn-taking:
                    // cancelling a response that just finished, truncating
                    // audio shorter than requested, or committing an input
                    // buffer the server considers empty. Match the SPECIFIC
                    // messages — keyword matching (e.g. /truncat/) once hid a
                    // whole class of fatal errors, like context-truncation
                    // failures, behind a silent patient.
                    if (
                        /no active response|already shorter|buffer too small|buffer is empty|empty input audio buffer/i.test(
                            message
                        )
                    )
                        break;
                    setError(message);
                    flushVoiceLog('realtime-error');
                    onError?.(message);
                    break;
                }
                default:
                    break;
            }
        },
        [
            appendTurn,
            relNow,
            handleFunctionCall,
            onError,
            sendEvent,
            logDebug,
            flushVoiceLog,
            resolveRespondDecision,
            clearRespondTimers,
            armRespondDecision,
        ]
    );

    useEffect(() => {
        // The OS drops a wake lock whenever the tab is hidden; take it back
        // when the trainee returns mid-consultation.
        const onVisible = () => {
            if (document.visibilityState === 'visible' && status === 'connected') void acquireWakeLock();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);
    const connect = useCallback(async () => {
        if (endedRef.current || status === 'connecting' || status === 'connected') return;
        try {
            setStatus('connecting');
            setError(null);
            setErrorKind(null);
            endedRef.current = false;
            debugEnabledRef.current =
                typeof window !== 'undefined' && window.location.search.includes('voicedebug');
            if (debugEnabledRef.current) ensureDebugOverlay();
            logDebug('connect:start', {
                build: (process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'unknown').slice(0, 7),
                ua: navigator.userAgent,
                unreliableAec: unreliableEchoCancellation(navigator.userAgent),
            });

            // 1. Mint ephemeral key + session config
            const res = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, stationId }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Token request failed: ${res.statusText}`);
            }
            const { ephemeralKey, callsUrl, durationSeconds, origin }: TokenResponse =
                await res.json();
            // Which region served this consultation. Recorded so a session that
            // ran on the standby lane can be told apart afterwards — the standby
            // transcribes with a different model, so it is worth knowing.
            logDebug('connect:token', { origin: origin ?? 'unknown' });

            // 2. Microphone — classified separately so a denied mic gets
            // recovery instructions rather than "Connection problem".
            let micStream: MediaStream;
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new MicError('mic_unsupported', 'This browser cannot capture audio here.');
                }
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                });
            } catch (micErr) {
                throw micErr instanceof MicError ? micErr : classifyMicError(micErr);
            }
            micStreamRef.current = micStream;
            micTrackRef.current = micStream.getAudioTracks()[0] ?? null;
            startDoubleTalkDetector();

            // Consultation audio. The patient side joins at ontrack/unmute.
            // Only a gracefully ended consultation is uploaded: a dropped
            // connection leaves the session retryable on the same id, and a
            // stub from the failed attempt would take the single recording
            // slot that the real consultation needs.
            recorderRef.current?.dispose();
            recordingFlushedRef.current = false;
            recorderRef.current = startSessionRecorder(micStream);
            logDebug(
                recorderRef.current
                    ? `recording:started ${recorderRef.current.mimeType}`
                    : 'recording:unsupported'
            );

            // 3. Peer connection
            const pc = new RTCPeerConnection();
            pcRef.current = pc;

            // A stalled call must not look like a live one: surface transport
            // failures instead of leaving the UI on a frozen "Listening…" state.
            pc.onconnectionstatechange = () => {
                logDebug(`pc:${pc.connectionState}`);
                if (endedRef.current) return;
                if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                    const message = 'Connection to the patient was lost. Please try again.';
                    setError(message);
                    flushVoiceLog('connection-lost');
                    teardown();
                    onError?.(message);
                }
            };

            // Patient audio playback
            pc.ontrack = (e: RTCTrackEvent) => {
                let el = audioElRef.current;
                if (!el) {
                    el = document.createElement('audio');
                    el.autoplay = true;
                    el.dataset.realtimeAudio = 'true';
                    document.body.appendChild(el);
                    audioElRef.current = el;
                }
                el.srcObject = e.streams[0];
                remoteStreamRef.current = e.streams[0] ?? new MediaStream([e.track]);
                // Primary echo reference — read straight off the receiver, no
                // audio graph to keep alive (see patientReferenceLevel).
                audioReceiverRef.current = e.receiver ?? null;
                logDebug('rx:ontrack', {
                    streams: e.streams.length,
                    trackMuted: e.track.muted,
                    trackState: e.track.readyState,
                });
                // Remote tracks arrive muted and unmute when RTP flows —
                // that's when a WebKit tap becomes viable (see
                // attachPatientAnalyser). Re-attach on every unmute.
                e.track.addEventListener('unmute', () => {
                    logDebug('rx:track-unmute');
                    attachPatientAnalyser();
                    recorderRef.current?.addRemoteTrack(e.track);
                });
                attachPatientAnalyser();
                startLevelProbe();
                recorderRef.current?.addRemoteTrack(e.track);
                void logAudioOutput(el);
                void el.play().catch((err: unknown) => {
                    // Not swallowed any more. A refused play() is silent to the
                    // user and, until this line, silent to us as well — which is
                    // why ten consecutive silent sessions could not afterwards
                    // be told apart from a dead output device.
                    logDebug('audio:play-failed', {
                        name: err instanceof Error ? err.name : 'unknown',
                        message: err instanceof Error ? err.message : String(err),
                    });
                });
            };

            // 4. Data channel for events (create before the offer so it's negotiated)
            const dc = pc.createDataChannel('oai-events');
            dcRef.current = dc;
            dc.onmessage = (e: MessageEvent) => handleServerEvent(e.data);
            dc.onclose = () => {
                logDebug('dc:close');
                flushVoiceLog('dc-close');
            };
            dc.onopen = () => {
                setStatus('connected');
                void acquireWakeLock();
                sessionStartRef.current = Date.now();
                vadRef.current = {};
                // Session was minted with turn_detection: null for this
                // browser, expecting the client detector to own turn-taking.
                // Sole escape hatch: if WebAudio itself is unavailable (mic
                // analyser never armed — essentially never on real browsers),
                // the session would have NO turn-taking at all, so restore
                // server VAD. A dead PATIENT tap is not this case — the mic
                // side runs turn-taking regardless and the tap self-heals.
                if (
                    unreliableEchoCancellation(navigator.userAgent) &&
                    (!audioCtxRef.current || !micAnalyserRef.current)
                ) {
                    logDebug('webaudio-unavailable:restoring server_vad');
                    sendEvent({
                        type: 'session.update',
                        session: {
                            audio: {
                                input: {
                                    turn_detection: {
                                        type: 'server_vad',
                                        threshold: 0.75,
                                        prefix_padding_ms: 300,
                                        silence_duration_ms: 900,
                                        interrupt_response: false,
                                    },
                                },
                            },
                        },
                    });
                }
                // Flight recorder: periodic upload + tab-close beacon.
                if (voiceLogTimerRef.current) clearInterval(voiceLogTimerRef.current);
                voiceLogTimerRef.current = setInterval(() => flushVoiceLog('periodic'), 60000);
                transcriptSaveTimerRef.current = setInterval(
                    () => persistTranscript(false),
                    TRANSCRIPT_SAVE_MS
                );
                // A closed tab is the case that lost three consultations, so the
                // transcript rides the same beacon as the flight recorder.
                const onPagehide = () => {
                    persistTranscript(false, true);
                    flushVoiceLog('pagehide', true);
                };
                window.addEventListener('pagehide', onPagehide);
                pagehideHandlerRef.current = onPagehide;
                onSessionStarted?.();
                // Patient speaks first — greeting ONLY, then waits (greeting-first behaviour).
                sendEvent({
                    type: 'response.create',
                    response: {
                        instructions:
                            'Begin the consultation. Greet the doctor with a brief, natural hello ONLY — ' +
                            'for example "Hello" or "Hi, doctor". Do NOT say why you are here yet; ' +
                            'wait for the doctor to ask what they can help with.',
                    },
                });
                // Authoritative consultation timer. The visible countdown in
                // ConsultationTimer reaches zero at durationSeconds and hands the
                // UI a "time's up" state; this is the only thing that actually
                // ends the session, SPILL_MS later. Two clocks used to race to
                // end it — now one displays and one decides.
                timerRef.current = setTimeout(
                    () => void endRoutine(),
                    durationSeconds * 1000 + SPILL_MS
                );
                // Greeting watchdog: if no patient audio arrives shortly after the
                // channel opens, the session is stalled — fail fast so the user can
                // retry instead of sitting in a silent 12-minute consultation.
                patientAudioStartedRef.current = false;
                greetingWatchdogRef.current = setTimeout(() => {
                    if (endedRef.current || patientAudioStartedRef.current) return;
                    const message =
                        "The patient didn't respond — the connection may have stalled. Please try again.";
                    setError(message);
                    teardown();
                    onError?.(message);
                }, 15000);
            };

            // 5. Mic uplink
            if (micTrackRef.current) {
                pc.addTrack(micTrackRef.current, micStream);
            }

            // 6. SDP offer/answer with Azure
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const sdpRes = await fetch(callsUrl, {
                method: 'POST',
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${ephemeralKey}`,
                    'Content-Type': 'application/sdp',
                },
            });
            if (!sdpRes.ok) {
                throw new Error(`WebRTC negotiation failed: ${sdpRes.status}`);
            }
            const answerSdp = await sdpRes.text();
            await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to connect';
            setError(message);
            setErrorKind(err instanceof MicError ? err.kind : 'connection');
            teardown();
            onError?.(message);
        }
    }, [
        status,
        acquireWakeLock,
        tokenEndpoint,
        sessionId,
        stationId,
        persistTranscript,
        handleServerEvent,
        sendEvent,
        logAudioOutput,
        startLevelProbe,
        endRoutine,
        teardown,
        startDoubleTalkDetector,
        attachPatientAnalyser,
        ensureDebugOverlay,
        logDebug,
        flushVoiceLog,
        onSessionStarted,
        onError,
    ]);

    const endConsultation = useCallback(() => endRoutine(), [endRoutine]);

    // Abandon: tear down without persisting or triggering feedback. The audio
    // goes with it — an abandoned consultation has no feedback to play against.
    const disconnect = useCallback(() => {
        endedRef.current = true;
        recorderRef.current?.dispose();
        recorderRef.current = null;
        teardown();
    }, [teardown]);

    /**
     * The patient's current playback level, 0..1, or null where this browser
     * won't say.
     *
     * Exposed as a getter rather than as state on purpose. The consultation orb
     * samples this ~30 times a second; as state it would re-render this hook —
     * and therefore the whole session page, its transcript and its controls —
     * thirty times a second, on top of the timer's existing twice-a-second
     * render, for the entire 12 minutes and with a wake lock held so the phone
     * can never sleep through it. A getter closes over refs only, so it is
     * referentially stable, costs nothing when nobody calls it, and keeps the
     * animation entirely outside React.
     *
     * This reads the same RFC 6464 receiver level the double-talk detector uses
     * (see `receiverAudioLevel`) — no AudioContext, no AnalyserNode, nothing to
     * garbage-collect, and no third audio graph competing with the two that
     * already exist on Safari/Firefox/iOS.
     *
     * null vs 0 matters to the caller: null means "this browser never reports a
     * level, animate some other way", 0 means "reporting, and it's silent". The
     * `seen` latch keeps a momentary empty `getSynchronizationSources()` — the
     * gap before the first RTP packet, or after teardown nulls the receiver —
     * from being misread as the former.
     */
    const getPatientLevel = useCallback((): number | null => {
        const level = receiverAudioLevel(audioReceiverRef.current);
        if (level === undefined) return patientLevelSeenRef.current ? 0 : null;
        patientLevelSeenRef.current = true;
        return level;
    }, []);

    const setMicMuted = useCallback((muted: boolean) => {
        setIsMuted(muted);
        if (micTrackRef.current) {
            micTrackRef.current.enabled = !muted;
        }
    }, []);

    // Cleanup on unmount — teardown only (no save). An already-flushed
    // recorder is a no-op here; an unflushed one is released, and its upload
    // (if any) is already in flight independently of this object.
    useEffect(() => {
        return () => {
            endedRef.current = true;
            recorderRef.current?.dispose();
            teardown();
        };
    }, [teardown]);

    return {
        isConnected: status === 'connected',
        isSpeaking,
        isMuted,
        transcript,
        connect,
        endConsultation,
        disconnect,
        setMicMuted,
        getPatientLevel,
        error,
        errorKind,
        status,
    };
}
