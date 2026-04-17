export interface UserStats {
    currentStreak: number;
    completedStations: number;
    totalStations: number;
    examCountdownDays: number;
}

export interface LastStation {
    id: string;
    sessionId: string;
    title: string;
    domain: string;
    timeRemaining: number;
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
