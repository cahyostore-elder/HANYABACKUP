import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const checks = [];
const exists = (p) => fs.existsSync(path.join(root, p));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function check(condition, label, detail = '') {
  (condition ? checks : failures).push(`${condition ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
}

const required = [
  'package.json', 'package-lock.json', 'index.html', 'vite.config.ts',
  'vercel.json', 'src/main.tsx', 'src/App.tsx', 'src/lib/supabase.ts',
  'supabase/migrations/20261026030000_manual_order_workflow_hardening.sql',
];
for (const file of required) check(exists(file), `Required file: ${file}`);

let pkg;
let lock;
try {
  pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  check(true, 'package.json and package-lock.json parse as JSON');
  check(lock.packages?.['']?.name === pkg.name, 'Package name matches lockfile');
  check(lock.packages?.['']?.version === pkg.version, 'Package version matches lockfile');
  check(Boolean(pkg.scripts?.build && pkg.scripts?.typecheck && pkg.scripts?.lint), 'Build/typecheck/lint scripts are defined');
} catch (error) {
  check(false, 'Package metadata parses', error instanceof Error ? error.message : String(error));
}

const sourceFiles = walk(path.join(root, 'src')).filter((f) => /\.[cm]?[jt]sx?$|\.css$/.test(f));
const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.svg'];
function resolves(specifier, importer) {
  if (specifier.startsWith('@/')) specifier = path.join(root, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) specifier = path.resolve(path.dirname(importer), specifier);
  else return true; // npm package or URL; dependency installation is checked separately.
  return extensions.some((ext) => fs.existsSync(specifier + ext)) ||
    ['index.ts', 'index.tsx', 'index.js', 'index.jsx'].some((name) => fs.existsSync(path.join(specifier, name)));
}

let importCount = 0;
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const pattern = /(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g;
  for (const match of content.matchAll(pattern)) {
    const specifier = match[1];
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
    importCount++;
    if (!resolves(specifier, file)) failures.push(`FAIL Unresolved local import — ${path.relative(root, file)} -> ${specifier}`);
  }
}
if (importCount >= 0) checks.push(`PASS Local import resolution scan — ${importCount} imports scanned`);

const vercel = exists('vercel.json') ? fs.readFileSync(path.join(root, 'vercel.json'), 'utf8') : '';
try {
  const config = JSON.parse(vercel);
  check(Array.isArray(config.rewrites) && config.rewrites.length > 0, 'Vercel SPA rewrite is configured');
} catch (error) {
  check(false, 'Vercel config parses as JSON', error instanceof Error ? error.message : String(error));
}

const supabase = fs.readFileSync(path.join(root, 'src/lib/supabase.ts'), 'utf8');
check(supabase.includes('VITE_SUPABASE_URL') && supabase.includes('VITE_SUPABASE_ANON_KEY'), 'Supabase client reads public environment variables');
check(!/service_role|sb_secret_[A-Za-z0-9_-]{10,}/i.test(supabase), 'No recognizable service-role/secret key literal in Supabase client');

const workflow = fs.readFileSync(path.join(root, 'supabase/migrations/20261026030000_manual_order_workflow_hardening.sql'), 'utf8');
check(workflow.includes('auth.uid()') && workflow.includes('public.is_admin()'), 'Order status RPC checks authenticated staff');
check(workflow.includes("v_order.status = 'pending' AND p_status = 'success'"), 'Order workflow blocks pending-to-success shortcut');
check(workflow.includes("v_order.status IN ('success', 'failed')"), 'Order workflow treats final statuses as terminal');

console.log('FITYORASTORE PHASE 5 — STATIC AUDIT');
console.log([...checks, ...failures].join('\n'));
console.log(`\nResult: ${failures.length} failure(s), ${checks.length} check(s) passed.`);
if (failures.length) process.exitCode = 1;
