# FityoraStore Phase 17 — Katalog Produk & Pemilihan Nominal

## Pembaruan

- Pencarian nominal mencocokkan nama dan deskripsi paket dengan pencocokan huruf yang tidak peka kapitalisasi menggunakan locale Indonesia.
- Menampilkan jumlah hasil pencarian terhadap jumlah keseluruhan paket; status hasil diumumkan dengan `aria-live`.
- Sortir nominal: urutan katalog, harga termurah, dan harga termahal.
- Hasil pencarian kosong menyediakan tombol untuk menampilkan kembali seluruh nominal.
- Kartu paket memiliki label aksesibel yang memuat nama dan harga, status pilihan `aria-pressed`, harga IDR dari data katalog, serta indikator visual untuk dipilih.
- Filter dan sortir direset saat brand/kategori berubah agar pilihan lama tidak mengganggu produk berikutnya.
- Layout dan ukuran kartu dioptimalkan untuk layar mobile; fokus keyboard terlihat; animasi menghormati preferensi reduced-motion.
- Audit Phase 17 dapat dijalankan melalui `npm run audit:phase17`. Tidak ada dependensi runtime baru dan tidak ada migrasi database pada tahap ini.

## Hasil pemeriksaan

- Tes terfokus Phase 17: 14/14 lulus.
- Seluruh tes di `scripts/*.test.mjs`: 75/75 lulus.
- Audit statis Phase 5: 20/20 lulus.
- Source preflight Phase 6: 51/51 lulus.
- Kesiapan produksi Phase 9: 17/17 lulus.
- Audit rilis Phase 10: 9/9 lulus.
- Transpile sintaks TS/TSX: 24 file, 0 diagnostik sintaks.
- Integritas ZIP diperiksa setelah pengemasan.

## Batasan

`npm run check` dijalankan tetapi gagal pada tahap typecheck karena paket React, `react/jsx-runtime`, dan `lucide-react` tidak tersedia di lingkungan. Karena skrip check berantai, lint dan build Vite belum dijalankan. Pengujian browser visual, integrasi Supabase live, transaksi pembayaran dan deployment Vercel juga belum dilakukan. Tes kontrak source bukan pengganti end-to-end test.
