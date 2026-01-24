﻿# AI 排期能力说明

AI 路由文件：`trip-manager/backend/src/routes/aiPlanner.js`

## 环境变量
- `AI_api_key`：必填才会真正调用模型
- `AI_PROVIDER`：openai / gemini（默认 openai）
- `AI_MODEL`：默认 gpt-4.1 或 gemini-1.5-pro-latest
- `AI_TIMEOUT_MS`：默认 25000ms

> 若 system_config 中存在 `ai_api_key` / `ai_provider` / `ai_model` / `ai_timeout_ms`，将优先生效。

## AI 规则配置
- GET `/ai/rules`：读取
- PUT `/ai/rules`：保存
- 存储于 system_config（key: ai_schedule_rules）

默认规则：
- timeSlots: MORNING / AFTERNOON
- slotWindows: MORNING(9-12), AFTERNOON(14-17), EVENING(19-21)
- requireAllPlanItems: false
- maxItemsPerGroup: 8

## 多团组全局排期（/ai/plan/global）
输入：groupIds, startDate, endDate, timeSlots, planNamePrefix, replaceExisting, useAI, dryRun
流程：
1) 读取团组与地点数据
2) 构建日期范围
3) 统计已有使用量（容量）
4) 可选：调用 AI 获取地点偏好（preferences）
5) 按容量与可用性分配地点
6) dryRun 返回预览
7) 非 dryRun：
   - 删除原活动/日程（replaceExisting=true 时）
   - 为每个团组创建 itinerary_plan + items
   - 插入 schedules 与 activities
   - 绑定 group.itinerary_plan_id

## 单团组方案排期（/ai/plan/itinerary）
输入：groupId, planId（可选）
流程：
1) 加载方案地点列表
2) 读取现有 schedules，避免时间重叠
3) 可选 AI 提示优先日期/时段
4) 逐个地点安排时段与日期
5) 插入 schedules + activities
6) 写入历史记录（system_config: ai_itinerary_history）

## 地点可用性判断
- blocked_weekdays
- closed_dates
- open_hours (JSON)
- target_groups
- capacity

## 注意
- 若运行 Node 16，需要依赖 `undici` 提供 fetch（已在后端依赖中补充）
- 未提供 API Key 时自动降级为规则引擎
