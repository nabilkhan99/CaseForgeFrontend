'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface Breadcrumb {
  label: string;
  href: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, breadcrumbs, children }: PageHeaderProps) {
  return (
    <motion.div
      className="mb-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 80, damping: 20 }}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[12px] text-muted mb-3">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-black/20">&rsaquo;</span>}
              <Link
                href={crumb.href}
                className="hover:text-heading transition-colors"
              >
                {crumb.label}
              </Link>
            </span>
          ))}
        </nav>
      )}

      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[28px] font-bold text-heading tracking-[-0.02em]">{title}</h1>
          {subtitle && (
            <p className="text-[13px] sm:text-[14px] text-muted mt-1">{subtitle}</p>
          )}
        </div>
        {children && <div className="flex flex-shrink-0 items-center gap-3">{children}</div>}
      </div>
    </motion.div>
  );
}
