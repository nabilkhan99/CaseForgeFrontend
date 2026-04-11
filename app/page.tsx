'use client';

import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  AnimatePresence,
} from 'framer-motion';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnimatedCounterProps {
  target: number;
  suffix?: string;
  prefix?: string;
}

interface ChatMessage {
  role: 'patient' | 'doctor';
  text: string;
}

// ─── AnimatedCounter ──────────────────────────────────────────────────────────

function AnimatedCounter({ target, suffix = '', prefix = '' }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, { stiffness: 50, damping: 20 });
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (isInView) spring.set(target);
  }, [isInView, spring, target]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (v) => {
      setDisplay(Math.round(v).toString());
    });
    return unsubscribe;
  }, [spring]);

  return (
    <span ref={ref}>
      {prefix}{display}{suffix}
    </span>
  );
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

function WaveformBars({ active = true, bars = 20 }: { active?: boolean; bars?: number }) {
  return (
    <div className="flex items-end gap-[3px] h-8">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-primary/60"
          animate={
            active
              ? {
                  height: [
                    `${20 + Math.sin(i * 0.8) * 16}%`,
                    `${50 + Math.sin(i * 0.5 + 1) * 40}%`,
                    `${20 + Math.sin(i * 0.8) * 16}%`,
                  ],
                }
              : { height: '20%' }
          }
          transition={
            active
              ? {
                  duration: 1.2 + (i % 4) * 0.15,
                  repeat: Infinity,
                  delay: (i % 5) * 0.08,
                  type: 'spring',
                  stiffness: 60,
                  damping: 12,
                }
              : {}
          }
          style={{ minHeight: '4px' }}
        />
      ))}
    </div>
  );
}

// ─── TypingChatSimulation ─────────────────────────────────────────────────────

const CHAT_MESSAGES: ChatMessage[] = [
  { role: 'patient', text: "I've had this headache for three days now. It's quite bad in the mornings." },
  { role: 'doctor', text: "I'm sorry to hear that. Can you tell me where exactly the pain is?" },
  { role: 'patient', text: "It's mostly here, at the back of my head. Sometimes behind my eyes too." },
];

function TypingChat() {
  const [visibleMessages, setVisibleMessages] = useState<number>(0);
  const [typedChars, setTypedChars] = useState<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(true);

  useEffect(() => {
    if (visibleMessages >= CHAT_MESSAGES.length) {
      const reset = setTimeout(() => {
        setVisibleMessages(0);
        setTypedChars(0);
        setIsTyping(true);
      }, 3200);
      return () => clearTimeout(reset);
    }

    const currentMsg = CHAT_MESSAGES[visibleMessages];
    if (!currentMsg) return;

    if (typedChars < currentMsg.text.length) {
      const t = setTimeout(() => setTypedChars((c) => c + 1), 28);
      return () => clearTimeout(t);
    } else {
      setIsTyping(false);
      const t = setTimeout(() => {
        setVisibleMessages((m) => m + 1);
        setTypedChars(0);
        setIsTyping(true);
      }, 900);
      return () => clearTimeout(t);
    }
  }, [visibleMessages, typedChars]);

  return (
    <div className="flex flex-col gap-3 p-4 max-h-[200px] overflow-hidden">
      <AnimatePresence initial={false}>
        {CHAT_MESSAGES.slice(0, visibleMessages).map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            className={`flex ${msg.role === 'doctor' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[82%] px-3 py-2 rounded-2xl text-[11px] leading-[1.5] ${
                msg.role === 'patient'
                  ? 'bg-white/80 border border-black/[0.06] text-body'
                  : 'text-white'
              }`}
              style={
                msg.role === 'doctor'
                  ? { background: 'linear-gradient(135deg, #B45309 0%, #D97706 100%)' }
                  : {}
              }
            >
              {msg.text}
            </div>
          </motion.div>
        ))}
        {visibleMessages < CHAT_MESSAGES.length && isTyping && (
          <motion.div
            key={`typing-${visibleMessages}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            className={`flex ${
              CHAT_MESSAGES[visibleMessages]?.role === 'doctor' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[82%] px-3 py-2 rounded-2xl text-[11px] leading-[1.5] ${
                CHAT_MESSAGES[visibleMessages]?.role === 'patient'
                  ? 'bg-white/80 border border-black/[0.06] text-body'
                  : 'text-white'
              }`}
              style={
                CHAT_MESSAGES[visibleMessages]?.role === 'doctor'
                  ? { background: 'linear-gradient(135deg, #B45309 0%, #D97706 100%)' }
                  : {}
              }
            >
              {CHAT_MESSAGES[visibleMessages]?.text.slice(0, typedChars)}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                className="inline-block w-[2px] h-[10px] bg-current ml-[1px] align-middle"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  // Auth
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
  }, []);

  // Mobile nav
  const [mobileOpen, setMobileOpen] = useState(false);

  // Scroll-driven navbar
  const { scrollYProgress } = useScroll();
  const navBg = useTransform(scrollYProgress, [0, 0.08], ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.95)']);
  const navShadow = useTransform(scrollYProgress, [0, 0.08], ['0 1px 0 rgba(0,0,0,0)', '0 1px 0 rgba(0,0,0,0.06)']);

  // Hero headline words
  const words = ['Practice', 'that', 'actually', 'prepares', 'you.'];
  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.15,
      },
    },
  };
  const wordVariant = {
    hidden: { opacity: 0, y: 22 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 90, damping: 18 } },
  };

  // Feature rows
  const features = [
    {
      number: '01',
      title: 'Voice consultations with real AI patients',
      description:
        'Step into lifelike 12-minute consultations. Our AI patients respond naturally, push back, and escalate — exactly like your SCA exam station.',
      visual: <WaveformBars active={true} bars={18} />,
    },
    {
      number: '02',
      title: 'Instant SCA scoring across all 3 domains',
      description:
        'Every session ends with structured feedback scored on Data Gathering, Clinical Management, and Interpersonal Skills — the exact SCA marking framework.',
      visual: (
        <div className="flex flex-col gap-2 w-full max-w-[140px]">
          {[
            { label: 'Data Gathering', pct: 82 },
            { label: 'Clinical Mgmt', pct: 74 },
            { label: 'Interpersonal', pct: 91 },
          ].map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-mono text-muted uppercase tracking-wide">{item.label}</span>
                <span className="text-[9px] font-mono text-primary font-semibold">{item.pct}%</span>
              </div>
              <div className="h-[3px] w-full bg-black/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #B45309, #F59E0B)' }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${item.pct}%` }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ type: 'spring', stiffness: 50, damping: 18, delay: i * 0.12 }}
                />
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      number: '03',
      title: '78 cases across 12 RCGP domains',
      description:
        'From MSK to mental health, ENT to end of life — our case library covers the full breadth of the RCGP curriculum with new cases added every month.',
      visual: (
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="h-5 w-5 rounded-[4px] border border-black/[0.06]"
              style={{
                background: i < 8 ? `rgba(180, 83, 9, ${0.15 + i * 0.07})` : 'rgba(0,0,0,0.04)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ type: 'spring', stiffness: 140, damping: 16, delay: i * 0.05 }}
            />
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-surface font-sans">

      {/* ── NAVBAR ────────────────────────────────────────────────────── */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <motion.nav
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style={{ maxWidth: 'min(92%, 1200px)', backgroundColor: navBg, boxShadow: navShadow } as any}
          className="w-full backdrop-blur-2xl border border-black/[0.06] rounded-[14px] px-5 py-3 flex items-center justify-between"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
        >
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #B45309 0%, #D97706 100%)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5C4 1.5 1.5 4 1.5 7s2.5 5.5 5.5 5.5 5.5-2.5 5.5-5.5S10 1.5 7 1.5z" stroke="white" strokeWidth="1.2" />
                <path d="M5 7h4M7 5v4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold text-heading tracking-tight">Fourteen Fisherman</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-[13px] text-body hover:text-heading transition-colors duration-150 cursor-pointer">Features</Link>
            <Link href="#cases" className="text-[13px] text-body hover:text-heading transition-colors duration-150 cursor-pointer">Cases</Link>
            <Link href="#pricing" className="text-[13px] text-body hover:text-heading transition-colors duration-150 cursor-pointer">Pricing</Link>
            <div className="w-px h-4 bg-black/10" />
            {user ? (
              <Link href="/dashboard">
                <motion.div
                  className="primary-button text-[13px] !py-2 !px-5"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Dashboard
                </motion.div>
              </Link>
            ) : (
              <>
                <Link href="/auth/sign-in" className="text-[13px] text-body hover:text-heading transition-colors duration-150 cursor-pointer">Sign in</Link>
                <Link href="/auth/sign-up">
                  <motion.div
                    className="primary-button text-[13px] !py-2 !px-5"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Start free
                  </motion.div>
                </Link>
              </>
            )}
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
              className="absolute top-16 left-0 right-0 mx-4 glass-panel rounded-2xl p-4 flex flex-col gap-1"
              style={{ maxWidth: 'min(92%, 1200px)', margin: '0 auto' }}
            >
              {['Features', 'Cases', 'Pricing'].map((item) => (
                <Link
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150 cursor-pointer"
                >
                  {item}
                </Link>
              ))}
              <div className="my-1 border-t border-black/[0.06]" />
              {user ? (
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                  <div className="primary-button text-[14px] w-full justify-center">Dashboard</div>
                </Link>
              ) : (
                <>
                  <Link href="/auth/sign-in" onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150 cursor-pointer">Sign in</Link>
                  <Link href="/auth/sign-up" onClick={() => setMobileOpen(false)}>
                    <div className="primary-button text-[14px] w-full justify-center mt-1">Start free</div>
                  </Link>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-32 pb-20 px-6 overflow-hidden">
        {/* Ambient orbs */}
        <div
          className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(180,83,9,0.07) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[10%] left-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 max-w-[1200px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left column */}
          <div>
            {/* Eyebrow */}
            <motion.div
              className="flex items-center gap-3 mb-8"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.05 }}
            >
              <div
                className="h-px flex-shrink-0 w-8"
                style={{ background: 'linear-gradient(90deg, transparent, #B45309)' }}
              />
              <span className="text-[11px] font-mono font-medium tracking-[0.14em] uppercase text-primary">
                SCA Exam Preparation
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="text-[56px] sm:text-[64px] lg:text-[72px] font-bold text-heading tracking-[-0.03em] leading-[1.05] mb-7 flex flex-wrap gap-x-[0.22em]"
              variants={container}
              initial="hidden"
              animate="show"
            >
              {words.map((word, i) => (
                <motion.span
                  key={i}
                  variants={wordVariant}
                  className={word === 'actually' ? 'gradient-text' : ''}
                  style={{ display: 'inline-block' }}
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            {/* Body copy */}
            <motion.p
              className="text-[18px] text-body leading-[1.7] max-w-[440px] mb-10"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 70, damping: 18, delay: 0.65 }}
            >
              AI-powered voice consultations that mirror real SCA stations — with instant scoring
              on every domain, so you know exactly where you stand.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-wrap items-center gap-5 mb-12"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 70, damping: 18, delay: 0.78 }}
            >
              <Link href={user ? '/dashboard' : '/auth/sign-up'}>
                <motion.div
                  className="primary-button text-[15px] !px-8 !py-4 cursor-pointer"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Start practising free
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.div>
              </Link>
              <motion.a
                href="#features"
                className="group flex items-center gap-2 text-[14px] font-medium text-body hover:text-heading transition-colors duration-150 cursor-pointer"
                whileHover="hover"
              >
                See how it works
                <motion.span
                  variants={{ hover: { x: 4 } }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7h9M8 3.5l3.5 3.5L8 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.span>
              </motion.a>
            </motion.div>

            {/* Trust dots */}
            <motion.div
              className="flex flex-wrap items-center gap-x-6 gap-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.95, duration: 0.5 }}
            >
              {[
                'No credit card',
                'Built by GP trainees',
                '12-min sessions',
                'Free tier forever',
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-[12px] text-muted">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.4" />
                    <path d="M3.5 6l1.8 1.8 3.2-3.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right column — product preview */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 60, damping: 20, delay: 0.3 }}
          >
            <motion.div
              className="relative glass-panel rounded-3xl shadow-elevation-4 overflow-hidden"
              style={{ rotate: 1 }}
              whileHover={{ rotate: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            >
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.06]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-black/[0.04] text-[11px] font-mono text-muted">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <circle cx="5" cy="5" r="4" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
                      <path d="M3 5h4" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                    Station 14 — Mrs. Thompson
                  </div>
                </div>
              </div>

              {/* Patient header */}
              <div className="px-5 pt-4 pb-3 border-b border-black/[0.04]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-semibold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #B45309 0%, #F59E0B 100%)' }}
                  >
                    MT
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-heading">Mrs. Margaret Thompson</div>
                    <div className="text-[11px] text-muted">62F · Headache · Station 14</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-[11px] font-mono text-primary">
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-success"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    LIVE
                  </div>
                </div>
              </div>

              {/* Chat bubbles */}
              <div className="bg-surface/80">
                <TypingChat />
              </div>

              {/* Waveform bar */}
              <div className="px-5 py-3 border-t border-black/[0.04] flex items-center gap-3 bg-white/60">
                <div className="flex-1">
                  <WaveformBars active={true} bars={28} />
                </div>
                <button
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #B45309, #D97706)' }}
                >
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="white">
                    <path d="M5 0C3.35 0 2 1.35 2 3v5c0 1.65 1.35 3 3 3s3-1.35 3-3V3c0-1.65-1.35-3-3-3z" />
                  </svg>
                </button>
                <span className="text-[11px] font-mono text-muted w-12 text-right">08:34</span>
              </div>
            </motion.div>

            {/* Floating score card */}
            <motion.div
              className="absolute -bottom-6 -right-6 glass-panel rounded-2xl p-4 shadow-elevation-3"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 140, damping: 14, delay: 0.8 }}
              whileHover={{ y: -3 }}
            >
              <div className="text-[10px] font-mono uppercase tracking-wide text-muted mb-2">Session Score</div>
              <div className="flex items-end gap-1.5 mb-1">
                <span
                  className="text-[32px] font-bold leading-none"
                  style={{ background: 'linear-gradient(135deg, #B45309, #D97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                >
                  78
                </span>
                <span className="text-[14px] text-muted mb-1">/ 100</span>
              </div>
              <div className="flex gap-1">
                {['DG', 'CM', 'IS'].map((label, i) => (
                  <div
                    key={label}
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                    style={{
                      background: `rgba(180, 83, 9, ${0.1 + i * 0.04})`,
                      color: '#B45309',
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Floating domain pill */}
            <motion.div
              className="absolute -top-4 -left-4 glass-panel rounded-xl px-3 py-2 shadow-elevation-2 flex items-center gap-2"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 140, damping: 14, delay: 1.0 }}
            >
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-[11px] font-medium text-body">78 cases ready</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── DIVIDER ───────────────────────────────────────────────────── */}
      <div id="features" className="relative flex items-center justify-center py-12 px-6">
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 overflow-hidden">
          <motion.svg
            viewBox="0 0 1200 2"
            className="w-full"
            style={{ overflow: 'visible' }}
          >
            <motion.line
              x1="600" y1="1" x2="0" y2="1"
              stroke="rgba(0,0,0,0.08)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
            />
            <motion.line
              x1="600" y1="1" x2="1200" y2="1"
              stroke="rgba(0,0,0,0.08)"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
            />
          </motion.svg>
        </div>
        <motion.span
          className="relative bg-surface z-10 px-5 text-[11px] font-mono uppercase tracking-[0.16em] text-muted"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          How it works
        </motion.span>
      </div>

      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto px-6 pb-28">
        {/* Intro */}
        <motion.div
          className="mb-16 max-w-[560px]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ type: 'spring', stiffness: 70, damping: 18 }}
        >
          <h2 className="text-[42px] font-bold text-heading tracking-[-0.025em] leading-[1.1] mb-5">
            Everything you need to{' '}
            <span className="gradient-text">pass first time.</span>
          </h2>
          <p className="text-[16px] text-body leading-[1.75]">
            Built by GP trainees who failed their SCA. We know exactly what&apos;s missing from
            standard revision — and we built it.
          </p>
        </motion.div>

        {/* Feature rows */}
        <div className="flex flex-col">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              className="group relative grid grid-cols-1 md:grid-cols-[80px_1fr_200px] gap-6 md:gap-10 py-10 border-t border-black/[0.06] items-start cursor-default overflow-hidden"
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ type: 'spring', stiffness: 70, damping: 18, delay: i * 0.1 }}
              whileHover="hover"
            >
              {/* Hover wash */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                variants={{ hover: { opacity: 1 }, initial: { opacity: 0 } }}
                initial="initial"
                style={{ background: 'linear-gradient(90deg, rgba(180,83,9,0.03) 0%, transparent 60%)' }}
                transition={{ duration: 0.25 }}
              />

              {/* Number */}
              <div className="text-[60px] font-bold font-mono text-black/[0.04] leading-none select-none pt-1 md:text-right">
                {feature.number}
              </div>

              {/* Text */}
              <div>
                <h3 className="text-[22px] font-semibold text-heading tracking-[-0.015em] leading-[1.2] mb-3">
                  {feature.title}
                </h3>
                <p className="text-[15px] text-body leading-[1.75] max-w-[480px]">
                  {feature.description}
                </p>
              </div>

              {/* Visual */}
              <div className="flex items-center justify-start md:justify-end pt-1">
                {feature.visual}
              </div>
            </motion.div>
          ))}

          {/* Bottom border */}
          <div className="border-t border-black/[0.06]" />
        </div>
      </section>

      {/* ── NUMBERS ───────────────────────────────────────────────────── */}
      <section id="cases" className="py-6">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="border-t border-black/[0.06]" />
          <div className="grid grid-cols-2 md:grid-cols-4 py-14 gap-8">
            {[
              { target: 78, suffix: '', label: 'Case stations' },
              { target: 12, suffix: '', label: 'RCGP domains' },
              { target: 3, suffix: '', label: 'SCA domains scored' },
              { target: 12, suffix: 'min', label: 'Per session' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className="flex flex-col items-start"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ type: 'spring', stiffness: 70, damping: 18, delay: i * 0.1 }}
              >
                <div className="text-[56px] font-bold font-mono text-heading leading-none tracking-[-0.03em] mb-2">
                  <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                </div>
                <div className="text-[13px] text-muted">{stat.label}</div>
              </motion.div>
            ))}
          </div>
          <div className="border-b border-black/[0.06]" />
        </div>
      </section>

      {/* ── TESTIMONIAL ───────────────────────────────────────────────── */}
      <motion.section
        className="max-w-[1200px] mx-auto px-6 py-28 relative"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ type: 'spring', stiffness: 70, damping: 20 }}
      >
        {/* Giant quote mark */}
        <div
          className="absolute top-16 left-6 text-[200px] font-serif text-primary/[0.04] leading-none pointer-events-none select-none"
          aria-hidden="true"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          &ldquo;
        </div>

        <div className="relative z-10 max-w-[760px]">
          <blockquote className="text-[28px] sm:text-[32px] font-semibold text-heading tracking-[-0.025em] leading-[1.4] mb-8">
            I failed my SCA first time. After two weeks with Fourteen Fisherman,
            the second attempt felt{' '}
            <span className="gradient-text">completely different.</span>
          </blockquote>
          <cite className="flex items-center gap-3 not-italic">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-semibold"
              style={{ background: 'linear-gradient(135deg, #B45309 0%, #D97706 100%)' }}
            >
              JC
            </div>
            <div>
              <div className="text-[14px] font-semibold text-body">Dr. James Chen</div>
              <div className="text-[12px] text-muted">ST3, Yorkshire</div>
            </div>
          </cite>
        </div>
      </motion.section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden">
        {/* Ambient orb */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 60%, rgba(180,83,9,0.06) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ type: 'spring', stiffness: 70, damping: 18 }}
          >
            <h2 className="text-[48px] sm:text-[58px] font-bold text-heading tracking-[-0.03em] leading-[1.05] mb-6">
              Your SCA pass starts{' '}
              <span className="gradient-text">today.</span>
            </h2>
            <p className="text-[17px] text-body leading-[1.7] max-w-[480px] mx-auto mb-10">
              Join trainees who replaced passive reading with active voice practice.
              No credit card. Free tier forever.
            </p>

            <Link href={user ? '/dashboard' : '/auth/sign-up'}>
              <motion.div
                className="primary-button text-[16px] !px-10 !py-4 inline-flex cursor-pointer"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                Start practising free
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.div>
            </Link>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {[
                'No credit card required',
                'Cancel any time',
                'Free tier forever',
              ].map((item) => (
                <span key={item} className="flex items-center gap-2 text-[13px] text-muted">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #B45309 0%, #D97706 100%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5C4 1.5 1.5 4 1.5 7s2.5 5.5 5.5 5.5 5.5-2.5 5.5-5.5S10 1.5 7 1.5z" stroke="white" strokeWidth="1.4" />
                <path d="M5 7h4M7 5v4" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-body">Fourteen Fisherman</span>
          </Link>
          <nav className="flex items-center gap-6">
            {['Features', 'Pricing', 'Privacy', 'Terms'].map((item) => (
              <Link
                key={item}
                href={`/${item.toLowerCase()}`}
                className="text-[12px] text-muted hover:text-body transition-colors duration-150 cursor-pointer"
              >
                {item}
              </Link>
            ))}
          </nav>
          <span className="text-[12px] text-muted">
            &copy; {new Date().getFullYear()} Fourteen Fisherman
          </span>
        </div>
      </footer>

    </div>
  );
}
