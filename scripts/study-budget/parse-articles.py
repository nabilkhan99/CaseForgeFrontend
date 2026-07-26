#!/usr/bin/env python3
"""Convert study-budget-articles-FINAL.md into a typed TS content module.

Per the build package: strip internal notes, keep the prose intact, and pull
out the structured bits (slug/title/meta/h1/dateline/FAQ/sources/CTA) that the
page template and the JSON-LD need.
"""
import json
import re
import sys

SRC = '/Users/nabilkhan/Downloads/study-budget-articles-FINAL.md'
OUT = sys.argv[1]

raw = open(SRC, encoding='utf-8').read()
chunks = re.split(r'^# ARTICLE \d+:', raw, flags=re.M)[1:]

articles = []
for chunk in chunks:
    # --- header block -------------------------------------------------
    slug = re.search(r'^\*\*Slug:\*\*\s*(\S+)', chunk, re.M).group(1).strip()
    title = re.search(r'^\*\*Title:\*\*\s*(.+)$', chunk, re.M).group(1).strip()
    meta = re.search(r'^\*\*Meta:\*\*\s*(.+)$', chunk, re.M).group(1).strip()

    # everything after the header rule
    body_all = chunk.split('---', 1)[1]

    h1 = re.search(r'^# (.+)$', body_all, re.M).group(1).strip()
    after_h1 = body_all.split(h1, 1)[1]

    lines = [l for l in after_h1.split('\n')]
    dateline = ''
    for l in lines:
        if l.strip():
            dateline = l.strip()
            break
    rest = after_h1.split(dateline, 1)[1] if dateline else after_h1

    # --- sources ------------------------------------------------------
    sources = []
    m_src = re.search(r'^\*\*Source:\*\*\s*(.+)$', rest, re.M)
    if m_src:
        for label, href in re.findall(r'\[([^\]]+)\]\(([^)]+)\)', m_src.group(1)):
            sources.append({'label': label.strip(), 'href': href.strip()})
        rest = rest[:m_src.start()] + rest[m_src.end():]

    # --- CTA ----------------------------------------------------------
    # Pulled out BEFORE the FAQ split: the hub puts its CTA above the FAQ,
    # every spoke puts it below, so it has to come off the whole remainder.
    # Keyed on the "[See pricing.]" link rather than an opening phrase: the
    # North West CTA opens "A note on the £500 cap..." (it flags that £599 sits
    # above their ceiling), and how-to-claim has body prose opening "If you
    # need..." that must NOT be mistaken for a CTA.
    cta = ''
    m_cta = re.search(r'^([^\n]*\[See pricing\.\][^\n]*)$', rest, re.M)
    if m_cta:
        cta = m_cta.group(1).strip()
        rest = rest[:m_cta.start()] + rest[m_cta.end():]

    # --- FAQ ----------------------------------------------------------
    faq = []
    m_faq = re.search(r'^\*\*FAQ[^\n]*\*\*\s*$', rest, re.M)
    if m_faq:
        faq_block = rest[m_faq.end():]
        rest = rest[:m_faq.start()]
        # stop the FAQ block at a horizontal rule or the CTA paragraph
        faq_block = re.split(r'^---\s*$', faq_block, flags=re.M)[0]
        pairs = re.findall(r'^\*\*(.+?)\*\*\s*\n((?:(?!^\*\*).*\n?)*)',
                           faq_block, re.M)
        for q, a in pairs:
            a = ' '.join(a.split()).strip()
            if q.strip() and a:
                faq.append({'q': q.strip(), 'a': a})

    # --- body ---------------------------------------------------------
    body = re.sub(r'^---\s*$', '', rest, flags=re.M)
    body = re.sub(r'\n{3,}', '\n\n', body).strip()

    articles.append({
        'slug': slug,
        'title': title,
        'meta': meta,
        'h1': h1,
        'dateline': dateline,
        'body': body,
        'faq': faq,
        'cta': cta,
        'sources': sources,
    })

# sanity gates -----------------------------------------------------------
assert len(articles) == 18, f'expected 18 articles, got {len(articles)}'
for a in articles:
    assert a['slug'].startswith('/study-budget/'), a['slug']
    assert a['title'] and a['meta'] and a['h1'] and a['body'], a['slug']
    banned = re.search(r'\[Internal|not for publication|Flags for Ishaq',
                       a['body'], re.I)
    assert not banned, f"internal note left in {a['slug']}"

header = '''// GENERATED from study-budget-articles-FINAL.md — do not hand-edit.
// Regenerate with scratchpad/parse_sb.py when the master copy changes.

export interface StudyBudgetFaq {
  q: string;
  a: string;
}

export interface StudyBudgetSource {
  label: string;
  href: string;
}

export interface StudyBudgetArticle {
  /** Full path, e.g. "/study-budget/london/". */
  slug: string;
  /** <title> — includes the year suffix. */
  title: string;
  metaDescription: string;
  h1: string;
  /** "Correct as of July 2026 · Reviewed by a GP educator" */
  dateline: string;
  /** Article prose as markdown; rendered to semantic HTML at build time. */
  body: string;
  faq: StudyBudgetFaq[];
  /** Closing pricing paragraph, rendered as a distinct block. */
  cta: string;
  sources: StudyBudgetSource[];
}

'''

body_ts = 'export const STUDY_BUDGET_ARTICLES: StudyBudgetArticle[] = ' + json.dumps(
    [{
        'slug': a['slug'],
        'title': a['title'],
        'metaDescription': a['meta'],
        'h1': a['h1'],
        'dateline': a['dateline'],
        'body': a['body'],
        'faq': a['faq'],
        'cta': a['cta'],
        'sources': a['sources'],
    } for a in articles],
    indent=2, ensure_ascii=False) + ';\n'

footer = '''
/** The hub lives at /study-budget/; everything else is a spoke. */
export const STUDY_BUDGET_HUB = STUDY_BUDGET_ARTICLES[0];
export const STUDY_BUDGET_SPOKES = STUDY_BUDGET_ARTICLES.slice(1);

/** Trailing path segment used as the [slug] route param. */
export function studyBudgetSlugParam(article: StudyBudgetArticle): string {
  return article.slug.replace(/^\\/study-budget\\//, '').replace(/\\/$/, '');
}

export function getStudyBudgetArticle(param: string): StudyBudgetArticle | undefined {
  return STUDY_BUDGET_SPOKES.find((a) => studyBudgetSlugParam(a) === param);
}
'''

open(OUT, 'w', encoding='utf-8').write(header + body_ts + footer)

print(f'wrote {OUT}')
print(f'articles: {len(articles)}')
for a in articles:
    print(f"  {a['slug']:46s} faq={len(a['faq']):2d} src={len(a['sources'])} "
          f"cta={'y' if a['cta'] else 'n'} body={len(a['body'])}")
