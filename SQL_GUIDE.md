# Thông tin bảng và hướng dẫn chạy lệnh SQL

## 1) Vị trí file SQL

- File khởi tạo schema: `sql/init/001_init_schema.sql`
- File seed admin: `sql/init/002_seed_admin.sql`
- File này được Postgres chạy tự động khi khởi tạo database mới trong Docker Compose.

## 1.1) Tài khoản admin mặc định

- `username`: `admin`
- `password`: `Admin@123`

## 2) Thông tin các bảng

### Bảng `units`

- `id` (uuid, PK, default `gen_random_uuid()`)
- `code` (varchar, unique, not null)
- `name` (varchar, not null)
- `telegramGroupChatId` (varchar, nullable)
- `parentUnitId` (uuid, FK -> units.id, nullable)
- `isActive` (boolean, default true)

### Bảng `users`

- `id` (uuid, PK, default `gen_random_uuid()`)
- `username` (varchar, unique, not null)
- `password` (varchar, not null)
- `fullName` (varchar, not null)
- `unitId` (uuid, FK -> `units.id`, not null)
- `role` (enum `users_role_enum`: `EMPLOYEE | MANAGER | ADMIN`, default `EMPLOYEE`)
- `telegramChatId` (varchar, nullable)

### Bảng `journals`

- `id` (uuid, PK, default `gen_random_uuid()`)
- `userId` (uuid, FK -> `users.id`, not null, `ON DELETE CASCADE`)
- `createdAt` (timestamptz, default `now()`)
- `avoidance` (boolean, default false)
- `selfLimit` (boolean, default false)
- `earlyStop` (boolean, default false)
- `blaming` (boolean, default false)
- `standardsKept` (text[], default `{}`)
- `declineSigns` (text, nullable)
- `solution` (text, nullable)
- Index:
  - `idx_journals_user_id` trên cột `userId`
  - `idx_journals_created_at` trên cột `createdAt`

### Bảng `journal_high_income_eforms`

- `id` (uuid, PK, default `gen_random_uuid()`)
- `journalId` (uuid, unique, FK -> `journals.id`, `ON DELETE CASCADE`)
- `keptStandardsAnswer` (text, not null)
- `declineSignsAnswer` (text, not null)
- `handlingPlanAnswer` (text, not null)
- `createdAt` (timestamptz, default `now()`)
- `updatedAt` (timestamptz, default `now()`)
- Index:
  - `idx_high_income_eforms_journal_id` trên cột `journalId`

### Bảng `evaluations`

- `id` (uuid, PK, default `gen_random_uuid()`)
- `journalId` (uuid, unique, FK -> `journals.id`, `ON DELETE CASCADE`)
- `managerId` (uuid, FK -> `users.id`, `ON DELETE RESTRICT`)
- `scores` (jsonb, not null)
- `coachingNote` (text, nullable)
- `createdAt` (timestamptz, default `now()`)
- Index:
  - `idx_evaluations_manager_id` trên cột `managerId`

### Bảng `catalog_items`

- `id` (uuid, PK, default `gen_random_uuid()`)
- `code` (varchar, unique, not null)
- `name` (varchar, not null)
- `description` (text, nullable)
- `price` (numeric(12,2), default 0)
- `isActive` (boolean, default true)
- `createdAt` (timestamptz, default `now()`)
- `updatedAt` (timestamptz, default `now()`)

## 3) Chạy SQL bằng Docker (khuyến nghị)

### Tạo database + chạy init tự động

```bash
docker compose down -v
docker compose up -d
```

### Chạy lại file SQL thủ công trong container Postgres

```bash
docker compose exec -T postgres psql -U postgres -d sales_behavior -f /docker-entrypoint-initdb.d/001_init_schema.sql
docker compose exec -T postgres psql -U postgres -d sales_behavior -f /docker-entrypoint-initdb.d/002_seed_admin.sql
```

## 4) Chạy SQL bằng psql local

### Chạy file init

```bash
psql -h localhost -p 5432 -U postgres -d sales_behavior -f sql/init/001_init_schema.sql
psql -h localhost -p 5432 -U postgres -d sales_behavior -f sql/init/002_seed_admin.sql
```

### Kiểm tra danh sách bảng

```bash
psql -h localhost -p 5432 -U postgres -d sales_behavior -c "\dt"
```

### Xem cấu trúc từng bảng

```bash
psql -h localhost -p 5432 -U postgres -d sales_behavior -c "\d users"
psql -h localhost -p 5432 -U postgres -d sales_behavior -c "\d units"
psql -h localhost -p 5432 -U postgres -d sales_behavior -c "\d journals"
psql -h localhost -p 5432 -U postgres -d sales_behavior -c "\d journal_high_income_eforms"
psql -h localhost -p 5432 -U postgres -d sales_behavior -c "\d evaluations"
psql -h localhost -p 5432 -U postgres -d sales_behavior -c "\d catalog_items"
```

## 5) Một số truy vấn kiểm tra nhanh

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM units;
SELECT COUNT(*) FROM journals;
SELECT COUNT(*) FROM journal_high_income_eforms;
SELECT COUNT(*) FROM evaluations;
SELECT COUNT(*) FROM catalog_items;
```
