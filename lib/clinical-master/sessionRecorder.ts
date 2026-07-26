/**
 * Records a consultation as a single mixed audio file (doctor + patient).
 *
 * The old LiveKit agent recorded server-side via egress; that died with the
 * migration to a direct browser↔Azure WebRTC connection, so from 3 June 2026
 * no session had audio at all. This restores it from the only place that can
 * still hear both sides: the browser.
 *
 * Mixing happens in a MediaStreamDestination — the mic stream and the remote
 * patient track are both routed into it, and MediaRecorder records the mix.
 * The destination is NOT `ctx.destination`, so nothing extra reaches the
 * speakers and the playback path is untouched.
 *
 * Deliberately owns its OWN AudioContext rather than sharing the one in
 * useRealtimeSession: that context's existence is the flag for "the
 * double-talk detector is armed" (Safari/Firefox barge-in), and creating it
 * on Chrome would silently change turn-taking there.
 *
 * Every entry point is failure-tolerant and returns null/undefined rather
 * than throwing. A recording is never worth breaking a consultation for.
 */

/** Container/codec preference: Opus where available, Safari's mp4 otherwise. */
const CANDIDATE_MIME_TYPES: readonly string[] = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
];

/** Speech-only mix — 48kbps keeps a 12-minute station comfortably small. */
const AUDIO_BITS_PER_SECOND = 48_000;

/** Chunk cadence. Chunks bound peak memory on a long consultation. */
const TIMESLICE_MS = 5_000;

/** Hard stop on waiting for MediaRecorder's final 'stop' event. */
const STOP_TIMEOUT_MS = 4_000;

export interface SessionRecorder {
    /**
     * Route the patient's remote track into the mix. Safe to call repeatedly —
     * duplicate tracks are ignored. A still-muted track is skipped: on WebKit a
     * MediaStreamSource built from a muted remote track reads silence forever
     * (the same quirk the detector's patient tap works around), so callers
     * should call again from the track's 'unmute' event.
     */
    addRemoteTrack(track: MediaStreamTrack): void;
    /** Stop recording and resolve the assembled audio (null if nothing usable). */
    stop(): Promise<Blob | null>;
    /** Release the AudioContext. Safe after stop(); does not touch the Blob. */
    dispose(): void;
    /** The negotiated container type, e.g. 'audio/webm;codecs=opus'. */
    readonly mimeType: string;
}

/** First candidate the browser will actually record, or null if none. */
export function pickRecorderMimeType(): string | null {
    if (typeof MediaRecorder === 'undefined') return null;
    for (const type of CANDIDATE_MIME_TYPES) {
        try {
            if (MediaRecorder.isTypeSupported(type)) return type;
        } catch {
            // isTypeSupported can throw on older WebKit — try the next one.
        }
    }
    return null;
}

/** File extension for a recorder MIME type (defaults to webm). */
export function extensionForMimeType(mimeType: string): string {
    const base = mimeType.split(';')[0].trim().toLowerCase();
    if (base === 'audio/mp4') return 'm4a';
    if (base === 'audio/ogg') return 'ogg';
    return 'webm';
}

/**
 * Begin recording with the doctor's mic already in the mix. Returns null when
 * the browser can't record at all, in which case the session simply runs
 * without audio capture.
 */
export function startSessionRecorder(micStream: MediaStream): SessionRecorder | null {
    const mimeType = pickRecorderMimeType();
    if (!mimeType) return null;

    const Ctor =
        typeof window !== 'undefined'
            ? (window.AudioContext ??
              (window as unknown as { webkitAudioContext?: typeof AudioContext })
                  .webkitAudioContext)
            : undefined;
    if (!Ctor) return null;

    let ctx: AudioContext;
    let destination: MediaStreamAudioDestinationNode;
    let recorder: MediaRecorder;
    try {
        ctx = new Ctor();
        destination = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(micStream).connect(destination);
        recorder = new MediaRecorder(destination.stream, {
            mimeType,
            audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        });
    } catch {
        return null;
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    try {
        recorder.start(TIMESLICE_MS);
    } catch {
        try {
            void ctx.close();
        } catch {
            /* already closed */
        }
        return null;
    }

    // A suspended context feeds silence into the mix. Autoplay policy means the
    // context can start suspended even though connect() runs from a gesture.
    void ctx.resume().catch(() => {
        /* best-effort */
    });

    const attachedTrackIds = new Set<string>();
    let stopped = false;

    return {
        mimeType,

        addRemoteTrack(track: MediaStreamTrack) {
            if (stopped || !track || track.readyState !== 'live') return;
            if (track.muted || attachedTrackIds.has(track.id)) return;
            try {
                ctx.createMediaStreamSource(new MediaStream([track])).connect(destination);
                attachedTrackIds.add(track.id);
            } catch {
                /* patient side missing from the mix is better than a crash */
            }
        },

        stop(): Promise<Blob | null> {
            if (stopped) return Promise.resolve(null);
            stopped = true;

            return new Promise<Blob | null>((resolve) => {
                const finish = () => {
                    if (timer !== null) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    if (chunks.length === 0) {
                        resolve(null);
                        return;
                    }
                    resolve(new Blob(chunks, { type: mimeType }));
                };

                // If 'stop' never lands, assemble whatever the timeslice
                // chunks already gave us rather than losing the recording.
                let timer: ReturnType<typeof setTimeout> | null = setTimeout(
                    finish,
                    STOP_TIMEOUT_MS
                );

                recorder.onstop = finish;
                try {
                    if (recorder.state === 'inactive') finish();
                    else recorder.stop();
                } catch {
                    finish();
                }
            });
        },

        dispose() {
            stopped = true;
            try {
                if (recorder.state !== 'inactive') recorder.stop();
            } catch {
                /* ignore */
            }
            try {
                void ctx.close();
            } catch {
                /* already closed */
            }
        },
    };
}
