import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const client = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('Supabase client prefers the current publishable key variable', () => {
  assert.match(client, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(client, /VITE_SUPABASE_PUBLISHABLE_KEY[\s\S]*VITE_SUPABASE_ANON_KEY/);
});

test('legacy anon key variable remains supported for existing deployments', () => {
  assert.match(client, /VITE_SUPABASE_ANON_KEY/);
});

test('environment example documents the publishable key and never a secret key', () => {
  assert.match(envExample, /VITE_SUPABASE_URL=/);
  assert.match(envExample, /VITE_SUPABASE_PUBLISHABLE_KEY=/);
  assert.doesNotMatch(envExample, /^\s*VITE_.*(?:SERVICE_ROLE|SECRET_KEY)/im);
});

test('setup warning tells the user the correct environment variable names', () => {
  assert.match(app, /VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(app, /VITE_SUPABASE_ANON_KEY/);
});
