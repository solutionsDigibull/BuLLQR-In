import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { WebSocketProvider } from './context/WebSocketContext.tsx';
import { AdminAccessProvider } from './context/AdminAccessContext.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import AdminProtectedRoute from './components/AdminProtectedRoute.tsx';
import AppLayout from './components/layout/AppLayout.tsx';
import LoginPage from './pages/LoginPage.tsx';
import ScanPage from './pages/ScanPage.tsx';
import AnalyticsPage from './pages/AnalyticsPage.tsx';
import ConfigPage from './pages/ConfigPage.tsx';
import COPQPage from './pages/COPQPage.tsx';

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <AdminAccessProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/scan" element={<ScanPage />} />

                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
                      <AdminProtectedRoute>
                        <AnalyticsPage />
                      </AdminProtectedRoute>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/copq"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
                      <AdminProtectedRoute>
                        <COPQPage />
                      </AdminProtectedRoute>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/config"
                  element={
                    <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
                      <AdminProtectedRoute>
                        <ConfigPage />
                      </AdminProtectedRoute>
                    </ProtectedRoute>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/scan" replace />} />
            </Routes>
          </AdminAccessProvider>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
