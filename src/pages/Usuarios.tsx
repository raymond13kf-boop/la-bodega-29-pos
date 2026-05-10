import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Plus, Users } from 'lucide-react';

export function Usuarios() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    username: '', 
    full_name: '', 
    password: '', 
    role: 'cajero',
    permissions: {
      can_sell: true,
      can_inventory: false,
      can_manage_cash: true,
      can_view_reports: false,
      can_manage_users: false
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('users').insert([formData]);
    if (!error) {
      setIsModalOpen(false);
      fetchUsers();
    } else {
      alert('Error al crear usuario. Verifica que el nombre de usuario no esté repetido.');
    }
  };

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Usuarios del Sistema</h1>
          <p className="text-muted">Administra cajeros y administradores</p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Nuevo Usuario
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={20} />
            Lista de Usuarios
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
                  <TableHead>Usuario (Login)</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuevo Usuario" width="sm">
        <form onSubmit={handleSave} className="flex-col gap-4">
          <Input 
            label="Nombre Completo" 
            required 
            value={formData.full_name} 
            onChange={e => setFormData({...formData, full_name: e.target.value})} 
            fullWidth 
          />
          <Input 
            label="Nombre de Usuario (Para login)" 
            required 
            value={formData.username} 
            onChange={e => setFormData({...formData, username: e.target.value})} 
            fullWidth 
          />
          <Input 
            label="Contraseña" 
            type="password"
            required 
            value={formData.password} 
            onChange={e => setFormData({...formData, password: e.target.value})} 
            fullWidth 
          />
          <div className="input-group w-full">
            <label className="input-label">Rol del Sistema</label>
            <select 
              className="input-field" 
              value={formData.role} 
              onChange={e => setFormData({...formData, role: e.target.value})}
            >
              <option value="cajero">Cajero</option>
              <option value="admin">Administrador</option>
              <option value="bodega">Bodega</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </div>

          <div className="flex-col gap-2 p-4 bg-gray-50 rounded-md border border-gray-200">
            <h4 className="font-semibold text-sm mb-2">Permisos Específicos</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.permissions.can_sell} onChange={e => setFormData({...formData, permissions: {...formData.permissions, can_sell: e.target.checked}})} />
              <span className="text-sm">Vender y Procesar Pagos</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.permissions.can_manage_cash} onChange={e => setFormData({...formData, permissions: {...formData.permissions, can_manage_cash: e.target.checked}})} />
              <span className="text-sm">Apertura y Arqueo de Caja</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.permissions.can_inventory} onChange={e => setFormData({...formData, permissions: {...formData.permissions, can_inventory: e.target.checked}})} />
              <span className="text-sm">Gestionar Inventario (CRUD)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.permissions.can_view_reports} onChange={e => setFormData({...formData, permissions: {...formData.permissions, can_view_reports: e.target.checked}})} />
              <span className="text-sm">Ver Reportes y Ganancias</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.permissions.can_manage_users} onChange={e => setFormData({...formData, permissions: {...formData.permissions, can_manage_users: e.target.checked}})} />
              <span className="text-sm">Crear/Editar Usuarios</span>
            </label>
          </div>
          
          <Button type="submit" variant="primary" fullWidth className="mt-4">
            Crear Usuario
          </Button>
        </form>
      </Modal>
    </div>
  );
}
