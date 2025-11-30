// src/lib/types.ts
export interface CapabilitiesResponse {
  capabilities: Record<string, string[]>;
}

export interface CaseReviewRequest {
  case_description: string;
  selected_capabilities: string[];
}

export interface CaseReviewResponse {
  case_title: string;
  review_content: string;
  sections: CaseReviewSection;
}

export interface CaseReviewSection {
  brief_description: string;
  capabilities: Record<string, string>;
  reflection: string;
  learning_needs: string;
}

export interface ImprovementRequest {
  original_case: string;
  improvement_prompt: string;
  selected_capabilities: string[];
}

export interface CapabilitySelectionRequest {
  case_description: string;
}

export interface CapabilitySelectionResponse {
  selected_capabilities: string[];
}

export interface ExperienceGroupRequest {
  case_description: string;
}

export interface ExperienceGroupResponse {
  experience_groups: string[];
}