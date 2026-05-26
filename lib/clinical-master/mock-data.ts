/**
 * Mock data for Clinical Master
 */

import { MockExam, CandidateBrief } from './types';

export const mockExams: MockExam[] = [
  {
    id: 'mock-01',
    name: 'Mock Exam 01',
    stations: [
      {
        id: 'station-1',
        title: '1. Chest Pain',
        domain: 'Cardiology',
        completed: false,
      },
      {
        id: 'station-2',
        title: '2. Paediatrics',
        domain: 'Paediatrics',
        completed: false,
      },
      {
        id: 'station-3',
        title: '3. Mental Health',
        domain: 'Psychiatry',
        completed: false,
      },
      {
        id: 'station-4',
        title: '4. Dermatology',
        domain: 'Dermatology',
        completed: false,
      },
      {
        id: 'station-5',
        title: '5. Ophthalmology',
        domain: 'Ophthalmology',
        completed: false,
      },
      {
        id: 'station-6',
        title: '6. Cardiology',
        domain: 'Cardiology',
        completed: false,
      },
      {
        id: 'station-7',
        title: '7. Women\'s Health',
        domain: 'Women\'s Health',
        completed: false,
      },
    ],
  },
  {
    id: 'mock-02',
    name: 'Mock Exam 02',
    stations: [],
  },
  {
    id: 'mock-03',
    name: 'Mock Exam 03',
    stations: [],
  },
];

export const candidateBriefs: Record<string, CandidateBrief> = {
  'station-1': {
    patientName: 'Sarah Jones',
    age: 45,
    address: '15 Treebank',
    medicalHistory: [
      'Normal smear three years ago.',
      'IUS in situ one year ago.',
      'Pregnancies 21 and 23 years ago.',
      'NHS Health Check two years ago: BP 122/67; BMI 25; Q risk 1.8.',
      'Patient has presented with ongoing headaches for approximately 3 weeks. Describes pain as "pressure" behind the eyes, worse in the mornings.',
      'Never smoked tobacco.',
    ],
  },
};

export const CLINICAL_MASTER_BACKEND_URL = process.env.NEXT_PUBLIC_CLINICAL_MASTER_URL || 'ws://localhost:8001';
