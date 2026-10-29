import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));

test('package manifest and lockfile root dependencies are synchronized', () => {
  const rootPackage = lock.packages?.[''];
  assert.ok(rootPackage, 'package-lock root package entry is present');
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(rootPackage.name, pkg.name);
  assert.equal(rootPackage.version, pkg.version);
  assert.deepEqual(rootPackage.dependencies ?? {}, pkg.dependencies ?? {});
  assert.deepEqual(rootPackage.devDependencies ?? {}, pkg.devDependencies ?? {});
});

test('build, typecheck, lint, and combined check scripts are registered', () => {
  assert.match(pkg.scripts.build, /vite build/);
  assert.match(pkg.scripts.typecheck, /tsc --noEmit/);
  assert.match(pkg.scripts.lint, /eslint/);
  assert.match(pkg.scripts.check, /typecheck[\s\S]*lint[\s\S]*build/);
});

test('CI uses a supported Node version and runs install, check, regression and release gates', () => {
  const ci = read('.github/workflows/quality.yml');
  assert.match(ci, /node-version:\s*22/);
  assert.match(ci, /run:\s*npm ci/);
  assert.match(ci, /run:\s*npm run check/);
  assert.match(ci, /node --test scripts\/\*\.test\.mjs/);
  assert.match(ci, /run:\s*npm run audit:release/);
});

test('public environment example uses placeholders and does not include secret credentials', () => {
  const env = read('.env.example');
  assert.match(env, /VITE_SUPABASE_URL=https:\/\/YOUR_PROJECT_REF\.supabase\.co/);
  assert.match(env, /VITE_SUPABASE_PUBLISHABLE_KEY=PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE/);
  assert.doesNotMatch(env, /service_role|sb_secret_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{40,}/i);
});

test('environment secrets, dependency tree, and build output are excluded from source commits', () => {
  const ignore = read('.gitignore');
  for (const entry of [/^node_modules$/m, /^dist$/m, /^\.env$/m, /^\.env\.\*$/m, /^!\.env\.example$/m]) {
    assert.match(ignore, entry);
  }
});

test('Vercel routes client-side paths to the SPA entry point and Vite outputs dist', () => {
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(vercel.rewrites?.some((rule) => rule.source === '/(.*)' && rule.destination === '/index.html'));
  const viteConfig = read('vite.config.ts');
  // Vite defaults build.outDir to `dist` unless the config overrides it.
  assert.ok(!/outDir\s*:/.test(viteConfig) || /outDir\s*:\s*['"]dist['"]/.test(viteConfig));
});

test('release audit includes the Phase 35 readiness suite', () => {
  assert.match(pkg.scripts['audit:phase35'] ?? '', /phase35-build-readiness\.test\.mjs/);
  assert.match(pkg.scripts['audit:release'], /npm run audit:phase35/);
});

test('Phase 35 rollout guide distinguishes static tests from live checkout certification', () => {
  const guide = read('PHASE35_BUILD_AND_LIVE_CHECKOUT.md').toLowerCase();
  for (const phrase of [
    'npm ci',
    'npm run check',
    'vercel preview',
    'supabase migration',
    'retry-after-lost-response',
    'payment verification and top-up fulfillment remain manual',
    'not certified production-ready',
  ]) assert.ok(guide.includes(phrase), `guide missing phrase: ${phrase}`);
});
