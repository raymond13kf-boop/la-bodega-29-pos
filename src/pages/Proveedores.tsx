import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Truck, Edit2, Trash2, Plus, Search } from 'lucide-react';
import './Proveedores.css';

interface Proveedor {
  id: string;
  nombre: string;
  comuna: string;
  direccion: string;
  telefono: string;
}

export function Proveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    comuna: '',
    direccion: '',
    telefono: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .order('nombre');
        
      if (error) throw error;
      if (data) setProveedores(data);
    } catch (err: any) {
      console.error('Error fetching proveedores:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ nombre: '', comuna: '', direccion: '', telefono: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (proveedor: Proveedor) => {
    setEditingId(proveedor.id);
    setFormData({
      nombre: proveedor.nombre || '',
      comuna: proveedor.comuna || '',
      direccion: proveedor.direccion || '',
      telefono: proveedor.telefono || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar el proveedor "${nombre}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('proveedores')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      alert('Proveedor eliminado exitosamente.');
      fetchProveedores();
    } catch (err: any) {
      alert('Error al eliminar proveedor: ' + err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return alert('El nombre es obligatorio');
    
    setIsSaving(true);
    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('proveedores')
          .update({
            nombre: formData.nombre.trim(),
            comuna: formData.comuna.trim(),
            direccion: formData.direccion.trim(),
            telefono: formData.telefono.trim()
          })
          .eq('id', editingId);
          
        if (error) throw error;
        alert('Proveedor actualizado exitosamente.');
      } else {
        // Insert
        const { error } = await supabase
          .from('proveedores')
          .insert([{
            nombre: formData.nombre.trim(),
            comuna: formData.comuna.trim(),
            direccion: formData.direccion.trim(),
            telefono: formData.telefono.trim()
          }]);
          
        if (error) throw error;
        alert('Proveedor registrado exitosamente.');
      }
      
      setIsModalOpen(false);
      fetchProveedores();
    } catch (err: any) {
      alert('Error al guardar proveedor: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProveedores = proveedores.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.comuna && p.comuna.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Módulo de Proveedores</h1>
          <p className="text-muted">Gestión de proveedores para compras y abastecimiento</p>
        </div>
        <Button variant="primary" onClick={handleOpenAdd}>
          <Plus size={18} />
          Registrar Proveedor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="w-full" style={{ maxWidth: '400px' }}>
            <Input 
              placeholder="Buscar por nombre o comuna..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search size={18} />}
              fullWidth
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted">Cargando proveedores...</div>
          ) : filteredProveedores.length === 0 ? (
            <div className="text-center py-8 text-muted">No se encontraron proveedores.</div>
          ) : (
            <div className="items-table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Proveedor</TableHead>
                    <TableHead>Comuna</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProveedores.map(proveedor => (
                    <TableRow key={proveedor.id}>
                      <TableCell className="font-semibold">{proveedor.nombre}</TableCell>
                      <TableCell>{proveedor.comuna}</TableCell>
                      <TableCell>{proveedor.direccion}</TableCell>
                      <TableCell>{proveedor.telefono}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="sm" className="text-info" onClick={() => handleOpenEdit(proveedor)} title="Editar">
                            <Edit2 size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(proveedor.id, proveedor.nombre)} title="Eliminar">
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Proveedor" : "Registrar Proveedor"} width="sm">
        <form onSubmit={handleSave} className="flex-col gap-4">
          <Input 
            label="Nombre del Proveedor" 
            required 
            value={formData.nombre} 
            onChange={e => setFormData({...formData, nombre: e.target.value})} 
            fullWidth 
          />
          <Input 
            label="Comuna" 
            value={formData.comuna} 
            onChange={e => setFormData({...formData, comuna: e.target.value})} 
            fullWidth 
          />
          <Input 
            label="Dirección" 
            value={formData.direccion} 
            onChange={e => setFormData({...formData, direccion: e.target.value})} 
            fullWidth 
          />
          <Input 
            label="Teléfono" 
            value={formData.telefono} 
            onChange={e => setFormData({...formData, telefono: e.target.value})} 
            fullWidth 
          />
          
          <div className="flex justify-end gap-2 mt-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
