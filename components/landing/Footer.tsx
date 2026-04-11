import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="max-w-[1200px] mx-auto px-12 py-8">
      <div className="border-t border-black/[0.05] pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="font-bold text-[13px] text-heading">Fourteen Fisherman</span>
        <div className="flex gap-6">
          {[
            { label: 'Pricing', href: '/pricing' },
            { label: 'Cases', href: '/cases' },
            { label: 'Privacy', href: '/privacy-policy' },
            { label: 'Terms', href: '/terms-of-service' },
          ].map((link) => (
            <Link key={link.href} href={link.href} className="text-[12px] text-muted hover:text-primary transition-colors">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
