'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import {
    Room,
    RoomEvent,
    Track,
    Participant,
    RemoteTrack,
    RemoteTrackPublication,
    ConnectionState,
    TranscriptionSegment,
} from 'livekit-client';
import { TranscriptItem } from '@/lib/clinical-master/types';

interface UseLiveKitSessionProps {
    sessionId: string;
    stationId?: string;
    userId?: string;
    tokenEndpoint?: string; // Custom token API endpoint (default: '/api/livekit-token')
    onSessionStarted?: () => void;
    onConsultationEnded?: () => void;
    onError?: (error: string) => void;
}

type SessionStatus = 'disconnected' | 'connecting' | 'connected';

/**
 * Hook that connects to a LiveKit room for real-time voice consultation.
 *
 * Replaces useRealtimeSession.ts — LiveKit handles all audio transport,
 * echo cancellation, and track management. We just need to:
 *   1. Fetch a token from our API route
 *   2. Connect to the room
 *   3. Listen for transcription events
 */
export function useLiveKitSession({
    sessionId,
    stationId,
    userId,
    tokenEndpoint = '/api/livekit-token',
    onSessionStarted,
    onConsultationEnded,
    onError,
}: UseLiveKitSessionProps) {
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<SessionStatus>('disconnected');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    const roomRef = useRef<Room | null>(null);
    const messageCountRef = useRef(0);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            roomRef.current?.disconnect();
            roomRef.current = null;
        };
    }, []);

    const connect = useCallback(async () => {
        if (status === 'connecting' || status === 'connected') return;

        try {
            setStatus('connecting');
            setError(null);

            // 1. Fetch token from our API route (supports custom endpoint for guest flow)
            const res = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, stationId, userId }),
            });

            if (!res.ok) {
                throw new Error(`Token request failed: ${res.statusText}`);
            }

            const { token, serverUrl } = await res.json();

            // 2. Create and connect to the room
            const room = new Room({
                audioCaptureDefaults: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            roomRef.current = room;

            // -- Event listeners --

            // Connection state
            room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
                if (state === ConnectionState.Connected) {
                    setStatus('connected');
                    onSessionStarted?.();
                } else if (state === ConnectionState.Disconnected) {
                    setStatus('disconnected');
                }
            });

            // Agent speaking state (track activity)
            room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
                // Agent is speaking if any remote participant is active
                const agentSpeaking = speakers.some(
                    (s) => s.identity !== room.localParticipant.identity
                );
                setIsSpeaking(agentSpeaking);
            });

            // Transcription events — both user and agent
            room.on(
                RoomEvent.TranscriptionReceived,
                (segments: TranscriptionSegment[], participant) => {
                    for (const segment of segments) {
                        if (!segment.final) continue; // skip interim results

                        const role = participant?.identity === room.localParticipant.identity
                            ? 'user'
                            : 'assistant';

                        setTranscript((prev) => [
                            ...prev,
                            {
                                id: segment.id || `msg-${Date.now()}-${messageCountRef.current++}`,
                                role: role as 'user' | 'assistant',
                                content: segment.text,
                                timestamp: new Date().toISOString(),
                            },
                        ]);
                    }
                }
            );

            // Room disconnected
            room.on(RoomEvent.Disconnected, () => {
                // Clean up any orphaned audio elements
                document.querySelectorAll('audio[data-livekit-track]').forEach(el => el.remove());
                setStatus('disconnected');
                setIsSpeaking(false);
                onConsultationEnded?.();
            });

            // Errors
            room.on(RoomEvent.MediaDevicesError, (e: Error) => {
                const msg = `Media device error: ${e.message}`;
                setError(msg);
                onError?.(msg);
            });

            // Play remote audio tracks (agent's TTS output)
            room.on(
                RoomEvent.TrackSubscribed,
                (track: RemoteTrack, publication: RemoteTrackPublication, participant: Participant) => {
                    if (track.kind === Track.Kind.Audio) {
                        const audioEl = track.attach();
                        audioEl.dataset.livekitTrack = publication.trackSid;
                        document.body.appendChild(audioEl);
                    }
                }
            );

            room.on(
                RoomEvent.TrackUnsubscribed,
                (track: RemoteTrack) => {
                    if (track.kind === Track.Kind.Audio) {
                        track.detach().forEach((el) => el.remove());
                    }
                }
            );

            // 3. Connect with audio enabled
            await room.connect(serverUrl, token);
            await room.localParticipant.setMicrophoneEnabled(true);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
            setError(errorMessage);
            setStatus('disconnected');
            onError?.(errorMessage);
        }
    }, [status, sessionId, stationId, userId, tokenEndpoint, onSessionStarted, onConsultationEnded, onError]);

    const endConsultation = useCallback(async () => {
        const room = roomRef.current;
        if (room) {
            await room.disconnect();
            roomRef.current = null;
        }
    }, []);

    const setMicMuted = useCallback((muted: boolean) => {
        setIsMuted(muted);
        const room = roomRef.current;
        if (room) {
            room.localParticipant.setMicrophoneEnabled(!muted);
        }
    }, []);

    return {
        isConnected: status === 'connected',
        isSpeaking,
        isMuted,
        transcript,
        connect,
        endConsultation,
        setMicMuted,
        error,
        status,
    };
}
