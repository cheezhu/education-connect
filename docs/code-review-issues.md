# 项目代码审查问题清单（数据安全优先）

> 说明：面向非技术同学的可执行清单。内容尽量“说人话”，并附上具体文件位置方便定位。  
> 范围：`trip-manager` 全部前后端模块（backend/routes/utils/middleware/db、frontend/pages/services/hooks/components）。  
> 结论：功能完整，但“数据覆盖风险 + 凭证/隐私保护”是当前最大短板，应优先处理。
>
> 更新（2026-02-08）：已落地 `trip-manager/shared/domain`（`time`、`resourceId`）并在前后端复用，减少“时间段/资源类型”重复定义引发的不一致；同时修复了 Calendar Detail 的 `EventChip` 乱码与语法损坏问题（会影响网格卡片显示）。
> 更新（2026-02-08）：修复 Vite 从 `shared/` 导入时的 403 与模块格式问题（前端只引 ESM `.mjs`；Vite `server.fs.allow` 放行 `../shared`），并补齐 `trip-manager/scripts/verify.ps1` 自检脚本（含前端 build）。
> 更新（2026-02-08）：行程设计器（ItineraryDesigner）继续拆分：抽离数据加载（hook）、活动 CRUD（hook）、调控台拖拽/清空（hook）、调控台高度拖拽（hook）、并保留时间轴冲突/拖拽的拆分结构；`index.jsx` 约 640 行。

---

## 0) 一句话摘要

- **当前最大风险**：日程保存仍是“全量替换”（已加入 revision 防并发覆盖，但仍可能因“前端列表不完整”导致误删/覆盖）。
- **第二大风险**：账号凭证与 AI Key 存储方式不够安全，敏感信息容易泄露。
- **维护风险**：超大文件过多，后续修改成本高且容易引发连锁 bug。

---

## 1) 高优先级问题（数据安全）

### H1. 日程保存=全量替换（已加入 revision 防并发覆盖，但仍有误覆盖风险）（高）
**现象**：批量保存接口会先删除该团组全部 schedules，再插入“前端当前列表”。目前服务端已加入 `revision` 校验：如果前端 revision 过期会返回 409，从而避免并发覆盖；但只要前端提交的列表不完整，仍可能把原本的日程“删掉”。

**相关位置**：
- 后端批量保存入口：`trip-manager/backend/src/routes/schedules.js:263`
  - revision 校验：`trip-manager/backend/src/routes/schedules.js:269`
  - 删除再插入：`trip-manager/backend/src/routes/schedules.js:299`
- 前端（保存调用）：
  - 团组管理：`trip-manager/frontend/src/pages/GroupManagementV2/index.jsx:764`（POST `/groups/:id/schedules/batch`）
  - 行程设计器内的“团组日历详情”：`trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useGroupCalendarDetail.js:75`（POST `/groups/:id/schedules/batch`）

**风险点（为什么还要关注）**：
- revision 主要防“并发覆盖”，但防不住“前端列表本身丢数据”导致的全量误删。
- 全量替换让“局部修改”很难做到真正安全（必须保证前端总是拿到并提交完整列表）。

**建议修法**：
1) 保留 revision（已落地），并确保所有入口都在 409 时提示用户刷新并自动拉取最新数据（部分入口已实现）。  
2) 中期：改成 **增量更新 API**（upsert + delete by ids），避免“一次保存删全表”的破坏性操作。  
3) 最低限度：服务端补充字段校验（时间格式、start < end），减少脏数据把 UI 搞崩。  

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
- 行程设计器日历详情保存：`trip-manager/frontend/src/pages/ItineraryDesigner/hooks/useGroupCalendarDetail.js:67`
- 团组管理日历保存：`trip-manager/frontend/src/pages/GroupManagementV2/index.jsx:758`

**建议修法**：
- 保存失败时回滚到最后一次服务端确认的数据，或提示用户“有未保存变更”。

---

### M4. 时间段规则多处重复（中）
**现象**：时间段定义在前后端多份副本，未来容易不一致。

**相关位置**：
- 前端：`trip-manager/frontend/src/pages/ItineraryDesigner/shared/timeSlots.js`（仍存在旧副本）
- 前后端共享：`trip-manager/shared/domain/time.(mjs|cjs)`（已作为“事实来源”接入部分模块）

**风险**：
- 一处改了时间段，另一处没改，出现“显示与保存不一致”。

**建议修法**：
- 继续把前端 `ItineraryDesigner/shared/timeSlots.js` 迁移到 `@/domain/time.ts`（它已转发到 `shared/domain/time.mjs`），做到“单一事实来源”。

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

### M7. 少量文件存在“乱码/编码损坏”，会直接影响 UI 甚至导致语法错误（中）
**现象**：
- 部分前端组件/样式/文档出现明显乱码（非“显示问题”，而是文件内容已被写坏），严重时会造成 `Unterminated string` 这类语法错误，直接阻塞构建与运行。

**已发现/已修复案例**：
- Calendar Detail 的 `EventChip` 组件曾出现字符串被写坏（例如出现 `€`、`?` 混入导致引号不闭合），会导致网格卡片文字异常或构建失败：  
  `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/components/CalendarDetailEventChip.jsx`（已修复）
- 部分文档存在“标签文字乱码”，会误导后续维护：  
  `docs/trip-manager-calendar-eventchip-map.md`（已重写修复）

**为什么值得当成工程问题处理**：
- 这类问题很隐蔽，常见原因是“编辑器保存编码不一致/复制粘贴带入不可见字符/终端编码差异”，一旦混入，会以非常随机的方式破坏 UI 或构建。

**建议修法**：
1) 统一仓库文本编码：  
   - 代码/JSON：UTF-8（不带 BOM）  
   - 文档（`docs/**/*.md`）：为 PowerShell 兼容，允许 UTF-8（带 BOM）；仓库已统一为“单 BOM”，避免出现多重 BOM 或乱码  
   同时建议编辑器（VSCode）开启 `files.encoding` 固定为 `utf8`。  
2) 增加一个最小的 repo 扫描脚本（不引入测试框架也行），在 CI 或本地运行，检测可疑字符与 `U+FFFD` 替换字符。  
3) 对“UI 关键字符串”集中管理（比如在 `domain/messages` 或 `ui/labels`），减少散落在组件里被误改的机会。  

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
**现象**：缺少正式的单元/集成测试（测试框架/CI 流程尚未建立）。

**现状补充**（已落地的轻量自检）：
- `trip-manager/scripts/domain-selftest.cjs`：校验共享 domain（时间段/资源类型）不走样
- `trip-manager/scripts/backend-routes-selftest.cjs`：确保所有后端 routes 可被 `require()`（避免语法/循环依赖导致启动即崩）
- `trip-manager/scripts/scan-garbled.cjs`：扫描 `U+FFFD`/NUL 等常见“文本损坏”症状（避免 Vite/Babel 因字符串损坏报错）
- `trip-manager/scripts/verify.ps1`：把上述检查串起来（可选再跑一次前端 build）

**风险**：
- 改动后更容易引入回归问题。

**建议修法**：
- 最少补 2~3 个核心 API 测试（schedules/logistics/activities），并把上述自检脚本串成一个 `verify` 命令，作为“上线前必跑”。

---

### L3. AI 环境变量名称可能写错（已兼容旧名）（低，但会误配置）
**现象**：历史上读取的是 `AI_api_key`（小写），容易导致环境变量不生效。

**相关位置**：
- `trip-manager/backend/src/utils/aiConfig.js:88`

**建议修法**：
- 已实现兼容读取：优先 `AI_API_KEY`，其次兼容 `AI_api_key`。建议统一使用 `AI_API_KEY`（更符合常见约定，也便于部署时配置）。

---

## 4) 是否需要拆分大文件？（结论：建议拆）

**当前超大文件**（可维护性风险高）：
- `trip-manager/frontend/src/pages/ItineraryDesigner/index.jsx` 约 640 行（已继续拆分数据加载/CRUD/调控台拖拽/高度拖拽；后续可以再拆“单元格选择/弹窗状态”）
- `trip-manager/frontend/src/pages/LocationManagement.jsx` 约 1333 行
- `trip-manager/frontend/src/features/calendar-detail/CalendarDetailWorkspace/index.jsx` 约 1248 行
- `trip-manager/frontend/src/pages/GroupManagementV2/index.jsx` 约 1062 行
- `trip-manager/backend/src/routes/planning.js` 约 1011 行（后端 route 同样偏重）
- `trip-manager/frontend/src/pages/GroupManagementV2/components/Detail/ProfileView.jsx` 约 905 行
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
