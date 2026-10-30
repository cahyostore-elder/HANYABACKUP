# Phase 57 — Supplier Cost RPC Security

## Tujuan

Phase 57 memindahkan pembacaan dan penyimpanan harga modal supplier ke RPC admin dengan pemeriksaan role di database. Perubahan dirilis dua tahap agar frontend lama tetap berfungsi selama perpindahan dari akses tabel langsung ke RPC.

## Perubahan Phase 57A — RPC

- Menambahkan updated_by untuk mencatat admin terakhir yang mengubah modal.
- Dashboard admin membaca harga modal melalui admin_list_package_supplier_costs().
- Tombol **Simpan Modal Saja — Harga Jual Tetap** memakai admin_upsert_package_supplier_cost(uuid, numeric). RPC ini hanya mengubah harga modal dan audit timestamp/user; tidak menyentuh public.packages.price.
- RPC bulk pricing dan penyimpanan paket tetap memvalidasi role admin serta mencatat updated_by saat modal ikut disimpan.
- Harga modal yang belum diketahui tetap kosong. Nilai kosong tidak dianggap Rp0 dan tidak disalin dari harga jual. Angka 0 adalah nilai valid bila memang harga modal supplier Rp0; batas database adalah `supplier_cost >= 0`.
- Helper public.is_admin() tetap SECURITY INVOKER, membatasi search_path, dan membaca public.profiles secara eksplisit.

## Perubahan Phase 57B — Table lockdown

- Mencabut hak akses langsung PUBLIC, anon, dan authenticated ke tabel package_supplier_costs.
- Mempertahankan hak DML tabel untuk service_role.
- Menghapus policy lama yang memberikan akses tabel kepada admin melalui browser.
- Tidak mengubah harga jual maupun nilai modal yang tersimpan.

## Prasyarat database

Pastikan migration Phase 52 (tabel package_supplier_costs) dan Phase 56 (admin_save_package) sudah diterapkan pada project Supabase yang sama dengan website. Jangan menjalankan patch Phase 57 pada project yang belum diverifikasi.

## Penerapan aman — wajib berurutan

1. Pastikan URL/project ref Supabase benar dan cocok dengan Environment Variables Vercel. Ambil backup database.
2. Periksa riwayat migration remote dan pastikan Phase 52 serta Phase 56 sudah diterapkan. Bila migration sebelumnya ditempel manual melalui SQL Editor, cocokkan skema dan catatan migration sebelum menggunakan supabase db push; jangan memaksa status migration.
3. **Tahap A:** jalankan hanya file supabase/migrations/20261028050000_phase57_supplier_cost_rpc_security.sql. Tahap ini menambahkan RPC, tetapi belum mencabut akses tabel langsung sehingga frontend production lama tetap dapat bekerja.
4. Deploy frontend RPC baru ke production setelah Tahap A sukses. Uji login admin, baca daftar modal, simpan modal saja pada satu paket uji, dan pastikan harga jual sebelum/sesudah identik. Uji juga bahwa akun member ditolak RPC.
5. **Tahap B:** hanya setelah frontend RPC production terbukti bekerja, jalankan file supabase/migrations/20261028060000_phase57b_supplier_cost_table_lockdown.sql. Setelah ini, browser tidak lagi boleh mengakses tabel modal secara langsung.
6. Uji ulang dashboard admin, penyimpanan modal, bulk pricing, dan akses akun member. Catat hasil serta waktu penerapan.

**Penting:** jangan menerapkan Tahap B sebelum frontend production memakai RPC. Jika menggunakan supabase db push, tool dapat menerapkan semua migration yang masih pending sekaligus; jalankan Tahap A dan B secara terkontrol sesuai urutan di atas.

CI release juga menyelaraskan tool TypeScript ESLint, memperbarui lockfile dalam rentang versi yang diizinkan, lalu menjalankan `npm audit --audit-level=low`. Rilis dihentikan bila masih ada advisory dengan severity low atau lebih tinggi.

## Pemeriksaan source

```bash
npm ci
npm run audit:phase57
npm run audit:phase52
npm run audit:phase56
npm run check
node --test scripts/*.test.mjs
npm run audit:release
```

## Batasan

- CI hijau membuktikan pemeriksaan source dan build di runner, bukan status migration pada Supabase live.
- Migration ini tidak menguji provider pembayaran, transfer bank, atau pengiriman top-up otomatis. Pembayaran tetap diverifikasi admin.
- Jangan masukkan service-role/secret key ke frontend atau variabel VITE_*.
