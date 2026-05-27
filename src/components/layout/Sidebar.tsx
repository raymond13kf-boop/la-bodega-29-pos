import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { clsx } from 'clsx';
import { 
  LayoutDashboard, ShoppingCart, 
  Package, Inbox, FileText, Users, X, ShieldAlert, Receipt
} from 'lucide-react';
import './Layout.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuthStore();
  const perms = user?.permissions;

  const menuItems = [
    { path: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard', show: true },
    { path: '/ventas', icon: <ShoppingCart size={20} />, label: 'Ventas (POS)', show: perms?.can_sell },
    { path: '/caja', icon: <Inbox size={20} />, label: 'Caja', show: perms?.can_manage_cash },
    { path: '/inventario', icon: <Package size={20} />, label: 'Inventario', show: perms?.can_inventory },
    { path: '/boletas', icon: <Receipt size={20} />, label: 'Boletas', show: perms?.can_inventory },
    { path: '/reportes', icon: <FileText size={20} />, label: 'Reportes', show: perms?.can_view_reports },
    { path: '/usuarios', icon: <Users size={20} />, label: 'Usuarios', show: perms?.can_manage_users },
    { path: '/sistema', icon: <ShieldAlert size={20} />, label: 'Sistema', show: perms?.can_manage_system },
  ];

  return (
    <>
      <div className={clsx('sidebar-overlay', isOpen && 'open')} onClick={onClose} />
      
      <aside className={clsx('sidebar', isOpen && 'open')}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/logo.png" alt="La Bodega 29 Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '50%' }} />
            <h2>La Bodega 29</h2>
          </div>
          <button className="sidebar-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.filter(item => item.show).map((item) => (
            <NavLink 
              key={item.path} 
              to={item.path}
              className={({ isActive }) => clsx('nav-item', isActive && 'active')}
              onClick={onClose}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <p className="user-name">{user?.full_name}</p>
              <p className="user-role">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
