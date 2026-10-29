import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const admin = readFileSync(new URL('../src/pages/AdminPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('admin overview uses premium statistic cards with tabular values', () => {
  assert.match(admin, /className="admin-stat-card glass rounded-2xl p-5"/);
  assert.match(admin, /admin-stat-value[^>]*tabular-nums/);
  assert.match(css, /\.admin-stat-card\s*\{/);
  assert.match(css, /radial-gradient\(circle, rgba\(245,179,1/);
});

test('admin navigation exposes active state to assistive technology', () => {
  assert.match(admin, /role="group" aria-label="Navigasi dashboard admin"/);
  assert.match(admin, /aria-pressed=\{active\}/);
  assert.match(css, /\.admin-tab\[aria-pressed="true"\]/);
});

test('admin order rows become stacked on narrow screens', () => {
  assert.match(admin, /admin-order-row--managed/);
  assert.match(css, /@media \(max-width: 639px\)\s*\{[\s\S]*?\.admin-order-row--managed\s*\{[^}]*flex-direction:\s*column/);
  assert.match(css, /\.admin-order-row--managed \.admin-order-actions select\s*\{[^}]*min-height:\s*40px/);
});

test('admin card interactions respect reduced-motion and touch devices', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.admin-stat-card, \.admin-order-row\s*\{\s*transition:\s*none/);
  assert.match(css, /@media \(hover: none\)\s*\{[\s\S]*?\.admin-stat-card:hover/);
});

test('Phase 15 audit command is registered without adding dependencies', () => {
  assert.equal(pkg.scripts['audit:phase15'], 'node --test scripts/phase15-visual-polish.test.mjs');
  assert.equal(pkg.dependencies.react, '^18.3.1');
  assert.equal(pkg.dependencies['@supabase/supabase-js'], '^2.57.4');
});
