import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { Search, TrendingUp, DollarSign, Calendar, ArrowRight } from 'lucide-react';
import './HistorialPrecios.css';

interface PriceHistoryEntry {
  purchase_date: string;
  invoice_number: string;
  supplier: string;
  net_price: number;
  gross_price: number;
  sale_price: number;
  quantity: number;
}

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

export function HistorialPrecios() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Fetch all active products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('active', true)
          .order('name');
        if (!error && data) {
          setProducts(data);
        }
      } catch (e) {
        console.error('Error fetching products for history:', e);
      }
    };
    fetchProducts();
  }, []);

  // Fetch price history whenever product is selected
  useEffect(() => {
    if (!selectedProductId) {
      setHistory([]);
      return;
    }

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('boleta_items')
          .select(`
            net_price,
            gross_price,
            sale_price,
            quantity,
            boletas (
              invoice_number,
              purchase_date,
              supplier
            )
          `)
          .eq('product_id', selectedProductId);

        if (error) throw error;

        if (data) {
          const mapped = data.map((item: any) => ({
            purchase_date: item.boletas?.purchase_date || '',
            invoice_number: item.boletas?.invoice_number || 'N/A',
            supplier: item.boletas?.supplier || 'N/A',
            net_price: Number(item.net_price),
            gross_price: Number(item.gross_price),
            sale_price: Number(item.sale_price),
            quantity: Number(item.quantity)
          })).sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
          
          setHistory(mapped);
        }
      } catch (e) {
        console.error('Error fetching price history:', e);
        alert('Error al consultar el historial de precios');
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [selectedProductId]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const filteredSearchProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.barcode && p.barcode.includes(productSearch)) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  // Stats calculation
  const latestEntry = history[0];
  const oldestEntry = history[history.length - 1];

  const currentCost = selectedProduct?.cost_price || latestEntry?.gross_price || 0;
  const currentSale = selectedProduct?.sale_price || latestEntry?.sale_price || 0;
  
  const initialCost = oldestEntry?.gross_price || 0;
  const initialSale = oldestEntry?.sale_price || 0;

  const costDiff = currentCost - initialCost;
  const costDiffPct = initialCost > 0 ? (costDiff / initialCost) * 100 : 0;

  const saleDiff = currentSale - initialSale;
  const saleDiffPct = initialSale > 0 ? (saleDiff / initialSale) * 100 : 0;

  const margin = currentSale > 0 ? ((currentSale - currentCost) / currentSale) * 100 : 0;

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Historial de Evolución de Precios</h1>
          <p className="text-muted">Consulta la evolución histórica de costos y ventas a partir de las boletas registradas</p>
        </div>
      </div>

      {/* Product Search Card */}
      <Card className="mb-4">
        <CardHeader>
          <div className="w-full relative" style={{ maxWidth: '500px' }}>
            <label className="input-label font-semibold">Seleccionar Producto para Consultar</label>
            <div className="relative">
              <Input
                placeholder="Escribe el nombre, código de barras o SKU del producto..."
                value={productSearch}
                onChange={e => {
                  setProductSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                icon={<Search size={18} />}
                fullWidth
              />
              {showDropdown && productSearch.trim() !== '' && (
                <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                  {filteredSearchProducts.slice(0, 8).map(p => (
                    <div
                      key={p.id}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center text-sm border-b border-gray-50"
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setProductSearch(p.name);
                        setShowDropdown(false);
                      }}
                    >
                      <div>
                        <span className="font-semibold text-gray-800">{p.name}</span>
                        <div className="text-xs text-gray-500">
                          Código: {p.barcode || 'N/A'} {p.sku ? `| SKU: ${p.sku}` : ''}
                        </div>
                      </div>
                      <span className="font-semibold text-primary">{formatCLP(p.sale_price)}</span>
                    </div>
                  ))}
                  {filteredSearchProducts.length === 0 && (
                    <div className="px-4 py-2 text-gray-500 text-sm text-center">
                      No se encontraron productos coincidentes.
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedProduct && (
              <div className="mt-2 text-xs text-muted">
                Producto seleccionado actualmente: <strong className="text-primary">{selectedProduct.name}</strong>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {selectedProductId ? (
        isLoadingHistory ? (
          <div className="text-center py-12 text-muted">Consultando historial en Supabase...</div>
        ) : (
          <div className="flex-col gap-6">
            
            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="stat-card">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="stat-icon bg-primary-light text-primary">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-muted block uppercase font-bold">Costo Actual</span>
                    <strong className="text-xl block">{formatCLP(currentCost)}</strong>
                    {history.length > 1 && (
                      <span className={`text-xs font-semibold ${costDiff >= 0 ? 'text-danger' : 'text-success'}`}>
                        {costDiff >= 0 ? '▲' : '▼'} {Math.abs(costDiffPct).toFixed(1)}% (desde inicio)
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="stat-card">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="stat-icon bg-secondary-light text-secondary">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-muted block uppercase font-bold">Venta Actual</span>
                    <strong className="text-xl block">{formatCLP(currentSale)}</strong>
                    {history.length > 1 && (
                      <span className={`text-xs font-semibold ${saleDiff >= 0 ? 'text-success' : 'text-danger'}`}>
                        {saleDiff >= 0 ? '▲' : '▼'} {Math.abs(saleDiffPct).toFixed(1)}% (desde inicio)
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="stat-card">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="stat-icon bg-success-light text-success">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-muted block uppercase font-bold">Margen Actual</span>
                    <strong className="text-xl block text-success">{margin.toFixed(1)}%</strong>
                    <span className="text-xs text-muted">Utilidad: {formatCLP(currentSale - currentCost)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="stat-card">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="stat-icon bg-info-light text-info">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-muted block uppercase font-bold">Última Compra</span>
                    <strong className="text-sm block font-semibold">
                      {latestEntry ? new Date(latestEntry.purchase_date + 'T12:00:00').toLocaleDateString('es-CL') : 'Sin registros'}
                    </strong>
                    <span className="text-xs text-muted block">
                      {latestEntry ? `Boleta N° ${latestEntry.invoice_number}` : 'N/A'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Price evolution table */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-lg text-gray-800">Evolución Cronológica de Compras y Precios</h3>
                <p className="text-xs text-muted">Listado ordenado con las compras cargadas desde boletas de proveedor</p>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-8 text-muted">
                    No se registran compras para este producto en las boletas guardadas.
                  </div>
                ) : (
                  <div className="table-responsive-wrapper">
                    <Table style={{ minWidth: '700px' }}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha Compra</TableHead>
                          <TableHead>N° Boleta</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead className="text-center">Cant. Comprada</TableHead>
                          <TableHead className="text-right">Costo Neto Unit.</TableHead>
                          <TableHead className="text-right">Costo Bruto Unit.</TableHead>
                          <TableHead className="text-right">Precio Venta (Momento)</TableHead>
                          <TableHead className="text-right">Margen Ganancia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((entry, index) => {
                          const itemMargin = entry.sale_price > 0 ? ((entry.sale_price - entry.gross_price) / entry.sale_price) * 100 : 0;
                          return (
                            <TableRow key={index} className="history-row">
                              <TableCell className="font-medium">
                                {new Date(entry.purchase_date + 'T12:00:00').toLocaleDateString('es-CL')}
                              </TableCell>
                              <TableCell className="font-semibold text-primary">{entry.invoice_number}</TableCell>
                              <TableCell>{entry.supplier}</TableCell>
                              <TableCell className="text-center font-bold">{entry.quantity}</TableCell>
                              <TableCell className="text-right">{formatCLP(entry.net_price)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCLP(entry.gross_price)}</TableCell>
                              <TableCell className="text-right font-bold text-success">{formatCLP(entry.sale_price)}</TableCell>
                              <TableCell className="text-right">
                                <span className={`badge-margin ${itemMargin > 0 ? 'positive' : 'negative'}`}>
                                  {itemMargin.toFixed(1)}%
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Price flow details */}
            {history.length > 1 && (
              <Card className="p-4 bg-gray-50 border border-gray-100 rounded-lg">
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Resumen de Cambios</h4>
                <div className="flex items-center gap-6 text-sm text-gray-600 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span>Costo Bruto:</span>
                    <strong>{formatCLP(initialCost)}</strong>
                    <ArrowRight size={14} className="text-gray-400" />
                    <strong>{formatCLP(currentCost)}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Precio Venta:</span>
                    <strong>{formatCLP(initialSale)}</strong>
                    <ArrowRight size={14} className="text-gray-400" />
                    <strong>{formatCLP(currentSale)}</strong>
                  </div>
                  <div>
                    <span>Total de veces comprado:</span> <strong className="text-primary">{history.length}</strong>
                  </div>
                </div>
              </Card>
            )}

          </div>
        )
      ) : (
        <Card className="py-12 border-dashed border-2">
          <CardContent className="text-center text-muted">
            <TrendingUp size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="font-medium">Por favor, busca y selecciona un producto arriba para visualizar la evolución de sus precios.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
