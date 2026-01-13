// Mock data for dashboard - ready to replace with API calls

export interface UserStats {
    currentStreak: number;
    completedStations: number;
    totalStations: number;
    examCountdownDays: number;
}

export interface LastStation {
    id: string;
    title: string;
    domain: string;
    timeRemaining: number; // in seconds
    patientName: string;
}

export interface PerformanceMetrics {
    dataGathering: number;
    clinicalManagement: number;
    interpersonalSkills: number;
}

export interface BlueprintDomain {
    id: number;
    name: string;
    completed: number;
    total: number;
    percentage: number;
}

export interface UserProfile {
    name: string;
    avatar: string;
    membershipTier: string;
}

// User statistics
export const mockUserStats: UserStats = {
    currentStreak: 7,
    completedStations: 120,
    totalStations: 200,
    examCountdownDays: 24
};

// Last station in progress
export const mockLastStation: LastStation = {
    id: "station-001",
    title: "Chest Pain - 45yo Male",
    domain: "Cardiology",
    timeRemaining: 14 * 60, // 14 minutes
    patientName: "Dr. Smith"
};

// Performance across 3 SCA domains
export const mockPerformanceMetrics: PerformanceMetrics = {
    dataGathering: 85,
    clinicalManagement: 70,
    interpersonalSkills: 92
};

// 12 RCGP Blueprint domains
export const mockBlueprintDomains: BlueprintDomain[] = [
    {
        id: 1,
        name: "Patient < 19 years old",
        completed: 9,
        total: 20,
        percentage: 45
    },
    {
        id: 2,
        name: "Gender, Repro & Sexual Health",
        completed: 13,
        total: 20,
        percentage: 65
    },
    {
        id: 3,
        name: "Long-term conditions",
        completed: 8,
        total: 20,
        percentage: 40
    },
    {
        id: 4,
        name: "Older adults & Frailty",
        completed: 16,
        total: 20,
        percentage: 80
    },
    {
        id: 5,
        name: "Mental health & Addiction",
        completed: 11,
        total: 20,
        percentage: 55
    },
    {
        id: 6,
        name: "Urgent & Unscheduled care",
        completed: 6,
        total: 20,
        percentage: 30
    },
    {
        id: 7,
        name: "Health disadvantage & Vuln.",
        completed: 3,
        total: 20,
        percentage: 15
    },
    {
        id: 8,
        name: "Ethnicity, culture, diversity",
        completed: 20,
        total: 20,
        percentage: 100
    },
    {
        id: 9,
        name: "Undifferentiated disease",
        completed: 10,
        total: 20,
        percentage: 50
    },
    {
        id: 10,
        name: "Prescribing",
        completed: 14,
        total: 20,
        percentage: 70
    },
    {
        id: 11,
        name: "Investigation / Results",
        completed: 5,
        total: 20,
        percentage: 25
    },
    {
        id: 12,
        name: "Professional conversation / Professional dilemma",
        completed: 12,
        total: 20,
        percentage: 60
    }
];

// User profile data
export const mockUserProfile: UserProfile = {
    name: "Dr. Sarah Miller",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAhu-j71cdoIv5KwATgLxgTfkE_CvcXS6EkNAmRK3FdDJfUBxXPl2rokIwk6DsaXeU-oy9Qlx84qzvVq4cdHsdc71-4ei4qYB_J7hYoblQXbbWbdkM2vUIiMTWidU_9S2DuHG0iI1P3AdkAM0p1baGGQLFu9mbVDQVlAE7sxcllIeREsgniBo2bX-hfBL0Wo2siyBfx4ny6NjTkze4XxUu6ypISH0AvF1rbSBsL9XFBtHXKzGmtgYSRP6p887w3sNqSSZaOF-2OhNQX",
    membershipTier: "Pro Member"
};
