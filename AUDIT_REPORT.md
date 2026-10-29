# FityoraStore — Audit & Catatan Rilis Ultimate No-VIP

## Perubahan pada source

- Membership VIP dihapus dari navigasi, halaman, badge, CTA beranda, dashboard pelanggan, dan dashboard admin.
- Checkout frontend menampilkan harga normal tanpa diskon VIP.
- SQL patch memperbarui RPC `create_topup_order` supaya menghitung harga paket normal, serta menyiapkan `admin_update_order_status` sebagai RPC staf dengan pengecekan role.
- SQL patch mencabut akses eksekusi fungsi VIP lama tanpa menghapus tabel atau data historis.
- Konten banner/testimoni yang menyebut VIP dinetralkan tanpa menghapus baris kontennya.
- CRUD katalog dan konten admin memeriksa error database/hasil baris yang berubah agar tidak mengumumkan sukses jika operasi gagal.
- Penghapusan kategori memeriksa order terkait; penghapusan brand/paket juga menolak penghapusan yang akan merusak order.
- Tidak ada `.env.local` atau service-role key yang disertakan pada ZIP rilis.

## Pemeriksaan yang perlu dilakukan setelah ZIP dibangun

- Parser TypeScript/TSX untuk 24 file sumber lolos tanpa error sintaks.
- Tidak ada import lokal yang hilang pada pemeriksaan statis; `package.json`, `package-lock.json`, dan `vercel.json` valid JSON.
- `npm run typecheck` belum berhasil: instalasi dependensi saat ini tidak lengkap dan beberapa deklarasi tipe (React/Node/dll.) tidak tersedia. Instal ulang dengan `npm ci` di lingkungan yang dapat mengakses registry npm sebelum mengklaim typecheck/build lulus.
- Integritas ZIP diperiksa setelah paket akhir dibangun.
- Jalankan `npm ci` lalu `npm run check` dari jaringan yang dapat mengakses registry npm. Build penuh tidak boleh diklaim berhasil hanya berdasarkan parsing sintaks.

## Pengujian live yang belum dapat diklaim

- SQL patch belum dijalankan pada project Supabase oleh pemilik dalam rilis ini. Jangan menganggap backend sudah diperbarui sampai patch dijalankan dan berhasil.
- Login/register, checkout, cek status order, perubahan status order, dan seluruh CRUD harus diuji pada project aktif/staging.
- Pembayaran tetap manual; tidak ada integrasi payment gateway atau top-up otomatis.
