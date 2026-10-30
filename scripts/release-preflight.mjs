import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const add = (label, pass, detail = '') => checks.push({ label, pass: Boolean(pass), detail });
const exists = (relative) => fs.existsSync(path.join(root, relative));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
function hasTrackedNodeModules() {
  try {
    const tracked = execFileSync('git', ['ls-files', '--', 'node_modules'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return tracked.trim().length > 0;
  } catch {
    // Outside a Git checkout (for example, an extracted release archive),
    // fall back to checking whether the dependency directory is present.
    return fs.existsSync(path.join(root, 'node_modules'));
  }
}


let pkg;
let lock;
try { pkg = JSON.parse(read('package.json')); } catch { pkg = {}; }
try { lock = JSON.parse(read('package-lock.json')); } catch { lock = {}; }

add('React entry and application exist', exists('src/main.tsx') && exists('src/App.tsx'));
add('Supabase client module exists', exists('src/lib/supabase.ts'));
add('Vercel SPA fallback exists', /"destination"\s*:\s*"\/index\.html"/.test(read('vercel.json')));
add('Lockfile package name matches manifest', Boolean(pkg.name) && lock.packages?.['']?.name === pkg.name);
add('Build, lint, and typecheck scripts exist', ['build', 'lint', 'typecheck', 'check'].every((key) => typeof pkg.scripts?.[key] === 'string'));
add('Public Supabase variable names are documented', /VITE_SUPABASE_URL/.test(read('.env.example')) && /VITE_SUPABASE_PUBLISHABLE_KEY/.test(read('.env.example')));
add('Environment template has placeholders only', /YOUR_PROJECT_REF|PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE/.test(read('.env.example')) && !/service_role|sb_secret_/i.test(read('.env.example')));
add('Environment files are ignored', /\.env\.\*/.test(read('.gitignore')) && /!\.env\.example/.test(read('.gitignore')));
add('CI quality workflow exists', exists('.github/workflows/quality.yml'));
add('Manual payment is disclosed in release docs', /manual/i.test(read('README.md')) && /manual/i.test(read('PHASE28_RELEASE_READINESS.md')));
add('node_modules is ignored and no dependency files are committed', /^node_modules$/m.test(read('.gitignore')) && !hasTrackedNodeModules());
const localEnv = exists('.env.local') ? read('.env.local') : '';
const localEnvIsPublicOnly = !exists('.env.local') || (
  /^VITE_SUPABASE_URL=https:\/\/[^\s]+$/m.test(localEnv) &&
  /^VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_[A-Za-z0-9_-]+$/m.test(localEnv) &&
  !/service_role|sb_secret_[A-Za-z0-9]+|VITE_SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_SECRET_KEY/i.test(localEnv)
);
add('Local environment contains only public Supabase client config', !exists('.env') && localEnvIsPublicOnly);

let failed = 0;
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
  if (!check.pass) failed++;
}
console.log(`\nRelease preflight: ${checks.length - failed}/${checks.length} passed`);
if (failed) process.exitCode = 1;
