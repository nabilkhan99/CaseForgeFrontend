import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LandingFooter from '@/components/landing/LandingFooter';
import LandingNavbar from '@/components/landing/LandingNavbar';
import StudyBudgetTracker from '@/components/study-budget/StudyBudgetTracker';
import type { StudyBudgetArticle } from '@/lib/study-budget/content';
import { STUDY_BUDGET_HUB } from '@/lib/study-budget/content';
import { neighbourLinks, SUPPORT_LINKS } from '@/lib/study-budget/related';

/**
 * Shared page body for every /study-budget/ page.
 *
 * The build package asks for semantic HTML with one h1, question-phrased h2s
 * and the short-answer paragraph as a plain <p> — so the prose renders through
 * ReactMarkdown to real heading/paragraph/list elements rather than being
 * fragmented into cards.
 */
export default function StudyBudgetArticleView({
  article,
  deaneryId,
  children,
}: {
  article: StudyBudgetArticle;
  /** When set, the checker mounts pre-selected on this deanery. */
  deaneryId?: string;
  /** Hub-only extras (the deanery index), rendered above the FAQ. */
  children?: React.ReactNode;
}) {
  const isHub = article.slug === STUDY_BUDGET_HUB.slug;

  return (
    <div className="min-h-[100dvh] bg-[#f4efe6] text-body">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-heading focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <LandingNavbar user={null} />

      <header className="border-b border-[#e2d8c8] px-5 pb-10 pt-32 sm:px-8 md:pb-12">
        <div className="mx-auto max-w-[760px]">
          <nav
            className="text-xs font-bold uppercase tracking-[0.16em] text-muted"
            aria-label="Breadcrumb"
          >
            <Link href="/" className="hover:text-heading">
              Home
            </Link>
            {isHub ? (
              <span> / Study budget</span>
            ) : (
              <>
                <span> / </span>
                <Link href={STUDY_BUDGET_HUB.slug} className="hover:text-heading">
                  Study budget
                </Link>
              </>
            )}
          </nav>
          <h1 className="mt-6 [font-family:var(--font-serif)] text-[32px] font-semibold leading-[1.08] tracking-tight text-heading md:text-[46px]">
            {article.h1}
          </h1>
          <p className="mt-5 text-sm text-muted">{article.dateline}</p>
        </div>
      </header>

      <main id="main" className="px-5 py-12 sm:px-8">
        <article className="mx-auto max-w-[760px]">
          <div className="study-budget-prose">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children: c }) => (
                  <h2 className="mt-11 [font-family:var(--font-serif)] text-[26px] font-semibold leading-snug tracking-tight text-heading md:text-[32px]">
                    {c}
                  </h2>
                ),
                h3: ({ children: c }) => (
                  <h3 className="mt-8 text-lg font-semibold text-heading">{c}</h3>
                ),
                p: ({ children: c }) => (
                  <p className="mt-5 text-[17px] leading-[1.75] text-body">{c}</p>
                ),
                ul: ({ children: c }) => (
                  <ul className="mt-5 list-disc space-y-2 pl-6 text-[17px] leading-[1.75] text-body">
                    {c}
                  </ul>
                ),
                ol: ({ children: c }) => (
                  <ol className="mt-5 list-decimal space-y-2 pl-6 text-[17px] leading-[1.75] text-body">
                    {c}
                  </ol>
                ),
                strong: ({ children: c }) => (
                  <strong className="font-semibold text-heading">{c}</strong>
                ),
                a: ({ href, children: c }) => {
                  const url = href ?? '#';
                  const external = /^https?:\/\//.test(url);
                  return (
                    <a
                      href={url}
                      className="font-medium text-primary underline underline-offset-2 hover:text-heading"
                      {...(external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {c}
                    </a>
                  );
                },
                blockquote: ({ children: c }) => (
                  <blockquote className="mt-6 border-l-4 border-primary/40 bg-[#fbf8f2] px-5 py-3 text-[17px] italic leading-[1.7] text-body">
                    {c}
                  </blockquote>
                ),
              }}
            >
              {article.body}
            </ReactMarkdown>
          </div>

          {children}

          {/* DEV-HANDOFF §2/§7: the widget sits inside "How to claim" (the last
              H2 on every deanery page) and BEFORE the soft pricing CTA.
              Spokes pre-select with the email pane open; the hub shows the
              dropdown prompt; support pages mount nothing. */}
          {deaneryId ? <StudyBudgetTracker defaultDeanery={deaneryId} emailOpen /> : null}
          {isHub ? <StudyBudgetTracker /> : null}

          {article.cta ? (
            <aside className="mt-12 rounded-2xl border border-[#e0d4bd] bg-[#fbf6ec] p-6 sm:p-7">
              <div className="study-budget-prose">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children: c }) => (
                      <p className="text-[16px] leading-[1.7] text-body">{c}</p>
                    ),
                    a: ({ href, children: c }) => (
                      <a
                        href={href ?? '#'}
                        className="font-semibold text-primary underline underline-offset-2 hover:text-heading"
                      >
                        {c}
                      </a>
                    ),
                  }}
                >
                  {article.cta}
                </ReactMarkdown>
              </div>
            </aside>
          ) : null}
        </article>
      </main>

      {article.faq.length > 0 ? (
        <section className="px-5 pb-14 sm:px-8">
          <div className="mx-auto max-w-[760px]">
            <h2 className="[font-family:var(--font-serif)] text-[26px] font-semibold tracking-tight text-heading md:text-[32px]">
              Common questions
            </h2>
            <dl className="mt-6 divide-y divide-[#e2d8c8] border-y border-[#e2d8c8]">
              {article.faq.map((item) => (
                <div key={item.q} className="py-5">
                  <dt className="text-[17px] font-semibold text-heading">{item.q}</dt>
                  {/* Answers carry inline markdown links to sibling pages. */}
                  <dd className="mt-2 text-[17px] leading-[1.75] text-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children: c }) => <p>{c}</p>,
                        a: ({ href, children: c }) => (
                          <a
                            href={href ?? '#'}
                            className="font-medium text-primary underline underline-offset-2 hover:text-heading"
                            {...(/^https?:\/\//.test(href ?? '')
                              ? { target: '_blank', rel: 'noopener noreferrer' }
                              : {})}
                          >
                            {c}
                          </a>
                        ),
                      }}
                    >
                      {item.a}
                    </ReactMarkdown>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ) : null}

      {/* DEV-HANDOFF §9: each spoke points at the hub, 2-3 neighbouring
          deaneries, and the support pages. Kept light — this is acquisition,
          not a funnel. */}
      {deaneryId ? (
        <section className="px-5 pb-14 sm:px-8">
          <div className="mx-auto max-w-[760px]">
            <h2 className="[font-family:var(--font-serif)] text-[26px] font-semibold tracking-tight text-heading md:text-[32px]">
              Training somewhere else?
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2">
              {neighbourLinks(deaneryId).map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-block rounded-full border border-[#e2d8c8] bg-white/70 px-4 py-2 text-[14px] font-medium text-heading transition-colors hover:border-primary/40 hover:bg-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={STUDY_BUDGET_HUB.slug}
                  className="inline-block rounded-full border border-[#e2d8c8] bg-white/70 px-4 py-2 text-[14px] font-medium text-heading transition-colors hover:border-primary/40 hover:bg-white"
                >
                  All deaneries
                </Link>
              </li>
            </ul>

            <ul className="mt-6 space-y-2">
              {SUPPORT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[16px] font-medium text-primary underline underline-offset-2 hover:text-heading"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {article.sources.length > 0 ? (
        <section className="px-5 pb-16 sm:px-8">
          <div className="mx-auto max-w-[760px] text-sm leading-relaxed text-muted">
            <span className="font-semibold text-heading">Source: </span>
            {article.sources.map((source, i) => (
              <span key={source.href}>
                {i > 0 ? ' · ' : ''}
                <a
                  href={source.href}
                  className="underline underline-offset-2 hover:text-heading"
                  {...(/^https?:\/\//.test(source.href)
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {source.label}
                </a>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <LandingFooter />
    </div>
  );
}
