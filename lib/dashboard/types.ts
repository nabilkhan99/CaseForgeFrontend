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
    /**
     * Whole days until the exam, floored at 0.
     *
     * 0 therefore means two different things — no date set, and a date already
     * past — which is why `examDate` comes back alongside it: the dashboard
     * offers to collect a date in the first case and must not in the second
     * while the countdown itself stays a single number.
     */
    examCountdownDays: number;
    /** `profiles.exam_date` as stored, or null when the trainee hasn't given one. */
    examDate: string | null;
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
