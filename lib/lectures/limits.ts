/**
 * The numeric bounds the lecture surfaces agree on.
 *
 * Kept together, and away from the route handlers, because every one of these
 * has to hold in two places at once — a client pre-check and a server refusal,
 * or the admin list and the student list — and a number that lives twice
 * eventually disagrees with itself.
 */

/** A lecture is a talk, not a clip: anything under this is a failed upload. */
export const MIN_OBJECT_BYTES = 1024 * 1024

/**
 * Mirrors the `lectures` bucket's `file_size_limit` (2GB in prod). Checked in
 * the browser before the PUT starts so an oversize file fails in a second with
 * a sentence, rather than after twenty minutes with a bare `413`.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3

/**
 * How many lectures either list will ever return. The student list and the
 * admin list share it so the course cannot silently grow past what content ops
 * can see.
 */
export const MAX_LECTURE_ROWS = 200

/** Ten hours. A duration past this is a broken metadata read, not a lecture. */
export const MAX_DURATION_SECONDS = 36000
