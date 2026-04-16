'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TranscriptItem } from '@/lib/clinical-master/types';

interface LiveTranscriptProps {
  items: TranscriptItem[];
  className?: string;
}

export default function LiveTranscript({ items, className = '' }: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className={`text-center py-6 ${className}`}>
        <p className="text-[12px] text-muted">Transcript will appear here...</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={`overflow-y-auto space-y-2 ${className}`}
    >
      <AnimatePresence initial={false}>
        {items.map((item, i) => (
          <motion.div
            key={item.id || `t-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-[1.5] ${
                item.role === 'user'
                  ? 'bg-primary/10 text-heading rounded-br-md'
                  : 'bg-black/[0.04] text-body rounded-bl-md'
              }`}
            >
              {item.content}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
