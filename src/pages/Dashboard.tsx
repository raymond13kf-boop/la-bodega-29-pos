import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DollarSign, ShoppingBag, AlertTriangle, TrendingUp, Package, ArrowRightLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
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
  
  const [ventasHoy, setVentasHoy] = useState(0);
  const [ticketsHoy, setTicketsHoy] = useState(0);
  const [stockBajo, setStockBajo] = useState(0);
  const [masVendido, setMasVendido] = useState<string>('Calculando...');
  const [movimientos, setMovimientos] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    try {
      // 1. Ventas y Tickets de Hoy
      const { data: salesData } = await supabase
        .from('sales')
        .select('id, total, created_at, status, users(full_name)')
        .gte('created_at', todayISO);

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

      // 2. Stock Bajo
      const { count: stockBajoCount } = await supabase
        .from('products')
        .select('id', { count: 'exact' })
        .eq('active', true)
        .lte('stock', 'min_stock');
        
      setStockBajo(stockBajoCount || 0);

      // 3. Más Vendido Hoy
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
          setMasVendido('Sin ventas hoy');
        }
      } else {
        setMasVendido('Sin ventas hoy');
      }

      // 4. Movimientos de Bodega Recientes
      const { data: inventoryData } = await supabase
        .from('inventory_movements')
        .select('id, type, quantity, reason, created_at, products(name), users(full_name)')
        .order('created_at', { ascending: false })
        .limit(20);

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

      // Combinar y ordenar movimientos (más recientes primero)
      const allMovements = [...salesMovements, ...invMovements]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 15); // Mostrar los últimos 15

      setMovimientos(allMovements);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Resumen de Hoy</h1>
          <p className="text-muted">Bienvenido de nuevo, {user?.full_name}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <Card>
          <CardContent style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--border-radius-md)' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Ventas del Día</p>
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
                          {mov.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {mov.details}
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
