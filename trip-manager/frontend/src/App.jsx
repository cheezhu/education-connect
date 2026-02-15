import React, { Suspense, lazy } from 'react';
import Layout from 'antd/es/layout';
import Result from 'antd/es/result';
import Spin from 'antd/es/spin';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import UnifiedNavbar from './components/UnifiedNavbar';
import { AuthProvider, useAuth } from './hooks/useAuth';
import './App.css';

const GroupManagementV2 = lazy(() => import('./pages/GroupManagementV2'));
const LocationManagement = lazy(() => import('./pages/LocationManagement'));
const Statistics = lazy(() => import('./pages/Statistics'));
const ItineraryDesigner = lazy(() => import('./pages/ItineraryDesigner'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const FeedbackCenter = lazy(() => import('./pages/FeedbackCenter'));

const { Content } = Layout;

const RouteFallback = () => (
  <div className="loading-container">
    <Spin />
  </div>
);

const LoginPage = () => (
  <Suspense fallback={<RouteFallback />}>
    <Login />
  </Suspense>
);

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </Router>
  );
}

function ProtectedRoute({ permission, action = 'read', children }) {
  const { user, loading, canAccess } = useAuth();

  if (loading) {
    return <RouteFallback />;
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

  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function AppLayout() {
  const location = useLocation();
  const isDesigner = location.pathname.startsWith('/designer');
  const isGroupManager = location.pathname === '/groups' || location.pathname === '/groups/v2';
  const isFullBleed = isDesigner || isGroupManager;
  const isLogin = location.pathname.startsWith('/login');
  const { canAccess } = useAuth();

  return (
    <Layout className="app-shell">
      {!isLogin && <UnifiedNavbar />}
      <Layout className="app-main">
        <Content className={`app-content${isFullBleed ? ' app-content--full' : ''}`}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
                <ProtectedRoute permission="designer" action="write">
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
                <ProtectedRoute permission="settings" action="write">
                  <Settings />
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
            <Route
              path="/help"
              element={(
                <ProtectedRoute>
                  <HelpCenter />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/feedback"
              element={(
                <ProtectedRoute permission="feedback">
                  <FeedbackCenter />
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
