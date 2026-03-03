'use client';

import { useState, useEffect } from 'react';

// ── Prompt Template (mirrored from Python patient.py) ──
const PROMPT_TEMPLATE = `# Role and Objective
You are \${patient_name}, a \${patient_age}-year-old \${consultation_type_description}.
You are in a SIMULATED clinical consultation with a trainee doctor who is being assessed.
Your sole objective is to play this patient character convincingly and help the doctor practise their consultation skills.

# Character
\${character_section}

# Medical Background
The following is YOUR medical history. You know this information about yourself.
ONLY share details when the doctor specifically ASKS about them — NEVER volunteer information unprompted.

\${medical_background}

# Instructions

## Output Format — CRITICAL
Your output goes directly to a text-to-speech engine. You must ONLY output the exact words you would speak aloud.
- Output ONLY spoken dialogue — no narration, no actions, no descriptions
- NEVER use asterisks, parentheses, brackets, or quotes to describe actions
- NEVER include stage directions, physical descriptions, or internal thoughts
- If you want to express emotion, do it through your word choice and phrasing

## Voice and Speech Style
- Speak naturally in conversational British English
- Match the doctor's tone — formal if they're formal, relaxed if they're casual
- Keep responses SHORT: 1-3 sentences unless the doctor explicitly asks you to elaborate
- Use natural fillers occasionally: "um", "well", "to be honest", "I suppose"

## Response Behaviour
- WAIT for the doctor to ask questions, then answer honestly and concisely
- Express your presenting complaint early but in your OWN words, not medical jargon
- Stay in character 100% of the time — you ARE this person

## Prohibited Behaviours
- NEVER ask the doctor diagnostic questions
- NEVER reverse roles or ask about the doctor's health
- NEVER suggest your own diagnosis or treatment
- NEVER volunteer information the doctor hasn't asked about

# Conversation Flow

## Opening
Briefly state why you're here in your own words. Keep it to 1-2 sentences.
Then STOP and let the doctor lead.

\${opening_line}

# Safety Guardrails
- If audio is unclear: "Sorry, I didn't quite catch that"
- NEVER provide medical advice or diagnose yourself
- ALWAYS respond in English regardless of input language`;

// ── Types ──

interface Station {
    id: string;
    title: string;
    patient_name: string;
    patient_age: number;
    candidate_instructions: string;
    station_script: string;
    clinical_management: string | null;
    data_gathering: string | null;
    relating_to_others: string | null;
    clinical_learning_points: string | null;
    difficulty: string | null;
    consultation_type: string | null;
    consultation_duration_seconds: number | null;
    domains: { name: string } | null;
}

interface TranscriptEntry {
    role: string;
    content: string;
    timestamp: string;
}

interface SessionResult {
    data_gathering_score: number;
    clinical_management_score: number;
    interpersonal_skills_score: number;
    overall_score: number;
    data_gathering_feedback: { strengths: string[]; improvements: string[] };
    clinical_management_feedback: { strengths: string[]; improvements: string[] };
    interpersonal_skills_feedback: { strengths: string[]; improvements: string[] };
    overall_summary: string;
    key_learning_points: string[];
}

interface Session {
    id: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    overall_score: number | null;
    transcript: TranscriptEntry[] | null;
    stations: { id: string; title: string; patient_name: string } | null;
    session_results: SessionResult[] | null;
    profiles: { email: string; full_name: string } | null;
}

// ── Helpers ──

function buildPromptPreview(station: Station): string {
    const typeMap: Record<string, string> = {
        'face-to-face': 'patient visiting a GP surgery',
        telephone: 'patient calling the GP surgery by phone',
        video: 'patient in a video consultation with a GP',
        'home visit': 'patient being visited at home by a GP',
    };
    const consultDesc = typeMap[(station.consultation_type || '').toLowerCase()] || 'patient in a GP consultation';
    const charSection = station.station_script
        ? `Case: ${station.title}\n\n${station.station_script}`
        : `Case: ${station.title}\n\nYou are presenting with concerns related to: ${station.title}.`;
    const medBg = station.candidate_instructions || 'No specific medical background provided.';

    let opening = '';
    if (station.station_script?.includes('Opening Sentence')) {
        const lines = station.station_script.split('\n');
        for (const line of lines) {
            if (line.includes('Opening Sentence')) {
                const parts = line.split(':');
                if (parts.length > 1 && parts.slice(1).join(':').trim()) {
                    opening = `Your opening line (paraphrase naturally): ${parts.slice(1).join(':').trim().replace(/"/g, '')}`;
                }
                break;
            }
        }
    }

    return PROMPT_TEMPLATE
        .replace('${patient_name}', station.patient_name || 'Patient')
        .replace('${patient_age}', String(station.patient_age || 'adult'))
        .replace('${consultation_type_description}', consultDesc)
        .replace('${character_section}', charSection)
        .replace('${medical_background}', medBg)
        .replace('${opening_line}', opening);
}

function statusColor(status: string) {
    switch (status) {
        case 'completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        case 'live': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'processing': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
        case 'abandoned': return 'bg-red-500/20 text-red-400 border-red-500/30';
        default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
}

function timeAgo(date: string) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// ── Main Component ──

export default function AdminDashboard() {
    const [stations, setStations] = useState<Station[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'sessions' | 'stations' | 'prompt'>('sessions');
    const [selectedStation, setSelectedStation] = useState<Station | null>(null);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/admin/clinical-data')
            .then((r) => r.json())
            .then((data) => {
                setStations(data.stations || []);
                setSessions(data.sessions || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
                <div className="animate-pulse text-slate-500 text-sm">Loading admin data...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0e1a] text-slate-200">
            {/* Header */}
            <header className="border-b border-white/5 bg-[#0d1120]">
                <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold">CM</div>
                        <div>
                            <h1 className="text-sm font-bold text-white tracking-tight">Clinical Master — Admin</h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Agent Debug Dashboard</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="size-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        {stations.length} stations · {sessions.length} sessions
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <nav className="border-b border-white/5 bg-[#0d1120]/50">
                <div className="max-w-[1400px] mx-auto px-6 flex gap-0">
                    {(['sessions', 'stations', 'prompt'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSelectedSession(null); setSelectedStation(null); }}
                            className={`px-5 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === tab
                                    ? 'border-indigo-500 text-white'
                                    : 'border-transparent text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {tab === 'sessions' ? '📋 Sessions' : tab === 'stations' ? '🏥 Stations' : '🧪 Prompt Builder'}
                        </button>
                    ))}
                </div>
            </nav>

            <main className="max-w-[1400px] mx-auto px-6 py-6">
                {/* ── Sessions Tab ── */}
                {activeTab === 'sessions' && !selectedSession && (
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_140px_100px_80px_80px_100px] gap-3 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <span>Station / User</span>
                            <span>Status</span>
                            <span>Score</span>
                            <span>Msgs</span>
                            <span>Duration</span>
                            <span>Time</span>
                        </div>
                        {sessions.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedSession(s)}
                                className="w-full grid grid-cols-[1fr_140px_100px_80px_80px_100px] gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.04] transition-all text-left items-center"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{s.stations?.title || 'Unknown'}</p>
                                    <p className="text-[10px] text-slate-500 truncate">{s.profiles?.email || s.id.slice(0, 8)}</p>
                                </div>
                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md border w-fit ${statusColor(s.status)}`}>
                                    {s.status}
                                </span>
                                <span className="text-sm font-mono">{s.overall_score != null ? `${s.overall_score}%` : '—'}</span>
                                <span className="text-sm font-mono text-slate-400">{s.transcript?.length || 0}</span>
                                <span className="text-xs text-slate-500">
                                    {s.started_at && s.completed_at
                                        ? `${Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000)}s`
                                        : '—'}
                                </span>
                                <span className="text-xs text-slate-500">{timeAgo(s.started_at)}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Session Detail ── */}
                {activeTab === 'sessions' && selectedSession && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setSelectedSession(null)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mb-2"
                        >
                            ← Back to sessions
                        </button>

                        <div className="flex items-center gap-4 mb-6">
                            <h2 className="text-lg font-bold text-white">{selectedSession.stations?.title || 'Session'}</h2>
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md border ${statusColor(selectedSession.status)}`}>
                                {selectedSession.status}
                            </span>
                            {selectedSession.overall_score != null && (
                                <span className="text-sm font-mono text-indigo-400">{selectedSession.overall_score}%</span>
                            )}
                        </div>

                        {/* Pipeline Steps */}
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                            <span className="size-5 rounded bg-violet-500/20 text-violet-400 flex items-center justify-center">1</span> Station Data
                            <span className="text-slate-700">→</span>
                            <span className="size-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center">2</span> Prompt
                            <span className="text-slate-700">→</span>
                            <span className="size-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center">3</span> Transcript
                            <span className="text-slate-700">→</span>
                            <span className="size-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center">4</span> Feedback
                        </div>

                        {/* Step 1: Station Data */}
                        <CollapsibleSection
                            title="1. Station Data (from Supabase)"
                            color="violet"
                            isOpen={expandedSection === 'station-data'}
                            onToggle={() => setExpandedSection(expandedSection === 'station-data' ? null : 'station-data')}
                        >
                            {(() => {
                                const st = stations.find((s) => s.id === selectedSession.stations?.id);
                                if (!st) return <p className="text-slate-500 text-sm">Station data not found</p>;
                                return (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <DataField label="patient_name" value={st.patient_name} />
                                            <DataField label="patient_age" value={String(st.patient_age)} />
                                            <DataField label="consultation_type" value={st.consultation_type || 'face-to-face'} />
                                            <DataField label="difficulty" value={st.difficulty || '—'} />
                                        </div>
                                        <DataField label="station_script" value={st.station_script} multiline />
                                        <DataField label="candidate_instructions" value={st.candidate_instructions} multiline />
                                        {st.data_gathering && <DataField label="data_gathering (marking criteria)" value={st.data_gathering} multiline />}
                                        {st.clinical_management && <DataField label="clinical_management (marking criteria)" value={st.clinical_management} multiline />}
                                        {st.relating_to_others && <DataField label="relating_to_others (marking criteria)" value={st.relating_to_others} multiline />}
                                    </div>
                                );
                            })()}
                        </CollapsibleSection>

                        {/* Step 2: Assembled Prompt */}
                        <CollapsibleSection
                            title="2. Assembled Prompt (sent to LLM)"
                            color="blue"
                            isOpen={expandedSection === 'prompt'}
                            onToggle={() => setExpandedSection(expandedSection === 'prompt' ? null : 'prompt')}
                        >
                            {(() => {
                                const st = stations.find((s) => s.id === selectedSession.stations?.id);
                                if (!st) return <p className="text-slate-500 text-sm">Station not found</p>;
                                const prompt = buildPromptPreview(st);
                                return (
                                    <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed bg-black/30 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                                        {prompt}
                                    </pre>
                                );
                            })()}
                        </CollapsibleSection>

                        {/* Step 3: Transcript */}
                        <CollapsibleSection
                            title={`3. Transcript (${selectedSession.transcript?.length || 0} messages)`}
                            color="emerald"
                            isOpen={expandedSection === 'transcript'}
                            onToggle={() => setExpandedSection(expandedSection === 'transcript' ? null : 'transcript')}
                        >
                            {selectedSession.transcript && selectedSession.transcript.length > 0 ? (
                                <div className="space-y-2">
                                    {selectedSession.transcript.map((t, i) => (
                                        <div key={i} className={`flex gap-3 p-2 rounded-lg ${t.role === 'user' ? 'bg-blue-500/5' : 'bg-violet-500/5'}`}>
                                            <span className={`text-[10px] font-bold uppercase shrink-0 w-16 pt-0.5 ${t.role === 'user' ? 'text-blue-400' : 'text-violet-400'}`}>
                                                {t.role === 'user' ? '🩺 Doctor' : '🤒 Patient'}
                                            </span>
                                            <p className="text-sm text-slate-300 flex-1">{t.content}</p>
                                            <span className="text-[10px] text-slate-600 shrink-0">
                                                {t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm">No transcript captured</p>
                            )}
                        </CollapsibleSection>

                        {/* Step 4: Feedback */}
                        <CollapsibleSection
                            title="4. Feedback (Gemini output)"
                            color="amber"
                            isOpen={expandedSection === 'feedback'}
                            onToggle={() => setExpandedSection(expandedSection === 'feedback' ? null : 'feedback')}
                        >
                            {selectedSession.session_results && selectedSession.session_results.length > 0 ? (
                                <div className="space-y-4">
                                    {selectedSession.session_results.map((r, i) => (
                                        <div key={i} className="space-y-3">
                                            <div className="grid grid-cols-3 gap-3">
                                                <ScoreCard domain="Data Gathering" score={r.data_gathering_score} feedback={r.data_gathering_feedback} />
                                                <ScoreCard domain="Clinical Management" score={r.clinical_management_score} feedback={r.clinical_management_feedback} />
                                                <ScoreCard domain="Interpersonal Skills" score={r.interpersonal_skills_score} feedback={r.interpersonal_skills_feedback} />
                                            </div>
                                            <DataField label="overall_summary" value={r.overall_summary} multiline />
                                            <DataField label="key_learning_points" value={JSON.stringify(r.key_learning_points, null, 2)} multiline />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 text-sm">No feedback generated yet</p>
                            )}
                        </CollapsibleSection>
                    </div>
                )}

                {/* ── Stations Tab ── */}
                {activeTab === 'stations' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stations.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => { setSelectedStation(s); setActiveTab('prompt'); }}
                                className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all text-left space-y-2"
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-white truncate">{s.title}</h3>
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">{s.difficulty || '—'}</span>
                                </div>
                                <p className="text-xs text-slate-500">
                                    {s.patient_name}, {s.patient_age}y · {s.consultation_type || 'face-to-face'}
                                </p>
                                <p className="text-[10px] text-slate-600 truncate">{s.domains?.name || 'No domain'}</p>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Prompt Builder Tab ── */}
                {activeTab === 'prompt' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <select
                                value={selectedStation?.id || ''}
                                onChange={(e) => setSelectedStation(stations.find((s) => s.id === e.target.value) || null)}
                                className="bg-[#0d1120] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Select a station...</option>
                                {stations.map((s) => (
                                    <option key={s.id} value={s.id}>{s.title} — {s.patient_name}, {s.patient_age}y</option>
                                ))}
                            </select>
                        </div>

                        {selectedStation && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Left: Raw DB fields */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest">DB Fields → Template Variables</h3>
                                    <div className="space-y-2">
                                        <DataField label="patient_name → {patient_name}" value={selectedStation.patient_name} highlight />
                                        <DataField label="patient_age → {patient_age}" value={String(selectedStation.patient_age)} highlight />
                                        <DataField label="consultation_type → {consultation_type_description}" value={selectedStation.consultation_type || 'face-to-face'} highlight />
                                        <DataField label="station_script → {character_section}" value={selectedStation.station_script} multiline highlight />
                                        <DataField label="candidate_instructions → {medical_background}" value={selectedStation.candidate_instructions} multiline highlight />
                                    </div>
                                </div>

                                {/* Right: Assembled prompt */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Assembled Prompt (sent to GPT-4.1-mini)</h3>
                                    <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed bg-black/30 rounded-lg p-4 max-h-[700px] overflow-y-auto border border-white/5">
                                        {buildPromptPreview(selectedStation)}
                                    </pre>
                                    <p className="text-[10px] text-slate-600">
                                        ~{buildPromptPreview(selectedStation).split(/\s+/).length} words · ~{Math.ceil(buildPromptPreview(selectedStation).length / 4)} tokens (est.)
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

// ── UI Components ──

function CollapsibleSection({
    title,
    color,
    isOpen,
    onToggle,
    children,
}: {
    title: string;
    color: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    const borderColors: Record<string, string> = {
        violet: 'border-violet-500/20',
        blue: 'border-blue-500/20',
        emerald: 'border-emerald-500/20',
        amber: 'border-amber-500/20',
    };
    const dotColors: Record<string, string> = {
        violet: 'bg-violet-400',
        blue: 'bg-blue-400',
        emerald: 'bg-emerald-400',
        amber: 'bg-amber-400',
    };

    return (
        <div className={`rounded-xl border ${borderColors[color] || 'border-white/5'} bg-white/[0.01] overflow-hidden`}>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${dotColors[color]}`}></span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">{title}</span>
                </div>
                <span className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {isOpen && <div className="px-4 pb-4 border-t border-white/5 pt-3">{children}</div>}
        </div>
    );
}

function DataField({ label, value, multiline, highlight }: { label: string; value: string; multiline?: boolean; highlight?: boolean }) {
    return (
        <div className="space-y-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? 'text-violet-400' : 'text-slate-500'}`}>
                {label}
            </span>
            {multiline ? (
                <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-black/20 rounded-lg p-3 max-h-[200px] overflow-y-auto border border-white/5">
                    {value || '(empty)'}
                </pre>
            ) : (
                <p className={`text-sm ${highlight ? 'text-indigo-300 font-medium' : 'text-slate-300'}`}>{value || '(empty)'}</p>
            )}
        </div>
    );
}

function ScoreCard({ domain, score, feedback }: { domain: string; score: number; feedback: { strengths: string[]; improvements: string[] } }) {
    const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-blue-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';

    return (
        <div className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{domain}</span>
                <span className={`text-lg font-bold font-mono ${scoreColor}`}>{score}</span>
            </div>
            {feedback?.strengths?.length > 0 && (
                <div>
                    <span className="text-[10px] text-emerald-500 font-bold">Strengths:</span>
                    <ul className="text-[11px] text-slate-400 list-disc list-inside">
                        {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </div>
            )}
            {feedback?.improvements?.length > 0 && (
                <div>
                    <span className="text-[10px] text-red-400 font-bold">Improvements:</span>
                    <ul className="text-[11px] text-slate-400 list-disc list-inside">
                        {feedback.improvements.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}
