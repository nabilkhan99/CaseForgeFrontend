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

  const handleSelect = (capability: string) => {
    const updated = selectedCapabilities.includes(capability)
      ? selectedCapabilities.filter((c) => c !== capability)
      : [...selectedCapabilities, capability];
    onChange(updated);
  };

  if (isLoading) return <div>Loading capabilities...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <select
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          onChange={(e) => handleSelect(e.target.value)}
          disabled={disabled || selectedCapabilities.length >= 3}
          value=""
        >
          <option value="">Choose a capability...</option>
          {Object.keys(capabilities).map((cap) => (
            <option
              key={cap}
              value={cap}
              disabled={selectedCapabilities.length >= 3 && !selectedCapabilities.includes(cap)}
            >
              {cap}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedCapabilities.map((cap) => (
          <div key={cap} className="relative group">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
              {cap}
              <span 
                className="ml-2 cursor-pointer" 
                onClick={() => handleSelect(cap)}
              >
                ×
              </span>
            </div>
            
            <div className="invisible group-hover:visible absolute z-10 mt-2 w-96 bg-white rounded-md shadow-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">{cap}</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                {capabilities[cap].map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}