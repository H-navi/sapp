-- =====================================================================
--  SAPP - Sistem Auto Approval Perizinan Pegawai
--  File    : 01_schema.sql
--  Target  : PostgreSQL 16+
--  Charset : UTF8
--  Jalankan sebagai owner database (lihat README bagian setup Podman)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;      -- email/username case-insensitive
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- exclusion constraint (anti tumpang tindih tanggal)

SET timezone = 'Asia/Jakarta';

-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE gender_enum AS ENUM ('MALE', 'FEMALE');

CREATE TYPE employment_status_enum AS ENUM (
    'PERMANENT',   -- karyawan tetap
    'CONTRACT',    -- PKWT
    'PROBATION',   -- masa percobaan
    'INTERN',      -- magang
    'OUTSOURCE'
);

CREATE TYPE leave_unit_enum AS ENUM ('DAY', 'HALF_DAY', 'HOUR');

CREATE TYPE day_part_enum AS ENUM ('FULL_DAY', 'MORNING', 'AFTERNOON');

CREATE TYPE request_status_enum AS ENUM (
    'DRAFT',       -- disimpan pegawai, belum dikirim
    'SUBMITTED',   -- terkirim, menunggu step pertama
    'IN_REVIEW',   -- sedang dalam proses approval bertingkat
    'APPROVED',    -- disetujui final (manual / otomatis)
    'REJECTED',    -- ditolak (manual / otomatis)
    'CANCELLED',   -- dibatalkan pegawai / admin
    'EXPIRED'      -- kadaluarsa tanpa keputusan (jika kebijakan KEEP_WAITING)
);

CREATE TYPE approval_task_status_enum AS ENUM (
    'WAITING',     -- step belum aktif (menunggu step sebelumnya)
    'PENDING',     -- aktif, menunggu tindakan approver
    'APPROVED',
    'REJECTED',
    'SKIPPED',     -- dilewati (mis. approver = pemohon, step opsional)
    'ESCALATED',   -- dieskalasi ke step lain karena SLA habis
    'EXPIRED',
    'CANCELLED'
);

CREATE TYPE action_source_enum AS ENUM (
    'USER',               -- tindakan manual approver
    'SYSTEM_AUTO',        -- keputusan otomatis karena SLA habis
    'SYSTEM_ESCALATION',  -- dipindah otomatis ke step berikutnya
    'ADMIN_OVERRIDE'      -- intervensi admin
);

CREATE TYPE approver_type_enum AS ENUM (
    'DIRECT_MANAGER',     -- atasan langsung (employees.manager_id)
    'POSITION_LEVEL',     -- semua pegawai dengan level jabatan tertentu di dept pemohon
    'POSITION',           -- jabatan spesifik
    'DEPARTMENT_HEAD',    -- kepala departemen pemohon
    'SPECIFIC_EMPLOYEE',  -- orang tertentu
    'ROLE',               -- semua user dengan role tertentu (mis. HR_APPROVER)
    'HR_DEPARTMENT'       -- semua approver di departemen HR
);

CREATE TYPE approval_mode_enum AS ENUM (
    'ANY_ONE',   -- cukup satu approver bertindak
    'ALL',       -- semua kandidat harus approve
    'QUORUM'     -- minimal N approver
);

CREATE TYPE escalation_action_enum AS ENUM (
    'AUTO_APPROVE',        -- lewat SLA -> setujui step ini
    'AUTO_REJECT',         -- lewat SLA -> tolak
    'ESCALATE_NEXT_STEP',  -- lewat SLA -> lempar ke step berikutnya
    'ESCALATE_TO_STEP',    -- lewat SLA -> lempar ke step tertentu
    'NOTIFY_ADMIN_ONLY',   -- lewat SLA -> hanya notifikasi admin, tetap menunggu
    'KEEP_WAITING'         -- tidak ada aksi otomatis
);

CREATE TYPE rule_type_enum AS ENUM (
    'MAX_DAYS_PER_REQUEST',           -- params: {"max_days": 5}
    'MIN_DAYS_PER_REQUEST',           -- params: {"min_days": 1}
    'MAX_DAYS_PER_PERIOD',            -- params: {"max_days": 2, "period": "WEEK"}  (WEEK|MONTH|QUARTER|YEAR)
    'MAX_REQUESTS_PER_PERIOD',        -- params: {"max_requests": 2, "period": "MONTH"}
    'NO_CONSECUTIVE_DAYS',            -- params: {"min_gap_working_days": 1}
    'ALLOWED_WEEKDAYS',               -- params: {"weekdays": [2,3,4]}  (ISO: 1=Senin .. 7=Minggu)
    'MIN_NOTICE_DAYS',                -- params: {"min_notice_days": 3, "count": "CALENDAR"|"WORKING"}
    'MAX_BACKDATE_DAYS',              -- params: {"max_backdate_days": 2}
    'QUOTA_SUFFICIENT',               -- params: {}
    'ATTACHMENT_REQUIRED',            -- params: {"min_files": 1}
    'ATTACHMENT_REQUIRED_IF_DAYS_GTE',-- params: {"days": 2, "min_files": 1}
    'GENDER_RESTRICTION',             -- params: {"gender": "FEMALE"}
    'MIN_EMPLOYMENT_MONTHS',          -- params: {"months": 12}
    'EMPLOYMENT_STATUS_ALLOWED',      -- params: {"statuses": ["PERMANENT","CONTRACT"]}
    'ONCE_PER_EMPLOYMENT',            -- params: {}  (mis. cuti menikah)
    'MAX_PER_YEAR',                   -- params: {"max_days": 14}
    'NO_OVERLAP_REQUEST',             -- params: {}
    'BLACKOUT_PERIOD',                -- params: {"ranges":[{"from":"2026-12-24","to":"2027-01-02"}]}
    'MAX_CONCURRENT_TEAM_ON_LEAVE',   -- params: {"max_people": 2, "scope": "DEPARTMENT"}
    'CUSTOM_EXPRESSION'               -- params: {"expression": "..."} dievaluasi di layer aplikasi
);

CREATE TYPE rule_violation_action_enum AS ENUM (
    'BLOCK_SUBMIT',      -- tidak boleh dikirim sama sekali
    'AUTO_REJECT',       -- boleh dikirim, tapi saat batas waktu habis -> ditolak otomatis
    'REQUIRE_APPROVAL',  -- boleh dikirim, tidak boleh auto-approve (wajib keputusan manusia)
    'WARN_ONLY'          -- hanya peringatan
);

CREATE TYPE notification_channel_enum AS ENUM ('EMAIL', 'TELEGRAM', 'IN_APP');

CREATE TYPE notification_status_enum AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TYPE notification_event_enum AS ENUM (
    'REQUEST_SUBMITTED',
    'APPROVAL_TASK_ASSIGNED',
    'APPROVAL_REMINDER',
    'APPROVAL_ESCALATED',
    'STEP_APPROVED',
    'STEP_REJECTED',
    'REQUEST_APPROVED',
    'REQUEST_REJECTED',
    'REQUEST_AUTO_APPROVED',
    'REQUEST_AUTO_REJECTED',
    'REQUEST_CANCELLED',
    'REQUEST_EXPIRED',
    'DELEGATION_ASSIGNED',
    'QUOTA_LOW'
);

CREATE TYPE quota_txn_enum AS ENUM (
    'ALLOCATION', 'CARRY_OVER', 'RESERVATION', 'RELEASE', 'USAGE', 'ADJUSTMENT', 'EXPIRY'
);

CREATE TYPE audit_actor_enum AS ENUM ('USER', 'SYSTEM', 'ADMIN');

-- ---------------------------------------------------------------------
-- 2. FUNGSI UTILITAS + TRIGGER UMUM
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 3. MASTER ORGANISASI
-- ---------------------------------------------------------------------
CREATE TABLE departments (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code             varchar(30)  NOT NULL UNIQUE,
    name             varchar(150) NOT NULL,
    parent_id        uuid REFERENCES departments(id) ON DELETE SET NULL,
    head_employee_id uuid,  -- FK ditambahkan setelah tabel employees dibuat
    is_hr_department boolean NOT NULL DEFAULT false,
    is_active        boolean NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE departments IS 'Struktur organisasi / unit kerja, mendukung hierarki via parent_id';

CREATE TABLE positions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code       varchar(30)  NOT NULL UNIQUE,
    name       varchar(150) NOT NULL,
    level      smallint     NOT NULL,  -- 1 = staf, makin besar makin tinggi
    is_active  boolean      NOT NULL DEFAULT true,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT positions_level_chk CHECK (level BETWEEN 1 AND 10)
);
COMMENT ON COLUMN positions.level IS 'Dipakai approver_type=POSITION_LEVEL untuk approval bertingkat berbasis jabatan';

CREATE TABLE employees (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nip               varchar(30)  NOT NULL UNIQUE,
    full_name         varchar(150) NOT NULL,
    email             citext       NOT NULL UNIQUE,
    phone             varchar(30),
    telegram_chat_id  varchar(50),
    telegram_username varchar(60),
    gender            gender_enum,
    birth_date        date,
    department_id     uuid REFERENCES departments(id) ON DELETE SET NULL,
    position_id       uuid REFERENCES positions(id)   ON DELETE SET NULL,
    manager_id        uuid REFERENCES employees(id)   ON DELETE SET NULL,
    employment_status employment_status_enum NOT NULL DEFAULT 'PERMANENT',
    join_date         date NOT NULL,
    end_date          date,
    can_submit_request boolean NOT NULL DEFAULT true,  -- hak mengajukan perizinan (diatur admin)
    photo_url         text,
    is_active         boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    deleted_at        timestamptz,
    CONSTRAINT employees_manager_not_self CHECK (manager_id IS NULL OR manager_id <> id),
    CONSTRAINT employees_end_date_chk CHECK (end_date IS NULL OR end_date >= join_date)
);
CREATE INDEX idx_employees_department ON employees(department_id) WHERE is_active;
CREATE INDEX idx_employees_manager    ON employees(manager_id);
CREATE INDEX idx_employees_position   ON employees(position_id);

ALTER TABLE departments
    ADD CONSTRAINT fk_departments_head
    FOREIGN KEY (head_employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 4. AUTENTIKASI & OTORISASI (RBAC)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id          uuid UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
    username             citext NOT NULL UNIQUE,
    email                citext NOT NULL UNIQUE,
    password_hash        text   NOT NULL,
    must_change_password boolean NOT NULL DEFAULT false,
    is_active            boolean NOT NULL DEFAULT true,
    last_login_at        timestamptz,
    failed_login_count   smallint NOT NULL DEFAULT 0,
    locked_until         timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN users.employee_id IS 'NULL hanya untuk akun sistem/admin yang bukan pegawai';

CREATE TABLE roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(40)  NOT NULL UNIQUE,   -- EMPLOYEE | APPROVER | ADMIN | HR_APPROVER
    name        varchar(100) NOT NULL,
    description text,
    is_system   boolean NOT NULL DEFAULT false, -- role bawaan, tidak bisa dihapus admin
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(80)  NOT NULL UNIQUE,   -- mis. request.create, approval.act, admin.rule.manage
    name        varchar(150) NOT NULL,
    module      varchar(40)  NOT NULL,
    description text
);

CREATE TABLE role_permissions (
    role_id       uuid NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id             uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    scope_department_id uuid REFERENCES departments(id) ON DELETE CASCADE, -- opsional: role terbatas 1 dept
    assigned_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    assigned_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_sessions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    ip_address inet,
    user_agent text,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id) WHERE revoked_at IS NULL;

CREATE TABLE password_reset_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 5. JENIS PERIZINAN & KEBIJAKAN (RULE ENGINE)
-- ---------------------------------------------------------------------
CREATE TABLE leave_types (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 varchar(40)  NOT NULL UNIQUE,  -- CUTI_TAHUNAN, SAKIT, IZIN_TIDAK_MASUK, MENIKAH, MELAHIRKAN, WFA
    name                 varchar(150) NOT NULL,
    description          text,
    unit                 leave_unit_enum NOT NULL DEFAULT 'DAY',
    deducts_quota        boolean NOT NULL DEFAULT false,
    default_annual_quota numeric(5,1),
    requires_attachment  boolean NOT NULL DEFAULT false,
    gender_restriction   gender_enum,
    allow_half_day       boolean NOT NULL DEFAULT false,
    allow_backdate       boolean NOT NULL DEFAULT false,
    max_backdate_days    smallint NOT NULL DEFAULT 0,
    counts_working_days_only boolean NOT NULL DEFAULT true,
    color                varchar(9) NOT NULL DEFAULT '#64748B',
    icon                 varchar(40),
    sort_order           smallint NOT NULL DEFAULT 0,
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Siapa yang berhak mengajukan jenis izin tertentu (pengaturan admin).
-- Baris dengan employee_id terisi = override untuk 1 pegawai.
CREATE TABLE leave_type_eligibilities (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_type_id     uuid NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    employee_id       uuid REFERENCES employees(id) ON DELETE CASCADE,
    department_id     uuid REFERENCES departments(id) ON DELETE CASCADE,
    position_id       uuid REFERENCES positions(id) ON DELETE CASCADE,
    employment_status employment_status_enum,
    is_allowed        boolean NOT NULL DEFAULT true,
    note              text,
    created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eligibility_type ON leave_type_eligibilities(leave_type_id);
CREATE UNIQUE INDEX uq_eligibility_employee
    ON leave_type_eligibilities(leave_type_id, employee_id)
    WHERE employee_id IS NOT NULL;

CREATE TABLE leave_policies (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_type_id         uuid NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    name                  varchar(150) NOT NULL,
    version               smallint NOT NULL DEFAULT 1,
    effective_from        date NOT NULL DEFAULT CURRENT_DATE,
    effective_to          date,
    -- batas waktu keseluruhan pengajuan sebelum sistem mengambil keputusan otomatis
    overall_deadline_hours numeric(6,2) NOT NULL DEFAULT 24,
    deadline_uses_working_hours boolean NOT NULL DEFAULT true,
    on_deadline_action    escalation_action_enum NOT NULL DEFAULT 'AUTO_APPROVE',
    -- jika true: auto-approve hanya terjadi bila SEMUA rule lolos, jika ada yang gagal -> auto-reject
    auto_decision_requires_rule_pass boolean NOT NULL DEFAULT true,
    auto_reject_reason_template text NOT NULL DEFAULT
        'Pengajuan ditolak otomatis oleh sistem karena melewati batas waktu {{deadline_hours}} jam dan tidak memenuhi ketentuan: {{violated_rules}}',
    auto_approve_reason_template text NOT NULL DEFAULT
        'Disetujui otomatis oleh sistem karena melewati batas waktu {{deadline_hours}} jam tanpa tindakan approver, dan seluruh ketentuan {{leave_type_name}} terpenuhi.',
    is_active             boolean NOT NULL DEFAULT true,
    notes                 text,
    created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT leave_policies_period_chk CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT uq_leave_policies_version UNIQUE (leave_type_id, version),
    -- satu jenis izin hanya boleh punya satu kebijakan aktif pada rentang tanggal yang sama
    CONSTRAINT ex_leave_policies_active_period EXCLUDE USING gist (
        leave_type_id WITH =,
        daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
    ) WHERE (is_active)
);

CREATE TABLE leave_policy_rules (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id        uuid NOT NULL REFERENCES leave_policies(id) ON DELETE CASCADE,
    rule_code        varchar(60) NOT NULL,
    rule_type        rule_type_enum NOT NULL,
    params           jsonb NOT NULL DEFAULT '{}'::jsonb,
    violation_action rule_violation_action_enum NOT NULL DEFAULT 'BLOCK_SUBMIT',
    message_template text NOT NULL,
    evaluation_order smallint NOT NULL DEFAULT 100,
    is_active        boolean NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_policy_rule UNIQUE (policy_id, rule_code)
);
CREATE INDEX idx_policy_rules_policy ON leave_policy_rules(policy_id) WHERE is_active;
COMMENT ON COLUMN leave_policy_rules.params IS 'Parameter rule dalam JSON, bentuknya mengikuti rule_type (lihat komentar pada rule_type_enum)';

-- ---------------------------------------------------------------------
-- 6. KUOTA
-- ---------------------------------------------------------------------
CREATE TABLE leave_quotas (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id    uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id  uuid NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    period_year    smallint NOT NULL,
    allocated      numeric(6,1) NOT NULL DEFAULT 0,
    carried_over   numeric(6,1) NOT NULL DEFAULT 0,
    adjustment     numeric(6,1) NOT NULL DEFAULT 0,
    reserved       numeric(6,1) NOT NULL DEFAULT 0,  -- terpakai sementara oleh pengajuan yang masih berjalan
    used           numeric(6,1) NOT NULL DEFAULT 0,
    balance        numeric(6,1) GENERATED ALWAYS AS
                       (allocated + carried_over + adjustment - reserved - used) STORED,
    carry_over_expires_at date,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_leave_quota UNIQUE (employee_id, leave_type_id, period_year)
);

CREATE TABLE leave_quota_ledger (
    id            bigserial PRIMARY KEY,
    quota_id      uuid NOT NULL REFERENCES leave_quotas(id) ON DELETE CASCADE,
    request_id    uuid,  -- FK ditambahkan setelah leave_requests dibuat
    txn_type      quota_txn_enum NOT NULL,
    amount        numeric(6,1) NOT NULL,
    balance_after numeric(6,1) NOT NULL,
    note          text,
    created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quota_ledger_quota ON leave_quota_ledger(quota_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 7. KONFIGURASI ALUR APPROVAL BERTINGKAT
-- ---------------------------------------------------------------------
CREATE TABLE approval_workflows (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code              varchar(50) NOT NULL UNIQUE,
    name              varchar(150) NOT NULL,
    description       text,
    -- kriteria pencocokan; NULL = berlaku untuk semua
    leave_type_id     uuid REFERENCES leave_types(id) ON DELETE CASCADE,
    department_id     uuid REFERENCES departments(id) ON DELETE CASCADE,
    position_level_min smallint,
    position_level_max smallint,
    employment_status employment_status_enum,
    min_days          numeric(5,1),
    max_days          numeric(5,1),
    priority          smallint NOT NULL DEFAULT 100, -- angka kecil = dipilih lebih dulu saat matching
    version           smallint NOT NULL DEFAULT 1,
    effective_from    date NOT NULL DEFAULT CURRENT_DATE,
    effective_to      date,
    is_active         boolean NOT NULL DEFAULT true,
    created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT approval_workflows_period_chk CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT approval_workflows_days_chk   CHECK (max_days IS NULL OR min_days IS NULL OR max_days >= min_days)
);
CREATE INDEX idx_workflows_matching ON approval_workflows(leave_type_id, department_id, priority) WHERE is_active;

CREATE TABLE approval_workflow_steps (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id             uuid NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    step_order              smallint NOT NULL,
    name                    varchar(100) NOT NULL,
    approver_type           approver_type_enum NOT NULL,
    approver_position_id    uuid REFERENCES positions(id) ON DELETE SET NULL,
    approver_position_level smallint,
    approver_employee_id    uuid REFERENCES employees(id) ON DELETE SET NULL,
    approver_role_id        uuid REFERENCES roles(id) ON DELETE SET NULL,
    approval_mode           approval_mode_enum NOT NULL DEFAULT 'ANY_ONE',
    quorum_count            smallint,
    is_optional             boolean NOT NULL DEFAULT false,
    skip_if_requester       boolean NOT NULL DEFAULT true, -- lewati jika approver = pemohon
    skip_if_already_approved boolean NOT NULL DEFAULT true, -- lewati jika orang yang sama sudah approve di step sebelumnya
    condition_min_days      numeric(5,1),  -- step hanya aktif jika durasi >= nilai ini
    condition_expression    jsonb,
    -- SLA & pengingat
    sla_hours               numeric(6,2) NOT NULL DEFAULT 8,
    sla_uses_working_hours  boolean NOT NULL DEFAULT true,
    reminder_enabled        boolean NOT NULL DEFAULT true,
    reminder_interval_minutes integer NOT NULL DEFAULT 120,  -- default: tiap 2 jam
    reminder_max_count      smallint NOT NULL DEFAULT 5,
    reminder_only_working_hours boolean NOT NULL DEFAULT true,
    reminder_channels       notification_channel_enum[] NOT NULL DEFAULT '{EMAIL,TELEGRAM}'::notification_channel_enum[],
    -- tindakan jika SLA habis
    escalation_action       escalation_action_enum NOT NULL DEFAULT 'AUTO_APPROVE',
    escalate_to_step_order  smallint,
    escalation_notify_admin boolean NOT NULL DEFAULT true,
    allow_delegation        boolean NOT NULL DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_workflow_step UNIQUE (workflow_id, step_order),
    CONSTRAINT chk_step_order_positive CHECK (step_order > 0),
    CONSTRAINT chk_reminder_interval CHECK (reminder_interval_minutes >= 5),
    CONSTRAINT chk_quorum CHECK (approval_mode <> 'QUORUM' OR quorum_count >= 1),
    CONSTRAINT chk_escalate_target CHECK (
        escalation_action <> 'ESCALATE_TO_STEP' OR escalate_to_step_order IS NOT NULL
    ),
    CONSTRAINT chk_approver_reference CHECK (
        (approver_type = 'POSITION'          AND approver_position_id    IS NOT NULL) OR
        (approver_type = 'POSITION_LEVEL'    AND approver_position_level IS NOT NULL) OR
        (approver_type = 'SPECIFIC_EMPLOYEE' AND approver_employee_id    IS NOT NULL) OR
        (approver_type = 'ROLE'              AND approver_role_id        IS NOT NULL) OR
        (approver_type IN ('DIRECT_MANAGER', 'DEPARTMENT_HEAD', 'HR_DEPARTMENT'))
    )
);

-- Pendelegasian wewenang approval (mis. approver sedang cuti)
CREATE TABLE approval_delegations (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    delegator_employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    delegate_employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id         uuid REFERENCES leave_types(id) ON DELETE CASCADE,
    start_date            date NOT NULL,
    end_date              date NOT NULL,
    reason                text,
    is_active             boolean NOT NULL DEFAULT true,
    created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_delegation_period CHECK (end_date >= start_date),
    CONSTRAINT chk_delegation_different CHECK (delegator_employee_id <> delegate_employee_id)
);
CREATE INDEX idx_delegation_active ON approval_delegations(delegator_employee_id, start_date, end_date) WHERE is_active;

-- ---------------------------------------------------------------------
-- 8. PENGAJUAN PERIZINAN
-- ---------------------------------------------------------------------
CREATE SEQUENCE seq_leave_request_number START 1;

CREATE TABLE leave_requests (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number        varchar(30) NOT NULL UNIQUE,
    employee_id           uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    leave_type_id         uuid NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
    policy_id             uuid REFERENCES leave_policies(id) ON DELETE SET NULL,
    workflow_id           uuid REFERENCES approval_workflows(id) ON DELETE SET NULL,
    start_date            date NOT NULL,
    end_date              date NOT NULL,
    start_day_part        day_part_enum NOT NULL DEFAULT 'FULL_DAY',
    end_day_part          day_part_enum NOT NULL DEFAULT 'FULL_DAY',
    total_days            numeric(5,1) NOT NULL,
    working_days          numeric(5,1) NOT NULL,
    reason                text NOT NULL,
    address_during_leave  text,
    contact_phone         varchar(30),
    delegate_employee_id  uuid REFERENCES employees(id) ON DELETE SET NULL, -- pengganti tugas selama izin
    status                request_status_enum NOT NULL DEFAULT 'DRAFT',
    current_step_order    smallint,
    submitted_at          timestamptz,
    final_deadline_at     timestamptz,  -- batas waktu keputusan otomatis keseluruhan
    decided_at            timestamptz,
    decided_by            uuid REFERENCES employees(id) ON DELETE SET NULL,
    decision_source       action_source_enum,
    decision_reason       text,
    is_auto_decided       boolean NOT NULL DEFAULT false,
    cancelled_at          timestamptz,
    cancel_reason         text,
    rule_check_passed     boolean,
    rule_check_result     jsonb,       -- snapshot hasil evaluasi rule terakhir
    policy_snapshot       jsonb,       -- salinan kebijakan saat diajukan (audit-proof)
    workflow_snapshot     jsonb,       -- salinan alur approval saat diajukan
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_request_date_range CHECK (end_date >= start_date),
    CONSTRAINT chk_request_days_positive CHECK (total_days > 0),
    -- satu pegawai tidak boleh punya 2 izin aktif pada tanggal yang bertumpuk
    CONSTRAINT ex_request_no_overlap EXCLUDE USING gist (
        employee_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    ) WHERE (status IN ('SUBMITTED', 'IN_REVIEW', 'APPROVED'))
);
CREATE INDEX idx_requests_employee_status ON leave_requests(employee_id, status);
CREATE INDEX idx_requests_status_deadline ON leave_requests(status, final_deadline_at)
    WHERE status IN ('SUBMITTED', 'IN_REVIEW');
CREATE INDEX idx_requests_type_dates      ON leave_requests(leave_type_id, start_date, end_date);
CREATE INDEX idx_requests_created         ON leave_requests(created_at DESC);

ALTER TABLE leave_quota_ledger
    ADD CONSTRAINT fk_quota_ledger_request
    FOREIGN KEY (request_id) REFERENCES leave_requests(id) ON DELETE SET NULL;

-- Rincian per tanggal: dipakai rule NO_CONSECUTIVE_DAYS, ALLOWED_WEEKDAYS, kalender tim
CREATE TABLE leave_request_days (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id     uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    leave_date     date NOT NULL,
    day_part       day_part_enum NOT NULL DEFAULT 'FULL_DAY',
    day_value      numeric(3,1) NOT NULL DEFAULT 1.0,
    is_working_day boolean NOT NULL DEFAULT true,
    is_holiday     boolean NOT NULL DEFAULT false,
    CONSTRAINT uq_request_day UNIQUE (request_id, leave_date)
);
CREATE INDEX idx_request_days_date ON leave_request_days(leave_date);

CREATE TABLE leave_request_attachments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    file_name   varchar(255) NOT NULL,
    file_path   text NOT NULL,
    mime_type   varchar(100),
    size_bytes  bigint,
    uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_request ON leave_request_attachments(request_id);

-- Hasil evaluasi rule -> sumber "alasan" yang ditampilkan ke pegawai
CREATE TABLE leave_request_rule_checks (
    id               bigserial PRIMARY KEY,
    request_id       uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    rule_id          uuid REFERENCES leave_policy_rules(id) ON DELETE SET NULL,
    rule_code        varchar(60) NOT NULL,
    rule_type        rule_type_enum NOT NULL,
    passed           boolean NOT NULL,
    violation_action rule_violation_action_enum,
    message          text,
    context          jsonb NOT NULL DEFAULT '{}'::jsonb, -- nilai aktual vs batas, untuk audit
    evaluation_phase varchar(20) NOT NULL DEFAULT 'SUBMIT', -- SUBMIT | AUTO_DECISION | MANUAL_REVIEW
    evaluated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rule_checks_request ON leave_request_rule_checks(request_id, evaluated_at DESC);

-- ---------------------------------------------------------------------
-- 9. TUGAS APPROVAL (INSTANSI DARI SETIAP STEP)
-- ---------------------------------------------------------------------
CREATE TABLE approval_tasks (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id         uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    workflow_step_id   uuid REFERENCES approval_workflow_steps(id) ON DELETE SET NULL,
    step_order         smallint NOT NULL,
    step_name          varchar(100) NOT NULL,
    approval_mode      approval_mode_enum NOT NULL DEFAULT 'ANY_ONE',
    quorum_count       smallint,
    status             approval_task_status_enum NOT NULL DEFAULT 'WAITING',
    started_at         timestamptz,
    due_at             timestamptz,
    acted_at           timestamptz,
    acted_by           uuid REFERENCES employees(id) ON DELETE SET NULL,
    action_source      action_source_enum,
    action_note        text,
    reminder_count     smallint NOT NULL DEFAULT 0,
    last_reminder_at   timestamptz,
    next_reminder_at   timestamptz,
    escalated_from_task_id uuid REFERENCES approval_tasks(id) ON DELETE SET NULL,
    step_snapshot      jsonb,  -- salinan konfigurasi step (SLA, reminder, eskalasi)
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_task_step UNIQUE (request_id, step_order)
);
-- indeks utama untuk worker pengingat & eskalasi
CREATE INDEX idx_tasks_pending_reminder ON approval_tasks(next_reminder_at)
    WHERE status = 'PENDING';
CREATE INDEX idx_tasks_pending_due      ON approval_tasks(due_at)
    WHERE status = 'PENDING';
CREATE INDEX idx_tasks_request          ON approval_tasks(request_id, step_order);

CREATE TABLE approval_task_assignees (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         uuid NOT NULL REFERENCES approval_tasks(id) ON DELETE CASCADE,
    employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    is_delegate     boolean NOT NULL DEFAULT false,
    delegated_from  uuid REFERENCES employees(id) ON DELETE SET NULL,
    assigned_at     timestamptz NOT NULL DEFAULT now(),
    first_viewed_at timestamptz,
    responded_at    timestamptz,
    response        approval_task_status_enum,
    response_note   text,
    CONSTRAINT uq_task_assignee UNIQUE (task_id, employee_id),
    CONSTRAINT chk_assignee_response CHECK (response IS NULL OR response IN ('APPROVED', 'REJECTED'))
);
CREATE INDEX idx_assignee_employee ON approval_task_assignees(employee_id) WHERE responded_at IS NULL;

-- ---------------------------------------------------------------------
-- 10. RIWAYAT / TIMELINE APPROVAL (halaman riwayat awal s/d akhir)
-- ---------------------------------------------------------------------
CREATE TABLE approval_histories (
    id                 bigserial PRIMARY KEY,
    request_id         uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    task_id            uuid REFERENCES approval_tasks(id) ON DELETE SET NULL,
    step_order         smallint,
    step_name          varchar(100),
    actor_employee_id  uuid REFERENCES employees(id) ON DELETE SET NULL,
    actor_type         audit_actor_enum NOT NULL DEFAULT 'USER',
    action             varchar(40) NOT NULL,  -- CREATED|SUBMITTED|RULE_CHECKED|ASSIGNED|VIEWED|APPROVED|REJECTED|REMINDER_SENT|ESCALATED|AUTO_APPROVED|AUTO_REJECTED|DELEGATED|CANCELLED|EXPIRED
    from_status        request_status_enum,
    to_status          request_status_enum,
    note               text,
    reason             text,
    metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_histories_request ON approval_histories(request_id, created_at);
CREATE INDEX idx_histories_actor   ON approval_histories(actor_employee_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 11. NOTIFIKASI (EMAIL / TELEGRAM / IN-APP)
-- ---------------------------------------------------------------------
CREATE TABLE notification_templates (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code             varchar(80) NOT NULL UNIQUE,
    name             varchar(150) NOT NULL,
    event_type       notification_event_enum NOT NULL,
    channel          notification_channel_enum NOT NULL,
    target_audience  varchar(20) NOT NULL DEFAULT 'APPROVER', -- REQUESTER | APPROVER | ADMIN | HR
    -- scope opsional: template khusus jenis izin / step tertentu / approver tertentu
    leave_type_id    uuid REFERENCES leave_types(id) ON DELETE CASCADE,
    workflow_step_id uuid REFERENCES approval_workflow_steps(id) ON DELETE CASCADE,
    employee_id      uuid REFERENCES employees(id) ON DELETE CASCADE,
    locale           varchar(10) NOT NULL DEFAULT 'id-ID',
    subject_template text,
    body_template    text NOT NULL,
    parse_mode       varchar(20) NOT NULL DEFAULT 'HTML', -- HTML | MARKDOWN | TEXT (Telegram/Email)
    is_default       boolean NOT NULL DEFAULT false,
    is_active        boolean NOT NULL DEFAULT true,
    created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_target_audience CHECK (target_audience IN ('REQUESTER', 'APPROVER', 'ADMIN', 'HR'))
);
-- hanya boleh ada satu template default per (event, channel, audience)
CREATE UNIQUE INDEX uq_notification_template_default
    ON notification_templates(event_type, channel, target_audience)
    WHERE leave_type_id IS NULL AND workflow_step_id IS NULL AND employee_id IS NULL AND is_active;
CREATE INDEX idx_notification_template_lookup
    ON notification_templates(event_type, channel, leave_type_id) WHERE is_active;

-- Daftar placeholder yang tersedia, dipakai UI admin saat kustomisasi pesan
CREATE TABLE notification_template_variables (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    variable_key  varchar(60) NOT NULL UNIQUE,   -- mis. {{employee_name}}
    description   text NOT NULL,
    example_value text,
    applies_to    notification_event_enum[] NOT NULL DEFAULT '{}'::notification_event_enum[],
    sort_order    smallint NOT NULL DEFAULT 0
);

CREATE TABLE notification_preferences (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    channel     notification_channel_enum NOT NULL,
    event_type  notification_event_enum,   -- NULL = berlaku untuk semua event
    is_enabled  boolean NOT NULL DEFAULT true,
    quiet_hours_start time,
    quiet_hours_end   time,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_notif_pref_event
    ON notification_preferences(employee_id, channel, event_type)
    WHERE event_type IS NOT NULL;
CREATE UNIQUE INDEX uq_notif_pref_global
    ON notification_preferences(employee_id, channel)
    WHERE event_type IS NULL;

CREATE TABLE notifications (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         uuid REFERENCES notification_templates(id) ON DELETE SET NULL,
    event_type          notification_event_enum NOT NULL,
    channel             notification_channel_enum NOT NULL,
    recipient_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
    recipient_address   varchar(255) NOT NULL,   -- alamat email / telegram chat id
    subject             text,
    body                text NOT NULL,
    status              notification_status_enum NOT NULL DEFAULT 'QUEUED',
    attempt_count       smallint NOT NULL DEFAULT 0,
    max_attempts        smallint NOT NULL DEFAULT 3,
    scheduled_at        timestamptz NOT NULL DEFAULT now(),
    sent_at             timestamptz,
    failed_at           timestamptz,
    error_message       text,
    provider_message_id varchar(150),
    request_id          uuid REFERENCES leave_requests(id) ON DELETE CASCADE,
    task_id             uuid REFERENCES approval_tasks(id) ON DELETE CASCADE,
    dedupe_key          varchar(180),
    payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_queue ON notifications(status, scheduled_at) WHERE status IN ('QUEUED', 'FAILED');
CREATE INDEX idx_notifications_request ON notifications(request_id, created_at DESC);
CREATE UNIQUE INDEX uq_notifications_dedupe ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Notifikasi in-app (lonceng) agar tidak bergantung email/telegram
CREATE TABLE in_app_notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title       varchar(200) NOT NULL,
    body        text,
    url         text,
    event_type  notification_event_enum,
    request_id  uuid REFERENCES leave_requests(id) ON DELETE CASCADE,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inapp_unread ON in_app_notifications(employee_id, created_at DESC) WHERE read_at IS NULL;

-- ---------------------------------------------------------------------
-- 12. KALENDER KERJA, PENGATURAN SISTEM, AUDIT, JOB
-- ---------------------------------------------------------------------
CREATE TABLE working_hours (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week    smallint NOT NULL UNIQUE,  -- ISO 1=Senin .. 7=Minggu
    is_working_day boolean NOT NULL DEFAULT true,
    start_time     time NOT NULL DEFAULT '08:00',
    end_time       time NOT NULL DEFAULT '17:00',
    break_start    time,
    break_end      time,
    CONSTRAINT chk_dow CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_work_time CHECK (end_time > start_time)
);

CREATE TABLE holidays (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date   date NOT NULL UNIQUE,
    name           varchar(150) NOT NULL,
    type           varchar(20) NOT NULL DEFAULT 'NATIONAL', -- NATIONAL | JOINT_LEAVE | COMPANY
    deducts_quota  boolean NOT NULL DEFAULT false,          -- cuti bersama biasanya memotong kuota
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_holidays_date ON holidays(holiday_date);

CREATE TABLE system_settings (
    key         varchar(100) PRIMARY KEY,
    value       jsonb NOT NULL,
    value_type  varchar(20) NOT NULL DEFAULT 'string',
    group_name  varchar(40) NOT NULL DEFAULT 'general',
    description text,
    is_secret   boolean NOT NULL DEFAULT false,
    updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id            bigserial PRIMARY KEY,
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    actor_type    audit_actor_enum NOT NULL DEFAULT 'USER',
    action        varchar(60) NOT NULL,
    entity_type   varchar(60) NOT NULL,
    entity_id     uuid,
    old_values    jsonb,
    new_values    jsonb,
    ip_address    inet,
    user_agent    text,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);

CREATE TABLE job_executions (
    id              bigserial PRIMARY KEY,
    job_name        varchar(60) NOT NULL,   -- reminder-sweeper | escalation-sweeper | notification-dispatcher | quota-allocator
    started_at      timestamptz NOT NULL DEFAULT now(),
    finished_at     timestamptz,
    status          varchar(20) NOT NULL DEFAULT 'RUNNING', -- RUNNING | SUCCESS | FAILED
    processed_count integer NOT NULL DEFAULT 0,
    error_message   text,
    details         jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_job_exec_name ON job_executions(job_name, started_at DESC);

-- ---------------------------------------------------------------------
-- 13. TRIGGER updated_at
-- ---------------------------------------------------------------------
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'departments', 'positions', 'employees', 'users', 'roles',
        'leave_types', 'leave_policies', 'leave_policy_rules', 'leave_quotas',
        'approval_workflows', 'approval_workflow_steps', 'leave_requests',
        'approval_tasks', 'notification_templates', 'notification_preferences'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()', t, t);
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- 14. TRIGGER NOMOR PENGAJUAN: SAPP/2026/09/000123
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_generate_request_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
        NEW.request_number := 'SAPP/' || to_char(now(), 'YYYY/MM') || '/' ||
                              lpad(nextval('seq_leave_request_number')::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Catatan: trigger BEFORE INSERT dijalankan sebelum pengecekan NOT NULL,
-- jadi kolom request_number boleh tidak diisi oleh aplikasi.
CREATE TRIGGER trg_leave_requests_number
    BEFORE INSERT ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION fn_generate_request_number();

-- ---------------------------------------------------------------------
-- 15. FUNGSI BANTU KALENDER (hari kerja)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_is_working_day(p_date date)
RETURNS boolean AS $$
DECLARE
    v_is_work boolean;
BEGIN
    SELECT wh.is_working_day INTO v_is_work
    FROM working_hours wh
    WHERE wh.day_of_week = EXTRACT(ISODOW FROM p_date)::smallint;

    IF v_is_work IS NULL OR v_is_work = false THEN
        RETURN false;
    END IF;

    IF EXISTS (SELECT 1 FROM holidays h WHERE h.holiday_date = p_date) THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fn_count_working_days(p_start date, p_end date)
RETURNS integer AS $$
DECLARE
    v_count integer := 0;
    d date;
BEGIN
    FOR d IN SELECT generate_series(p_start, p_end, interval '1 day')::date LOOP
        IF fn_is_working_day(d) THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------------------
-- 16. VIEW PENDUKUNG UI
-- ---------------------------------------------------------------------

-- Timeline lengkap untuk halaman "Riwayat Approval"
CREATE OR REPLACE VIEW v_request_timeline AS
SELECT
    h.id,
    h.request_id,
    r.request_number,
    h.created_at,
    h.step_order,
    h.step_name,
    h.action,
    h.actor_type,
    h.actor_employee_id,
    COALESCE(e.full_name, 'SISTEM')        AS actor_name,
    p.name                                  AS actor_position,
    h.from_status,
    h.to_status,
    h.note,
    h.reason,
    h.metadata
FROM approval_histories h
JOIN leave_requests r  ON r.id = h.request_id
LEFT JOIN employees e  ON e.id = h.actor_employee_id
LEFT JOIN positions p  ON p.id = e.position_id;

-- Daftar tugas approval yang menunggu tindakan (untuk halaman approver)
CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT
    t.id                AS task_id,
    t.request_id,
    r.request_number,
    r.employee_id       AS requester_id,
    req.full_name       AS requester_name,
    d.name              AS requester_department,
    lt.code             AS leave_type_code,
    lt.name             AS leave_type_name,
    r.start_date,
    r.end_date,
    r.total_days,
    r.reason,
    t.step_order,
    t.step_name,
    t.status            AS task_status,
    t.started_at,
    t.due_at,
    t.reminder_count,
    t.next_reminder_at,
    a.employee_id       AS approver_id,
    a.is_delegate,
    (t.due_at < now())  AS is_overdue
FROM approval_tasks t
JOIN approval_task_assignees a ON a.task_id = t.id
JOIN leave_requests r          ON r.id = t.request_id
JOIN employees req             ON req.id = r.employee_id
LEFT JOIN departments d        ON d.id = req.department_id
JOIN leave_types lt            ON lt.id = r.leave_type_id
WHERE t.status = 'PENDING'
  AND a.responded_at IS NULL;

-- Ringkasan kuota pegawai
CREATE OR REPLACE VIEW v_employee_quota_summary AS
SELECT
    q.employee_id,
    e.full_name,
    lt.code  AS leave_type_code,
    lt.name  AS leave_type_name,
    q.period_year,
    q.allocated,
    q.carried_over,
    q.adjustment,
    q.reserved,
    q.used,
    q.balance
FROM leave_quotas q
JOIN employees e   ON e.id = q.employee_id
JOIN leave_types lt ON lt.id = q.leave_type_id;

-- =====================================================================
-- SELESAI 01_schema.sql
-- =====================================================================
