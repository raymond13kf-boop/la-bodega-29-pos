import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Modal } from '../components/ui/Modal';
import { Plus, Search, Trash2, Eye, PlusCircle } from 'lucide-react';
import './Boletas.css';

interface BoletaItem {
  id: string; // product id
  name: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  net_price: number;
  gross_price: number;
  total: number;
}

interface Boleta {
  id: string;
  invoice_number: string;
  purchase_date: string;
  supplier: string;
  payment_method: 'efectivo' | 'debito' | 'credito' | 'otro';
  amount_paid: number;
  total_amount: number;
  items: BoletaItem[];
}

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

export function Boletas() {
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBoleta, setSelectedBoleta] = useState<Boleta | null>(null);

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'debito' | 'credito' | 'otro'>('efectivo');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [manualTotalAmount, setManualTotalAmount] = useState<number>(0);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addedItems, setAddedItems] = useState<BoletaItem[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const totalAmount = addedItems.length > 0 ? getBoletaTotal() : manualTotalAmount;

  useEffect(() => {
    fetchProducts();
    loadBoletas();
  }, []);

  // Fetch active products to allow selecting them
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
      console.error('Error fetching products for boletas:', e);
    }
  };

  // Load boletas from local storage
  const loadBoletas = () => {
    setIsLoading(true);
    const stored = localStorage.getItem('pos_boletas');
    if (stored) {
      try {
        setBoletas(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing stored boletas:', e);
        setBoletas([]);
      }
    } else {
      setBoletas([]);
    }
    setIsLoading(false);
  };

  const handleOpenRegisterModal = () => {
    setInvoiceNumber('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setSupplier('');
    setPaymentMethod('efectivo');
    setAmountPaid(0);
    setManualTotalAmount(0);
    setSelectedProductId(products.length > 0 ? products[0].id : '');
    setAddedItems([]);
    setFormErrors({});
    setIsRegisterModalOpen(true);
  };

  const handleAddProduct = () => {
    if (!selectedProductId) return;

    // Check if product is already added
    const alreadyExists = addedItems.find(item => item.id === selectedProductId);
    if (alreadyExists) {
      alert('Este producto ya ha sido agregado a la boleta. Edite su cantidad en la tabla.');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const newItem: BoletaItem = {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      quantity: 1,
      net_price: 0,
      gross_price: 0,
      total: 0
    };

    setAddedItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (productId: string) => {
    setAddedItems(prev => prev.filter(item => item.id !== productId));
  };

  // Update item field directly from editable table
  const handleUpdateItemField = (productId: string, field: 'quantity' | 'net_price' | 'gross_price', value: number) => {
    setAddedItems(prev =>
      prev.map(item => {
        if (item.id === productId) {
          const updatedItem = { ...item, [field]: value };
          // Calculate total for this item: quantity * gross_price
          updatedItem.total = updatedItem.quantity * updatedItem.gross_price;
          return updatedItem;
        }
        return item;
      })
    );
  };

  const getBoletaTotal = () => {
    return addedItems.reduce((acc, item) => acc + item.total, 0);
  };

  const handleOpenDetailModal = (boleta: Boleta) => {
    setSelectedBoleta(boleta);
    setIsDetailModalOpen(true);
  };

  const handleSaveBoleta = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!invoiceNumber.trim()) errors.invoiceNumber = 'El número de boleta es obligatorio';
    if (!purchaseDate) errors.purchaseDate = 'La fecha de compra es obligatoria';
    if (!supplier.trim()) errors.supplier = 'El proveedor es obligatorio';
    
    if (addedItems.length === 0 && manualTotalAmount <= 0) {
      errors.manualTotalAmount = 'Debe ingresar un monto total para la boleta';
    }

    const negativeCheck = addedItems.some(item => item.quantity <= 0 || item.net_price < 0 || item.gross_price < 0);
    if (negativeCheck) {
      errors.items = 'Las cantidades deben ser mayores a 0 y los precios no pueden ser menores a 0';
    }

    if (amountPaid < 0) {
      errors.amountPaid = 'El monto pagado no puede ser menor a 0';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      // Show first error as alert
      const firstError = Object.values(errors)[0];
      alert(`Error al guardar: ${firstError}`);
      return;
    }

    const newBoleta: Boleta = {
      id: `bol-${Date.now()}`,
      invoice_number: invoiceNumber.trim(),
      purchase_date: purchaseDate,
      supplier: supplier.trim(),
      payment_method: paymentMethod,
      amount_paid: amountPaid,
      total_amount: totalAmount,
      items: addedItems
    };

    // Save to local storage list
    const updatedBoletas = [newBoleta, ...boletas];
    localStorage.setItem('pos_boletas', JSON.stringify(updatedBoletas));
    setBoletas(updatedBoletas);

    // Close Modal and Show Success
    setIsRegisterModalOpen(false);
    setManualTotalAmount(0);
    alert('Boleta registrada administrativamente con éxito.');
  };

  // Filter boletas by Supplier or Invoice Number
  const filteredBoletas = boletas.filter(b => 
    b.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.invoice_number.includes(searchTerm)
  );

  return (
    <div className="boletas-container flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Módulo Boletas</h1>
          <p className="text-muted">Gestión y registro administrativo de boletas de compra de mercadería</p>
        </div>
        <div>
          <Button variant="primary" onClick={handleOpenRegisterModal}>
            <Plus size={18} />
            Registrar Boleta
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="w-full" style={{ maxWidth: '400px' }}>
            <Input 
              placeholder="Buscar por proveedor o número de boleta..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search size={18} />}
              fullWidth
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted">Cargando boletas...</div>
          ) : filteredBoletas.length === 0 ? (
            <div className="text-center py-8 text-muted">No se registran boletas de compra.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Boleta</TableHead>
                  <TableHead>Fecha Compra</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Forma Pago</TableHead>
                  <TableHead className="text-right">Monto Pagado</TableHead>
                  <TableHead className="text-right">Total Boleta</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBoletas.map(boleta => (
                  <TableRow key={boleta.id}>
                    <TableCell className="font-semibold">{boleta.invoice_number}</TableCell>
                    <TableCell>{new Date(boleta.purchase_date + 'T12:00:00').toLocaleDateString('es-CL')}</TableCell>
                    <TableCell>{boleta.supplier}</TableCell>
                    <TableCell>
                      <span className={`badge-payment ${boleta.payment_method}`}>
                        {boleta.payment_method === 'debito' ? 'Débito' : 
                         boleta.payment_method === 'credito' ? 'Crédito' : 
                         boleta.payment_method === 'efectivo' ? 'Efectivo' : 'Otro'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCLP(boleta.amount_paid)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatCLP(boleta.total_amount)}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="text-primary" onClick={() => handleOpenDetailModal(boleta)}>
                        <Eye size={16} style={{ marginRight: '4px' }} /> Ver Detalles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal - Registrar Boleta */}
      <Modal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} title="Registrar Boleta de Compra" width="lg">
        <form onSubmit={handleSaveBoleta} className="flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: 'var(--space-2)' }}>
            <Input 
              label="Número de Boleta" 
              required 
              value={invoiceNumber} 
              onChange={e => setInvoiceNumber(e.target.value)} 
              error={formErrors.invoiceNumber}
              fullWidth 
            />
            <Input 
              label="Fecha de Compra" 
              type="date" 
              required 
              value={purchaseDate} 
              onChange={e => setPurchaseDate(e.target.value)} 
              error={formErrors.purchaseDate}
              fullWidth 
            />
            <Input 
              label="Proveedor" 
              required 
              value={supplier} 
              onChange={e => setSupplier(e.target.value)} 
              error={formErrors.supplier}
              fullWidth 
            />
          </div>

          <div className={`grid grid-cols-1 ${addedItems.length === 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`} style={{ marginBottom: 'var(--space-4)' }}>
            <div className="input-group w-full">
              <label className="input-label">Forma de Pago</label>
              <select 
                className="input-field" 
                value={paymentMethod} 
                onChange={e => setPaymentMethod(e.target.value as any)}
                required
              >
                <option value="efectivo">Efectivo</option>
                <option value="debito">Tarjeta de Débito</option>
                <option value="credito">Tarjeta de Crédito</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <CurrencyInput 
              label="Monto Pagado" 
              required 
              value={amountPaid} 
              onChange={val => setAmountPaid(val)} 
              fullWidth 
            />
            {addedItems.length === 0 && (
              <CurrencyInput 
                label="Monto Total de Boleta" 
                required 
                value={manualTotalAmount} 
                onChange={val => setManualTotalAmount(val)} 
                fullWidth 
              />
            )}
          </div>

          {/* Product Selection Row */}
          <div className="product-selector-wrapper">
            <h3 className="font-semibold mb-2 flex items-center gap-1 text-sm text-primary">
              <PlusCircle size={16} /> Agregar Producto a la Boleta
            </h3>
            <div className="product-selector-row">
              <div className="flex-grow min-w-[200px]" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: 2 }}>
                <label className="input-label text-xs">Seleccione Producto</label>
                {products.length === 0 ? (
                  <select className="input-field" disabled>
                    <option>Cargando catálogo...</option>
                  </select>
                ) : (
                  <select 
                    className="input-field" 
                    value={selectedProductId}
                    onChange={e => setSelectedProductId(e.target.value)}
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.barcode ? `(${p.barcode})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <Button type="button" variant="outline" onClick={handleAddProduct} style={{ height: '38px' }}>
                Añadir Ítem
              </Button>
            </div>
          </div>

          {/* Added items list */}
          <div>
            <h3 className="font-semibold mb-2 text-sm text-gray-700">Ítems Seleccionados</h3>
            
            <div className="items-table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead style={{ width: '100px' }}>Cantidad</TableHead>
                    <TableHead style={{ width: '130px' }}>Precio Neto</TableHead>
                    <TableHead style={{ width: '130px' }}>Precio Bruto</TableHead>
                    <TableHead className="text-right" style={{ width: '120px' }}>Total</TableHead>
                    <TableHead className="text-center" style={{ width: '60px' }}></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addedItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{item.name}</div>
                        {item.sku && <div className="text-xs text-muted mt-0.5">SKU: {item.sku}</div>}
                      </TableCell>
                      <TableCell>
                        <input 
                          type="number"
                          className="input-field text-center text-sm"
                          style={{ padding: '4px', margin: 0 }}
                          min="1"
                          required
                          value={item.quantity}
                          onWheel={e => e.currentTarget.blur()}
                          onKeyDown={e => {
                            if (['ArrowUp', 'ArrowDown', 'e', 'E', '+', '-', '.', ','].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onChange={e => handleUpdateItemField(item.id, 'quantity', e.target.value === '' ? 1 : Math.max(1, Number(e.target.value)))}
                        />
                      </TableCell>
                      <TableCell>
                        <input 
                          type="number"
                          className="input-field text-right text-sm"
                          style={{ padding: '4px', margin: 0 }}
                          min="0"
                          required
                          value={item.net_price}
                          onWheel={e => e.currentTarget.blur()}
                          onKeyDown={e => {
                            if (['ArrowUp', 'ArrowDown', 'e', 'E', '+', '-'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onChange={e => handleUpdateItemField(item.id, 'net_price', e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                        />
                      </TableCell>
                      <TableCell>
                        <input 
                          type="number"
                          className="input-field text-right text-sm"
                          style={{ padding: '4px', margin: 0 }}
                          min="0"
                          required
                          value={item.gross_price}
                          onWheel={e => e.currentTarget.blur()}
                          onKeyDown={e => {
                            if (['ArrowUp', 'ArrowDown', 'e', 'E', '+', '-'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          onChange={e => handleUpdateItemField(item.id, 'gross_price', e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {formatCLP(item.total)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => handleRemoveItem(item.id)}>
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {addedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted text-sm">
                        No se han añadido productos a la boleta. Utilice el selector superior.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="items-table-footer">
                <span>Total General de la Boleta:</span>
                <span className="items-table-footer-val">{formatCLP(totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <Button variant="outline" type="button" onClick={() => setIsRegisterModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar Boleta
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal - Ver Detalles Boleta */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Detalles de Boleta de Compra" width="md">
        {selectedBoleta && (
          <div className="boleta-detail-modal">
            <div className="boleta-detail-grid">
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Número de Boleta</span>
                <span className="boleta-detail-value font-bold text-primary">{selectedBoleta.invoice_number}</span>
              </div>
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Fecha de Compra</span>
                <span className="boleta-detail-value">
                  {new Date(selectedBoleta.purchase_date + 'T12:00:00').toLocaleDateString('es-CL')}
                </span>
              </div>
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Proveedor</span>
                <span className="boleta-detail-value font-medium">{selectedBoleta.supplier}</span>
              </div>
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Forma de Pago</span>
                <span className="boleta-detail-value capitalize">
                  {selectedBoleta.payment_method === 'debito' ? 'Tarjeta Débito' : 
                   selectedBoleta.payment_method === 'credito' ? 'Tarjeta Crédito' : 
                   selectedBoleta.payment_method === 'efectivo' ? 'Efectivo' : 'Otro'}
                </span>
              </div>
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Monto Pagado</span>
                <span className="boleta-detail-value font-semibold">{formatCLP(selectedBoleta.amount_paid)}</span>
              </div>
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Total General</span>
                <span className="boleta-detail-value total">{formatCLP(selectedBoleta.total_amount)}</span>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-2)' }}>
              <h3 className="font-semibold mb-2 text-sm text-gray-700">Productos Comprados</h3>
              <div className="items-table-container">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center" style={{ width: '80px' }}>Cant.</TableHead>
                      <TableHead className="text-right" style={{ width: '110px' }}>P. Neto</TableHead>
                      <TableHead className="text-right" style={{ width: '110px' }}>P. Bruto</TableHead>
                      <TableHead className="text-right" style={{ width: '120px' }}>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedBoleta.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted text-sm">
                          Esta boleta no tiene productos registrados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedBoleta.items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{item.name}</div>
                            {item.sku && <div className="text-xs text-muted">SKU: {item.sku}</div>}
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCLP(item.net_price)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCLP(item.gross_price)}</TableCell>
                          <TableCell className="text-right font-bold text-primary">{formatCLP(item.total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Cerrar Ventana
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
