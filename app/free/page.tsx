import type { Metadata } from 'next';
import FreeOffer from '@/components/free/FreeOffer';
import { pageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = pageMetadata({
  title: 'Five free SCA stations, marked | Fourteen Fisherman',
  description:
    'Five live 12-minute SCA consultations with an AI patient, marked across the three RCGP domains, free for five days. No card. Your dashboard keeps every result.',
  path: '/free',
});

/**
 * Door (a): the deliberate one.
 *
 * A server shell so the page carries real metadata — it is the destination of
 * the navbar CTA, the hero, the pricing table's Free column and the /try
 * redirect, so it is the most-linked page on the site after the landing page
 * itself. Everything visible is in the client component, which needs the
 * signed-in check for the navbar and holds the sign-up box's state.
 */
export default function FreePage() {
  return <FreeOffer />;
}
