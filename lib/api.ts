import { CaseReviewRequest, CaseReviewResponse, ImprovementRequest, CapabilitiesResponse, CapabilitySelectionRequest, CapabilitySelectionResponse, ExperienceGroupRequest, ExperienceGroupResponse } from './types';

const API_BASE_URL = 'https://caseforge2025a.azurewebsites.net/api';

interface SectionImprovementRequest {
  section_type: string;
  section_content: string;
  improvement_prompt: string;
  capability_name?: string;
}

export const api = {
  async getCapabilities(): Promise<CapabilitiesResponse> {
    const response = await fetch(`${API_BASE_URL}/capabilities`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      mode: 'cors',
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to fetch capabilities: ${response.status} - ${errorData}`);
    }

    return response.json();
  },

  async generateReview(request: CaseReviewRequest): Promise<CaseReviewResponse> {
    const response = await fetch(`${API_BASE_URL}/generate-review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to generate review');
    }

    return response.json();
  },

  async improveReview(request: ImprovementRequest): Promise<CaseReviewResponse> {
    const response = await fetch(`${API_BASE_URL}/improve-review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to improve review');
    }

    return response.json();
  },

  async improveSection(request: SectionImprovementRequest): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/improve-section`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to improve section');
    }

    const data = await response.json();
    return data.improved_content;
  },

  async selectCapabilities(request: CapabilitySelectionRequest): Promise<CapabilitySelectionResponse> {
    const response = await fetch(`${API_BASE_URL}/select-capabilities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to select capabilities');
    }

    return response.json();
  },

  async selectExperienceGroups(request: ExperienceGroupRequest): Promise<ExperienceGroupResponse> {
    const response = await fetch(`${API_BASE_URL}/select-experience-groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to select experience groups');
    }

    return response.json();
  },
};
