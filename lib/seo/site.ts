import type { Metadata } from 'next';

export const SITE_URL = 'https://www.fourteenfisherman.com';
export const SITE_NAME = 'Fourteen Fisherman';

export interface OgImage {
    url: string;
    width: number;
    height: number;
    alt: string;
}

// Default social preview (WhatsApp/OG/Twitter) for every page without its own
// override. JPEG, kept under ~300KB — WhatsApp silently drops previews for
// images much over 600KB.
export const DEFAULT_OG_IMAGE: OgImage = {
    url: '/og/sca-default.jpg',
    width: 1200,
    height: 1200,
    alt: 'Fourteen Fisherman — everything you need to pass the SCA',
};

export const ORGANIZATION_JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/fourteenfishermann.png`,
    description:
        'Free SCA practice cases, an AI ePortfolio tool, and AI voice consultation practice for UK GP registrars preparing for the MRCGP SCA.',
};

export function absoluteUrl(path: string) {
    if (path.startsWith('http')) return path;
    return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function pageMetadata({
    title,
    description,
    path,
    type = 'website',
    image = DEFAULT_OG_IMAGE,
}: {
    title: string;
    description: string;
    path: string;
    type?: 'website' | 'article';
    image?: OgImage;
}): Metadata {
    const url = absoluteUrl(path);
    const imageUrl = absoluteUrl(image.url);

    return {
        title,
        description,
        alternates: {
            canonical: url,
        },
        openGraph: {
            type,
            siteName: SITE_NAME,
            title,
            description,
            url,
            images: [
                {
                    url: imageUrl,
                    width: image.width,
                    height: image.height,
                    alt: image.alt,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [imageUrl],
        },
    };
}

/**
 * SoftwareApplication schema for the free GP portfolio tool.
 *
 * Rendered as a raw <script type="application/ld+json"> by the page, following
 * the ORGANIZATION_JSON_LD precedent in app/layout.tsx: Next's Metadata API has
 * no JSON-LD hook, and `pageMetadata` returns a `Metadata` object, so there is
 * nowhere sensible to thread this through it.
 *
 * Deliberately NO FAQPage schema (Google retired FAQ rich results for
 * non-government sites, so it is validation surface for no gain) and NO
 * aggregateRating (rating markup without visible on-page reviews is a manual
 * action risk).
 */
export const PORTFOLIO_TOOL_JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'GP Portfolio Tool',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: `${SITE_URL}/gp-portfolio-tool`,
    description:
        'Free AI tool that generates structured clinical case reviews for the RCGP ePortfolio, mapped to the RCGP capability framework.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
    publisher: { '@type': 'Organization', name: SITE_NAME },
};
