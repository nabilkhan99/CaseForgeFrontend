/**
 * Measures stripStageDirections() retention across every active station script.
 *
 * The old implementation retained ~20% on average. Run this before/after any
 * change to that function:  node scripts/check-strip-retention.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Load NEXT_* / SUPABASE_* from .env.local without pulling in a dep.
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- the OLD implementation, for comparison -------------------------------
function oldStrip(text) {
  let out = text;
  out = out.replace(/\([^)]*\)\s*/g, '');
  out = out.replace(/\*[^*]+\*\s*/g, '');
  out = out.replace(/^"(.*)"$/gm, '$1');
  out = out.replace(/ {2,}/g, ' ');
  out = out.replace(/\n\s*\n\s*\n/g, '\n\n');
  return out.trim();
}

const { stripStageDirections } = await import('../lib/clinical-master/patientPrompt.ts');

const { data, error } = await supabase
  .from('stations')
  .select('title, station_script')
  .eq('is_active', true);
if (error) throw error;

const KEYWORDS = ['codeine', 'co-codamol', 'ibuprofen', 'If asked', 'brain tumour'];
let oldTotal = 0;
let newTotal = 0;
let rawTotal = 0;
const worst = [];

for (const s of data) {
  const raw = s.station_script || '';
  if (!raw) continue;
  const o = oldStrip(raw).length;
  const n = stripStageDirections(raw).length;
  rawTotal += raw.length;
  oldTotal += o;
  newTotal += n;
  worst.push({ title: s.title.slice(0, 46), pctOld: (100 * o) / raw.length, pctNew: (100 * n) / raw.length });
}

worst.sort((a, b) => a.pctNew - b.pctNew);

console.log(`stations: ${worst.length}`);
console.log(`OLD retained: ${((100 * oldTotal) / rawTotal).toFixed(1)}%`);
console.log(`NEW retained: ${((100 * newTotal) / rawTotal).toFixed(1)}%`);
console.log(`\nlowest-retention stations under the NEW function:`);
for (const w of worst.slice(0, 5)) {
  console.log(`  ${w.pctNew.toFixed(0).padStart(3)}%  (was ${w.pctOld.toFixed(0)}%)  ${w.title}`);
}

// keyword survival on the headache case
const headache = data.find((s) => /recurrent daily headaches/i.test(s.title));
if (headache) {
  const before = oldStrip(headache.station_script);
  const after = stripStageDirections(headache.station_script);
  console.log(`\nheadache case keyword survival:`);
  for (const k of KEYWORDS) {
    const inRaw = headache.station_script.toLowerCase().includes(k.toLowerCase());
    const inOld = before.toLowerCase().includes(k.toLowerCase());
    const inNew = after.toLowerCase().includes(k.toLowerCase());
    if (inRaw) console.log(`  ${k.padEnd(14)} raw:yes  old:${inOld ? 'yes' : 'NO '}  new:${inNew ? 'yes' : 'NO '}`);
  }
}

// --- assessment-leak gate ------------------------------------------------
// The patient must never see how the candidate is scored. 35 of 79 scripts
// carry inline mark-scheme notes; the original catch-all paren strip hid them
// by accident, so preserving clinical parentheticals made them visible.
const LEAK_RE =
  /\b(critically fails?|candidate (?:critically )?(?:fails?|passes|scores?)|mark(?:ing)? scheme|examiner (?:expects|awards|wants|is looking|will mark))\b/i;

const leaked = [];
for (const s of data) {
  const raw = s.station_script || '';
  if (!raw) continue;
  if (LEAK_RE.test(stripStageDirections(raw))) leaked.push(s.title.slice(0, 52));
}

const rawLeaks = data.filter((s) => LEAK_RE.test(s.station_script || '')).length;
console.log(`\nassessment notes in raw scripts : ${rawLeaks}/${data.length}`);
console.log(`still visible after stripping   : ${leaked.length}`);
for (const t of leaked.slice(0, 8)) console.log(`  LEAK: ${t}`);

const pctNew = (100 * newTotal) / rawTotal;
let failed = false;
if (pctNew < 90) {
  console.error(`\nFAIL: retention ${pctNew.toFixed(1)}% is below the 90% floor.`);
  failed = true;
}
if (leaked.length > 0) {
  console.error(`\nFAIL: ${leaked.length} station(s) leak assessment language to the patient.`);
  failed = true;
}
if (failed) process.exit(1);
console.log(`\nPASS: retention ${pctNew.toFixed(1)}%, 0 assessment leaks`);
