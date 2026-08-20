import { describe, expect, it } from 'vitest'
import {
  ALLOWED_LECTURE_EXTENSIONS,
  lectureStoragePath,
  normalizeLectureExtension,
} from './media'

const LECTURE_ID = '11111111-2222-3333-4444-555555555555'

describe('normalizeLectureExtension', () => {
  it('accepts every whitelisted container', () => {
    for (const ext of ALLOWED_LECTURE_EXTENSIONS) {
      expect(normalizeLectureExtension(ext)).toBe(ext)
    }
  })

  it('normalizes case, whitespace and a leading dot', () => {
    expect(normalizeLectureExtension('  .MP4 ')).toBe('mp4')
    expect(normalizeLectureExtension('WebM')).toBe('webm')
  })

  it('rejects anything not on the whitelist', () => {
    for (const ext of ['exe', 'svg', 'html', 'mkv', 'php', '']) {
      expect(normalizeLectureExtension(ext)).toBeNull()
    }
  })

  it('rejects non-strings rather than coercing them', () => {
    for (const value of [undefined, null, 4, {}, ['mp4']]) {
      expect(normalizeLectureExtension(value)).toBeNull()
    }
  })

  it('refuses a traversal attempt smuggled in the extension', () => {
    expect(normalizeLectureExtension('mp4/../../secret')).toBeNull()
    expect(normalizeLectureExtension('../mp4')).toBeNull()
  })
})

describe('lectureStoragePath', () => {
  it('keys the object off the lecture id, under videos/', () => {
    expect(lectureStoragePath(LECTURE_ID, 'mp4')).toBe(`videos/${LECTURE_ID}.mp4`)
  })

  it('is stable, so phase 1 and phase 2 always agree', () => {
    expect(lectureStoragePath(LECTURE_ID, 'webm')).toBe(lectureStoragePath(LECTURE_ID, 'webm'))
  })
})
