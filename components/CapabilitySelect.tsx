// src/components/CapabilitySelect.tsx
// 'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface CapabilitySelectProps {
  selectedCapabilities: string[];
  onChange: (capabilities: string[]) => void;
  disabled?: boolean;
}

export function CapabilitySelect({
  selectedCapabilities,
  onChange,
  disabled = false,
}: CapabilitySelectProps) {
  const [capabilities, setCapabilities] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchCapabilities = async () => {
      try {
        setIsLoading(true);
        const response = await api.getCapabilities();
        setCapabilities(response.capabilities);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load capabilities');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCapabilities();
  }, []);

  const handleSelect = (capability: string, e?: React.MouseEvent) => {
    // Prevent event bubbling
    e?.preventDefault();
    e?.stopPropagation();
    
    const updated = selectedCapabilities.includes(capability)
      ? selectedCapabilities.filter((c) => c !== capability)
      : [...selectedCapabilities, capability];
    onChange(updated);
    setIsOpen(false);
  };

  if (isLoading) return <div className="animate-pulse h-10 bg-gray-200 rounded-md"></div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || selectedCapabilities.length >= 3}
          className="w-full flex justify-between items-center px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
        >
          <span className="text-gray-700">
            {selectedCapabilities.length === 0
              ? 'Choose capabilities...'
              : `${selectedCapabilities.length} selected`}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 animate-slideDown">
            <div className="max-h-60 overflow-auto py-1">
              {Object.keys(capabilities).map((cap) => (
                <button
                  key={cap}
                  type="button"
                  onClick={(e) => handleSelect(cap, e)}
                  disabled={selectedCapabilities.length >= 3 && !selectedCapabilities.includes(cap)}
                  className={`w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors duration-150
                    ${selectedCapabilities.includes(cap) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}
                    ${selectedCapabilities.length >= 3 && !selectedCapabilities.includes(cap) ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {cap}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedCapabilities.map((cap) => (
          <div key={cap} className="group relative animate-fadeIn">
            <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all duration-200">
              {cap}
              <button
                type="button"
                onClick={() => handleSelect(cap)}
                className="ml-2 text-indigo-400 hover:text-indigo-600 focus:outline-none"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 absolute z-20 w-72 mt-2 transform -translate-x-1/4 transition-all duration-200">
              <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4">
                <h4 className="font-medium text-gray-900 mb-2">{cap}</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                  {capabilities[cap].map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}