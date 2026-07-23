'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TranscriptItem } from '@/lib/clinical-master/types';
import { unreliableEchoCancellation } from '@/lib/clinical-master/echoCancellation';

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
/** Mic RMS must exceed this multiple of the predicted echo level. */
const DT_MARGIN = 3;
/** Absolute mic RMS floor (~-40dBFS) so silence can never trigger. */
const DT_MIC_FLOOR = 0.01;
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
/** After patient playback stops, wait this long for the echo/reverb tail
 *  before dumping the input buffer. */
const DT_ECHO_TAIL_MS = 400;

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
    const patientAnalyserRef = useRef<AnalyserNode | null>(null);
    const analyserBufRef = useRef<Uint8Array | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const detectorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const detectorStartedAtRef = useRef(0);
    /** Echo-coupling estimate: micRms ≈ coupling × patientRms. Starts high
     *  (conservative — over-predicts echo) and calibrates down via EMA. */
    const couplingRef = useRef(0.2);
    const doubleTalkFramesRef = useRef(0);
    const lastInterruptAtRef = useRef(0);
    const remoteSilentFramesRef = useRef(0);
    const detectorDisabledRef = useRef(false);
    const speakingRef = useRef(false);
    const speakingSinceRef = useRef(0);
    const activeResponseIdRef = useRef<string | null>(null);
    const lastAssistantItemRef = useRef<string | null>(null);
    /** A doctor turn is currently being captured (client-driven turn mode). */
    const turnOpenRef = useRef(false);
    const silenceFramesRef = useRef(0);
    const bufferClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fallbackSentRef = useRef(false);
    // --- voice debug capture (?voicedebug=1 on the session URL) ---
    const debugEnabledRef = useRef(false);
    const debugLogRef = useRef<Array<{ t: number; e: string; d?: unknown }>>([]);
    const debugElRef = useRef<HTMLDivElement | null>(null);
    const debugTickCountRef = useRef(0);

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

    /** Append to the in-memory voice debug log (no-op unless ?voicedebug=1). */
    const logDebug = useCallback((e: string, d?: unknown) => {
        if (!debugEnabledRef.current) return;
        const log = debugLogRef.current;
        log.push({ t: sessionStartRef.current ? Date.now() - sessionStartRef.current : 0, e, d });
        if (log.length > 4000) log.splice(0, 1000);
    }, []);

    /** Floating overlay with live detector numbers + a copy-log button. */
    const ensureDebugOverlay = useCallback(() => {
        if (!debugEnabledRef.current || debugElRef.current) return;
        const wrap = document.createElement('div');
        wrap.style.cssText =
            'position:fixed;bottom:8px;left:8px;z-index:99999;background:rgba(0,0,0,0.85);' +
            'color:#7CFC00;font:10px/1.5 monospace;padding:8px 10px;border-radius:8px;max-width:320px;pointer-events:auto;';
        const info = document.createElement('div');
        info.textContent = 'voice debug: waiting for session…';
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

    /** Tap the patient's remote stream for level analysis. Analysis only —
     *  never connected to the destination, so playback is untouched. */
    const attachPatientAnalyser = useCallback(() => {
        const ctx = audioCtxRef.current;
        const stream = remoteStreamRef.current;
        if (!ctx || !stream || patientAnalyserRef.current) return;
        try {
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            ctx.createMediaStreamSource(stream).connect(analyser);
            patientAnalyserRef.current = analyser;
            logDebug('patient-analyser:attached', {
                tracks: stream.getAudioTracks().map((t) => ({ muted: t.muted, state: t.readyState })),
                ctxState: ctx.state,
                ctxRate: ctx.sampleRate,
            });
        } catch (err) {
            detectorDisabledRef.current = true;
            logDebug('patient-analyser:FAILED', String(err));
        }
    }, [logDebug]);

    /**
     * On unreliable-AEC browsers server VAD is off entirely (the echo leak
     * defeats every threshold), so losing the detector means losing
     * turn-taking. Degrade to server VAD via session.update — the patient
     * may echo-loop in the worst case, but the session stays usable.
     */
    const disableDetectorWithFallback = useCallback(() => {
        if (fallbackSentRef.current) return;
        fallbackSentRef.current = true;
        detectorDisabledRef.current = true;
        turnOpenRef.current = false;
        logDebug('DETECTOR-DISARMED:falling back to server_vad');
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
    }, [sendEvent, logDebug]);

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
        if (detectorDisabledRef.current) return;
        const micAnalyser = micAnalyserRef.current;
        const patientAnalyser = patientAnalyserRef.current;
        const buf = analyserBufRef.current;
        if (!micAnalyser || !patientAnalyser || !buf) return;
        const patientRms = analyserRms(patientAnalyser, buf);
        const micRms = analyserRms(micAnalyser, buf);
        const now = Date.now();

        // Periodic snapshot + live overlay (~1s cadence, debug mode only).
        debugTickCountRef.current += 1;
        if (debugEnabledRef.current && debugTickCountRef.current % 20 === 0) {
            const snap = {
                mic: Number(micRms.toFixed(4)),
                pat: Number(patientRms.toFixed(4)),
                k: Number(couplingRef.current.toFixed(4)),
                speaking: speakingRef.current,
                turnOpen: turnOpenRef.current,
                dtFrames: doubleTalkFramesRef.current,
                silFrames: silenceFramesRef.current,
            };
            logDebug('snap', snap);
            updateDebugOverlay(
                `mic ${snap.mic} | pat ${snap.pat} | k ${snap.k}\n` +
                    `patientSpeaking ${snap.speaking} | turnOpen ${snap.turnOpen} | ` +
                    `voiced ${snap.dtFrames} sil ${snap.silFrames}`
            );
        }

        // Safari has historically returned silence from WebAudio taps on
        // remote WebRTC streams. If the patient analyser reads nothing while
        // audio is audibly playing, the analysis is untrustworthy.
        if (speakingRef.current) {
            if (patientRms < 0.003) {
                remoteSilentFramesRef.current += 1;
                if (remoteSilentFramesRef.current === 1) logDebug('remote-tap-silent-frame');
                if (remoteSilentFramesRef.current > 20) disableDetectorWithFallback();
                return;
            }
            remoteSilentFramesRef.current = 0;
        }

        const predictedEcho = speakingRef.current ? couplingRef.current * patientRms : 0;
        const isVoice = micRms > Math.max(DT_MIC_FLOOR, DT_MARGIN * predictedEcho);

        if (isVoice) {
            doubleTalkFramesRef.current += 1;
            silenceFramesRef.current = 0;
            if (
                speakingRef.current &&
                doubleTalkFramesRef.current >= DT_SUSTAIN_FRAMES &&
                now - detectorStartedAtRef.current > DT_WARMUP_MS &&
                now - lastInterruptAtRef.current > DT_COOLDOWN_MS
            ) {
                // Barge-in: silence the patient and dump the echo-tainted
                // input buffer; the doctor's continuing speech is captured
                // from here and committed when they pause.
                lastInterruptAtRef.current = now;
                doubleTalkFramesRef.current = 0;
                logDebug('BARGE-IN', { mic: micRms, pat: patientRms, k: couplingRef.current });
                interruptPatient();
                sendEvent({ type: 'input_audio_buffer.clear' });
            } else if (
                !speakingRef.current &&
                !turnOpenRef.current &&
                doubleTalkFramesRef.current >= DT_MIN_SPEECH_FRAMES
            ) {
                turnOpenRef.current = true;
                logDebug('turn-open', { mic: micRms });
            }
        } else {
            doubleTalkFramesRef.current = 0;
            if (speakingRef.current && patientRms > 0) {
                // Mic is echo-only right now — refine the coupling estimate.
                const ratio = micRms / patientRms;
                couplingRef.current = Math.min(
                    1,
                    Math.max(0.005, (1 - DT_COUPLING_EMA) * couplingRef.current + DT_COUPLING_EMA * ratio)
                );
            }
            if (turnOpenRef.current) {
                silenceFramesRef.current += 1;
                if (silenceFramesRef.current >= DT_END_SILENCE_FRAMES) {
                    // End of the doctor's turn — hand it to the model.
                    turnOpenRef.current = false;
                    silenceFramesRef.current = 0;
                    logDebug('turn-commit');
                    sendEvent({ type: 'input_audio_buffer.commit' });
                    sendEvent({ type: 'response.create' });
                }
            }
        }
    }, [interruptPatient, sendEvent, disableDetectorWithFallback, logDebug, updateDebugOverlay]);

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
            const micAnalyser = ctx.createAnalyser();
            micAnalyser.fftSize = 1024;
            ctx.createMediaStreamSource(micStreamRef.current).connect(micAnalyser);
            micAnalyserRef.current = micAnalyser;
            analyserBufRef.current = new Uint8Array(micAnalyser.fftSize);
            attachPatientAnalyser();
            detectorStartedAtRef.current = Date.now();
            detectorIntervalRef.current = setInterval(detectorTick, DT_FRAME_MS);
            logDebug('detector-arm:ok', { ctxState: ctx.state, ctxRate: ctx.sampleRate });
            void ctx.resume().catch(() => {
                /* connect() runs from a user gesture, resume is belt-and-braces */
            });
        } catch (err) {
            detectorDisabledRef.current = true;
            logDebug('detector-arm:FAILED', String(err));
        }
    }, [attachPatientAnalyser, detectorTick, logDebug]);

    // Tear down media/connection without persisting (used for leave + unmount).
    const teardown = useCallback(() => {
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
        if (detectorIntervalRef.current) {
            clearInterval(detectorIntervalRef.current);
            detectorIntervalRef.current = null;
        }
        micAnalyserRef.current = null;
        patientAnalyserRef.current = null;
        remoteStreamRef.current = null;
        speakingRef.current = false;
        activeResponseIdRef.current = null;
        lastAssistantItemRef.current = null;
        detectorDisabledRef.current = false;
        fallbackSentRef.current = false;
        turnOpenRef.current = false;
        silenceFramesRef.current = 0;
        if (bufferClearTimerRef.current) {
            clearTimeout(bufferClearTimerRef.current);
            bufferClearTimerRef.current = null;
        }
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
    }, []);

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
        teardown();
        try {
            await fetch(saveEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, transcript: transcriptRef.current }),
            });
        } catch {
            /* best-effort — feedback route also tolerates retries */
        }
        onConsultationEnded?.();
    }, [saveEndpoint, sessionId, teardown, onConsultationEnded]);

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
            if (debugEnabledRef.current) {
                const t = String(evt.type ?? '');
                if (!t.endsWith('.delta')) {
                    if (t === 'error') logDebug('rx:error', evt.error);
                    else if (/transcript(ion)?\.(completed|done)$/.test(t))
                        logDebug(`rx:${t}`, String(evt.transcript ?? ''));
                    else logDebug(`rx:${t}`);
                }
            }
            switch (evt.type) {
                case 'input_audio_buffer.speech_started': {
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
                    appendTurn({
                        speaker: 'candidate',
                        text: String(evt.transcript ?? ''),
                        start_ms: vad.start_ms ?? relNow(),
                        end_ms: vad.end_ms,
                        asr_confidence: meanProbFromLogprobs(evt.logprobs),
                    });
                    if (id) delete vadRef.current[id];
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
                    setIsSpeaking(true);
                    break;
                case 'output_audio_buffer.stopped':
                case 'output_audio_buffer.cleared':
                    speakingRef.current = false;
                    setIsSpeaking(false);
                    // Client-driven turn mode: the input buffer now holds the
                    // echo of the patient's turn. Once the reverb tail has
                    // passed, dump it so the doctor's next turn starts clean —
                    // unless the doctor is already mid-turn.
                    if (audioCtxRef.current && !detectorDisabledRef.current) {
                        if (bufferClearTimerRef.current) clearTimeout(bufferClearTimerRef.current);
                        bufferClearTimerRef.current = setTimeout(() => {
                            bufferClearTimerRef.current = null;
                            if (!turnOpenRef.current && !detectorDisabledRef.current) {
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
                    // buffer the server considers empty. Not session errors.
                    if (/cancel|truncat|buffer/i.test(message)) break;
                    setError(message);
                    onError?.(message);
                    break;
                }
                default:
                    break;
            }
        },
        [appendTurn, relNow, handleFunctionCall, onError, sendEvent, logDebug, disableDetectorWithFallback]
    );

    const connect = useCallback(async () => {
        if (endedRef.current || status === 'connecting' || status === 'connected') return;
        try {
            setStatus('connecting');
            setError(null);
            endedRef.current = false;
            debugEnabledRef.current =
                typeof window !== 'undefined' && window.location.search.includes('voicedebug');
            if (debugEnabledRef.current) {
                ensureDebugOverlay();
                logDebug('connect:start', {
                    ua: navigator.userAgent,
                    unreliableAec: unreliableEchoCancellation(navigator.userAgent),
                });
            }

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
            const { ephemeralKey, callsUrl, durationSeconds }: TokenResponse = await res.json();

            // 2. Microphone
            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
            micStreamRef.current = micStream;
            micTrackRef.current = micStream.getAudioTracks()[0] ?? null;
            startDoubleTalkDetector();

            // 3. Peer connection
            const pc = new RTCPeerConnection();
            pcRef.current = pc;

            // A stalled call must not look like a live one: surface transport
            // failures instead of leaving the UI on a frozen "Listening…" state.
            pc.onconnectionstatechange = () => {
                if (endedRef.current) return;
                if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                    const message = 'Connection to the patient was lost. Please try again.';
                    setError(message);
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
                remoteStreamRef.current = e.streams[0] ?? null;
                logDebug('rx:ontrack', {
                    streams: e.streams.length,
                    trackMuted: e.track.muted,
                    trackState: e.track.readyState,
                });
                attachPatientAnalyser();
                void el.play().catch(() => {
                    /* autoplay may require gesture; ignore */
                });
            };

            // 4. Data channel for events (create before the offer so it's negotiated)
            const dc = pc.createDataChannel('oai-events');
            dcRef.current = dc;
            dc.onmessage = (e: MessageEvent) => handleServerEvent(e.data);
            dc.onopen = () => {
                setStatus('connected');
                sessionStartRef.current = Date.now();
                vadRef.current = {};
                // Session was minted with turn_detection: null for this
                // browser, expecting the client detector to own turn-taking.
                // If arming failed (no WebAudio, construction threw), the
                // session would have NO turn detection at all — restore
                // server VAD before the consultation starts.
                if (
                    unreliableEchoCancellation(navigator.userAgent) &&
                    (!audioCtxRef.current || detectorDisabledRef.current)
                ) {
                    disableDetectorWithFallback();
                }
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
                // Authoritative consultation timer
                timerRef.current = setTimeout(() => void endRoutine(), durationSeconds * 1000);
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
            teardown();
            onError?.(message);
        }
    }, [
        status,
        tokenEndpoint,
        sessionId,
        stationId,
        handleServerEvent,
        sendEvent,
        endRoutine,
        teardown,
        startDoubleTalkDetector,
        attachPatientAnalyser,
        disableDetectorWithFallback,
        ensureDebugOverlay,
        logDebug,
        onSessionStarted,
        onError,
    ]);

    const endConsultation = useCallback(() => endRoutine(), [endRoutine]);

    // Abandon: tear down without persisting or triggering feedback.
    const disconnect = useCallback(() => {
        endedRef.current = true;
        teardown();
    }, [teardown]);

    const setMicMuted = useCallback((muted: boolean) => {
        setIsMuted(muted);
        if (micTrackRef.current) {
            micTrackRef.current.enabled = !muted;
        }
    }, []);

    // Cleanup on unmount — teardown only (no save)
    useEffect(() => {
        return () => {
            endedRef.current = true;
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
        error,
        status,
    };
}
