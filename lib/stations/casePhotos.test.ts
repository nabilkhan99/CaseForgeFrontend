import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { allCasePhotos, casePhotosFor } from './casePhotos';

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const ECZEMA_CASE = '2d61723a-414b-46c4-93a3-3a975bde9849';

/** Width/height from a PNG's IHDR chunk or a JPEG's first SOF marker. */
function imageSize(file: Buffer): { width: number; height: number } | null {
    const isPng = file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (isPng) return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };

    const isJpeg = file[0] === 0xff && file[1] === 0xd8;
    if (!isJpeg) return null;
    let offset = 2;
    while (offset + 9 < file.length) {
        if (file[offset] !== 0xff) return null;
        const marker = file[offset + 1];
        const length = file.readUInt16BE(offset + 2);
        const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isStartOfFrame) return { width: file.readUInt16BE(offset + 7), height: file.readUInt16BE(offset + 5) };
        offset += 2 + length;
    }
    return null;
}

// Words that would hand the candidate the diagnosis from the alt text or the
// caption. Alt text is read aloud by screen readers and shown if a file fails
// to load, so it describes the frame, never the condition.
const DIAGNOSTIC_TERMS = [
    'acne', 'alopecia', 'areata', 'dermatitis', 'eczema', 'erythema', 'migrans', 'henoch', 'hsp', 'iritis',
    'impetigo', 'lichen', 'lyme', 'purpur', 'shingles', 'zoster', 'herpes', 'uveitis', 'vasculitis', 'ciliary',
];

describe('case photo map', () => {
    const entries = allCasePhotos();

    it('has the eczema case photo supplied by the clinical cofounder', () => {
        const photos = casePhotosFor(ECZEMA_CASE);
        expect(photos).toHaveLength(1);
        expect(photos[0].src).toBe(`/cases/${ECZEMA_CASE}/1.png`);
    });

    it('returns nothing for a case without photos, or no id', () => {
        expect(casePhotosFor('00000000-0000-0000-0000-000000000000')).toEqual([]);
        expect(casePhotosFor(null)).toEqual([]);
        expect(casePhotosFor(undefined)).toEqual([]);
        expect(casePhotosFor('')).toEqual([]);
        // Not fooled by inherited object keys.
        expect(casePhotosFor('constructor')).toEqual([]);
    });

    it('keys every entry by a station uuid and never maps an empty list', () => {
        for (const [stationId, photos] of entries) {
            expect(stationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
            expect(photos.length).toBeGreaterThan(0);
        }
    });

    describe.each(entries.flatMap(([stationId, photos]) => photos.map((photo) => [stationId, photo] as const)))(
        '%s → %o',
        (_stationId, photo) => {
            it('points at a file that exists under public/', () => {
                expect(photo.src.startsWith('/')).toBe(true);
                expect(photo.src).not.toContain('..');
                expect(existsSync(path.join(PUBLIC_DIR, photo.src))).toBe(true);
            });

            it('declares the width and height of the file', () => {
                const size = imageSize(readFileSync(path.join(PUBLIC_DIR, photo.src)));
                expect(size).toEqual({ width: photo.width, height: photo.height });
            });

            it('has alt text and a caption that do not name the diagnosis', () => {
                expect(photo.alt.trim().length).toBeGreaterThan(10);
                const text = `${photo.alt} ${photo.caption ?? ''}`.toLowerCase();
                for (const term of DIAGNOSTIC_TERMS) expect(text).not.toContain(term);
            });
        },
    );
});
