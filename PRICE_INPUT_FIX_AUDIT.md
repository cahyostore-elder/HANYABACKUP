# FITYORA TOPUP — Audit & Price Input Fix

Tanggal audit: 27 Oktober 2026

## Perbaikan yang diterapkan
- Input harga paket admin sekarang memakai `type="text"` dengan `inputMode="numeric"`, sehingga browser HP tidak mengontrol nilai numerik pada setiap ketukan.
- Nilai yang sedang diketik disimpan sebagai teks dan tidak diformat ulang pada setiap karakter.
- Karakter non-angka disaring; sebelum disimpan, harga dinormalisasi menjadi angka bulat.
- Perubahan diterapkan pada source root dan salinan proyek `fityora39/` agar pilihan Root Directory Vercel tidak menghasilkan perilaku berbeda.
- Menambahkan tes regresi input harga dan perintah `npm run audit:price-input`.
- Menyamakan metadata theme-color dengan tes proyek dan memperbarui dua pemeriksaan statis yang sebelumnya memakai pola lama meskipun implementasi checkout/fallback sudah berubah.

## Hasil pemeriksaan yang dijalankan
- Arsip ZIP sumber: lolos tes integritas sebelum perubahan.
- `node --test scripts/*.test.mjs`: 210 tes lulus, 0 gagal.
- Phase 5 static audit: 20/20 lulus.
- Phase 6 preflight: 51/51 lulus.
- Phase 9 production readiness: 17/17 lulus.
- Phase 10 release audit: 9/9 lulus.
- Phase 30 production check: 10/10 lulus.
- Phase 50 final-core checks: 9/9 lulus.
- Release preflight: 12/12 lulus.
- Local import resolution scan: 67 import diperiksa, lolos.

## Batasan verifikasi
- `node_modules` tidak tersedia dalam lingkungan audit ini. Karena itu `npm ci`, TypeScript check, ESLint, dan Vite production build belum bisa dinyatakan berhasil.
- Koneksi langsung ke Supabase/Vercel, login admin, penyimpanan harga live, dan alur pembayaran belum diuji dari lingkungan ini.
- Perbaikan input hanya mengubah cara nilai harga diketik/dinormalisasi; tidak mengubah nilai harga katalog atau migrasi database.

## Setelah deploy
1. Gunakan folder yang berisi `package.json`, `index.html`, dan `vite.config.ts` sebagai Root Directory Vercel (root proyek atau `fityora39`, jangan folder yang salah).
2. Jalankan `npm ci`, `npm run check`, dan `npm run audit:price-input`.
3. Di Preview deployment, login admin lalu ketik harga seperti `15000` dan simpan. Pastikan harga yang tampil setelah refresh adalah Rp15.000.
