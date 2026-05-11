'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import SecondaryButton from '@/components/ui/SecondaryButton';
import PageHeader from '@/components/ui/PageHeader';

interface SubscriptionInfo {
  plan: string;
  status: string;
  expires_at: string;
  purchased_at: string;
  days_remaining: number;
}

const PLAN_NAMES: Record<string, string> = {
  sprint: 'The Sprint',
  standard: 'The Standard',
  mastery: 'The Mastery',
};

const PLAN_DURATIONS: Record<string, number> = {
  sprint: 30,
  standard: 90,
  mastery: 180,
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

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
        if (data.subscription) setSubscription(data.subscription);
      });
  }, [supabase.auth]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setSaved(false);

    try {
      // Write to user_metadata
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          exam_date: examDate,
        },
      });

      // Also write exam_date to profiles table (fix sync bug)
      await supabase
        .from('profiles')
        .upsert({ id: user.id, exam_date: examDate || null }, { onConflict: 'id' });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      if (error instanceof Error) {
        // Handle silently
      }
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
    <div className="max-w-[560px] mx-auto">
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
          {subscription ? (() => {
            const totalDays = PLAN_DURATIONS[subscription.plan] || 90;
            const elapsed = totalDays - subscription.days_remaining;
            const progress = Math.min((elapsed / totalDays) * 100, 100);
            const expiryDate = new Date(subscription.expires_at).toLocaleDateString('en-GB', {
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
                    {PLAN_NAMES[subscription.plan] || subscription.plan}
                  </span>
                  <span className="text-[12px] text-success font-medium">Active</span>
                </div>
                <p className="text-[13px] text-muted mb-3">
                  Expires in {subscription.days_remaining} day{subscription.days_remaining !== 1 ? 's' : ''} &middot; {expiryDate}
                </p>
                <div className="relative h-2 rounded-full bg-black/[0.04] overflow-hidden mb-3">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #B45309, #D97706)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: 'spring', stiffness: 40, damping: 20 }}
                  />
                </div>
                <Link href="/pricing" className="text-[13px] text-primary font-medium hover:underline">
                  Extend or upgrade &rarr;
                </Link>
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
