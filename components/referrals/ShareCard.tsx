'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Share2 } from 'lucide-react';

interface ShareCardProps {
  /** The sharer's own /r/CODE link. */
  url: string;
  /** Pre-written pitch, already containing {@link url}. */
  message: string;
}

/**
 * The share controls for /share/[code].
 *
 * Why a page and not a straight wa.me redirect: wa.me always lands on
 * WhatsApp's web interstitial, and inside an email client's in-app browser that
 * page cannot hand off to the installed app, so the user gets an "install
 * WhatsApp" dead end. The native share sheet (navigator.share) has no such
 * problem and offers every app they actually use, not just WhatsApp.
 *
 * Three tiers, because share-sheet support is not universal: native share where
 * it exists, clipboard copy everywhere else, and the raw link rendered on the
 * page so there is always something to select by hand.
 */
export default function ShareCard({ url, message }: ShareCardProps) {
  // navigator.share is missing on most desktop browsers, and referencing it
  // during render would break SSR — resolve it after mount instead.
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  async function share() {
    try {
      // `text` carries the whole pitch including the URL, and `url` is
      // deliberately omitted: when both are supplied, several targets (WhatsApp
      // among them) keep the url and silently drop the text.
      await navigator.share({ text: message });
    } catch {
      // AbortError just means they closed the sheet — nothing to report.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      // Older webviews and any non-secure context reject the async clipboard.
      const el = document.createElement('textarea');
      el.value = message;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
        setCopied(true);
      } catch {
        /* nothing left to try — the link is on screen to select by hand */
      }
      document.body.removeChild(el);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Your referral link</p>

      <p className="mt-3 break-all font-mono text-sm text-heading sm:text-base">{url}</p>

      <div className="mt-7 flex flex-col gap-3">
        {canShare && (
          <button type="button" onClick={share} className="cta-button w-full px-6 py-4 text-[15px]">
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share my link
          </button>
        )}

        <button
          type="button"
          onClick={copy}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-full border px-6 py-4 text-[15px] font-semibold transition-colors ${
            canShare
              ? 'border-heading/15 bg-white text-heading hover:bg-surface-warm'
              : 'border-transparent bg-primary text-white hover:bg-primary/90'
          }`}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy message
            </>
          )}
        </button>
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-muted">
        {copied
          ? 'Paste it into WhatsApp, or wherever your mates are.'
          : 'Copies a ready-written message with your link in it.'}
      </p>
    </motion.div>
  );
}
