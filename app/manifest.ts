import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fourteen Fisherman',
    short_name: 'Fourteen Fisherman',
    description:
      'AI patient consultations, realistic GP scenarios, and scored feedback for SCA exam practice.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAFAF7',
    theme_color: '#B45309',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
