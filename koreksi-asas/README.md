# 🎓 ASAS Grader — Sistem Koreksi Otomatis Asesmen Sumatif Akhir Semester

Aplikasi web interaktif modern, ringan, dan siap pakai yang dirancang khusus untuk membantu guru/pendidik dalam mengoreksi lembar jawaban siswa secara otomatis, akurat, dan instan pada kegiatan **Asesmen Sumatif Akhir Semester (ASAS)**.

---

## 📋 Struktur Soal Berdasarkan Jenis Mata Pelajaran

Aplikasi telah mengadopsi format asesmen modern (Kurikulum Merdeka / ANBK) dengan klasifikasi mata pelajaran sebagai berikut:

### 1. 🧪 Mapel Eksak (MIPA / Komputasi) — Total 30 Soal
- **Bagian I (No. 1 – 10)**: **Pilihan Ganda (PG) Sederhana** (Opsi tunggal: `A`, `B`, `C`, `D`, `E`).
- **Bagian II (No. 11 – 20)**: **Pilihan Ganda Kompleks (MCMA)** (Pilihan ganda lebih dari satu jawaban: Checkbox `A`, `B`, `C`, `D`, `E`).
- **Bagian III (No. 21 – 30)**: **Benar / Salah (B/S)** (Pilihan `Benar (B)` atau `Salah (S)`).

### 2. 📚 Mapel Non-Eksak (Sosial, Bahasa, Humaniora) — Total 40 Soal
- **Bagian I (No. 1 – 20)**: **Pilihan Ganda (PG) Sederhana** (Opsi tunggal: `A`, `B`, `C`, `D`, `E`).
- **Bagian II (No. 21 – 30)**: **Pilihan Ganda Kompleks (MCMA)** (Pilihan ganda lebih dari satu jawaban: Checkbox `A`, `B`, `C`, `D`, `E`).
- **Bagian III (No. 31 – 40)**: **Benar / Salah (B/S)** (Pilihan `Benar (B)` atau `Salah (S)`).

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi dibuat berbasis web murni (*client-side modern*) tanpa perlu instalasi rumit, database eksternal, atau Node.js. Anda dapat memilih salah satu dari 2 cara termudah berikut:

### 🟢 Cara 1 (Paling Praktis - Tanpa Perlu Terminal)
1. Buka folder proyek ini di Windows Explorer.
2. Klik ganda (**double-click**) file **`buka_aplikasi.bat`** atau file **`index.html`**.
3. Aplikasi akan langsung terbuka di browser favorit Anda (Google Chrome, Microsoft Edge, Mozilla Firefox, dll).

### 🐍 Cara 2 (Menggunakan Local Server Python)
Jika Anda ingin menjalankannya melalui server HTTP lokal:
1. Buka terminal / Command Prompt (CMD) di folder proyek ini.
2. Jalankan perintah:
   ```bash
   python app.py
   ```
3. Browser akan terbuka otomatis di alamat: `http://localhost:8080/index.html`.

---

## ✨ Fitur-Fitur Utama & Keunggulan

### 1. ⚡ Input Super Cepat Bebas Mouse (100% Keyboard-Driven)
- **Ketik Langsung & Auto-Advance**:
  - Soal PG Sederhana (No. 1–10/20): Tekan huruf `A`, `B`, `C`, `D`, atau `E` di keyboard, kursor **otomatis lompat** ke nomor berikutnya seketika!
  - Soal PG Kompleks (MCMA): Ketik kombinasi huruf langsung (misal `AC` atau `BDE`), lalu tekan `Enter` atau `Spasi` untuk lanjut ke nomor berikutnya.
  - Soal Benar/Salah: Tekan huruf `B` (Benar) atau `S` (Salah), kursor langsung lompat ke nomor berikutnya.
  - Tombol **`Backspace`**: Menghapus jawaban atau mundur ke nomor soal sebelumnya.
  - Tombol Panah **`Arrow Left / Right / Up / Down`**: Navigasi leluasa antar nomor soal.
  - Shortcut **`Ctrl + Enter`**: Langsung menyimpan nilai siswa saat ini, mengosongkan formulir, dan otomatis mengarahkan kursor kembali ke kolom **Nama Siswa** berikutnya. Anda dapat mengoreksi 1 kelas penuh tanpa sekalipun memegang mouse!

### 2. ⚡ Tempel String Cepat (Quick Paste String 1 Siswa)
Tersedia kotak **Tempel String Jawaban** di bagian atas formulir:
- Cukup tempelkan baris string jawaban (dipisahkan spasi atau koma), contoh:
  ```text
  A B C D E A C B D A AC BD ABE CD ADE BC AB CE ACD BE B S B B S S B S B B
  ```
  *(Dapat juga memakai format bertanda kurung seperti `[A,C]` atau `(A,B,E)`).*
- Tekan **Enter** atau klik **Terapkan**: seluruh 30 atau 40 nomor langsung terisi dalam 0,1 detik dan nilai siswa langsung terkalkulasi!

### 3. 📋 Input Borongan Banyak Siswa (Batch Import dari Excel)
Tersedia tab khusus **📋 Input Borongan (Batch)** untuk mengoreksi seluruh siswa dalam satu kelas sekaligus:
- Guru cukup menyeleksi tabel di Microsoft Excel / Google Sheets, tekan `Ctrl + C` (Copy), lalu paste (`Ctrl + V`) ke dalam kotak teks borongan.
- **Format Baris Excel**:
  ```text
  Nama Siswa [TAB] Nomor Peserta [TAB] Jawaban Soal 1 s/d 30/40
  ```
- **Pratinjau Langsung**: Sistem langsung mendeteksi jumlah siswa, butir soal terisi, estimasi nilai akhir, serta status kelulusan (TUNTAS / REMEDIAL) sebelum disimpan.
- Klik **"🚀 Simpan & Koreksi Semua Siswa Sekaligus"**: Seluruh siswa langsung tersimpan ke rekapitulasi nilai kelas dalam 1 detik!

### 4. 🔑 Dashboard Pengaturan Kunci Jawaban
- Beralih fleksibel antara **Mapel Eksak (30 Soal)** dan **Mapel Non-Eksak (40 Soal)**.
- Dilengkapi fitur **Tempel Cepat Seluruh Kunci Jawaban**, sehingga guru tidak perlu mengklik tombol kunci satu per satu.
- Tersedia tombol **"⚡ Muat Kunci Contoh"** dan **"Simpan Kunci Jawaban"** yang tersimpan permanen di *LocalStorage* browser Anda.

### 5. ⚙️ Sistem Penilaian Cerdas (Scoring Engine)
Konfigurasi fleksibel yang dapat diatur di tab **⚙️ Aturan Skor**:
- **PG Sederhana**: Benar = 1 poin (atau bobot kustom), Salah = 0.
- **Benar / Salah**: Benar = 1 poin (atau bobot kustom), Salah = 0.
- **PG Kompleks (MCMA)** memiliki 3 mode penilaian yang dapat dipilih:
  1. **Parsial Proporsional Berpenalti (Default & Rekomendasi Standar Asesmen)**:
     $$\text{Poin} = \max\left(0, \frac{\text{Opsi Benar} - \text{Opsi Salah}}{\text{Total Opsi Kunci}}\right) \times \text{Bobot}$$
     *Mencegah siswa mencentang semua pilihan A-E untuk mendapatkan nilai curang.*
  2. **All-or-Nothing**: Siswa harus memilih tepat sama persis 100% dengan kunci jawaban untuk memperoleh poin penuh. Jika kurang atau berlebih = 0 poin.
  3. **Parsial Bersih**: Siswa mendapatkan poin proporsional sesuai jumlah opsi benar yang dipilih, dengan syarat *tidak ada satu pun opsi salah yang dipilih*.
- **Konfigurasi KKM**: Dapat diatur sesuai KKM sekolah (misalnya: 75).
- **Kalkulasi Otomatis**: Menghasilkan nilai akhir skala 0 – 100 dan predikat huruf (A, B, C, D).

### 6. 📊 Rekapitulasi Nilai & Analisis Butir Soal
- Ringkasan statistik instan: Jumlah Peserta, Nilai Rata-rata, Nilai Tertinggi, Nilai Terendah, dan Persentase Kelulusan KKM.
- Pencarian cerdas nama / nomor peserta dan filter status ketuntasan secara instan.
- **Modal Rincian Jawaban Siswa**: Tampilan detail komparasi jawaban siswa vs kunci jawaban dengan indikator warna hijau (benar), kuning (parsial), dan merah (salah).
- **Analisis Butir Soal**: Menampilkan daya serap dan persentase siswa yang menjawab benar di tiap butir soal, lengkap dengan klasifikasi tingkat kesulitan (**Mudah**, **Sedang**, **Sukar**).

### 7. 📥 Ekspor Excel (.CSV) & Format Cetak Resmi (A4)
- **Ekspor CSV**: Menggunakan standar UTF-8 BOM sehingga langsung rapi saat dibuka di Microsoft Excel tanpa masalah encoding.
- **Cetak Laporan**: Sudah terpasang *Print Stylesheet* (@media print) yang otomatis menyembunyikan tombol navigasi dan menampilkan **Kop Resmi Asesmen Sumatif Akhir Semester**, tabel nilai, serta kolom tanda tangan Guru Pengampu dan Kepala Sekolah.

---

## 📁 Struktur Berkas Proyek

```text
koreksi-asas/
├── index.html            # Antarmuka Pengguna Utama (Tailwind CSS, Semantic HTML5)
├── buka_aplikasi.bat     # Peluncur cepat (double-click) untuk Windows
├── app.py                # Server lokal berbasis Python (opsional)
├── README.md             # Dokumentasi lengkap sistem
├── css/
│   └── custom.css        # Styling transisi, toast notification, dan format cetak (@media print)
└── js/
    ├── models.js         # Definisi model mata pelajaran (Eksak & Non-Eksak) & data sampel
    ├── scoringEngine.js  # Mesin algoritma penilaian otomatis yang terisolasi dan modular
    ├── storage.js        # Pengelola penyimpanan data persisten (LocalStorage) & backup/restore
    └── app.js            # Controller antarmuka pengguna, navigasi tab, dan penanganan event
```

---

## 🛠️ Panduan Modifikasi & Kustomisasi Penilaian

Arsitektur aplikasi dirancang modular agar pengembang atau guru dapat dengan mudah mengubah aturan penilaian:

1. **Mengubah Formula Penilaian PG Kompleks**:
   Buka file [js/scoringEngine.js](js/scoringEngine.js), lihat method `gradePgComplex()`. Anda dapat menambahkan logika formula baru pada blok `if (mode === ...)` sesuai kebijakan sekolah Anda.

2. **Mengubah Jumlah Butir Soal**:
   Buka file [js/models.js](js/models.js), lihat objek `SUBJECT_STRUCTURES.eksak` atau `non_eksak`. Ubah `totalQuestions` dan range `sections` sesuai kebutuhan.

3. **Mengubah Bobot Nilai Standar**:
   Dapat diubah langsung melalui UI pada tab **⚙️ Aturan Skor**, atau ubah konstanta `DEFAULT_CONFIG` di [js/scoringEngine.js](js/scoringEngine.js).

---

## 💡 Kebutuhan Sistem
- Sistem Operasi: Windows 10/11, macOS, Linux, atau Android/iOS.
- Browser: Google Chrome, Microsoft Edge, Mozilla Firefox, Safari, atau Opera versi modern.
