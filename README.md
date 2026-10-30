<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9918bc32-5def-4153-b1fb-d59b607750c3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Menu komunitas KOMITS

Menu publik Beranda, Tentang, Donasi, Laporan, Marketplace, Lowongan Freelance,
dan Penerima menggabungkan informasi dari https://komits2025.org/. Fitur toko,
login Google, preorder, riwayat, dan administrasi tetap tersedia lewat
**Toko & Preorder** (`#shop`). Menu publik dapat dibuka tanpa login dan mendukung
URL hash serta tombol kembali/maju browser.

Server Express menyediakan GET `/api/community/:section` untuk enam endpoint
publik yang diizinkan dari sumber tetap komits2025.org. Permintaan dibatasi
8 detik. Jika sumber tidak tersedia, halaman menampilkan salinan data di
`src/community-data.json` beserta pemberitahuan tanggal pengambilannya.
Informasi rekening donasi merupakan salinan tanggal 30 Oktober 2026; tautan
ke halaman sumber disediakan untuk memeriksa perubahan. Laporan PDF dan media
usaha tetap ditautkan ke sumber. Data komunitas dikelola di website sumber;
menu baru tidak menambahkan akses edit ke data tersebut.

Validasi lokal: `npm ci`, `npm run lint`, dan `npm run build`. Jalankan
`npm run dev` untuk server Express beserta Vite pada port 3000.
