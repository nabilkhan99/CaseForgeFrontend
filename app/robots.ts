import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: ['/', '/sca-cases/', '/gp-portfolio-tool'],
            disallow: ['/admin/', '/dashboard/'],
        },
        sitemap: absoluteUrl('/sitemap.xml'),
    };
}
