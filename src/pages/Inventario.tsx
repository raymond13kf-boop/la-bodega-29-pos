import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Search, Download } from 'lucide-react';
import { type Product } from '../store/posStore';
import * as XLSX from 'xlsx';

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

export function Inventario() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: prodData, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('active', true)
        .order('name');
        
      if (!error && prodData) {
        setProducts(prodData);
      }
    } catch (e) {
      console.error('Error al obtener productos:', e);
    } finally {
      setIsLoading(false);
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
          <p className="text-muted">Visualiza tus productos, categorías y utilidades (Solo Consulta)</p>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Venta</TableHead>
                  <TableHead>Margen</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Utilidad Est.</TableHead>
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
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-muted mt-1">SKU: {product.sku || 'N/A'} | Código: {product.barcode || 'N/A'}</div>
                      </TableCell>
                      <TableCell>
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                          {product.categories?.name || 'Sin categoría'}
                        </span>
                      </TableCell>
                      <TableCell>{formatCLP(costo)}</TableCell>
                      <TableCell className="font-semibold">{formatCLP(venta)}</TableCell>
                      <TableCell>
                        <div className="text-success font-medium">{formatCLP(ganancia)}</div>
                        <div className="text-xs text-muted">{margen.toFixed(1)}%</div>
                      </TableCell>
                      <TableCell>
                        <span className={product.stock < 10 ? 'text-danger font-bold' : ''}>
                          {product.stock}
                        </span>
                      </TableCell>
                      <TableCell className="text-info font-medium">{formatCLP(utilidad)}</TableCell>
                    </TableRow>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted">
                      No se encontraron productos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
