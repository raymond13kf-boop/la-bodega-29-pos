import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Download, FileText, Ban } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

export function Reportes() {
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*, users(full_name)')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (!error && data) {
      setSales(data);
    }
    setIsLoading(false);
  };

  const handleAnular = async (sale: any) => {
    if (!user?.permissions?.can_manage_system && user?.role !== 'admin') {
      alert('No tienes permisos para anular ventas.');
      return;
    }
    if (!confirm(`¿Seguro que deseas anular la venta #${sale.id.slice(0, 8)}? El stock será devuelto.`)) return;

    try {
      // 1. Marcar como anulada
      await supabase.from('sales').update({ status: 'anulada' }).eq('id', sale.id);

      // 2. Traer los items de la venta
      const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
      
      if (items) {
        // 3. Revertir stock y crear trazabilidad
        for (const item of items) {
          const { data: p } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
          if (p) {
            await supabase.from('products').update({ stock: p.stock + item.quantity }).eq('id', item.product_id);
          }
          await supabase.from('inventory_movements').insert([{
            product_id: item.product_id,
            type: 'entrada',
            quantity: item.quantity,
            reason: `Anulación venta #${sale.id.slice(0,8)}`
          }]);
        }
      }

      alert('Venta anulada correctamente.');
      fetchSales();
    } catch (e) {
      console.error(e);
      alert('Error anulando la venta.');
    }
  };

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted">Historial de ventas y movimientos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download size={18} />
            Exportar Excel
          </Button>
          <Button variant="outline">
            <FileText size={18} />
            Exportar PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted">Cargando reportes...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha / Hora</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map(sale => (
                  <TableRow key={sale.id} className={sale.status === 'anulada' ? 'opacity-50' : ''}>
                    <TableCell>{new Date(sale.created_at).toLocaleString()}</TableCell>
                    <TableCell>{sale.users?.full_name || 'Web'}</TableCell>
                    <TableCell className="capitalize">{sale.payment_method}</TableCell>
                    <TableCell>
                      <span className={sale.status === 'anulada' ? 'text-danger font-bold' : 'text-success font-bold'}>
                        {sale.status === 'anulada' ? 'Anulada' : 'Completada'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatCLP(sale.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {sale.status !== 'anulada' && (
                        <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleAnular(sale)}>
                          <Ban size={16} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {sales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted">
                      No hay ventas registradas.
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
