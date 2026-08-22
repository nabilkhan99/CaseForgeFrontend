import { describe, it, expect } from 'vitest';
import { DOMAIN_TINTS, getDomainColor, hashDomainName } from './domains';

describe('getDomainColor', () => {
  it('always returns a tint from the amber/stone palette', () => {
    const names = [
      'Cardiovascular Health', 'Infectious Disease and Travel Health',
      'Neurodiversity and Neurodevelopmental Conditions', 'Older Adults',
      'Smoking, Alcohol and Substance Misuse', 'Metabolic Problems and Endocrinology',
    ];
    for (const name of names) {
      expect(DOMAIN_TINTS).toContainEqual(getDomainColor(name));
    }
  });

  it('is stable for a name regardless of list position', () => {
    // The regression this file exists for: colour used to be `index % 12`.
    const first = getDomainColor('Respiratory Health', 0);
    const later = getDomainColor('Respiratory Health', 27);
    expect(later).toEqual(first);
  });

  it('ignores surrounding whitespace and casing', () => {
    expect(getDomainColor('  eyes and vision  ')).toEqual(getDomainColor('Eyes and Vision'));
  });

  it('falls back to the base amber tint for an empty name', () => {
    expect(getDomainColor('')).toEqual(DOMAIN_TINTS[0]);
  });

  it('never returns a colour outside the warm palette', () => {
    // No blue/green/purple/red channel-dominant values should exist at all.
    for (const tint of DOMAIN_TINTS) {
      expect(tint.text).toMatch(/^#[0-9A-F]{6}$/);
      const r = parseInt(tint.text.slice(1, 3), 16);
      const b = parseInt(tint.text.slice(5, 7), 16);
      expect(r).toBeGreaterThanOrEqual(b); // warm: red channel never below blue
    }
  });

  it('spreads real domain names across more than one tint', () => {
    const names = [
      'Cardiovascular Health', 'Respiratory Health', 'Eyes and Vision',
      'Older Adults', 'Musculoskeletal Health', 'Mental Health',
      'Kidney and Urology', 'Sexual Health',
    ];
    const used = new Set(names.map((n) => getDomainColor(n).text));
    expect(used.size).toBeGreaterThan(1);
  });
});

describe('hashDomainName', () => {
  it('is deterministic and unsigned', () => {
    const a = hashDomainName('Gastroenterology');
    expect(hashDomainName('Gastroenterology')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
  });
});
