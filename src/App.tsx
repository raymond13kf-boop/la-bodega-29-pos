import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, type UserPermissions } from './store/authStore';
import './App.css';

// Placeholder Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Ventas } from './pages/Ventas';
import { Inventario } from './pages/Inventario';
import { Caja } from './pages/Caja';
import { Reportes } from './pages/Reportes';
import { Usuarios } from './pages/Usuarios';
import { Layout } from './components/layout/Layout';

function ProtectedRoute({ children, requiredPermission }: { children: React.ReactNode, requiredPermission?: keyof UserPermissions }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) return <div className="loading-screen">Cargando sistema...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requiredPermission && !user.permissions?.[requiredPermission]) return <Navigate to="/" />;

  return <>{children}</>;
}

function App() {
  const { checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="ventas" element={
            <ProtectedRoute requiredPermission="can_sell">
              <Ventas />
            </ProtectedRoute>
          } />
          <Route path="inventario" element={
            <ProtectedRoute requiredPermission="can_inventory">
              <Inventario />
            </ProtectedRoute>
          } />
          <Route path="caja" element={
            <ProtectedRoute requiredPermission="can_manage_cash">
              <Caja />
            </ProtectedRoute>
          } />
          <Route path="reportes" element={
            <ProtectedRoute requiredPermission="can_view_reports">
              <Reportes />
            </ProtectedRoute>
          } />
          <Route path="usuarios" element={
            <ProtectedRoute requiredPermission="can_manage_users">
              <Usuarios />
            </ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
