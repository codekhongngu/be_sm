const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const fileArg = process.argv[2];

if (!fileArg) {
  process.stderr.write('Thiếu đường dẫn file SQL\n');
  process.exit(1);
}

const sqlPath = path.resolve(process.cwd(), fileArg);

if (!fs.existsSync(sqlPath)) {
  process.stderr.write(`Không tìm thấy file SQL: ${sqlPath}\n`);
  process.exit(1);
}

const normalizeEnvValue = (value = '') => {
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const databaseUrl = normalizeEnvValue(process.env.DATABASE_URL || '');
const dbSsl = process.env.DB_SSL === 'true';
const requireSsl = dbSsl || /sslmode=require/i.test(databaseUrl);

const clientConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ...(requireSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'sales_behavior',
      ...(requireSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };

async function run() {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client(clientConfig);
  try {
    await client.connect();
    await client.query(sql);
    process.stdout.write(`Đã chạy SQL thành công: ${fileArg}\n`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  if (error?.code === 'ENOTFOUND') {
    process.stderr.write(
      `Chạy SQL thất bại (${fileArg}): Không phân giải được host DB. Kiểm tra DATABASE_URL/DB_HOST và bỏ dấu nháy thừa.\n`,
    );
    process.exit(1);
  }
  process.stderr.write(`Chạy SQL thất bại (${fileArg}): ${error.message}\n`);
  process.exit(1);
});
