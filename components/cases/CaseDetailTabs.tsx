'use client';

import { useState } from 'react';

interface CaseDetailTabsProps {
    candidateContent: React.ReactNode;
    markSchemeContent: React.ReactNode;
    learningPointsContent: React.ReactNode;
}

const tabs = [
    { id: 'candidate', label: 'Candidate', icon: 'description' },
    { id: 'markscheme', label: 'Mark Scheme', icon: 'grading' },
    { id: 'learning', label: 'Learning Points', icon: 'school' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function CaseDetailTabs({
    candidateContent,
    markSchemeContent,
    learningPointsContent,
}: CaseDetailTabsProps) {
    const [activeTab, setActiveTab] = useState<TabId>('candidate');

    return (
        <div className="flex flex-col h-full">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 md:px-6 pt-4 pb-0 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-t-xl text-sm font-semibold transition-all whitespace-nowrap min-h-[44px] ${activeTab === tab.id
                                ? 'bg-[#0c0c0f] text-white border border-zinc-800 border-b-transparent'
                                : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/30'
                            }`}
                    >
                        {activeTab === tab.id && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            {tab.icon}
                        </span>
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 bg-[#0c0c0f] border border-zinc-800 rounded-2xl rounded-tl-none mx-3 md:mx-4 mb-4 overflow-y-auto no-scrollbar">
                {activeTab === 'candidate' && candidateContent}
                {activeTab === 'markscheme' && markSchemeContent}
                {activeTab === 'learning' && learningPointsContent}
            </div>
        </div>
    );
}
