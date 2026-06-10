import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Search, TrendingUp, DollarSign, Calendar, ArrowRight, ArrowLeft, Eye } from 'lucide-react';
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
  
  // Navigation between master list and detail views
  const [activeView, setActiveView] = useState<'list' | 'detail'>('list');
  const [listSearch, setListSearch] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all active products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*, categories(name)')
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

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const filteredListProducts = products.filter(p =>
    p.name.toLowerCase().includes(listSearch.toLowerCase()) ||
    (p.barcode && p.barcode.includes(listSearch)) ||
    (p.sku && p.sku.toLowerCase().includes(listSearch.toLowerCase())) ||
    (p.categories?.name && p.categories.name.toLowerCase().includes(listSearch.toLowerCase()))
  );

  const handleSelectProductFromList = (productId: string) => {
    const product = products.find(p => p.id === productId);
    setSelectedProductId(productId);
    setProductSearch(product?.name || '');
    setActiveView('detail');
  };

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

      {activeView === 'list' ? (
        /* MASTER VIEW: List of all products */
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center w-full flex-wrap gap-4">
              <h3 className="font-semibold text-lg text-gray-800">Catálogo General de Productos</h3>
              <div className="w-full relative" style={{ maxWidth: '400px' }}>
                <Input 
                  placeholder="Buscar por nombre, código, SKU o categoría..." 
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  icon={<Search size={18} />}
                  fullWidth
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="table-responsive-wrapper">
              <Table style={{ minWidth: '800px' }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Costo Actual</TableHead>
                    <TableHead className="text-right">Precio Venta Actual</TableHead>
                    <TableHead className="text-right">Margen Actual</TableHead>
                    <TableHead className="text-center" style={{ width: '150px' }}>Historial</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredListProducts.map(p => {
                    const cost = p.cost_price || 0;
                    const sale = p.sale_price || 0;
                    const profit = sale - cost;
                    const pMargin = sale > 0 ? (profit / sale) * 100 : 0;

                    return (
                      <TableRow key={p.id} className="history-row">
                        <TableCell>
                          <div className="font-semibold text-gray-800">{p.name}</div>
                          <div className="text-xs text-muted mt-1">
                            Código: {p.barcode || 'N/A'} {p.sku ? `| SKU: ${p.sku}` : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                            {p.categories?.name || 'Sin categoría'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCLP(cost)}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{formatCLP(sale)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`badge-margin ${pMargin > 0 ? 'positive' : 'negative'}`}>
                            {pMargin.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" className="text-primary" onClick={() => handleSelectProductFromList(p.id)}>
                            <Eye size={16} style={{ marginRight: '4px' }} /> Ver Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredListProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted">
                        No se encontraron productos en el catálogo.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* DETAIL VIEW: Price evolution of selected product */
        <div className="flex-col gap-6">
          
          {/* Header Actions Card with fixed Autocomplete display (overflow visible) */}
          <Card style={{ overflow: 'visible' }}>
            <CardHeader className="flex justify-between items-center w-full flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setActiveView('list')}>
                  <ArrowLeft size={16} style={{ marginRight: '4px' }} /> Volver al Catálogo
                </Button>
              </div>

              {/* Autocomplete Search Dropdown - Fixed container styled to prevent clipping */}
              <div className="w-full relative search-container" ref={dropdownRef} style={{ maxWidth: '450px' }}>
                <div className="relative">
                  <Input
                    placeholder="Cambiar de producto..."
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
                    <div className="autocomplete-dropdown absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
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
                          No se encontraron productos.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {isLoadingHistory ? (
            <div className="text-center py-12 text-muted">Consultando historial en Supabase...</div>
          ) : (
            <div className="flex-col gap-6">
              
              {/* KPI Cards */}
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
                  <h3 className="font-semibold text-lg text-gray-800">Variación Histórica de Precios: <span className="text-primary">{selectedProduct?.name}</span></h3>
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
          )}
        </div>
      )}
    </div>
  );
}
