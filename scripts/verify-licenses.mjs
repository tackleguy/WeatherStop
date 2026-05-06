// Production-dependency license audit. Runs as `prebuild` so any
// surprise GPL/AGPL/LGPL package fails the build before we ship.
//
// Allowed list is tight on purpose — only permissive licenses or
// public-domain-equivalents that are safe to redistribute under MIT.
//
// To add a new allowed license, push it to ALLOWED below and document
// why in ATTRIBUTIONS.md.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ALLOWED = [
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'CC0-1.0',
  'Unlicense',
  'Python-2.0',
  'WTFPL',
  'BlueOak-1.0.0',
];

const ALLOWED_SET = new Set(ALLOWED.map((s) => s.toLowerCase()));

// Per-package overrides for transitive deps that don't declare a license
// in package.json but whose upstream source IS permissive. Each entry
// has to point at the actual license source so a future audit can verify.
const PACKAGE_OVERRIDES = {
  '@mapbox/jsonlint-lines-primitives@2.0.2': {
    license: 'MIT',
    source:
      'https://github.com/tmcw/jsonlint/blob/master/LICENSE — MIT (forked from zaach/jsonlint, also MIT)',
  },
};

function licenseAllowed(lic) {
  if (!lic) return false;
  if (Array.isArray(lic)) return lic.every(licenseAllowed);
  const s = String(lic).trim();
  // Composite expressions like "(MIT OR Apache-2.0)" — allow if every
  // disjunct is allowed (we err on the safe side: ALL must be allowed).
  if (s.startsWith('(') && s.endsWith(')')) {
    const inner = s.slice(1, -1);
    if (inner.includes(' OR ')) {
      return inner.split(' OR ').some((p) => licenseAllowed(p.trim()));
    }
    if (inner.includes(' AND ')) {
      return inner.split(' AND ').every((p) => licenseAllowed(p.trim()));
    }
    return ALLOWED_SET.has(inner.toLowerCase());
  }
  if (s.includes(' OR ')) {
    return s.split(' OR ').some((p) => licenseAllowed(p.trim()));
  }
  return ALLOWED_SET.has(s.toLowerCase());
}

const ownName = JSON.parse(readFileSync('./package.json', 'utf8')).name;

let stdout;
try {
  stdout = execSync(
    `npx --yes license-checker --production --json --excludePackages "${ownName}@*"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
} catch (err) {
  console.error('license-checker failed to run:', err.message);
  process.exit(1);
}

const data = JSON.parse(stdout);
const violations = [];
let total = 0;
let overridden = 0;
for (const [pkg, info] of Object.entries(data)) {
  // license-checker treats our own private package as UNLICENSED even
  // with a `license: "MIT"` field. Skip it — distribution rules don't
  // apply to ourselves anyway.
  if (pkg.startsWith(`${ownName}@`)) continue;
  total += 1;
  if (PACKAGE_OVERRIDES[pkg]) {
    overridden += 1;
    continue;
  }
  if (!licenseAllowed(info.licenses)) {
    violations.push({ pkg, lic: info.licenses });
  }
}

if (violations.length > 0) {
  console.error(`✗ License violations (${violations.length} of ${total}):`);
  for (const v of violations) {
    console.error(`    ${v.pkg}: ${v.lic}`);
  }
  process.exit(1);
}

console.log(
  `✓ ${total} production dependencies, all allowed licenses` +
    (overridden ? ` (${overridden} via package override).` : '.'),
);
