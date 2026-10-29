# FityoraStore Ultimate No-VIP — Phase 3 Animations

## Perubahan
- Animasi masuk halus untuk area utama.
- Kilau singkat saat tombol utama di-hover.
- Transisi glass card dan fokus keyboard yang lebih jelas.
- Utility class opsional: `motion-float`, `motion-border`, `motion-dot`, `motion-shine`.
- Dukungan `prefers-reduced-motion` untuk mengurangi animasi bagi pengguna yang memintanya.
- Tidak menambah dependensi runtime dan tidak mengubah skema/database Supabase.

## Batas verifikasi
- ZIP sumber berhasil dibuat dan struktur arsip dapat dibaca.
- Build, typecheck, browser visual regression, dan website live belum diverifikasi pada fase ini.
- Animasi memakai CSS yang sudah didukung browser modern; periksa pada perangkat target melalui Preview Vercel sebelum rilis.
