import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const localEnvExists = existsSync(new URL('../.env.local', import.meta.url));
const localEnv = localEnvExists ? readFileSync(new URL('../.env.local', import.meta.url), 'utf8') : '';
const exampleEnv = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function envValue(source, name) {
  const match = source.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match?.[1]?.trim() ?? '';
}

test('local configuration uses a public publishable key when present or a safe template when omitted', () => {
  if (localEnvExists) {
    assert.equal(envValue(localEnv, 'VITE_SUPABASE_URL'), 'https://xgmbwvwiryimwenhwhbu.supabase.co');
    assert.match(envValue(localEnv, 'VITE_SUPABASE_PUBLISHABLE_KEY'), /^sb_publishable_/);
    assert.equal(envValue(localEnv, 'VITE_SUPABASE_ANON_KEY'), envValue(localEnv, 'VITE_SUPABASE_PUBLISHABLE_KEY'));
    assert.doesNotMatch(localEnv, /sb_secret_|service_role/i);
  } else {
    assert.match(exampleEnv, /^VITE_SUPABASE_URL=https:\/\/YOUR_PROJECT_REF\.supabase\.co$/m);
    assert.match(exampleEnv, /^VITE_SUPABASE_PUBLISHABLE_KEY=PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE$/m);
  }
});

test('publishable variable takes precedence and legacy anon variable remains supported', () => {
  assert.match(client, /VITE_SUPABASE_PUBLISHABLE_KEY\?\.trim\(\)\s*\|\|[\s\S]*VITE_SUPABASE_ANON_KEY/);
});

test('Vite rejects high-privilege keys before a browser bundle is emitted', () => {
  assert.match(viteConfig, /\['sb', 'secret'\]\.join\('_'\)/);
  assert.match(viteConfig, /\['service', 'role'\]\.join\('_'\)/);
  assert.match(viteConfig, /VITE_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(viteConfig, /VITE_SUPABASE_SECRET_KEY/);
  assert.match(viteConfig, /throw new Error/);
  assert.doesNotMatch(client, /service_role|sb_secret_/i);
});

test('example config and README explain public key usage and local/Vercel separation', () => {
  assert.match(exampleEnv, /^VITE_SUPABASE_PUBLISHABLE_KEY=/m);
  assert.match(exampleEnv, /high-privilege server key/i);
  assert.match(readme, /\.env\.local/);
  assert.match(readme, /Environment Variables/);
  assert.match(readme, /RLS/);
  assert.match(readme, /vite\.config\.ts/);
});

test('local environment stays excluded from Git and the focused audit is discoverable', () => {
  assert.match(ignore, /\.env\.\*/);
  assert.equal(packageJson.scripts['audit:phase51'], 'node --test scripts/phase51-local-config.test.mjs');
});
