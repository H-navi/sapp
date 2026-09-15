# AutoLeave (SAPP) — Automated Employee Leave & Absence Management System

> 🌐 **Language / Bahasa:** [🇬🇧 English](README.en.md) · [🇮🇩 Bahasa Indonesia](README.md)

AutoLeave (SAPP) is a modern, enterprise-grade web application designed to automate, streamline, and standardize employee leave, absence, and Work-From-Anywhere (WFA) requests. The application features a dynamic policy rule engine, multi-step approval workflows, automated SLA tracking and escalations, multi-channel notifications (Email SMTP & Telegram Bot), native bilingual internationalization (Indonesian & English), and fine-grained Role-Based Access Control (RBAC).

---

## 🛠️ Tech Stack

* **Framework:** [Nuxt 4](https://nuxt.com/) (Vue 3.5+, Nitro Engine, Component Islands)
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) (Mobile-First, One-Hand Ergonomics / Thumb Zone, WCAG AAA accessibility contrast)
* **Interactivity:** [Alpine.js](https://alpinejs.dev/) & Vue 3 Composition API
* **Database & ORM:** [PostgreSQL 16](https://www.postgresql.org/) & [Drizzle ORM](https://orm.drizzle.team/)
* **Internationalization (i18n):** Custom `useI18n` composable with SSR cookie persistence and strongly-typed dictionaries.
* **Notifications:** [Nodemailer](https://nodemailer.com/) (Gmail SMTP / Mailtrap) & Telegram Bot API.
* **Testing & Quality Assurance:** [Vitest 5](https://vitest.dev/) (29 test suites, 153 tests passing 100%) & `vue-tsc` typecheck (0 errors).
* **Security:** Opaque session cookies (HttpOnly, SameSite), Bcrypt cost-12 password hashing, automated brute-force mitigation, and supervisory hierarchy cycle detection.

---

## 🚀 Getting Started & Installation Guide

### 1. System Prerequisites
* **Node.js**: Version 20 or later (v22/v24 LTS recommended).
* **Podman** or **Docker** for running the PostgreSQL database container.

### 2. Running the PostgreSQL Database (Podman / Docker)

Using Podman:
```powershell
# 1. Ensure the Podman machine is running
podman machine start

# 2. Run the PostgreSQL 16 container
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

# 3. Load database schema and initial seed data
podman cp .\db\01_schema.sql sapp-postgres:/tmp/01_schema.sql
podman cp .\db\02_seed.sql sapp-postgres:/tmp/02_seed.sql
podman exec -it sapp-postgres psql -U sapp -d sapp -v ON_ERROR_STOP=1 -f /tmp/01_schema.sql
podman exec -it sapp-postgres psql -U sapp -d sapp -v ON_ERROR_STOP=1 -f /tmp/02_seed.sql
```

### 3. Environment Configuration (`.env`)

Ensure a `.env` file exists in the project root directory:
```env
# --- Database ---
DB_HOST=127.0.0.1
DB_PORT=5433
DB_NAME=sapp
DB_USER=sapp
DB_PASSWORD=sapp_secret
DATABASE_URL=postgres://sapp:sapp_secret@127.0.0.1:5433/sapp

# --- Application ---
NUXT_PUBLIC_APP_NAME="Employee Leave Management System"
NUXT_PUBLIC_BASE_URL=http://localhost:3000
NUXT_SESSION_SECRET=CdW561Oyj/RBp6cZ/XFWbXiX6u1CHQ+gWNAvtz0if9x1LcgygAyKlO8PuanjQREy
TZ=Asia/Jakarta

# --- Email SMTP Notifications (Optional) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@company.com
SMTP_PASSWORD=your_app_password
SMTP_FROM="AutoLeave System <notifications@company.com>"

# --- Telegram Bot Notifications (Optional) ---
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_BOT_USERNAME=your_bot_username
```

> **Windows / WSL2 Port Note:** If port `5432` is reserved by Windows Hyper-V socket exclusions, tunneling port `5433` is used to forward connections to the database container.

### 4. Running the Development Server

```powershell
# Install project dependencies
npm install

# Start the Nuxt development server
npm run dev
```

Open your browser at [http://localhost:3000](http://localhost:3000).

---

## 👥 Default Accounts (Users & Roles)

All pre-seeded default accounts share the **same initial password**:

> 🔑 **Default Password:** `Password123!` (For the `admin` account: `Password1234!`)

*(All default accounts are configured with `must_change_password = true`, requiring a password update upon first sign-in before accessing the application).*

| Username | Email | Full Name | Position & Department | System Role |
|---|---|---|---|---|
| **`admin`** | `admin@perusahaan.co.id` | *System Administrator* | - | `ADMIN` |
| **`joko`** | `joko@perusahaan.co.id` | Joko Prasetyo | HR Manager | `ADMIN`, `HR_APPROVER`, `APPROVER`, `EMPLOYEE` |
| **`hendra`** | `hendra@perusahaan.co.id` | Hendra Wijaya | President Director | `APPROVER`, `EMPLOYEE` |
| **`rina`** | `rina@perusahaan.co.id` | Rina Kartika | IT Manager | `APPROVER`, `EMPLOYEE` |
| **`andi`** | `andi@perusahaan.co.id` | Andi Nugroho | IT Supervisor | `APPROVER`, `EMPLOYEE` |
| **`budi`** | `budi@perusahaan.co.id` | Budi Santoso | IT Staff (Permanent) | `EMPLOYEE` |
| **`sinta`** | `sinta@perusahaan.co.id` | Sinta Marlina | IT Staff (Contract) | `EMPLOYEE` |
| **`agus`** | `agus@perusahaan.co.id` | Agus Setiawan | Finance Manager | `APPROVER`, `EMPLOYEE` |
| **`maya`** | `maya@perusahaan.co.id` | Maya Puspita | Finance Staff (Permanent) | `EMPLOYEE` |
| **`dewi`** | `dewi@perusahaan.co.id` | Dewi Lestari | HR Staff (Permanent) | `EMPLOYEE` |
| **`rizky`** | `rizky@perusahaan.co.id` | Rizky Ramadhan | Operations Staff (Probation) | `EMPLOYEE` |

---

## 🌳 Supervisory Chain Structure (Approvers & Direct Reports)

For testing multi-step approval workflows, the pre-configured supervisory hierarchy is as follows:

```
Hendra Wijaya (President Director)
 ├── Joko Prasetyo (HR Manager)
 │    ├── Dewi Lestari (HR Staff)
 │    └── Rizky Ramadhan (Operations Staff)
 ├── Rina Kartika (IT Manager)
 │    └── Andi Nugroho (IT Supervisor)
 │         ├── Budi Santoso (IT Staff)
 │         └── Sinta Marlina (IT Staff)
 └── Agus Setiawan (Finance Manager)
      └── Maya Puspita (Finance Staff)
```

* **Example:** When **Budi Santoso** submits a leave request, his first-step direct manager is **Andi Nugroho (IT Supervisor)**.

---

## 📱 Navigation & Core Features

The user interface follows a **Mobile-First Card Pattern**, offering an optimal touch experience on mobile viewports (360px) without horizontal table overflow.

### 1. Bilingual Language Switcher (i18n)
* Toggle between `ID | EN` anytime using the quick switcher in the **Navigation Header** or at the top-right of the **Sign-in page**.
* Dedicated **Language Preferences** card in the **Profile Page (`/profil`)**.
* Selected language is persisted via an `app_locale` cookie (1-year lifetime) and rendered seamlessly during Server-Side Rendering (SSR).

### 2. Sign-in Page (`/login`)
* Sign in using any **Username** or **Email** listed above with the default password.
* Protected by brute-force rate-limiting: accounts are locked for 15 minutes after 5 consecutive failed attempts.

### 3. Change Password Page (`/ganti-password`)
* Automatically prompted on initial sign-in if the account requires a password change.
* Password policy requires at least 8 characters with a combination of letters and numbers.

### 4. Leave Requests (`/pengajuan/baru` & `/pengajuan`)
* Self-service request submission with automated effective working day calculations.
* Real-time pre-check evaluation against **20 policy rule engines** (leave policy, quota limits, scheduling conflicts, attachment requirements).
* Upload supporting evidence (medical certificates / documentation).

### 5. Approval Inbox (`/approval` & `/approval/[taskId]`)
* Filter tasks by category: All, Urgent (< 4 hours), SLA Overdue, and Delegated.
* Dynamic SLA countdown timers with visual status indicators.
* Flexible workflow evaluation: `ANY_ONE`, `ALL`, and `QUORUM` modes (e.g., 2 out of 3 approvers required).
* Automated escalation and auto-decision (auto-approve / auto-reject) upon SLA deadline expiry.

### 6. HR Reports & Team Calendar (`/laporan` & `/laporan/kalender`)
* Comprehensive breakdowns by leave type, department, and quota balances.
* Approver performance metrics (average response time and SLA breach rates).
* Interactive team presence calendar integrated with public holidays.
* Export report data to Excel-compatible CSV (semicolon delimiter with UTF-8 BOM).

### 7. Administration Panel (`/admin`) *(Accessible to `ADMIN` roles: `admin` & `joko`)*
* **Monitoring & Interventions (`/admin/pengajuan`)**: Real-time request oversight and administrative intervention tools (`REASSIGN`, `FORCE_APPROVE_STEP`, `FORCE_DECISION`, `EXTEND_DEADLINE`, `REOPEN`).
* **Employee Management (`/admin/pegawai`)**: Automatic user provisioning, role assignments, password resets, and supervisory cycle detection.
* **Organization Hierarchy (`/admin/organisasi`)**: Department and position level management (Levels 1–10).
* **Leave Types & Rule Engine (`/admin/jenis-izin` & `/admin/aturan`)**: Quota allocation, backdating limits, and policy eligibility matrices.
* **Approval Workflows (`/admin/alur`)**: Visual multi-step workflow builder with live simulation tools.
* **Notification Templates (`/admin/notifikasi`)**: Email & Telegram template editor with live preview and test-send capabilities.
* **Audit Logs (`/admin/audit`)**: Tamper-evident activity logs with automatic redaction of sensitive credentials.

---

## 💻 Development & Testing Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local Nuxt 4 development server |
| `npm run test` | Run the complete Vitest test suite (153 tests across 29 test files) |
| `npx vue-tsc --noEmit` | Execute TypeScript & Vue Single File Component type checking |
| `npm run build` | Compile the production bundle for Nitro & Nuxt |
| `npm run verify:db` | Verify database connection and schema integrity |
| `npm run hash -- "<password>"` | Generate a Bcrypt cost-12 hash for a password string |

---

## 📖 Additional Documentation

* **[Panduan README (Bahasa Indonesia)](README.md)**: Original Indonesian project guide.
* **[Notification Guide (English)](TUTORIAL_NOTIFIKASI.en.md)**: Step-by-step Gmail SMTP & Telegram Bot configuration guide.
* **[Panduan Notifikasi (Bahasa Indonesia)](TUTORIAL_NOTIFIKASI.md)**: Notification setup guide in Indonesian.
* **[Release Checklist](RELEASE_CHECKLIST.md)**: End-to-end UAT scenarios, security checklist, and deployment procedures.
