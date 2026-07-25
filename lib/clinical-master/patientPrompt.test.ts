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

  it('leaves plain text untouched', () => {
    const plain = 'No, nothing like that. Arms and legs feel completely normal.';
    expect(stripStageDirections(plain)).toBe(plain);
  });
});
