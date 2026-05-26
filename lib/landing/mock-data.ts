// Mock data for landing page - ready to be replaced with API calls

export interface Feature {
    icon: string;
    color: 'yellow' | 'green' | 'blue' | 'purple';
    title: string;
    description: string;
    badge?: string;
}

export interface Testimonial {
    name: string;
    role: string;
    quote: string;
    rating: number;
}

export interface Specialty {
    icon: string;
    color: string;
    name: string;
    cases: number;
    topics: string;
}

export interface DomainScore {
    name: string;
    score: number;
    color: string;
}

export interface FeedbackItem {
    type: 'success' | 'warning';
    title: string;
    description: string;
}

export const features: Feature[] = [
    {
        icon: 'schedule',
        color: 'yellow',
        title: 'Unmatched Availability',
        description: 'Practice at 2 AM or 2 PM. Unlike human roleplay partners, our AI patients are ready 24/7/365.',
    },
    {
        icon: 'shield_lock',
        color: 'green',
        title: 'Psychological Fortress',
        description: "Make mistakes safely in a judgment-free zone. Build confidence behind our walls before facing the real examiners.",
        badge: 'Zero Risk',
    },
    {
        icon: 'troubleshoot',
        color: 'blue',
        title: 'Forensic Accuracy',
        description: 'Our AI analyzes syntax and tone with microscopic precision, catching nuances human partners often miss.',
    },
    {
        icon: 'library_books',
        color: 'purple',
        title: 'Blueprint Coverage',
        description: '200+ cases mapped directly to the RCGP curriculum. We leave no clinical area uncharted.',
    },
];

export const testimonials: Testimonial[] = [
    {
        name: 'Dr. H. Ali',
        role: 'ST3',
        quote: 'The AI patients are incredibly realistic. It felt exactly like my actual exam. Passed first time!',
        rating: 5,
    },
    {
        name: 'Dr. R. Thompson',
        role: 'ST3',
        quote: "Instant feedback on my interpersonal skills was a game changer. I didn't realize I was interrupting so much.",
        rating: 5,
    },
    {
        name: "Dr. S. O'Connor",
        role: 'ST3',
        quote: 'Being able to practice at 2 AM when my kids are asleep saved my training. Essential tool.',
        rating: 5,
    },
];

export const specialties: Specialty[] = [
    { icon: 'ecg_heart', color: 'red', name: 'Cardiovascular', cases: 24, topics: 'Hypertension, Heart Failure, AF' },
    { icon: 'pulmonology', color: 'cyan', name: 'Respiratory', cases: 18, topics: 'Asthma, COPD, Infections' },
    { icon: 'female', color: 'pink', name: "Women's Health", cases: 30, topics: 'Contraception, Pregnancy, Menopause' },
    { icon: 'psychology', color: 'purple', name: 'Mental Health', cases: 22, topics: 'Depression, Anxiety, Addiction' },
    { icon: 'child_care', color: 'orange', name: 'Paediatrics', cases: 15, topics: 'Febrile Child, Rashes, Safeguarding' },
    { icon: 'medical_services', color: 'yellow', name: 'Urgent Care', cases: 28, topics: 'Sepsis, Chest Pain, Trauma' },
];

export const domainScores: DomainScore[] = [
    { name: 'Data Gathering', score: 85, color: 'blue' },
    { name: 'Clinical Management', score: 92, color: 'green' },
    { name: 'Interpersonal Skills', score: 78, color: 'yellow' },
];

export const feedbackItems: FeedbackItem[] = [
    { type: 'success', title: 'Good Safety Netting', description: 'Appropriately advised on warning signs for sepsis.' },
    { type: 'warning', title: 'Missed Cue', description: 'Patient mentioned "work stress" twice - opportunity to explore ICE.' },
];

export const heroChatMessages = [
    { role: 'doctor' as const, text: "Good morning, Sarah. I see from your notes that you've been having some abdominal pain. Can you tell me a bit more about that?" },
    { role: 'patient' as const, text: "Yes, doctor. It started about two days ago. It's mostly on my right side." },
    { role: 'doctor' as const, text: "I see. Has the pain moved at all since it started?" },
    { role: 'patient' as const, text: "It hasn't really moved, no. But I feel a bit nauseous when I try to eat anything." },
    { role: 'doctor' as const, text: "Have you been actually sick (vomiting)?" },
    { role: 'patient' as const, text: "Yes, twice yesterday. I thought it was just food poisoning initially." },
];

// Demo chat responses - structured for easy API replacement
export const demoChatResponses: Record<string, string> = {
    vision: "Now that you mention it, sometimes things look a bit blurry in the mornings...",
    blur: "Now that you mention it, sometimes things look a bit blurry in the mornings...",
    see: "Now that you mention it, sometimes things look a bit blurry in the mornings...",
    eye: "Now that you mention it, sometimes things look a bit blurry in the mornings...",
    vomit: "Yes, actually. I threw up twice yesterday. I thought it was just something I ate.",
    sick: "Yes, actually. I threw up twice yesterday. I thought it was just something I ate.",
    nausea: "Yes, actually. I threw up twice yesterday. I thought it was just something I ate.",
    throw: "Yes, actually. I threw up twice yesterday. I thought it was just something I ate.",
    pain: "The pain is throbbing, right at the front. It's like a 7 out of 10.",
    headache: "The pain is throbbing, right at the front. It's like a 7 out of 10.",
    hurt: "The pain is throbbing, right at the front. It's like a 7 out of 10.",
    history: "I've never had anything like this before. That's why I'm so worried.",
    past: "I've never had anything like this before. That's why I'm so worried.",
    before: "I've never had anything like this before. That's why I'm so worried.",
    worry: "I'm honestly terrified it might be a brain tumour or something, doctor.",
    concern: "I'm honestly terrified it might be a brain tumour or something, doctor.",
    think: "I'm honestly terrified it might be a brain tumour or something, doctor.",
    default: "I'm not exactly sure how to answer that, doctor. I just feel really unwell with these headaches.",
};

// API-ready function - replace implementation when backend is ready
export async function getChatResponse(input: string): Promise<string> {
    // In the future, this will call the actual API
    // For now, use mock responses
    const lowerInput = input.toLowerCase();

    for (const [keyword, response] of Object.entries(demoChatResponses)) {
        if (keyword !== 'default' && lowerInput.includes(keyword)) {
            return response;
        }
    }

    return demoChatResponses.default;
}
