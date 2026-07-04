import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { LINK_MAP } from '@/lib/guides/articleTypes';

const TOKEN = /(\[link:[^\]]+\]|\*\*[^*]+\*\*)/g;

/**
 * Renders article body text, resolving the two inline conventions used in the
 * guide content: `[link: Exact Guide Name]` becomes an internal link (via
 * LINK_MAP), and `**bold**` becomes a <strong>. Unrecognised link names fall
 * back to plain text so a typo never produces a broken link.
 */
export function renderInline(text: string): ReactNode[] {
    return text
        .split(TOKEN)
        .filter(Boolean)
        .map((part, index) => {
            const linkMatch = part.match(/^\[link:\s*([^\]]+)\]$/);
            if (linkMatch) {
                const name = linkMatch[1].trim();
                const href = LINK_MAP[name];
                if (href) {
                    return (
                        <Link
                            key={index}
                            href={href}
                            className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition hover:decoration-primary"
                        >
                            {name}
                        </Link>
                    );
                }
                return <Fragment key={index}>{name}</Fragment>;
            }

            const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
            if (boldMatch) {
                return (
                    <strong key={index} className="font-semibold text-heading">
                        {boldMatch[1]}
                    </strong>
                );
            }

            return <Fragment key={index}>{part}</Fragment>;
        });
}
