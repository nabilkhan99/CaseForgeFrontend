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
        console.log('Fetching capabilities...');
        setIsLoading(true);
        const response = await api.getCapabilities();
        console.log('Capabilities response:', response);
        setCapabilities(response.capabilities);
      } catch (err) {
        console.error('Error fetching capabilities:', err);
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

  if (isLoading) {
    return <div>Loading capabilities...</div>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading capabilities</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <fieldset disabled={disabled} className="capability-select">
      <legend className="text-lg font-medium text-gray-900 mb-4">
        Select Capabilities (1-3)
      </legend>
      <div className="space-y-4">
        {Object.entries(capabilities).map(([capability, points]) => (
          <div key={capability} className="capability-option">
            <div className="flex items-center h-5">
              <input
                id={`capability-${capability}`}
                name={`capability-${capability}`}
                type="checkbox"
                checked={selectedCapabilities.includes(capability)}
                onChange={() => handleSelect(capability)}
                disabled={
                  disabled ||
                  (selectedCapabilities.length >= 3 &&
                    !selectedCapabilities.includes(capability))
                }
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3">
              <label
                htmlFor={`capability-${capability}`}
                className="font-medium text-gray-700"
              >
                {capability}
              </label>
              <div className="mt-1 text-sm text-gray-500">
                <ul className="list-disc pl-5 space-y-1">
                  {points.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}