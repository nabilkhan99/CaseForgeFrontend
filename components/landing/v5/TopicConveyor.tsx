'use client';

import { Marquee } from '@/components/magicui/marquee';

/**
 * A horizontal conveyor of clinical-topic organ icons, sat on the seam where
 * the black hero gives way to the beige page. The badges straddle the crease —
 * a little over half shows above it, the rest dips below — hinting that there
 * is more below the fold.
 */

interface IconProps {
  className?: string;
}

const svg = 'h-8 w-8 sm:h-9 sm:w-9';

function Heart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 20s-6.9-4.4-9-8.4C1.3 8.5 2.8 5 6 5c2 0 3.3 1.3 4 2.5C10.7 6.3 12 5 14 5c3.2 0 4.7 3.5 3 6.6-2.1 4-9 8.4-9 8.4Z" />
    </svg>
  );
}

function Lungs({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 4v4M12 8c-.9.9-2.1 1.2-3 1.2M12 8c.9.9 2.1 1.2 3 1.2" />
      <path d="M9 9.2c-1.6.4-2.9 3.1-3 6.3 0 1.7.3 3.6 1.7 4 1.4.4 2.3-1 2.3-2.6V10.4c0-.9-.6-1.4-1-1.2Z" />
      <path d="M15 9.2c1.6.4 2.9 3.1 3 6.3 0 1.7-.3 3.6-1.7 4-1.4.4-2.3-1-2.3-2.6V10.4c0-.9.6-1.4 1-1.2Z" />
    </svg>
  );
}

function Brain({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 6.2V19" />
      <path d="M12 6.2C11.4 5.1 10.3 4.5 9.1 4.7 7.7 5 6.9 6.3 7.1 7.6 5.9 7.8 5.1 9 5.3 10.2c-1 .7-1.3 2.1-.6 3.1-.4 1.1.2 2.4 1.3 2.9.2 1.2 1.4 2 2.6 1.7 1 .8 2.3.6 3.1-.4" />
      <path d="M12 6.2C12.6 5.1 13.7 4.5 14.9 4.7 16.3 5 17.1 6.3 16.9 7.6c1.2.2 2 1.4 1.8 2.6 1 .7 1.3 2.1.6 3.1.4 1.1-.2 2.4-1.3 2.9-.2 1.2-1.4 2-2.6 1.7-1 .8-2.3.6-3.1-.4" />
    </svg>
  );
}

function Stomach({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8.5 4v2.6c0 1.4 1.1 2.5 2.5 2.5 3.3 0 6 2.4 6 5.5s-2.9 5.9-6 5.9S5 18 5 15c0-1.5.6-2.7 1.6-3.5" />
      <path d="M17 15.2c.9 0 1.6-.7 1.6-1.6" />
    </svg>
  );
}

function Kidney({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14 4c-3.3 0-5.5 3.6-5.5 8s2.2 8 5.5 8c1.9 0 3.2-1.4 3.2-3 0-1.1-.6-1.9-1.4-2.5-.5-.4-.8-.9-.8-1.5s.3-1.1.8-1.5C16.6 8.9 17.2 8.1 17.2 7c0-1.6-1.3-3-3.2-3Z" />
    </svg>
  );
}

function Bone({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 9l6 6" />
      <path d="M9 9a2 2 0 1 0-2.7-2.7A2 2 0 1 0 9 9Z" />
      <path d="M15 15a2 2 0 1 1 2.7 2.7A2 2 0 1 1 15 15Z" />
    </svg>
  );
}

function Eye({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

function Ear({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8.3 20c-1.4-1-1.9-2.9-1.9-4.8 0-1-.5-1.5-1-2.2C4.4 11.6 4 10.4 4 9a5 5 0 0 1 10 0c0 1.5-1 2.6-2.2 3-.8.3-1.3.8-1.3 1.6 0 1.1-.9 2-2 2-.8 0-1.3-.5-1.3-1.2 0-1 .8-1.6 1.6-1.9" />
    </svg>
  );
}

function Tooth({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 4c-2 0-3.6 1.6-3.6 3.9 0 1.2.4 2.4.7 3.8.4 1.9.3 4.1.9 6.3.2 1 .6 2 1.3 2 1.2 0 .8-3.1 1.7-3.1s.5 3.1 1.7 3.1c.7 0 1.1-1 1.3-2 .6-2.2.5-4.4.9-6.3.3-1.4.7-2.6.7-3.8C15.6 5.6 14 4 12 4c-1.2 0-1.8.6-2 .6S9.2 4 8 4Z" />
    </svg>
  );
}

function Droplet({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3.6c3 3.9 5.6 6.9 5.6 9.9A5.6 5.6 0 0 1 6.4 13.5c0-3 2.6-6 5.6-9.9Z" />
    </svg>
  );
}

interface Topic {
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
}

const TOPICS: readonly Topic[] = [
  { label: 'Cardiology', Icon: Heart },
  { label: 'Respiratory', Icon: Lungs },
  { label: 'Neurology', Icon: Brain },
  { label: 'Gastroenterology', Icon: Stomach },
  { label: 'Renal & urology', Icon: Kidney },
  { label: 'Musculoskeletal', Icon: Bone },
  { label: 'Ophthalmology', Icon: Eye },
  { label: 'ENT', Icon: Ear },
  { label: 'Dental', Icon: Tooth },
  { label: 'Dermatology', Icon: Droplet },
];

export default function TopicConveyor() {
  return (
    <section
      aria-label="Clinical topics covered"
      className="relative overflow-hidden bg-[#1C1C1A]"
    >
      {/* Lower beige band the badges dip into — this is the crease. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-[#F7F2E7]"
        aria-hidden="true"
      />

      <Marquee
        pauseOnHover
        duration="42s"
        gap="2.5rem"
        className="relative py-6 sm:py-8 [--gap:2.5rem]"
      >
        {TOPICS.map(({ label, Icon }) => (
          <div
            key={label}
            title={label}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#FFFCF8] text-[#B45309] shadow-elevation-2 ring-1 ring-black/5 sm:h-[84px] sm:w-[84px]"
          >
            <span className="sr-only">{label}</span>
            <Icon className={svg} />
          </div>
        ))}
      </Marquee>
    </section>
  );
}
