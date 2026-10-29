# FITYORA TOPUP — Phase 50 Final Core

## Tujuan
Paket ini melanjutkan source Phase 49 dengan fokus stabilitas tampilan, aksesibilitas dialog admin, dan penanganan kesalahan render. Tidak ada teks pemasaran "VIP" atau "Premium" yang ditampilkan pada antarmuka website.

## Perubahan inti
- Menambahkan React Error Boundary di entry point. Kesalahan render yang tidak tertangani akan menampilkan layar pemulihan dengan tombol muat ulang, bukan sekadar layar kosong tanpa petunjuk.
- Memperkuat dialog admin: portal ke `document.body`, pembatasan scroll saat dialog terbuka, tombol Escape, penutupan melalui backdrop, fokus awal pada kontrol formulir, dan pengembalian fokus setelah ditutup.
- Menambahkan deskripsi aksesibilitas untuk dialog.
- Mempertahankan source, assets, migrasi Supabase, skrip audit, serta dokumentasi proyek Phase 49.
- Menghapus kata pemasaran yang diminta dari komentar UI storefront; source interface tidak memakai label tersebut.

## Batas verifikasi
- Pemeriksaan statis dan integritas ZIP perlu dijalankan pada paket final.
- Build produksi, koneksi Supabase, login, transaksi, dan penyimpanan harga live tidak dapat dinyatakan berhasil tanpa menjalankan build dan pengujian terhadap project Supabase/Vercel milik pengguna.
- Error Boundary hanya menangani error saat render React, bukan seluruh error asynchronous, jaringan, izin RLS, atau kegagalan API.

## Sebelum deploy
1. Jalankan `npm ci`.
2. Jalankan `npm run check`.
3. Pastikan environment variables Supabase di Vercel benar.
4. Deploy ke Preview terlebih dahulu.
5. Uji login admin, buka Edit Paket, ubah harga, simpan, muat ulang data, dan pastikan harga tetap benar.
6. Uji katalog, checkout, status pesanan, dan WhatsApp sebelum memindahkan domain produksi.

Jangan menjalankan seluruh SQL migrasi lama secara massal. Cocokkan riwayat migrasi yang telah diterapkan dengan database live.
