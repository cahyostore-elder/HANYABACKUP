import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const add = (name, pass, detail = '') => checks.push({ name, pass: Boolean(pass), detail });
const exists = (relative) => fs.existsSync(path.join(root, relative));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const ignoredLines = read('.gitignore').split('\n').map((line) => line.trim());

const isExcludedFromGit = (relative) => {
  try {
    execFileSync('git', ['check-ignore', '-q', relative], {
      cwd: root,
      stdio: 'ignore',
    });
    const tracked = execFileSync('git', ['ls-files', '--', relative], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return tracked.trim().length === 0;
  } catch {
    // In an extracted release archive there is no Git index to inspect.
    return ignoredLines.includes(relative) && !exists(relative);
  }
};

const walk = (relative) => fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
  const next = path.posix.join(relative, entry.name);
  if (entry.isDirectory()) return ['node_modules', 'dist', '.git'].includes(entry.name) ? [] : walk(next);
  return [next];
});

let pkg = {}, lock = {};
try { pkg = JSON.parse(read('package.json')); } catch {}
try { lock = JSON.parse(read('package-lock.json')); } catch {}
add('manifest and lockfile package identity match', pkg.name && lock.packages?.['']?.name === pkg.name && pkg.version === lock.packages?.['']?.version);
add('required public Supabase variables are documented', read('.env.example').includes('VITE_SUPABASE_URL=') && read('.env.example').includes('VITE_SUPABASE_PUBLISHABLE_KEY='));
add('example environment values are unmistakable placeholders', read('.env.example').includes('YOUR_PROJECT_REF') && read('.env.example').includes('PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE'));
add('local environment files are ignored while example is tracked', ignoredLines.includes('.env.*') && ignoredLines.includes('!.env.example') && ignoredLines.includes('.env'));
const vercel = JSON.parse(read('vercel.json'));
add('Vercel SPA routing is configured', Array.isArray(vercel.rewrites) && vercel.rewrites.some((rule) => rule.destination === '/index.html'));
add('production build and typecheck commands exist', typeof pkg.scripts?.build === 'string' && typeof pkg.scripts?.typecheck === 'string' && typeof pkg.scripts?.check === 'string');
const workflow = read('.github/workflows/quality.yml');
add('CI installs from lockfile and runs release checks', workflow.includes('npm ci') && workflow.includes('npm run check') && workflow.includes('npm run audit:release'));

const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort();
const migrationNamesValid = migrations.length > 0 && migrations.every((name) => /^[0-9]{8,14}_.+[.]sql$/.test(name)) && new Set(migrations).size === migrations.length;
add('migration names are timestamped and unique', migrationNamesValid);

const sourceFiles = walk('src').filter((file) => file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx'));
const hasSecretMarker = (value) => {
  const lower = value.toLowerCase();
  return lower.includes('service_role') || lower.includes('sb_secret_') || value.includes('-----BEGIN RSA PRIVATE KEY-----') || value.includes('-----BEGIN PRIVATE KEY-----');
};
const leaked = sourceFiles.filter((file) => hasSecretMarker(read(file)));
add('frontend source contains no obvious server secret markers', leaked.length === 0, leaked.length ? leaked.join(', ') : '');

const localEnv = exists('.env.local') ? read('.env.local') : '';
const readEnvValue = (name) => localEnv.split('\n').find((line) => line.startsWith(name + '='))?.slice(name.length + 1).trim() ?? '';
const localEnvIsPublicOnly = !exists('.env.local') || (
  readEnvValue('VITE_SUPABASE_URL').startsWith('https://') &&
  /^sb_publishable_[A-Za-z0-9_-]+$/.test(readEnvValue('VITE_SUPABASE_PUBLISHABLE_KEY')) &&
  !hasSecretMarker(localEnv) &&
  !localEnv.includes('VITE_SUPABASE_SERVICE_ROLE_KEY') &&
  !localEnv.includes('VITE_SUPABASE_SECRET_KEY')
);
const nodeModulesExcluded = isExcludedFromGit('node_modules');
const distExcluded = isExcludedFromGit('dist');
add('local config is public-only and node_modules/dist are excluded', !exists('.env') && localEnvIsPublicOnly && nodeModulesExcluded && distExcluded, 'env=' + (!exists('.env') && localEnvIsPublicOnly) + ', node_modules=' + nodeModulesExcluded + ', dist=' + distExcluded);

let failed = 0;
for (const check of checks) {
  console.log((check.pass ? 'PASS ' : 'FAIL ') + check.name + (check.detail ? ' — ' + check.detail : ''));
  if (!check.pass) failed += 1;
}
console.log('\nPhase 30 production check: ' + (checks.length - failed) + '/' + checks.length + ' passed');
if (failed) process.exitCode = 1;
