# Fase 56 — Admin Edit Repair, Security & UX Polish

Tanggal audit: 28 Oktober 2026

## Ringkasan

Fase ini mempertahankan fitur yang sudah ada, lalu mengeraskan alur edit admin dan memperbaiki pengalaman penggunaan. Perubahan source utama berada di `src/pages/AdminPage.tsx`, `src/components/PromoSlider.tsx`, `src/lib/bulkPricing.mjs`, helper tujuan promo, dan pengujian regresi Fase 56.

## Perbaikan yang sudah diterapkan di source

1. **Edit paket dan harga atomik.** Nama paket, brand, deskripsi, harga jual, urutan, status unggulan, dan biaya supplier dikirim lewat satu RPC `admin_save_package`. Kegagalan validasi/SQL menggagalkan transaksi secara keseluruhan; source tidak lagi menganggap operasi parsial sebagai sukses.
2. **Input dan modal.** Siklus focus modal tidak berjalan ulang pada setiap ketikan. Modal menahan fokus keyboard, mendukung Escape, mengembalikan fokus dengan aman, menghubungkan label ke field, serta membatasi input teks.
3. **Ketahanan penyimpanan.** Tombol simpan/batal terkunci ketika permintaan aktif; status loading dilepas melalui `finally`; error ditampilkan; response yang tidak pasti tidak otomatis dikirim ulang; data katalog dimuat ulang sebagai langkah verifikasi.
4. **Form admin lain.** Validasi dan penanganan kegagalan jaringan ditingkatkan untuk brand, kategori, promo, testimoni, FAQ, dan pengaturan maintenance. URL gambar hanya menerima rute lokal atau HTTPS tanpa kredensial.
5. **Promo lebih aman.** Tombol promo hanya menerima rute aplikasi `#/...` atau HTTPS yang valid. Skema `javascript:`, `data:`, HTTP biasa, URL dengan kredensial, protocol-relative URL, dan input mencurigakan ditolak. Link eksternal memakai `noopener,noreferrer`.
6. **Impor CSV lebih ketat.** Import menolak tanda kutip tidak valid, kolom ganda, serta teks setelah quote yang tidak sah. Harga tetap divalidasi sebagai integer Rupiah dalam batas aplikasi.
7. **Ekspor CSV.** Isi berbentuk formula spreadsheet diberi awalan aman untuk mengurangi risiko formula injection saat file dibuka di spreadsheet.
8. **UX dan aksesibilitas.** Kontrol admin mempunyai label yang terkait, navigasi carousel promo terlihat pada layar kecil, tombol memiliki nama aksesibel, dan error pemuatan promo menyediakan opsi coba lagi.
9. **Keamanan rilis.** Tidak ada `.env.local`, `.env`, `node_modules`, atau `dist` lokal di dalam arsip. Template environment hanya berisi placeholder dan client tetap memakai publishable key publik—bukan service-role/secret key.

## Migrasi Supabase yang wajib sebelum deploy

Jalankan migrasi berikut di Supabase Dashboard → SQL Editor pada proyek yang benar:

`supabase/migrations/20261028040000_phase56_atomic_admin_package_save.sql`

Migrasi membuat `public.admin_save_package(...)` sebagai `SECURITY DEFINER`, membatasi `search_path`, memvalidasi autentikasi dan `public.is_admin()`, memvalidasi brand/nama/harga/modal/urutan, membatasi `EXECUTE` untuk role `authenticated`, dan meminta PostgREST memuat ulang schema.

**Prasyarat:** pastikan migrasi Phase 52 (tabel `package_supplier_costs`) dan helper `public.is_admin()` sudah ada. Jangan jalankan semua file SQL lama secara membabi buta. Jalankan migrasi ini hanya di proyek database yang benar dan periksa hasil SQL Editor.

## Hasil audit lokal

- `node --test scripts/*.test.mjs`: **250 tes lulus, 0 gagal**.
- `npm run audit:release`: **lulus**; release source audit 9/9, release preflight 12/12, Phase 29 gate 7/7, Phase 30 production check 10/10, rangkaian audit fase terdaftar, dan audit akhir Fase 56 9/9.
- TypeScript/TSX syntax transpile: **24 file, 0 kesalahan sintaks**. Ini pemeriksaan sintaks, bukan typecheck semantik penuh.
- Pemeriksaan import source: seluruh import relatif dan alias yang tercakup audit ditemukan.
- Arsip diverifikasi dari daftar file; file environment privat dan folder build/dependency lokal tidak dimasukkan.

### Batas verifikasi

`npm ci` tidak berhasil diselesaikan di lingkungan pembuat arsip karena registry npm tidak dapat dijangkau/resolusi DNS gagal. Akibatnya, `npm run check` lengkap, ESLint, typecheck semantik TypeScript, dan build Vite **belum terverifikasi di lingkungan ini**. Audit lokal tidak membuktikan transaksi Supabase live, tampilan browser HP, atau deployment Vercel telah diuji.

## Urutan rilis aman

1. Ekstrak ZIP sebagai salinan kerja; pertahankan `.env.local` pribadi yang sudah ada dan jangan masukkan ke Git.
2. Di Codespaces jalankan `npm ci`, `npm run check`, lalu `npm run audit:release`. Jangan lanjutkan bila ada perintah gagal.
3. Backup database dan jalankan migrasi Phase 56 di Supabase; konfirmasi fungsi tersedia dan eksekusi hanya untuk user admin terautentikasi.
4. Push ke branch pengujian dan buat Preview Vercel terlebih dahulu.
5. Uji edit harga `15000`, simpan, muat ulang katalog dan pastikan nilainya tetap Rp15.000. Uji pula brand, kategori, promo, testimoni, FAQ, impor/ekspor CSV, checkout, dan alur admin.
6. Baru promosikan ke Production setelah tes Preview dan alur transaksi nyata berhasil.

Jangan memasukkan `service_role` atau `sb_secret_*` ke variabel `VITE_*`; jangan mencoba menyimpan ulang paket ketika hasil request sebelumnya belum diperiksa.
