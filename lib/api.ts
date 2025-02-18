// import { CaseReviewRequest, CaseReviewResponse, ImprovementRequest, CapabilitiesResponse } from './types';

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// export const api = {
//   async getCapabilities(): Promise<CapabilitiesResponse> {
//     try {
//       console.log('Making request to:', `${API_BASE_URL}/api/capabilities`);
//       const response = await fetch(`${API_BASE_URL}/api/capabilities`, {
//         method: 'GET',
//         headers: {
//           'Accept': 'application/json',
//           'Content-Type': 'application/json',
//         },
//         credentials: 'include',
//       });

//       if (!response.ok) {
//         const errorData = await response.text();
//         console.error('Error response:', errorData);
//         throw new Error(`Failed to fetch capabilities: ${response.status} - ${errorData}`);
//       }

//       const data = await response.json();
//       return data;
//     } catch (error) {
//       console.error('API Error:', error);
//       throw error;
//     }
//   },

//   async generateReview(request: CaseReviewRequest): Promise<CaseReviewResponse> {
//     const response = await fetch(`${API_BASE_URL}/api/generate-review`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Accept': 'application/json',
//       },
//       credentials: 'include',
//       body: JSON.stringify(request),
//     });
  
//     if (!response.ok) {
//       throw new Error('Failed to generate review');
//     }
  
//     return response.json();
//   },

//   async improveReview(request: ImprovementRequest): Promise<CaseReviewResponse> {
//     const response = await fetch(`${API_BASE_URL}/api/improve-review`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Accept': 'application/json',
//       },
//       body: JSON.stringify(request),
//     });

//     if (!response.ok) {
//       throw new Error('Failed to improve review');
//     }

//     return response.json();
//   },
// };


import { CaseReviewRequest, CaseReviewResponse, ImprovementRequest, CapabilitiesResponse } from './types';

//const API_BASE_URL = 'https://caseforge2025a.azurewebsites.net/api';
const API_BASE_URL = 'https://caseforge2025a.azurewebsites.net/api';

interface SectionImprovementRequest {
  section_type: string;
  section_content: string;
  improvement_prompt: string;
  capability_name?: string;
}

export const api = {
  // async getCapabilities(): Promise<CapabilitiesResponse> {
  //   try {
  //     console.log('Fetching capabilities...');
  //     const response = await fetch(`${API_BASE_URL}/capabilities`, {
  //       method: 'GET',
  //       headers: {
  //         'Accept': 'application/json',
  //         'Content-Type': 'application/json',
  //       },
  //     });

  //     if (!response.ok) {
  //       const errorData = await response.text();
  //       console.error('Error response:', errorData);
  //       throw new Error(`Failed to fetch capabilities: ${response.status} - ${errorData}`);
  //     }

  //     const data = await response.json();
  //     return data;
  //   } catch (error) {
  //     console.error('API Error:', error);
  //     throw error;
  //   }
  // },

 

  async getCapabilities(): Promise<CapabilitiesResponse> {
      try {
        console.log('Fetching capabilities...');
        const response = await fetch(`${API_BASE_URL}/capabilities`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          // Add CORS mode
          mode: 'cors',
        });
  
        if (!response.ok) {
          const errorData = await response.text();
          console.error('Error response:', errorData);
          throw new Error(`Failed to fetch capabilities: ${response.status} - ${errorData}`);
        }
  
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('API Error:', error);
        throw error;
      }
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
};