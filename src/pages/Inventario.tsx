import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Modal } from '../components/ui/Modal';
import { Search, Download, Edit2, Trash2 } from 'lucide-react';
import { type Product } from '../store/posStore';
import { useAuthStore } from '../store/authStore';
import * as XLSX from 'xlsx';

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

export function Inventario() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal states for editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form errors state
  const [formErrors, setFormErrors] = useState<{ stock?: string }>({});

  // Form states
  const [formData, setFormData] = useState<{
    name: string;
    sale_price: number;
    cost_price: number;
    stock: number | '';
    category_id: string;
  }>({
    name: '',
    sale_price: 0,
    cost_price: 0,
    stock: '',
    category_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch categories
      const { data: catData } = await supabase.from('categories').select('*').order('name');
      if (catData) setCategories(catData);

      // Fetch products with category names
      const { data: prodData, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('active', true)
        .order('name');
        
      if (!error && prodData) {
        setProducts(prodData);
      }
    } catch (e) {
      console.error('Error al obtener datos del inventario:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditModal = (product: Product) => {
    setFormErrors({});
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sale_price: product.sale_price,
      cost_price: product.cost_price || 0,
      stock: product.stock,
      category_id: product.category_id || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formErrors.stock) {
      alert('Error: Por favor, corrija los errores de validación antes de guardar el producto.');
      return;
    }
    
    const requestedStock = formData.stock === '' ? 0 : Number(formData.stock);
    if (requestedStock < 0) {
      alert('Error: El stock no puede ser menor a 0.');
      return;
    }

    const payload = {
      name: formData.name,
      category_id: formData.category_id || null,
      cost_price: formData.cost_price,
      sale_price: formData.sale_price,
      stock: requestedStock
    };

    const normalizedName = formData.name.trim().toLowerCase();
    const isDuplicate = products.some(p => 
      p.id !== editingProduct?.id && 
      p.name.trim().toLowerCase() === normalizedName
    );

    if (isDuplicate) {
      alert(`Error: Ya existe un producto con el nombre "${formData.name}".`);
      return;
    }

    if (editingProduct) {
      try {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);

        if (!error) {
          // Register inventory movement if the stock changed
          const oldStock = editingProduct.stock;
          const diff = requestedStock - oldStock;
          if (diff !== 0) {
            await supabase.from('inventory_movements').insert([{
              product_id: editingProduct.id,
              user_id: user?.id || null,
              type: diff > 0 ? 'entrada' : 'salida',
              quantity: Math.abs(diff),
              reason: diff > 0 ? 'Ajuste manual de stock (entrada)' : 'Ajuste manual de stock (salida)'
            }]);
          }
          setIsModalOpen(false);
          fetchData();
          alert('Producto actualizado correctamente.');
        } else {
          throw error;
        }
      } catch (err: any) {
        console.error(err);
        alert('Error al actualizar el producto: ' + err.message);
      }
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar el producto "${product.name}" del inventario?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('products')
        .update({ active: false })
        .eq('id', product.id);

      if (error) throw error;
      
      alert('Producto eliminado correctamente.');
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Error al eliminar el producto: ' + err.message);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.barcode && p.barcode.includes(searchTerm)) ||
    (p.categories?.name && p.categories.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleExportExcel = () => {
    const dataToExport = filteredProducts.map(product => {
      const costo = product.cost_price || 0;
      const venta = product.sale_price;
      const ganancia = venta - costo;
      const margen = venta > 0 ? (ganancia / venta) * 100 : 0;
      const utilidad = ganancia * product.stock;

      return {
        'Producto': product.name,
        'Código de Barras': product.barcode || '',
        'SKU': product.sku || '',
        'Categoría': product.categories?.name || 'Sin categoría',
        'Precio de Costo': costo,
        'Precio de Venta': venta,
        'Margen de Ganancia ($)': ganancia,
        'Margen de Ganancia (%)': `${margen.toFixed(1)}%`,
        'Stock Actual': product.stock,
        'Utilidad Estimada Total': utilidad
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');

    const todayLocal = new Date();
    const dateStr = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(workbook, `Inventario_${dateStr}.xlsx`);
  };

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-muted">Gestiona y actualiza productos existentes, costos, ventas y stock</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel}>
            <Download size={18} />
            Exportar a Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="w-full" style={{ maxWidth: '400px' }}>
            <Input 
              placeholder="Buscar por nombre, SKU, código o categoría..." 
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
            <div className="table-responsive-wrapper">
              <Table style={{ minWidth: '950px' }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Venta</TableHead>
                    <TableHead>Margen</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Utilidad Est.</TableHead>
                    <TableHead className="text-center" style={{ width: '100px' }}>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map(product => {
                    const costo = product.cost_price || 0;
                    const venta = product.sale_price;
                    const ganancia = venta - costo;
                    const margen = venta > 0 ? (ganancia / venta) * 100 : 0;
                    const utilidad = ganancia * product.stock;

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="font-semibold text-gray-800">{product.name}</div>
                          <div className="text-xs text-muted mt-1">SKU: {product.sku || 'N/A'} | Código: {product.barcode || 'N/A'}</div>
                        </TableCell>
                        <TableCell>
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                            {product.categories?.name || 'Sin categoría'}
                          </span>
                        </TableCell>
                        <TableCell>{formatCLP(costo)}</TableCell>
                        <TableCell className="font-semibold text-primary">{formatCLP(venta)}</TableCell>
                        <TableCell>
                          <div className="text-success font-medium">{formatCLP(ganancia)}</div>
                          <div className="text-xs text-muted">{margen.toFixed(1)}%</div>
                        </TableCell>
                        <TableCell>
                          <span className={product.stock < 10 ? 'text-danger font-bold' : 'font-semibold'}>
                            {product.stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-info font-medium">{formatCLP(utilidad)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="sm" className="text-primary" onClick={() => handleOpenEditModal(product)} title="Actualizar datos del producto">
                              <Edit2 size={16} />
                            </Button>
                            {user?.role === 'admin' && (
                              <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeleteProduct(product)} title="Eliminar producto">
                                <Trash2 size={16} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted">
                        No se encontraron productos en el inventario.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal - Editar Producto */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Actualizar Producto en Inventario" width="sm">
        <form onSubmit={handleSave} className="flex-col gap-4">
          <Input 
            label="Nombre del Producto" 
            required 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            fullWidth 
          />
          
          <div className="input-group w-full">
            <label className="input-label">Categoría</label>
            <select 
              className="input-field" 
              value={formData.category_id} 
              onChange={e => setFormData({...formData, category_id: e.target.value})}
              required
            >
              <option value="" disabled>Seleccione una categoría</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>



          <div className="flex gap-4">
            <CurrencyInput 
              label="Precio de Costo" 
              required 
              value={formData.cost_price} 
              onChange={val => setFormData({...formData, cost_price: val})} 
              fullWidth 
            />
            <CurrencyInput 
              label="Precio de Venta" 
              required 
              value={formData.sale_price} 
              onChange={val => setFormData({...formData, sale_price: val})} 
              fullWidth 
            />
          </div>

          <div className="flex gap-4">
            <Input 
              label="Stock Actual" 
              type="number" 
              required 
              value={formData.stock} 
              error={formErrors.stock}
              onWheel={e => e.currentTarget.blur()}
              onChange={e => {
                const val = e.target.value;
                let errorMsg = '';
                if (val === '') {
                  errorMsg = 'El stock actual es obligatorio';
                } else if (Number(val) < 0) {
                  errorMsg = 'El stock no puede ser menor a 0';
                }
                setFormErrors(prev => ({ ...prev, stock: errorMsg }));
                setFormData(prev => ({ ...prev, stock: val === '' ? '' : Number(val) }));
              }}
              fullWidth 
            />
          </div>

          <div className="flex justify-end gap-2 mt-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">Guardar Cambios</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
