'use client';

import { useCallback, useState, useRef } from 'react';
import { useConversation } from '@elevenlabs/react';
import { TranscriptItem } from '@/lib/clinical-master/types';

const ELEVENLABS_AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '';

interface UseElevenLabsSessionProps {
    sessionId: string;
    stationId?: string;
    stationData?: {
        patient_name: string;
        patient_age: number;
        station_script: string;
        title: string;
    };
    onSessionStarted?: () => void;
    onConsultationEnded?: () => void;
    onError?: (error: string) => void;
}

export function useElevenLabsSession({
    sessionId,
    stationData,
    onSessionStarted,
    onConsultationEnded,
    onError,
}: UseElevenLabsSessionProps) {
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const messageCountRef = useRef(0);

    const conversation = useConversation({
        onConnect: () => {
            console.log(`[ElevenLabs] Connected for session ${sessionId}`);
            onSessionStarted?.();
        },
        onDisconnect: () => {
            console.log(`[ElevenLabs] Disconnected for session ${sessionId}`);
            onConsultationEnded?.();
        },
        onMessage: (message) => {
            // Handle incoming transcript messages from the agent
            const newItem: TranscriptItem = {
                id: `msg-${Date.now()}-${messageCountRef.current++}`,
                role: message.source === 'user' ? 'user' : 'assistant',
                content: message.message,
                timestamp: new Date().toISOString(),
            };

            setTranscript((prev) => [...prev, newItem]);
        },
        onError: (err) => {
            const errorMessage = typeof err === 'string' ? err : 'Connection error';
            console.error(`[ElevenLabs] Error:`, err);
            setError(errorMessage);
            onError?.(errorMessage);
        },
    });

    const connect = useCallback(async () => {
        if (!stationData) {
            setError('Station data not loaded');
            return;
        }

        try {
            setError(null);

            // Request microphone access
            await navigator.mediaDevices.getUserMedia({ audio: true });

            // Start ElevenLabs conversation with dynamic variables
            const convId = await conversation.startSession({
                agentId: ELEVENLABS_AGENT_ID,
                connectionType: 'websocket',
                dynamicVariables: {
                    patient_name: stationData.patient_name,
                    patient_age: String(stationData.patient_age),
                    station_script: stationData.station_script || 'No specific script provided. Act as a cooperative patient.',
                },
            });

            if (convId) {
                setConversationId(convId);
                console.log(`[ElevenLabs] Started conversation: ${convId}`);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
            console.error(`[ElevenLabs] Connection error:`, err);
            setError(errorMessage);
            onError?.(errorMessage);
        }
    }, [conversation, stationData, onError, sessionId]);

    const endConsultation = useCallback(async () => {
        try {
            await conversation.endSession();
        } catch (err) {
            console.error(`[ElevenLabs] Error ending session:`, err);
        }
    }, [conversation]);

    const setMicMuted = useCallback(
        (muted: boolean) => {
            conversation.setVolume({ volume: muted ? 0 : 1 });
        },
        [conversation]
    );

    return {
        isConnected: conversation.status === 'connected',
        isSpeaking: conversation.isSpeaking,
        transcript,
        conversationId,
        connect,
        endConsultation,
        setMicMuted,
        error,
        status: conversation.status,
    };
}
