# FITYORA TOPUP — Phase 42: Tanggal Pesanan & Penegasan Maintenance Global

## Perubahan
- Riwayat pesanan pada dashboard admin kini menampilkan tanggal lengkap dalam bahasa Indonesia: hari, tanggal, bulan, tahun, jam, dan menit.
- Ringkasan pesanan terbaru di dashboard admin menampilkan hari/tanggal/bulan/tahun dan waktu.
- Halaman cek status pesanan pelanggan juga menampilkan tanggal lengkap.
- Penjelasan di dashboard maintenance diperjelas: ketika maintenance aktif, semua halaman pengunjung ditutup dan menampilkan halaman “Sedang Maintenance” — beranda, katalog, login/daftar, dashboard pelanggan, checkout, dan cek status pesanan. Hanya `/admin` yang dikecualikan supaya admin dapat mengelola dan mematikan maintenance.

## Maintenance global — batasan penting
Gerbang maintenance berada di aplikasi frontend. Ini memastikan seluruh rute pengunjung dialihkan ke layar maintenance, tetapi tidak menggantikan RLS dan pemeriksaan izin pada Supabase API. Jangan menyimpan service-role/secret key pada frontend. Status maintenance hanya berlaku lintas perangkat setelah migration Phase 41 diterapkan ke database yang benar dan pengaturan dapat dibaca oleh aplikasi.

## Verifikasi
- `node --test scripts/*.test.mjs`: 204 tes lulus, 0 gagal.
- Build produksi TypeScript/ESLint/Vite belum diklaim lulus karena instalasi dependency sebelumnya belum selesai. Jalankan `npm ci && npm run check && npm run audit:release` di lingkungan dengan akses registry.
- ZIP belum diterapkan ke Supabase live dan belum dideploy ke Vercel.
