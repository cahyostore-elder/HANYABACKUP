# FITYORA TOPUP — Phase 41: Hapus Pesanan & Maintenance Global

## Fitur
- Dashboard admin memiliki tombol **Hapus** per pesanan. Penghapusan permanen membutuhkan konfirmasi dan hanya lewat RPC `admin_delete_order` yang memeriksa role `admin`/`author` di database.
- Tab **Maintenance Website** menyalakan/mematikan maintenance untuk halaman publik, katalog, login, checkout, dan status pesanan.
- Pesan maintenance dapat diedit (maksimal 240 karakter).
- Dashboard `/admin` tetap dapat diakses saat maintenance agar staf bisa membuka kembali website.
- Status maintenance dibaca dari Supabase, diperbarui via realtime bila tersedia, dan dipolling setiap 15 detik sebagai fallback.
- Tambahan 3 pengujian regresi Phase 41.

## Migrasi wajib
File baru: `supabase/migrations/20261027040000_phase41_admin_order_delete_site_maintenance.sql`.

Jangan jalankan mentah ke database produksi tanpa memeriksa migration history dan backup. Terapkan melalui alur migrasi project yang sudah digunakan setelah memastikan migrasi sebelumnya sesuai. Migrasi membuat tabel `site_settings`, RPC `admin_set_site_maintenance`, dan RPC `admin_delete_order`. RPC membatasi akses ke role `admin` atau `author`; akses publik hanya membaca satu pengaturan maintenance.

## Catatan operasional
- Penghapusan order bersifat permanen pada tabel pesanan. Konfirmasi UI memperingatkan bahwa riwayat pesanan akan hilang. File bukti pembayaran di Storage tidak otomatis dihapus oleh RPC ini.
- Maintenance adalah gerbang tampilan aplikasi; bukan firewall untuk seluruh endpoint/API. RLS dan validasi server tetap menjadi kontrol keamanan data.
- Jika tabel belum ada karena migrasi belum diterapkan, UI menampilkan error saat memuat pengaturan/menjalankan RPC. Jangan mengaktifkan maintenance sebelum migration berhasil dan diuji.

## Pengujian
`node --test scripts/*.test.mjs` — 201 tes lulus, 0 gagal.
`npm run check` belum diverifikasi karena dependency install sebelumnya tidak selesai dan tidak ada `node_modules`. Jalankan pada lingkungan dengan akses registry: `npm ci && npm run check && npm run audit:release`.

## Deployment
ZIP ini belum menerapkan migrasi ke Supabase live dan belum menerbitkan deployment Vercel. Deploy Preview terlebih dahulu, terapkan migrasi melalui workflow aman, lalu uji: tombol hapus untuk staf/non-staf, toggle maintenance, akses `/admin` saat maintenance, dan halaman publik setelah maintenance dimatikan.
