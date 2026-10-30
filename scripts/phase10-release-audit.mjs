import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
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

const pkg = JSON.parse(read('package.json'));
check('release source entry exists', exists('src/main.tsx') && exists('src/App.tsx'));
check('lockfile exists and parses', (() => { try { JSON.parse(read('package-lock.json')); return true; } catch { return false; } })());
check('build/typecheck/lint scripts defined', Boolean(pkg.scripts?.build && pkg.scripts?.typecheck && pkg.scripts?.lint));
check('phase 5-9 audit scripts are registered', ['audit:static','audit:phase6','audit:phase7','audit:phase8','audit:phase9'].every(k => typeof pkg.scripts?.[k] === 'string'));
check('Vercel SPA fallback exists', /"destination"\s*:\s*"\/index\.html"/.test(read('vercel.json')));
check('node_modules is ignored and no dependency files are committed', /^node_modules$/m.test(read('.gitignore')) && !hasTrackedNodeModules());
check('no production .env file bundled', !exists('.env'));
check('environment template uses public Vite key only', /VITE_SUPABASE_ANON_KEY=/.test(read('.env.example')) && !/SERVICE_ROLE|SECRET_KEY/i.test(read('.env.example')));
check('release report included', exists('PHASE10_RELEASE_CANDIDATE.md'));
let failed = 0;
for (const c of checks) { console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}`); if (!c.ok) failed++; }
console.log(`\nPhase 10 release audit: ${checks.length-failed}/${checks.length} passed`);
if (failed) process.exitCode = 1;
