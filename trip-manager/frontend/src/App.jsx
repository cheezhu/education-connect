import React from 'react';
import { Layout, Result, Spin } from 'antd';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import GroupManagementV2 from './pages/GroupManagementV2';
import GroupEditV2 from './pages/GroupEditV2';
import LocationManagement from './pages/LocationManagement';
import Statistics from './pages/Statistics';
import ItineraryDesigner from './pages/ItineraryDesigner';
import Settings from './pages/Settings';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';
import UnifiedNavbar from './components/UnifiedNavbar';
import { AuthProvider, useAuth } from './hooks/useAuth';
import './App.css';

const { Content } = Layout;

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </Router>
  );
}

function ProtectedRoute({ permission, action = 'read', children }) {
  const { user, loading, canAccess } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <Spin />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !canAccess(permission, action)) {
    return (
      <Result
        status="403"
        title="无权限"
        subTitle="您没有权限访问该页面"
      />
    );
  }

  return children;
}

function AppLayout() {
  const location = useLocation();
  const isDesigner = location.pathname.startsWith('/designer');
  const isLogin = location.pathname.startsWith('/login');
  const { canAccess } = useAuth();

  return (
    <Layout className="app-shell">
      {!isLogin && <UnifiedNavbar />}
      <Layout className="app-main">
        <Content className={`app-content${isDesigner ? ' app-content--full' : ''}`}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/groups"
              element={(
                <ProtectedRoute permission="groups">
                  <GroupManagementV2 />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/locations"
              element={(
                <ProtectedRoute permission="locations">
                  <LocationManagement editMode={canAccess('locations', 'write')} />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/statistics"
              element={(
                <ProtectedRoute permission="statistics">
                  <Statistics />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/designer"
              element={(
                <ProtectedRoute permission="designer">
                  <ItineraryDesigner />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/users"
              element={(
                <ProtectedRoute permission="users">
                  <UserManagement />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/settings"
              element={(
                <ProtectedRoute permission="settings">
                  <Settings />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/groups/v2/edit/:id"
              element={(
                <ProtectedRoute permission="groups" action="write">
                  <GroupEditV2 />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/groups/v2/new"
              element={(
                <ProtectedRoute permission="groups" action="write">
                  <GroupEditV2 />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/groups/v2"
              element={(
                <ProtectedRoute permission="groups">
                  <GroupManagementV2 />
                </ProtectedRoute>
              )}
            />
            <Route path="*" element={<Navigate to="/groups" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
