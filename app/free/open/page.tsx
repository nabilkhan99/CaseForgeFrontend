import type { Metadata } from 'next';
import FreeOpen from '@/components/free/FreeOpen';
import { openPrefill, type SearchParams } from '@/lib/trial/freeParams';
import { pageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = pageMetadata({
  title: 'Open your dashboard | Fourteen Fisherman',
  description:
    'Enter the email you used and we will send a 6-digit code, then open your dashboard — your cases, your reports and your board.',
  path: '/free/open',
});

/**
 * The form that used to be /free, at its own address.
 *
 * Reached three ways: the quiet line at the foot of the picker, the portfolio
 * tool's banner (which posts the address itself and arrives with
 * `?email=…&code=sent`, so the code step is already waiting), and links in
 * older emails that still point at `/free?email=…` — which /free redirects
 * here, query intact.
 */
export default async function FreeOpenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { email, codeAlreadySent } = openPrefill(await searchParams);

  return <FreeOpen initialEmail={email} codeAlreadySent={codeAlreadySent} />;
}
