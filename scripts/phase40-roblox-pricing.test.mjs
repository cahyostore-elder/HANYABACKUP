import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20261027030000_phase40_roblox_user_pricing.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

test('Phase 40 includes all 11 user-supplied Roblox prices exactly', () => {
  const expected = [
    ["50 Robux", 9500], ["100 Robux", 18500], ["200 Robux", 37000],
    ["300 Robux", 55500], ["400 Robux", 74000], ["500 Robux", 92500],
    ["1000 Robux", 185000], ["1500 Robux", 277500], ["2000 Robux", 370000],
    ["2500 Robux", 462500], ["5000 Robux", 904000],
  ];
  for (const [name, price] of expected) {
    assert.ok(migration.includes(`('${name}', ${price}::numeric`), `missing ${name} price ${price}`);
  }
});

test('Phase 40 is scoped to Roblox and idempotently updates/inserts by package name', () => {
  assert.match(migration, /WHERE b\.slug = 'roblox'/);
  assert.match(migration, /UPDATE packages p/);
  assert.match(migration, /INSERT INTO packages/);
  assert.match(migration, /NOT EXISTS \(\s*SELECT 1 FROM packages p/s);
});

test('Phase 40 does not invent supplier product codes or claim automated fulfillment', () => {
  assert.match(migration, /v\.price, v\.sort_order, false, ''/);
  assert.match(migration, /harga katalog FITYORA TOPUP/i);
});
