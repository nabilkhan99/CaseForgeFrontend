'use client';

import { useState } from 'react';

interface CaseDetailTabsProps {
    candidateContent: React.ReactNode;
    patientScriptContent?: React.ReactNode;
    markSchemeContent: React.ReactNode;
    learningPointsContent: React.ReactNode;
    feedbackButton?: React.ReactNode;
}

function CandidateIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    );
}

function GradingIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
    );
}

function ScriptIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
        </svg>
    );
}

function SchoolIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 10 3 12 0v-5" />
        </svg>
    );
}

const ALL_TABS = [
    { id: 'candidate', label: 'Candidate', Icon: CandidateIcon },
    { id: 'script', label: 'Patient Script', Icon: ScriptIcon },
    { id: 'markscheme', label: 'Mark Scheme', Icon: GradingIcon },
    { id: 'learning', label: 'Learning Points', Icon: SchoolIcon },
] as const;

type TabId = (typeof ALL_TABS)[number]['id'];

export default function CaseDetailTabs({
    candidateContent,
    patientScriptContent,
    markSchemeContent,
    learningPointsContent,
    feedbackButton,
}: CaseDetailTabsProps) {
    // Only show the script tab if content is provided
    const tabs = patientScriptContent
        ? ALL_TABS
        : ALL_TABS.filter(t => t.id !== 'script');

    const [activeTab, setActiveTab] = useState<TabId>('candidate');

    return (
        <div className="flex flex-col">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 md:px-5 pt-4 pb-0 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-3 md:px-5 py-2.5 rounded-t-xl text-sm font-semibold transition-all whitespace-nowrap min-h-[44px] ${activeTab === tab.id
                                ? 'bg-white/70 text-heading border border-black/[0.06] border-b-transparent'
                                : 'text-muted hover:text-body hover:bg-black/[0.02]'
                            }`}
                    >
                        {activeTab === tab.id && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                        <tab.Icon />
                        <span className="text-[11px] sm:text-sm">{tab.label}</span>
                    </button>
                ))}
                {feedbackButton && (
                    <div className="ml-auto flex-shrink-0 hidden lg:block">
                        {feedbackButton}
                    </div>
                )}
            </div>

            {/* Tab content */}
            <div className="bg-white/70 border border-black/[0.06] rounded-2xl rounded-tl-none mx-3 md:mx-4 mb-4">
                {activeTab === 'candidate' && candidateContent}
                {activeTab === 'script' && patientScriptContent}
                {activeTab === 'markscheme' && markSchemeContent}
                {activeTab === 'learning' && learningPointsContent}
            </div>
        </div>
    );
}
