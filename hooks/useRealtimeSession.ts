'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TranscriptItem } from '@/lib/clinical-master/types';

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
    const endedRef = useRef(false);
    const transcriptRef = useRef<TranscriptItem[]>([]);
    const messageCountRef = useRef(0);
    const sessionStartRef = useRef<number>(0);
    const vadRef = useRef<Record<string, { start_ms?: number; end_ms?: number }>>({});

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

    const sendEvent = useCallback((event: Record<string, unknown>) => {
        const dc = dcRef.current;
        if (dc && dc.readyState === 'open') {
            dc.send(JSON.stringify(event));
        }
    }, []);

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
            audioElRef.current.srcObject = null;
            audioElRef.current.remove();
            audioElRef.current = null;
        }
        setIsSpeaking(false);
        setStatus('disconnected');
    }, []);

    // Graceful end: persist transcript, move session to 'processing', then notify.
    const endRoutine = useCallback(async () => {
        if (endedRef.current) return;
        endedRef.current = true;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        try {
            await fetch(saveEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, transcript: transcriptRef.current }),
            });
        } catch {
            /* best-effort — feedback route also tolerates retries */
        }
        teardown();
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
                case 'output_audio_buffer.started':
                    setIsSpeaking(true);
                    break;
                case 'output_audio_buffer.stopped':
                case 'output_audio_buffer.cleared':
                    setIsSpeaking(false);
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
                    setError(message);
                    onError?.(message);
                    break;
                }
                default:
                    break;
            }
        },
        [appendTurn, relNow, handleFunctionCall, onError]
    );

    const connect = useCallback(async () => {
        if (endedRef.current || status === 'connecting' || status === 'connected') return;
        try {
            setStatus('connecting');
            setError(null);
            endedRef.current = false;

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

            // 3. Peer connection
            const pc = new RTCPeerConnection();
            pcRef.current = pc;

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
