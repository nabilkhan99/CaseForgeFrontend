/**
 * TypeScript interfaces for Clinical Master
 */

export interface TranscriptItem {
  id?: string;
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
  overall_score?: number;
  station_title?: string;
}
