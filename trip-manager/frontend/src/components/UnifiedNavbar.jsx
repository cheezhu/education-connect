import React from 'react';
import { Dropdown, Tooltip } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChartOutlined,
  BellOutlined,
  CompassOutlined,
  EnvironmentOutlined,
  ExportOutlined,
  LogoutOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

const ROLE_LABELS = {
  admin: '管理员',
  editor: '编辑者',
  viewer: '查看者'
};

const UnifiedNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, canAccess, logout } = useAuth();
  const currentPath = location.pathname;

  const isActivePath = (path) => {
    if (path === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(path);
  };

  const navItems = [
    { path: '/designer', icon: <CompassOutlined />, label: '行程设计器', permission: 'designer' },
    { path: '/groups', icon: <TeamOutlined />, label: '团组管理', permission: 'groups' },
    { path: '/locations', icon: <EnvironmentOutlined />, label: '资源管理', permission: 'locations' },
    { path: '/statistics', icon: <BarChartOutlined />, label: '统计报表', permission: 'statistics' },
    { path: '/users', icon: <UserOutlined />, label: '用户管理', permission: 'users' }
  ];

  const visibleItems = navItems.filter((item) => !item.permission || canAccess(item.permission));

  const roleLabel = ROLE_LABELS[user?.role] || '未知角色';
  const userName = user?.displayName || user?.username || '用户';

  const menuItems = [
    { key: 'username', label: `用户名：${userName}`, disabled: true },
    { key: 'role', label: `角色：${roleLabel}`, disabled: true },
    { type: 'divider' },
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined /> }
  ];

  const userMenuProps = {
    items: menuItems,
    onClick: ({ key }) => {
      if (key === 'logout') {
        logout();
        navigate('/login');
      }
    }
  };

  return (
    <nav className="unified-navbar">
      <div className="logo-section">
        <div className="mini-logo">TM</div>
      </div>

      <div className="nav-menu">
        {visibleItems.map((item) => (
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
        {canAccess('settings') && (
          <Tooltip title="设置" placement="right">
            <div className="action-icon" onClick={() => navigate('/settings')}>
              <SettingOutlined />
            </div>
          </Tooltip>
        )}
      </div>

      <Tooltip title={`${userName}（${roleLabel}）`} placement="right">
        <Dropdown menu={userMenuProps} placement="bottomRight">
          <div className="user-section">
            <div className="user-avatar">{userName?.slice(0, 1) || 'U'}</div>
            <span className="user-name">{userName}</span>
          </div>
        </Dropdown>
      </Tooltip>
    </nav>
  );
};

export default UnifiedNavbar;
