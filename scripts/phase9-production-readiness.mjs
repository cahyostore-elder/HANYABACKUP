import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const dependencyFolderIsSafe = (() => {
  if (!/^node_modules$/m.test(read('.gitignore'))) return false;
  try {
    const tracked = execFileSync('git', ['ls-files', '--', 'node_modules'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return tracked.trim().length === 0;
  } catch {
    return !fs.existsSync(path.join(root, 'node_modules'));
  }
})();

for (const file of ['index.html', 'package.json', 'vercel.json', '.env.example', 'src/lib/supabase.ts']) {
  check(`required file: ${file}`, fs.existsSync(path.join(root, file)));
}
const pkg = JSON.parse(read('package.json'));
check('Vite build script exists', typeof pkg.scripts?.build === 'string' && pkg.scripts.build.includes('vite build'));
check('typecheck script exists', typeof pkg.scripts?.typecheck === 'string');
check('lint script exists', typeof pkg.scripts?.lint === 'string');
check('Phase 9 audit command registered', pkg.scripts?.['audit:phase9'] === 'node scripts/phase9-production-readiness.mjs');

const vercel = JSON.parse(read('vercel.json'));
check('Vercel SPA fallback rewrites to index.html', Array.isArray(vercel.rewrites) && vercel.rewrites.some((r) => r.source === '/(.*)' && r.destination === '/index.html'));
const env = read('.env.example');
check('Supabase URL variable documented', /VITE_SUPABASE_URL=/.test(env));
check('Supabase public key variable documented', /VITE_SUPABASE_ANON_KEY=/.test(env));
check('Example key is clearly a placeholder', /PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE|PASTE_YOUR_SUPABASE_ANON_KEY_HERE/.test(env));
const client = read('src/lib/supabase.ts');
check('Supabase client detects the example key placeholder', /PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE/.test(client) && /PASTE_YOUR_SUPABASE_ANON_KEY_HERE/.test(client));
check('Supabase config does not use service-role key name', !/SUPABASE_SERVICE_ROLE_KEY/.test(client));
check('Placeholder guard has a safe missing-project fallback', /missing-project\.supabase\.co/.test(client) && /missing-public-supabase-key/.test(client));
check('node_modules is ignored and no dependency files are committed', dependencyFolderIsSafe);

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\nPhase 9 production-readiness checks: ${checks.length - failed}/${checks.length} passed`);
if (failed) process.exitCode = 1;
