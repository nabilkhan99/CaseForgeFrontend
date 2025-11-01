import posthog from 'posthog-js';
import { getUserSession } from './userSession';

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
      });
      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize PostHog:', error);
    }
  }
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  
  try {
    const session = getUserSession();
    const eventData = {
      ...properties,
      session_id: session?.sessionId,
      session_created: session?.createdAt,
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
  
  trackError: (errorType: string, errorMessage: string, context?: Record<string, any>) => {
    trackEvent('error_occurred', {
      error_type: errorType,
      error_message: errorMessage,
      ...context,
    });
  },
};

