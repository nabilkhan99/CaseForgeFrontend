# Phase 1: Design System Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT CONTEXT:** This is Phase 1 of a 5-phase product overhaul. Read the full spec at `docs/superpowers/specs/2026-04-13-product-overhaul.md` for the big picture. This phase creates the shared design system — tokens, components, and patterns — that Phases 2–5 depend on.

**Goal:** Create the shared design system foundation (color tokens, typography, UI components, app navbar) that every screen in the product will use, replacing the dark-mode card-grid patterns with warm, editorial, amber-palette components.

**Architecture:** Shared UI components under `components/ui/`, updated Tailwind config and global CSS. Components are presentational with clean prop interfaces. The AppNavbar replaces the DashboardSidebar. All dark-mode CSS is removed.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, Framer Motion, Supabase (auth for AppNavbar)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `tailwind.config.ts` | Add `surface-raised`, update color tokens |
| Modify | `app/globals.css` | Remove dark mode CSS, update variables |
| Create | `components/ui/Container.tsx` | Shared product window container |
| Create | `components/ui/PrimaryButton.tsx` | Amber gradient CTA button |
| Create | `components/ui/SecondaryButton.tsx` | Outlined button |
| Create | `components/ui/ScoreBadge.tsx` | Pass/borderline/fail score pill |
| Create | `components/ui/DomainTag.tsx` | Domain label pill |
| Create | `components/ui/TabNav.tsx` | Horizontal tab navigation bar |
| Create | `components/ui/AppNavbar.tsx` | Authenticated app top navbar (replaces sidebar) |
| Create | `components/ui/PageHeader.tsx` | Consistent page title + subtitle + breadcrumb |
| Create | `components/ui/ConfirmModal.tsx` | Styled confirmation dialog |
| Create | `lib/constants/domains.ts` | Shared domain icons, colors, mappings |
| Modify | `app/dashboard/layout.tsx` | Remove sidebar, use AppNavbar, cream bg |

---

### Task 1: Update Tailwind Config

**Files:**
- Modify: `CaseForgeFrontend/tailwind.config.ts`

- [ ] **Step 1: Update the Tailwind config colors and add surface-raised**

Replace the `colors` block in `theme.extend` with updated tokens:

```typescript
colors: {
  primary: {
    DEFAULT: '#B45309',
    light: '#D97706',
    lighter: '#F59E0B',
  },
  heading: '#1C1917',
  body: '#44403C',
  muted: '#A8A29E',
  surface: {
    DEFAULT: '#FAFAF7',
    raised: '#FFFCF8',
    warm: '#F5F0EB',
  },
  success: '#16A34A',
  danger: '#DC2626',
  border: {
    DEFAULT: 'rgba(0,0,0,0.06)',
    hover: 'rgba(0,0,0,0.10)',
  },
},
```

This adds `surface-raised` (`bg-surface-raised`) and `border` tokens (`border-border`, `border-border-hover`). The existing `surface.alt` is removed (unused).

- [ ] **Step 2: Verify build**

```bash
cd CaseForgeFrontend && npx next build 2>&1 | tail -5
```

Expected: build succeeds (no breaking changes — we added tokens, didn't remove used ones yet).

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add tailwind.config.ts && git commit -m "feat: update Tailwind tokens — add surface-raised, border tokens"
```

---

### Task 2: Update Global CSS

**Files:**
- Modify: `CaseForgeFrontend/app/globals.css`

- [ ] **Step 1: Update CSS custom properties**

Replace the `:root` block (lines 9–22) with:

```css
:root {
  --color-primary: #B45309;
  --color-primary-light: #D97706;
  --color-primary-lighter: #F59E0B;
  --color-heading: #1C1917;
  --color-body: #44403C;
  --color-muted: #A8A29E;
  --color-bg: #FAFAF7;
  --color-bg-raised: #FFFCF8;
  --color-border: rgba(0, 0, 0, 0.06);
  --color-border-hover: rgba(0, 0, 0, 0.1);
  --color-glass: rgba(255, 255, 255, 0.65);
  --color-glass-border: rgba(0, 0, 0, 0.06);
  --color-success: #16A34A;
  --color-danger: #DC2626;
}
```

- [ ] **Step 2: Remove dark mode dashboard styles**

Remove the entire "DASHBOARD STYLES" section (lines 218–233):

```css
/* Remove this entire block: */
.glass-card {
  background: rgba(24, 24, 27, 0.8);
  border: 1px solid rgb(39, 39, 42);
  border-radius: 12px;
}

@media (hover: hover) {
  .glass-card:hover {
    border-color: rgb(63, 63, 70);
    transition: border-color 200ms;
  }
}
```

Replace with a warm version:

```css
.glass-card {
  background: rgba(255, 252, 248, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
}

@media (hover: hover) {
  .glass-card:hover {
    border-color: rgba(0, 0, 0, 0.1);
    transition: border-color 200ms;
  }
}
```

- [ ] **Step 3: Update scrollbar colors**

Replace the dark scrollbar styles (lines 244–260) with warm ones:

```css
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(180, 83, 9, 0.15);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(180, 83, 9, 0.3);
}
```

- [ ] **Step 4: Commit**

```bash
cd CaseForgeFrontend && git add app/globals.css && git commit -m "feat: update global CSS — warm tokens, remove dark glass-card"
```

---

### Task 3: Container Component

**Files:**
- Create: `CaseForgeFrontend/components/ui/Container.tsx`

- [ ] **Step 1: Create the container component**

```tsx
import { ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export default function Container({ children, className = '', padding = 'md' }: ContainerProps) {
  return (
    <div
      className={`rounded-[20px] bg-surface-raised border border-black/[0.06] ${paddingMap[padding]} ${className}`}
      style={{
        boxShadow: '0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)',
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/ui/Container.tsx && git commit -m "feat: add Container UI component"
```

---

### Task 4: Button Components

**Files:**
- Create: `CaseForgeFrontend/components/ui/PrimaryButton.tsx`
- Create: `CaseForgeFrontend/components/ui/SecondaryButton.tsx`

- [ ] **Step 1: Create PrimaryButton**

```tsx
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  className?: string;
}

const sizeMap = {
  sm: 'px-5 py-2 text-[13px]',
  md: 'px-6 py-3 text-[14px]',
  lg: 'px-8 py-4 text-[15px]',
};

export default function PrimaryButton({
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  size = 'md',
  type = 'button',
  className = '',
}: PrimaryButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-semibold text-white rounded-xl cursor-pointer
        transition-opacity
        ${sizeMap[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      style={{
        background: disabled ? '#A8A29E' : 'linear-gradient(135deg, #B45309, #D97706)',
        boxShadow: disabled ? 'none' : '0 4px 12px rgba(180,83,9,0.2)',
      }}
      whileHover={disabled ? {} : { y: -2, boxShadow: '0 6px 20px rgba(180,83,9,0.3)' }}
      whileTap={disabled ? {} : { scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
}
```

- [ ] **Step 2: Create SecondaryButton**

```tsx
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface SecondaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  className?: string;
  variant?: 'outline' | 'ghost' | 'danger';
}

const sizeMap = {
  sm: 'px-4 py-2 text-[13px]',
  md: 'px-5 py-2.5 text-[14px]',
  lg: 'px-6 py-3 text-[15px]',
};

const variantMap = {
  outline: 'border border-black/[0.08] text-body hover:border-black/[0.15] hover:bg-black/[0.02]',
  ghost: 'text-body hover:bg-black/[0.03]',
  danger: 'border border-red-200 text-danger bg-red-50 hover:bg-red-100',
};

export default function SecondaryButton({
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  size = 'md',
  type = 'button',
  variant = 'outline',
  className = '',
}: SecondaryButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-xl cursor-pointer
        transition-all duration-150
        ${sizeMap[size]}
        ${variantMap[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      whileTap={disabled ? {} : { scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add components/ui/PrimaryButton.tsx components/ui/SecondaryButton.tsx && git commit -m "feat: add PrimaryButton and SecondaryButton UI components"
```

---

### Task 5: ScoreBadge and DomainTag Components

**Files:**
- Create: `CaseForgeFrontend/components/ui/ScoreBadge.tsx`
- Create: `CaseForgeFrontend/components/ui/DomainTag.tsx`

- [ ] **Step 1: Create ScoreBadge**

```tsx
interface ScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

function getScoreStyle(score: number) {
  if (score >= 70) return { bg: 'rgba(34,197,94,0.1)', color: '#16A34A', label: 'Pass' };
  if (score >= 50) return { bg: 'rgba(217,119,6,0.1)', color: '#D97706', label: 'Borderline' };
  return { bg: 'rgba(220,38,38,0.1)', color: '#DC2626', label: 'Refer' };
}

export default function ScoreBadge({ score, showLabel = false, size = 'md' }: ScoreBadgeProps) {
  const style = getScoreStyle(score);
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold font-mono rounded-lg ${sizeClass}`}
      style={{ background: style.bg, color: style.color }}
    >
      {score}%
      {showLabel && <span className="font-semibold text-[10px] uppercase">{style.label}</span>}
    </span>
  );
}
```

- [ ] **Step 2: Create DomainTag**

```tsx
interface DomainTagProps {
  name: string;
  size?: 'sm' | 'md';
}

export default function DomainTag({ name, size = 'md' }: DomainTagProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-lg ${sizeClass}`}
      style={{ background: 'rgba(180,83,9,0.06)', color: '#92400E' }}
    >
      {name}
    </span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add components/ui/ScoreBadge.tsx components/ui/DomainTag.tsx && git commit -m "feat: add ScoreBadge and DomainTag UI components"
```

---

### Task 6: TabNav Component

**Files:**
- Create: `CaseForgeFrontend/components/ui/TabNav.tsx`

- [ ] **Step 1: Create the tab navigation component**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/ui/TabNav.tsx && git commit -m "feat: add TabNav UI component"
```

---

### Task 7: PageHeader Component

**Files:**
- Create: `CaseForgeFrontend/components/ui/PageHeader.tsx`

- [ ] **Step 1: Create the page header component**

```tsx
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
              {i > 0 && <span className="text-black/20">›</span>}
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-heading tracking-[-0.02em]">{title}</h1>
          {subtitle && (
            <p className="text-[14px] text-muted mt-1">{subtitle}</p>
          )}
        </div>
        {children && <div className="flex items-center gap-3">{children}</div>}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/ui/PageHeader.tsx && git commit -m "feat: add PageHeader UI component with breadcrumbs"
```

---

### Task 8: ConfirmModal Component

**Files:**
- Create: `CaseForgeFrontend/components/ui/ConfirmModal.tsx`

- [ ] **Step 1: Create the confirmation modal**

```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />

          {/* Modal */}
          <motion.div
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          >
            <div className="rounded-2xl bg-surface-raised border border-black/[0.06] p-6 shadow-elevation-4">
              <h3 className="text-[18px] font-semibold text-heading mb-2">{title}</h3>
              <p className="text-[14px] text-muted mb-6 leading-relaxed">{message}</p>
              <div className="flex items-center gap-3 justify-end">
                <SecondaryButton onClick={onCancel} size="sm">
                  {cancelLabel}
                </SecondaryButton>
                {variant === 'danger' ? (
                  <SecondaryButton onClick={onConfirm} variant="danger" size="sm">
                    {confirmLabel}
                  </SecondaryButton>
                ) : (
                  <PrimaryButton onClick={onConfirm} size="sm">
                    {confirmLabel}
                  </PrimaryButton>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/ui/ConfirmModal.tsx && git commit -m "feat: add ConfirmModal UI component"
```

---

### Task 9: Shared Domain Constants

**Files:**
- Create: `CaseForgeFrontend/lib/constants/domains.ts`

- [ ] **Step 1: Create the shared domain constants file**

This deduplicates the domain icon/color mappings currently repeated across `dashboard/library/page.tsx` and `dashboard/library/[domainId]/page.tsx`.

```typescript
/**
 * Shared domain metadata — icons (as SVG path descriptions) and colors.
 * Used by the library pages and dashboard components.
 */

export const DOMAIN_COLORS = [
  'rgba(180,83,9,0.08)',
  'rgba(34,197,94,0.08)',
  'rgba(59,130,246,0.08)',
  'rgba(168,85,247,0.08)',
  'rgba(236,72,153,0.08)',
  'rgba(245,158,11,0.08)',
  'rgba(20,184,166,0.08)',
  'rgba(99,102,241,0.08)',
  'rgba(239,68,68,0.08)',
  'rgba(16,185,129,0.08)',
  'rgba(251,146,60,0.08)',
  'rgba(139,92,246,0.08)',
];

export const DOMAIN_TEXT_COLORS = [
  '#92400E',
  '#166534',
  '#1E40AF',
  '#6B21A8',
  '#9D174D',
  '#92400E',
  '#115E59',
  '#3730A3',
  '#991B1B',
  '#065F46',
  '#9A3412',
  '#5B21B6',
];

export function getDomainColor(domainName: string, index: number) {
  return {
    bg: DOMAIN_COLORS[index % DOMAIN_COLORS.length],
    text: DOMAIN_TEXT_COLORS[index % DOMAIN_TEXT_COLORS.length],
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add lib/constants/domains.ts && git commit -m "feat: add shared domain color constants (deduplicated)"
```

---

### Task 10: AppNavbar Component

**Files:**
- Create: `CaseForgeFrontend/components/ui/AppNavbar.tsx`

- [ ] **Step 1: Create the authenticated app navbar**

This replaces `DashboardSidebar` as the primary navigation for logged-in users.

```tsx
'use client';

import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const NAV_LINKS = [
  { label: 'Home', href: '/dashboard', exact: true },
  { label: 'Library', href: '/dashboard/library' },
  { label: 'History', href: '/dashboard/history' },
  { label: 'Portfolio', href: '/cases' },
];

export default function AppNavbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { scrollYProgress } = useScroll();

  const navBg = useTransform(
    scrollYProgress,
    [0, 0.02],
    ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.95)']
  );
  const navShadow = useTransform(
    scrollYProgress,
    [0, 0.02],
    ['0 1px 0 rgba(0,0,0,0)', '0 1px 0 rgba(0,0,0,0.06)']
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
        });
      }
    });
  }, []);

  const initial = user?.name?.charAt(0).toUpperCase() || '?';

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname?.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <motion.nav
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={{ maxWidth: 'min(92%, 1200px)', backgroundColor: navBg, boxShadow: navShadow } as any}
        className="w-full backdrop-blur-2xl border border-black/[0.06] rounded-[14px] px-5 py-2.5 flex items-center justify-between"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      >
        {/* Wordmark */}
        <Link href="/dashboard" className="flex items-center cursor-pointer">
          <span className="text-[14px] font-semibold text-heading tracking-tight">
            Fourteen Fisherman
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                isActive(link.href, link.exact)
                  ? 'text-primary bg-primary/[0.06]'
                  : 'text-body hover:text-heading hover:bg-black/[0.03]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side: user avatar */}
        <div className="hidden md:flex items-center gap-3 relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
          >
            {initial}
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="absolute top-12 right-0 w-48 bg-surface-raised border border-black/[0.06] rounded-xl shadow-elevation-3 py-1 z-50"
              >
                <div className="px-3 py-2 border-b border-black/[0.06]">
                  <div className="text-[13px] font-medium text-heading truncate">{user?.name}</div>
                  <div className="text-[11px] text-muted truncate">{user?.email}</div>
                </div>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="block px-3 py-2 text-[13px] text-body hover:text-heading hover:bg-black/[0.03] transition-colors"
                >
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 text-[13px] text-danger hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile hamburger */}
        <motion.button
          className="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-[5px] cursor-pointer"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <motion.span
            className="block w-5 h-[1.5px] bg-heading rounded-full origin-center"
            animate={mobileOpen ? { rotate: 45, y: 3.5 } : { rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          />
          <motion.span
            className="block w-5 h-[1.5px] bg-heading rounded-full"
            animate={mobileOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          />
          <motion.span
            className="block w-5 h-[1.5px] bg-heading rounded-full origin-center"
            animate={mobileOpen ? { rotate: -45, y: -3.5 } : { rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          />
        </motion.button>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="absolute top-14 left-0 right-0 mx-4 glass-panel rounded-2xl p-4 flex flex-col gap-1"
            style={{ maxWidth: 'min(92%, 1200px)', margin: '0 auto' }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-[14px] transition-all duration-150 ${
                  isActive(link.href, link.exact)
                    ? 'text-primary bg-primary/[0.06] font-medium'
                    : 'text-body hover:text-heading hover:bg-black/[0.03]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="my-1 border-t border-black/[0.06]" />
            <Link
              href="/dashboard/settings"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150"
            >
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="px-3 py-2.5 rounded-xl text-[14px] text-left text-danger hover:bg-red-50 transition-all duration-150 cursor-pointer"
            >
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/ui/AppNavbar.tsx && git commit -m "feat: add AppNavbar — replaces DashboardSidebar with floating top nav"
```

---

### Task 11: Update Dashboard Layout

**Files:**
- Modify: `CaseForgeFrontend/app/dashboard/layout.tsx`

- [ ] **Step 1: Replace the dashboard layout**

Replace the entire file content:

```tsx
import AppNavbar from '@/components/ui/AppNavbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface font-sans">
      <AppNavbar />
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-[900px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
```

This removes:
- The dark `bg-[#09090b]` background → warm `bg-surface`
- The sidebar entirely → AppNavbar at top
- The mobile hamburger header → AppNavbar handles mobile
- The `overflow-hidden` constraint → normal scrolling

- [ ] **Step 2: Verify build**

```bash
cd CaseForgeFrontend && npx next build 2>&1 | tail -5
```

Expected: Build succeeds. The dashboard pages will look partially broken (they still reference dark classes internally) but the layout wrapper is now warm cream with top nav. This is expected — Phase 3 will redesign the individual pages.

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/dashboard/layout.tsx && git commit -m "feat: replace dashboard sidebar layout with AppNavbar + cream background"
```

---

### Task 12: Build Verification

- [ ] **Step 1: Run full build**

```bash
cd CaseForgeFrontend && npx next build 2>&1 | tail -10
```

Expected: Build succeeds with no errors. Warnings are acceptable.

- [ ] **Step 2: Run lint**

```bash
cd CaseForgeFrontend && npm run lint 2>&1 | tail -10
```

Fix any lint errors that appear.

- [ ] **Step 3: Verify dev server**

```bash
cd CaseForgeFrontend && rm -rf .next && npm run dev
```

Visit `http://localhost:3000/dashboard` — should show warm cream background with floating pill navbar. Page content may look broken (mixed dark/light) — that's expected before Phase 3.

- [ ] **Step 4: Commit any fixes**

```bash
cd CaseForgeFrontend && git add -A && git commit -m "fix: resolve build errors from Phase 1 design system"
```
