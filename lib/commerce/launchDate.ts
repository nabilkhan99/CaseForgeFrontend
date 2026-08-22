import { isStagedDeployment } from '@/lib/stations/visibility'
import { ACCESS_LAUNCH_DATE } from './entitlements'

/**
 * When pre-launch purchases start to run.
 *
 * Production: always the real launch day (`ACCESS_OPENS`). Staged deployments
 * (develop preview, local dev) may bring it forward with
 * `NEXT_PUBLIC_ACCESS_OPENS_OVERRIDE=YYYY-MM-DD` so a tester — or a customer
 * given the preview link — can practise before 1 Sept on exactly the gating
 * code production runs. The override is ignored unless `isStagedDeployment()`
 * is true, so a stray value on the live site cannot open the course early.
 */
export function effectiveLaunchDate(): Date {
  if (!isStagedDeployment()) return ACCESS_LAUNCH_DATE
  const raw = process.env.NEXT_PUBLIC_ACCESS_OPENS_OVERRIDE
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ACCESS_LAUNCH_DATE
  const override = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(override.getTime())) return ACCESS_LAUNCH_DATE
  return override
}
