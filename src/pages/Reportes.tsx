import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Download, FileText } from 'lucide-react';

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

export function Reportes() {
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map(sale => (
                  <TableRow key={sale.id}>
                    <TableCell>{new Date(sale.created_at).toLocaleString()}</TableCell>
                    <TableCell>{sale.users?.full_name || 'Desconocido'}</TableCell>
                    <TableCell className="capitalize">{sale.payment_method}</TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatCLP(sale.total)}
                    </TableCell>
                  </TableRow>
                ))}
                {sales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted">
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
