import { describe, expect, it } from 'vitest';
import { isIncompleteDoctorTurn } from './doctorTurn';

/**
 * The cases that matter are the ones taken from real session logs — a rule that
 * passes invented examples and fails Whisper's actual output is worthless. The
 * "real log" block below is the six turns a punctuation-based rule got 2 of 6
 * wrong on.
 */
describe('isIncompleteDoctorTurn — real session log', () => {
    it('withholds the turn that handed over the diagnosis', () => {
        // Ismat, 25 Jul: this committed as a finished turn and the patient
        // answered it by volunteering the painkiller overuse.
        expect(isIncompleteDoctorTurn('Okay and um')).toBe(true);
    });

    it('withholds bare acknowledgements committed as turns', () => {
        expect(isIncompleteDoctorTurn('Okay')).toBe(true);
        expect(isIncompleteDoctorTurn('Um')).toBe(true);
    });

    it('answers short prompts that carry no punctuation', () => {
        // Both of these are why the punctuation rule was rejected.
        expect(isIncompleteDoctorTurn('Tell me more')).toBe(false);
        expect(isIncompleteDoctorTurn('Carry on')).toBe(false);
    });
});

describe('isIncompleteDoctorTurn — rule A, all noise', () => {
    it.each([
        'okay',
        'Right.',
        'mm',
        'Mm-hmm',
        'uh-huh',
        'yeah okay',
        'Um, right, okay',
        'So...',
        'Alright.',
        'Good.',
        'I see',
        'let me just think',
    ])('withholds %j', (said) => {
        expect(isIncompleteDoctorTurn(said)).toBe(true);
    });
});

describe('isIncompleteDoctorTurn — rule B, trailed off', () => {
    it.each([
        'Okay and um',
        'And how long has this been going on and',
        'Right, so',
        'Have you noticed the',
        'Is it worse in the morning or',
        'I was going to ask about your',
        'That might be because',
    ])('withholds %j', (said) => {
        expect(isIncompleteDoctorTurn(said)).toBe(true);
    });
});

describe('isIncompleteDoctorTurn — real questions must be answered', () => {
    it.each([
        // Preposition-final questions: the whole reason prepositions are not
        // treated as hanging tokens.
        'Who do you live with?',
        'What are you taking it for',
        'What are you most worried about',
        'Who did you speak to',
        'Where does the pain come from',
        // Verb- and pronoun-final questions.
        'What does the pain feel like',
        'Can you show me where the pain is',
        'What do you do',
        'How bad is that',
        'Do you',
        'Have you',
        // Short prompts and wh-words alone.
        'Why?',
        'Where?',
        'When?',
        'How long?',
        'Anything else?',
        'And then?',
        'Go on',
        'Such as?',
        'Since when',
        // Asking the patient to repeat is load-bearing — never withhold it.
        'Sorry?',
        'Huh?',
        'What?',
        'Say that again',
        // A bare answer to something the patient asked.
        'No',
        // Ordinary consultation questions.
        'How long have you had the headaches',
        'And how many of those are you taking a day',
        'Is there anything else you were hoping for today',
    ])('answers %j', (said) => {
        expect(isIncompleteDoctorTurn(said)).toBe(false);
    });
});

describe('isIncompleteDoctorTurn — degenerate input', () => {
    it.each(['', '   ', '...', '?', '—'])('withholds %j', (said) => {
        expect(isIncompleteDoctorTurn(said)).toBe(true);
    });

    it('tolerates a nullish transcript', () => {
        expect(isIncompleteDoctorTurn(undefined as unknown as string)).toBe(true);
    });
});
