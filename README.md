# FityoraStore — Ultimate No-VIP (Phase 56)

Website top-up berbasis React, TypeScript, Vite, dan Supabase. Source aktif berada di root proyek (`src/`, `supabase/`, `scripts/`). File pada paket ini mempertahankan katalog, checkout, autentikasi, riwayat transaksi, dan dashboard admin yang sudah ada.

## Phase 55 — Buyer Experience

- Dashboard member premium: avatar inisial, konteks akun, email dari sesi login, shortcut top-up dan riwayat.
- Statistik dashboard hanya memakai data pesanan akun yang sedang login; statistik menampilkan placeholder saat data masih dimuat.
- Riwayat transaksi mempertahankan pencarian, filter status, pagination, penyalinan kode dan detail pesanan.
- Edit profil dibatasi ke `display_name` dan `bio`, dengan batas 40/160 karakter, konfirmasi baris yang benar-benar diperbarui, serta pesan error yang tidak membocorkan detail internal database.
- Halaman utama menampilkan shortcut dashboard hanya ketika pengguna sudah login.
- Animasi CSS halus, fokus keyboard terlihat, dan dukungan `prefers-reduced-motion`.
- Phase 55 tidak menambahkan tabel atau migrasi Supabase baru.


## Phase 56 — Admin Edit Repair & Resilience

- Fixed the shared edit-modal focus lifecycle: controlled inputs no longer lose focus whenever their value changes, and the first actual form field is focused instead of the close button.
- Package metadata, selling price, and supplier cost now save in one `admin_save_package` database RPC. The operation is atomic: any validation or database error rolls back the whole save rather than leaving a package with updated metadata but an old/zero price.
- Added server-side validation for staff role, brand existence, package name, integer Rupiah prices, supplier cost, and sort order. The RPC is not executable by `anon`/`PUBLIC`.
- Brand, category, promo, testimonial, FAQ and maintenance saves handle rejected network calls, show an error, and always release loading state. Cancel/close actions are blocked during an active save to prevent ambiguous requests.
- Failed dashboard refreshes keep the last loaded list visible rather than replacing it with empty arrays.
- Added Phase 56 regression tests to the full release audit. See `PHASE56_ADMIN_EDIT_REPAIR.md`.

**Important:** Before deploying the Phase 56 frontend, run `supabase/migrations/20261028040000_phase56_atomic_admin_package_save.sql` once in the SQL Editor of the correct Supabase project. This creates the atomic RPC and asks PostgREST to reload its schema. The migration does not rewrite existing packages or prices.

## Menjalankan secara lokal

Diperlukan Node.js 20.19+ atau 22.12+.

1. Salin `.env.example` menjadi `.env.local`.
2. Isi `VITE_SUPABASE_URL` serta `VITE_SUPABASE_PUBLISHABLE_KEY` dengan URL dan publishable/anon key dari proyek Supabase yang benar. Nama lama `VITE_SUPABASE_ANON_KEY` tetap didukung.
3. Jangan masukkan service-role/secret key ke variabel `VITE_*`; nilainya akan terekspos ke browser.
4. Instal dependensi dengan `npm ci`.
5. Jalankan `node --test scripts/*.test.mjs` untuk seluruh tes regresi.
6. Jalankan `npm run check` untuk typecheck, lint, dan build.

File `.env.local` sengaja tidak disertakan di ZIP. Buat file tersebut sendiri dan jangan commit ke Git.

## Pemeriksaan

Tes regresi statis memeriksa struktur, validasi, dan perilaku yang dapat diuji tanpa kredensial live. Tes tersebut bukan pengganti uji transaksi live. Sebelum produksi, jalankan seluruh tes:

```bash
node --test scripts/*.test.mjs
npm run check
```

Pastikan konfigurasi Supabase dan migrasi dari fase sebelumnya sudah sesuai dengan project yang aktif. Kebijakan RLS dan hak kolom tetap menjadi batas akses utama; jangan mencoba menggantinya dengan pemeriksaan UI. Konfigurasi build yang memeriksa kunci publik/rahasia berada di `vite.config.ts`. Jangan menjalankan ulang migration seed lama secara membabi buta. Backup database sebelum menjalankan migration yang mengubah data atau hak akses.

## Deploy ke Vercel

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment Variables: atur `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` pada proyek Vercel yang benar (`fityora39`).

Setelah deployment preview berhasil, uji login, edit profil, riwayat pesanan, alur checkout, status pembayaran, role admin, dan tampilan mobile. Patch ini belum otomatis mengubah website live.

## Batasan fitur

- Pembayaran masih memerlukan verifikasi manual staf; jangan menandai pesanan berhasil sebelum pembayaran benar-benar terverifikasi.
- Otomatisasi pengiriman top-up/gateway pembayaran tidak dijanjikan oleh UI.
- Data email hanya ditampilkan dari sesi autentikasi; mengubah email akun harus menggunakan alur autentikasi Supabase yang terpisah.
