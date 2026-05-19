import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DollarSign, ShoppingBag, AlertTriangle, TrendingUp, Package, ArrowRightLeft, Archive } from 'lucide-react';
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
  type: 'venta' | 'entrada' | 'salida' | 'ajuste';
  title: string;
  amount?: number;
  quantity?: number;
  date: Date;
  details: string;
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
      const { data: salesData } = await supabase
        .from('sales')
        .select('id, total, created_at, status, users(full_name)')
        .gte('created_at', startISO)
        .lte('created_at', endISO);

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
            details: `Ticket #${sale.id.slice(0, 8)} • ${isVoided ? 'Anulada por: ' : 'Vendió: '}${sellerName}`
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

      // Combinar y ordenar movimientos (más recientes primero, límite 100)
      const allMovements = [...salesMovements, ...invMovements]
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
            Movimientos Recientes (Ventas e Inventario)
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
                
                let iconBg = 'rgba(249, 115, 22, 0.1)';
                let iconColor = 'var(--color-warning)';
                if (isVenta) { iconBg = 'rgba(16, 185, 129, 0.1)'; iconColor = 'var(--color-success)'; }
                if (isEntrada) { iconBg = 'rgba(59, 130, 246, 0.1)'; iconColor = 'var(--color-primary)'; }
                if (isAnulacion) { iconBg = 'rgba(239, 68, 68, 0.1)'; iconColor = 'var(--color-danger)'; }
                
                return (
                  <div key={`${mov.id}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4)', borderBottom: i < movimientos.length - 1 ? '1px solid var(--color-border)' : 'none', backgroundColor: 'var(--color-surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                      <div style={{ padding: 'var(--space-2)', borderRadius: '50%', backgroundColor: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isVenta ? <DollarSign size={18} /> : isAnulacion ? <AlertTriangle size={18} /> : <Package size={18} />}
                      </div>
                      <div>
                        <h4 style={{ fontWeight: 600, fontSize: 'var(--text-sm)', margin: 0, color: 'var(--color-text-main)' }}>{mov.title}</h4>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                          {mov.date.toLocaleDateString()} {mov.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {mov.details}
                        </p>
                      </div>
                    </div>
                    <div style={{ fontWeight: 'bold', color: iconColor }}>
                      {isVenta && mov.amount ? `+${formatCLP(mov.amount)}` : 
                       isAnulacion && mov.amount ? `-${formatCLP(mov.amount)}` :
                       isEntrada ? `+${mov.quantity} ud.` : 
                       `-${mov.quantity} ud.`}
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
