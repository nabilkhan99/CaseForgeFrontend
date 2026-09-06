import posthog from 'posthog-js';
import { createClient } from './supabase/client';

let isInitialized = false;

export const initAnalytics = () => {
  if (typeof window === 'undefined' || isInitialized) return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

  if (posthogKey) {
    try {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: false, // Track events manually for better control
        debug: process.env.NODE_ENV === 'development',
      });
      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize PostHog:', error);
    }
  } else if (process.env.NODE_ENV === 'development') {
    console.warn('PostHog key not found');
  }
};

/**
 * Capture a $pageview for client-side route changes. PostHog only captures
 * the initial full page load on its own, so App Router navigations are
 * invisible without this — AnalyticsWrapper calls it on every pathname change.
 */
export const capturePageview = () => {
  if (typeof window === 'undefined' || !isInitialized) return;
  posthog.capture('$pageview');
};

export const trackEvent = async (eventName: string, properties?: Record<string, string | number | boolean | string[]>) => {
  if (typeof window === 'undefined') return;

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const eventData = {
      ...properties,
      user_id: user?.id,
      user_email: user?.email,
      timestamp: new Date().toISOString(),
    };

    if (isInitialized) {
      posthog.capture(eventName, eventData);
    }
  } catch (error) {
    console.error('Failed to track event:', error);
  }
};

export const analytics = {
  trackCaseSubmitted: (caseDescription: string, capabilities: string[]) => {
    trackEvent('case_submitted', {
      case_description: caseDescription,
      case_length: caseDescription.length,
      capabilities_count: capabilities.length,
      capabilities: capabilities,
    });
  },

  trackReviewGenerated: (caseTitle: string, capabilities: string[]) => {
    trackEvent('review_generated', {
      case_title: caseTitle,
      capabilities: capabilities,
      capabilities_count: capabilities.length,
    });
  },

  trackImprovementRequested: (sectionType: string, prompt: string, isFullReview: boolean = false) => {
    trackEvent('improvement_requested', {
      section_type: sectionType,
      improvement_prompt: prompt,
      prompt_length: prompt.length,
      is_full_review: isFullReview,
    });
  },

  trackCopyAction: (sectionType: string, contentLength: number) => {
    trackEvent('content_copied', {
      section_type: sectionType,
      content_length: contentLength,
    });
  },

  trackNewCaseStarted: () => {
    trackEvent('new_case_started');
  },

  trackError: (errorType: string, errorMessage: string, context?: Record<string, string | number | boolean>) => {
    trackEvent('error_occurred', {
      error_type: errorType,
      error_message: errorMessage,
      ...context,
    });
  },

  trackFeedback: (comment: string, email?: string) => {
    trackEvent('feedback_submitted', {
      comment,
      email: email || 'anonymous',
    });
  },
};


/**
 * How much of their five free stations a buyer had used when they decided.
 *
 * Attached to the buy-path events (`checkout_started`, `purchase`) as
 * `trial_stations_used` and `days_since_first_station`, so the new offer can be
 * measured against the baseline it replaced: 78 verified leads → 4 paid within
 * 30 days, median ~5 days to purchase, 1 station before purchase. Without these
 * two numbers on the sale itself, "how many stations does it take to convince
 * somebody" is unanswerable.
 *
 * Resolved server-side (`GET /api/checkout`) because neither number is visible
 * to the browser: `trial_grants` is readable only by its owner and the
 * consumption count is a join. Returns an EMPTY OBJECT for everybody without a
 * grant — every existing event therefore keeps exactly the properties it has
 * today, and a trial property is present only when it means something.
 *
 * Two safeguards, both because this sits on the path to Stripe:
 *   * the answer is cached for the page load, so a second event does not make a
 *     second round trip;
 *   * the request is abandoned after {@link TRIAL_FUNNEL_TIMEOUT_MS}. A slow
 *     analytics lookup must never be the reason a checkout button feels stuck —
 *     losing the property is a worse report, losing the sale is worse than that.
 */
const TRIAL_FUNNEL_TIMEOUT_MS = 1200;

let trialFunnelCache: Promise<Record<string, number>> | null = null;

export const trialFunnelProperties = (): Promise<Record<string, number>> => {
  if (typeof window === 'undefined') return Promise.resolve({});
  if (trialFunnelCache) return trialFunnelCache;

  trialFunnelCache = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TRIAL_FUNNEL_TIMEOUT_MS);
      const res = await fetch('/api/checkout', { signal: controller.signal }).finally(() =>
        clearTimeout(timer),
      );
      if (!res.ok) return {};
      const data = (await res.json()) as {
        trial?: { trial_stations_used?: number; days_since_first_station?: number | null } | null;
      };
      const trial = data?.trial;
      if (!trial) return {};

      const properties: Record<string, number> = {};
      if (typeof trial.trial_stations_used === 'number') {
        properties.trial_stations_used = trial.trial_stations_used;
      }
      // Null is a real answer — "their window never opened" — and is carried by
      // the property being ABSENT rather than by a zero that would read as
      // "bought on day one".
      if (typeof trial.days_since_first_station === 'number') {
        properties.days_since_first_station = trial.days_since_first_station;
      }
      return properties;
    } catch {
      // A missing property is a gap in a report. An exception here would be a
      // buyer staring at a button that did nothing.
      return {};
    }
  })();

  return trialFunnelCache;
};
