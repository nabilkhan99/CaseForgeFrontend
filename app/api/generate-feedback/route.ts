import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Gemini structured output prompt (ported from Python feedback.py) ──

const FEEDBACK_PROMPT = `
You are an experienced RCGP SCA examiner providing constructive feedback on a GP trainee's consultation.

# Your Role
Analyze the consultation transcript and provide balanced, specific feedback that will help the trainee improve.
Use the case-specific marking criteria provided in the input to assess the trainee's performance accurately.

# Assessment Domains

## 1. Data Gathering (History Taking)
- Systematic questioning
- Identification of presenting complaint
- Exploration of red flag symptoms
- Past medical history, medications, allergies
- Social and family history
- ICE (Ideas, Concerns, Expectations)
- **Use the case-specific Data Gathering criteria if provided**

## 2. Clinical Management
- Appropriate differential diagnosis
- Justified investigations
- Clear management plan
- Safety-netting advice
- Follow-up arrangements
- Appropriate referral decisions
- **Use the case-specific Clinical Management criteria if provided**

## 3. Interpersonal Skills
- Rapport building
- Active listening
- Empathy and reassurance
- Clear explanations
- Shared decision-making
- Professional manner
- **Use the case-specific Interpersonal Skills criteria if provided**

# Scoring Guidelines
- 80-100: Excellent - comprehensive, thorough, no significant omissions
- 60-79: Good - most key areas covered with minor gaps
- 40-59: Adequate - some important areas missed
- 20-39: Needs improvement - significant gaps
- 0-19: Poor - major omissions, unsafe practice

# Important
- Score against the CASE-SPECIFIC marking criteria when provided — these define what the trainee should have done
- Be specific with feedback - reference what was actually said
- Balance criticism with recognition of what was done well
- Focus on actionable improvements
- Keep learning points practical and memorable
- Use the clinical learning points (if provided) to inform key takeaways

# Output Format
You MUST respond with a single JSON object with these exact fields:
- data_gathering: { domain: string, score: number (0-100), strengths: string[], improvements: string[] }
- clinical_management: { domain: string, score: number (0-100), strengths: string[], improvements: string[] }
- interpersonal_skills: { domain: string, score: number (0-100), strengths: string[], improvements: string[] }
- overall_summary: string
- key_learning_points: string[]
`;

// ── Supabase admin client (server-side only) ──

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

// ── Gemini REST API call ──

interface GeminiFeedback {
    data_gathering: { domain: string; score: number; strengths: string[]; improvements: string[] };
    clinical_management: { domain: string; score: number; strengths: string[]; improvements: string[] };
    interpersonal_skills: { domain: string; score: number; strengths: string[]; improvements: string[] };
    overall_summary: string;
    key_learning_points: string[];
}

async function callGemini(prompt: string): Promise<GeminiFeedback> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

    const model = process.env.GEMINI_FEEDBACK_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');

    return JSON.parse(text) as GeminiFeedback;
}

// ── Helpers (ported from Python agent.py) ──

function buildCaseBrief(station: Record<string, unknown> | null): string {
    if (station) {
        return `${station.patient_name || 'Unknown'}, ${station.patient_age || 'Unknown'}-year-old. ${station.candidate_instructions || ''}`;
    }
    return "Clinical consultation case. Assess the candidate's data gathering, clinical management, and interpersonal skills.";
}

function buildMarkingCriteria(station: Record<string, unknown> | null): string | null {
    if (!station) return null;
    const sections: string[] = [];
    if (station.data_gathering) sections.push(`## Data Gathering Criteria\n${station.data_gathering}`);
    if (station.clinical_management) sections.push(`## Clinical Management Criteria\n${station.clinical_management}`);
    if (station.relating_to_others) sections.push(`## Interpersonal Skills Criteria\n${station.relating_to_others}`);
    return sections.length ? sections.join('\n\n') : null;
}

// ── API Route Handler ──

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const { sessionId } = await request.json();
        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // 1. Check if feedback already exists (idempotent)
        const { data: existingResults } = await supabase
            .from('session_results')
            .select('*')
            .eq('session_id', sessionId)
            .maybeSingle();

        if (existingResults) {
            // Feedback already generated — return it
            const { data: session } = await supabase
                .from('clinical_sessions')
                .select('overall_score, station_id, stations(title)')
                .eq('id', sessionId)
                .single();

            return NextResponse.json({
                status: 'ready',
                feedback: {
                    data_gathering: {
                        domain: 'Data Gathering',
                        score: existingResults.data_gathering_score || 0,
                        strengths: existingResults.data_gathering_feedback?.strengths || [],
                        improvements: existingResults.data_gathering_feedback?.improvements || [],
                    },
                    clinical_management: {
                        domain: 'Clinical Management',
                        score: existingResults.clinical_management_score || 0,
                        strengths: existingResults.clinical_management_feedback?.strengths || [],
                        improvements: existingResults.clinical_management_feedback?.improvements || [],
                    },
                    interpersonal_skills: {
                        domain: 'Interpersonal Skills',
                        score: existingResults.interpersonal_skills_score || 0,
                        strengths: existingResults.interpersonal_skills_feedback?.strengths || [],
                        improvements: existingResults.interpersonal_skills_feedback?.improvements || [],
                    },
                    overall_summary: existingResults.overall_summary || '',
                    key_learning_points: existingResults.key_learning_points || [],
                    overall_score: session?.overall_score || 0,
                    station_title: (session?.stations as { title?: string } | null)?.title || 'Station Feedback',
                },
            });
        }

        // 2. Load session + transcript
        const { data: session, error: sessionError } = await supabase
            .from('clinical_sessions')
            .select('*, stations(*)')
            .eq('id', sessionId)
            .single();

        if (sessionError || !session) {
            console.error('Session lookup failed:', { sessionId, error: sessionError?.message, code: sessionError?.code });
            return NextResponse.json({ error: 'Session not found', details: sessionError?.message }, { status: 404 });
        }

        if (!session.transcript || session.transcript.length === 0) {
            return NextResponse.json({ error: 'No transcript available yet' }, { status: 404 });
        }

        // 3. Build prompt
        const station = session.stations as Record<string, unknown> | null;
        const caseBrief = buildCaseBrief(station);
        const markingCriteria = buildMarkingCriteria(station);

        const transcriptText = (session.transcript as { timestamp?: string; role?: string; content?: string }[])
            .filter((t) => t.content)
            .map((t) => `[${t.timestamp || 'N/A'}] ${(t.role || 'Unknown').toUpperCase()}: ${t.content}`)
            .join('\n');

        const criteriaSection = markingCriteria ? `\n# Case-Specific Marking Criteria\n${markingCriteria}\n` : '';

        const fullPrompt = `${FEEDBACK_PROMPT}\n\n# Case Context\n${caseBrief}\n${criteriaSection}\n# Consultation Transcript\n${transcriptText}\n\nPlease analyze this consultation and provide structured feedback as JSON.`;

        // 4. Call Gemini
        const feedback = await callGemini(fullPrompt);

        // 5. Save to session_results
        const overallScore = Math.round(
            (feedback.data_gathering.score + feedback.clinical_management.score + feedback.interpersonal_skills.score) / 3
        );

        await supabase.from('session_results').insert({
            session_id: sessionId,
            data_gathering_score: feedback.data_gathering.score,
            clinical_management_score: feedback.clinical_management.score,
            interpersonal_skills_score: feedback.interpersonal_skills.score,
            data_gathering_feedback: {
                strengths: feedback.data_gathering.strengths,
                improvements: feedback.data_gathering.improvements,
            },
            clinical_management_feedback: {
                strengths: feedback.clinical_management.strengths,
                improvements: feedback.clinical_management.improvements,
            },
            interpersonal_skills_feedback: {
                strengths: feedback.interpersonal_skills.strengths,
                improvements: feedback.interpersonal_skills.improvements,
            },
            overall_summary: feedback.overall_summary,
            key_learning_points: feedback.key_learning_points,
        });

        // 6. Update session status
        await supabase
            .from('clinical_sessions')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                overall_score: overallScore,
            })
            .eq('id', sessionId);

        // 7. Update domain progress
        const userId = session.user_id;
        const domainId = station?.domain_id as string | undefined;
        if (userId && domainId) {
            const passed = [feedback.data_gathering.score, feedback.clinical_management.score, feedback.interpersonal_skills.score].every(s => s >= 60);

            const { data: progress } = await supabase
                .from('domain_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('domain_id', domainId)
                .maybeSingle();

            if (progress) {
                const newAttempts = (progress.stations_attempted || 0) + 1;
                const newPassed = (progress.stations_passed || 0) + (passed ? 1 : 0);
                const newAvg = Math.round(((progress.average_score || 0) * (progress.stations_attempted || 0) + overallScore) / newAttempts);

                await supabase
                    .from('domain_progress')
                    .update({ stations_attempted: newAttempts, stations_passed: newPassed, average_score: newAvg })
                    .eq('user_id', userId)
                    .eq('domain_id', domainId);
            } else {
                await supabase.from('domain_progress').insert({
                    user_id: userId,
                    domain_id: domainId,
                    stations_attempted: 1,
                    stations_passed: passed ? 1 : 0,
                    average_score: overallScore,
                });
            }
        }

        // 8. Return feedback
        return NextResponse.json({
            status: 'ready',
            feedback: {
                ...feedback,
                overall_score: overallScore,
                station_title: (station?.title as string) || 'Station Feedback',
            },
        });
    } catch (error) {
        console.error('Feedback generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate feedback', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
