# Analytics Setup Guide

This document explains how to configure analytics tracking for the CaseForge application.

## Overview

The application now includes comprehensive analytics tracking using:
- **PostHog**: User behavior tracking, event tracking, and session analytics
- **Vercel Analytics**: Page views, user sessions, and performance metrics
- **Vercel Speed Insights**: Core Web Vitals and performance monitoring

## Environment Variables

Add the following environment variables to your Vercel project:

### Required for PostHog

```bash
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### How to Get PostHog Credentials

1. Sign up for a free account at [posthog.com](https://posthog.com)
2. Create a new project
3. Copy your Project API Key from the project settings
4. Use `https://app.posthog.com` as the host (or your self-hosted URL if applicable)

### Vercel Analytics

Vercel Analytics and Speed Insights are automatically enabled for Vercel deployments. No additional configuration needed.

## Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - Name: `NEXT_PUBLIC_POSTHOG_KEY`
   - Value: Your PostHog project API key
   - Environment: Production, Preview, Development (select all as needed)
4. Click **Save**
5. Redeploy your application for changes to take effect

## What's Being Tracked

### User Sessions
- Unique session IDs generated per browser
- Session creation timestamps
- Returning user identification

### Case Submissions
- Full case description text
- Selected capabilities
- Case description length
- Number of capabilities selected

### Review Generation
- Case titles generated
- Success/failure rates
- Capabilities used in reviews

### Improvements
- Section-level improvements (which sections)
- Full review improvements
- Improvement prompts (full text)
- Prompt lengths

### Copy Actions
- Which sections are copied
- Content length copied

### Errors
- Error types and messages
- Context (which action failed)

### User Journey
- New case actions
- Page views (automatic)
- Navigation patterns (automatic)

## Viewing Analytics Data

### PostHog Dashboard
1. Log in to [app.posthog.com](https://app.posthog.com)
2. Navigate to **Insights** to create custom charts
3. Use **Recordings** to watch user sessions (if enabled)
4. Check **Persons** to see individual user journeys

### Vercel Analytics
1. Go to your Vercel project dashboard
2. Click on the **Analytics** tab
3. View page views, unique visitors, and geographic data

### Vercel Speed Insights
1. Go to your Vercel project dashboard
2. Click on the **Speed Insights** tab
3. View Core Web Vitals and performance metrics

## Privacy Considerations

- User sessions are anonymous (no personal information collected)
- Session IDs are randomly generated UUIDs
- Full text of case descriptions and prompts are captured for analytics
- Users are tracked across visits using browser localStorage
- Data is stored according to PostHog and Vercel privacy policies

## Disabling Analytics

If you need to disable analytics:

1. **Disable PostHog**: Remove the `NEXT_PUBLIC_POSTHOG_KEY` environment variable
2. **Disable Vercel Analytics**: Remove the `<Analytics />` component from `app/layout.tsx`
3. **Disable Speed Insights**: Remove the `<SpeedInsights />` component from `app/layout.tsx`

The application will continue to work normally without any analytics configured.

## Testing Analytics Locally

To test analytics in your local development environment:

1. Create a `.env.local` file in the `CaseForgeFrontend` directory
2. Add your PostHog credentials:
   ```bash
   NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_key
   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
   ```
3. Run `npm run dev`
4. Events will be sent to PostHog from your local environment

**Note**: Vercel Analytics and Speed Insights only work on Vercel deployments, not locally.

## Troubleshooting

### Analytics not showing up in PostHog
- Check that environment variables are set correctly
- Verify PostHog API key is valid
- Check browser console for errors
- Ensure ad blockers aren't blocking PostHog

### TypeScript errors
- Run `npm install` to ensure all packages are installed
- Check that all imports are correct

### Events not being captured
- Events fail silently if PostHog is not configured
- Check browser console for any JavaScript errors
- Verify that the `initAnalytics()` function is being called in `layout.tsx`

## Support

For issues with:
- **PostHog**: Visit [posthog.com/docs](https://posthog.com/docs)
- **Vercel Analytics**: Visit [vercel.com/docs/analytics](https://vercel.com/docs/analytics)
- **Implementation**: Check the source code in `lib/analytics.ts` and `lib/userSession.ts`

