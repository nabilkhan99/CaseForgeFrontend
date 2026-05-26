'use client';

import { motion } from 'framer-motion';

interface WaveformBarsProps {
  active?: boolean;
  bars?: number;
  className?: string;
}

export default function WaveformBars({ active = true, bars = 24, className = '' }: WaveformBarsProps) {
  return (
    <div className={`flex items-end gap-[3px] h-8 ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-primary/50"
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
                  ease: 'easeInOut',
                }
              : {}
          }
          style={{ minHeight: '4px' }}
        />
      ))}
    </div>
  );
}
