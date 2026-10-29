# FITYORA TOPUP — Phase 47 Edit Modal Blank/Black Screen Fix

## Perubahan
- Memindahkan dialog admin ke `document.body` dengan React `createPortal` agar tidak tertutup stacking context/overflow dari container dashboard.
- Overlay menggunakan z-index tinggi dan warna panel solid supaya isi formulir tetap terlihat di layar mobile.
- Area dialog dapat discroll pada layar pendek; tombol tutup dan klik overlay menutup dialog.
- Berlaku pada modal bersama, sehingga dialog Edit/Tambah Paket (termasuk harga), Brand, Kategori, Promo, Testimoni, dan FAQ ikut diperbaiki.

## Batas verifikasi
Perubahan source sudah diterapkan pada dua salinan `src/pages/AdminPage.tsx` di arsip. Jalankan `npm ci` lalu `npm run check` sebelum deploy. Perubahan ini tidak memperbaiki izin RLS Supabase jika penyimpanan harga masih ditolak oleh database; migrasi izin paket tetap harus diverifikasi terpisah.
