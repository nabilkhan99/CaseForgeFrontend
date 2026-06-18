import type { Metadata } from 'next';

export const SITE_URL = 'https://www.fourteenfisherman.com';
export const SITE_NAME = 'Fourteen Fisherman';
export const DEFAULT_OG_IMAGE = '/opengraph-image.png';

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
}: {
    title: string;
    description: string;
    path: string;
    type?: 'website' | 'article';
}): Metadata {
    const url = absoluteUrl(path);

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
                    url: DEFAULT_OG_IMAGE,
                    width: 1200,
                    height: 630,
                    alt: 'Fourteen Fisherman Clinical Master for SCA prep',
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [DEFAULT_OG_IMAGE],
        },
    };
}
