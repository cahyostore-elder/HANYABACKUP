import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const add = (name, pass, detail = '') => checks.push({ name, pass: Boolean(pass), detail });
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const rel = path.posix.join(dir, entry.name);
  if (entry.isDirectory()) return ['node_modules', 'dist', '.git'].includes(entry.name) ? [] : walk(rel);
  return [rel];
});

let pkg = {}, lock = {};
try { pkg = JSON.parse(read('package.json')); } catch {}
try { lock = JSON.parse(read('package-lock.json')); } catch {}
add('manifest and lockfile package identity match', pkg.name && lock.packages?.['']?.name === pkg.name && pkg.version === lock.packages?.['']?.version);
add('required public Supabase variables are documented', /VITE_SUPABASE_URL=/.test(read('.env.example')) && /VITE_SUPABASE_PUBLISHABLE_KEY=/.test(read('.env.example')));
add('example environment values are unmistakable placeholders', /YOUR_PROJECT_REF/.test(read('.env.example')) && /PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE/.test(read('.env.example')));
add('local environment files are ignored while example is tracked', /\.env\.\*/.test(read('.gitignore')) && /!\.env\.example/.test(read('.gitignore')) && /^\.env$/m.test(read('.gitignore')));
add('Vercel SPA routing is configured', /"destination"\s*:\s*"\/index\.html"/.test(read('vercel.json')));
add('production build and typecheck commands exist', typeof pkg.scripts?.build === 'string' && typeof pkg.scripts?.typecheck === 'string' && typeof pkg.scripts?.check === 'string');
add('CI installs from lockfile and runs release checks', /npm ci/.test(read('.github/workflows/quality.yml')) && /npm run check/.test(read('.github/workflows/quality.yml')) && /npm run audit:release/.test(read('.github/workflows/quality.yml')));
const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((n) => n.endsWith('.sql')).sort();
add('migration names are timestamped and unique', migrations.length > 0 && migrations.every((n) => /^\d{8,14}_.+\.sql$/.test(n)) && new Set(migrations).size === migrations.length);
const sourceFiles = walk('src').filter((p) => /\.(tsx?|jsx?)$/.test(p));
const suspicious = /\bservice_role\b|sb_secret_[A-Za-z0-9]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;
const leaked = sourceFiles.filter((p) => suspicious.test(read(p)));
add('frontend source contains no obvious server secret markers', leaked.length === 0, leaked.length ? leaked.join(', ') : '');
const localEnv = exists('.env.local') ? read('.env.local') : '';
const localEnvIsPublicOnly = !exists('.env.local') || (
  /^VITE_SUPABASE_URL=https:\/\/[^\s]+$/m.test(localEnv) &&
  /^VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_[A-Za-z0-9_-]+$/m.test(localEnv) &&
  !suspicious.test(localEnv) &&
  !/VITE_SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_SECRET_KEY/i.test(localEnv)
);
add('local config is public-only and node_modules/dist are excluded', !exists('.env') && localEnvIsPublicOnly && !exists('node_modules') && !exists('dist'));

let failed = 0;
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  if (!c.pass) failed++;
}
console.log(`\nPhase 30 production check: ${checks.length - failed}/${checks.length} passed`);
if (failed) process.exitCode = 1;
