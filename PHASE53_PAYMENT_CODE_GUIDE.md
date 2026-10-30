# Phase 53 — Biaya Admin dan Kode Unik Pembayaran

## Aturan
- QRIS: biaya admin Rp300.
- DANA, GoPay, OVO, ShopeePay: biaya admin Rp500.
- SeaBank: biaya admin Rp1.000.
- Migration Phase 53 awalnya membuat kode unik dalam rentang inklusif Rp101–Rp999. Setelah Phase 54 diterapkan, aturan aktif menjadi Rp200–Rp999.
- Total transfer = harga paket dari database + biaya admin metode + kode unik.
- Biaya dan kode unik di frontend hanya estimasi/tampilan; database menjadi sumber kebenaran.
- Kode unik bukan laba otomatis. Rekonsiliasi penerimaan dan biaya penyedia pembayaran tetap diperlukan.

## Pasang
1. Backup database Supabase.
2. Buka SQL Editor di project yang digunakan website.
3. Jalankan migration Phase 53 terlebih dahulu, lalu migration Phase 54 satu kali untuk menerapkan rentang Rp200–Rp999. Jangan mengulang migration Phase 53 setelah Phase 54.
4. Jalankan `npm ci`, `npm run audit:phase53`, lalu `npm run check`.
5. Buat pesanan uji untuk QRIS, salah satu e-wallet, dan SeaBank. Pastikan admin masing-masing Rp300/Rp500/Rp1.000, kode unik antara Rp200 dan Rp999 setelah Phase 54 diterapkan, dan total di halaman status sama dengan nominal yang dibuat server.
6. Uji dua pesanan pending dengan harga dasar dan biaya sama; total transfer seharusnya tidak sama. Ulangi request dengan kunci idempotensi yang sama dan pastikan tidak membuat order duplikat.
7. Deploy frontend setelah migrasi berhasil. Jangan gunakan nilai dari browser untuk menandai pembayaran lunas; admin harus tetap memverifikasi pembayaran.

## Rollback
Jangan rollback dengan mengubah total order yang sudah dibuat. Untuk kembali ke aturan lama, pulihkan definisi fungsi `create_topup_order` dari migration sebelumnya setelah menilai pesanan pending. Riwayat transaksi tidak diubah oleh migration ini.
