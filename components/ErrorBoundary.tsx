// src/components/ErrorBoundary.tsx
'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        // A client-side crash used to drop the user onto default-Tailwind
        // styling — grey card, red heading, blue button — which reads as a
        // different application. Same surfaces and same amber as everything else.
        <div className="min-h-[100dvh] flex items-center justify-center bg-surface px-6 font-sans">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-black/[0.06] bg-surface-warm">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-primary" aria-hidden="true">
                <path d="M8 5v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <h2 className="mb-2 text-[20px] font-semibold text-heading">Something went wrong</h2>
            <p className="mb-6 text-[14px] leading-[1.65] text-muted">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="min-h-[44px] cursor-pointer rounded-xl px-6 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #B45309, #D97706)',
                boxShadow: '0 4px 12px rgba(180,83,9,0.2)',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;