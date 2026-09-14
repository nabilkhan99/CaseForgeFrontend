import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: ['/', '/sca-cases/', '/gp-portfolio-tool'],
            // /try/ is the guest consultation lane: /try/talk opens a real,
            // paid-for consultation on a GET, and the report links under it
            // belong to the people who sat them.
            disallow: ['/admin/', '/dashboard/', '/try/'],
        },
        sitemap: absoluteUrl('/sitemap.xml'),
    };
}
