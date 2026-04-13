import Link from 'next/link';

export default function LandingFooter() {
  return (
    <footer className="border-t border-black/[0.06] py-12 px-6">
      <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <div className="text-center sm:text-left">
          <div className="text-[14px] font-semibold text-heading">Fourteen Fisherman</div>
          <div className="text-[12px] text-muted mt-1">
            Built by GP trainees, for GP trainees. © {new Date().getFullYear()}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/privacy"
            className="text-[13px] text-stone-500 hover:text-heading transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-[13px] text-stone-500 hover:text-heading transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/contact"
            className="text-[13px] text-stone-500 hover:text-heading transition-colors"
          >
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
