# FITYORA TOPUP — Phase 48 Premium Refresh

## Fokus
- Refresh visual global ke midnight navy + violet + cyan; tanpa dominasi gold.
- Motion halus pada elemen masuk dan shimmer hero, dengan dukungan `prefers-reduced-motion`.
- State fokus keyboard lebih jelas, hover/focus konsisten, dan kontrol disabled tidak tampak aktif.
- Polesan form, tombol, kartu, dan surface dialog; ukuran dialog mobile dibatasi agar bisa discroll.
- Source dan migrasi yang ada dari proyek sebelumnya dipertahankan.

## Deploy
1. Pastikan root proyek yang diimpor berisi `package.json`, `index.html`, dan `vite.config.ts`.
2. Jalankan `npm ci`, lalu `npm run check` pada lingkungan Node yang mendukung versi dependency proyek.
3. Build command Vercel: `npm run build`; output: `dist`.
4. Pertahankan environment variable Supabase yang sudah benar. Jangan mengunggah `.env` berisi secret.
5. Uji homepage, login, katalog, checkout, status pesanan, dan semua modal admin di staging sebelum mengubah domain produksi.

## Batas verifikasi
Ini adalah refresh CSS/global visual. Tidak ada klaim bahwa transaksi live, RLS, atau koneksi Supabase sudah diuji dari sini. Perbaikan CSS pada dialog bersifat umum dan tidak menggantikan perbaikan event handler/data pada komponen modal yang mungkin bermasalah. Build produksi perlu dijalankan setelah dependency tersedia.
