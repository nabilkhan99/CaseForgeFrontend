import { after } from 'next/server';

/**
 * Start an SCA marking run, at most once per session.
 *
 * Lifted verbatim out of `app/api/generate-feedback/route.ts`, which used to be
 * the only thing that ever asked for a mark. That made marking a side effect of
 * *reading the report*: close the tab on the way to the feedback page and the
 * consultation was never marked at all, which is how production accumulated
 * rows sitting in 'processing' for days. `save-transcript` now calls this the
 * moment the consultation ends, and the report's poll calls it too — hence one
 * implementation, and hence the claim.
 *
 * ## Claim semantics
 *
 * The claim is a conditional UPDATE of `clinical_sessions.marking_started_at`
 * (migration 0005), and it is the whole of the concurrency control:
 *
 *   UPDATE clinical_sessions SET marking_started_at = now
 *    WHERE id = :sessionId
 *      AND (marking_started_at IS NULL OR marking_started_at < :staleCutoff)
 *
 * Only the caller whose UPDATE returns a row won it and fires; everyone racing
 * it sees no row and skips. Postgres arbitrates, so this holds across Vercel
 * instances — an in-memory Set cannot, since parallel instances each start with
 * an empty one. A claim older than MARKING_CLAIM_STALE_MINUTES is presumed dead
 * and can be retaken, so a crashed run self-heals on the next trigger instead
 * of wedging the session forever.
 *
 * ## Fire and forget, always
 *
 * Vercel is on the **Hobby plan**: `maxDuration` above 60 is rejected at deploy
 * time, and a `gpt-5.6-luna` marking run takes ~65-90s. The Azure call is
 * therefore never awaited in the request path — it is handed to `after()` and
 * the caller returns immediately. Azure writes `session_results` on its own
 * schedule whether or not this function's process is still alive; the stale TTL
 * above is what covers the case where it is not.
 */

/**
 * A marking claim older than this is presumed dead and can be retaken. Marking
 * takes 80-90 seconds, so ten minutes is far past "still working".
 */
export const MARKING_CLAIM_STALE_MINUTES = 10;

/** Why a call did not start a run. None of these are errors the caller shows. */
export type TriggerMarkingSkip =
  /** A `session_results` row already exists — this session is done. */
  | 'already_marked'
  /** Someone else holds a live claim; their run is the one that will finish. */
  | 'claim_held'
  /** MARKING_API_URL / MARKING_SHARED_SECRET are unset. */
  | 'not_configured'
  /** The claim UPDATE itself failed. */
  | 'claim_error';

export type TriggerMarkingResult =
  | { triggered: true }
  | { triggered: false; reason: TriggerMarkingSkip };

export interface TriggerMarkingOptions {
  /** Service-role Supabase client — the claim writes to someone else's row. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  sessionId: string;
  /**
   * How the un-awaited Azure call is scheduled. Defaults to Next's `after()`,
   * which keeps the function alive past the response; injected in tests so the
   * fetch can be run deterministically.
   */
  schedule?: (task: () => Promise<void>) => void;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Default `process.env.MARKING_API_URL`. */
  markingUrl?: string;
  /** Default `process.env.MARKING_SHARED_SECRET`. */
  markingSecret?: string;
}

export async function triggerMarking({
  admin,
  sessionId,
  schedule = (task) => after(task),
  fetchImpl = fetch,
  now = Date.now,
  markingUrl = process.env.MARKING_API_URL,
  markingSecret = process.env.MARKING_SHARED_SECRET,
}: TriggerMarkingOptions): Promise<TriggerMarkingResult> {
  if (!markingUrl || !markingSecret) {
    return { triggered: false, reason: 'not_configured' };
  }

  // Marking is a paid model call. A session that already has a result never
  // needs another one, and save-transcript can legitimately be called twice
  // (a beacon and a graceful end racing), so this check is what makes a repeat
  // call free rather than merely harmless.
  const { data: existing } = await admin
    .from('session_results')
    .select('session_id')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (existing) return { triggered: false, reason: 'already_marked' };

  const staleCutoff = new Date(now() - MARKING_CLAIM_STALE_MINUTES * 60000).toISOString();
  // Cast: marking_started_at postdates the generated types (0005).
  const { data: claim, error: claimError } = await admin
    .from('clinical_sessions')
    .update({ marking_started_at: new Date(now()).toISOString() })
    .eq('id', sessionId)
    .or(`marking_started_at.is.null,marking_started_at.lt.${staleCutoff}`)
    .select('id')
    .maybeSingle();

  if (claimError) {
    console.error('Failed to take marking claim', { sessionId, error: claimError });
    return { triggered: false, reason: 'claim_error' };
  }
  if (!claim) return { triggered: false, reason: 'claim_held' };

  const endpoint = `${markingUrl.replace(/\/+$/, '')}/api/mark-consultation`;

  const releaseClaim = async () => {
    try {
      await admin
        .from('clinical_sessions')
        .update({ marking_started_at: null })
        .eq('id', sessionId);
    } catch (err) {
      console.error('Failed to release marking claim', { sessionId, err });
    }
  };

  schedule(async () => {
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-marking-secret': markingSecret,
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('Marking endpoint returned an error', {
          sessionId,
          status: res.status,
          body: body.slice(0, 500),
        });
        // Give the claim back so the next trigger poll retries immediately
        // rather than waiting out the ten-minute TTL.
        await releaseClaim();
      }
    } catch (err) {
      console.error('Failed to trigger marking endpoint:', err);
      await releaseClaim();
    }
  });

  return { triggered: true };
}
