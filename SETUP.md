# Hướng dẫn build source bằng Docker

## 1) Chuẩn bị biến môi trường

- Có thể dùng mặc định trong `docker-compose.yml`, hoặc sao chép `.env.example` thành `.env`
- Khuyến nghị cấu hình:
  - `JWT_SECRET`
  - `TELEGRAM_BOT_TOKEN`
  - `APP_BASE_URL`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`

## 2) Build image backend

```bash
docker compose build backend
```

## 3) Chạy toàn bộ hệ thống

```bash
docker compose up -d
```

Hệ thống sẽ chạy:
- Backend API tại `http://localhost:3000`
- Frontend tại `http://localhost:5173`
- PostgreSQL tại `localhost:5432`
- SQL khởi tạo bảng nằm trong thư mục `sql/init` và được Postgres tự chạy khi tạo database lần đầu

## 4) Theo dõi log và kiểm tra trạng thái

```bash
docker compose ps
docker compose logs -f backend
```

## 5) Dừng hệ thống

```bash
docker compose down
```

Nếu muốn xóa cả volume dữ liệu PostgreSQL:

```bash
docker compose down -v
```

## 6) Chạy lại script SQL tạo bảng

- Script hiện tại: `sql/init/001_init_schema.sql`, `sql/init/002_seed_admin.sql`
- Lưu ý: thư mục `docker-entrypoint-initdb.d` chỉ chạy khi database khởi tạo mới
- Nếu bạn đã chạy trước đó và muốn chạy lại script init:

```bash
docker compose down -v
docker compose up -d
```

## 7) Tài khoản admin mặc định

- Username: `admin`
- Password: `Admin@123`

## 8) Chạy source dưới local (1 source monorepo)

Cấu trúc hiện tại đã gộp trong cùng 1 source:
- Backend API: thư mục gốc `SM`
- Frontend FE-CME: thư mục con `SM/fe-cme`

### Backend (SM API)

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run start:dev
```

### Frontend (fe-cme)

```bash
cd fe-cme
npm install
cp .env.example .env
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`, gọi API backend `http://localhost:3000`.

### Chạy cả 2 cùng lúc từ root

```bash
npm run dev:all
```

### Frontend mới theo scaffold (frontend/)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Hoặc chạy từ root:

```bash
npm run frontend:install
npm run dev:new-frontend
```

Lệnh build và chạy production local:

```bash
npm run build
npm run start:prod
```

Build cả backend + frontend:

```bash
npm run build:all
```

## 9) API chính

- `POST /auth/register`
- `POST /auth/login`
- `POST /journals`
- `GET /journals`
- `GET /journals/:id`
- `POST /evaluations`
- `PATCH /evaluations/:journalId`
- `PATCH /evaluations/:journalId/awareness`
- `PATCH /evaluations/:journalId/standards`
- `GET /evaluations/pending/list`
- `GET /evaluations/analytics/weekly`
- `GET /dashboard/metrics`
- `GET /catalogs`
- `POST /catalogs`
- `PATCH /catalogs/:id`
- `PATCH /catalogs/:id/deactivate`
- `GET /users`
- `POST /users`
- `PUT /users/:id`
- `PATCH /users/:id`
- `PATCH /users/me/change-password`
- `PATCH /users/:id/reset-password`
- `PATCH /users/:id/role`
- `PATCH /users/:id/unit`
- `GET /users/units`
- `POST /users/units`
- `PATCH /users/units/:id`
- `DELETE /users/units/:id`
- `POST /users/import-excel`

## 10) Giao diện web theo vai trò

- Giao diện theo cấu trúc FE-CME: `http://localhost:5173`
- Route chính:
  - `/auth/login`
  - `/system-administration/users`
  - `/management/catalogs`
