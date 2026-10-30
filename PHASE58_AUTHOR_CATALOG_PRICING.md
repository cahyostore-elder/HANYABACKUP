# Phase 58 — Author Catalog Pricing Workflow

## Tujuan
Katalog tidak perlu diisi harga modal di SQL atau saat migrasi. Nilai modal boleh belum ada; baris yang belum dicatat tetap tidak ditampilkan sebagai Rp0. Rp0 adalah nilai nyata yang sah jika memang harga modal supplier nol.

## Alur Author
- **Simpan Modal Saja** memperbarui harga modal dan identitas audit, tetapi harga jual tetap.
- **Simpan Modal + Perbarui Harga Jual (7%)** menghitung harga jual di database dengan aturan yang sudah ada, `round(supplier_cost * 1.07, 0)`, meminta konfirmasi, lalu memperbarui modal + harga jual + audit dalam satu transaksi.
- **Template Modal Supplier CSV** mengekspor ID paket, brand, nama, dan kolom modal. Author dapat mengisi banyak baris kemudian mengunggahnya lewat Impor CSV.
- Jika kolom harga jual di CSV kosong tetapi modal terisi, pratinjau menghitung harga jual dengan markup 7%. Harga jual manual yang diisi tetap digunakan.
- Tidak ada perubahan sebelum pratinjau dan konfirmasi. Kegagalan per baris masuk laporan.

## Penerapan
1. Backup database dan pastikan project Supabase cocok dengan Environment Variables Vercel.
2. Terapkan Phase 57A, deploy frontend RPC Phase 57, uji akses Author dan penolakan member.
3. Terapkan Phase 57B hanya setelah dashboard production memakai RPC.
4. Terapkan Phase 58 setelah Phase 57B.
5. Deploy frontend Phase 58.
6. Uji satu paket untuk kedua aksi, lalu periksa baris audit.
7. Uji CSV pada beberapa paket terlebih dahulu sebelum mengubah seluruh katalog.

## Catatan
- Migration ini tidak mengisi seluruh katalog dan tidak mengubah harga lama secara otomatis.
- Perubahan harga jual hanya terjadi lewat aksi Author yang disetujui.
- Migration history remote belum ada saat audit; jangan menjalankan `supabase db push` sebelum baseline direkonsiliasi.