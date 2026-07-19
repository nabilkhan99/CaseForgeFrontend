interface LandingFooterProps {
  note?: string;
}

export default function LandingFooter({ note }: LandingFooterProps) {
  return (
    <footer className="border-t border-[#d9cdb3]/60 py-8 px-6">
      <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <div className="text-center sm:text-left">
          <div className="text-[14px] font-semibold text-heading">Fourteen Fisherman</div>
          <div className="text-[12px] text-muted mt-1">
            Built for GP trainees. © {new Date().getFullYear()}
          </div>
        </div>
        <a
          href="mailto:hello@fourteenfisherman.com"
          className="flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-heading transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 4L12 13L2 4" />
          </svg>
          hello@fourteenfisherman.com
        </a>
      </div>
      {note && (
        <div className="max-w-[1200px] mx-auto mt-4 text-center sm:text-left text-[12px] text-muted">
          {note}
        </div>
      )}
    </footer>
  );
}
