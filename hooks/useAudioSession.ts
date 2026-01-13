'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TranscriptItem, WebSocketMessage } from '@/lib/clinical-master/types';
import { CLINICAL_MASTER_BACKEND_URL } from '@/lib/clinical-master/mock-data';

interface UseAudioSessionOptions {
  sessionId: string;
  onSessionStarted?: (durationSeconds: number) => void;
  onConsultationEnded?: () => void;
  onFeedbackReady?: (feedback: any) => void;
  onError?: (error: string) => void;
}

interface UseAudioSessionResult {
  isConnected: boolean;
  isRecording: boolean;
  transcript: TranscriptItem[];
  connect: () => void;
  disconnect: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  endConsultation: () => void;
  error: string | null;
}

export function useAudioSession({
  sessionId,
  onSessionStarted,
  onConsultationEnded,
  onFeedbackReady,
  onError,
}: UseAudioSessionOptions): UseAudioSessionResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  // Initialize playback audio context
  useEffect(() => {
    playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
    return () => {
      if (playbackContextRef.current) {
        playbackContextRef.current.close();
        playbackContextRef.current = null;
      }
    };
  }, []);

  // Function to play PCM audio using Web Audio API
  const playPCMAudio = useCallback((base64Audio: string) => {
    if (!playbackContextRef.current) return;

    try {
      // Decode base64 to binary
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert bytes to Int16Array (PCM16 format)
      const int16Data = new Int16Array(bytes.buffer);

      // Convert Int16 to Float32 for Web Audio API
      const float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }

      // Queue the audio
      audioQueueRef.current.push(float32Data);

      // Play if not already playing
      if (!isPlayingRef.current) {
        playNextChunk();
      }
    } catch (err) {
      console.error('Error playing PCM audio:', err);
    }
  }, []);

  const playNextChunk = useCallback(() => {
    if (!playbackContextRef.current || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift()!;

    // Create audio buffer
    const audioBuffer = playbackContextRef.current.createBuffer(1, audioData.length, 24000);
    audioBuffer.getChannelData(0).set(audioData);

    // Create source and play
    const source = playbackContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackContextRef.current.destination);
    source.onended = () => {
      playNextChunk();
    };
    source.start();
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      const wsUrl = CLINICAL_MASTER_BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://');
      const ws = new WebSocket(`${wsUrl}/ws/${sessionId}`);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('Received message:', message.type);

          switch (message.type) {
            case 'session_started':
              if (message.duration_seconds) {
                onSessionStarted?.(message.duration_seconds);
              }
              break;

            case 'audio':
              if (message.audio) {
                // Play PCM16 audio using Web Audio API
                playPCMAudio(message.audio);
              }
              break;

            case 'audio_interrupted':
              // Clear audio queue when interrupted
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              break;

            case 'audio_end':
              // Audio streaming complete - queue will drain naturally
              break;

            case 'history_added':
              if (message.item && message.item.content) {
                const newItem: TranscriptItem = {
                  role: message.item.role as 'user' | 'assistant',
                  content: message.item.content,
                  timestamp: new Date().toISOString(),
                };
                setTranscript((prev) => [...prev, newItem]);
              }
              break;

            case 'history_updated':
              // Content was updated (e.g., transcription completed)
              if (message.item && message.item.content) {
                const updatedItem: TranscriptItem = {
                  role: message.item.role as 'user' | 'assistant',
                  content: message.item.content,
                  timestamp: new Date().toISOString(),
                };
                setTranscript((prev) => [...prev, updatedItem]);
              }
              break;

            case 'transcript_update':
              // Direct transcript from transcription events
              if (message.item && message.item.content) {
                console.log('Transcript update:', message.item.role, message.item.content);
                const transcriptItem: TranscriptItem = {
                  role: message.item.role as 'user' | 'assistant',
                  content: message.item.content,
                  timestamp: new Date().toISOString(),
                };
                setTranscript((prev) => [...prev, transcriptItem]);
              }
              break;

            case 'transcript_delta':
              // Real-time streaming of assistant response text
              if (message.item && message.item.content) {
                // Append to last assistant message or create new one
                setTranscript((prev) => {
                  const lastItem = prev[prev.length - 1];
                  if (lastItem && lastItem.role === 'assistant' && 
                      Date.now() - new Date(lastItem.timestamp).getTime() < 5000) {
                    // Append to existing message if recent
                    return [
                      ...prev.slice(0, -1),
                      { ...lastItem, content: lastItem.content + message.item!.content }
                    ];
                  } else {
                    // Create new message
                    return [...prev, {
                      role: 'assistant' as const,
                      content: message.item!.content,
                      timestamp: new Date().toISOString(),
                    }];
                  }
                });
              }
              break;

            case 'consultation_ended':
              onConsultationEnded?.();
              break;

            case 'feedback_ready':
              if (message.feedback) {
                onFeedbackReady?.(message.feedback);
              }
              break;

            case 'error':
              const errorMsg = message.message || 'Unknown error';
              setError(errorMsg);
              onError?.(errorMsg);
              break;
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error');
        onError?.('Connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Error connecting WebSocket:', err);
      setError('Failed to connect');
      onError?.('Failed to connect');
    }
  }, [sessionId, onSessionStarted, onConsultationEnded, onFeedbackReady, onError, playPCMAudio]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
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

      // Create audio context
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      // Create a script processor for audio capture
      // Note: ScriptProcessorNode is deprecated but AudioWorklet requires more setup
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Send as array for JSON serialization
        const audioArray = Array.from(int16Data);
        
        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'audio',
              data: audioArray,
            })
          );
        } catch (err) {
          console.error('Error sending audio:', err);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      audioWorkletNodeRef.current = processor as any;
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to access microphone');
      onError?.('Failed to access microphone');
    }
  }, [onError]);

  const stopRecording = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsRecording(false);
  }, []);

  const endConsultation = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'end_consultation',
        })
      );
    }
    stopRecording();
  }, [stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      disconnect();
    };
  }, [stopRecording, disconnect]);

  return {
    isConnected,
    isRecording,
    transcript,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    endConsultation,
    error,
  };
}
