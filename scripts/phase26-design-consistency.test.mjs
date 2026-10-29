import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const report = readFileSync(new URL('../PHASE26_DESIGN_CONSISTENCY_REPORT.md', import.meta.url), 'utf8');

test('Phase 26 aligns legacy primary tokens to the navy-amethyst-cyan design system', () => {
  assert.match(css, /--primary:\s*#a78bfa/);
  assert.match(css, /--accent:\s*#67e8f9/);
  assert.match(css, /\.text-gradient-gold\s*\{[^}]*#c4b5fd[^}]*#67e8f9/s);
});

test('Phase 26 preserves reduced-motion support and mobile performance refinements', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /max-width:\s*639px/);
  assert.match(css, /backdrop-filter:\s*blur\(14px\)/);
});

test('Phase 26 documents that no database or payment flow changes were made', () => {
  assert.match(report, /Supabase client\/configuration and database queries are unchanged/i);
  assert.match(report, /order creation, payment selection.*are unchanged/i);
});
