import React from 'react';
import { Menu, LogOut, Bell } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import './Layout.css';

interface TopNavProps {
  onMenuClick: () => void;
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const { logout } = useAuthStore();

  return (
    <header className="topnav">
      <div className="topnav-left">
        <button className="menu-toggle" onClick={onMenuClick}>
          <Menu size={24} />
        </button>
      </div>
      
      <div className="topnav-right">
        <button className="topnav-btn icon-btn" title="Notificaciones">
          <Bell size={20} />
          <span className="badge"></span>
        </button>
        <button className="topnav-btn text-btn" onClick={logout} title="Cerrar sesión">
          <LogOut size={20} />
          <span className="hidden-mobile">Salir</span>
        </button>
      </div>
    </header>
  );
}
