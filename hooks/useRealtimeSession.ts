'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { TranscriptItem } from '@/lib/clinical-master/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_CLINICAL_MASTER_URL || 'http://localhost:8000';

interface UseRealtimeSessionProps {
    sessionId: string;
    stationId?: string;
    userId?: string;
    onSessionStarted?: () => void;
    onConsultationEnded?: () => void;
    onError?: (error: string) => void;
}

type SessionStatus = 'disconnected' | 'connecting' | 'connected';

export function useRealtimeSession({
    sessionId,
    stationId,
    userId,
    onSessionStarted,
    onConsultationEnded,
    onError,
}: UseRealtimeSessionProps) {
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<SessionStatus>('disconnected');
    const [isSpeaking, setIsSpeaking] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const playbackQueueRef = useRef<Float32Array[]>([]);
    const isPlayingRef = useRef(false);
    const messageCountRef = useRef(0);
    const isMutedRef = useRef(false);
    const seenItemIdsRef = useRef<Set<string>>(new Set());

    // Clean up on unmount
    useEffect(() => {
        return () => {
            cleanupAudio();
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    const cleanupAudio = useCallback(() => {
        if (workletNodeRef.current) {
            workletNodeRef.current.disconnect();
            workletNodeRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
    }, []);

    /**
     * Play PCM16 audio data received from the server.
     * Converts Int16 PCM to Float32 and schedules playback.
     */
    const playAudio = useCallback((base64Audio: string) => {
        if (!audioContextRef.current) return;

        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // PCM16 to Float32
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768;
        }

        playbackQueueRef.current.push(float32);
        drainPlaybackQueue();
    }, []);

    const drainPlaybackQueue = useCallback(() => {
        if (isPlayingRef.current || playbackQueueRef.current.length === 0) return;
        if (!audioContextRef.current) return;

        isPlayingRef.current = true;
        setIsSpeaking(true);

        const chunk = playbackQueueRef.current.shift()!;
        const buffer = audioContextRef.current.createBuffer(1, chunk.length, 24000);
        buffer.getChannelData(0).set(chunk);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
            isPlayingRef.current = false;
            if (playbackQueueRef.current.length > 0) {
                drainPlaybackQueue();
            } else {
                setIsSpeaking(false);
            }
        };
        source.start();
    }, []);

    const connect = useCallback(async () => {
        if (status === 'connecting' || status === 'connected') return;

        try {
            setStatus('connecting');
            setError(null);

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });
            mediaStreamRef.current = stream;

            // Create AudioContext for capture and playback
            const audioContext = new AudioContext({ sampleRate: 24000 });
            audioContextRef.current = audioContext;

            // Load AudioWorklet for microphone capture → PCM16
            const workletCode = `
                class PCM16Processor extends AudioWorkletProcessor {
                    process(inputs) {
                        const input = inputs[0];
                        if (input.length > 0) {
                            const float32 = input[0];
                            const int16 = new Int16Array(float32.length);
                            for (let i = 0; i < float32.length; i++) {
                                const s = Math.max(-1, Math.min(1, float32[i]));
                                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                            }
                            this.port.postMessage(int16.buffer, [int16.buffer]);
                        }
                        return true;
                    }
                }
                registerProcessor('pcm16-processor', PCM16Processor);
            `;
            const blob = new Blob([workletCode], { type: 'application/javascript' });
            const workletUrl = URL.createObjectURL(blob);
            await audioContext.audioWorklet.addModule(workletUrl);
            URL.revokeObjectURL(workletUrl);

            const source = audioContext.createMediaStreamSource(stream);
            const workletNode = new AudioWorkletNode(audioContext, 'pcm16-processor');
            workletNodeRef.current = workletNode;

            // Build WebSocket URL
            const baseUrl = BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://');
            const params = new URLSearchParams();
            if (userId) params.set('user_id', userId);
            if (stationId) params.set('station_id', stationId);
            const wsUrl = `${baseUrl}/ws/${sessionId}?${params.toString()}`;

            console.log(`[Realtime] Connecting to ${wsUrl}`);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log(`[Realtime] WebSocket connected`);
                // Connect microphone audio pipeline
                workletNode.port.onmessage = (e: MessageEvent) => {
                    if (ws.readyState === WebSocket.OPEN && !isMutedRef.current) {
                        ws.send(e.data as ArrayBuffer);
                    }
                };
                source.connect(workletNode);
                workletNode.connect(audioContext.destination);
            };

            ws.onmessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    handleServerMessage(data);
                } catch {
                    console.warn('[Realtime] Non-JSON message:', event.data);
                }
            };

            ws.onerror = (event) => {
                console.error('[Realtime] WebSocket error:', event);
                const errorMessage = 'WebSocket connection error';
                setError(errorMessage);
                onError?.(errorMessage);
            };

            ws.onclose = (event) => {
                console.log(`[Realtime] WebSocket closed: code=${event.code}`);
                setStatus('disconnected');
                cleanupAudio();
            };

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
            console.error('[Realtime] Connection error:', err);
            setError(errorMessage);
            setStatus('disconnected');
            onError?.(errorMessage);
        }
    }, [status, sessionId, stationId, userId, onError, cleanupAudio]);

    const handleServerMessage = useCallback((data: Record<string, unknown>) => {
        const type = data.type as string;

        switch (type) {
            case 'session_started':
                setStatus('connected');
                onSessionStarted?.();
                break;

            case 'audio':
                // Play audio from the AI patient
                playAudio(data.audio as string);
                break;

            case 'audio_interrupted':
                // Stop current playback
                playbackQueueRef.current = [];
                setIsSpeaking(false);
                break;

            case 'history_added': {
                const item = data.item as { id?: string; role: string; content: string };
                if (item?.content) {
                    const itemId = item.id || `msg-${Date.now()}-${messageCountRef.current++}`;
                    if (!seenItemIdsRef.current.has(itemId)) {
                        seenItemIdsRef.current.add(itemId);
                        setTranscript(prev => [...prev, {
                            id: itemId,
                            role: item.role === 'user' ? 'user' : 'assistant',
                            content: item.content,
                            timestamp: new Date().toISOString(),
                        }]);
                    }
                }
                break;
            }

            case 'transcript_update': {
                const item = data.item as { id?: string; role: string; content: string };
                if (item?.content) {
                    setTranscript(prev => {
                        // Try to update an existing item of the same role (whisper-1 result)
                        const lastIdx = prev.length - 1;
                        if (lastIdx >= 0 && prev[lastIdx].role === (item.role === 'user' ? 'user' : 'assistant')) {
                            const updated = [...prev];
                            updated[lastIdx] = { ...updated[lastIdx], content: item.content };
                            return updated;
                        }
                        // Fallback: add as new
                        return [...prev, {
                            id: item.id || `msg-${Date.now()}-${messageCountRef.current++}`,
                            role: item.role === 'user' ? 'user' : 'assistant',
                            content: item.content,
                            timestamp: new Date().toISOString(),
                        }];
                    });
                }
                break;
            }

            case 'transcript_delta':
                // Streaming delta — could be used for live typing indicator
                // For now, we rely on history_added for final transcripts
                break;

            case 'consultation_ended':
                onConsultationEnded?.();
                break;

            case 'feedback_ready':
                // Feedback arrived via WebSocket — could be used for instant display
                console.log('[Realtime] Feedback ready via WebSocket');
                break;

            case 'error': {
                const errorMessage = (data.message as string) || 'Server error';
                setError(errorMessage);
                onError?.(errorMessage);
                break;
            }

            default:
                console.log(`[Realtime] Unhandled event: ${type}`);
        }
    }, [onSessionStarted, onConsultationEnded, onError, playAudio]);

    const endConsultation = useCallback(async () => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'end_consultation' }));
        }
        cleanupAudio();
    }, [cleanupAudio]);

    const setMicMuted = useCallback((muted: boolean) => {
        isMutedRef.current = muted;
    }, []);

    return {
        isConnected: status === 'connected',
        isSpeaking,
        transcript,
        connect,
        endConsultation,
        setMicMuted,
        error,
        status,
    };
}
