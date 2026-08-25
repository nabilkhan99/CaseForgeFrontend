'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Share2 } from 'lucide-react';

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
 * A single "Share my link" button on every device (Nabil, 2026-08-21). Behind it
 * the behaviour adapts: the native share sheet where one exists, clipboard copy
 * where it doesn't (desktop, and the in-app browsers email clients open links
 * in). Offering a WhatsApp button and a Copy button side by side made the reader
 * choose between two things that amount to the same act. The raw link is
 * rendered above regardless, so there is always something to select by hand.
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

  /**
   * One button, one label, everywhere. It opens the native share sheet where
   * there is one and copies the message where there isn't, rather than making
   * the reader choose between a WhatsApp button and a Copy button that do
   * roughly the same thing. The helper line below says which happened.
   */
  async function handleShare() {
    if (canShare) {
      await share();
      return;
    }
    await copy();
  }

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

      <div className="mt-7">
        <button type="button" onClick={handleShare} className="cta-button w-full px-6 py-4 text-[15px]">
          {copied ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share my link
            </>
          )}
        </button>
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-muted">
        {copied
          ? 'Message copied. Paste it into WhatsApp, or wherever your mates are.'
          : canShare
            ? 'Opens your share sheet with the message ready to send.'
            : 'Copies a ready-written message with your link in it.'}
      </p>
    </motion.div>
  );
}
