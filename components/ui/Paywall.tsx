'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Container from './Container';
import PrimaryButton from './PrimaryButton';

interface PaywallProps {
  title?: string;
  message?: string;
}

export default function Paywall({
  title = 'Upgrade to Practice',
  message = 'Purchase a plan to start AI consultations and unlock unlimited practice sessions.',
}: PaywallProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 80, damping: 20 }}
    >
      <Container className="text-center py-12">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(180,83,9,0.08)' }}
        >
          <svg
            className="w-7 h-7 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h3 className="text-[18px] font-bold text-heading mb-2">{title}</h3>
        <p className="text-[14px] text-muted max-w-sm mx-auto mb-6 leading-relaxed">
          {message}
        </p>
        <Link href="/pricing">
          <PrimaryButton>View Plans</PrimaryButton>
        </Link>
      </Container>
    </motion.div>
  );
}
