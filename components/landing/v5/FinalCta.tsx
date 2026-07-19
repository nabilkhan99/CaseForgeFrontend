import { ArrowRight } from 'lucide-react';

/**
 * Confetto-style gradient CTA banner — built only from copy that already
 * exists on the page (hero eyebrow, hero subline, hero CTA label).
 */
export default function FinalCta() {
  return (
    <section className="px-5 py-10 sm:px-8 sm:py-16">
      <div
        className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20"
        style={{
          background: 'linear-gradient(135deg, #B45309 0%, #D97706 55%, #EF9F27 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Cpath d='M14 10v8M10 14h8' stroke='%23FFFFFF' stroke-opacity='0.14' stroke-width='1'/%3E%3C/svg%3E\")",
          }}
          aria-hidden="true"
        />

        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/80">
            For GP trainees preparing for the SCA
          </p>
          <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-medium leading-[1.1] tracking-tight text-white sm:text-5xl">
            The only complete{' '}
            <span className="font-[family-name:var(--font-serif)] italic font-normal">
              SCA Course.
            </span>
          </h2>
          <div className="mt-9">
            <a
              href="/try"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-[#854F0B] shadow-elevation-3 transition-transform hover:scale-[1.03]"
            >
              Try Free Mock Station
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
