// Mock data for Station Library UI
// This file contains all the mock data needed for the Station Library feature

export interface RCGPDomain {
    id: string;
    name: string;
    subtitle: string;
    icon: string;
    color: string; // Tailwind color prefix (e.g., 'blue', 'pink', 'emerald')
    completed: number;
    total: number;
    mastered?: boolean;
}

export interface StationCase {
    id: string;
    title: string;
    status: 'completed' | 'in-progress' | 'not-started';
    score?: number;
    lastAttempted?: string;
    focus?: string;
}

export interface DomainDetail {
    domain: RCGPDomain;
    avgScore: number;
    cases: StationCase[];
}

// 12 RCGP Blueprint Domains
export const rcgpDomains: RCGPDomain[] = [
    {
        id: 'paediatrics',
        name: 'Patient < 19 years old',
        subtitle: 'Paediatrics & Adolescent Health',
        icon: 'child_care',
        color: 'blue',
        completed: 9,
        total: 20,
    },
    {
        id: 'gender-repro',
        name: 'Gender, Repro & Sexual Health',
        subtitle: "Women's Health & Gynaecology",
        icon: 'female',
        color: 'pink',
        completed: 13,
        total: 20,
    },
    {
        id: 'long-term',
        name: 'Long-term conditions',
        subtitle: 'Chronic Disease Management',
        icon: 'monitoring',
        color: 'emerald',
        completed: 8,
        total: 20,
    },
    {
        id: 'older-adults',
        name: 'Older adults & Frailty',
        subtitle: 'Geriatric Medicine',
        icon: 'elderly',
        color: 'orange',
        completed: 16,
        total: 20,
    },
    {
        id: 'mental-health',
        name: 'Mental health & Addiction',
        subtitle: 'Psychiatry & Wellbeing',
        icon: 'psychology',
        color: 'violet',
        completed: 11,
        total: 20,
    },
    {
        id: 'urgent-care',
        name: 'Urgent & Unscheduled care',
        subtitle: 'Acute & Emergency Medicine',
        icon: 'emergency',
        color: 'red',
        completed: 6,
        total: 20,
    },
    {
        id: 'health-disadvantage',
        name: 'Health disadvantage & Vuln.',
        subtitle: 'Inclusion Health',
        icon: 'handshake',
        color: 'amber',
        completed: 3,
        total: 20,
    },
    {
        id: 'ethnicity-culture',
        name: 'Ethnicity, culture, diversity',
        subtitle: 'Mastered',
        icon: 'public',
        color: 'indigo',
        completed: 20,
        total: 20,
        mastered: true,
    },
    {
        id: 'undifferentiated',
        name: 'Undifferentiated disease',
        subtitle: 'Complex Presentations',
        icon: 'question_mark',
        color: 'cyan',
        completed: 10,
        total: 20,
    },
    {
        id: 'prescribing',
        name: 'Prescribing',
        subtitle: 'Pharmacology & Therapeutics',
        icon: 'medication',
        color: 'lime',
        completed: 14,
        total: 20,
    },
    {
        id: 'investigation',
        name: 'Investigation / Results',
        subtitle: 'Diagnostics & Analysis',
        icon: 'lab_research',
        color: 'indigo',
        completed: 5,
        total: 20,
    },
];

// Paediatrics domain cases (example for detail view)
export const paediatricsCases: StationCase[] = [
    {
        id: 'acute-asthma',
        title: 'Acute Asthma - 6yo Male',
        status: 'completed',
        score: 82,
        lastAttempted: '2 days ago',
    },
    {
        id: 'nai-screening',
        title: 'Non-accidental Injury Screening',
        status: 'completed',
        score: 74,
        lastAttempted: '1 week ago',
    },
    {
        id: 'developmental-delay',
        title: 'Developmental Delay Assessment',
        status: 'in-progress',
        lastAttempted: 'Started yesterday',
    },
    {
        id: 'nocturnal-enuresis',
        title: 'Nocturnal Enuresis - 8yo Girl',
        status: 'not-started',
        focus: 'Urology focus',
    },
    {
        id: 'febrile-convulsion',
        title: 'Febrile Convulsion Follow-up',
        status: 'completed',
        score: 91,
        lastAttempted: '3 weeks ago',
    },
    {
        id: 'adolescent-acne',
        title: 'Adolescent Acne & Wellbeing',
        status: 'not-started',
        focus: 'Dermatology focus',
    },
    {
        id: 'hsp-case',
        title: 'Henoch-Schönlein Purpura Case',
        status: 'completed',
        score: 58,
        lastAttempted: '1 month ago',
    },
    {
        id: 'eczema-flare',
        title: 'Eczema Flare Management',
        status: 'in-progress',
        focus: 'Clinical Knowledge focus',
    },
];

// Function to get domain details by ID
export function getDomainById(domainId: string): RCGPDomain | undefined {
    return rcgpDomains.find((d) => d.id === domainId);
}

// Function to get cases for a domain
export function getCasesForDomain(domainId: string): StationCase[] {
    // For now, return paediatrics cases for paediatrics, empty for others
    if (domainId === 'paediatrics') {
        return paediatricsCases;
    }
    // Generate some mock cases for other domains
    return generateMockCases(domainId);
}

// Generate mock cases for any domain
function generateMockCases(domainId: string): StationCase[] {
    const domain = getDomainById(domainId);
    if (!domain) return [];

    const cases: StationCase[] = [];
    const focusAreas = ['Clinical Knowledge', 'Communication Skills', 'Examination', 'Diagnosis', 'Management'];

    for (let i = 0; i < domain.total; i++) {
        const isCompleted = i < domain.completed;
        const status = isCompleted ? 'completed' : (i === domain.completed ? 'in-progress' : 'not-started');

        cases.push({
            id: `${domainId}-case-${i + 1}`,
            title: `${domain.name} Case ${i + 1}`,
            status,
            score: isCompleted ? Math.floor(Math.random() * 30) + 60 : undefined,
            lastAttempted: isCompleted ? `${Math.floor(Math.random() * 14) + 1} days ago` : undefined,
            focus: !isCompleted ? `${focusAreas[Math.floor(Math.random() * focusAreas.length)]} focus` : undefined,
        });
    }

    return cases;
}

// Domain detail data
export function getDomainDetail(domainId: string): DomainDetail | undefined {
    const domain = getDomainById(domainId);
    if (!domain) return undefined;

    const cases = getCasesForDomain(domainId);
    const completedCases = cases.filter((c) => c.status === 'completed');
    const avgScore = completedCases.length > 0
        ? Math.round(completedCases.reduce((sum, c) => sum + (c.score || 0), 0) / completedCases.length)
        : 0;

    return {
        domain,
        avgScore,
        cases,
    };
}
