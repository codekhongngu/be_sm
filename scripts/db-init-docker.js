const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dbUser = process.env.DB_USER || 'postgres';
const dbName = process.env.DB_NAME || 'sales_behavior';

const sqlFiles = ['sql/init/001_init_schema.sql', 'sql/init/002_seed_admin.sql'];

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    ...options,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} thất bại với mã ${result.status}`);
  }
};

const runSqlFile = (relativePath) => {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Không tìm thấy file SQL: ${relativePath}`);
  }
  const sql = `SET client_encoding = 'UTF8';\n${fs.readFileSync(absolutePath, 'utf8')}`;
  run(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      '-e',
      'PGCLIENTENCODING=UTF8',
      'postgres',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      dbUser,
      '-d',
      dbName,
    ],
    {
      input: Buffer.from(sql, 'utf8'),
    },
  );
  process.stdout.write(`Đã chạy SQL: ${relativePath}\n`);
};

const fixVietnameseSeed = () => {
  const sql = `
SET client_encoding = 'UTF8';
UPDATE units
SET name = 'Khối hệ thống'
WHERE code = 'SYSTEM';
`;
  run(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      '-e',
      'PGCLIENTENCODING=UTF8',
      'postgres',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      dbUser,
      '-d',
      dbName,
    ],
    {
      input: Buffer.from(sql, 'utf8'),
    },
  );
  process.stdout.write('Đã sửa dữ liệu tiếng Việt seed (units.SYSTEM)\n');
};

try {
  run('docker', ['compose', 'up', '-d', 'postgres']);
  sqlFiles.forEach(runSqlFile);
  fixVietnameseSeed();
  process.stdout.write('Hoàn tất db:init:docker\n');
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
