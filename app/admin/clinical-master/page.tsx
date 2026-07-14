'use client';

import { useState, useEffect } from 'react';

// ── Mermaid Flow Diagram (rendered via mermaid.ink) ──

const MERMAID_FLOW = `%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#6366f1', 'primaryTextColor': '#e2e8f0', 'lineColor': '#475569', 'secondaryColor': '#1e1b4b', 'tertiaryColor': '#0f172a'}}}%%
flowchart TB
  subgraph Frontend["Frontend (Next.js)"]
    A["User selects station"] --> B["Create session row (Supabase)"]
    B --> C["POST /api/realtime-token"]
  end

  subgraph TokenRoute["Ephemeral-Key Route (server-side)"]
    C --> D["Load station + build patient prompt"]
    D --> E["POST Azure /realtime/client_secrets<br/>(prompt, voice, tools, transcription)"]
    E --> F["Return ephemeral key + calls URL"]
    F --> G["Set session status = live"]
  end

  subgraph BrowserRTC["Browser (WebRTC)"]
    F --> H["RTCPeerConnection + mic"]
    H --> I["POST SDP to Azure /realtime/calls"]
  end

  subgraph Azure["Azure gpt-realtime (speech-to-speech)"]
    I --> J["STT + LLM + TTS in one model"]
    J --> K["Patient greets first, then waits"]

    subgraph Tools["Function Tools"]
      O["🩺 request_examination"]
      P["🔚 end_consultation"]
    end

    J --> Tools
    Tools --> J
  end

  subgraph Persist["Transcript + Feedback"]
    J --> Q["Data channel transcript events"]
    Q --> R["POST /api/clinical-master/save-transcript"]
    R --> S["Set session status = processing"]
    S --> T["POST /api/generate-feedback"]
    T --> X["<b>Gemini 2.5 Flash</b><br/>Structured JSON → session_results"]
    X --> Z["Set session status = completed"]
  end

  style Frontend fill:#1e1b4b,stroke:#6366f1,stroke-width:2px
  style TokenRoute fill:#0c4a6e,stroke:#0ea5e9,stroke-width:2px
  style BrowserRTC fill:#172554,stroke:#3b82f6,stroke-width:2px
  style Azure fill:#064e3b,stroke:#10b981,stroke-width:2px
  style Tools fill:#713f12,stroke:#f59e0b,stroke-width:2px
  style Persist fill:#4c1d95,stroke:#8b5cf6,stroke-width:2px
`;

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

## Voice and Speech Style
- Speak naturally in conversational British English
- Keep responses SHORT: 1-3 sentences unless asked to elaborate
- Use natural fillers occasionally: "um", "well", "to be honest"

## Response Behaviour
- WAIT for the doctor to ask questions, then answer honestly and concisely
- Express presenting complaint early in your OWN words
- Stay in character 100% of the time

## Prohibited Behaviours
- NEVER ask the doctor diagnostic questions
- NEVER reverse roles, suggest diagnosis, or volunteer unprompted info

# Conversation Flow
Opening → History Taking → Examination → Management → Closing

\${opening_line}

# Safety Guardrails
- If audio unclear: "Sorry, I didn't quite catch that"
- NEVER provide medical advice or diagnose yourself`;

// ── Tool Definitions (from agent.py) ──

const TOOL_DEFINITIONS = [
    {
        name: 'request_examination',
        decorator: '@function_tool',
        signature: 'async def request_examination(self, examination_type: str) -> str',
        docstring: 'Called when the doctor asks to perform a physical examination. The patient cooperates and describes findings.',
        args: [{ name: 'examination_type', type: 'str', desc: 'Type of examination (e.g. blood pressure, abdominal, neurological)' }],
        returns: '"The patient cooperates with the {examination_type} examination. Please describe what you would find based on the clinical scenario."',
        triggerExamples: ['"Let me check your blood pressure"', '"I\'d like to examine your abdomen"', '"Can I listen to your chest?"'],
    },
    {
        name: 'end_consultation',
        decorator: '@function_tool',
        signature: 'async def end_consultation(self) -> str',
        docstring: 'Called when the doctor indicates the consultation is ending. Triggers feedback generation.',
        args: [],
        returns: '"Thank you doctor. The consultation has ended. Feedback is being generated."',
        triggerExamples: ['"I think we\'re done for today"', '"Thank you, that\'s all I need"', '"Let\'s wrap up"'],
    },
];

// ── Feedback Prompt (from feedback.py) ──

const FEEDBACK_PROMPT = `You are an experienced RCGP SCA examiner providing constructive feedback on a GP trainee's consultation.

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
- Score against the CASE-SPECIFIC marking criteria when provided
- Be specific with feedback - reference what was actually said
- Balance criticism with recognition of what was done well
- Focus on actionable improvements
- Keep learning points practical and memorable

# Output Format
JSON object matching ConsultationFeedback schema:
- data_gathering: { domain, score, strengths, improvements }
- clinical_management: { domain, score, strengths, improvements }
- interpersonal_skills: { domain, score, strengths, improvements }
- overall_summary: string
- key_learning_points: array of strings`;

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

interface TranscriptEntry { role: string; content: string; timestamp: string; }

interface DomainResult {
    domain: string;
    display_name: string;
    grade: string;
    what_you_did_well?: { narrative: string }[];
    what_you_missed?: { narrative: string }[];
}

interface SessionResult {
    verdict: string | null;
    weighted_score: number | null;
    max_score: number | null;
    one_line_summary: string | null;
    tier3_override_applied: boolean | null;
    domains: DomainResult[] | null;
    focus_areas?: { label: string; narrative: string }[] | null;
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

function buildFeedbackPromptPreview(session: Session, station: Station | null): string {
    if (!station) return '(Station data not found)';
    const caseBrief = `${station.patient_name || 'Unknown'}, ${station.patient_age || 'Unknown'}-year-old. ${station.candidate_instructions || ''}`;
    const sections: string[] = [];
    if (station.data_gathering) sections.push(`## Data Gathering Criteria\n${station.data_gathering}`);
    if (station.clinical_management) sections.push(`## Clinical Management Criteria\n${station.clinical_management}`);
    if (station.relating_to_others) sections.push(`## Interpersonal Skills Criteria\n${station.relating_to_others}`);
    const criteria = sections.length ? `\n# Case-Specific Marking Criteria\n${sections.join('\n\n')}\n` : '';

    const transcriptText = (session.transcript || [])
        .filter((t) => t.content)
        .map((t) => `[${t.timestamp || 'N/A'}] ${(t.role || 'Unknown').toUpperCase()}: ${t.content}`)
        .join('\n');

    return `${FEEDBACK_PROMPT}\n\n# Case Context\n${caseBrief}\n${criteria}\n# Consultation Transcript\n${transcriptText}\n\nPlease analyze this consultation and provide structured feedback as JSON.`;
}

function statusColor(s: string) {
    switch (s) {
        case 'completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
        case 'live': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'processing': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
        case 'abandoned': return 'bg-red-500/20 text-red-400 border-red-500/30';
        default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
}

function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

// ── Mermaid Renderer Component (uses mermaid.ink) ──

function MermaidDiagram({ chart }: { chart: string }) {
    const encoded = typeof window !== 'undefined'
        ? btoa(unescape(encodeURIComponent(chart)))
        : '';
    const [error, setError] = useState(false);

    if (!encoded) return null;

    if (error) {
        return (
            <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap bg-black/30 rounded-lg p-4 max-h-[600px] overflow-y-auto border border-white/5">
                {chart}
            </pre>
        );
    }

    return (
        <div className="overflow-auto bg-black/20 rounded-lg p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={`https://mermaid.ink/svg/${encoded}`}
                alt="Agent Pipeline Flow Diagram"
                className="w-full max-w-[1200px] mx-auto"
                onError={() => setError(true)}
            />
        </div>
    );
}

// ── Main Component ──

type TabKey = 'sessions' | 'stations' | 'prompt' | 'flow';

export default function AdminDashboard() {
    const [stations, setStations] = useState<Station[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabKey>('flow');
    const [selectedStation, setSelectedStation] = useState<Station | null>(null);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) { next.delete(key); } else { next.add(key); }
            return next;
        });
    };

    useEffect(() => {
        fetch('/api/admin/clinical-data')
            .then((r) => r.json())
            .then((data) => { setStations(data.stations || []); setSessions(data.sessions || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="min-h-[100dvh] bg-[#0a0e1a] flex items-center justify-center">
                <div className="animate-pulse text-slate-500 text-sm">Loading admin data...</div>
            </div>
        );
    }

    const tabs: { key: TabKey; label: string; icon: string }[] = [
        { key: 'flow', label: 'AI Flow', icon: '🔀' },
        { key: 'sessions', label: 'Sessions', icon: '📋' },
        { key: 'stations', label: 'Stations', icon: '🏥' },
        { key: 'prompt', label: 'Prompt Builder', icon: '🧪' },
    ];

    return (
        <div className="min-h-[100dvh] bg-[#0a0e1a] text-slate-200">
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
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setSelectedSession(null); setSelectedStation(null); }}
                            className={`px-5 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === tab.key ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
            </nav>

            <main className="max-w-[1400px] mx-auto px-6 py-6">

                {/* ── FLOW TAB ── */}
                {activeTab === 'flow' && (
                    <div className="space-y-6">
                        {/* Mermaid Diagram */}
                        <div className="rounded-xl border border-indigo-500/20 bg-white/[0.01] p-6">
                            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">End-to-End Agent Pipeline</h3>
                            <MermaidDiagram chart={MERMAID_FLOW} />
                        </div>

                        {/* Tool Definitions */}
                        <div className="rounded-xl border border-amber-500/20 bg-white/[0.01] p-6">
                            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-4">Function Tools (LLM can invoke)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {TOOL_DEFINITIONS.map((tool) => (
                                    <div key={tool.name} className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">{tool.decorator}</span>
                                            <span className="text-sm font-bold text-white font-mono">{tool.name}</span>
                                        </div>
                                        <pre className="text-[11px] text-blue-300 font-mono bg-blue-500/5 rounded px-3 py-1.5 overflow-x-auto">{tool.signature}</pre>
                                        <p className="text-xs text-slate-400">{tool.docstring}</p>
                                        {tool.args.length > 0 && (
                                            <div>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">Args:</span>
                                                {tool.args.map((a) => (
                                                    <div key={a.name} className="text-xs text-slate-300 ml-3">
                                                        <span className="text-violet-400 font-mono">{a.name}</span>: <span className="text-slate-500">{a.type}</span> — {a.desc}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Returns:</span>
                                            <pre className="text-[11px] text-emerald-300/80 font-mono ml-3">{tool.returns}</pre>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">Trigger Examples:</span>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {tool.triggerExamples.map((ex, i) => (
                                                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/5">{ex}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Feedback Prompt */}
                        <div className="rounded-xl border border-violet-500/20 bg-white/[0.01] p-6">
                            <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-1">Feedback Prompt (sent to Gemini 2.5 Flash)</h3>
                            <p className="text-[10px] text-slate-500 mb-4">This template is combined with the transcript + case brief + marking criteria at runtime</p>
                            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed bg-black/30 rounded-lg p-4 max-h-[400px] overflow-y-auto border border-white/5">
                                {FEEDBACK_PROMPT}
                            </pre>
                            <p className="text-[10px] text-slate-600 mt-2">Model: gemini-2.5-flash · Temperature: 0.3 · Output: structured JSON</p>
                        </div>

                        {/* Tech Stack */}
                        <div className="rounded-xl border border-white/5 bg-white/[0.01] p-6">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Tech Stack</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Voice Model', value: 'Azure gpt-realtime', color: 'text-green-400' },
                                    { label: 'Modality', value: 'Speech-to-speech', color: 'text-blue-400' },
                                    { label: 'Transport', value: 'WebRTC → Azure', color: 'text-cyan-400' },
                                    { label: 'Auth', value: 'Ephemeral keys', color: 'text-rose-400' },
                                    { label: 'LLM (Feedback)', value: 'Gemini 2.5 Flash', color: 'text-violet-400' },
                                    { label: 'Database', value: 'Supabase (Postgres)', color: 'text-emerald-400' },
                                    { label: 'Frontend', value: 'Next.js 15', color: 'text-white' },
                                    { label: 'Feedback', value: 'Supabase Edge Fn', color: 'text-amber-400' },
                                ].map((item) => (
                                    <div key={item.label} className="p-3 rounded-lg bg-black/20 border border-white/5">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{item.label}</span>
                                        <p className={`text-sm font-medium ${item.color}`}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── SESSIONS TAB ── */}
                {activeTab === 'sessions' && !selectedSession && (
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_140px_100px_80px_80px_100px] gap-3 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <span>Station / User</span><span>Status</span><span>Score</span><span>Msgs</span><span>Duration</span><span>Time</span>
                        </div>
                        {sessions.map((s) => (
                            <button key={s.id} onClick={() => { setSelectedSession(s); setExpandedSections(new Set()); }}
                                className="w-full grid grid-cols-[1fr_140px_100px_80px_80px_100px] gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.04] transition-all text-left items-center">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{s.stations?.title || 'Unknown'}</p>
                                    <p className="text-[10px] text-slate-500 truncate">{s.profiles?.email || s.id.slice(0, 8)}</p>
                                </div>
                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md border w-fit ${statusColor(s.status)}`}>{s.status}</span>
                                <span className="text-sm font-mono">{s.overall_score != null ? `${s.overall_score} / 10.5` : '—'}</span>
                                <span className="text-sm font-mono text-slate-400">{s.transcript?.length || 0}</span>
                                <span className="text-xs text-slate-500">
                                    {s.started_at && s.completed_at ? `${Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000)}s` : '—'}
                                </span>
                                <span className="text-xs text-slate-500">{timeAgo(s.started_at)}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── SESSION DETAIL ── */}
                {activeTab === 'sessions' && selectedSession && (
                    <div className="space-y-4">
                        <button onClick={() => setSelectedSession(null)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">← Back to sessions</button>

                        <div className="flex items-center gap-4 mb-2">
                            <h2 className="text-lg font-bold text-white">{selectedSession.stations?.title || 'Session'}</h2>
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md border ${statusColor(selectedSession.status)}`}>{selectedSession.status}</span>
                            {selectedSession.overall_score != null && <span className="text-sm font-mono text-indigo-400">{selectedSession.overall_score} / 10.5</span>}
                        </div>

                        {/* Pipeline Steps */}
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex-wrap">
                            {[
                                { n: 1, label: 'Station Data', color: 'violet' },
                                { n: 2, label: 'Patient Prompt', color: 'blue' },
                                { n: 3, label: 'Tools', color: 'amber' },
                                { n: 4, label: 'Transcript', color: 'emerald' },
                                { n: 5, label: 'Feedback Prompt', color: 'purple' },
                                { n: 6, label: 'Feedback Result', color: 'rose' },
                            ].map((step, i) => (
                                <span key={step.n} className="flex items-center gap-1">
                                    {i > 0 && <span className="text-slate-700 mr-1">→</span>}
                                    <span className={`size-5 rounded bg-${step.color}-500/20 text-${step.color}-400 flex items-center justify-center text-[10px]`}>{step.n}</span>
                                    {step.label}
                                </span>
                            ))}
                        </div>

                        {/* 1. Station Data */}
                        <CollapsibleSection title="1. Station Data (from Supabase)" color="violet" isOpen={expandedSections.has('s1')} onToggle={() => toggleSection('s1')}>
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

                        {/* 2. Patient Prompt */}
                        <CollapsibleSection title="2. Assembled Patient Prompt (→ GPT-4.1-mini)" color="blue" isOpen={expandedSections.has('s2')} onToggle={() => toggleSection('s2')}>
                            {(() => {
                                const st = stations.find((s) => s.id === selectedSession.stations?.id);
                                if (!st) return <p className="text-slate-500 text-sm">Station not found</p>;
                                const prompt = buildPromptPreview(st);
                                return (
                                    <>
                                        <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed bg-black/30 rounded-lg p-4 max-h-[500px] overflow-y-auto">{prompt}</pre>
                                        <p className="text-[10px] text-slate-600 mt-2">~{prompt.split(/\s+/).length} words · ~{Math.ceil(prompt.length / 4)} tokens (est.)</p>
                                    </>
                                );
                            })()}
                        </CollapsibleSection>

                        {/* 3. Tools */}
                        <CollapsibleSection title="3. Function Tools (available to LLM)" color="amber" isOpen={expandedSections.has('s3')} onToggle={() => toggleSection('s3')}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {TOOL_DEFINITIONS.map((tool) => (
                                    <div key={tool.name} className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">{tool.decorator}</span>
                                            <span className="text-sm font-bold text-white font-mono">{tool.name}</span>
                                        </div>
                                        <p className="text-xs text-slate-400">{tool.docstring}</p>
                                        <pre className="text-[11px] text-emerald-300/80 font-mono">→ {tool.returns}</pre>
                                    </div>
                                ))}
                            </div>
                        </CollapsibleSection>

                        {/* 4. Transcript */}
                        <CollapsibleSection title={`4. Transcript (${selectedSession.transcript?.length || 0} messages)`} color="emerald" isOpen={expandedSections.has('s4')} onToggle={() => toggleSection('s4')}>
                            {selectedSession.transcript && selectedSession.transcript.length > 0 ? (
                                <div className="space-y-2">
                                    {selectedSession.transcript.map((t, i) => (
                                        <div key={i} className={`flex gap-3 p-2 rounded-lg ${t.role === 'user' ? 'bg-blue-500/5' : 'bg-violet-500/5'}`}>
                                            <span className={`text-[10px] font-bold uppercase shrink-0 w-16 pt-0.5 ${t.role === 'user' ? 'text-blue-400' : 'text-violet-400'}`}>
                                                {t.role === 'user' ? '🩺 Doctor' : '🤒 Patient'}
                                            </span>
                                            <p className="text-sm text-slate-300 flex-1">{t.content}</p>
                                            <span className="text-[10px] text-slate-600 shrink-0">{t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : ''}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-slate-500 text-sm">No transcript captured</p>}
                        </CollapsibleSection>

                        {/* 5. Feedback Prompt */}
                        <CollapsibleSection title="5. Feedback Prompt (→ Gemini 2.5 Flash)" color="purple" isOpen={expandedSections.has('s5')} onToggle={() => toggleSection('s5')}>
                            {(() => {
                                const st = stations.find((s) => s.id === selectedSession.stations?.id);
                                const prompt = buildFeedbackPromptPreview(selectedSession, st || null);
                                return (
                                    <>
                                        <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed bg-black/30 rounded-lg p-4 max-h-[500px] overflow-y-auto">{prompt}</pre>
                                        <p className="text-[10px] text-slate-600 mt-2">~{prompt.split(/\s+/).length} words · ~{Math.ceil(prompt.length / 4)} tokens (est.)</p>
                                    </>
                                );
                            })()}
                        </CollapsibleSection>

                        {/* 6. Feedback Result */}
                        <CollapsibleSection title="6. Feedback Result (Azure marking output)" color="rose" isOpen={expandedSections.has('s6')} onToggle={() => toggleSection('s6')}>
                            {selectedSession.session_results && selectedSession.session_results.length > 0 ? (
                                <div className="space-y-4">
                                    {selectedSession.session_results.map((r, i) => (
                                        <div key={i} className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg font-bold font-mono text-indigo-300">{r.verdict ?? '—'}</span>
                                                <span className="text-sm font-mono text-slate-400">
                                                    {r.weighted_score != null ? r.weighted_score : '—'} / {r.max_score ?? 10.5}
                                                </span>
                                                {r.tier3_override_applied && (
                                                    <span className="text-[10px] font-bold text-red-400 uppercase">Tier 3 cap</span>
                                                )}
                                            </div>
                                            <DataField label="one_line_summary" value={r.one_line_summary ?? ''} multiline />
                                            <div className="grid grid-cols-1 gap-3">
                                                {(r.domains ?? []).map((d, j) => (
                                                    <ScoreCard
                                                        key={j}
                                                        domain={d.display_name || d.domain}
                                                        grade={d.grade}
                                                        didWell={(d.what_you_did_well ?? []).map((x) => x.narrative)}
                                                        missed={(d.what_you_missed ?? []).map((x) => x.narrative)}
                                                    />
                                                ))}
                                            </div>
                                            {r.focus_areas && r.focus_areas.length > 0 && (
                                                <DataField label="focus_areas" value={JSON.stringify(r.focus_areas, null, 2)} multiline />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-slate-500 text-sm">No feedback generated yet</p>}
                        </CollapsibleSection>
                    </div>
                )}

                {/* ── STATIONS TAB ── */}
                {activeTab === 'stations' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stations.map((s) => (
                            <button key={s.id} onClick={() => { setSelectedStation(s); setActiveTab('prompt'); }}
                                className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all text-left space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-white truncate">{s.title}</h3>
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">{s.difficulty || '—'}</span>
                                </div>
                                <p className="text-xs text-slate-500">{s.patient_name}, {s.patient_age}y · {s.consultation_type || 'face-to-face'}</p>
                                <p className="text-[10px] text-slate-600 truncate">{s.domains?.name || 'No domain'}</p>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── PROMPT BUILDER TAB ── */}
                {activeTab === 'prompt' && (
                    <div className="space-y-4">
                        <select value={selectedStation?.id || ''} onChange={(e) => setSelectedStation(stations.find((s) => s.id === e.target.value) || null)}
                            className="bg-[#0d1120] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                            <option value="">Select a station...</option>
                            {stations.map((s) => <option key={s.id} value={s.id}>{s.title} — {s.patient_name}, {s.patient_age}y</option>)}
                        </select>

                        {selectedStation && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest">DB Fields → Template Variables</h3>
                                    <DataField label="patient_name → {patient_name}" value={selectedStation.patient_name} highlight />
                                    <DataField label="patient_age → {patient_age}" value={String(selectedStation.patient_age)} highlight />
                                    <DataField label="consultation_type → {consultation_type_description}" value={selectedStation.consultation_type || 'face-to-face'} highlight />
                                    <DataField label="station_script → {character_section}" value={selectedStation.station_script} multiline highlight />
                                    <DataField label="candidate_instructions → {medical_background}" value={selectedStation.candidate_instructions} multiline highlight />
                                </div>
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

// ── Shared UI Components ──

function CollapsibleSection({ title, color, isOpen, onToggle, children }: { title: string; color: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
    const borderMap: Record<string, string> = { violet: 'border-violet-500/20', blue: 'border-blue-500/20', emerald: 'border-emerald-500/20', amber: 'border-amber-500/20', purple: 'border-purple-500/20', rose: 'border-rose-500/20' };
    const dotMap: Record<string, string> = { violet: 'bg-violet-400', blue: 'bg-blue-400', emerald: 'bg-emerald-400', amber: 'bg-amber-400', purple: 'bg-purple-400', rose: 'bg-rose-400' };

    return (
        <div className={`rounded-xl border ${borderMap[color] || 'border-white/5'} bg-white/[0.01] overflow-hidden`}>
            <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${dotMap[color]}`}></span>
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
            <span className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? 'text-violet-400' : 'text-slate-500'}`}>{label}</span>
            {multiline ? (
                <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-black/20 rounded-lg p-3 max-h-[200px] overflow-y-auto border border-white/5">{value || '(empty)'}</pre>
            ) : (
                <p className={`text-sm ${highlight ? 'text-indigo-300 font-medium' : 'text-slate-300'}`}>{value || '(empty)'}</p>
            )}
        </div>
    );
}

function ScoreCard({ domain, grade, didWell, missed }: { domain: string; grade: string; didWell: string[]; missed: string[] }) {
    const c = grade === 'CP' ? 'text-emerald-400' : grade === 'P' ? 'text-blue-400' : grade === 'F' ? 'text-amber-400' : 'text-red-400';
    return (
        <div className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{domain}</span>
                <span className={`text-lg font-bold font-mono ${c}`}>{grade}</span>
            </div>
            {didWell.length > 0 && (
                <div>
                    <span className="text-[10px] text-emerald-500 font-bold">Did well:</span>
                    <ul className="text-[11px] text-slate-400 list-disc list-inside">{didWell.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
            )}
            {missed.length > 0 && (
                <div>
                    <span className="text-[10px] text-red-400 font-bold">Missed:</span>
                    <ul className="text-[11px] text-slate-400 list-disc list-inside">{missed.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
            )}
        </div>
    );
}
