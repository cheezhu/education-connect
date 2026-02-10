# Studio API（v0）

> 控制面：创建 run、查询 run、日志回调、产物下载。
> 
> 端口：8090（Tailscale-only）
> 
> 鉴权：复用 education-connect BasicAuth（方案 A）。

## Run 状态

- `queued`：已创建，等待 executor
- `running`：OpenClaw 正在执行
- `success`：成功产出结果
- `failed`：执行失败（含错误信息）

## 1) 创建 run

`POST /runs`

请求体（示例）：
```json
{
  "scope": { "startDate": "2026-07-01", "endDate": "2026-07-15", "groupIds": [21, 22] },
  "rules": {
    "timeSlots": ["MORNING", "AFTERNOON"],
    "balanceThreshold1": 0.7,
    "balanceThreshold2": 0.9,
    "weightRepeat": 1000,
    "weightBalanceT1": 2,
    "weightBalanceT2": 6,
    "weightMissing": 1,
    "locationPreferences": {
      "8": {
        "consolidateMode": "BY_DAY",
        "targetSlot": "MORNING",
        "targetSlotMode": "SOFT",
        "consolidateWeight": 80,
        "wrongSlotPenalty": 30
      }
    }
  }
}
```

响应：
```json
{ "runId": "run_20260209_xxx" }
```

## 2) 查询 run

`GET /runs/:runId`

返回：
- status
- createdAt/startedAt/finishedAt
- logs（尾部 N 行）
- summary（可选）
- artifacts 列表

## 3) 写入日志（executor 回调）

`POST /runs/:runId/logs`

```json
{ "lines": ["..."] }
```

## 4) 完成回调（executor 回调）

`POST /runs/:runId/complete`

```json
{
  "status": "success",
  "summary": {
    "repeats": 0,
    "overT1": 0,
    "overT2": 0,
    "missing": 0,
    "consolidationViolations": 0
  },
  "artifacts": [
    { "name": "planning_input.json", "path": "/.../planning_input.json", "sha256": "..." },
    { "name": "result.json", "path": "/.../result.json", "sha256": "..." },
    { "name": "report.json", "path": "/.../report.json", "sha256": "..." }
  ]
}
```

## 5) 下载 artifacts

`GET /runs/:runId/artifacts/:name`

- `name` ∈ {`planning_input.json`, `result.json`, `report.json`, `run.log`}

## 备注

- artifacts 永久保留（v0）。后续可加：配额、TTL、手动清理。
