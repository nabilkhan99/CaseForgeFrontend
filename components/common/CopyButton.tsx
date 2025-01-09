
'use client';

import { useState, useEffect } from 'react';

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    // Check if clipboard API is supported
    setSupported(!!navigator.clipboard);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  if (!supported) {
    return null;
  }

  return (
    <button
      onClick={handleCopy}
      disabled={copied}
      className={`
        inline-flex items-center px-3 py-1 border border-transparent
        text-sm font-medium rounded-md shadow-sm
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
        ${
          copied
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }
        transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      aria-label={copied ? 'Copied!' : `Copy ${label}`}
    >
      <span className="flex items-center">
        {copied ? (
          <>
            <svg
              className="h-4 w-4 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Copied!</span>
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            <span>Copy</span>
          </>
        )}
      </span>
    </button>
  );
}
