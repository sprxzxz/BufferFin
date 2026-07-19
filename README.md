# BufferFin 🛡️💸

**BufferFin** (sebelumnya FinTrack) adalah aplikasi manajemen keuangan pribadi berbasis web modern yang dirancang untuk membantu pengguna mencatat, melacak, dan menganalisis pemasukan serta pengeluaran mereka secara real-time. Aplikasi ini dilengkapi dengan **Analisis Prediktif AI** yang cerdas di sisi server menggunakan model **Google Gemini AI** untuk memberikan saran penghematan berbasis data nyata yang sangat praktis bagi masyarakat Indonesia.

---

## ✨ Fitur Utama

- **🛡️ Manajemen Keuangan Aman**: Autentikasi pengguna berbasis email dan password dengan token JWT lokal untuk melindungi data keuangan Anda.
- **📊 Dasbor Statistik Dinamis**:
  - Tampilan **Saldo Sekarang**, **Total Pemasukan**, **Total Pengeluaran**, dan **Rerata Pengeluaran** harian yang diperbarui secara langsung.
  - Diagram lingkaran (donut chart) SVG interaktif dan indikator breakdown berdasarkan kategori pengeluaran (Makanan, Transportasi, Hiburan, dll.).
- **🧠 Analisis Prediktif AI BufferFin**:
  - Terintegrasi dengan model **Gemini 3.5 Flash** server-side untuk menganalisis arus kas.
  - Memberikan perkiraan pengeluaran hingga hari gajian berikutnya (siklus tanggal 25).
  - Memberikan indikator kesehatan keuangan (*Sehat*, *Siaga*, atau *Kritis*) dan saran penghematan praktis berbasis teks terformat Markdown yang dihasilkan langsung oleh AI.
- **✏️ Riwayat Transaksi Interaktif**:
  - Cari transaksi berdasarkan judul/deskripsi secara real-time.
  - Saring transaksi berdasarkan tipe (Pemasukan/Pengeluaran) dan Kategori.
  - Tambah, Ubah (Edit), dan Hapus transaksi dengan antarmuka modal yang mulus.
- **🎨 Desain UI Premium**: Desain modern bertema gelap minimalis (*Zinc & Indigo theme*) dengan animasi transisi yang lembut menggunakan pustaka `motion` (Framer Motion).

---

## 🛠️ Teknologi yang Digunakan

### Frontend (Client):
- **React 19** (TypeScript)
- **Vite** (Build tool super cepat)
- **Tailwind CSS v4** (Desain responsif & modern)
- **motion** (Animasi interaktif)
- **Lucide React** (Koleksi ikon yang konsisten & bersih)

### Backend (Server):
- **Express.js** (Framework web Node.js)
- **@google/genai** (Google Gen AI SDK Resmi)
- **tsx & esbuild** (Eksekusi dan kompilasi TypeScript super cepat)
- Database berbasis berkas lokal (`db.json`) untuk penyimpanan portabel yang instan.

---

## 🚀 Cara Menjalankan Aplikasi di Lokal

Ikuti langkah-langkah di bawah ini untuk menjalankan BufferFin di komputer Anda sendiri:

### 1. Prasyarat
Pastikan Anda sudah menginstal:
- [Node.js](https://nodejs.org/) (versi 18 ke atas direkomendasikan)
- npm (biasanya terinstal bersama Node.js) atau Bun/Yarn.

### 2. Kloning / Unduh Repositori
Unduh kode sumber aplikasi ini ke komputer Anda, lalu masuk ke direktori proyek:
```bash
cd bufferfin
```

### 3. Instalasi Dependensi
Instal semua paket dependensi yang dibutuhkan oleh frontend dan backend:
```bash
npm install
```

### 4. Konfigurasi Environment Variables (`.env`)
Aplikasi ini membutuhkan API Key dari Google Gemini untuk mengaktifkan fitur analisis cerdas AI.

1. Salin file `.env.example` menjadi `.env` baru:
   ```bash
   cp .env.example .env
   ```
2. Buka file `.env` dan masukkan kunci API Gemini Anda:
   ```env
   GEMINI_API_KEY=KUNCI_API_GEMINI_ANDA_DI_SINI
   PORT=3000
   ```
   *(Catatan: Anda dapat mendapatkan API Key gratis dari [Google AI Studio](https://aistudio.google.com/))*

### 5. Menjalankan Server dalam Mode Pengembangan (Development)
Jalankan dev server Express dan Vite sekaligus:
```bash
npm run dev
```
Setelah berhasil berjalan, buka browser Anda dan akses:
👉 **`http://localhost:2810`**

---

## 📦 Build untuk Produksi (Production)

Untuk melakukan kompilasi aplikasi untuk lingkungan produksi (deployment):

1. **Jalankan perintah build**:
   ```bash
   npm run build
   ```
   Perintah ini akan melakukan:
   - Build aset statis React di bawah direktori `dist/` menggunakan Vite.
   - Mengompilasi server backend TypeScript menjadi satu file mandiri `dist/server.cjs` menggunakan `esbuild`.

2. **Jalankan aplikasi hasil kompilasi**:
   ```bash
   npm start
   ```

---

## 📂 Struktur Proyek

```text
├── src/                  # Kode sumber frontend (React + TS)
│   ├── components/       # Komponen UI modular
│   ├── App.tsx           # Halaman utama aplikasi & manajemen state
│   ├── index.css         # Impor Tailwind CSS & konfigurasi tema kustom
│   └── main.tsx          # Titik masuk utama frontend
├── index.html            # Berkas HTML utama Vite
├── server.ts             # Kode server backend Express & logika integrasi Gemini AI
├── server-db.ts          # Sistem database lokal portabel berbasis json
├── metadata.json         # Metadata konfigurasi AI Studio
├── package.json          # Manajemen dependensi dan script npm
└── README.md             # Dokumentasi proyek (berkas ini)
```

---

## 🔒 Lisensi
Aplikasi ini dikembangkan untuk keperluan demonstrasi kecerdasan buatan dan manajemen keuangan pribadi secara mandiri. Bebas digunakan dan dimodifikasi untuk kebutuhan belajar Anda.
