# Phase 57 — Supplier Cost RPC Security

## Tujuan

Phase 57 memindahkan pembacaan dan penyimpanan harga modal supplier ke RPC admin yang memiliki pemeriksaan role di database. Harga modal tidak ikut ditampilkan pada katalog publik.

## Perubahan

- `package_supplier_costs` tetap dilindungi RLS; akses tabel langsung untuk `PUBLIC`, `anon`, dan `authenticated` dicabut.
- Dashboard admin membaca harga modal melalui `admin_list_package_supplier_costs()`.
- Tombol **Simpan Modal Saja — Harga Jual Tetap** memakai `admin_upsert_package_supplier_cost(uuid, numeric)`. RPC ini hanya mengubah harga modal dan audit timestamp/user; tidak menyentuh `public.packages.price`.
- `updated_by` menyimpan ID admin yang terakhir mengubah modal.
- RPC bulk pricing dan penyimpanan paket Phase 56 tetap memvalidasi role admin serta mencatat `updated_by` saat modal ikut disimpan.
- Harga modal yang belum diketahui tetap kosong. Nilai kosong tidak dianggap Rp0 dan tidak disalin dari harga jual. Angka 0 hanya boleh dimasukkan bila memang harga modal supplier adalah Rp0.
- Perubahan harga jual massal tetap memerlukan pratinjau dan konfirmasi eksplisit.

## Prasyarat database

Pastikan migration Phase 52 (tabel `package_supplier_costs`) dan Phase 56 (`admin_save_package`) sudah diterapkan pada project Supabase yang sama dengan website. Jangan menjalankan patch Phase 57 pada project yang belum diverifikasi.

## Penerapan aman

1. Pastikan URL/project ref Supabase benar dan cocok dengan Environment Variables Vercel.
2. Ambil backup database sebelum perubahan.
3. Periksa riwayat migration remote dan pastikan Phase 52 serta Phase 56 sudah diterapkan. Bila migration sebelumnya ditempel manual melalui SQL Editor, cocokkan skema dan catatan migration sebelum menggunakan `supabase db push`; jangan memaksa status migration.
4. Jalankan file `supabase/migrations/20261028050000_phase57_supplier_cost_rpc_security.sql` satu kali di project yang benar (SQL Editor atau mekanisme migration terkontrol).
5. Pastikan SQL selesai tanpa error. Jalankan audit read-only keamanan RLS/RPC, lalu uji login admin dan akun member biasa.
6. Deploy frontend setelah migration sukses. Uji tombol **Simpan Modal Saja — Harga Jual Tetap** pada satu paket uji.
7. Catat harga jual sebelum dan sesudah uji. Pastikan nilainya identik; modal muncul kembali setelah dashboard dimuat ulang. Uji bahwa member biasa ditolak oleh RPC.

## Pemeriksaan source

Dari root repository:

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
- Jangan masukkan service-role/secret key ke frontend atau variabel `VITE_*`.
