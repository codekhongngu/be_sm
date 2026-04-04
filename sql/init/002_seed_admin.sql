INSERT INTO units (code, name, "telegramGroupChatId", "isActive")
VALUES ('SYSTEM', 'Khối hệ thống', NULL, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (username, password, "fullName", "unitId", role, "telegramChatId")
SELECT
  'admin',
  '$2b$10$s/QjZgv5LYkReX1Smya9DOLEMu039xUZWSuyG2hluSXCoh.haUHP6',
  'System Admin',
  u.id,
  'ADMIN',
  NULL
FROM units u
WHERE u.code = 'SYSTEM'
ON CONFLICT (username) DO NOTHING;
