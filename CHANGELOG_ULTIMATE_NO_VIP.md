# FityoraStore — Ultimate No-VIP Release

## Perubahan
- Menghapus seluruh UI membership VIP dari aplikasi pelanggan dan panel admin.
- Checkout tidak lagi menampilkan atau menghitung diskon VIP.
- Menyertakan patch Supabase untuk menonaktifkan RPC VIP, memperbarui alur checkout/status pesanan, dan membatasi pengelolaan katalog/konten ke admin/author.
- Menetralkan banner/testimoni yang menyebut VIP tanpa menghapus rekam konten.
- Memperketat pengecekan hasil operasi simpan/hapus supaya dashboard melaporkan error yang nyata.
- Menjaga riwayat order/profil lama dan hubungan foreign key yang melindungi transaksi.

## Sebelum deploy
1. Cadangkan project Supabase.
2. Jalankan `SUPABASE_VIP_REMOVAL_PATCH.sql` satu kali pada SQL Editor project aktif; jangan juga menjalankan salinan migration-nya secara terpisah.
3. Set environment variables Vercel dari `.env.example`/Supabase; ZIP tidak menyertakan `.env.local`.
4. Jalankan `npm ci` dan `npm run check` di lingkungan yang dapat mengakses registry npm.
5. Tes transaksi dan CRUD melalui akun admin/author sebelum digunakan produksi.

## Batasan yang diketahui
Pembayaran dan pemenuhan top-up masih manual. Typecheck/lint/build penuh harus diverifikasi dengan dependensi terinstal; SQL patch perlu diterapkan dan diuji pada project aktif.
