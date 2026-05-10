import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Modal } from '../components/ui/Modal';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { type Product } from '../store/posStore';

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

const generateSKU = () => `B29-${Math.floor(1000 + Math.random() * 9000)}`;
const generateBarcode = () => `780${Date.now().toString().slice(-9)}`;

export function Inventario() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '', sku: '', barcode: '', sale_price: 0, cost_price: 0, stock: 0, min_stock: 5
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name');
      
    if (!error && data) {
      setProducts(data);
    }
    setIsLoading(false);
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name, sku: product.sku || '', barcode: product.barcode || '', 
        sale_price: product.sale_price, cost_price: (product as any).cost_price || 0, 
        stock: product.stock, min_stock: (product as any).min_stock || 5
      });
    } else {
      setEditingProduct(null);
      setFormData({ 
        name: '', 
        sku: generateSKU(), 
        barcode: generateBarcode(), 
        sale_price: 0, 
        cost_price: 0, 
        stock: 0, 
        min_stock: 5 
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(formData)
        .eq('id', editingProduct.id);
      if (!error) {
        setIsModalOpen(false);
        fetchProducts();
      } else {
        alert('Error actualizando producto');
      }
    } else {
      const { error } = await supabase
        .from('products')
        .insert([formData]);
      if (!error) {
        setIsModalOpen(false);
        fetchProducts();
      } else {
        alert('Error creando producto. Asegúrate que el SKU/Código no estén repetidos.');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto? (Se marcará como inactivo)')) {
      await supabase.from('products').update({ active: false }).eq('id', id);
      fetchProducts();
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.barcode && p.barcode.includes(searchTerm))
  );

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-muted">Gestiona tus productos y stock</p>
        </div>
        <Button variant="primary" onClick={() => handleOpenModal()}>
          <Plus size={18} />
          Nuevo Producto
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="w-full" style={{ maxWidth: '400px' }}>
            <Input 
              placeholder="Buscar por nombre, SKU o código..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search size={18} />}
              fullWidth
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted">Cargando productos...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>SKU / Código</TableHead>
                  <TableHead>Precio Venta</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(product => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted">
                      {product.sku}<br/>
                      <span className="text-xs">{product.barcode}</span>
                    </TableCell>
                    <TableCell>{formatCLP(product.sale_price)}</TableCell>
                    <TableCell>
                      <span className={product.stock < 10 ? 'text-danger font-bold' : ''}>
                        {product.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" className="text-primary" onClick={() => handleOpenModal(product)}>
                          <Edit2 size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(product.id)}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted">
                      No se encontraron productos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}>
        <form onSubmit={handleSave} className="flex-col gap-4">
          <Input label="Nombre del Producto" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} fullWidth />
          <div className="flex gap-4">
            <Input label="SKU (Opcional)" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} fullWidth />
            <Input label="Código de Barras" required value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} fullWidth />
          </div>
          <div className="flex gap-4">
            <CurrencyInput label="Precio de Costo" required value={formData.cost_price} onChange={val => setFormData({...formData, cost_price: val})} fullWidth />
            <CurrencyInput label="Precio de Venta" required value={formData.sale_price} onChange={val => setFormData({...formData, sale_price: val})} fullWidth />
          </div>
          <div className="flex gap-4">
            <Input label="Stock Actual" type="number" required value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} fullWidth />
            <Input label="Stock Mínimo (Alerta)" type="number" required value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: Number(e.target.value)})} fullWidth />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Guardar Producto</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
