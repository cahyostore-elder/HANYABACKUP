import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const failures = [];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
function check(ok, name, detail = '') {
  (ok ? checks : failures).push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

for (const file of [
  'package.json', 'package-lock.json', 'src/context/AuthContext.tsx',
  'src/pages/TopupPage.tsx', 'src/pages/AdminPage.tsx',
  'src/lib/supabase.ts', 'supabase/migrations/20261026030000_manual_order_workflow_hardening.sql',
  'vercel.json', '.env.example',
]) check(exists(file), `Required file: ${file}`);

let pkg;
let lock;
try {
  pkg = JSON.parse(read('package.json'));
  lock = JSON.parse(read('package-lock.json'));
  check(pkg.name === lock.packages?.['']?.name, 'Package name matches package lock');
  check(pkg.version === lock.packages?.['']?.version, 'Package version matches package lock');
  check(pkg.scripts?.build && pkg.scripts?.typecheck && pkg.scripts?.lint, 'Build/typecheck/lint scripts exist');
  check(pkg.scripts?.['audit:phase6'] === 'node scripts/phase6-preflight.mjs', 'Phase 6 preflight script is registered');
  for (const section of ['dependencies', 'devDependencies']) {
    for (const [name, range] of Object.entries(pkg[section] ?? {})) {
      check(lock.packages?.['']?.[section]?.[name] === range, `Lockfile range matches ${name}`);
    }
  }
} catch (error) {
  check(false, 'Package metadata can be parsed', error instanceof Error ? error.message : String(error));
}

const auth = read('src/context/AuthContext.tsx');
const subscribeAt = auth.indexOf('supabase.auth.onAuthStateChange');
const getSessionAt = auth.indexOf('supabase.auth.getSession()');
check(subscribeAt >= 0 && getSessionAt > subscribeAt, 'Auth listener subscribes before stored-session fallback');
check(auth.includes('let authEventSeen = false;'), 'Auth bootstrap tracks whether a newer auth event arrived');
check((auth.match(/if \(!mounted \|\| authEventSeen\) return;/g) ?? []).length >= 2, 'Late getSession success/error cannot override auth event');
check(auth.includes('requestId !== profileRequestId.current'), 'Stale profile responses are ignored');
check(auth.includes("window.alert('Gagal keluar dari akun."), 'Sign-out failure provides user feedback');

const topup = read('src/pages/TopupPage.tsx');
check(topup.includes("supabase.rpc('create_topup_order'"), 'Checkout uses server-side order RPC');
check(topup.includes('Number(order?.total_amount)'), 'Checkout reads and validates order total returned by server');
check(topup.includes('finally {\n      setPlacing(false);'), 'Checkout clears pending state in finally');

const admin = read('src/pages/AdminPage.tsx');
check(admin.includes("supabase.rpc('admin_update_order_status'"), 'Admin uses guarded status RPC');
check(admin.includes('if (updateError)'), 'Admin reports status-update failures');

const sql = read('supabase/migrations/20261026030000_manual_order_workflow_hardening.sql');
check(sql.includes('auth.uid() IS NULL OR NOT public.is_admin()'), 'Order status update requires authenticated admin/author');
check(sql.includes("v_order.status = 'pending' AND p_status = 'success'"), 'Order cannot jump directly from pending to success');
check(sql.includes("v_order.status IN ('success', 'failed')"), 'Terminal order statuses cannot be changed');
check(sql.includes('payment_verified_at = now()'), 'Payment verification timestamp is recorded on processing');
check(sql.includes('fulfillment_completed_at = now()'), 'Fulfillment timestamp is recorded on success');

const client = read('src/lib/supabase.ts');
check(client.includes('VITE_SUPABASE_URL') && client.includes('VITE_SUPABASE_ANON_KEY'), 'Supabase keys come from public Vite env variables');
check(!/service_role|sb_secret_[A-Za-z0-9_-]{10,}/i.test(client), 'Supabase client contains no obvious service-role key');
const env = read('.env.example');
check(env.includes('VITE_SUPABASE_URL=') && env.includes('VITE_SUPABASE_ANON_KEY='), 'Environment template names required variables');
check(!/^(?!#).*service_role/m.test(env), 'Environment template does not request a service-role key');

try {
  const config = JSON.parse(read('vercel.json'));
  check(Array.isArray(config.rewrites) && config.rewrites.some((r) => r.destination === '/index.html'), 'Vercel SPA rewrite points to index.html');
} catch (error) {
  check(false, 'Vercel config parses as JSON', error instanceof Error ? error.message : String(error));
}

console.log('FITYORASTORE PHASE 6 — SOURCE PREFLIGHT (STATIC; NOT A BUILD)');
console.log([...checks, ...failures].join('\n'));
console.log(`\nResult: ${failures.length} failure(s), ${checks.length} check(s) passed.`);
if (failures.length) process.exitCode = 1;
