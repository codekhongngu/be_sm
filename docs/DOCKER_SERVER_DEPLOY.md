# Hướng dẫn triển khai server bằng Docker

Tài liệu này hướng dẫn chạy backend `sm-backend` trên VPS/server Linux bằng Docker, phù hợp cho môi trường production.

## 1) Chuẩn bị server

- Ubuntu 22.04/24.04 hoặc Linux tương đương
- CPU 2 vCPU+, RAM 2GB+ (khuyến nghị 4GB)
- Đã mở cổng dịch vụ (ví dụ `3000` hoặc sau reverse proxy là `80/443`)

Cài Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Đăng nhập lại SSH sau khi thêm user vào group `docker`.

## 2) Lấy source và tạo file môi trường

```bash
git clone <repo-url> sm-backend
cd sm-backend
cp .env.example .env.production
```

Chỉnh `.env.production`:

- `PORT=3000`
- `JWT_SECRET=<secret-mạnh>`
- `DB_*` hoặc `DATABASE_URL`
- `DB_SYNC=false` cho production
- `APP_BASE_URL=https://domain-cua-ban`
- `FE_ORIGIN=https://domain-frontend-cua-ban`
- `TELEGRAM_BOT_TOKEN=<token-thật>`

Ví dụ tạo nhanh file `.env.production` bằng lệnh:

```bash
cat > .env.production << 'EOF'
PORT=3000
APP_BASE_URL=https://api.example.com
FE_ORIGIN=https://app.example.com
VITE_API_BASE_URL=https://api.example.com

DB_HOST=sm-postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=sales_behavior
DB_SYNC=false
DATABASE_URL=

JWT_SECRET=change_me_super_secret
JWT_EXPIRES_IN=1d

TELEGRAM_BOT_TOKEN=
EOF
```

Nếu bạn dùng DB cloud qua URL, dùng mẫu này:

```bash
cat > .env.production << 'EOF'
PORT=3000
APP_BASE_URL=https://api.example.com
FE_ORIGIN=https://app.example.com
VITE_API_BASE_URL=https://api.example.com

DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
DB_SSL=true
DB_SYNC=false

JWT_SECRET=change_me_super_secret
JWT_EXPIRES_IN=1d

TELEGRAM_BOT_TOKEN=
EOF
```

## 3) Chạy PostgreSQL bằng Docker (nếu chưa có DB ngoài)

Tạo network:

```bash
docker network create sm-net
```

Chạy PostgreSQL:

```bash
docker run -d \
  --name sm-postgres \
  --network sm-net \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sales_behavior \
  -v sm-postgres-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:16
```

Nếu dùng cách này, cập nhật `.env.production`:

- `DB_HOST=sm-postgres`
- `DB_PORT=5432`
- `DB_USER=postgres`
- `DB_PASSWORD=postgres`
- `DB_NAME=sales_behavior`
- Bỏ `DATABASE_URL` hoặc để rỗng

## 4) Build image backend

```bash
docker build -t sm-backend:latest .
```

## 5) Chạy backend container

```bash
docker run -d \
  --name sm-backend \
  --network sm-net \
  --env-file .env.production \
  -p 3000:3000 \
  --restart unless-stopped \
  sm-backend:latest
```

Thiết lập biến môi trường trực tiếp bằng `-e` (không dùng file env):

```bash
docker run -d \
  --name sm-backend \
  --network sm-net \
  -e PORT=3000 \
  -e APP_BASE_URL=https://api.example.com \
  -e FE_ORIGIN=https://app.example.com \
  -e DB_HOST=sm-postgres \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=sales_behavior \
  -e DB_SYNC=false \
  -e JWT_SECRET=change_me_super_secret \
  -e JWT_EXPIRES_IN=1d \
  -e TELEGRAM_BOT_TOKEN= \
  -p 3000:3000 \
  --restart unless-stopped \
  sm-backend:latest
```

## 6) Kiểm tra hoạt động

```bash
docker ps
docker logs -f sm-backend
curl http://127.0.0.1:3000/
```

## 7) Khởi tạo dữ liệu lần đầu (tùy chọn)

Nếu cần seed schema/admin:

```bash
docker exec -it sm-backend node -r dotenv/config scripts/run-sql.js sql/init/001_init_schema.sql dotenv_config_path=.env.production
docker exec -it sm-backend node -r dotenv/config scripts/run-sql.js sql/init/002_seed_admin.sql dotenv_config_path=.env.production
```

Nếu container không có thư mục `sql` do image chỉ copy `dist`, chạy script seed từ host bằng Node local hoặc thực hiện trực tiếp trong DB.

## 8) Cập nhật phiên bản

```bash
git pull
docker build -t sm-backend:latest .
docker stop sm-backend
docker rm sm-backend
docker run -d \
  --name sm-backend \
  --network sm-net \
  --env-file .env.production \
  -p 3000:3000 \
  --restart unless-stopped \
  sm-backend:latest
```

## 9) Rollback nhanh

Tag image trước khi deploy:

```bash
docker tag sm-backend:latest sm-backend:backup
```

Khi cần rollback:

```bash
docker stop sm-backend
docker rm sm-backend
docker run -d \
  --name sm-backend \
  --network sm-net \
  --env-file .env.production \
  -p 3000:3000 \
  --restart unless-stopped \
  sm-backend:backup
```

## 10) Khuyến nghị production

- Dùng Nginx/Caddy làm reverse proxy + HTTPS (Let's Encrypt)
- Không commit file `.env.production`
- Dùng mật khẩu DB mạnh và giới hạn IP truy cập DB
- Tắt `DB_SYNC` ở production
- Theo dõi log bằng `docker logs` hoặc stack giám sát riêng
