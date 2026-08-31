import type { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { pageMetadata } from '@/lib/seo/site';
import { LEGAL_MARKDOWN } from '@/lib/legal/legalContent';

export const metadata: Metadata = pageMetadata({
  title: 'Legal: Terms, Privacy and Cookies',
  description:
    'Fourteen Fisherman terms and conditions, privacy policy and cookie policy. Operated by Phenolabs Limited.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <div className="min-h-[100dvh] bg-[#F7F2E7] font-sans">
      <LandingNavbar user={null} />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
        <article
          className="prose prose-stone max-w-none
            prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-heading
            prose-h1:text-3xl prose-h1:sm:text-4xl prose-h1:mb-3
            prose-h2:mt-12 prose-h2:text-2xl prose-h2:border-t prose-h2:border-heading/10 prose-h2:pt-10
            prose-h3:mt-8 prose-h3:text-lg
            prose-p:text-body prose-p:leading-relaxed
            prose-li:text-body prose-strong:text-heading
            prose-a:font-medium prose-a:text-primary hover:prose-a:text-heading
            prose-hr:border-heading/10
            prose-table:text-sm prose-th:text-heading prose-td:text-body"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{LEGAL_MARKDOWN}</ReactMarkdown>
        </article>
      </main>
      <LandingFooter />
    </div>
  );
}
