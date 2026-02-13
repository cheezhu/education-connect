import React from 'react';

const HelpView = () => (
  <div className="group-help-view">
    <div className="group-help-header">
      <h3>团组管理使用说明</h3>
      <p>用于统一维护团组资料、每日卡片、日历活动和成员信息。</p>
    </div>

    <div className="group-help-grid">
      <section className="group-help-card">
        <h4>快速上手</h4>
        <ol>
          <li>先在左侧列表选择团组，确认当前编辑对象。</li>
          <li>进入“团组信息”补齐基础字段（日期、人数、联系人、备注）。</li>
          <li>进入“每日卡片”录入住宿、车导安保、三餐与接送站信息。</li>
          <li>进入“日历详情”确认时段安排并微调时间/时长。</li>
        </ol>
      </section>

      <section className="group-help-card">
        <h4>各标签页作用</h4>
        <ul>
          <li><strong>团组信息</strong>：团组基础档案与状态管理。</li>
          <li><strong>食行卡片</strong>：按天录入旅行资源，支持“不安排”。</li>
          <li><strong>日历详情</strong>：可视化时段排程，支持拖拽调整。</li>
          <li><strong>行程导出</strong>：查看并导出文本化行程。</li>
          <li><strong>人员信息</strong>：维护团员名单与联系方式。</li>
        </ul>
      </section>

      <section className="group-help-card">
        <h4>关键规则（请注意）</h4>
        <ul>
          <li>活动数据来源分为：行程点、每日卡片、自定义。</li>
          <li>每日卡片与日历映射活动保持联动，删除任一侧会同步。</li>
          <li>“不安排”会计入录入完成状态，且会清空对应字段。</li>
          <li>保存为自动保存为主，建议每次改动后等待提示稳定再切页。</li>
        </ul>
      </section>

      <section className="group-help-card">
        <h4>常见问题</h4>
        <ul>
          <li>保存失败：先检查角色权限与网络连接，再尝试刷新。</li>
          <li>多人编辑冲突：以最新版本为准，建议先刷新后继续编辑。</li>
          <li>看不到新数据：切换团组或刷新页面触发最新拉取。</li>
        </ul>
      </section>
    </div>
  </div>
);

export default HelpView;
