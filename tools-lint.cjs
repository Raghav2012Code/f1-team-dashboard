// High-signal static checks. `node --check` only validates syntax, so it misses
// the failure mode that bit us: an edit that swallows the rest of a function
// and leaves it referencing an out-of-scope variable, and selectors that point
// at ids which no longer exist.
//
// Run: node tools-lint.cjs
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const script = read('script.js');
const html = read('index.html');
const circuits = read('circuits-data.js');
const routes = read('circuit-routes.js');

const problems = [];
const note = (msg) => problems.push(msg);

// 1. Every $('#some-id') in script.js must exist in index.html.
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
for (const m of script.matchAll(/\$\('#([\w-]+)'\)/g)) {
  if (!htmlIds.has(m[1])) note(`script.js references #${m[1]} which is not in index.html`);
}
// Same for data-attribute hooks, which the code writes through.
const htmlDataAttrs = new Set([...html.matchAll(/\s(data-[\w-]+)(?:=|\s|>)/g)].map((m) => m[1]));
for (const m of script.matchAll(/\$\('\[(data-[\w-]+)=/g)) {
  if (!htmlDataAttrs.has(m[1])) note(`script.js references [${m[1]}] which is not in index.html`);
}

// 2. Every element id referenced must also be unique in the markup.
const idCounts = new Map();
for (const m of html.matchAll(/\sid="([^"]+)"/g)) idCounts.set(m[1], (idCounts.get(m[1]) || 0) + 1);
for (const [id, count] of idCounts) {
  if (count > 1) note(`index.html has ${count} elements with id="${id}"`);
}

// 3. Dead functions: a top-level function that is only ever declared, never
// called, is dead code. This is what the truncated function looked like.
const declaredFns = [...script.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
for (const fn of declaredFns) {
  const uses = script.match(new RegExp(`\\b${fn}\\b`, 'g')) || [];
  if (uses.length <= 1) note(`function ${fn}() is declared but never called`);
}

// 4. Cross-file slug agreement.
const slugs = [...circuits.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]);
const routeSlugs = [...routes.matchAll(/"([\w-]+)":\{"width"/g)].map((m) => m[1]);
for (const slug of slugs) {
  if (!routeSlugs.includes(slug)) note(`circuits-data.js has "${slug}" with no racing line`);
}
for (const slug of routeSlugs) {
  if (!slugs.includes(slug)) note(`circuit-routes.js has "${slug}" with no circuit entry`);
}
const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
if (dupes.length) note(`duplicate slugs: ${[...new Set(dupes)].join(', ')}`);

// 5. Every circuit record must carry the fields the renderer reads.
// Records are one per line ending in `},` so split on lines rather than
// balancing braces: a nested weather: { ... } would close them early.
const records = circuits.split('\n')
  .filter((l) => l.trim().startsWith('{ slug:'))
  .map((l) => l.replace(/,\s*$/, ''));
for (const rec of records) {
  const slug = (rec.match(/slug: '([^']+)'/) || [])[1];
  for (const field of ['name', 'length', 'laps', 'date', 'venue', 'lapBase', 'corner', 'eventUrl', 'mapUrl']) {
    if (!new RegExp(`\\b${field}:`).test(rec)) note(`${slug} is missing ${field}`);
  }
  const sectors = (rec.match(/sectors: \[([^\]]*)\]/) || [])[1] || '';
  if (sectors.split(',').filter((s) => s.trim()).length !== 3) note(`${slug} does not have 3 sectors`);
  for (const key of ['air', 'track', 'rain', 'wind', 'asphalt']) {
    if (!rec.includes(`${key}:`)) note(`${slug} weather is missing ${key}`);
  }
  const laps = Number((rec.match(/laps: (\d+)/) || [])[1]);
  if (!(laps >= 44 && laps <= 80)) note(`${slug} laps=${laps} is outside the real 2026 range`);
  const km = parseFloat((rec.match(/length: '([\d.]+)km'/) || [])[1]);
  if (!(km >= 3 && km <= 7.5)) note(`${slug} length=${km}km is implausible`);
  const air = Number((rec.match(/air: (\d+)/) || [])[1]);
  const track = Number((rec.match(/track: (\d+)/) || [])[1]);
  if (Number.isFinite(air) && Number.isFinite(track) && track < air) {
    note(`${slug} track (${track}) is colder than air (${air})`);
  }
}

// 6. Rendering-time invariants that must hold for any circuit.
const lapBaseFor = (slug) => {
  const rec = records.find((r) => r.includes(`slug: '${slug}'`)) || '';
  return Number((rec.match(/lapBase: ([\d.]+)/) || [])[1]);
};
for (const rec of records) {
  const slug = (rec.match(/slug: '([^']+)'/) || [])[1];
  const base = lapBaseFor(slug);
  const laps = Number((rec.match(/laps: (\d+)/) || [])[1]);
  // A one-stop race needs a pit window that leaves a usable second stint.
  const window = Math.max(2, Math.round(laps * 0.45));
  if (window + 3 > laps) note(`${slug} pit window at lap ${window} leaves no second stint`);
  if (base < 60 || base > 120) note(`${slug} lapBase=${base}s is implausible`);
  // Race length sanity, used for the time cap readout.
  const raceSeconds = laps * base;
  if (raceSeconds < 2000 || raceSeconds > 7200) {
    note(`${slug} race distance ${Math.round(raceSeconds)}s is implausible`);
  }
}

// Report
if (problems.length === 0) {
  console.log('clean');
} else {
  problems.forEach((p) => console.log(`  ${p}`));
  console.log(`\n${problems.length} problem(s)`);
  process.exitCode = 1;
}
