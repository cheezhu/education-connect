import React from 'react';
import { Dropdown } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChartOutlined,
  BellOutlined,
  CompassOutlined,
  EnvironmentOutlined,
  ExportOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
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
    { key: 'designer', path: '/designer', icon: <CompassOutlined />, label: '行程设计器', permission: 'designer' },
    { key: 'groups', path: '/groups', icon: <TeamOutlined />, label: '团组管理', permission: 'groups' },
    { key: 'locations', path: '/locations', icon: <EnvironmentOutlined />, label: '资源管理', permission: 'locations' },
    { key: 'statistics', path: '/statistics', icon: <BarChartOutlined />, label: '统计报表', permission: 'statistics' },
    { key: 'users', path: '/users', icon: <UserOutlined />, label: '用户管理', permission: 'users' }
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
        <img src="/favicon.svg" alt="HKEIU" className="mini-logo-image" />
      </div>

      <div className="nav-menu">
        {visibleItems.map((item) => (
          <div
            key={item.key}
            className={`nav-icon-btn ${isActivePath(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            title={item.label}
          >
            {item.icon}
          </div>
        ))}
      </div>

      <div className="nav-spacer"></div>

      <div className="quick-actions">
        <div className="action-icon" title="搜索">
          <SearchOutlined />
        </div>
        <div className="action-icon" title="导出">
          <ExportOutlined />
        </div>
        <div className="action-icon" title="通知">
          <BellOutlined />
          <span className="badge-dot"></span>
        </div>
        {canAccess('settings') && (
          <div className="action-icon" onClick={() => navigate('/settings')} title="设置">
            <SettingOutlined />
          </div>
        )}
      </div>

      <div className="global-help-entry">
        <div
          className={`action-icon ${isActivePath('/help') ? 'active' : ''}`}
          onClick={() => navigate('/help')}
          title="系统帮助"
        >
          <QuestionCircleOutlined />
        </div>
      </div>

      <Dropdown menu={userMenuProps} placement="bottomRight">
        <div className="user-section" title={`${userName}（${roleLabel}）`}>
          <div className="user-avatar">{userName?.slice(0, 1) || 'U'}</div>
          <span className="user-name">{userName}</span>
        </div>
      </Dropdown>
    </nav>
  );
};

export default UnifiedNavbar;
