'use client';

/**
 * The gate that holds back the live consultation while the token, the
 * microphone and the WebRTC handshake are still in flight — shared by the
 * authed session and the free `/try` session so the two cannot drift apart
 * again (the same reason SessionControls exists; `/try` had no gate at all and
 * showed guests a static full clock and an idle avatar through the handshake).
 *
 * The spinner it replaces was a rotating border — a shape that says "a computer
 * is busy". What is actually happening is a call being placed, so this says
 * that instead: a warm core with rings leaving it, the same amber the orb
 * settles into once the patient is on the line.
 *
 * The pulse is three CSS keyframe rings, not JavaScript. There is no rAF here
 * on purpose: this screen is up precisely while the browser is doing the
 * expensive part — `getUserMedia`, ICE, the SDP round trip — and the animation
 * has no business competing for the main thread during it. `motion-safe:` is
 * the reduced-motion guard; with the animation off the rings are still drawn,
 * concentric and static, because each starts at its own resting size.
 */

/**
 * Base opacity doubles as the keyframe's starting opacity, so these are the
 * values the rings fade out FROM. They are multiplied by the border's own
 * alpha, which is why they sit high: at `border-primary/30` the outermost ring
 * came out at 0.06 effective and was invisible on cream.
 */
const RINGS = [
  { inset: -8, opacity: 0.62, delay: '0s' },
  { inset: -26, opacity: 0.42, delay: '0.55s' },
  { inset: -44, opacity: 0.26, delay: '1.1s' },
];

export interface ConnectingScreenProps {
  /** Shown in the headline. Falls back to a generic phrase before the row loads. */
  patientName?: string;
  /**
   * True only while the handshake is genuinely running. `status` distinguishes
   * this from `disconnected`, which is the brief window before the page's
   * auto-connect effect fires and is not worth animating. The gate around this
   * component still covers both — falling through to the live consultation on
   * `disconnected` would put a trainee back in front of a dead line, which is
   * the bug the gate was added for.
   */
  connecting: boolean;
  onCancel: () => void;
}

export default function ConnectingScreen({
  patientName,
  connecting,
  onCancel,
}: ConnectingScreenProps) {
  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col items-center justify-center gap-9 px-6 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="relative flex h-[104px] w-[104px] items-center justify-center">
        {RINGS.map((ring) => (
          <div
            key={ring.inset}
            aria-hidden="true"
            className={`absolute rounded-full border border-primary/70 ${
              connecting ? 'motion-safe:animate-connect-ping' : ''
            }`}
            style={{
              inset: ring.inset,
              opacity: ring.opacity,
              animationDelay: ring.delay,
              // Read by the keyframes so each ring fades out from its own
              // resting opacity rather than all three from the same one.
              ['--ping-opacity' as string]: String(ring.opacity),
            }}
          />
        ))}
        <div
          aria-hidden="true"
          className="h-14 w-14 rounded-full motion-safe:animate-orb-breathe"
          style={{
            background: 'radial-gradient(circle at 32% 26%, #FCD34D 0%, #F59E0B 40%, #B45309 100%)',
            boxShadow: '0 8px 28px rgba(180,83,9,0.25)',
          }}
        />
      </div>

      <div className="text-center max-w-sm">
        <h3 className="text-[18px] font-semibold text-heading mb-1">
          Connecting you to {patientName || 'your patient'}
        </h3>
        <p className="text-[14px] leading-[1.65] text-muted">
          Your browser will ask for your microphone &mdash;{' '}
          choose <span className="font-semibold text-heading">Allow</span>. Headphones help. The
          patient speaks first; the clock starts when they do.
        </p>
      </div>

      <button
        onClick={onCancel}
        className="min-h-[44px] px-4 text-[13px] font-semibold text-primary hover:underline cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}
