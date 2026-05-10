import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ShieldAlert, AlertTriangle, RefreshCcw, Database } from 'lucide-react';

export function Sistema() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetReset, setTargetReset] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const resetOptions = [
    { id: 'ventas', label: 'Reiniciar Ventas', desc: 'Borra todo el historial de ventas, tickets y turnos de caja.', color: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'inventario', label: 'Reiniciar Inventario', desc: 'Borra todos los productos y el historial de movimientos de bodega. (Incluye ventas).', color: 'text-red-600', bg: 'bg-red-50' },
    { id: 'movimientos', label: 'Reiniciar Movimientos', desc: 'Borra solo el historial de entradas y salidas de stock.', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { id: 'usuarios', label: 'Reiniciar Usuarios', desc: 'Restablece contraseñas a "123456" y quita permisos a todos (excepto Admin).', color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'todo', label: 'Restablecer de Fábrica (TODO)', desc: 'Borra ABSOLUTAMENTE TODO el sistema, dejándolo como el primer día.', color: 'text-red-700 font-bold', bg: 'bg-red-100 border-red-300' }
  ];

  const handleOpenModal = (id: string) => {
    setTargetReset(id);
    setConfirmText('');
    setIsModalOpen(true);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== 'CONFIRMAR' || !targetReset) {
      alert('Debes escribir la palabra CONFIRMAR en mayúsculas.');
      return;
    }

    setIsProcessing(true);
    const { error } = await supabase.rpc('reset_system_data', { target: targetReset });
    setIsProcessing(false);

    if (!error) {
      alert('Operación completada con éxito. El sistema ha sido reiniciado.');
      setIsModalOpen(false);
      // Optional: force reload to clean cache
      window.location.reload();
    } else {
      alert('Error crítico al intentar restablecer los datos: ' + error.message);
    }
  };

  const selectedOption = resetOptions.find(o => o.id === targetReset);

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-danger">
            <ShieldAlert size={28} />
            Administración del Sistema
          </h1>
          <p className="text-muted">Área restringida. Operaciones destructivas de base de datos.</p>
        </div>
      </div>

      <Card className="border-danger">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-danger">
            <Database size={20} />
            Mantenimiento y Reinicio de Datos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-col gap-4">
          <p className="text-sm mb-4">
            Utiliza estas opciones para limpiar la base de datos durante periodos de prueba o inicio de un nuevo año fiscal. <strong>Estas acciones son irreversibles.</strong>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {resetOptions.map(opt => (
              <div key={opt.id} className={`p-4 rounded-lg border ${opt.bg} flex flex-col justify-between`}>
                <div>
                  <h3 className={`font-bold text-lg mb-1 ${opt.color}`}>{opt.label}</h3>
                  <p className="text-sm text-gray-700 mb-4">{opt.desc}</p>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full bg-white text-danger border-danger hover:bg-danger hover:text-white transition-colors"
                  onClick={() => handleOpenModal(opt.id)}
                >
                  <RefreshCcw size={16} />
                  Ejecutar {opt.label}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => !isProcessing && setIsModalOpen(false)} title="Confirmación de Seguridad" width="sm">
        <form onSubmit={handleReset} className="flex-col gap-4">
          <div className="flex items-start gap-3 bg-red-50 text-red-800 p-4 rounded-md border border-red-200">
            <AlertTriangle size={24} className="flex-shrink-0 text-red-600" />
            <div>
              <p className="font-bold mb-1">¡ATENCIÓN!</p>
              <p className="text-sm">Estás a punto de <strong>{selectedOption?.label}</strong>. Esta acción borrará datos reales de la base de datos y no se puede deshacer.</p>
            </div>
          </div>
          
          <div className="mt-2">
            <p className="text-sm mb-2 font-medium">Para continuar, escribe la palabra <strong className="text-danger">CONFIRMAR</strong> en mayúsculas:</p>
            <Input 
              required 
              value={confirmText} 
              onChange={e => setConfirmText(e.target.value)} 
              placeholder="Escribe CONFIRMAR aquí..."
              fullWidth
              autoComplete="off"
            />
          </div>

          <Button 
            type="submit" 
            variant="primary" 
            fullWidth 
            className="mt-2 bg-red-600 hover:bg-red-700 text-white border-red-600"
            disabled={confirmText !== 'CONFIRMAR' || isProcessing}
          >
            {isProcessing ? 'Procesando...' : 'Sí, borrar los datos'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
