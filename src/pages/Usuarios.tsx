import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Users, Edit2, ShieldAlert } from 'lucide-react';

export function Usuarios() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    role: 'cajero',
    permissions: {
      can_sell: true,
      can_inventory: false,
      can_manage_cash: true,
      can_view_reports: false,
      can_manage_users: false,
      can_manage_system: false
    }
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('full_name');
      
    if (!error && data) {
      setUsers(data);
    }
    setIsLoading(false);
  };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      role: user.role,
      permissions: user.permissions || {
        can_sell: false, can_inventory: false, can_manage_cash: false, 
        can_view_reports: false, can_manage_users: false, can_manage_system: false
      }
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Proteccion inmutable para Raymond
    let finalPermissions = formData.permissions;
    let finalRole = formData.role;
    
    if (editingUser.username === 'raymond') {
      finalRole = 'admin';
      finalPermissions = {
        can_sell: true,
        can_inventory: true,
        can_manage_cash: true,
        can_view_reports: true,
        can_manage_users: true,
        can_manage_system: true
      };
    }

    const { error } = await supabase
      .from('users')
      .update({ role: finalRole, permissions: finalPermissions })
      .eq('id', editingUser.id);

    if (!error) {
      setIsModalOpen(false);
      fetchUsers();
    } else {
      alert('Error al actualizar permisos.');
    }
  };

  const isRaymond = editingUser?.username === 'raymond';

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Gestión de Usuarios y Permisos</h1>
          <p className="text-muted">Asigna roles y accesos granulares al personal</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={20} />
            Plantilla de Personal
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted">Cargando usuarios...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Configurar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell className="capitalize">{user.role}</TableCell>
                    <TableCell>
                      <span className={user.active ? 'text-success' : 'text-danger'}>
                        {user.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(user)}>
                        <Edit2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Configurar: ${editingUser?.full_name}`} width="sm">
        <form onSubmit={handleSave} className="flex-col gap-4">
          
          {isRaymond && (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded-md text-sm mb-4 flex items-start gap-2">
              <ShieldAlert size={18} className="mt-0.5 flex-shrink-0" />
              <p>Este usuario es el <strong>Administrador Maestro</strong>. Sus permisos no pueden ser removidos ni alterados para evitar bloqueos del sistema.</p>
            </div>
          )}

          <div className="input-group w-full">
            <label className="input-label">Rol del Sistema</label>
            <select 
              className="input-field" 
              value={formData.role} 
              onChange={e => setFormData({...formData, role: e.target.value})}
              disabled={isRaymond}
            >
              <option value="cajero">Cajero</option>
              <option value="admin">Administrador</option>
              <option value="bodega">Bodega</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </div>

          <div className="flex-col gap-3 p-4 bg-gray-50 rounded-md border border-gray-200">
            <h4 className="font-semibold text-sm mb-2 text-primary">Accesos y Permisos (RBAC)</h4>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-primary" 
                checked={formData.permissions.can_sell} 
                onChange={e => setFormData({...formData, permissions: {...formData.permissions, can_sell: e.target.checked}})} 
                disabled={isRaymond}
              />
              <span className="text-sm font-medium">Vender y Procesar Pagos (POS)</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-primary" 
                checked={formData.permissions.can_manage_cash} 
                onChange={e => setFormData({...formData, permissions: {...formData.permissions, can_manage_cash: e.target.checked}})} 
                disabled={isRaymond}
              />
              <span className="text-sm font-medium">Apertura y Arqueo de Caja</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-primary" 
                checked={formData.permissions.can_inventory} 
                onChange={e => setFormData({...formData, permissions: {...formData.permissions, can_inventory: e.target.checked}})} 
                disabled={isRaymond}
              />
              <span className="text-sm font-medium">Gestionar Inventario (Ingreso/Edición)</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-primary" 
                checked={formData.permissions.can_view_reports} 
                onChange={e => setFormData({...formData, permissions: {...formData.permissions, can_view_reports: e.target.checked}})} 
                disabled={isRaymond}
              />
              <span className="text-sm font-medium">Ver Reportes y Ganancias</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-primary" 
                checked={formData.permissions.can_manage_users} 
                onChange={e => setFormData({...formData, permissions: {...formData.permissions, can_manage_users: e.target.checked}})} 
                disabled={isRaymond}
              />
              <span className="text-sm font-medium">Asignar Permisos a Usuarios</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-danger" 
                checked={formData.permissions.can_manage_system} 
                onChange={e => setFormData({...formData, permissions: {...formData.permissions, can_manage_system: e.target.checked}})} 
                disabled={isRaymond}
              />
              <span className="text-sm font-medium text-danger">Reiniciar Datos del Sistema</span>
            </label>
          </div>
          
          <Button type="submit" variant="primary" fullWidth className="mt-4" disabled={isRaymond}>
            Guardar Cambios
          </Button>
        </form>
      </Modal>
    </div>
  );
}
