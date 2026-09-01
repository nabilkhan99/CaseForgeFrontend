'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * The case teaching-notes renderer, shared by the public case page and the
 * post-consultation feedback report.
 *
 * It lived inside CaseDetailPageClient until the feedback report needed the
 * same thing: trainees were finishing an AI consultation and then opening a
 * second tab to find the same case under /sca-cases purely to read its learning
 * points. Both surfaces read the identical `stations.clinical_learning_points`
 * column, so they render through one component rather than two that drift.
 */

export function MarkdownContent({ content }: { content: string | null }) {
    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-muted">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <p className="text-sm font-medium">Content not available for this case</p>
            </div>
        );
    }

    return (
        <div>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <h2 className="text-lg font-bold text-heading mt-6 mb-3">{children}</h2>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-base font-bold text-heading mt-5 mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-sm font-bold text-heading mt-4 mb-2">{children}</h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="text-sm font-bold text-heading mt-3 mb-1">{children}</h4>
                    ),
                    p: ({ children }) => (
                        <p className="text-sm text-body leading-relaxed mb-3">{children}</p>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-bold text-heading">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="text-body italic">{children}</em>
                    ),
                    ul: ({ children }) => (
                        <ul className="space-y-1.5 my-2 pl-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="space-y-1.5 my-2 pl-1 list-decimal list-inside">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-sm text-body leading-relaxed flex items-start gap-2">
                            <span className="text-primary mt-1.5 text-[6px] shrink-0">●</span>
                            <span>{children}</span>
                        </li>
                    ),
                    table: ({ children }) => (
                        <div className="my-4 rounded-xl border border-black/[0.06] overflow-hidden">
                            <table className="w-full text-sm">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-black/[0.02]">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                        <tbody className="divide-y divide-black/[0.06]">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                        <tr className="hover:bg-black/[0.01] transition-colors">{children}</tr>
                    ),
                    th: ({ children }) => (
                        <th className="px-4 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-4 py-3 text-sm text-body leading-relaxed align-top">
                            {children}
                        </td>
                    ),
                    hr: () => (
                        <hr className="border-black/[0.06] my-4" />
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-primary/30 pl-4 my-3 text-muted italic">
                            {children}
                        </blockquote>
                    ),
                    code: ({ children }) => (
                        <code className="bg-primary/[0.06] text-primary px-1.5 py-0.5 rounded text-xs font-mono">
                            {children}
                        </code>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

const LEARNING_POINT_COLORS = [
    { bg: 'bg-blue-50', border: 'border-blue-300', number: 'text-blue-200' },
    { bg: 'bg-emerald-50', border: 'border-emerald-300', number: 'text-emerald-200' },
    { bg: 'bg-amber-50', border: 'border-amber-300', number: 'text-amber-200' },
    { bg: 'bg-purple-50', border: 'border-purple-300', number: 'text-purple-200' },
    { bg: 'bg-rose-50', border: 'border-rose-300', number: 'text-rose-200' },
];

/** `**1. Title**` — how 189 of the 200 active stations write their sections. */
const BOLD_SECTION = /\*\*(\d+)\.\s+(.+?)\*\*/;

/**
 * `## 1. Title` / `### 1. Title` — how the other 11 write theirs.
 *
 * Same content, different authoring hand. Matching only the bold form meant
 * those 11 found no sections at all and fell through to flat markdown, losing
 * the numbered colour-coded cards entirely — the exact thing a tester asked us
 * to put in front of her. It went unnoticed while this only rendered on the
 * public case pages; putting it on the feedback report made it obvious.
 */
const HEADING_SECTION = /^\s{0,3}#{1,6}\s+(\d+)\.\s+(.+?)\s*$/;

/**
 * A section heading in either dialect. `remainder` is any text left on the line
 * after the heading — only possible for the inline bold form; a markdown
 * heading occupies its whole line.
 */
function matchSectionHeading(
    line: string
): { number: string; title: string; remainder: string } | null {
    const heading = line.match(HEADING_SECTION);
    if (heading) return { number: heading[1], title: heading[2], remainder: '' };

    const bold = line.match(BOLD_SECTION);
    if (bold) {
        return {
            number: bold[1],
            title: bold[2],
            remainder: line.replace(BOLD_SECTION, '').trim(),
        };
    }
    return null;
}

export function LearningPointsDisplay({ content }: { content: string | null }) {
    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-muted">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <p className="text-sm font-medium">Content not available for this case</p>
            </div>
        );
    }

    const lines = content.split('\n');
    const sections: { number: string; title: string; content: string }[] = [];
    let currentNumber = '';
    let currentTitle = '';
    let currentLines: string[] = [];

    for (const line of lines) {
        const match = matchSectionHeading(line);
        if (match) {
            if (currentTitle) {
                sections.push({
                    number: currentNumber,
                    title: currentTitle,
                    content: currentLines.join('\n').trim(),
                });
            }
            currentNumber = match.number;
            currentTitle = match.title;
            currentLines = match.remainder ? [match.remainder] : [];
        } else {
            currentLines.push(line);
        }
    }
    if (currentTitle) {
        sections.push({
            number: currentNumber,
            title: currentTitle,
            content: currentLines.join('\n').trim(),
        });
    }

    if (sections.length === 0) {
        return <MarkdownContent content={content} />;
    }

    return (
        <div className="space-y-4">
            {sections.map((section, i) => {
                const color = LEARNING_POINT_COLORS[i % LEARNING_POINT_COLORS.length];
                return (
                    <div
                        key={i}
                        className={`relative rounded-xl ${color.bg} border-l-[3px] ${color.border} p-5 overflow-hidden`}
                    >
                        <span className={`absolute top-2 left-3 text-5xl font-black ${color.number} select-none pointer-events-none`}>
                            {section.number}
                        </span>
                        <div className="relative pl-8">
                            <h4 className="text-sm font-bold text-heading mb-2">{section.title}</h4>
                            <MarkdownContent content={section.content} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
