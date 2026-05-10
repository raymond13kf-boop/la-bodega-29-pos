
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DollarSign, ShoppingBag, AlertTriangle, TrendingUp } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export function Dashboard() {
  const { user } = useAuthStore();

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
              <h3 className="text-xl font-bold">$145.900</h3>
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
              <h3 className="text-xl font-bold">24</h3>
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
              <h3 className="text-xl font-bold">5 Productos</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-secondary)', borderRadius: 'var(--border-radius-md)' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">Más Vendido</p>
              <h3 className="text-lg font-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Detergente OMO</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted text-center" style={{ padding: 'var(--space-8) 0' }}>No hay movimientos recientes hoy.</p>
        </CardContent>
      </Card>
    </div>
  );
}
