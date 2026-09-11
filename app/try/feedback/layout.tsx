import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

/**
 * A mark, and a name for the tab. That is the whole header.
 *
 * The post-call page had neither: no brand anywhere on it, and a tab reading
 * "Fourteen Fisherman — The Complete SCA Course" over a form asking for a
 * password. Somebody who arrived from /free through a one-click consultation
 * has, at this point, seen no logo since the landing page and is being asked
 * for an address; a page with nothing on it saying whose it is asks for more
 * trust than it offers.
 *
 * No nav, deliberately. Every link here is a way out of the single conversion
 * point in the guest funnel, and the page already carries the two that are
 * worth having ("Sign in", and the case itself when the run was too short).
 * The mark goes to /free because that is where this visitor came from and the
 * only place a link from here should take them — the five cases.
 */
export const metadata: Metadata = {
  // Absolute: the site template ("%s | Fourteen Fisherman") would make the tab
  // longer than the instruction it is giving.
  title: { absolute: 'Set up your free account' },
};

export default function TryFeedbackLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="px-5 pt-6 sm:px-8">
        <Link href="/free" className="inline-flex items-center" aria-label="Fourteen Fisherman">
          <Image
            src="/fourteenfishermann.png"
            alt="Fourteen Fisherman"
            width={280}
            height={32}
            priority
            className="h-6 w-auto brightness-0"
          />
        </Link>
      </header>
      {children}
    </>
  );
}
