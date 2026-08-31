import Link from 'next/link';
import { portfolioArticles } from '@/lib/portfolio-guides/articles';
import { portfolioArticlePath } from '@/lib/portfolio-guides/articleTypes';
import { ABOUT_PARAGRAPHS, COMMON_QUESTIONS } from './belowFoldContent';

/**
 * The below-fold content region of /gp-portfolio-tool.
 *
 * A SERVER component with no 'use client' and no interactivity of its own: every
 * word of it must be in the initial HTML, because the entire purpose of this
 * block is to give a crawler something to read on a page that previously
 * rendered about 25 words. Disclosure is native <details>/<summary>, closed by
 * default — the browser's own show/hide, with the content present either way.
 * A React accordion that mounts its children on click would put this content
 * behind an interaction a crawler never performs.
 *
 * Styling is a deliberate departure from the rest of the site: smaller type,
 * muted colour, generous whitespace, no cards, no icons, no accent colour, no
 * CTA buttons and no motion. It should read as a footer region rather than a
 * section competing for attention. Nothing here is meant for a returning user,
 * which is why the whole block is hidden once a review is on screen.
 *
 * §6c (article links) lists the cluster in registry order. The spec gates it on
 * at least three articles being live, because two links look abandoned; all
 * eight now are, and the block renders only while the registry is non-empty so
 * that gate holds on its own if the cluster is ever emptied.
 */

const summaryClass =
    'flex cursor-pointer list-none items-baseline justify-between gap-4 py-3.5 text-[15px] text-body transition-colors hover:text-heading [&::-webkit-details-marker]:hidden';

const markerClass =
    'flex-shrink-0 select-none font-mono text-[13px] leading-none text-muted transition-transform duration-150 group-open:rotate-45';

const answerClass = 'text-[14px] leading-relaxed text-muted';

export default function PortfolioBelowFold() {
    return (
        <section className="mx-auto max-w-[760px] px-6 pb-24 pt-16 sm:pt-20">
            {/* About */}
            <details className="group border-t border-hairline">
                <summary className={summaryClass}>
                    About the GP portfolio tool
                    <span aria-hidden="true" className={markerClass}>
                        +
                    </span>
                </summary>
                <div className="space-y-4 pb-6 pr-8">
                    {ABOUT_PARAGRAPHS.map(paragraph => (
                        <p key={paragraph} className={answerClass}>
                            {paragraph}
                        </p>
                    ))}
                </div>
            </details>

            {/* Common questions */}
            <h2 className="mb-1 mt-14 text-[13px] font-medium uppercase tracking-[0.14em] text-muted">
                Common questions
            </h2>
            <div className="border-b border-hairline">
                {COMMON_QUESTIONS.map(item => (
                    <details key={item.question} className="group border-t border-hairline">
                        <summary className={summaryClass}>
                            {item.question}
                            <span aria-hidden="true" className={markerClass}>
                                +
                            </span>
                        </summary>
                        <div className="space-y-3 pb-6 pr-8">
                            {item.answer.map(paragraph => (
                                <p key={paragraph} className={answerClass}>
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                    </details>
                ))}
            </div>

            {/* Article links (§6c). Plain text list: no cards, no thumbnails. */}
            {portfolioArticles.length >= 3 && (
                <>
                    <h2 className="mb-1 mt-14 text-[13px] font-medium uppercase tracking-[0.14em] text-muted">
                        More on the GP ePortfolio
                    </h2>
                    <ul className="border-b border-hairline">
                        {portfolioArticles.map(article => (
                            <li key={article.slug} className="border-t border-hairline">
                                <Link
                                    href={portfolioArticlePath(article.slug)}
                                    className="block py-3.5 text-[15px] text-body transition-colors hover:text-heading"
                                >
                                    {article.heading}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {/* Footer line (§6d) */}
            <p className="mt-14 text-[14px] leading-relaxed text-muted">
                Preparing for the SCA? We run a{' '}
                <Link
                    href="/sca-cases"
                    className="underline decoration-heading/25 underline-offset-4 transition hover:text-heading"
                >
                    free library of 200 SCA practice stations
                </Link>{' '}
                and a{' '}
                <Link
                    href="/pricing"
                    className="underline decoration-heading/25 underline-offset-4 transition hover:text-heading"
                >
                    full SCA preparation course
                </Link>
                .
            </p>
        </section>
    );
}
