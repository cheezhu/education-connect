import React, { useState } from 'react';
import { Layout, Dropdown, Tooltip, Avatar } from 'antd';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  CalendarOutlined,
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
      <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
        <UnifiedNavbar />
        <Content style={{
          marginTop: '42px',
          padding: '20px',
          overflow: 'auto',
          height: 'calc(100vh - 42px)'
        }}>
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
    </Router>
  );
}

// 统一导航栏组件 (Unified Navbar)
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

  // 导航菜单项配置
  const navItems = [
    { path: '/designer', icon: <CompassOutlined />, label: '行程设计器' }, // Changed icon to Compass for "Target" feel or Design
    { path: '/groups', icon: <TeamOutlined />, label: '团组管理' },
    { path: '/locations', icon: <EnvironmentOutlined />, label: '行程资源' },
    { path: '/statistics', icon: <BarChartOutlined />, label: '统计报表' }
  ];

  // 用户菜单
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

  // 生成面包屑路径
  const getBreadcrumbs = () => {
    const crumbs = [{ label: '首页', path: '/' }];
    
    if (currentPath.startsWith('/groups')) {
      crumbs.push({ label: '团组管理', path: '/groups' });
      if (currentPath.includes('/new')) {
        crumbs.push({ label: '新建团组' });
      } else if (currentPath.includes('/edit')) {
        crumbs.push({ label: '编辑团组' });
      }
    } else if (currentPath.startsWith('/locations')) {
      crumbs.push({ label: '行程资源', path: '/locations' });
    } else if (currentPath.startsWith('/statistics')) {
      crumbs.push({ label: '统计报表', path: '/statistics' });
    } else if (currentPath.startsWith('/designer')) {
      crumbs.push({ label: '行程设计器', path: '/designer' });
    } else if (currentPath.startsWith('/settings')) {
      crumbs.push({ label: '系统设置', path: '/settings' });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <nav className="unified-navbar">
      {/* Logo */}
      <div className="logo-section">
        <div className="mini-logo">TM</div>
      </div>

      {/* 图标导航 */}
      <div className="nav-menu">
        {navItems.map(item => (
          <Tooltip key={item.path} title={item.label} placement="bottom">
            <div 
              className={`nav-icon-btn ${isActivePath(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
            </div>
          </Tooltip>
        ))}
      </div>

      {/* 分隔线 */}
      <div className="nav-divider"></div>

      {/* 面包屑导航 - 融入导航栏 */}
      <div className="breadcrumb-inline">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="bread-separator">›</span>}
            {crumb.path && index < breadcrumbs.length - 1 ? (
              <Link to={crumb.path} className="bread-item">
                {crumb.label}
              </Link>
            ) : (
              <span className={index === breadcrumbs.length - 1 ? 'bread-current' : 'bread-item'}>
                {crumb.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* 快速操作区 */}
      <div className="quick-actions">
        <Tooltip title="搜索">
          <div className="action-icon">
            <SearchOutlined />
          </div>
        </Tooltip>
        <Tooltip title="导出">
          <div className="action-icon">
            <ExportOutlined />
          </div>
        </Tooltip>
        <Tooltip title="通知">
          <div className="action-icon">
            <BellOutlined />
            <span className="badge-dot"></span>
          </div>
        </Tooltip>
        <Tooltip title="设置">
          <div className="action-icon" onClick={() => navigate('/settings')}>
            <SettingOutlined />
          </div>
        </Tooltip>
      </div>

      {/* 用户信息 */}
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
