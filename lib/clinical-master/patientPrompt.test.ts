import { describe, expect, it } from 'vitest';
import { stripStageDirections } from './patientPrompt';

/**
 * Regression tests for the strip bug that destroyed ~80% of every station
 * script. The old regexes matched parentheses and asterisk pairs across
 * newlines, so markdown emphasis paired blindly and swallowed whole sections —
 * taking the drug names, the ICE and every "If asked..." trigger with them.
 */
describe('stripStageDirections', () => {
  it('unwraps bold headers instead of deleting them and their content', () => {
    const out = stripStageDirections('**Medications:** Ramipril 2.5mg OD.');
    expect(out).toBe('Medications: Ramipril 2.5mg OD.');
  });

  it('keeps the trigger label AND its answer on separate lines', () => {
    const src = [
      '- *If asked exactly WHAT and HOW OFTEN he is taking:* "Two Co-codamol when I wake up."',
      '- *If asked about photophobia:* "Bright light doesn\'t bother me."',
    ].join('\n');
    const out = stripStageDirections(src);
    expect(out).toContain('If asked exactly WHAT and HOW OFTEN');
    expect(out).toContain('Two Co-codamol when I wake up');
    expect(out).toContain('If asked about photophobia');
  });

  it('keeps clinical parentheticals — this is where "codeine" used to vanish', () => {
    const out = stripStageDirections(
      'You take Co-codamol (paracetamol and codeine) and Ibuprofen daily.'
    );
    expect(out).toContain('codeine');
    expect(out).toContain('(paracetamol and codeine)');
  });

  it('keeps numeric parentheticals', () => {
    expect(stripStageDirections('Last BP was normal (128/82).')).toContain('(128/82)');
  });

  it('still removes genuine stage directions', () => {
    expect(stripStageDirections('*holds jaw*')).toBe('');
    expect(stripStageDirections('I feel awful. (winces and rubs temple) It never stops.'))
      .toBe('I feel awful. It never stops.');
    expect(stripStageDirections('(Actor guidance: respond only if asked) Yes.'))
      .toBe('Yes.');
  });

  it('never pairs emphasis across a newline — the original catastrophe', () => {
    const src = [
      '**Character Overview:** You are Simon, an architect.',
      '',
      'You want a brain scan and stronger painkillers.',
      '',
      '**Opening line:** "These headaches are constant."',
    ].join('\n');
    const out = stripStageDirections(src);
    expect(out).toContain('architect');
    expect(out).toContain('brain scan and stronger painkillers');
    expect(out).toContain('These headaches are constant');
  });

  it('unescapes stored escaped quotes', () => {
    expect(stripStageDirections('He said \\"it never stops\\".')).toContain('"it never stops"');
  });

  it('retains the overwhelming majority of a markdown-heavy script', () => {
    // Shape mirrors a real station script: bold headers, italic triggers,
    // bullet answers, clinical parentheticals.
    const src = [
      '**Character Overview:** You are Simon Fletcher, 45, an architect.',
      '',
      '**Opening Line:** "I get these headaches every single day now."',
      '',
      '**Layer 1 — the headache:**',
      '- *If asked to describe the pain:* "A tight band around my head."',
      '- *If asked about photophobia:* "Bright light doesn\'t bother me."',
      '',
      '**Layer 2 — medication:**',
      '- *If asked what he takes:* "Co-codamol (paracetamol and codeine), two at a time."',
      '',
      '**ICE:**',
      '- You are frightened this is a brain tumour.',
      '- You want an MRI and stronger painkillers.',
    ].join('\n');
    const out = stripStageDirections(src);
    // Old code retained ~20%; the fix must retain nearly everything.
    expect(out.length).toBeGreaterThan(src.length * 0.85);
    for (const must of [
      'architect', 'every single day', 'tight band', 'Bright light',
      'codeine', 'brain tumour', 'MRI', 'stronger painkillers',
    ]) {
      expect(out).toContain(must);
    }
  });

  // The patient must never learn how the candidate is being scored. Scripts
  // carry inline mark-scheme notes; the original catch-all paren strip hid them
  // by accident, so preserving clinical parentheticals made them visible.
  describe('assessment language never reaches the patient', () => {
    const leaks = [
      '- Reaction: "Will these kill the pain?" (Note: Candidate critically fails for worsening a Medication Overuse Headache and feeding opiate dependence).',
      'You feel better. (Candidate fails if they do not safety net.)',
      '(Note: this is on the mark scheme as a red flag)',
      'He agrees. (The examiner expects a follow-up here.)',
      '(Candidate passes this domain if they quantify the medication.)',
    ];

    for (const src of leaks) {
      it(`strips: ${src.slice(0, 46)}…`, () => {
        const out = stripStageDirections(src);
        expect(out).not.toMatch(
          /critically fails|candidate (?:fails|passes)|mark scheme|examiner (?:expects|awards)/i
        );
      });
    }

    it('keeps the patient dialogue around a stripped note', () => {
      const out = stripStageDirections(
        '- Reaction: "Will these kill the pain?" (Note: Candidate critically fails for this).'
      );
      expect(out).toContain('Will these kill the pain?');
    });

    it('does not strip ordinary clinical wording that merely contains "pass"', () => {
      const out = stripStageDirections('It comes and goes — the pain passes after an hour.');
      expect(out).toContain('the pain passes after an hour');
    });
  });

  // The second leak class, found from Ishaq's mock station: notes explaining
  // why a line is in the script rather than how the candidate is scored. These
  // are not mark-scheme language, so the assessment pattern let them through —
  // verified surviving in 12 of 79 scripts before CASE_DESIGN_NOTE_RE existed.
  describe('case-design notes never reach the patient', () => {
    const notes = [
      '- "No, I haven\'t been sick. No changes to my vision." (Rules out raised ICP / space-occupying lesion).',
      '- Reaction: "How can you be so sure?" (Testing the doctor\'s ability to explain clinical reasoning).',
      '- "It\'s there when I wake up." (Points towards medication overuse.)',
      '- "I take them every day." (This is the core clue.)',
      '- "My neck is stiff." (Differentiates tension headache from meningitis.)',
      '- "No fever." (Red flag screen.)',
      '- "I want a scan." (Candidate should explore ICE here.)',
    ];

    for (const src of notes) {
      it(`strips: ${src.slice(0, 44)}…`, () => {
        const out = stripStageDirections(src);
        expect(out).not.toMatch(
          /rules? out|points? towards|core clue|differentiates|red flag|candidate|doctor's ability|testing the/i
        );
      });
    }

    it('keeps the dialogue attached to a stripped design note', () => {
      const out = stripStageDirections(
        '- "No, I haven\'t been sick." (Rules out raised ICP / space-occupying lesion).'
      );
      expect(out).toContain("No, I haven't been sick.");
    });

    // The whole point of preserving parentheses was clinical detail. A note
      // pattern that ate these would undo the fix it was added alongside.
    it.each([
      '- "It hurts here (on both sides)."',
      '- "I take two co-codamol (paracetamol and codeine) twice a day."',
      '- "The rash is on my shin (the front of my lower leg)."',
      '- "I saw the practice nurse (not the GP) last month."',
    ])('keeps the clinical parenthetical in %j', (src) => {
      expect(stripStageDirections(src)).toContain('(');
    });

    it('does not strip a patient describing a red-flag symptom in dialogue', () => {
      const src = '- "I did have one episode where I couldn\'t see out of my left eye."';
      expect(stripStageDirections(src)).toContain("couldn't see out of my left eye");
    });
  });

  it('leaves plain text untouched', () => {
    const plain = 'No, nothing like that. Arms and legs feel completely normal.';
    expect(stripStageDirections(plain)).toBe(plain);
  });
});
