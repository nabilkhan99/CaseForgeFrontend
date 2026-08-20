export interface UserStats {
    currentStreak: number;
    completedStations: number;
    /**
     * Distinct visible stations whose best attempt reached a passing verdict.
     * null when the pass query failed — the UI hides the figure rather than
     * claiming the user has passed nothing.
     */
    passedStations: number | null;
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
