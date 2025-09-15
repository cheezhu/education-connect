import React, { useState } from 'react';
import { Layout, Dropdown, Badge, Avatar } from 'antd';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import DragDropTable from './components/DragDropTable';
import GroupManagement from './pages/GroupManagement';
import LocationManagement from './pages/LocationManagement';
import Statistics from './pages/Statistics';
import ItineraryDesigner from './pages/ItineraryDesigner';
import './App.css';

const { Header, Content } = Layout;

function App() {
  const [editMode] = useState(true); // 始终为编辑模式

  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <CompactHeader />
        <Content style={{
          marginTop: '42px',
          background: '#f5f7fa',
          padding: '20px',
          overflow: 'auto'
        }}>
          <Routes>
            <Route
              path="/"
              element={
                <DragDropTable
                  editMode={editMode}
                />
              }
            />
            <Route
              path="/groups"
              element={
                <GroupManagement
                  editMode={editMode}
                />
              }
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
          </Routes>
        </Content>
      </Layout>
    </Router>
  );
}

// 紧凑型顶部导航栏组件
function CompactHeader() {
  const location = useLocation();
  const currentPath = location.pathname;

  // 导航菜单项
  const menuItems = [
    { path: '/groups', label: '团组管理V1' },
    { path: '/designer', label: '行程设计器' },
    { path: '/', label: '日历视图' },
    { path: '/locations', label: '行程资源' },
    { path: '/statistics', label: '统计报表' }
  ];

  // 用户菜单
  const userMenuItems = [
    { key: 'profile', label: '个人资料' },
    { key: 'settings', label: '系统设置' },
    { type: 'divider' },
    { key: 'logout', label: '退出登录' }
  ];

  return (
    <Header
      style={{
        position: 'fixed',
        top: 0,
        zIndex: 1000,
        width: '100%',
        height: '42px',
        lineHeight: '42px',
        background: '#1a1a1a',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
      }}
    >
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginRight: '24px'
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '11px',
          fontWeight: 'bold',
          marginRight: '8px'
        }}>
          EC
        </div>
        <span style={{
          color: 'rgba(255,255,255,0.9)',
          fontSize: '13px',
          fontWeight: '500'
        }}>
          Education Connect
        </span>
      </div>

      {/* 导航菜单 - 纯文字 */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginRight: '16px'
      }}>
        {menuItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            style={{
              padding: '0 12px',
              height: '32px',
              lineHeight: '32px',
              color: currentPath === item.path ? '#667eea' : 'rgba(255,255,255,0.65)',
              fontSize: '13px',
              borderRadius: '4px',
              background: currentPath === item.path ? 'rgba(102,126,234,0.12)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.2s',
              display: 'inline-block'
            }}
            onMouseEnter={(e) => {
              if (currentPath !== item.path) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPath !== item.path) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
              }
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* 占位符，让设置和用户信息靠右 */}
      <div style={{ flex: 1 }} />

      {/* 设置 */}
      <span
        style={{
          color: 'rgba(255,255,255,0.65)',
          fontSize: '12px',
          cursor: 'pointer',
          transition: 'color 0.2s',
          marginRight: '16px'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
      >
        设置
      </span>

      {/* 用户信息 */}
      <Dropdown
        menu={{ items: userMenuItems }}
        placement="bottomRight"
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '4px',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Avatar
            size={20}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              fontSize: '10px'
            }}
          >
            管
          </Avatar>
          <span style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: '12px'
          }}>
            管理员
          </span>
        </div>
      </Dropdown>
    </Header>
  );
}

export default App;