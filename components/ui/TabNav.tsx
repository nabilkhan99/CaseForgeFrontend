'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  label: string;
  href: string;
  exact?: boolean;
}

interface TabNavProps {
  tabs: Tab[];
  className?: string;
}

export default function TabNav({ tabs, className = '' }: TabNavProps) {
  const pathname = usePathname();

  return (
    <nav className={`flex items-center gap-1 border-b border-black/[0.06] ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname?.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`
              px-4 py-3 text-[13px] font-medium transition-colors duration-150 relative
              ${isActive
                ? 'text-primary'
                : 'text-muted hover:text-heading'
              }
            `}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
