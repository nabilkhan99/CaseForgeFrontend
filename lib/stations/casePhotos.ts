/**
 * Photographs a candidate is shown with a case: the picture the patient "sent
 * in before the call". Keyed by station id, rendered under the candidate brief
 * (signed-in and guest reading pages, and the public /sca-cases page) and as a
 * tap-to-enlarge tray during the consultation.
 *
 * WHY A CODE MAP AND NOT THE BRIEF'S MARKDOWN. Some briefs carry a markdown
 * image line (`![...](/images/cases/...)`). Half of those files never existed
 * ("ASSET TO CREATE"), so the page painted a broken image whose alt text named
 * the diagnosis. formatBriefMarkdown now drops every markdown image, and this
 * map is the only thing that puts a photo on screen. The AI patient's prompt
 * is built from the raw brief and is unaffected either way.
 *
 * TO ADD A PHOTO
 * 1. Save it as public/cases/<station id>/<n>.png (n = 1, 2, ...), roughly
 *    1600px on the long edge. The repo is PUBLIC: no real patients, no faces.
 * 2. Add an entry below with its pixel width/height. `alt` describes what is
 *    in the frame without naming the diagnosis; it is what a screen reader
 *    says and what shows if the file fails to load.
 * 3. `npx vitest run lib/stations/casePhotos.test.ts` checks every mapped file
 *    exists and that the width/height match it.
 *
 * A case that is replaced by a new version gets a new station id: copy its
 * entry across, or the new version shows no photo.
 */

export interface CasePhoto {
    /** Path under public/, starting with a slash. */
    readonly src: string;
    /** Neutral, non-diagnostic description of what is in the frame. */
    readonly alt: string;
    /** Optional short label shown under the photo. */
    readonly caption?: string;
    /** Intrinsic pixel size of the file, so the page reserves the right space. */
    readonly width: number;
    readonly height: number;
}

const CASE_PHOTOS: Readonly<Record<string, readonly CasePhoto[]>> = {
    // Young man with worsening eczema he has stopped treating.
    // Two-panel image supplied by the clinical cofounder, 6 Oct 2026.
    '2d61723a-414b-46c4-93a3-3a975bde9849': [
        {
            src: '/cases/2d61723a-414b-46c4-93a3-3a975bde9849/1.png',
            alt: 'Patient photo in two panels: the insides of both forearms at the elbow, and the backs of both hands',
            caption: 'Forearms and backs of hands',
            width: 1600,
            height: 640,
        },
    ],

    // ---- Existing files in public/images/cases (added 22 May 2026). These
    // used to reach the page through the brief's own markdown; they are listed
    // here so they keep showing now that markdown images are dropped.

    // Child with purpuric rash and abdominal pain.
    'c07dde22-a282-4bea-b7a9-8b637a809e15': [
        {
            src: '/images/cases/hsp-purpuric-rash.png',
            alt: "Photo sent by the patient's mother: the backs of a child's lower legs and ankles",
            caption: 'Lower legs and ankles',
            width: 1536,
            height: 1024,
        },
    ],

    // Man with itchy, darkened skin patches.
    '118e55e4-e6b3-4c7d-8b9c-7f9a6b4f1b18': [
        {
            src: '/images/cases/eczema-patches-1.png',
            alt: 'Patient photo: the inside of the elbow',
            caption: 'Inside of the elbow',
            width: 598,
            height: 310,
        },
        {
            src: '/images/cases/eczema-patches-2.png',
            alt: 'Patient photo: the back and side of the neck',
            caption: 'Neck',
            width: 584,
            height: 646,
        },
    ],

    // Schoolteacher with painful red eye. Flagged for replacement: the redness
    // is diffuse rather than concentrated round the cornea, and the pupil is
    // round. Prompt in case-bank-rewrite/CASE_PHOTO_PROMPTS.md.
    'dab18ec4-ff3e-405e-95a6-b222c615f5c4': [
        {
            src: '/images/cases/uveitis-eye.png',
            alt: 'Patient photo: close-up of the left eye',
            caption: 'Left eye',
            width: 1536,
            height: 1024,
        },
    ],

    // Woman with patchy hair loss.
    '7a546922-e4a8-486e-93b9-57784ccf5b78': [
        {
            src: '/images/cases/alopecia-areata-patch.png',
            alt: 'Patient photo: the back of the head, with a patch of scalp showing through the hair',
            caption: 'Back of the head',
            width: 1232,
            height: 656,
        },
    ],

    // ---- Waiting on a file. Uncomment once public/cases/<id>/1.png exists
    // and fill in its width/height (the test fails until both are true).

    // Man with shingles asking whether he can attend his pregnant daughter's party.
    // 'c84c4a36-6de8-43a1-8b36-407ec329bc96': [
    //     { src: '/cases/c84c4a36-6de8-43a1-8b36-407ec329bc96/1.png', alt: 'Patient photo: the left side of the lower chest, from the front round towards the back', caption: 'Left side of the chest', width: 0, height: 0 },
    // ],

    // Mother of a child with impetigo who provides childcare for an immunosuppressed grandmother.
    // 'c853c294-fa9c-41d3-bb70-f7aa5c8a7312': [
    //     { src: '/cases/c853c294-fa9c-41d3-bb70-f7aa5c8a7312/1.png', alt: "Photo sent by the patient's mother: a child's knee", caption: 'Knee', width: 0, height: 0 },
    // ],

    // Walker with a spreading rash after a tick bite.
    // 'bf99ba95-db56-4115-85d9-e5dded787911': [
    //     { src: '/cases/bf99ba95-db56-4115-85d9-e5dded787911/1.png', alt: 'Patient photo: the back of the left calf', caption: 'Left calf', width: 0, height: 0 },
    // ],

    // Young man whose acne is affecting his confidence.
    // '94584f1c-4c9e-4b7e-a443-fe11c2cc66bd': [
    //     { src: '/cases/94584f1c-4c9e-4b7e-a443-fe11c2cc66bd/1.png', alt: 'Patient photo: the cheeks, from just below the eyes to the jaw', caption: 'Cheeks', width: 0, height: 0 },
    //     { src: '/cases/94584f1c-4c9e-4b7e-a443-fe11c2cc66bd/2.png', alt: 'Patient photo: the forehead, from the hairline to the eyebrows', caption: 'Forehead', width: 0, height: 0 },
    // ],
};

const NONE: readonly CasePhoto[] = Object.freeze([]);

/** The photos to show with a case, in order. Empty for a case without any. */
export function casePhotosFor(stationId: string | null | undefined): readonly CasePhoto[] {
    if (!stationId) return NONE;
    return Object.prototype.hasOwnProperty.call(CASE_PHOTOS, stationId) ? CASE_PHOTOS[stationId] : NONE;
}

/** Every mapped station id, for the test that checks the files are really there. */
export function allCasePhotos(): ReadonlyArray<readonly [string, readonly CasePhoto[]]> {
    return Object.entries(CASE_PHOTOS);
}
