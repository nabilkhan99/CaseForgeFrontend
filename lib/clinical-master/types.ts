/**
 * TypeScript interfaces for Clinical Master
 */

export interface Station {
  id: string;
  title: string;
  domain: string;
  completed: boolean;
}

export interface MockExam {
  id: string;
  name: string;
  stations: Station[];
}

export interface CandidateBrief {
  patientName: string;
  age: number;
  address?: string;
  medicalHistory: string[];
}

export interface TranscriptItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface DomainScore {
  domain: string;
  score: number;
  strengths: string[];
  improvements: string[];
}

export interface ConsultationFeedback {
  data_gathering: DomainScore;
  clinical_management: DomainScore;
  interpersonal_skills: DomainScore;
  overall_summary: string;
  key_learning_points: string[];
}

export interface WebSocketMessage {
  type: 
    | 'session_started' 
    | 'audio' 
    | 'audio_interrupted'
    | 'audio_end'
    | 'history_added' 
    | 'history_updated'
    | 'transcript_update'
    | 'transcript_delta'
    | 'consultation_ended' 
    | 'feedback_ready' 
    | 'error'
    | 'agent_start'
    | 'agent_end'
    | 'raw_model_event';
  duration_seconds?: number;
  audio?: string; // base64 PCM16 audio
  item?: {
    role: string;
    content: string;
    id?: string;
  };
  message?: string;
  feedback?: ConsultationFeedback;
}

export type ConsultationPhase = 'selection' | 'reading' | 'live' | 'processing' | 'feedback';
