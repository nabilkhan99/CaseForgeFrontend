'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import AppNavbar from '@/components/ui/AppNavbar';
import { CapabilitySelect } from '@/components/CapabilitySelect';
import { ReviewDisplay } from '@/components/ReviewDisplay';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { api } from '@/lib/api';
import type { CaseReviewResponse } from '@/lib/types';

const DRAFT_KEY = 'ff_portfolio_playground_prompt_draft';
const SAVED_AT_KEY = 'ff_portfolio_playground_prompt_saved_at';

export default function PortfolioPromptPlaygroundPage() {
  const [livePrompt, setLivePrompt] = useState('');
  const [prompt, setPrompt] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [caseDescription, setCaseDescription] = useState('');
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [review, setReview] = useState<CaseReviewResponse | null>(null);
  const [experienceGroups, setExperienceGroups] = useState<string[]>([]);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy prompt');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadPrompt() {
      try {
        setLoadingPrompt(true);
        const response = await api.getPortfolioPlaygroundPrompt();
        if (!mounted) return;

        const draft = window.localStorage.getItem(DRAFT_KEY);
        const draftSavedAt = window.localStorage.getItem(SAVED_AT_KEY);
        setLivePrompt(response.system_prompt);
        setPrompt(draft || response.system_prompt);
        setSavedAt(draftSavedAt);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load the live prompt');
      } finally {
        if (mounted) setLoadingPrompt(false);
      }
    }

    loadPrompt();
    return () => {
      mounted = false;
    };
  }, []);

  const promptStats = useMemo(() => {
    const words = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;
    return {
      words,
      tokens: Math.ceil(prompt.length / 4),
      characters: prompt.length,
    };
  }, [prompt]);

  function saveDraft() {
    const now = new Date().toISOString();
    window.localStorage.setItem(DRAFT_KEY, prompt);
    window.localStorage.setItem(SAVED_AT_KEY, now);
    setSavedAt(now);
  }

  function resetToLivePrompt() {
    setPrompt(livePrompt);
    setReview(null);
    setExperienceGroups([]);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopyLabel('Copied');
    window.setTimeout(() => setCopyLabel('Copy prompt'), 1600);
  }

  async function generateReview(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      if (prompt.trim().length < 50) {
        throw new Error('The prompt is too short to test.');
      }
      if (caseDescription.trim().length < 10) {
        throw new Error('Add a longer case description.');
      }
      if (selectedCapabilities.length === 0) {
        throw new Error('Choose at least one capability.');
      }
      if (selectedCapabilities.length > 3) {
        throw new Error('Choose no more than three capabilities.');
      }

      setGenerating(true);
      saveDraft();

      const playgroundReview = await api.generatePlaygroundReview({
        case_description: caseDescription,
        selected_capabilities: selectedCapabilities,
        system_prompt: prompt,
      });

      setReview(playgroundReview);

      try {
        const experienceGroupResponse = await api.selectPlaygroundExperienceGroups({
          case_description: caseDescription,
        });
        setExperienceGroups(experienceGroupResponse.experience_groups);
      } catch (experienceGroupError) {
        console.warn('Failed to select playground experience groups:', experienceGroupError);
        setExperienceGroups([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate review');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-surface font-sans">
      <AppNavbar />
      <LoadingOverlay
        isVisible={generating}
        messages={[
          'Testing the edited prompt...',
          'Generating a portfolio review...',
          'Checking the output structure...',
          'Preparing the editable review...',
        ]}
      />

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-[1500px] mx-auto space-y-8">
          <motion.header
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-black/[0.08] pb-6"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-primary">
                  Develop playground
                </p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-heading">
                  Portfolio prompt workshop
                </h1>
                <p className="max-w-3xl text-sm sm:text-base text-body">
                  Edit the Portfolio Tool prompt, save a private browser draft, and test it against the current review flow.
                  Nothing here changes the live Portfolio Tool.
                </p>
              </div>
              <div className="text-xs text-muted lg:text-right">
                {savedAt ? `Draft saved ${new Date(savedAt).toLocaleString()}` : 'No draft saved yet'}
              </div>
            </div>
          </motion.header>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-6 items-start">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="space-y-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-heading">Prompt draft</h2>
                  <p className="text-sm text-muted">
                    Starts from the current backend prompt. Save keeps it in this browser.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={loadingPrompt || !prompt}
                    className="primary-button px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    onClick={copyPrompt}
                    disabled={!prompt}
                    className="button-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {copyLabel}
                  </button>
                  <button
                    type="button"
                    onClick={resetToLivePrompt}
                    disabled={loadingPrompt || !livePrompt}
                    className="button-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset to live
                  </button>
                </div>
              </div>

              <textarea
                value={loadingPrompt ? 'Loading live prompt...' : prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={loadingPrompt}
                spellCheck={false}
                className="glass-input w-full min-h-[520px] xl:min-h-[720px] font-mono text-[12px] leading-relaxed resize-y"
              />

              <div className="grid grid-cols-3 border-y border-black/[0.08] divide-x divide-black/[0.08] text-center">
                <Stat label="Words" value={promptStats.words.toLocaleString()} />
                <Stat label="Tokens est." value={promptStats.tokens.toLocaleString()} />
                <Stat label="Characters" value={promptStats.characters.toLocaleString()} />
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-5"
            >
              <form onSubmit={generateReview} className="card space-y-5">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-heading">Test with the Portfolio Tool</h2>
                  <p className="text-sm text-muted">
                    This runs one playground request with the edited prompt and renders the review below.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-heading">Case description</label>
                  <textarea
                    value={caseDescription}
                    onChange={(event) => setCaseDescription(event.target.value)}
                    className="glass-input w-full min-h-[180px] text-base md:text-sm"
                    placeholder="Paste or write a portfolio case description..."
                    disabled={generating}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-heading">Capabilities</label>
                  <CapabilitySelect
                    selectedCapabilities={selectedCapabilities}
                    onChange={setSelectedCapabilities}
                    disabled={generating}
                    loadCapabilities={api.getPlaygroundCapabilities}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                  <p className="text-xs text-muted">
                    The locked output structure is added server-side so the current review UI can parse the response.
                  </p>
                  <button
                    type="submit"
                    disabled={generating || loadingPrompt}
                    className="primary-button justify-center px-5 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generate test review
                  </button>
                </div>
              </form>

              {review && (
                <section className="card">
                  <ReviewDisplay
                    review={review}
                    experienceGroups={experienceGroups}
                    onNewCase={() => {
                      setReview(null);
                      setExperienceGroups([]);
                    }}
                    onUpdate={setReview}
                  />
                </section>
              )}
            </motion.section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3">
      <div className="text-lg font-semibold text-heading">{value}</div>
      <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted">{label}</div>
    </div>
  );
}
