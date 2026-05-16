import { useState, useEffect } from 'react';
import { usePosStore, type Product } from '../store/posStore';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Modal } from '../components/ui/Modal';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Receipt } from 'lucide-react';
import './Ventas.css';

// Helper for CLP format
const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

export function Ventas() {
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartSubtotal } = usePosStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo');
  const [isProcessing, setIsProcessing] = useState(false);
  const [entryDate, setEntryDate] = useState('');

  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Fetch all products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');
      if (!error && data) {
        setAllProducts(data);
      }
    };
    fetchProducts();
  }, []);

  // Instant local search
  useEffect(() => {
    if (!searchTerm) {
      setSearchResults(allProducts);
      return;
    }
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = allProducts.filter(p => 
      p.name.toLowerCase().includes(lowerTerm) || 
      (p.barcode && p.barcode.includes(lowerTerm)) || 
      (p.sku && p.sku.toLowerCase().includes(lowerTerm))
    );
    
    // Auto-add exact barcode match
    if (filtered.length === 1 && filtered[0].barcode === searchTerm) {
      addToCart(filtered[0]);
      setSearchTerm('');
      setSearchResults([]);
    } else {
      setSearchResults(filtered.slice(0, 15)); // Limit visual results to 15
    }
  }, [searchTerm, allProducts, addToCart]);

  // Handle responsive initial products limit
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine what to show in catalog
  const displayProducts = searchTerm 
    ? searchResults 
    : (isMobile ? allProducts.slice(0, 3) : allProducts);

  const handleProcessPayment = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // 1. Get active cash register
      const { data: activeRegister } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .single();

      if (!activeRegister) {
        alert('Error: No hay un turno de caja abierto. Ve a Caja para abrir turno.');
        return;
      }

      const userId = JSON.parse(localStorage.getItem('pos_session') || '{}').id;

      // 2. Create Sale
      const salePayload: any = {
        cash_register_id: activeRegister.id,
        user_id: userId,
        subtotal: getCartSubtotal(),
        total: getCartTotal(),
        payment_method: paymentMethod
      };

      if (entryDate) {
        salePayload.created_at = new Date(entryDate).toISOString();
      }

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([salePayload])
        .select()
        .single();

      if (saleError || !saleData) {
        alert('Error al guardar la venta');
        return;
      }

      // 3. Create Sale Items and reduce stock
      const itemsToInsert = cart.map(item => ({
        sale_id: saleData.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.sale_price,
        subtotal: item.subtotal,
        cost_price: item.cost_price || 0
      }));

      await supabase.from('sale_items').insert(itemsToInsert);

      // 4. Create Inventory Movements
      const movementsToInsert = cart.map(item => ({
        product_id: item.id,
        user_id: userId,
        type: 'salida',
        quantity: item.quantity,
        reason: `Venta #${saleData.id.slice(0, 8)}`,
        created_at: salePayload.created_at || new Date().toISOString()
      }));
      await supabase.from('inventory_movements').insert(movementsToInsert);

      // Update stock locally first to avoid UI jumps, DB handles actual update
      cart.forEach(async item => {
         const { data } = await supabase.from('products').select('stock').eq('id', item.id).single();
         if (data) {
            await supabase.from('products').update({ stock: data.stock - item.quantity }).eq('id', item.id);
         }
      });

      alert('Venta procesada con éxito!');
      clearCart();
      setPaymentModalOpen(false);
      setSearchTerm('');
      setAmountPaid('');
      setEntryDate('');
    } catch (error) {
      console.error(error);
      alert('Hubo un error inesperado al procesar la venta.');
    } finally {
      setIsProcessing(false);
    }
  };

  const total = getCartTotal();
  const change = typeof amountPaid === 'number' ? Math.max(0, amountPaid - total) : 0;
  const isPaidEnough = typeof amountPaid === 'number' && amountPaid >= total;

  return (
    <div className="pos-container">
      {/* Products Catalog Column */}
      <div className="pos-catalog">
        <Card className="h-full flex-col">
          <CardHeader>
            <Input 
              placeholder="Buscar producto o escanear código..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search size={18} />}
              fullWidth
              autoFocus
            />
          </CardHeader>
          <CardContent className="catalog-grid">
            {displayProducts.map(product => (
              <div key={product.id} className="product-card" onClick={() => addToCart(product)}>
                <div className="product-name">{product.name}</div>
                <div className="product-price">{formatCLP(product.sale_price)}</div>
                <div className="product-stock text-muted text-xs">Stock: {product.stock}</div>
              </div>
            ))}
            {searchResults.length === 0 && searchTerm && (
              <div className="text-center text-muted col-span-full py-8">
                No se encontraron productos
              </div>
            )}
            {allProducts.length === 0 && (
              <div className="text-center text-muted col-span-full py-8">
                Aún no hay productos en el inventario.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cart Column */}
      <div className="pos-cart-panel">
        <Card className="h-full flex-col">
          <CardHeader className="cart-header">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart size={20} />
              Carrito
            </CardTitle>
            <span className="cart-count badge-primary">{cart.length} ítems</span>
          </CardHeader>
          
          <CardContent className="cart-content">
            {cart.length === 0 ? (
              <div className="empty-cart">
                <ShoppingCart size={48} className="text-muted" style={{ opacity: 0.3 }} />
                <p>El carrito está vacío</p>
              </div>
            ) : (
              <div className="cart-items">
                {cart.map(item => (
                  <div key={item.id} className="cart-item">
                    <div className="item-info">
                      <div className="item-name font-semibold">{item.name}</div>
                      <div className="flex gap-4 text-xs mt-1">
                        <span className="text-muted">Precio: {formatCLP(item.sale_price)}</span>
                        <span className="text-info font-medium">Stock: {item.stock - item.quantity} rest.</span>
                      </div>
                    </div>
                    <div className="item-actions">
                      <div className="quantity-controls">
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                          <Minus size={14} />
                        </button>
                        <span className="qty-val">{item.quantity}</span>
                        <button className="qty-btn" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="item-subtotal font-semibold">
                        {formatCLP(item.subtotal)}
                      </div>
                      <button className="delete-btn text-danger" onClick={() => removeFromCart(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          <CardFooter className="cart-footer flex-col">
            <div className="cart-summary">
              <div className="summary-row">
                <span className="text-muted">Subtotal</span>
                <span>{formatCLP(getCartSubtotal())}</span>
              </div>
              <div className="summary-row total-row">
                <span>Total a Pagar</span>
                <span className="total-amount text-primary">{formatCLP(total)}</span>
              </div>
            </div>
            <div className="cart-actions w-full flex gap-2">
              <Button variant="outline" onClick={clearCart} disabled={cart.length === 0}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-grow" 
                size="lg"
                onClick={() => setPaymentModalOpen(true)}
                disabled={cart.length === 0}
              >
                Cobrar
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Procesar Pago" width="sm">
        <div className="payment-flow">
          <h2 className="text-2xl font-bold text-center mb-6">{formatCLP(total)}</h2>
          
          <div className="payment-methods flex gap-2 mb-6">
            <Button 
              variant={paymentMethod === 'efectivo' ? 'primary' : 'outline'} 
              className="flex-grow flex-col h-auto py-3 gap-1"
              onClick={() => setPaymentMethod('efectivo')}
            >
              <Banknote size={24} />
              <span className="text-xs">Efectivo</span>
            </Button>
            <Button 
              variant={paymentMethod === 'tarjeta' ? 'primary' : 'outline'} 
              className="flex-grow flex-col h-auto py-3 gap-1"
              onClick={() => {
                setPaymentMethod('tarjeta');
                setAmountPaid(total);
              }}
            >
              <CreditCard size={24} />
              <span className="text-xs">Tarjeta</span>
            </Button>
            <Button 
              variant={paymentMethod === 'transferencia' ? 'primary' : 'outline'} 
              className="flex-grow flex-col h-auto py-3 gap-1"
              onClick={() => {
                setPaymentMethod('transferencia');
                setAmountPaid(total);
              }}
            >
              <Receipt size={24} />
              <span className="text-xs">Transferencia</span>
            </Button>
          </div>

          {paymentMethod === 'efectivo' && (
            <div className="mb-6">
              <CurrencyInput 
                label="Monto Recibido" 
                required 
                value={amountPaid === '' ? 0 : amountPaid} 
                onChange={(val) => setAmountPaid(val)}
                fullWidth
                autoFocus
              />
              <div className="flex justify-between items-center mt-2 p-3 bg-gray-50 rounded-md">
                <span className="font-medium text-muted">Vuelto:</span>
                <span className={`text-xl font-bold ${change > 0 ? 'text-success' : ''}`}>
                  {formatCLP(change)}
                </span>
              </div>
            </div>
          )}

          <div className="mb-6">
            <Input 
              type="datetime-local"
              label="Fecha de Ingreso (Opcional)" 
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              fullWidth
            />
          </div>

          <Button 
            variant="primary" 
            fullWidth 
            size="lg" 
            onClick={handleProcessPayment}
            disabled={isProcessing || (paymentMethod === 'efectivo' && !isPaidEnough)}
          >
            {isProcessing ? 'Procesando...' : 'Confirmar Venta'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
