# Đặc tả triển khai Quản trị Hành vi Bán hàng 90 ngày

## 1) SQL tái cấu trúc Database

File SQL đầy đủ đã được tạo tại: [003_behavior_90d_schema.sql](file:///c:/quản%20lý%20bán%20hàng/be_sm/sql/init/003_behavior_90d_schema.sql)

Các bảng gồm:

- `weekly_configs`
- `behavior_checklist_logs`
- `mindset_logs`
- `sales_activity_reports`
- `end_of_day_logs`
- `belief_transformation_logs`

Mẫu 1 giữ nguyên dữ liệu hiện có trên bảng `journals` với các cột:

- `avoidance`
- `selfLimit`
- `earlyStop`
- `blaming`
- `reportDate`

## 2) API Mẫu 1 đã có sẵn

- Nhân viên nộp/cập nhật Mẫu 1:
  - `POST /journals/eform-awareness`
  - `POST /journals/form-1/daily-recognition` (alias mới, cùng logic)
- Quản lý thẩm định Mẫu 1:
  - `PATCH /evaluations/:journalId/awareness`
  - `PATCH /evaluations/:journalId/form-1/review` (alias mới, cùng logic)
- Body submit Mẫu 1:
  - `avoidance`, `selfLimit`, `earlyStop`, `blaming`, `reportDate?`

## 3) API Mẫu 2 - Thẩm định hành vi

### 3.1 Nhân viên gửi báo cáo hằng ngày

- `POST /behavior-checklist`
- Quyền: `EMPLOYEE`
- Body:

```json
{
  "logDate": "2026-04-08",
  "askedDeepQuestion": true,
  "fullConsultation": true,
  "followedThrough": false,
  "customerMetCount": 3,
  "employeeNotes": "Khách cân nhắc thêm"
}
```

- Xử lý:
  - Nếu đã có bản ghi `(user_id, log_date)` thì update phần nhân viên khai báo, reset `status='PENDING'`, xóa `manager_id`, `reviewed_at`, `manager_feedback`, `mgr_eval_*`.
  - Nếu chưa có thì insert mới với `status='PENDING'`.
  - Sau khi lưu: gửi notification Telegram/dashboard cho quản lý trực tiếp.

Pseudo-code:

```ts
function submitBehaviorChecklist(employeeId, dto) {
  record = repo.findOne({ userId: employeeId, logDate: dto.logDate })
  if (!record) {
    record = repo.create({
      userId: employeeId,
      logDate: dto.logDate,
      askedDeepQuestion: dto.askedDeepQuestion,
      fullConsultation: dto.fullConsultation,
      followedThrough: dto.followedThrough,
      customerMetCount: dto.customerMetCount,
      employeeNotes: dto.employeeNotes,
      status: 'PENDING'
    })
  } else {
    record.askedDeepQuestion = dto.askedDeepQuestion
    record.fullConsultation = dto.fullConsultation
    record.followedThrough = dto.followedThrough
    record.customerMetCount = dto.customerMetCount
    record.employeeNotes = dto.employeeNotes
    record.status = 'PENDING'
    record.managerId = null
    record.reviewedAt = null
    record.managerFeedback = null
    record.mgrEvalDeepQ = null
    record.mgrEvalFullCons = null
    record.mgrEvalFollow = null
  }
  saved = repo.save(record)
  notifyManager(saved)
  return saved
}
```

### 3.2 Quản lý xem danh sách báo cáo theo tuần

- `GET /behavior-checklist/review?weekId=<uuid>&status=PENDING|APPROVED|REJECTED&employeeId=<uuid>`
- Quyền: `MANAGER|ADMIN`
- Nguồn tuần: `weekly_configs.start_date/end_date`
- Trả về bản ghi + user info để đối soát.

Pseudo-code:

```ts
function listForManagerReview(manager, query) {
  week = weeklyConfigRepo.findById(query.weekId)
  qb = repo.createQueryBuilder('b')
    .leftJoinAndSelect('b.user', 'u')
    .where('b.logDate BETWEEN :start AND :end', { start: week.startDate, end: week.endDate })
  if (query.status) qb.andWhere('b.status = :status', { status: query.status })
  if (query.employeeId) qb.andWhere('b.userId = :employeeId', { employeeId: query.employeeId })
  if (manager.role === 'MANAGER') {
    qb.andWhere('u.unitId = :unitId', { unitId: manager.unitId })
  }
  return qb.orderBy('b.logDate', 'DESC').getMany()
}
```

### 3.3 Quản lý thẩm định lại (override)

- `PATCH /behavior-checklist/:id/review`
- Quyền: `MANAGER|ADMIN`
- Body:

```json
{
  "status": "APPROVED",
  "mgrEvalDeepQ": false,
  "mgrEvalFullCons": true,
  "mgrEvalFollow": true,
  "managerFeedback": "Cần hỏi sâu hơn ở bước nhu cầu"
}
```

- Luật:
  - Cho phép manager override độc lập từng tiêu chí `mgr_eval_*`.
  - `status` chỉ nhận `APPROVED|REJECTED`.
  - Ghi `manager_id`, `reviewed_at`.

Pseudo-code:

```ts
function reviewBehaviorChecklist(managerId, checklistId, dto) {
  record = repo.findById(checklistId)
  if (!record) throw NotFound
  record.status = dto.status
  record.mgrEvalDeepQ = dto.mgrEvalDeepQ
  record.mgrEvalFullCons = dto.mgrEvalFullCons
  record.mgrEvalFollow = dto.mgrEvalFollow
  record.managerFeedback = dto.managerFeedback
  record.managerId = managerId
  record.reviewedAt = now()
  saved = repo.save(record)
  notifyEmployee(saved)
  return saved
}
```

## 4) Logic Tổng hợp tuần (Mẫu 6)

- `GET /reports/weekly/behavior?weekId=<uuid>&employeeId=<uuid optional>`
- Quyền: `MANAGER|ADMIN`
- Dữ liệu tính KPI lấy từ kết quả manager ở các cột `mgr_eval_*`.

SQL tổng hợp:

```sql
WITH w AS (
  SELECT start_date, end_date
  FROM weekly_configs
  WHERE id = $1
),
base AS (
  SELECT
    b.user_id,
    b.customer_met_count,
    CASE WHEN b.status = 'APPROVED' AND b.mgr_eval_deep_q = TRUE THEN 1 ELSE 0 END AS pass_deep_q,
    CASE WHEN b.status = 'APPROVED' AND b.mgr_eval_full_cons = TRUE THEN 1 ELSE 0 END AS pass_full_cons,
    CASE WHEN b.status = 'APPROVED' AND b.mgr_eval_follow = TRUE THEN 1 ELSE 0 END AS pass_follow,
    1 AS total_logs
  FROM behavior_checklist_logs b
  JOIN w ON b.log_date BETWEEN w.start_date AND w.end_date
)
SELECT
  b.user_id,
  SUM(b.customer_met_count) AS total_customer_met,
  ROUND(100.0 * SUM(b.pass_deep_q) / NULLIF(SUM(b.total_logs), 0), 2) AS deep_question_completion_pct,
  ROUND(100.0 * SUM(b.pass_full_cons) / NULLIF(SUM(b.total_logs), 0), 2) AS full_consultation_completion_pct,
  ROUND(100.0 * SUM(b.pass_follow) / NULLIF(SUM(b.total_logs), 0), 2) AS followed_through_completion_pct
FROM base b
GROUP BY b.user_id
ORDER BY b.user_id;
```

Pseudo-code API:

```ts
function weeklyBehaviorSummary(weekId, employeeId?) {
  week = weeklyConfigRepo.findById(weekId)
  if (!week) throw NotFound
  data = repo.query(weeklyAggregateSql, [weekId, employeeId])
  return {
    weekId,
    startDate: week.startDate,
    endDate: week.endDate,
    items: data
  }
}
```

## 5) Notification bắt buộc

- Khi nhân viên submit Mẫu 2:
  - Gửi Telegram vào group quản lý đơn vị hoặc tạo task dashboard.
  - Nội dung tối thiểu: nhân viên, ngày, số khách gặp, link review.
- Khi quản lý review:
  - Gửi kết quả lại cho nhân viên (Telegram cá nhân hoặc dashboard).

## 6) Logic Frontend (Dashboard giai đoạn + đối soát)

### 6.1 Dashboard giai đoạn theo ngày tham gia

Pseudo-code:

```ts
function resolvePhaseForms(joinDate: string, today: string) {
  const joined = new Date(joinDate)
  const now = new Date(today)
  const dayNumber = Math.floor((now.getTime() - joined.getTime()) / 86400000) + 1

  if (dayNumber >= 1 && dayNumber <= 30) {
    return ['FORM_1', 'FORM_3', 'FORM_8']
  }
  if (dayNumber >= 31 && dayNumber <= 60) {
    return ['FORM_2', 'FORM_3', 'FORM_4']
  }
  return ['FORM_2', 'FORM_4', 'FORM_5', 'FORM_8']
}
```

### 6.2 Giao diện đối soát cho quản lý

- Sidebar: danh sách nhân viên cấp dưới theo đơn vị.
- Main: calendar tuần hiện tại, mỗi ô ngày hiển thị trạng thái Mẫu 2 (`PENDING/APPROVED/REJECTED`).
- Khi click một ngày:
  - Tải dữ liệu từ `GET /behavior-checklist/review?weekId=...&employeeId=...`.
  - Hiển thị checkbox từng tiêu chí và ô phản hồi.
  - Submit `PATCH /behavior-checklist/:id/review`.
