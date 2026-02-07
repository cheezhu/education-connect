# 项目代码审查问题清单（数据安全优先）

> 说明：面向非技术同学的可执行清单。内容尽量“说人话”，并附上具体文件位置方便定位。  
> 范围：`trip-manager` 全部前后端模块（backend/routes/utils/middleware/db、frontend/pages/services/hooks/components）。  
> 结论：功能完整，但“数据覆盖风险 + 凭证/隐私保护”是当前最大短板，应优先处理。

---

## 0) 一句话摘要

- **当前最大风险**：日程保存是“全量替换”，多端/多窗口/快速操作时容易覆盖别人刚保存的数据。
- **第二大风险**：账号凭证与 AI Key 存储方式不够安全，敏感信息容易泄露。
- **维护风险**：超大文件过多，后续修改成本高且容易引发连锁 bug。

---

## 1) 高优先级问题（数据安全）

### H1. 日程保存=全量替换 + 多处前端 debounce → 并发下必然覆盖（高）
**现象**：一次保存会先删除该团组所有日程，再插入“前端当前列表”。如果两次保存乱序到达，**后来的那次会覆盖前面全部改动**。

**相关位置**：
- 后端全量替换：`trip-manager/backend/src/routes/schedules.js:189`（批量保存入口）
- 后端删除再插入：`trip-manager/backend/src/routes/schedules.js:215`
- 前端多处 debounce 保存：
  - `trip-manager/frontend/src/pages/GroupEditV2/ScheduleManagement.jsx:38`
  - `trip-manager/frontend/src/pages/GroupManagementV2/index.jsx:757`
  - `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx:759`

**为什么危险**：
- “多端同时编辑”或“同一人开两个页面”时，只要保存请求乱序，**旧数据就会覆盖新数据**。
- 前端做了 token 忽略旧响应，但**服务器已经把旧数据写进数据库了**。

**建议修法**（强烈推荐）：
1) 增加 **revision/version 字段**（服务端校验“是否过期”），否则拒绝保存并提示刷新。  
2) 或改成 **增量更新 API**（只改动变更项，而不是全量删除再插入）。  
3) 至少在保存失败时 **回滚 UI**，避免用户以为“保存成功”。

---

### H2. 凭证与密钥存储方式不安全（高）
**现象**：
- Basic Auth 头直接存 localStorage。
- AI API Key 写入数据库明文保存。

**相关位置**：
- Basic Auth 存 localStorage：`trip-manager/frontend/src/services/auth.js:19`、`:27`
- AI Key 明文入库：`trip-manager/backend/src/routes/systemConfig.js:290`

**为什么危险**：
- localStorage 一旦有 XSS，就能直接拿到账号密码。
- AI Key 被明文存入 DB，DB 备份/泄露会直接暴露密钥。

**建议修法**：
1) 登录方式改成 **短期 token + httpOnly cookie** 或服务端 session。  
2) AI Key 优先放在 **服务器环境变量**，如果必须写 DB，至少做 **加密或脱敏存储**。

---

### H3. 个人敏感信息明文存储（高）
**现象**：成员表里保存了身份证号、手机号等敏感信息，SQLite 文件无加密。

**相关位置**：
- 成员表字段：`trip-manager/backend/db/init.sql:228`、`:234`

**为什么危险**：
- 数据库文件被拷走或备份泄露时，敏感信息会直接暴露。

**建议修法**：
1) 对敏感字段做 **字段级加密**（如 AES）或使用加密数据库。  
2) 制定 **备份与访问控制**（最小权限访问）。

---

## 2) 中优先级问题（数据一致性 / 可维护性）

### M1. 仍允许客户端传入 `schedule.id`（中）
**现象**：后端仍会使用客户端传入的 `id` 写入数据库。虽然前端已改成 `clientId`，但**仍存在“恶意/旧客户端”注入冲突 ID 的可能**。

**相关位置**：
- `trip-manager/backend/src/routes/schedules.js:219`

**建议修法**：
- 服务端插入时 **忽略客户端 id**，只在“确实属于该团组且存在”的情况下允许复用。

---

### M2. 时间格式/范围校验不足（中）
**现象**：只检查 `startTime/endTime` 是否存在，不验证格式、范围或 start < end。

**相关位置**：
- `trip-manager/backend/src/routes/schedules.js:197`

**风险**：
- 会出现“时间非法、越界、显示异常”的数据，后续 UI 渲染易出错。

**建议修法**：
- 服务端加入时间格式校验（HH:mm），并强制 `start < end`。

---

### M3. 前端乐观更新但无回滚（中）
**现象**：前端先更新 UI，再异步保存；保存失败只提示错误，没有回滚 UI。

**相关位置**：
- `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx:759`
- `trip-manager/frontend/src/pages/GroupManagementV2/index.jsx:757`

**建议修法**：
- 保存失败时回滚到最后一次服务端确认的数据，或提示用户“有未保存变更”。

---

### M4. 时间段规则多处重复（中）
**现象**：时间段定义在前后端多份副本，未来容易不一致。

**相关位置**：
- 前端：`trip-manager/frontend/src/pages/ItineraryDesigner/shared/timeSlots.js`
- 后端：`trip-manager/backend/src/routes/schedules.js:14`
- 后端：`trip-manager/backend/src/utils/aiConfig.js:3`

**风险**：
- 一处改了时间段，另一处没改，出现“显示与保存不一致”。

**建议修法**：
- 把时间段配置统一到 **system_config** 或共享常量。

---

### M5. 默认账号写入数据库（中）
**现象**：初始化脚本中插入了默认用户。

**相关位置**：
- `trip-manager/backend/db/init.sql:305`

**风险**：
- 部署到生产忘记改密码会造成安全风险。

**建议修法**：
- 首次启动强制修改密码，或移除默认账号。

---

### M6. `open_hours/closed_dates` 未校验（中）
**现象**：地点的 `open_hours/closed_dates` 直接写入 DB，不校验格式。

**相关位置**：
- `trip-manager/backend/src/routes/locations.js:32`

**风险**：
- 数据格式出错时，规划/校验逻辑会报错或产生错判。

**建议修法**：
- 保存前校验 JSON 结构；非法则拒绝。

---

## 3) 低优先级问题（稳定性/质量）

### L1. 编辑锁接口未做用户判空（低）
**现象**：当 `req.user` 不存在时，直接访问 `user.role` 可能报错。

**相关位置**：
- `trip-manager/backend/src/routes/lock.js:7`
- `trip-manager/backend/src/routes/lock.js:38`

**建议修法**：
- `if (!user) return 403`。

---

### L2. 未发现自动化测试（低）
**现象**：未检索到单元/集成测试文件。

**风险**：
- 改动后更容易引入回归问题。

**建议修法**：
- 最少补 2~3 个核心 API 测试（schedules/logistics/activities）。

---

### L3. AI 环境变量名称可能写错（低，但会误配置）
**现象**：读取的是 `AI_api_key`（小写），容易导致环境变量不生效。

**相关位置**：
- `trip-manager/backend/src/utils/aiConfig.js:88`

**建议修法**：
- 改成 `AI_API_KEY`。

---

## 4) 是否需要拆分大文件？（结论：建议拆）

**当前超大文件**（可维护性风险高）：
- `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx` ~2785 行（已拆分一部分，但主文件仍偏大）
- `trip-manager/frontend/src/pages/GroupEditV2/Calendar/index.jsx` ~1372 行
- `trip-manager/frontend/src/pages/LocationManagement.jsx` ~1315 行
- `trip-manager/frontend/src/pages/GroupManagementV2/index.jsx` ~1039 行
- `trip-manager/frontend/src/pages/GroupManagementV2/components/Detail/Logistics/DayLogisticsCard.jsx` ~737 行

**为什么建议拆**：
- 单个文件职责过多，任何小改动都可能影响其它功能。
- 维护成本高，新人难理解，易引入 bug。

**拆分建议**：
- 按“功能域”拆：数据请求 / 业务规则 / UI 组件。
- 先拆最外层巨文件（ItineraryDesigner、Calendar），收益最大。

---

## 5) 给非技术同学的“优先修复顺序”

1) **先解决日程覆盖问题（H1）**：引入版本号或增量保存。  
2) **再处理凭证/密钥安全（H2/H3）**：避免明文存储。  
3) **拆分大文件（第 4 节）**：降低维护风险。  

---

## 6) 如果你愿意，我可以直接落地的三种方案

- 方案 A：只修 “日程覆盖 + 版本冲突提示”（最小改动、最快见效）。  
- 方案 B：同时改登录与 AI Key 的存储安全（中等改动）。  
- 方案 C：在 A/B 之外，拆分 2~3 个最大文件（长期收益最高）。

你告诉我选哪一套，我直接实现。
