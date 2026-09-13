import type { Metadata } from 'next';
import { DEFAULT_OG_IMAGE, pageMetadata } from '@/lib/seo/site';

/**
 * Metadata for `/coaching-session`. The page itself is a client component, so
 * it cannot export `metadata`; this layout carries it instead.
 *
 * The description is the spec's shared string, identical on the homepage, and
 * `pageMetadata` writes it to the meta, Open Graph and Twitter descriptions
 * together so they cannot drift. The title runs through the root layout's
 * "%s | Fourteen Fisherman" template.
 */
const COACHING_SESSION_DESCRIPTION =
  'AI practice on 200 stations, 8.5 hours of on-demand lectures and a 3 hour one to one coaching session. Fail your SCA after passing all 200 stations, and we pay you £500.';

export const metadata: Metadata = pageMetadata({
  title: 'Choose your coaching date',
  description: COACHING_SESSION_DESCRIPTION,
  path: '/coaching-session',
  // Same social image as every other page, with alt text that follows this
  // change's no dash copy rule.
  image: { ...DEFAULT_OG_IMAGE, alt: 'Fourteen Fisherman: everything you need to pass the SCA' },
});

export default function CoachingSessionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
