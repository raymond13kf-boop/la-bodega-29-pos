import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, type UserPermissions } from './store/authStore';
import { supabase } from './lib/supabase';
import './App.css';

// Placeholder Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Ventas } from './pages/Ventas';
import { Inventario } from './pages/Inventario';
import { Boletas } from './pages/Boletas';
import { HistorialPrecios } from './pages/HistorialPrecios';
import { Caja } from './pages/Caja';
import { Reportes } from './pages/Reportes';
import { Usuarios } from './pages/Usuarios';
import { Sistema } from './pages/Sistema';
import { Proveedores } from './pages/Proveedores';
import { Layout } from './components/layout/Layout';

function ProtectedRoute({ children, requiredPermission }: { children: React.ReactNode, requiredPermission?: keyof UserPermissions }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) return <div className="loading-screen">Cargando sistema...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requiredPermission && !user.permissions?.[requiredPermission]) return <Navigate to="/" />;

  return <>{children}</>;
}

function App() {
  const { checkSession, logout, user } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Rutina de saneamiento automático de stock negativo en BD (Regla 2, 4)
  useEffect(() => {
    if (!user) return;

    const correctNegativeStock = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, stock')
          .lt('stock', 0);

        if (error) {
          console.error('Error al consultar stock negativo:', error);
          return;
        }

        if (data && data.length > 0) {
          console.warn('Se detectaron productos con stock negativo en la base de datos:', data);
          const correctedItems: string[] = [];

          for (const product of data) {
            const originalStock = product.stock;
            // 1. Corregir a 0
            const { error: updateError } = await supabase
              .from('products')
              .update({ stock: 0 })
              .eq('id', product.id);

            if (!updateError) {
              correctedItems.push(`${product.name} (era ${originalStock})`);

              // 2. Registrar movimiento de inventario de ajuste (trazabilidad y auditoría)
              await supabase.from('inventory_movements').insert([{
                product_id: product.id,
                user_id: user.id,
                type: 'entrada',
                quantity: Math.abs(originalStock),
                reason: `Saneamiento automático: stock negativo corregido de ${originalStock} a 0`
              }]);
            } else {
              console.error(`Error al corregir stock del producto ${product.name}:`, updateError);
            }
          }

          if (correctedItems.length > 0) {
            alert(
              `[SISTEMA DE INVENTARIO] Alerta de Integridad:\nSe detectaron y corrigieron automáticamente a 0 los siguientes productos con stock negativo en la base de datos:\n\n${correctedItems.join('\n')}`
            );
          }
        }
      } catch (e) {
        console.error('Excepción en rutina de saneamiento de stock:', e);
      }
    };

    correctNegativeStock();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    localStorage.setItem('pos_last_activity', Date.now().toString());

    const updateActivity = () => {
      localStorage.setItem('pos_last_activity', Date.now().toString());
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, updateActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      const lastActivity = localStorage.getItem('pos_last_activity');
      if (lastActivity) {
        const inactiveTime = Date.now() - Number(lastActivity);
        if (inactiveTime > 3600000) {
          logout();
          alert('Tu sesión se ha cerrado automáticamente por inactividad (1 hora).');
        }
      } else {
        logout();
      }
    }, 10000);

    return () => {
      clearInterval(checkInterval);
      events.forEach(event => document.removeEventListener(event, updateActivity));
    };
  }, [user, logout]);

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
          <Route path="boletas" element={
            <ProtectedRoute requiredPermission="can_inventory">
              <Boletas />
            </ProtectedRoute>
          } />
          <Route path="historial-precios" element={
            <ProtectedRoute requiredPermission="can_inventory">
              <HistorialPrecios />
            </ProtectedRoute>
          } />
          <Route path="proveedores" element={
            <ProtectedRoute requiredPermission="can_inventory">
              <Proveedores />
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
          <Route path="sistema" element={
            <ProtectedRoute requiredPermission="can_manage_system">
              <Sistema />
            </ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
