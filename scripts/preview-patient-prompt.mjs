/**
 * Prints the ACTUAL assembled patient prompt for a station, so you can read
 * what the model will really receive before shipping a prompt change.
 *
 *   npx tsx scripts/preview-patient-prompt.mjs "recurrent daily headaches"
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const { buildPatientPrompt } = await import('../lib/clinical-master/patientPrompt.ts');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const needle = process.argv[2] || 'recurrent daily headaches';
const { data, error } = await supabase
  .from('stations')
  .select('*')
  .ilike('title', `%${needle}%`)
  .limit(1)
  .single();
if (error) throw error;

const prompt = buildPatientPrompt(data);
console.log(prompt);
console.error(`\n--- ${prompt.length} chars total ---`);
