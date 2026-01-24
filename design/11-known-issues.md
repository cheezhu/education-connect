# 已知问题与不一致点

当前 P0/P1 清单已修复：
- 团组创建 INSERT 占位符不一致
- Node 16 无 fetch 导致 AI 失效（改为 undici fallback）
- 前端 Basic Auth 写死（改为 VITE_API_* 可配置）
- 行程设计器冲突字段与后端不一致
- 统计容量为 0 的 Infinity% 显示

如需新增问题或追踪项，请在此文件追加。
