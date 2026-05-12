import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Download, Ban, TrendingUp, AlertTriangle, PackageX, DollarSign, BarChart3, Clock } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount || 0);
};

export function Reportes() {
  const [activeTab, setActiveTab] = useState<'resumen' | 'ventas' | 'anulaciones' | 'stock'>('resumen');
  
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  // Modal anulación
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [saleToVoid, setSaleToVoid] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');

  // Métricas
  const [metrics, setMetrics] = useState({
    ventasDia: 0, ventasSemana: 0, ventasMes: 0, ventasAno: 0,
    ingresosTotales: 0, perdidasAnulaciones: 0, totalAnuladas: 0,
    masVendido: { name: '-', qty: 0 },
    menosVendido: { name: '-', qty: 0 },
    sinStock: 0, bajoStock: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch Sales
    const { data: salesData } = await supabase
      .from('sales')
      .select('*, users(full_name), sale_items(quantity, price, products(name))')
      .order('created_at', { ascending: false });

    // Fetch Products
    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('active', true);

    if (salesData) setSales(salesData);
    if (productsData) setProducts(productsData);

    calculateMetrics(salesData || [], productsData || []);
    
    setIsLoading(false);
  };

  const calculateMetrics = (allSales: any[], allProducts: any[]) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let vDia = 0, vSemana = 0, vMes = 0, vAno = 0;
    let iTotales = 0, pAnulaciones = 0, tAnuladas = 0;
    const productSales: Record<string, number> = {};

    allSales.forEach(s => {
      const d = new Date(s.created_at);
      const isVoided = s.status === 'anulada';
      const total = Number(s.total) || 0;

      if (isVoided) {
        tAnuladas++;
        pAnulaciones += total;
      } else {
        iTotales += total;
        if (d >= startOfDay) vDia += total;
        if (d >= startOfWeek) vSemana += total;
        if (d >= startOfMonth) vMes += total;
        if (d >= startOfYear) vAno += total;

        s.sale_items?.forEach((item: any) => {
          const name = item.products?.name;
          if (name) {
            productSales[name] = (productSales[name] || 0) + Number(item.quantity);
          }
        });
      }
    });

    let maxQty = -1, minQty = Infinity;
    let maxName = '-', minName = '-';

    // Para evitar que los que no se han vendido no aparezcan, iteramos sobre los productos activos también
    allProducts.forEach(p => {
      const qty = productSales[p.name] || 0;
      if (qty > maxQty) { maxQty = qty; maxName = p.name; }
      if (qty < minQty) { minQty = qty; minName = p.name; }
    });

    const sStock = allProducts.filter(p => p.stock <= 0).length;
    const bStock = allProducts.filter(p => p.stock > 0 && p.stock <= (p.min_stock || 5)).length;

    setMetrics({
      ventasDia: vDia, ventasSemana: vSemana, ventasMes: vMes, ventasAno: vAno,
      ingresosTotales: iTotales, perdidasAnulaciones: pAnulaciones, totalAnuladas: tAnuladas,
      masVendido: { name: maxName, qty: maxQty },
      menosVendido: { name: minName, qty: minQty === Infinity ? 0 : minQty },
      sinStock: sStock, bajoStock: bStock
    });
  };

  const openVoidModal = (sale: any) => {
    if (!user?.permissions?.can_manage_system && user?.role !== 'admin') {
      alert('No tienes permisos para anular ventas.');
      return;
    }
    setSaleToVoid(sale);
    setVoidReason('');
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason.trim() || !saleToVoid) return;

    try {
      // 1. Marcar como anulada (Requiere correr la migración SQL para tener estas columnas)
      const { error: updateError } = await supabase.from('sales').update({ 
        status: 'anulada',
        void_reason: voidReason,
        voided_by: user?.id,
        voided_at: new Date().toISOString()
      }).eq('id', saleToVoid.id);

      if (updateError) {
        alert("Atención: Para guardar el motivo necesitas ejecutar la migración SQL en tu base de datos. Se procederá a guardar en el historial de movimientos de inventario alternativamente.");
      }

      // 2. Traer los items
      const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', saleToVoid.id);
      
      if (items) {
        // 3. Revertir stock y crear trazabilidad obligatoria en inventario
        for (const item of items) {
          const { data: p } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
          if (p) {
            await supabase.from('products').update({ stock: p.stock + item.quantity }).eq('id', item.product_id);
          }
          await supabase.from('inventory_movements').insert([{
            product_id: item.product_id,
            type: 'entrada',
            quantity: item.quantity,
            reason: `Anulación #${saleToVoid.id.slice(0,8)} - Motivo: ${voidReason}`
          }]);
        }
      }

      alert('Venta anulada correctamente.');
      setIsVoidModalOpen(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Error anulando la venta.');
    }
  };

  const renderTabButton = (id: any, label: string, icon: any) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
        activeTab === id 
        ? 'bg-primary text-white shadow-md transform scale-105 border border-transparent' 
        : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200 shadow-sm'
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes Avanzados</h1>
          <p className="text-gray-500 mt-1">Métricas, historial y control de inventario</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white">
            <Download size={18} className="mr-2" /> Exportar Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pb-2">
        {renderTabButton('resumen', 'Resumen General', <BarChart3 size={18} />)}
        {renderTabButton('ventas', 'Historial de Ventas', <Clock size={18} />)}
        {renderTabButton('anulaciones', 'Bitácora Anulaciones', <Ban size={18} />)}
        {renderTabButton('stock', 'Control de Stock', <PackageX size={18} />)}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Generando reportes...</div>
      ) : (
        <div className="mt-4">
          
          {/* TAB: RESUMEN GENERAL */}
          {activeTab === 'resumen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className="bg-white shadow-sm"><CardContent className="p-4">
                <div className="text-sm text-gray-500 font-medium">Ventas de Hoy</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{formatCLP(metrics.ventasDia)}</div>
              </CardContent></Card>
              <Card className="bg-white shadow-sm"><CardContent className="p-4">
                <div className="text-sm text-gray-500 font-medium">Ventas Semana</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{formatCLP(metrics.ventasSemana)}</div>
              </CardContent></Card>
              <Card className="bg-white shadow-sm"><CardContent className="p-4">
                <div className="text-sm text-gray-500 font-medium">Ventas Mes</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{formatCLP(metrics.ventasMes)}</div>
              </CardContent></Card>
              <Card className="bg-white shadow-sm"><CardContent className="p-4">
                <div className="text-sm text-gray-500 font-medium">Ventas Año</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{formatCLP(metrics.ventasAno)}</div>
              </CardContent></Card>
              
              <Card className="bg-green-50 border-green-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-700 font-medium mb-1"><DollarSign size={18}/> Ingresos Totales (Neto)</div>
                <div className="text-2xl font-bold text-green-800">{formatCLP(metrics.ingresosTotales)}</div>
              </CardContent></Card>
              <Card className="bg-red-50 border-red-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-700 font-medium mb-1"><TrendingUp size={18}/> Más Vendido</div>
                <div className="text-xl font-bold text-red-800 truncate">{metrics.masVendido.name}</div>
                <div className="text-xs text-red-600 mt-1">{metrics.masVendido.qty} unidades vendidas</div>
              </CardContent></Card>
              <Card className="bg-orange-50 border-orange-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-orange-700 font-medium mb-1"><AlertTriangle size={18}/> Alerta Stock Crítico</div>
                <div className="text-xl font-bold text-orange-800">{metrics.sinStock} Sin Stock</div>
                <div className="text-xs text-orange-600 mt-1">{metrics.bajoStock} Por agotarse</div>
              </CardContent></Card>
              <Card className="bg-gray-50 border-gray-200"><CardContent className="p-4">
                <div className="flex items-center gap-2 text-gray-700 font-medium mb-1"><Ban size={18}/> Pérdida por Anulaciones</div>
                <div className="text-xl font-bold text-gray-800">{formatCLP(metrics.perdidasAnulaciones)}</div>
                <div className="text-xs text-gray-600 mt-1">{metrics.totalAnuladas} ventas anuladas</div>
              </CardContent></Card>
            </div>
          )}

          {/* TAB: HISTORIAL VENTAS */}
          {activeTab === 'ventas' && (
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Fecha / Hora</TableHead>
                      <TableHead>Vendedor / Origen</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.filter(s => s.status !== 'anulada').map(sale => (
                      <TableRow key={sale.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium text-gray-700">{new Date(sale.created_at).toLocaleString()}</TableCell>
                        <TableCell>{sale.users?.full_name || 'E-commerce Web'}</TableCell>
                        <TableCell className="capitalize text-gray-600">{sale.payment_method}</TableCell>
                        <TableCell><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Completada</span></TableCell>
                        <TableCell className="text-right font-bold text-gray-900">{formatCLP(sale.total)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => openVoidModal(sale)}>
                            <Ban size={16} className="mr-1" /> Anular
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* TAB: BITACORA ANULACIONES */}
          {activeTab === 'anulaciones' && (
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Fecha de Venta</TableHead>
                      <TableHead>ID Venta</TableHead>
                      <TableHead>Monto Anulado</TableHead>
                      <TableHead>Motivo / Justificación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.filter(s => s.status === 'anulada').map(sale => (
                      <TableRow key={sale.id} className="bg-red-50/30">
                        <TableCell className="text-gray-600">{new Date(sale.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-xs text-gray-500">{sale.id.slice(0, 8)}</TableCell>
                        <TableCell className="font-bold text-red-600">{formatCLP(sale.total)}</TableCell>
                        <TableCell className="text-sm italic text-gray-600">{sale.void_reason || 'Anulado (Razón guardada en log de inventario)'}</TableCell>
                      </TableRow>
                    ))}
                    {sales.filter(s => s.status === 'anulada').length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No hay ventas anuladas en el registro.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* TAB: CONTROL DE STOCK */}
          {activeTab === 'stock' && (
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Stock Actual</TableHead>
                      <TableHead>Mínimo Permitido</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.sort((a,b) => a.stock - b.stock).map(p => {
                      const isCritical = p.stock <= 0;
                      const isWarning = p.stock > 0 && p.stock <= (p.min_stock || 5);
                      
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>
                            <span className={`font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-orange-500' : 'text-green-600'}`}>
                              {p.stock}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-500">{p.min_stock || 5}</TableCell>
                          <TableCell>
                            {isCritical ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <PackageX size={12} className="mr-1"/> Sin Stock
                              </span>
                            ) : isWarning ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                <AlertTriangle size={12} className="mr-1"/> Bajo Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Normal
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

        </div>
      )}

      {/* MODAL ANULAR VENTA OBLIGATORIO */}
      <Modal isOpen={isVoidModalOpen} onClose={() => setIsVoidModalOpen(false)} title="Anulación de Venta (Requerido)">
        <form onSubmit={handleConfirmVoid} className="flex flex-col gap-4">
          <div className="bg-red-50 p-4 rounded-md border border-red-100">
            <h4 className="text-red-800 font-semibold mb-1">¡Atención! Acción Irreversible</h4>
            <p className="text-red-600 text-sm">
              Estás a punto de anular la venta <strong>#{saleToVoid?.id.slice(0,8)}</strong> por un total de <strong>{formatCLP(saleToVoid?.total)}</strong>.<br/>
              Los productos serán devueltos al inventario.
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700">Motivo de Anulación <span className="text-red-500">*</span></label>
            <textarea 
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              rows={3}
              placeholder="Ej: Cliente se arrepintió, error en cobro, producto defectuoso..."
              required
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
            />
            <p className="text-xs text-gray-500">Este motivo quedará guardado en la bitácora de auditoría.</p>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" type="button" onClick={() => setIsVoidModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" className="bg-red-600 hover:bg-red-700 border-none text-white">Confirmar Anulación</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
