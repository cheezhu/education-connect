# 每日资源数据治理手册（先录入，后清理）

## 1. 目标

- 先保证录入效率：前端尽量允许输入，减少阻塞。
- 后置统一治理：按固定节奏清洗和标准化数据库。
- 全程可回滚：每次清洗前必须有快照。

这份手册用于团组管理里的“每日资源表”及其关联数据。

## 2. 适用范围（数据库）

- `group_logistics_days`
- `group_logistics_meals`
- `group_logistics_transfers`
- `resource_hotels`
- `resource_people`
- `resource_vehicles`
- `schedules`（与每日卡映射）

## 3. 规则表（v1）

| 字段 | 录入策略 | 标准化规则 | 异常处理 |
|---|---|---|---|
| `city` | 下拉建议 + 手填 | 城市候选默认：香港/澳门/深圳/珠海；同义词合并到标准值 | 非四城值保留原文，进入“待确认”清单 |
| `hotel_name` / `hotel_address` | 下拉建议 + 手填 | 命中资源库时名称地址双向联动 | 联动失败不覆盖用户输入 |
| 餐厅名（早餐/午餐/晚餐） | 下拉建议 + 手填 | 去首尾空格，合并连续空格 | 空值允许 |
| 餐厅地址（早餐/午餐/晚餐） | 下拉建议 + 手填 | 去首尾空格，合并连续空格 | 空值允许 |
| 接送时间 `start_time` | 下拉建议 + 手填 | 统一 `HH:mm`，中文冒号转英文冒号 | 不合法格式进入异常清单 |
| 航班/车次 `flight_no` | 手填 + 建议 | 大写化，去空格 | 不合法进入异常清单 |
| 电话（司机/导游/安保） | 手填 | 去首尾空格，保留 `+ - ()` | 不合法进入异常清单 |
| 车牌 `vehicle_plate` | 手填 | 大写化，去多余空格 | 不合法进入异常清单 |
| 任意文本 | 手填 | 清理 `[object Object]`、`null` 字符串 | 自动置空并记录 |

## 4. 执行节奏

- 日常：只录入，不清洗。
- 每周：1 次 `dry-run`（只检查，不写库）。
- 上线前：1 次完整清洗（有备份）。
- 清洗后：抽样检查 10 个团组。

## 5. 标准执行流程（Checklist）

### 5.1 备份快照（必须）

```powershell
cd C:\Users\beney\Desktop\education-connect
if (!(Test-Path "trip-manager\\backend\\db\\backup")) { New-Item -ItemType Directory -Path "trip-manager\\backend\\db\\backup" | Out-Null }
Copy-Item "trip-manager\\backend\\db\\trip.db" ("trip-manager\\backend\\db\\backup\\trip-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".db")
```

### 5.2 运行 dry-run（只检查）

使用 SQLite 客户端或脚本执行以下检查 SQL。

1) 检查疑似脏值：

```sql
SELECT 'days.city' AS field, city AS value, COUNT(*) AS cnt
FROM group_logistics_days
WHERE city IS NOT NULL AND TRIM(city) <> ''
GROUP BY city
ORDER BY cnt DESC;

SELECT 'object-object' AS field, COUNT(*) AS cnt
FROM group_logistics_days
WHERE hotel_name = '[object Object]'
   OR hotel_address = '[object Object]'
   OR guide_name = '[object Object]'
   OR security_name = '[object Object]';
```

2) 检查时间格式（接送站）：

```sql
SELECT day_id, transfer_type, start_time
FROM group_logistics_transfers
WHERE start_time IS NOT NULL
  AND TRIM(start_time) <> ''
  AND start_time NOT GLOB '[0-2][0-9]:[0-5][0-9]';
```

3) 检查城市是否在候选集：

```sql
SELECT city, COUNT(*) AS cnt
FROM group_logistics_days
WHERE city IS NOT NULL
  AND TRIM(city) <> ''
  AND city NOT IN ('香港','澳门','深圳','珠海')
GROUP BY city
ORDER BY cnt DESC;
```

### 5.3 业务确认

- 把 dry-run 结果发给业务负责人确认：
  - 需要强制修正的项
  - 允许保留原值的项

### 5.4 执行清洗（写库）

- 先小范围（1~2 个团组）验证。
- 再全量执行。
- 执行后立即记录“影响行数”。

## 6. 回滚步骤

### 6.1 数据库文件回滚（最快）

1. 停止后端服务。  
2. 用备份覆盖当前库：

```powershell
Copy-Item "trip-manager\\backend\\db\\backup\\trip-YYYYMMDD-HHMMSS.db" "trip-manager\\backend\\db\\trip.db" -Force
```

3. 启动后端并验证页面。

### 6.2 版本快照回滚（可选）

- 若系统版本管理可用，也可通过版本恢复到清洗前快照。

## 7. 变更记录模板（每次必填）

```text
日期：
执行人：
规则版本：v1
执行类型：dry-run / full-run
影响团组数：
影响行数（days / meals / transfers）：
异常项数量：
是否回滚：否/是（原因）
备注：
```

## 8. 上线建议（当前阶段）

- 保持“宽进严存”策略：前端建议输入，不强制高门槛。
- 每周固定清洗，先稳定数据质量，再逐步提高字段约束。
- 在没有回滚快照的情况下，禁止执行全量清洗。

