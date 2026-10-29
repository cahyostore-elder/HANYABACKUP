import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const report = readFileSync(new URL('../PHASE24_UI_REFRESH_REPORT.md', import.meta.url), 'utf8');

test('Phase 24 defines midnight violet and cyan palette', () => {
  assert.match(css, /--primary:\s*#a78bfa/i);
  assert.match(css, /--accent:\s*#22d3ee/i);
  assert.match(css, /Midnight Amethyst UI refresh/i);
});

test('Phase 24 includes responsive and reduced-motion rules', () => {
  assert.match(css, /@media\s*\(max-width:\s*639px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('Phase 24 includes keyboard focus and image fit safeguards', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(report, /Supabase configuration, catalog queries, RPC names/);
});
