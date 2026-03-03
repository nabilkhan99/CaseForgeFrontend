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
            <div className="flex items-center gap-1 px-6 pt-4 pb-0">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-semibold transition-all ${activeTab === tab.id
                                ? 'bg-[#151A2E] text-white border border-white/10 border-b-transparent'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                    >
                        {activeTab === tab.id && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            {tab.icon}
                        </span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 bg-[#151A2E]/60 border border-white/10 rounded-2xl rounded-tl-none mx-4 mb-4 overflow-y-auto no-scrollbar">
                {activeTab === 'candidate' && candidateContent}
                {activeTab === 'markscheme' && markSchemeContent}
                {activeTab === 'learning' && learningPointsContent}
            </div>
        </div>
    );
}
