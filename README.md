# SAPP (AutoLeave) — Sistem Auto Approval Perizinan Pegawai

> 🌐 **Bahasa / Language:** [🇮🇩 Bahasa Indonesia](README.md) · [🇬🇧 English](README.en.md)

SAPP (*AutoLeave*) adalah aplikasi modern berbasis web yang dirancang untuk mengelola perizinan, cuti, dan kehadiran kerja jarak jauh (WFA) pegawai secara otomatis, terstruktur, dan transparan. Aplikasi ini dilengkapi dengan mesin aturan kebijakan (*policy rule engine*), alur persetujuan bertingkat (*multi-step workflow approval*), pemantauan SLA otomatis dengan eskalasi, notifikasi multi-kanal (Email SMTP & Telegram Bot), dukungan dwibahasa (Bahasa Indonesia & English), serta manajemen master data berbasis peran (RBAC).

---

## 🛠️ Tech Stack

* **Framework:** [Nuxt 4](https://nuxt.com/) (Vue 3.5+, Nitro Engine, Island Components)
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) (Mobile-First, Ergonomi Satu Tangan / Thumb Zone, Kontras Aksesibilitas WCAG AAA)
* **Interaktivitas:** [Alpine.js](https://alpinejs.dev/) & Vue 3 Composition API
* **Database & ORM:** [PostgreSQL 16](https://www.postgresql.org/) & [Drizzle ORM](https://orm.drizzle.team/)
* **Internasionalisasi (i18n):** Composable `useI18n` kustom dengan SSR cookie persistence dan kamus bertipe kuat (*strongly typed*).
* **Notifikasi:** [Nodemailer](https://nodemailer.com/) (Gmail SMTP / Mailtrap) & Telegram Bot API.
* **Testing & Kualitas:** [Vitest 5](https://vitest.dev/) (29 test suites, 153 tests passing 100%) & `vue-tsc` typecheck (0 error).
* **Keamanan:** Autentikasi sesi *opaque* berbasis cookie HttpOnly, enkripsi password Bcrypt cost-12, mitigasi *brute-force* otomatis, dan *cycle detection* hierarki atasan.

---

## 📸 Pratinjau Antarmuka Aplikasi (Screenshots)

### 🖥️ Dasbor & Administrasi (Tampilan Desktop)

| Dasbor Analisis & Kalender Cuti | Pemantauan & Intervensi Admin |
| :---: | :---: |
| [![Dasbor Laporan](docs/screenshots/desktop-dashboard-laporan.png)](docs/screenshots/desktop-dashboard-laporan.png) | [![Admin Pengajuan](docs/screenshots/desktop-admin-pengajuan.png)](docs/screenshots/desktop-admin-pengajuan.png) |
| *Visualisasi rasio cuti, tren bulanan, dan kalender tim* | *Pemantauan pengajuan real-time & intervensi override admin* |

| Visual Workflow Builder | Manajemen Template Notifikasi Multi-Kanal |
| :---: | :---: |
| [![Workflow Builder](docs/screenshots/desktop-workflow-builder.png)](docs/screenshots/desktop-workflow-builder.png) | [![Template Notifikasi](docs/screenshots/desktop-notification-templates.png)](docs/screenshots/desktop-notification-templates.png) |
| *Konfigurasi alur approval bertingkat (SLA, quorum, eskalasi)* | *Editor template email & Telegram dengan pratinjau live token* |

### 📱 Antarmuka Mobile-First & Dukungan Dwibahasa (ID / EN)

| Beranda Pegawai (Bahasa Indonesia) | Employee Home (English) |
| :---: | :---: |
| <a href="docs/screenshots/mobile-beranda-id.png"><img src="docs/screenshots/mobile-beranda-id.png" width="340" alt="Beranda ID" /></a> | <a href="docs/screenshots/mobile-beranda-en.png"><img src="docs/screenshots/mobile-beranda-en.png" width="340" alt="Beranda EN" /></a> |
| *Ringkasan kuota, status pengajuan, dan aksi cepat (ID)* | *Leave quota balance, active requests, and quick actions (EN)* |

| Masuk Akun (ID) | Sign In (EN) | Preferensi Bahasa & Profil |
| :---: | :---: | :---: |
| <a href="docs/screenshots/mobile-login-id.png"><img src="docs/screenshots/mobile-login-id.png" width="220" alt="Login ID" /></a> | <a href="docs/screenshots/mobile-login-en.png"><img src="docs/screenshots/mobile-login-en.png" width="220" alt="Login EN" /></a> | <a href="docs/screenshots/mobile-profil-bahasa.png" width="220" alt="Profil EN" /></a> |
| *Halaman masuk dalam Bahasa Indonesia* | *Sign in localized in English* | *Pengaturan preferensi bahasa & akun* |

### 📋 Pengajuan Mandiri, Approval & Integrasi Bot Telegram

| Formulir Pengajuan Izin / Cuti | Kotak Masuk Approval (Approver) | Kalender Tim & Hari Libur |
| :---: | :---: | :---: |
| <a href="docs/screenshots/mobile-pengajuan-form.png"><img src="docs/screenshots/mobile-pengajuan-form.png" width="220" alt="Form Pengajuan" /></a> | <a href="docs/screenshots/mobile-approval-inbox.png"><img src="docs/screenshots/mobile-approval-inbox.png" width="220" alt="Approval Inbox" /></a> | <a href="docs/screenshots/mobile-kalender-tim.png"><img src="docs/screenshots/mobile-kalender-tim.png" width="220" alt="Kalender Tim" /></a> |
| *Validasi 20 aturan & hitung hari kerja otomatis* | *Kotak masuk terpadu dengan hitung mundur SLA* | *Visibilitas cuti rekan tim dan libur nasional* |

| Pratinjau Live Template Notifikasi | Modal Pairing Telegram Bot |
| :---: | :---: |
| [![Live Preview](docs/screenshots/desktop-template-preview.png)](docs/screenshots/desktop-template-preview.png) | [![Telegram Pairing Modal](docs/screenshots/telegram-pairing-modal.png)](docs/screenshots/telegram-pairing-modal.png) |
| *Pratinjau pesan otomatis dengan token dinamis* | *Pairing akun Telegram instan via scan QR & kode 6 digit* |

---

## 🚀 Panduan Instalasi & Menjalankan Aplikasi

### 1. Prasyarat Sistem
* **Node.js**: Versi 20 atau lebih baru (disarankan v22/v24 LTS).
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

# --- Notifikasi Email SMTP (Opsional) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifikasi@perusahaan.co.id
SMTP_PASSWORD=your_app_password
SMTP_FROM="Sistem Perizinan Pegawai <notifikasi@perusahaan.co.id>"

# --- Notifikasi Telegram Bot (Opsional) ---
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_BOT_USERNAME=your_bot_username
```

> **Catatan Port Windows/WSL2:** Jika port default `5432` terblokir oleh reservasi soket Windows Hyper-V, gunakan port tunneling `5433` untuk menghubungkan host ke container database.

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

> 🔑 **Password Default:** `Password123!` (Khusus akun `admin`: `Password1234!`)

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

## 📱 Panduan Navigasi & Fitur Utama

Navigasi aplikasi mengusung konsep **Mobile-First Card Pattern**, sangat nyaman digunakan pada layar ponsel (360px) tanpa tabel yang meluber ke samping.

### 1. Pilihan Bahasa (i18n)
* Tombol pengganti bahasa `ID | EN` tersedia di **Header Navigasi Utama** dan di pojok kanan atas **Halaman Login**.
* Tersedia kartu pengaturan bahasa di halaman **Profil (`/profil`)**.
* Pilihan bahasa tersimpan otomatis di cookie peramban (`app_locale`) selama 1 tahun dan dirender langsung sejak transmisi HTML server (SSR).

### 2. Halaman Login (`/login`)
* Masukkan salah satu **Username** atau **Email** di atas beserta password default `Password123!`.
* Dilengkapi proteksi *brute-force*: akun akan terkunci otomatis selama 15 menit jika salah memasukkan password sebanyak 5 kali berturut-turut.

### 3. Halaman Ganti Password (`/ganti-password`)
* Muncul otomatis saat login pertama kali jika akun memiliki tanda wajib ganti kata sandi.
* Ketentuan kata sandi baru: minimal 8 karakter dan kombinasi huruf serta angka.

### 4. Pengajuan Izin (`/pengajuan/baru` & `/pengajuan`)
* Formulir permohonan mandiri dengan kalkulasi otomatis hari kerja efektif.
* Pra-validasi seketika oleh **20 mesin aturan** (kebijakan cuti, batasan kuota, bentrok jadwal, syarat lampiran).
* Unggah berkas lampiran pendukung (surat dokter / dokumen bukti).

### 5. Kotak Masuk Approval (`/approval` & `/approval/[taskId]`)
* Menampilkan daftar tugas persetujuan: Semua, Mendesak (< 4 jam), Terlambat SLA, dan Delegasi.
* Hitung mundur tenggat waktu SLA dinamis dengan penanda visual.
* Evaluasi aturan alur: mode `ANY_ONE`, `ALL`, dan `QUORUM` (mis. butuh 2 dari 3 persetujuan).
* Intervensi eskalasi dan persetujuan/penolakan otomatis jika batas SLA terlewati.

### 6. Dasbor Laporan & Kalender Tim (`/laporan` & `/laporan/kalender`)
* Rekapitulasi per jenis izin, departemen, dan saldo kuota pegawai.
* Analisis performa approver (rata-rata respon dan SLA breach rate).
* Kalender kehadiran tim gabungan dengan hari libur nasional.
* Ekspor laporan ke CSV standar Excel (delimiter titik koma dengan UTF-8 BOM).

### 7. Dasbor Admin (`/admin`) *(Hanya role ADMIN: `admin` & `joko`)*
* **Pengawasan & Intervensi (`/admin/pengajuan`)**: Pemantauan langsung seluruh alur izin dan aksi intervensi admin (`REASSIGN`, `FORCE_APPROVE_STEP`, `FORCE_DECISION`, `EXTEND_DEADLINE`, `REOPEN`).
* **Kelola Pegawai (`/admin/pegawai`)**: Pembuatan akun otomatis, manajemen role, reset sandi, dan deteksi siklus atasan.
* **Struktur Organisasi (`/admin/organisasi`)**: Kelola departemen dan jenjang jabatan (Level 1–10).
* **Jenis Izin & Aturan (`/admin/jenis-izin` & `/admin/aturan`)**: Pengaturan kuota, batas *backdate*, dan matriks kelayakan hak izin (*eligibility*).
* **Alur Approval (`/admin/alur`)**: Workflow builder multi-tahap visual dengan simulator live.
* **Template & Notifikasi (`/admin/notifikasi`)**: Editor template email & Telegram dengan pratinjau langsung dan tombol uji coba.
* **Audit Log (`/admin/audit`)**: Pencatatan jejak aktivitas admin dan sistem dengan masking otomatis data rahasia.

---

## 💻 Skrip Pengembangan & Pengujian

| Perintah | Keterangan |
|---|---|
| `npm run dev` | Menjalankan server pengembangan Nuxt 4 lokal |
| `npm run test` | Menjalankan seluruh pengujian otomatis Vitest (153 tests) |
| `npx vue-tsc --noEmit` | Menjalankan validasi tipe TypeScript & Vue SFC |
| `npm run build` | Melakukan build produksi Nitro & Nuxt |
| `npm run verify:db` | Memvalidasi integritas koneksi dan kelengkapan tabel database |
| `npm run hash -- "<password>"` | Membuat hash Bcrypt cost-12 untuk kata sandi tertentu |

---

## 📖 Dokumentasi Tambahan

* **[README English Version](README.en.md)**: English translation of this project guide.
* **[Panduan Notifikasi Email & Telegram](TUTORIAL_NOTIFIKASI.md)**: Panduan konfigurasi Gmail SMTP dan BotFather Telegram (Bahasa Indonesia).
* **[Notification Guide (English)](TUTORIAL_NOTIFIKASI.en.md)**: Step-by-step Email & Telegram setup guide (English).
* **[Daftar Periksa Rilis (Release Checklist)](RELEASE_CHECKLIST.md)**: Skenario UAT, audit keamanan, dan prosedur deployment.
