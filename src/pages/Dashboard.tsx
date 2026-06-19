import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DollarSign, ShoppingBag, AlertTriangle, TrendingUp, Package, ArrowRightLeft, Archive, Trash2, Lock, Unlock } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface Movement {
  id: string;
  type: 'venta' | 'entrada' | 'salida' | 'ajuste' | 'caja_apertura' | 'caja_cierre';
  title: string;
  amount?: number;
  quantity?: number;
  date: Date;
  details: string;
  paymentMethod?: string;
}

export function Dashboard() {
  const { user } = useAuthStore();
  
  const todayStr = getLocalDateString(new Date());
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [ventasHoy, setVentasHoy] = useState(0);
  const [ticketsHoy, setTicketsHoy] = useState(0);
  const [stockBajo, setStockBajo] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [masVendido, setMasVendido] = useState<string>('Calculando...');
  const [movimientos, setMovimientos] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [startDate, endDate]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    try {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59.999');
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      // 1. Ventas y Tickets del Periodo
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('id, total, created_at, status, payment_method, users(full_name)')
        .gte('created_at', startISO)
        .lte('created_at', endISO);

      if (salesError) {
        alert('Error cargando ventas (Dashboard): ' + salesError.message);
      }

      let totalVentas = 0;
      let totalTickets = 0;
      const salesMovements: Movement[] = [];

      if (salesData) {
        const completedSales = salesData.filter(s => s.status !== 'anulada');
        totalVentas = completedSales.reduce((acc, sale) => acc + Number(sale.total), 0);
        totalTickets = completedSales.length;
        
        salesData.forEach(sale => {
          const isVoided = sale.status === 'anulada';
          const sellerName = (sale.users as any)?.full_name || 'E-commerce';
          salesMovements.push({
            id: sale.id,
            type: isVoided ? 'ajuste' : 'venta',
            title: isVoided ? 'Venta Anulada' : 'Nueva Venta',
            amount: Number(sale.total),
            date: new Date(sale.created_at),
            details: `Ticket #${sale.id.slice(0, 8)} • ${isVoided ? 'Anulada por: ' : 'Vendió: '}${sellerName}`,
            paymentMethod: (sale as any).payment_method
          });
        });
      }
      setVentasHoy(totalVentas);
      setTicketsHoy(totalTickets);

      // 2. Stock Bajo y Total (Siempre tiempo real actual)
      const { data: stockData } = await supabase
        .from('products')
        .select('stock, min_stock')
        .eq('active', true);
        
      const calculatedStockBajo = stockData ? stockData.filter(p => p.stock <= p.min_stock).length : 0;
      const calculatedTotalStock = stockData ? stockData.reduce((acc, p) => acc + (p.stock || 0), 0) : 0;
      
      setStockBajo(calculatedStockBajo);
      setTotalStock(calculatedTotalStock);

      // 3. Más Vendido en el Periodo
      if (salesData && salesData.length > 0) {
        const saleIds = salesData.map(s => s.id);
        const { data: itemsData } = await supabase
          .from('sale_items')
          .select('quantity, products(name)')
          .in('sale_id', saleIds);
          
        if (itemsData && itemsData.length > 0) {
          const productCounts: Record<string, number> = {};
          itemsData.forEach(item => {
            const name = (item.products as any)?.name || 'Producto Desconocido';
            productCounts[name] = (productCounts[name] || 0) + Number(item.quantity);
          });
          
          let topProduct = 'Ninguno';
          let maxQty = 0;
          for (const [name, qty] of Object.entries(productCounts)) {
            if (qty > maxQty) {
              maxQty = qty;
              topProduct = name;
            }
          }
          setMasVendido(topProduct);
        } else {
          setMasVendido('Sin ventas en el periodo');
        }
      } else {
        setMasVendido('Sin ventas en el periodo');
      }

      // 4. Movimientos de Bodega en el Periodo
      const { data: inventoryData } = await supabase
        .from('inventory_movements')
        .select('id, type, quantity, reason, created_at, products(name), users(full_name)')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false });

      const invMovements: Movement[] = [];
      if (inventoryData) {
        inventoryData.forEach(inv => {
          const prodName = (inv.products as any)?.name || 'Producto';
          const userName = (inv.users as any)?.full_name || 'Sistema';
          invMovements.push({
            id: inv.id,
            type: inv.type as any,
            title: `${inv.type === 'entrada' ? 'Ingreso' : 'Salida'}: ${prodName}`,
            quantity: Number(inv.quantity),
            date: new Date(inv.created_at),
            details: `Por: ${userName} • ${inv.reason || 'Sin motivo'}`
          });
        });
      }

      // 4.5. Aperturas y Cierres de Caja en el Periodo
      const { data: registersData } = await supabase
        .from('cash_registers')
        .select(`
          id, 
          opened_at, 
          closed_at, 
          initial_balance, 
          final_balance, 
          difference,
          opened_by_user:users!cash_registers_opened_by_fkey(full_name), 
          closed_by_user:users!cash_registers_closed_by_fkey(full_name)
        `);

      const regMovements: Movement[] = [];
      if (registersData) {
        registersData.forEach(reg => {
          const openedDate = new Date(reg.opened_at);
          if (openedDate >= start && openedDate <= end) {
            const userName = (Array.isArray(reg.opened_by_user) 
              ? reg.opened_by_user[0]?.full_name 
              : (reg.opened_by_user as any)?.full_name) || 'Desconocido';
            regMovements.push({
              id: `open-${reg.id}`,
              type: 'caja_apertura',
              title: 'Apertura de Caja',
              amount: Number(reg.initial_balance),
              date: openedDate,
              details: `Monto inicial: ${formatCLP(reg.initial_balance)} • Responsable: ${userName}`
            });
          }

          if (reg.closed_at) {
            const closedDate = new Date(reg.closed_at);
            if (closedDate >= start && closedDate <= end) {
              const userName = (Array.isArray(reg.closed_by_user) 
                ? reg.closed_by_user[0]?.full_name 
                : (reg.closed_by_user as any)?.full_name) || 'Desconocido';
              const diff = Number(reg.difference) || 0;
              const diffText = diff === 0 ? 'Cuadrada' : diff > 0 ? `Sobrante: +${formatCLP(diff)}` : `Faltante: ${formatCLP(diff)}`;
              regMovements.push({
                id: `close-${reg.id}`,
                type: 'caja_cierre',
                title: 'Cierre de Caja',
                amount: Number(reg.final_balance),
                date: closedDate,
                details: `Arqueo real: ${formatCLP(reg.final_balance)} (${diffText}) • Responsable: ${userName}`
              });
            }
          }
        });
      }

      // Combinar y ordenar movimientos (más recientes primero, límite 100)
      const allMovements = [...salesMovements, ...invMovements, ...regMovements]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 100);

      setMovimientos(allMovements);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFilter = (days: number | 'month') => {
    const today = new Date();
    const end = getLocalDateString(today);
    let start = end;
    
    if (days === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      start = getLocalDateString(firstDay);
    } else if (typeof days === 'number') {
      const past = new Date();
      past.setDate(today.getDate() - days);
      start = getLocalDateString(past);
    }
    
    setStartDate(start);
    setEndDate(end);
  };

  const handleDeleteMovement = async (id: string) => {
    if (user?.role !== 'admin') {
      alert('Error: No tienes permisos para realizar esta acción.');
      return;
    }

    if (window.confirm('¿Estás seguro de que deseas eliminar este movimiento de inventario? Esta acción no se puede deshacer.')) {
      try {
        const { error } = await supabase
          .from('inventory_movements')
          .delete()
          .eq('id', id);

        if (error) {
          console.error("Error al eliminar el movimiento:", error);
          alert('Hubo un error al intentar eliminar el movimiento: ' + error.message);
        } else {
          fetchDashboardData();
        }
      } catch (err) {
        console.error("Excepción al eliminar el movimiento:", err);
        alert('Ocurrió un error inesperado al intentar eliminar el movimiento.');
      }
    }
  };

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Resumen de {startDate === endDate && startDate === todayStr ? 'Hoy' : 'Periodo'}</h1>
          <p className="text-muted">Bienvenido de nuevo, {user?.full_name}</p>
        </div>
      </div>

      {/* Rango de Fechas y Filtro */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardContent style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-4)', flex: 1 }}>
              <div style={{ minWidth: '160px', flex: '1 1 0%' }}>
                <Input 
                  label="Fecha Desde" 
                  type="date" 
                  value={startDate} 
                  max={endDate}
                  onChange={e => setStartDate(e.target.value)} 
                  fullWidth
                />
              </div>
              <div style={{ minWidth: '160px', flex: '1 1 0%' }}>
                <Input 
                  label="Fecha Hasta" 
                  type="date" 
                  value={endDate} 
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)} 
                  fullWidth
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignSelf: 'flex-end' }}>
              <Button 
                variant={startDate === todayStr && endDate === todayStr ? 'primary' : 'outline'} 
                size="sm" 
                onClick={() => handleQuickFilter(0)}
              >
                Hoy
              </Button>
              <Button 
                variant={
                  startDate === getLocalDateString(new Date(new Date().setDate(new Date().getDate() - 6))) && 
                  endDate === todayStr ? 'primary' : 'outline'
                } 
                size="sm" 
                onClick={() => handleQuickFilter(6)}
              >
                Últimos 7 días
              </Button>
              <Button 
                variant={
                  startDate === getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) && 
                  endDate === todayStr ? 'primary' : 'outline'
                } 
                size="sm" 
                onClick={() => handleQuickFilter('month')}
              >
                Este mes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <Card>
          <CardContent style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--border-radius-md)' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Ventas del {startDate === endDate && startDate === todayStr ? 'Día' : 'Periodo'}</p>
              <h3 className="text-xl font-bold">{isLoading ? '...' : formatCLP(ventasHoy)}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-primary)', color: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)' }}>
              <ShoppingBag size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Tickets Generados</p>
              <h3 className="text-xl font-bold">{isLoading ? '...' : ticketsHoy}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderRadius: 'var(--border-radius-md)' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Stock Bajo</p>
              <h3 className="text-xl font-bold">{isLoading ? '...' : `${stockBajo} Productos`}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: 'rgb(139, 92, 246)', borderRadius: 'var(--border-radius-md)' }}>
              <Archive size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Artículos en Almacén</p>
              <h3 className="text-xl font-bold">{isLoading ? '...' : `${totalStock} Unidades`}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-secondary)', borderRadius: 'var(--border-radius-md)' }}>
              <TrendingUp size={24} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p className="text-sm text-muted">Más Vendido</p>
              <h3 className="text-lg font-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isLoading ? '...' : masVendido}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft size={20} />
            Movimientos Recientes (Ventas, Inventario y Caja)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted text-center" style={{ padding: 'var(--space-8) 0' }}>Cargando actividad...</p>
          ) : movimientos.length === 0 ? (
            <p className="text-muted text-center" style={{ padding: 'var(--space-8) 0' }}>No hay movimientos registrados.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
              {movimientos.map((mov, i) => {
                const isVenta = mov.type === 'venta';
                const isEntrada = mov.type === 'entrada';
                const isAnulacion = mov.title === 'Venta Anulada';
                const isApertura = mov.type === 'caja_apertura';
                const isCierre = mov.type === 'caja_cierre';
                
                let iconBg = 'rgba(249, 115, 22, 0.1)';
                let iconColor = 'var(--color-warning)';
                if (isVenta) { iconBg = 'rgba(16, 185, 129, 0.1)'; iconColor = 'var(--color-success)'; }
                if (isEntrada) { iconBg = 'rgba(59, 130, 246, 0.1)'; iconColor = 'var(--color-primary)'; }
                if (isAnulacion) { iconBg = 'rgba(239, 68, 68, 0.1)'; iconColor = 'var(--color-danger)'; }
                if (isApertura) { iconBg = 'rgba(234, 179, 8, 0.1)'; iconColor = 'var(--color-warning)'; }
                if (isCierre) { iconBg = 'rgba(107, 114, 128, 0.1)'; iconColor = '#71717a'; }
                
                return (
                  <div key={`${mov.id}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4)', borderBottom: i < movimientos.length - 1 ? '1px solid var(--color-border)' : 'none', backgroundColor: 'var(--color-surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <div style={{ padding: 'var(--space-2)', borderRadius: '50%', backgroundColor: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isVenta ? <DollarSign size={18} /> : 
                         isAnulacion ? <AlertTriangle size={18} /> : 
                         isApertura ? <Unlock size={18} /> : 
                         isCierre ? <Lock size={18} /> : 
                         <Package size={18} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <h4 style={{ fontWeight: 600, fontSize: 'var(--text-sm)', margin: 0, color: 'var(--color-text-main)' }}>{mov.title}</h4>
                          {isVenta && mov.paymentMethod && (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: mov.paymentMethod === 'efectivo' 
                                ? 'rgba(16, 185, 129, 0.15)' 
                                : mov.paymentMethod === 'tarjeta'
                                ? 'rgba(59, 130, 246, 0.15)'
                                : 'rgba(139, 92, 246, 0.15)',
                              color: mov.paymentMethod === 'efectivo' 
                                ? 'var(--color-success)' 
                                : mov.paymentMethod === 'tarjeta'
                                ? 'var(--color-secondary)'
                                : 'rgb(139, 92, 246)',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}>
                              {mov.paymentMethod === 'efectivo' ? 'Efectivo' : mov.paymentMethod === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                          {mov.date.toLocaleDateString()} {mov.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {mov.details}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <div style={{ fontWeight: 'bold', color: isCierre ? 'var(--color-text-main)' : iconColor }}>
                        {isVenta && mov.amount ? `+${formatCLP(mov.amount)}` : 
                         isAnulacion && mov.amount ? `-${formatCLP(mov.amount)}` :
                         isApertura && mov.amount ? `${formatCLP(mov.amount)}` :
                         isCierre && mov.amount ? `${formatCLP(mov.amount)}` :
                         isEntrada ? `+${mov.quantity} ud.` : 
                         `-${mov.quantity} ud.`}
                      </div>
                      {user?.role === 'admin' && (mov.type === 'entrada' || mov.type === 'salida') && (
                        <button 
                          onClick={() => handleDeleteMovement(mov.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          title="Eliminar movimiento de inventario"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
