## 1）网站 bug：先修这 5 个（不然导出/导入会很痛）

把它当成“上线前必修清单”，按 P0/P1 做。

### P0（不修就影响可用/安全）

- **P0-1 团组创建可能报错**：`POST /groups` 的 INSERT 列数与 VALUES 数量不一致，可能导致创建团组失败。
    
    11-known-issues
    
    05-api-reference
    
- **P0-2 AI 在 Node 16 可能不可用**：AI 路由依赖 `global.fetch`，Node 16 默认没 fetch，建议统一 Node 18+ 或加 polyfill。
    
    11-known-issues
    
    09-ai-planner
    
- **P0-3 Basic Auth 写死在前端**：前端固定 `admin/admin123`，改密码就要改前端，且风险大。至少改成“从环境变量读取”或实现登录。
    
    11-known-issues
    
    06-frontend-ui
    

### P1（不修就影响“看得见过程/可信度”）

- **P1-4 前端冲突判断字段名与后端不一致**：前端用 `unavailable_days/allowed_group_types`，后端实际是 `blocked_weekdays/target_groups`，会出现“前端说冲突、后端其实可用”或反过来。
    
    11-known-issues
    
    aiPlanner
    
- **P1-5 capacity=0 会导致统计 Infinity%**：容量为 0 时除零。建议 UI 显示 N/A，并且统一业务语义（见下面导出/导入规范）。
    
    11-known-issues
    

> 额外提醒：**所有写入类接口建议都受编辑锁保护**（导入回写就是写入类），你系统已经有编辑锁设计。