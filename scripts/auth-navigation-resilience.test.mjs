import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const login = read('src/pages/LoginPage.tsx');
const signup = read('src/pages/SignupPage.tsx');
const navbar = read('src/components/Navbar.tsx');

test('login always exits loading state and handles rejected auth requests', () => {
  assert.match(login, /try\s*\{/);
  assert.match(login, /catch\s*\{/);
  assert.match(login, /finally\s*\{\s*setLoading\(false\)/);
  assert.match(login, /if \(loading\) return/);
});

test('signup validates bounded identity input and always exits loading state', () => {
  assert.match(signup, /cleanName\.length > 40/);
  assert.match(signup, /cleanEmail\.length > 254/);
  assert.match(signup, /password\.length < 6/);
  assert.match(signup, /finally\s*\{\s*setLoading\(false\)/);
});

test('password controls are accessible and do not submit the form', () => {
  for (const source of [login, signup]) {
    assert.match(source, /type="button" onClick=\{\(\) => setShowPassword/);
    assert.match(source, /aria-label=\{showPassword \? "Sembunyikan password" : "Tampilkan password"\}/);
    assert.match(source, /autoComplete="(?:current|new)-password"/);
  }
});

test('new account profile uses signup metadata and preserves a draft during profile refresh', () => {
  const auth = read('src/context/AuthContext.tsx');
  const dashboard = read('src/pages/DashboardPage.tsx');
  assert.match(auth, /initialDisplayName\.trim\(\)\.slice\(0, 40\)/);
  assert.match(auth, /user_metadata\?\.display_name/);
  assert.match(dashboard, /if \(profile && !profileDirty\)/);
  assert.match(dashboard, /\[profile, profileDirty\]/);
});

test('mobile navigation can be dismissed with Escape and exposes navigation landmarks', () => {
  assert.match(navbar, /if \(event\.key === 'Escape'\) setMobileOpen\(false\)/);
  assert.match(navbar, /aria-label="Navigasi utama"/);
  assert.match(navbar, /aria-label="Navigasi mobile"/);
  assert.match(navbar, /aria-controls="fityora-mobile-navigation"/);
});
