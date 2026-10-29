# FITYORA TOPUP — Phase 49 Premium Polish

## Perubahan dari Phase 48
- Memoles dialog admin: backdrop terisolasi, panel dengan kontras jelas, animasi masuk ringan, dan ukuran mobile yang lebih aman.
- Tombol Escape menutup dialog; scroll body dikunci saat dialog terbuka dan dipulihkan saat ditutup.
- Transisi hover kartu dibuat halus dan dibatasi ke perangkat pointer yang mendukung hover.
- Menghormati `prefers-reduced-motion`.
- Mempertahankan source, migrations, scripts, dokumentasi dan aset yang sudah ada pada Phase 48.

## Verifikasi
- Source TypeScript/CSS diubah secara terarah.
- ZIP harus diverifikasi integritasnya setelah dibuat.
- Build produksi belum terverifikasi di lingkungan ini: `npm run build` gagal dijalankan karena executable Vite tidak tersedia (`vite: not found`). Jalankan `npm ci` lalu `npm run check` pada lingkungan dengan akses paket sebelum deploy.
- Perubahan modal tidak membuktikan bug blank selesai pada deployment live. Jika blank tetap terjadi, periksa error Console/runtime dan event handler React, bukan hanya CSS.

## Deploy
Gunakan folder root yang berisi `package.json`, `index.html`, dan `vite.config.ts`. Pertahankan environment variable Supabase yang benar; jangan masukkan secret ke ZIP. Jalankan `npm ci`, `npm run check`, kemudian `npm run build`. Uji edit produk/harga di staging sebelum memindahkan domain produksi.
