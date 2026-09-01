/**
 * Where a lecture video lives, and what a lecture video is allowed to be.
 *
 * Pure and shared by the two admin upload phases so that the path the signed
 * PUT is minted for and the path the row is stamped with are derived by the
 * same function from the same lecture id — a client-supplied path is never
 * trusted, it is only ever compared against what this rebuilds.
 */

/** The private Storage bucket. Created out-of-band; see the lectures migration. */
export const LECTURES_BUCKET = 'lectures'

/**
 * Containers a browser can play back through a plain <video> element. Kept as a
 * whitelist rather than a MIME sniff: the extension decides the object key, so
 * anything not on this list must not reach Storage in the first place.
 */
export const ALLOWED_LECTURE_EXTENSIONS = ['mp4', 'webm', 'm4a', 'mov'] as const

export type LectureExtension = (typeof ALLOWED_LECTURE_EXTENSIONS)[number]

const ALLOWED = new Set<string>(ALLOWED_LECTURE_EXTENSIONS)

/**
 * Narrow an untrusted extension to one we will store, or null.
 * Case-insensitive and leading-dot tolerant, because both come off a filename.
 */
export function normalizeLectureExtension(raw: unknown): LectureExtension | null {
  if (typeof raw !== 'string') return null
  const ext = raw.trim().toLowerCase().replace(/^\./, '')
  return ALLOWED.has(ext) ? (ext as LectureExtension) : null
}

/** The object key for a lecture's video. The only place this string is built. */
export function lectureStoragePath(lectureId: string, extension: LectureExtension): string {
  return `videos/${lectureId}.${extension}`
}

/** The bucket folder the objects sit in, for a list() lookup. */
export const LECTURES_FOLDER = 'videos'
