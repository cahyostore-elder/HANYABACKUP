# FityoraStore ⚡

Top up game jadi lebih gampang, tampilannya tetap nyaman, dan harga jelas.

FityoraStore dibuat dengan React, TypeScript, Vite, dan Supabase. Source utama website ada langsung di folder project ini.

## Yang tersedia

- Katalog game dan paket top up
- Login, daftar akun, profil, dan riwayat pesanan
- Checkout dan pengecekan status order
- Dashboard admin untuk mengelola katalog dan konten website
- Pengelolaan harga jual dan modal supplier secara terpisah
- Pemeriksaan akses database dan konfigurasi agar lebih aman

## Mulai di Codespaces

Pastikan terminal berada di root project `FITYORATOPUP`.

Salin `.env.example` menjadi `.env.local`, lalu isi konfigurasi Supabase:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Jangan masukkan service-role key atau secret key ke variabel `VITE_*`, karena nilainya bisa ikut masuk ke aplikasi browser. File `.env.local` jangan di-upload ke GitHub.

Install dan cek project:

```bash
npm ci
node --test scripts/*.test.mjs
npm run check
```

Kalau pemeriksaan gagal, bereskan error-nya dulu sebelum deploy.

## Soal harga

Harga modal supplier berbeda dari harga jual. Mengubah modal tidak boleh diam-diam mengubah harga jual. Perubahan harga jual harus dilakukan secara sengaja melalui alur admin yang sesuai.

Aturan penting tetap harus diperiksa di database Supabase, bukan hanya di tampilan website. File migrasi SQL di repository belum berarti migrasi itu sudah dijalankan di database live.

Keamanan database menggunakan **Row Level Security (RLS)** dan RPC dengan pemeriksaan peran di sisi server. Jangan mengandalkan pembatasan tombol atau halaman admin di frontend sebagai kontrol keamanan. `vite.config.ts` juga memeriksa konfigurasi Supabase dan menghentikan build jika key berhak tinggi (service-role/secret) ditemukan pada konfigurasi `VITE_*`.

## Deploy ke Vercel

Gunakan root repository ini sebagai Root Directory.

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm ci`

Tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` di Environment Variables Vercel. Coba Preview terlebih dahulu, lalu cek login, checkout, status pesanan, dashboard admin, penyimpanan harga, dan tampilan HP sebelum memakai Production.

## Catatan penting

- Pembayaran masih perlu diverifikasi manual.
- Jangan menandai pesanan berhasil sebelum pembayaran benar-benar dicek.
- Upload `FIX.zip` ke GitHub tidak otomatis menerapkan isi ZIP ke source project.
- Jangan menjalankan semua file SQL lama secara asal. Periksa migrasi yang dibutuhkan dan pastikan project Supabase yang dipilih benar.

---

**FityoraStore — top up gampang, harga jelas.**
