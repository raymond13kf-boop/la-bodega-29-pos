import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface UserPermissions {
  can_sell: boolean;
  can_inventory: boolean;
  can_manage_cash: boolean;
  can_view_reports: boolean;
  can_manage_users: boolean;
  can_manage_system: boolean;
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'cajero' | 'bodega' | 'supervisor';
  permissions: UserPermissions;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  checkSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      // Para este MVP validamos contra la tabla users. 
      // En producción esto debería usar Supabase Auth real.
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .eq('active', true)
        .single();

      if (error || !data) {
        set({ isLoading: false });
        return { success: false, error: 'Credenciales inválidas o usuario inactivo' };
      }

      const user: User = {
        id: data.id,
        username: data.username,
        full_name: data.full_name,
        role: data.role,
        permissions: data.permissions || {
          can_sell: false, can_inventory: false, can_manage_cash: false, can_view_reports: false, can_manage_users: false, can_manage_system: false
        }
      };

      localStorage.setItem('pos_session', JSON.stringify(user));
      set({ user, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: 'Error de conexión' };
    }
  },

  logout: () => {
    localStorage.removeItem('pos_session');
    set({ user: null });
  },

  checkSession: () => {
    const stored = localStorage.getItem('pos_session');
    if (stored) {
      try {
        set({ user: JSON.parse(stored), isLoading: false });
      } catch {
        set({ user: null, isLoading: false });
      }
    } else {
      set({ user: null, isLoading: false });
    }
  }
}));
