import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, csvCell, parseRupiah } from '../src/lib/bulkPricing.mjs';
import { parsePromoDestination } from '../src/lib/promoDestination.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const admin = read('src/pages/AdminPage.tsx');
const promo = read('src/components/PromoSlider.tsx');
const pkg = JSON.parse(read('package.json'));

 test('promo destination accepts internal routes and canonical HTTPS links only', () => {
  assert.deepEqual(parsePromoDestination('#/topup/game'), { type: 'internal', href: '/topup/game' });
  assert.deepEqual(parsePromoDestination(' https://example.com/promo '), { type: 'external', href: 'https://example.com/promo' });
  assert.equal(parsePromoDestination('javascript:alert(1)'), null);
  assert.equal(parsePromoDestination('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(parsePromoDestination('http://example.com'), null);
  assert.equal(parsePromoDestination('//example.com'), null);
  assert.equal(parsePromoDestination('https://user:pass@example.com'), null);
  assert.equal(parsePromoDestination('#/bad\\route'), null);
  assert.equal(parsePromoDestination('https://example.com/\nmalicious'), null);
  assert.equal(parsePromoDestination(`https://example.com/${'a'.repeat(2050)}`), null);
});

test('CSV parser correctly reads quotes, comma, multiline cells and escaped quote characters', () => {
  const rows = parseCsv('id,name,price\r\n1,"Diamonds, Pack","15,000"\r\n2,"Catatan baris 1\nbaris 2","20.000"\r\n3,"Quote ""aman""",25000\r\n');
  assert.deepEqual(rows, [
    { id: '1', name: 'Diamonds, Pack', price: '15,000' },
    { id: '2', name: 'Catatan baris 1\nbaris 2', price: '20.000' },
    { id: '3', name: 'Quote "aman"', price: '25000' },
  ]);
  assert.equal(parseRupiah(rows[0].price), 15000);
});

test('CSV parser rejects malformed quotes and duplicate headers instead of guessing prices', () => {
  assert.throws(() => parseCsv('id,name\n1,"nama'), /belum ditutup/);
  assert.throws(() => parseCsv('id,name\n1,na"ma'), /awal kolom/);
  assert.throws(() => parseCsv('id,name\n1,"nama"x'), /di luar tanda kutip/);
  assert.throws(() => parseCsv('id,ID\n1,2'), /kolom duplikat/);
});

test('CSV export defuses spreadsheet formulas including formulas after whitespace', () => {
  assert.equal(csvCell('=1+1'), "'=1+1");
  assert.equal(csvCell('  @SUM(A1:A2)'), "'  @SUM(A1:A2)");
  assert.equal(csvCell('-CMD()'), "'-CMD()");
  assert.equal(csvCell('15,000'), '"15,000"');
});

test('all shared admin field labels are linked to controls and dialog traps keyboard focus', () => {
  assert.match(admin, /htmlFor=\{controlId\}/);
  assert.match(admin, /cloneElement\(children, \{ id: controlId \}\)/);
  assert.match(admin, /event\.key !== 'Tab'/);
  assert.match(admin, /event\.shiftKey && document\.activeElement === first/);
  assert.match(admin, /document\.activeElement === last/);
  assert.match(admin, /previouslyFocused\?\.isConnected/);
});

test('promo links use noopener noreferrer and load errors have a retry path', () => {
  assert.match(promo, /parsePromoDestination\(link\)/);
  assert.match(promo, /window\.open\(destination\.href, '_blank', 'noopener,noreferrer'\)/);
  assert.match(promo, /if \(error\) throw error/);
  assert.match(promo, /onClick=\{\(\) => void loadBanners\(\)\}/);
  assert.match(admin, /parsePromoDestination\(ctaLink\)/);
});

test('all editable form inputs have bounds for long user-supplied text', () => {
  for (const token of ['maxLength={160}', 'maxLength={2000}', 'maxLength={100}', 'maxLength={2048}', 'maxLength={5000}']) {
    assert.ok(admin.includes(token), `missing form limit ${token}`);
  }
  assert.match(admin, /function normalizeSlug/);
  assert.match(admin, /function isSafeMediaUrl/);
});

test('all source import paths are present in the release archive', () => {
  const sourceRoot = path.join(root, 'src');
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(?:tsx?|mjs|mts)$/.test(entry.name)) files.push(absolute);
    }
  };
  walk(sourceRoot);
  const candidates = (base) => [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.mts`, `${base}.d.mts`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  const missing = [];
  for (const file of files) {
    const contents = readFileSync(file, 'utf8');
    for (const match of contents.matchAll(/(?:from\s*|import\s*)['"](@\/[^'"]+|\.[^'"]+)['"]/g)) {
      const specifier = match[1];
      if (/\.(?:css|svg|png|jpg|webp|json)$/.test(specifier)) continue;
      const base = specifier.startsWith('@/') ? path.join(sourceRoot, specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      if (!candidates(base).some(existsSync)) missing.push(`${path.relative(root, file)} -> ${specifier}`);
    }
  }
  assert.deepEqual(missing, [], `missing import(s):\n${missing.join('\n')}`);
});

test('archive does not ship local private env files or dependency/build folders', () => {
  assert.equal(existsSync(path.join(root, '.env.local')), false, '.env.local must not be packaged');
  assert.equal(existsSync(path.join(root, '.env')), false, '.env must not be packaged');
  const ignored = read('.gitignore');
  assert.match(ignored, /^node_modules\/?$/m);
  assert.match(ignored, /^dist\/?$/m);
  assert.equal(pkg.scripts['audit:phase56-final'], 'node --test scripts/phase56-final-audit.test.mjs');
  assert.match(pkg.scripts['audit:release'], /audit:phase56-final/);
});
