# SAPP — Sistem Auto Approval Perizinan Pegawai

SAPP (Sistem Auto Approval Perizinan Pegawai) adalah aplikasi modern berbasis web yang dirancang untuk mengelola perizinan dan cuti pegawai secara otomatis, terstruktur, dan transparan. Aplikasi ini dilengkapi dengan mesin aturan kebijakan (*policy rule engine*), alur persetujuan bertingkat (*multi-step workflow approval*), pemantauan SLA otomatis, dan manajemen master data berbasis peran (RBAC).

---

## 🛠️ Tech Stack

* **Framework:** [Nuxt 4](https://nuxt.com/) (Vue 3, Nitro Engine)
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) (Mobile-First responsive, 360px viewport optimized)
* **Interaktivitas:** [Alpine.js](https://alpinejs.dev/) & Vue Composition API
* **Database & ORM:** [PostgreSQL 16](https://www.postgresql.org/) & [Drizzle ORM](https://orm.drizzle.team/)
* **Keamanan:** Autentikasi sesi *opaque* berbasis cookie HttpOnly, enkripsi password Bcrypt cost-12, mitigasi *brute-force* otomatis.

---

## 🚀 Panduan Instalasi & Menjalankan Aplikasi

### 1. Prasyarat Sistem
* **Node.js**: Versi 20 atau lebih baru (disarankan v24 LTS).
* **Podman** atau **Docker** untuk menjalankan basis data PostgreSQL.

### 2. Menjalankan Database PostgreSQL (Podman / Docker)

Jika menggunakan Podman:
```powershell
# 1. Pastikan Podman Machine aktif
podman machine start

# 2. Jalankan container PostgreSQL 16
podman run -d --name sapp-postgres `
  -e POSTGRES_USER=sapp `
  -e POSTGRES_PASSWORD=sapp_secret `
  -e POSTGRES_DB=sapp `
  -e TZ=Asia/Jakarta `
  -e PGTZ=Asia/Jakarta `
  -p 5432:5432 `
  -v sapp-pgdata:/var/lib/postgresql/data `
  --restart unless-stopped `
  docker.io/library/postgres:16-alpine

# 3. Muat skema dan data awal (seed)
podman cp .\db\01_schema.sql sapp-postgres:/tmp/01_schema.sql
podman cp .\db\02_seed.sql sapp-postgres:/tmp/02_seed.sql
podman exec -it sapp-postgres psql -U sapp -d sapp -v ON_ERROR_STOP=1 -f /tmp/01_schema.sql
podman exec -it sapp-postgres psql -U sapp -d sapp -v ON_ERROR_STOP=1 -f /tmp/02_seed.sql
```

### 3. Konfigurasi Environment (`.env`)

Pastikan file `.env` telah tersedia di direktori utama:
```env
# --- Database ---
DB_HOST=127.0.0.1
DB_PORT=5433
DB_NAME=sapp
DB_USER=sapp
DB_PASSWORD=sapp_secret
DATABASE_URL=postgres://sapp:sapp_secret@127.0.0.1:5433/sapp

# --- Aplikasi ---
NUXT_PUBLIC_APP_NAME=Sistem Perizinan Pegawai
NUXT_PUBLIC_BASE_URL=http://localhost:3000
NUXT_SESSION_SECRET=CdW561Oyj/RBp6cZ/XFWbXiX6u1CHQ+gWNAvtz0if9x1LcgygAyKlO8PuanjQREy
TZ=Asia/Jakarta
```

> **Catatan Port Windows/WSL2:** Jika port default `5432` terblokir oleh reservasi soket Windows Hyper-V, port tunneling `5433` digunakan untuk menghubungkan host ke container database.

### 4. Menjalankan Server Pengembangan

```powershell
# Install dependensi
npm install

# Jalankan server Nuxt dev
npm run dev
```

Buka peramban di [http://localhost:3000](http://localhost:3000).

---

## 👥 Akun Bawaan (Daftar Pengguna & Role)

Semua akun bawaan di bawah ini memiliki **kata sandi awal yang sama**:

> 🔑 **Password Default:** `Password123!`

*(Semua akun bawaan memiliki flag `must_change_password = true`, sehingga pada login pertama Anda akan diminta membuat password baru sebelum masuk ke sistem).*

| Username | Email | Nama Pegawai | Jabatan & Departemen | Role Sistem |
|---|---|---|---|---|
| **`admin`** | `admin@perusahaan.co.id` | *Administrator Sistem* | - | `ADMIN` |
| **`joko`** | `joko@perusahaan.co.id` | Joko Prasetyo | Manajer HRD | `ADMIN`, `HR_APPROVER`, `APPROVER`, `EMPLOYEE` |
| **`hendra`** | `hendra@perusahaan.co.id` | Hendra Wijaya | Direktur Utama | `APPROVER`, `EMPLOYEE` |
| **`rina`** | `rina@perusahaan.co.id` | Rina Kartika | Manajer IT | `APPROVER`, `EMPLOYEE` |
| **`andi`** | `andi@perusahaan.co.id` | Andi Nugroho | Supervisor IT | `APPROVER`, `EMPLOYEE` |
| **`budi`** | `budi@perusahaan.co.id` | Budi Santoso | Staf IT (Tetap) | `EMPLOYEE` |
| **`sinta`** | `sinta@perusahaan.co.id` | Sinta Marlina | Staf IT (Kontrak) | `EMPLOYEE` |
| **`agus`** | `agus@perusahaan.co.id` | Agus Setiawan | Manajer Keuangan | `APPROVER`, `EMPLOYEE` |
| **`maya`** | `maya@perusahaan.co.id` | Maya Puspita | Staf Keuangan (Tetap) | `EMPLOYEE` |
| **`dewi`** | `dewi@perusahaan.co.id` | Dewi Lestari | Staf HRD (Tetap) | `EMPLOYEE` |
| **`rizky`** | `rizky@perusahaan.co.id` | Rizky Ramadhan | Staf Operasional (Probation) | `EMPLOYEE` |

---

## 🌳 Struktur Rantai Persetujuan (Atasan & Bawahan)

Untuk pengujian alur persetujuan (*approval workflow*), berikut adalah hierarki atasan yang telah dikonfigurasi:

```
Hendra Wijaya (Direktur Utama)
 ├── Joko Prasetyo (Manajer HRD)
 │    ├── Dewi Lestari (Staf HRD)
 │    └── Rizky Ramadhan (Staf Ops)
 ├── Rina Kartika (Manajer IT)
 │    └── Andi Nugroho (Supervisor IT)
 │         ├── Budi Santoso (Staf IT)
 │         └── Sinta Marlina (Staf IT)
 └── Agus Setiawan (Manajer Keuangan)
      └── Maya Puspita (Staf Keuangan)
```

* **Contoh:** Jika **Budi Santoso** mengajukan perizinan, atasan langsung tahap pertamanya adalah **Andi Nugroho (Supervisor IT)**.

---

## 📱 Panduan Navigasi & Fitur Aplikasi

Navigasi aplikasi mengusung konsep **Mobile-First Card Pattern**, sangat nyaman digunakan pada layar ponsel (360px) tanpa tabel yang meluber ke samping.

### 1. Halaman Login (`/login`)
* Masukkan salah satu **Username** atau **Email** di atas beserta password default `Password123!`.
* Dilengkapi proteksi *brute-force*: akun akan terkunci otomatis selama 15 menit jika salah memasukkan password sebanyak 5 kali berturut-turut.

### 2. Halaman Ganti Password (`/ganti-password`)
* Muncul otomatis saat login pertama kali jika akun memiliki tanda wajib ganti kata sandi.
* Ketentuan kata sandi baru: minimal 8 karakter dan kombinasi huruf serta angka.

### 3. Dasbor Admin (`/admin`) *(Hanya role ADMIN: `admin` & `joko`)*
* **Kelola Pegawai (`/admin/pegawai`)**:
  * Menampilkan daftar pegawai berbasis kartu, filter departemen & status, dan pencarian cepat.
  * Tambah pegawai baru: sistem akan **otomatis membuatkan akun pengguna** dan memberikan kata sandi acak sementara yang dapat langsung disalin.
  * Detail pegawai: ubah profil, atur hak akses/role pengguna, reset kata sandi, aktif/nonaktifkan hak pengajuan izin, dan nonaktifkan pegawai (dilengkapi validasi pencegahan jika masih ada tugas approval berstatus *pending*).
  * Validasi anti-siklus (*manager cycle detection*): mencegah penyusunan atasan yang melingkar (misal A atasan B, B atasan A).
* **Struktur Organisasi (`/admin/organisasi`)**:
  * Kelola departemen dan unit kerja (termasuk kepala departemen).
  * Kelola jenjang jabatan (*level* 1–10).
* **Jenis Izin & Hak Pengajuan (`/admin/jenis-izin`)**:
  * Daftar 6 jenis izin default (Cuti Tahunan, Sakit, Izin Tidak Masuk, Menikah, Melahirkan, WFA).
  * Atur kuota tahunan, batas hari *backdate*, kewajiban lampiran, dan warna kartu.
  * **Matriks Hak Pengajuan (Eligibility)**: Konfigurasi siapa yang berhak mengajukan (misal: WFA dilarang untuk status `PROBATION` & `CONTRACT`, namun dapat diberi pengecualian khusus untuk pegawai tertentu).
* **Pengaturan Sistem (`/admin/pengaturan`)**:
  * **Jam Kerja Mingguan**: Pengaturan jam kerja harian (Senin–Minggu), jam masuk, jam pulang, dan jam istirahat.
  * **Kalender Hari Libur**: Penentuan libur nasional dan cuti bersama (dapat diset memotong kuota atau tidak).
  * **Parameter Global**: Pengaturan SLA approval, reminder default, dan notifikasi.

### 4. Halaman Profil (`/profil`)
* Menampilkan informasi data diri, daftar role yang dimiliki, tautan ganti kata sandi, dan tombol logout.

---

## 💻 Skrip Pengembangan yang Tersedia

| Perintah | Keterangan |
|---|---|
| `npm run dev` | Menjalankan server pengembangan Nuxt 4 lokal |
| `npm run build` | Melakukan build produksi Nitro & Nuxt |
| `npm run typecheck` | Menjalankan validasi tipe TypeScript & Vue |
| `npm run verify:db` | Memvalidasi integritas koneksi dan kelengkapan data database |
| `npm run hash -- "<password>"` | Membuat hash Bcrypt cost-12 untuk kata sandi tertentu |
