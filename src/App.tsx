import { type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme, Spin } from 'antd';
import viVN from 'antd/locale/vi_VN';
import enUS from 'antd/locale/en_US';
import { useShallow } from 'zustand/shallow';
import { useAuth } from './hooks/useAuth';
import { useSettingsStore } from './stores/settingsStore';
import AppLayout from './components/Layout/AppLayout';
import LoginPage from './components/Auth/LoginPage';
import DashboardPage from './components/Dashboard/DashboardPage';
import InvestmentListPage from './components/Investment/InvestmentListPage';
import ChatPage from './components/Chat/ChatPage';
import SettingsPage from './components/Settings/SettingsPage';

function App(): ReactElement {
  const { user, isLoading } = useAuth();
  const language = useSettingsStore(useShallow((state) => state.language));

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <Spin size="large" />
      </div>
    );
  }

  const isAuthenticated = user !== null;
  const antdLocale = language === 'vi' ? viVN : enUS;

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          colorBgBase: '#0a0a14',
          colorBgContainer: '#181830',
          colorBgElevated: '#1a1a2e',
          colorBorder: 'rgba(255, 255, 255, 0.06)',
          colorBorderSecondary: 'rgba(255, 255, 255, 0.04)',
          borderRadius: 12,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 14,
          colorText: '#f1f5f9',
          colorTextSecondary: '#94a3b8',
        },
        components: {
          Table: {
            headerBg: 'rgba(255, 255, 255, 0.03)',
            rowHoverBg: 'rgba(99, 102, 241, 0.06)',
          },
          Menu: {
            darkItemBg: 'transparent',
          },
          Input: {
            activeBorderColor: '#6366f1',
            hoverBorderColor: '#6366f1',
          },
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          {!isAuthenticated ? (
            <>
              <Route path="/login" element={<LoginPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/investments" element={<InvestmentListPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          )}
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
