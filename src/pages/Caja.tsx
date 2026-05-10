import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Lock, Unlock, DollarSign, Clock } from 'lucide-react';

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

  useEffect(() => {
    checkActiveRegister();
  }, []);

  const checkActiveRegister = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      setActiveRegister(data);
    } else {
      setActiveRegister(null);
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
    
    const difference = finalBalance - activeRegister.initial_balance; // Simplified calculation for MVP

    const { error } = await supabase
      .from('cash_registers')
      .update({
        closed_by: user?.id,
        closed_at: new Date().toISOString(),
        final_balance: finalBalance,
        expected_balance: activeRegister.initial_balance, // Real POS would sum sales here
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
                <div className="flex justify-between">
                  <span className="text-muted flex items-center gap-1"><Clock size={16}/> Apertura:</span>
                  <span className="font-medium">{new Date(activeRegister.opened_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Monto Inicial:</span>
                  <span className="font-medium">{formatCLP(activeRegister.initial_balance)}</span>
                </div>
              </div>

              <CurrencyInput 
                label="Efectivo Final en Caja (Arqueo)" 
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
