/**
 * Dashboard data queries for Supabase
 * 
 * Functions to fetch real user data from the database:
 * - User stats (streak, completed stations, exam countdown)
 * - Performance metrics (domain scores)
 * - Blueprint domain progress
 * - Last/recent sessions
 */

import { createClient } from '@/lib/supabase/client';
import type {
    UserStats,
    PerformanceMetrics,
    BlueprintDomain,
    LastStation,
} from '@/lib/dashboard/mock-data';

/**
 * Fetch user stats: streak, completed stations count, exam countdown
 */
export async function getUserStats(userId: string): Promise<UserStats> {
    const supabase = createClient();

    // Fetch profile for streak and exam date
    const { data: profile } = await supabase
        .from('profiles')
        .select('exam_date, current_streak')
        .eq('id', userId)
        .single();

    // Count completed sessions
    const { count: completedCount } = await supabase
        .from('clinical_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed');

    // Count total active stations
    const { count: totalStations } = await supabase
        .from('stations')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

    // Calculate exam countdown
    let examCountdownDays = 0;
    if (profile?.exam_date) {
        const examDate = new Date(profile.exam_date);
        const today = new Date();
        const diffTime = examDate.getTime() - today.getTime();
        examCountdownDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return {
        currentStreak: profile?.current_streak ?? 0,
        completedStations: completedCount ?? 0,
        totalStations: totalStations ?? 0,
        examCountdownDays,
    };
}

/**
 * Fetch performance metrics: average scores across all completed sessions
 */
export async function getPerformanceMetrics(userId: string): Promise<PerformanceMetrics> {
    const supabase = createClient();

    // Get all session results for this user
    const { data: sessions } = await supabase
        .from('clinical_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'completed');

    if (!sessions || sessions.length === 0) {
        return {
            dataGathering: 0,
            clinicalManagement: 0,
            interpersonalSkills: 0,
        };
    }

    const sessionIds = sessions.map(s => s.id);

    const { data: results } = await supabase
        .from('session_results')
        .select('data_gathering_score, clinical_management_score, interpersonal_skills_score')
        .in('session_id', sessionIds);

    if (!results || results.length === 0) {
        return {
            dataGathering: 0,
            clinicalManagement: 0,
            interpersonalSkills: 0,
        };
    }

    // Calculate averages
    const avg = (arr: (number | null)[]) => {
        const valid = arr.filter((n): n is number => n !== null);
        return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0;
    };

    return {
        dataGathering: avg(results.map(r => r.data_gathering_score)),
        clinicalManagement: avg(results.map(r => r.clinical_management_score)),
        interpersonalSkills: avg(results.map(r => r.interpersonal_skills_score)),
    };
}

/**
 * Fetch blueprint domain progress
 */
export async function getBlueprintDomains(userId: string): Promise<BlueprintDomain[]> {
    const supabase = createClient();

    // Get all domains
    const { data: domains } = await supabase
        .from('domains')
        .select('id, name, display_order')
        .order('display_order', { ascending: true });

    if (!domains || domains.length === 0) {
        return [];
    }

    // Get total stations per domain
    const { data: stationCounts } = await supabase
        .from('stations')
        .select('domain_id')
        .eq('is_active', true);

    const countByDomain: Record<string, number> = {};
    stationCounts?.forEach(s => {
        if (s.domain_id) {
            countByDomain[s.domain_id] = (countByDomain[s.domain_id] || 0) + 1;
        }
    });

    // Get completed sessions with scores, joined to stations to get domain_id
    const { data: completedSessions } = await supabase
        .from('clinical_sessions')
        .select('overall_score, stations!inner(domain_id)')
        .eq('user_id', userId)
        .eq('status', 'completed');

    // Compute per-domain: completed count + average score
    const domainStats: Record<string, { completed: number; totalScore: number }> = {};
    completedSessions?.forEach(s => {
        const station = s.stations as unknown as { domain_id: string } | null;
        const domainId = station?.domain_id;
        if (!domainId) return;
        if (!domainStats[domainId]) {
            domainStats[domainId] = { completed: 0, totalScore: 0 };
        }
        domainStats[domainId].completed += 1;
        domainStats[domainId].totalScore += s.overall_score ?? 0;
    });

    return domains.map((domain, index) => {
        const stats = domainStats[domain.id] || { completed: 0, totalScore: 0 };
        const total = countByDomain[domain.id] || 0;
        const percentage = stats.completed > 0
            ? Math.round(stats.totalScore / stats.completed)
            : 0;

        return {
            id: index + 1,
            name: domain.name,
            completed: stats.completed,
            total,
            percentage,
        };
    });
}

/**
 * Fetch the user's last/most recent session (for resume card)
 */
export async function getLastStation(userId: string): Promise<LastStation | null> {
    const supabase = createClient();

    // Get most recent session that's not completed
    const { data: session } = await supabase
        .from('clinical_sessions')
        .select(`
            id,
            status,
            started_at,
            stations (
                id,
                title,
                patient_name,
                consultation_duration_seconds,
                domains (name)
            )
        `)
        .eq('user_id', userId)
        .neq('status', 'completed')
        .neq('status', 'abandoned')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

    if (!session || !session.stations) {
        return null;
    }

    const station = session.stations as unknown as {
        id: string;
        title: string;
        patient_name: string;
        consultation_duration_seconds: number;
        domains: { name: string } | null;
    } | null;

    if (!station) {
        return null;
    }

    return {
        id: station.id,
        sessionId: session.id,
        title: station.title,
        domain: station.domains?.name || 'General Practice',
        timeRemaining: station.consultation_duration_seconds || 300,
        patientName: station.patient_name,
    };
}

/**
 * Fetch session history for the history page
 */
export interface SessionHistoryItem {
    id: string;
    stationId: string;
    stationTitle: string;
    domainName: string;
    completedAt: string;
    overallScore: number;
    passed: boolean;
    dataGatheringScore: number;
    clinicalManagementScore: number;
    interpersonalSkillsScore: number;
}

export async function getSessionHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
): Promise<SessionHistoryItem[]> {
    const supabase = createClient();

    const { data: sessions } = await supabase
        .from('clinical_sessions')
        .select(`
            id,
            completed_at,
            stations (
                id,
                title,
                domains (name)
            ),
            session_results (
                overall_score,
                passed,
                data_gathering_score,
                clinical_management_score,
                interpersonal_skills_score
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (!sessions) return [];

    return sessions.map(session => {
        const station = session.stations as unknown as {
            id: string;
            title: string;
            domains: { name: string } | null;
        } | null;

        // session_results is a single object (not an array) due to unique constraint on session_id
        const result = session.session_results as unknown as {
            overall_score: number;
            passed: boolean;
            data_gathering_score: number;
            clinical_management_score: number;
            interpersonal_skills_score: number;
        } | null;

        return {
            id: session.id,
            stationId: station?.id || '',
            stationTitle: station?.title || 'Unknown Station',
            domainName: station?.domains?.name || 'General Practice',
            completedAt: session.completed_at || '',
            overallScore: result?.overall_score ?? 0,
            passed: result?.passed ?? false,
            dataGatheringScore: result?.data_gathering_score ?? 0,
            clinicalManagementScore: result?.clinical_management_score ?? 0,
            interpersonalSkillsScore: result?.interpersonal_skills_score ?? 0,
        };
    });
}

/**
 * Update user's login streak (call on dashboard load)
 */
export async function updateLoginStreak(userId: string): Promise<void> {
    const supabase = createClient();

    const { data: profile } = await supabase
        .from('profiles')
        .select('last_login_date, current_streak')
        .eq('id', userId)
        .single();

    if (!profile) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastLogin = profile.last_login_date;

    if (lastLogin === today) {
        // Already logged in today
        return;
    }

    let newStreak = 1;
    if (lastLogin) {
        const lastDate = new Date(lastLogin);
        const todayDate = new Date(today);
        const diffDays = Math.floor(
            (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
            // Consecutive day
            newStreak = (profile.current_streak || 0) + 1;
        }
        // If diffDays > 1, streak resets to 1
    }

    await supabase
        .from('profiles')
        .update({
            last_login_date: today,
            current_streak: newStreak,
        })
        .eq('id', userId);
}
