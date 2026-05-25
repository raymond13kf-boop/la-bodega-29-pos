import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Lock, Unlock, Clock, History, User, AlertCircle, CheckCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

export function Caja() {
  const { user } = useAuthStore();
  const [activeRegister, setActiveRegister] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Forms
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [finalBalance, setFinalBalance] = useState<number>(0);

  // Additional states for calculations
  const [ventasEfectivo, setVentasEfectivo] = useState(0);
  const [ventasTarjeta, setVentasTarjeta] = useState(0);
  const [ventasTransferencia, setVentasTransferencia] = useState(0);
  const [totalRecaudado, setTotalRecaudado] = useState(0);
  const [saldoArrastre, setSaldoArrastre] = useState(0);
  const [expectedCash, setExpectedCash] = useState(0);

  // History states
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // Action states to prevent double click
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    checkActiveRegister();
  }, []);

  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    const { data, error } = await supabase
      .from('cash_registers')
      .select(`
        *,
        opened_by_user:users!cash_registers_opened_by_fkey(full_name),
        closed_by_user:users!cash_registers_closed_by_fkey(full_name)
      `)
      .order('opened_at', { ascending: false })
      .limit(15);

    if (!error && data) {
      setHistory(data);
    } else {
      console.error("Error fetching cash registers history:", error);
    }
    setIsHistoryLoading(false);
  };

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
    // Also load history in the background
    fetchHistory();
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOpening) return;
    setIsOpening(true);

    try {
      // 1. Double check if there's already an active register to prevent concurrency
      const { data: activeReg } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('status', 'open')
        .limit(1);

      if (activeReg && activeReg.length > 0) {
        alert('Error: Ya existe un turno de caja abierto.');
        checkActiveRegister();
        setIsOpening(false);
        return;
      }

      const { error } = await supabase
        .from('cash_registers')
        .insert([{
          opened_by: user?.id,
          initial_balance: initialBalance,
          status: 'open'
        }]);
        
      if (!error) {
        alert('Caja abierta exitosamente');
        setInitialBalance(0);
        checkActiveRegister();
      } else {
        alert('Error al abrir la caja');
      }
    } catch (err) {
      console.error(err);
      alert('Error inesperado al abrir la caja');
    } finally {
      setIsOpening(false);
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRegister || isClosing) return;
    setIsClosing(true);
    
    try {
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
        setFinalBalance(0);
        setActiveRegister(null);
        checkActiveRegister();
      } else {
        alert('Error al cerrar la caja');
      }
    } catch (err) {
      console.error(err);
      alert('Error inesperado al cerrar la caja');
    } finally {
      setIsClosing(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted">Cargando estado de caja...</div>;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold text-primary">Gestión de Caja</h1>
          <p className="text-muted">Apertura, cierre e historial de turnos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {!activeRegister ? (
          <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-t-4 border-warning">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Unlock size={22} className="text-warning animate-bounce-subtle" />
                Abrir Nueva Caja
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleOpenRegister}>
              <CardContent className="flex flex-col gap-4">
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
                <Button type="submit" variant="primary" fullWidth size="lg" disabled={isOpening}>
                  {isOpening ? 'Abriendo Turno...' : 'Abrir Turno'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        ) : (
          <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-t-4 border-success">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock size={22} className="text-success" />
                Caja Abierta
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleCloseRegister}>
              <CardContent className="flex flex-col gap-4">
                <div className="bg-gray-50 p-4 rounded-md mb-4 flex flex-col gap-2 border border-gray-100">
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

                <div className="bg-white border p-4 rounded-md mb-4 flex flex-col gap-2 shadow-sm">
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
                <Button type="submit" variant="danger" fullWidth size="lg" disabled={isClosing}>
                  {isClosing ? 'Cerrando Caja...' : 'Cerrar Caja'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        <Card className="shadow-lg mt-6 border border-gray-100">
          <CardHeader className="flex justify-between items-center flex-row flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <History size={20} className="text-primary" />
              Historial de Turnos de Caja
            </CardTitle>
            <span className="badge-primary px-3 py-1 rounded-full text-xs font-semibold">
              Últimos 15 turnos
            </span>
          </CardHeader>
          <CardContent>
            {isHistoryLoading ? (
              <div className="text-center py-8 text-muted">Cargando historial de turnos...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted">No se registran turnos de caja anteriores.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apertura</TableHead>
                    <TableHead>Cierre</TableHead>
                    <TableHead className="text-right">Monto Inicial</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Arqueo Real</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((reg) => {
                    const diff = reg.difference || 0;
                    const isClosed = reg.status === 'closed';
                    
                    let diffColor = 'text-muted';
                    let diffLabel = '-';
                    let statusBadge = (
                      <span className="px-2 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-700 flex items-center justify-center gap-1 border border-blue-100">
                        En curso
                      </span>
                    );

                    if (isClosed) {
                      if (diff === 0) {
                        diffColor = 'text-success font-semibold';
                        diffLabel = 'Cuadrada';
                        statusBadge = (
                          <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-50 text-green-700 flex items-center justify-center gap-1 border border-green-100">
                            <CheckCircle size={12} /> Cuadrada
                          </span>
                        );
                      } else if (diff > 0) {
                        diffColor = 'text-success font-bold';
                        diffLabel = `+${formatCLP(diff)}`;
                        statusBadge = (
                          <span className="px-2 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center gap-1 border border-emerald-100">
                            Sobrante
                          </span>
                        );
                      } else {
                        diffColor = 'text-danger font-bold';
                        diffLabel = formatCLP(diff);
                        statusBadge = (
                          <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-50 text-red-700 flex items-center justify-center gap-1 border border-red-100">
                            <AlertCircle size={12} /> Faltante
                          </span>
                        );
                      }
                    }

                    return (
                      <TableRow key={reg.id} className={!isClosed ? 'bg-blue-50/10 hover:bg-blue-50/20' : 'hover:bg-gray-50/80 transition-colors'}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm">
                              {new Date(reg.opened_at).toLocaleDateString('es-CL')} {new Date(reg.opened_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-xs text-muted flex items-center gap-1">
                              <User size={12} className="text-gray-400" /> {reg.opened_by_user?.full_name || 'Desconocido'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isClosed && reg.closed_at ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-sm">
                                {new Date(reg.closed_at).toLocaleDateString('es-CL')} {new Date(reg.closed_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-xs text-muted flex items-center gap-1">
                                <User size={12} className="text-gray-400" /> {reg.closed_by_user?.full_name || 'Desconocido'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-blue-600 font-semibold italic flex items-center gap-1">
                              <Unlock size={12} /> Turno activo
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">{formatCLP(reg.initial_balance)}</TableCell>
                        <TableCell className="text-right font-medium text-sm text-gray-600">
                          {isClosed ? formatCLP(reg.expected_balance) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm">
                          {isClosed ? formatCLP(reg.final_balance) : '-'}
                        </TableCell>
                        <TableCell className={`text-right text-sm ${diffColor}`}>
                          {isClosed ? diffLabel : '-'}
                        </TableCell>
                        <TableCell className="text-center">{statusBadge}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
