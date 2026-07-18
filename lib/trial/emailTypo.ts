/**
 * Lightweight "did you mean" check for the email gate: catches the common
 * misspellings of the domains GP trainees actually use, so most failed
 * verifications are prevented before a code is ever sent.
 */

const DOMAIN_FIXES: Readonly<Record<string, string>> = {
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'googlemail.co': 'googlemail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.co.uk',
  'icloud.co': 'icloud.com',
  'iclould.com': 'icloud.com',
  'nhs.uk': 'nhs.net',
  'nhs.com': 'nhs.net',
  'nhs.ent': 'nhs.net',
  'nhs.nte': 'nhs.net',
}

/** Returns the corrected address if the domain looks like a known typo. */
export function suggestEmailFix(email: string): string | null {
  const trimmed = email.trim().toLowerCase()
  const atIndex = trimmed.lastIndexOf('@')
  if (atIndex <= 0) return null

  const local = trimmed.slice(0, atIndex)
  const domain = trimmed.slice(atIndex + 1)
  const fixed = DOMAIN_FIXES[domain]
  return fixed ? `${local}@${fixed}` : null
}
