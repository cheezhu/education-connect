import React, { useState } from 'react';
import { Layout, Dropdown, Tooltip } from 'antd';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  CompassOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  BarChartOutlined,
  SearchOutlined,
  ExportOutlined,
  BellOutlined,
  SettingOutlined
} from '@ant-design/icons';
import GroupManagementV2 from './pages/GroupManagementV2';
import GroupEditV2 from './pages/GroupEditV2';
import LocationManagement from './pages/LocationManagement';
import Statistics from './pages/Statistics';
import ItineraryDesigner from './pages/ItineraryDesigner';
import Settings from './pages/Settings';
import './App.css';

const { Content } = Layout;

function App() {
  const [editMode] = useState(true); // 始终为编辑模式

  return (
    <Router>
      <AppLayout editMode={editMode} />
    </Router>
  );
}

function AppLayout({ editMode }) {
  const location = useLocation();
  const isDesigner = location.pathname.startsWith('/designer');

  return (
    <Layout className="app-shell">
      <UnifiedNavbar />
      <Layout className="app-main">
        <Content className={`app-content${isDesigner ? ' app-content--full' : ''}`}>
          <Routes>
            <Route
              path="/groups"
              element={<GroupManagementV2 />}
            />
            <Route
              path="/locations"
              element={
                <LocationManagement
                  editMode={editMode}
                />
              }
            />
            <Route
              path="/statistics"
              element={<Statistics />}
            />
            <Route
              path="/designer"
              element={<ItineraryDesigner />}
            />
            <Route
              path="/settings"
              element={<Settings />}
            />
            <Route
              path="/groups/v2/edit/:id"
              element={<GroupEditV2 />}
            />
            <Route
              path="/groups/v2/new"
              element={<GroupEditV2 />}
            />
            <Route
              path="/groups/v2"
              element={<GroupManagementV2 />}
            />
            <Route
              path="*"
              element={<Navigate to="/groups" replace />}
            />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function UnifiedNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const isActivePath = (path) => {
    if (path === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(path);
  };

  const navItems = [
    { path: '/designer', icon: <CompassOutlined />, label: '行程设计器' },
    { path: '/groups', icon: <TeamOutlined />, label: '团组管理' },
    { path: '/locations', icon: <EnvironmentOutlined />, label: '行程资源' },
    { path: '/statistics', icon: <BarChartOutlined />, label: '统计报表' }
  ];

  const userMenuItems = [
    { key: 'profile', label: '个人资料' },
    { key: 'settings', label: '系统设置' },
    { type: 'divider' },
    { key: 'logout', label: '退出登录' }
  ];

  const userMenuProps = {
    items: userMenuItems,
    onClick: ({ key }) => {
      if (key === 'settings') {
        navigate('/settings');
      }
    }
  };

  return (
    <nav className="unified-navbar">
      <div className="logo-section">
        <div className="mini-logo">TM</div>
      </div>

      <div className="nav-menu">
        {navItems.map(item => (
          <Tooltip key={item.path} title={item.label} placement="right">
            <div
              className={`nav-icon-btn ${isActivePath(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
            </div>
          </Tooltip>
        ))}
      </div>

      <div className="nav-spacer"></div>

      <div className="quick-actions">
        <Tooltip title="搜索" placement="right">
          <div className="action-icon">
            <SearchOutlined />
          </div>
        </Tooltip>
        <Tooltip title="导出" placement="right">
          <div className="action-icon">
            <ExportOutlined />
          </div>
        </Tooltip>
        <Tooltip title="通知" placement="right">
          <div className="action-icon">
            <BellOutlined />
            <span className="badge-dot"></span>
          </div>
        </Tooltip>
        <Tooltip title="设置" placement="right">
          <div className="action-icon" onClick={() => navigate('/settings')}>
            <SettingOutlined />
          </div>
        </Tooltip>
      </div>

      <Dropdown menu={userMenuProps} placement="bottomRight">
        <div className="user-section">
          <div className="user-avatar">管</div>
          <span className="user-name">管理员</span>
        </div>
      </Dropdown>
    </nav>
  );
}

export default App;
