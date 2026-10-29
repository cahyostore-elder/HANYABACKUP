import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('buyer dashboard shows account context and real order-scoped statistics', () => {
  assert.match(dashboard, /dashboard-hero/);
  assert.match(dashboard, /session\.user\.email/);
  assert.match(dashboard, /orders\.length/);
  assert.match(dashboard, /successfulOrders/);
  assert.match(dashboard, /activeOrdersCount/);
  assert.match(dashboard, /Total Belanja Berhasil/);
});

test('profile editing validates input and confirms an updated row instead of false success', () => {
  assert.match(dashboard, /cleanName\.length > 40 \|\| cleanBio\.length > 160/);
  assert.match(dashboard, /\.update\(\{ display_name: cleanName, bio: cleanBio \}\)/);
  assert.match(dashboard, /\.select\('id'\)\s*\.maybeSingle\(\)/);
  assert.match(dashboard, /if \(error \|\| !data\)/);
  assert.match(dashboard, /disabled=\{saving \|\| !profileDirty \|\| !displayName\.trim\(\)\}/);
  assert.doesNotMatch(dashboard, /\.update\(\{[^}]*\brole\s*:/s);
  assert.doesNotMatch(dashboard, /\.update\(\{[^}]*is_vip\s*:/s);
});

test('homepage offers dashboard access only to signed-in users', () => {
  assert.match(home, /const \{ session, profile \} = useAuth\(\)/);
  assert.match(home, /\{session && \(/);
  assert.match(home, /navigate\('\/dashboard'\)/);
});

test('global polish has keyboard focus and reduced-motion fallbacks', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.dashboard-hero/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.dashboard-anchor \{ scroll-margin-top/);
});

test('Phase 55 automated test is registered', () => {
  assert.equal(packageJson.scripts['audit:phase55'], 'node --test scripts/phase55-buyer-experience.test.mjs');
});
