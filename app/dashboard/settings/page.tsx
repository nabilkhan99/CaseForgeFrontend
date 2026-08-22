'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ACCESS_OPENS_LABEL } from '@/lib/commerce/plans';
import ManageBillingButton from '@/components/commerce/ManageBillingButton';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import SecondaryButton from '@/components/ui/SecondaryButton';
import PageHeader from '@/components/ui/PageHeader';
import type { SubscriptionResponse } from '@/app/api/subscription/route';

// Access windows are 3 calendar months (28 Feb..1 Dec vary in days); the
// progress bar only needs a nominal length, not the exact per-user window.
const NOMINAL_WINDOW_DAYS = 92;

const DAY_MS = 86_400_000;

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // `undefined` until the lookup answers — "No active plan" must never be a
  // loading state.
  const [access, setAccess] = useState<SubscriptionResponse | null | undefined>(undefined);

  const [fullName, setFullName] = useState('');
  const [examDate, setExamDate] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setFullName(user?.user_metadata?.full_name || '');
      setExamDate(user?.user_metadata?.exam_date || '');
      setLoading(false);
    });

    fetch('/api/subscription')
      .then((r) => r.json())
      .then((data) => {
        if (data?.state) setAccess(data as SubscriptionResponse);
      })
      .catch(() => setAccess(null));
  }, [supabase.auth]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    try {
      // Write to user_metadata. supabase-js returns errors rather than
      // throwing, so check both results — a silent failure must not show "Saved".
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          exam_date: examDate,
        },
      });

      // Also write exam_date to profiles table (fix sync bug)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, exam_date: examDate || null }, { onConflict: 'id' });

      if (authError || profileError) {
        setSaveError('Your changes could not be saved. Please try again.');
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError('Your changes could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  const initial = fullName?.charAt(0)?.toUpperCase() || '?';

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage your account preferences"
      />

      {/* Plan Section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
      >
        <Container className="mb-6">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-5">
            Plan
          </div>
          {access === undefined ? (
            <div className="h-16 rounded-xl bg-black/[0.03] animate-pulse" />
          ) : access?.plan ? (() => {
            // Three phases, not a boolean: `none` WITH a plan is a purchase whose
            // window hasn't opened yet (every pre-launch buyer), which is the
            // opposite of "ended". Folding it into `ended` told a customer who
            // paid this morning that their access ended on a date in the future.
            const phase: 'pending' | 'active' | 'ended' =
              access.state === 'active' ? 'active' : access.state === 'read_only' ? 'ended' : 'pending';
            const ended = phase === 'ended';
            const pending = phase === 'pending';
            // Self-Study, still live (active or bought-and-waiting). A lapsed
            // plan is a renewal, not an upgrade, and Complete has nothing above it.
            const canUpgrade =
              !ended && (access.plan === 'self_study' || access.plan === 'self_study_monthly');
            // A Complete bought at checkout picks its coaching day before
            // paying; one upgraded to in Stripe's Portal cannot, so the row
            // lands without a date and the customer books it in the app.
            const needsCoachingDay =
              !ended && access.plan === 'complete' && !access.coachingDay;
            const expiry = access.expiresAt ? new Date(access.expiresAt) : null;
            const renews = access.renewsAt ? new Date(access.renewsAt) : null;
            const renewsDate = renews?.toLocaleDateString('en-GB', {
              // The window ends at 23:59 UTC; format in UTC or BST shows the next day.
              timeZone: 'UTC',
              day: 'numeric',
              month: 'long',
            });
            // Monthly has no expiry to count down to — it runs until canceled.
            const daysRemaining = expiry
              ? Math.ceil((expiry.getTime() - Date.now()) / DAY_MS)
              : null;
            const progress =
              daysRemaining === null || pending
                ? null
                : Math.min(Math.max(((NOMINAL_WINDOW_DAYS - daysRemaining) / NOMINAL_WINDOW_DAYS) * 100, 0), 100);
            const expiryDate = expiry?.toLocaleDateString('en-GB', {
              // The window ends at 23:59 UTC; format in UTC or BST shows the next day.
              timeZone: 'UTC',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });

            return (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #B45309, #D97706)' }}
                  >
                    {access.planName || access.plan}
                  </span>
                  <span
                    className={`text-[12px] font-medium ${ended ? 'text-muted' : pending ? 'text-primary' : 'text-success'}`}
                  >
                    {ended ? 'Ended' : pending ? `Starts ${ACCESS_OPENS_LABEL}` : 'Active'}
                  </span>
                </div>
                <p className="text-[13px] text-muted mb-3">
                  {ended
                    ? `Access ended${expiryDate ? ` on ${expiryDate}` : ''} · your history and feedback stay available`
                    : pending
                      ? `You're in. Your access opens on ${ACCESS_OPENS_LABEL}${expiryDate ? ` and runs to ${expiryDate}` : ''}.`
                    : access.isMonthly
                      ? `Renews monthly${renewsDate ? ` · next payment ${renewsDate}` : ''} · cancel any time`
                      : `Ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} · ${expiryDate} · nothing renews`}
                </p>
                {progress !== null && (
                  <div className="relative h-2 rounded-full bg-black/[0.04] overflow-hidden mb-3">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #B45309, #D97706)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ type: 'spring', stiffness: 40, damping: 20 }}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {/* The generic /pricing link is suppressed once the specific
                      upgrade button is showing: "Extend or upgrade" next to
                      "Upgrade to Complete" is the same offer twice, and the
                      vaguer one sells a whole second plan at £599 instead of
                      switching the one they have. A pending buyer still gets the
                      library link, which is a different destination entirely. */}
                  {(!canUpgrade || pending) && (
                    <Link
                      href={ended ? '/pricing?renew=true' : pending ? '/dashboard/library' : '/pricing'}
                      className="text-[13px] text-primary font-medium hover:underline"
                    >
                      {ended ? 'Renew your access' : pending ? 'Browse the case library' : 'Extend or upgrade'} &rarr;
                    </Link>
                  )}
                  {/* One of the three sanctioned upgrade slots (lectures hero,
                      here, and nowhere on the dashboard home). It opens Stripe's
                      Portal on the plan switcher: the customer pays only for the
                      time left on their term, so no headline price is quoted. */}
                  {canUpgrade && (
                    <ManageBillingButton
                      flow="subscription_update"
                      busyLabel="Opening Stripe…"
                      className="text-[13px] text-primary font-medium hover:underline disabled:opacity-60"
                      errorClassName="text-[12px] text-danger mt-2"
                    >
                      Upgrade to Complete &rarr;
                    </ManageBillingButton>
                  )}
                  {/* Complete without a date: the one thing they still owe us. */}
                  {needsCoachingDay && (
                    <Link
                      href="/dashboard/coaching-day"
                      className="text-[13px] text-primary font-medium hover:underline"
                    >
                      Choose your coaching day &rarr;
                    </Link>
                  )}
                  {/* Every plan is a subscription now, so every plan has a
                      portal: invoices for a study-budget claim, a new card, and
                      — on the rolling plan — cancellation. */}
                  <ManageBillingButton
                    className="text-[13px] text-primary font-medium hover:underline disabled:opacity-60"
                    errorClassName="text-[12px] text-danger mt-2"
                  >
                    Manage billing &rarr;
                  </ManageBillingButton>
                </div>
                <p className="text-[12px] text-muted mt-2">
                  {access.isMonthly
                    ? 'Cancel, change plan or update your card in Stripe’s secure billing portal.'
                    : 'Invoices, receipts and your card live in Stripe’s secure billing portal. Nothing renews — your plan simply ends on the date above.'}
                </p>
              </div>
            );
          })() : (
            <div>
              <p className="text-[15px] font-semibold text-heading mb-1">No active plan</p>
              <p className="text-[13px] text-muted mb-4">
                Purchase a plan to start AI consultations.
              </p>
              <Link href="/pricing">
                <PrimaryButton size="sm">View Plans</PrimaryButton>
              </Link>
            </div>
          )}
          {/* The card above reports what was bought, which for an admin can
              read "Ended" while they can still practise. Say why, rather than
              overwriting the plan's real state with "Active". */}
          {access?.bypass && access.state !== 'active' && (
            <p className="text-[12px] text-muted mt-4 pt-4 border-t border-black/[0.06]">
              Team access &mdash; you can practise regardless of this plan&apos;s state.
            </p>
          )}
        </Container>
      </motion.div>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.06 }}
      >
        <Container className="mb-6">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-5">
            Profile
          </div>

          {/* Avatar + Email */}
          <div className="flex items-center gap-4 pb-5 mb-5 border-b border-black/[0.06]">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-[20px] font-semibold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #B45309)',
                boxShadow: '0 4px 16px rgba(180,83,9,0.2)',
              }}
            >
              {initial}
            </div>
            <div>
              <p className="text-[15px] font-semibold text-heading">{fullName || 'User'}</p>
              <p className="text-[13px] text-muted">{user?.email}</p>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.08em] mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/70 border border-black/[0.06] text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-base md:text-[14px]"
              placeholder="Your full name"
            />
          </div>
        </Container>
      </motion.div>

      {/* Exam Section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.12 }}
      >
        <Container className="mb-6">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-5">
            Exam Preparation
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.08em] mb-2">
              SCA Exam Date
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/70 border border-black/[0.06] text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-base md:text-[14px]"
            />
            <p className="text-[12px] text-muted mt-2">
              Set your exam date to see a countdown on your dashboard.
            </p>
          </div>
        </Container>
      </motion.div>

      {/* Save Button */}
      <motion.div
        className="flex items-center gap-4 mb-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.18 }}
      >
        <PrimaryButton onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </PrimaryButton>
        {saved && (
          <motion.span
            className="flex items-center gap-1.5 text-[13px] font-medium"
            style={{ color: '#16A34A' }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Saved
          </motion.span>
        )}
        {saveError && (
          <motion.span
            className="text-[13px] font-medium text-danger"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {saveError}
          </motion.span>
        )}
      </motion.div>

      {/* Account / Sign Out */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.24 }}
      >
        <Container className="mb-8">
          <div className="text-[10px] font-semibold text-danger uppercase tracking-[0.1em] mb-4">
            Account
          </div>
          <SecondaryButton variant="danger" onClick={handleSignOut}>
            Sign Out
          </SecondaryButton>
        </Container>
      </motion.div>
    </div>
  );
}
