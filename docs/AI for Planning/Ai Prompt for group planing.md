你将收到一个 `planning_input.json`。请把它重排成一个 **`planning_result.json`**。  
**只输出 JSON，不要任何解释、不要 Markdown、不要代码块。**

## 输出格式（必须严格一致）

输出必须是一个 JSON 对象，且包含以下字段：

- schema 固定为 `"ec-planning-result@1"`
    
- snapshot_id 必须与输入 snapshot_id 完全一致
    
- mode 固定为 `"replaceExisting"`
    
- assignments 数组
    
- unassigned 数组
    

`{   "schema": "ec-planning-result@1",   "snapshot_id": "…",   "mode": "replaceExisting",   "assignments": [     { "groupId": 1, "date": "YYYY-MM-DD", "timeSlot": "MORNING", "locationId": 1, "participantCount": 48, "notes": "gptpro" }   ],   "unassigned": [     { "groupId": 1, "locationId": 2, "reason": "NO_SLOT" }   ] }`

## 必须遵守的硬规则（Hard Constraints）

你在输出之前必须先在脑中做校验，确保 0 个硬冲突：

### 1) 只使用输入里的 timeSlots

- 只允许 `timeSlot` 取值为：`input.rules.timeSlots`  
    （例如这份输入是 MORNING/AFTERNOON，则禁止输出 EVENING）
    

### 2) 日期范围必须取交集

对每条 assignment：

- date 必须在 `input.range.startDate ~ input.range.endDate` 内
    
- 且必须在该团 `group.start_date ~ group.end_date` 内  
    否则不能安排，放入 unassigned，reason=`OUT_OF_RANGE`。
    

### 3) 同团同日同时段最多 1 个

同一个 groupId，在同一天同一个 timeSlot 只能出现一次。

### 4) 团组类型限制（target_groups）

- 若 location.target_groups 缺失或为 `"all"`：任何团可用
    
- 若为 `"primary"` 或 `"secondary"`：必须与 group.type 完全一致  
    不一致则不能安排，reason=`GROUP_TYPE`。
    

### 5) 地点可用性（blocked_weekdays / closed_dates / open_hours）

- blocked_weekdays 是一个逗号分隔字符串（如 "3,4"），含义为 **JS weekday**：0=周日…6=周六
    
- 若 date 的 weekday 在 blocked_weekdays 中：不可用，reason=`BLOCKED_WEEKDAY`
    
- 若 date 在 closed_dates 列表里：不可用，reason=`CLOSED_DATE`
    
- open_hours：
    
    - 若 open_hours 为 null/缺失：视为可用
        
    - 若存在：当天（键 "0"~"6" 或 default）的窗口必须完全覆盖该 timeSlot 的 slotWindow（start/end 小时）
        
    - 不满足则 reason=`OPEN_HOURS`
        

### 6) 容量 capacity（重点：用“安全法”减少算错）

为避免算错叠加人数，请使用以下“安全容量法”：

1. 先计算 `MAX_PARTICIPANTS = 所有团的(student_count+teacher_count)最大值`
    
2. 对每个地点，计算 `MAX_GROUPS_PER_SLOT = floor(capacity / MAX_PARTICIPANTS)`
    
    - 如果 capacity 不存在或 <=0：视为无限（MAX_GROUPS_PER_SLOT = 很大）
        
    - 如果算出来为 0：则该地点不可用
        
3. 对每个 (date, timeSlot, locationId)，在 assignments 中安排的团组数量不得超过 `MAX_GROUPS_PER_SLOT`  
    这样可以保证无论各团人数如何组合，总人数不会超过 capacity（保守但稳定）。
    

（participantCount 仍必须输出真实人数：student_count+teacher_count）

### 7) existing 的处理（更贴合你的“重排/可调试”需求）

- mode=replaceExisting 表示你打算覆盖旧的 AI 安排
    
- 因此：existing 只能作为“参考/种子”，不要求保留
    
- 但如果 existing.activities 中某条（group_id/date/time_slot/location_id）本身不违反约束，你可以优先沿用它，这样结果更稳定、也更容易对比调试。
    

## 每团要排多少（你要的“每团8个点”的正确表达）

对每个团组：

- `availableSlots = 该团在(全局范围∩团组范围)内的天数 × input.rules.timeSlots.length`
    
- `maxForThisGroup = min(input.rules.maxItemsPerGroup, availableSlots)`
    
- 如果 `plan_items_by_group[groupId]` 非空：
    
    - **必须优先把这些 location_id 各安排 1 次**
        
    - 但如果计划点数量 > maxForThisGroup，则尽量排到 maxForThisGroup，剩余放 unassigned（reason=MAX_ITEMS）
        
- 如果 `plan_items_by_group[groupId]` 为空数组或不存在：
    
    - 不要求排满 maxItemsPerGroup
        
    - 尽量安排 `min(maxForThisGroup, 可用的不同地点数量)` 个不同地点
        
    - primary 团不能用 locationId=8（GROUP_TYPE）
        

## 排程策略（让结果更容易成功）

- 先排有 plan_items 的团组（14~23），再排无 plan_items 的团组（24~33）
    
- 对 plan_items：按 sort_order 从小到大优先安排（尽量把早序号放早日期）
    
- 避免把一个团的所有点都塞到前两天：尽量分散到不同日期
    
- 每个团尽量留出至少 1 个空槽（缓冲），除非计划点本身太多排不下
    

## 输出排序（方便你diff）

assignments 按 groupId 升序，其次 date 升序，其次 timeSlot（按 input.rules.timeSlots 的顺序）排序。

## reason 枚举（只能从这里选）

OUT_OF_RANGE | GROUP_TYPE | BLOCKED_WEEKDAY | CLOSED_DATE | OPEN_HOURS | CAPACITY | MAX_ITEMS | NO_SLOT

BEGIN_PLANNING_INPUT  
<把 planning_input.json 原样粘贴在这里>  
END_PLANNING_INPUT