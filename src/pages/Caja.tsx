import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Lock, Unlock, Clock } from 'lucide-react';

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

export function Caja() {
  const { user } = useAuthStore();
  const [activeRegister, setActiveRegister] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Additional states for calculations
  const [ventasEfectivo, setVentasEfectivo] = useState(0);
  const [ventasTarjeta, setVentasTarjeta] = useState(0);
  const [ventasTransferencia, setVentasTransferencia] = useState(0);
  const [totalRecaudado, setTotalRecaudado] = useState(0);
  const [saldoArrastre, setSaldoArrastre] = useState(0);
  const [expectedCash, setExpectedCash] = useState(0);

  useEffect(() => {
    checkActiveRegister();
  }, []);

  const checkActiveRegister = async () => {
    setIsLoading(true);
    const { data: openRegister, error } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && openRegister) {
      setActiveRegister(openRegister);

      // 1. Fetch last closed register to calculate arrastre
      const { data: lastClosed } = await supabase
        .from('cash_registers')
        .select('final_balance')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1)
        .single();
      
      const lastFinalBalance = lastClosed?.final_balance || 0;
      const arrastre = lastFinalBalance - openRegister.initial_balance;
      setSaldoArrastre(arrastre);

      // 2. Fetch sales for this register
      const { data: salesData } = await supabase
        .from('sales')
        .select('total, payment_method, status')
        .eq('cash_register_id', openRegister.id)
        .neq('status', 'anulada');

      let vEfectivo = 0;
      let vTarjeta = 0;
      let vTransf = 0;

      if (salesData) {
        salesData.forEach(sale => {
          const total = Number(sale.total) || 0;
          if (sale.payment_method === 'tarjeta') vTarjeta += total;
          else if (sale.payment_method === 'transferencia') vTransf += total;
          else vEfectivo += total; // Default fallback is efectivo
        });
      }

      setVentasEfectivo(vEfectivo);
      setVentasTarjeta(vTarjeta);
      setVentasTransferencia(vTransf);
      
      const totalVentas = vEfectivo + vTarjeta + vTransf;
      setTotalRecaudado(totalVentas);

      setExpectedCash(openRegister.initial_balance + vEfectivo);
    } else {
      setActiveRegister(null);
      setVentasEfectivo(0);
      setVentasTarjeta(0);
      setVentasTransferencia(0);
      setTotalRecaudado(0);
      setExpectedCash(0);
      setSaldoArrastre(0);
    }
    setIsLoading(false);
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('cash_registers')
      .insert([{
        opened_by: user?.id,
        initial_balance: initialBalance,
        status: 'open'
      }]);
      
    if (!error) {
      alert('Caja abierta exitosamente');
      checkActiveRegister();
    } else {
      alert('Error al abrir la caja');
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRegister) return;
    
    const difference = finalBalance - expectedCash;

    const { error } = await supabase
      .from('cash_registers')
      .update({
        closed_by: user?.id,
        closed_at: new Date().toISOString(),
        final_balance: finalBalance,
        expected_balance: expectedCash,
        difference: difference,
        status: 'closed'
      })
      .eq('id', activeRegister.id);

    if (!error) {
      alert('Caja cerrada exitosamente. Diferencia: ' + formatCLP(difference));
      setActiveRegister(null);
    } else {
      alert('Error al cerrar la caja');
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted">Cargando estado de caja...</div>;

  return (
    <div className="flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Gestión de Caja</h1>
          <p className="text-muted">Apertura y cierre de turnos</p>
        </div>
      </div>

      {!activeRegister ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Unlock size={20} className="text-warning" />
              Abrir Nueva Caja
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleOpenRegister}>
            <CardContent className="flex-col gap-4">
              <p className="text-muted mb-4">No hay un turno de caja abierto actualmente. Ingresa el monto inicial para comenzar a vender.</p>
              
              <CurrencyInput 
                label="Monto Inicial en Efectivo" 
                required 
                value={initialBalance}
                onChange={val => setInitialBalance(val)}
                fullWidth
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="primary" fullWidth size="lg">
                Abrir Turno
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock size={20} className="text-success" />
              Caja Abierta
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleCloseRegister}>
            <CardContent className="flex-col gap-4">
              <div className="bg-gray-50 p-4 rounded-md mb-4 flex-col gap-2">
                <div className="flex justify-between border-b pb-2 mb-2">
                  <span className="text-muted flex items-center gap-1"><Clock size={16}/> Apertura:</span>
                  <span className="font-medium">{new Date(activeRegister.opened_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Monto Inicial:</span>
                  <span className="font-medium">{formatCLP(activeRegister.initial_balance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Saldo Sobrante / Arrastrado:</span>
                  <span className={`font-medium ${saldoArrastre !== 0 ? 'text-primary' : ''}`}>
                    {formatCLP(saldoArrastre)}
                  </span>
                </div>
              </div>

              <div className="bg-white border p-4 rounded-md mb-4 flex-col gap-2 shadow-sm">
                <h3 className="font-bold mb-2">Ventas del Turno</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Efectivo:</span>
                  <span>{formatCLP(ventasEfectivo)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Tarjeta:</span>
                  <span>{formatCLP(ventasTarjeta)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Transferencias:</span>
                  <span>{formatCLP(ventasTransferencia)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t mt-2">
                  <span>Total Recaudado General:</span>
                  <span className="text-primary">{formatCLP(totalRecaudado)}</span>
                </div>
              </div>

              <div className="bg-green-50 border border-green-100 p-4 rounded-md mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-green-800">Total Esperado en Caja (Efectivo):</span>
                  <span className="text-xl font-bold text-green-700">{formatCLP(expectedCash)}</span>
                </div>
                <p className="text-xs text-green-600 mt-1">Monto Inicial + Ventas en Efectivo</p>
              </div>

              <CurrencyInput 
                label="Efectivo Final en Caja (Arqueo Físico)" 
                required 
                value={finalBalance}
                onChange={val => setFinalBalance(val)}
                fullWidth
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="danger" fullWidth size="lg">
                Cerrar Caja
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
