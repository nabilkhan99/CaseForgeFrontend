import { permanentRedirect } from 'next/navigation';
import { SCA_PILLAR_PATH } from '@/lib/guides/scaPillarGuide';

// The complete guide now lives at /guides. Permanently redirect the old URL.
export default function LegacyPillarRedirect() {
    permanentRedirect(SCA_PILLAR_PATH);
}
