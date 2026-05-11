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
        .select('id, total, created_at')
        .gte('created_at', todayISO);

      let totalVentas = 0;
      let totalTickets = 0;
      const salesMovements: Movement[] = [];

      if (salesData) {
        totalVentas = salesData.reduce((acc, sale) => acc + Number(sale.total), 0);
        totalTickets = salesData.length;
        
        salesData.forEach(sale => {
          salesMovements.push({
            id: sale.id,
            type: 'venta',
            title: 'Nueva Venta',
            amount: Number(sale.total),
            date: new Date(sale.created_at),
            details: `Ticket #${sale.id.slice(0, 8)}`
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
        .select('id, type, quantity, reason, created_at, products(name)')
        .order('created_at', { ascending: false })
        .limit(20);

      const invMovements: Movement[] = [];
      if (inventoryData) {
        inventoryData.forEach(inv => {
          const prodName = (inv.products as any)?.name || 'Producto';
          invMovements.push({
            id: inv.id,
            type: inv.type as any,
            title: `${inv.type === 'entrada' ? 'Ingreso' : 'Salida'}: ${prodName}`,
            quantity: Number(inv.quantity),
            date: new Date(inv.created_at),
            details: inv.reason || 'Sin motivo'
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
            <div className="flex-col gap-0 border rounded-md overflow-hidden">
              {movimientos.map((mov, i) => (
                <div key={`${mov.id}-${i}`} className="flex justify-between items-center p-4 border-b last:border-b-0 bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      mov.type === 'venta' ? 'bg-green-100 text-green-700' :
                      mov.type === 'entrada' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {mov.type === 'venta' ? <DollarSign size={18} /> : <Package size={18} />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{mov.title}</h4>
                      <p className="text-xs text-muted">
                        {mov.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {mov.details}
                      </p>
                    </div>
                  </div>
                  <div className={`font-bold ${
                    mov.type === 'venta' ? 'text-success' : 
                    mov.type === 'entrada' ? 'text-primary' : 
                    'text-danger'
                  }`}>
                    {mov.type === 'venta' && mov.amount ? `+${formatCLP(mov.amount)}` : 
                     mov.type === 'entrada' ? `+${mov.quantity} ud.` : 
                     `-${mov.quantity} ud.`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
