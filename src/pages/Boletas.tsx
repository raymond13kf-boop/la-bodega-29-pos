import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Modal } from '../components/ui/Modal';
import { Plus, Search, Trash2, Eye, PlusCircle, Edit2 } from 'lucide-react';
import './Boletas.css';

interface BoletaItem {
  id: string; // product id
  name: string;
  sku?: string;
  barcode?: string;
  quantity: number | '';
  net_price: number;
  gross_price: number;
  sale_price: number;
  total: number;
}

interface Boleta {
  id: string;
  invoice_number: string;
  purchase_date: string;
  supplier: string;
  payment_method: 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro';
  amount_paid: number;
  total_amount: number;
  items: BoletaItem[];
}

const formatCLP = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

export function Boletas() {
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Autocomplete Search State
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBoleta, setSelectedBoleta] = useState<Boleta | null>(null);

  // Sub-modals for Product Create/Edit (Unified)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productFormMode, setProductFormMode] = useState<'create' | 'edit'>('create');
  const [productFormData, setProductFormData] = useState({
    id: '',
    name: '',
    category_id: '',
    sku: '',
    barcode: '',
    cost_price: 0,
    sale_price: 0,
    min_stock: 5
  });

  // Modal to select product to update
  const [isSelectProductToUpdateOpen, setIsSelectProductToUpdateOpen] = useState(false);
  const [updateProductSearch, setUpdateProductSearch] = useState('');

  // Form State - Register Boleta
  const [editingBoletaId, setEditingBoletaId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'debito' | 'credito' | 'transferencia' | 'otro'>('efectivo');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [addedItems, setAddedItems] = useState<BoletaItem[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const getBoletaTotal = () => {
    return addedItems.reduce((acc, item) => acc + item.total, 0);
  };

  const totalAmount = getBoletaTotal();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    loadBoletas();
  }, []);

  // Migrar boletas locales de localStorage a Supabase para no perder historial previo
  useEffect(() => {
    if (products.length === 0) return;

    const migrateLocalBoletas = async () => {
      const stored = localStorage.getItem('pos_boletas');
      if (!stored) return;

      try {
        const localBoletas = JSON.parse(stored) as Boleta[];
        if (localBoletas.length === 0) return;

        console.log(`Iniciando migración de ${localBoletas.length} boletas locales a Supabase...`);

        for (const boleta of localBoletas) {
          // 1. Insertar cabecera de la boleta
          const { data: insertedBoleta, error: headerError } = await supabase
            .from('boletas')
            .insert([{
              invoice_number: boleta.invoice_number,
              purchase_date: boleta.purchase_date,
              supplier: boleta.supplier,
              payment_method: boleta.payment_method === 'otro' ? 'transferencia' : boleta.payment_method,
              amount_paid: boleta.amount_paid,
              total_amount: boleta.total_amount
            }])
            .select()
            .single();

          if (headerError || !insertedBoleta) {
            console.error('Error migrando cabecera de boleta:', boleta.invoice_number, headerError);
            continue;
          }

          // 2. Insertar ítems asociados
          if (boleta.items && boleta.items.length > 0) {
            const itemsToInsert = [];
            for (const item of boleta.items) {
              // Buscar producto existente por id, barcode o nombre
              let dbProduct = products.find(p => 
                p.id === item.id || 
                (item.barcode && p.barcode === item.barcode) || 
                p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
              );

              // Si el producto no existe en Supabase, lo creamos para cumplir FK
              if (!dbProduct) {
                try {
                  const { data: newProd, error: prodError } = await supabase
                    .from('products')
                    .insert([{
                      name: item.name,
                      sku: item.sku || `B29-${Math.floor(1000 + Math.random() * 9000)}`,
                      barcode: item.barcode || `780${Date.now().toString().slice(-9)}`,
                      cost_price: item.gross_price,
                      sale_price: item.sale_price || Math.round(item.gross_price * 1.3),
                      stock: 0,
                      min_stock: 5,
                      active: true
                    }])
                    .select()
                    .single();

                  if (!prodError && newProd) {
                    dbProduct = newProd;
                    setProducts(prev => [...prev, newProd]);
                  }
                } catch (pe) {
                  console.error('Error auto-creando producto durante migración:', pe);
                }
              }

              if (dbProduct) {
                itemsToInsert.push({
                  boleta_id: insertedBoleta.id,
                  product_id: dbProduct.id,
                  quantity: item.quantity,
                  net_price: item.net_price,
                  gross_price: item.gross_price,
                  sale_price: item.sale_price || dbProduct.sale_price || 0,
                  total: item.total
                });
              }
            }

            if (itemsToInsert.length > 0) {
              const { error: itemsError } = await supabase
                .from('boleta_items')
                .insert(itemsToInsert);

              if (itemsError) {
                console.error('Error migrando items de boleta:', boleta.invoice_number, itemsError);
              }
            }
          }
        }

        // Respaldar antes de eliminar
        localStorage.setItem('pos_boletas_migrated_backup', stored);
        localStorage.removeItem('pos_boletas');
        console.log('Migración de boletas completada con éxito.');
        loadBoletas();
      } catch (err) {
        console.error('Excepción en migración de boletas:', err);
      }
    };

    migrateLocalBoletas();
  }, [products]);

  // Fetch active products from Supabase
  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');
      if (!error && data) {
        setProducts(data);
      }
    } catch (e) {
      console.error('Error fetching products for boletas:', e);
    }
  };

  // Fetch categories from Supabase
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (!error && data) {
        setCategories(data);
      }
    } catch (e) {
      console.error('Error fetching categories for boletas:', e);
    }
  };

  // Load boletas from Supabase
  const loadBoletas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('boletas')
        .select(`
          *,
          boleta_items (
            *,
            products (
              name,
              sku,
              barcode
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedBoletas = data.map((b: any) => ({
          id: b.id,
          invoice_number: b.invoice_number,
          purchase_date: b.purchase_date,
          supplier: b.supplier,
          payment_method: b.payment_method,
          amount_paid: Number(b.amount_paid),
          total_amount: Number(b.total_amount),
          items: (b.boleta_items || []).map((item: any) => ({
            id: item.product_id,
            name: item.products?.name || 'Producto Eliminado',
            sku: item.products?.sku || '',
            barcode: item.products?.barcode || '',
            quantity: Number(item.quantity),
            net_price: Number(item.net_price),
            gross_price: Number(item.gross_price),
            sale_price: Number(item.sale_price),
            total: Number(item.total)
          }))
        }));
        setBoletas(mappedBoletas);
      }
    } catch (e) {
      console.error('Error al cargar boletas de Supabase:', e);
      alert('Error de conexión al cargar boletas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenRegisterModal = () => {
    setEditingBoletaId(null);
    setInvoiceNumber('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setSupplier('');
    setPaymentMethod('efectivo');
    setAmountPaid(0);
    setAddedItems([]);
    setProductSearch('');
    setFormErrors({});
    setIsRegisterModalOpen(true);
  };

  const handleOpenEditModal = (boleta: Boleta) => {
    setEditingBoletaId(boleta.id);
    setInvoiceNumber(boleta.invoice_number);
    setPurchaseDate(boleta.purchase_date);
    setSupplier(boleta.supplier);
    setPaymentMethod(boleta.payment_method);
    setAmountPaid(boleta.amount_paid);
    setAddedItems(boleta.items);
    setProductSearch('');
    setFormErrors({});
    setIsRegisterModalOpen(true);
  };

  const handleDeleteBoleta = async (boleta: Boleta) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar la factura/boleta N° ${boleta.invoice_number}? Se revertirá el stock de los productos ingresados en ella.`)) {
      return;
    }

    try {
      const userId = JSON.parse(localStorage.getItem('pos_session') || '{}').id;
      
      for (const item of boleta.items) {
        // Fetch current product stock
        const { data: prodData } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .single();
        
        const currentStock = prodData ? prodData.stock : 0;
        const newStock = Math.max(0, currentStock - Number(item.quantity));

        // Update stock
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.id);

        if (updateError) {
          console.error(`Error al revertir stock del producto ${item.name}:`, updateError);
        }

        // Create inventory movement record for reversion (type: 'salida')
        const { error: movementError } = await supabase
          .from('inventory_movements')
          .insert([{
            product_id: item.id,
            user_id: userId || null,
            type: 'salida',
            quantity: Number(item.quantity),
            reason: `Reversión por eliminación de Factura/Boleta N° ${boleta.invoice_number}`
          }]);

        if (movementError) {
          console.error(`Error al registrar movimiento de reversión del producto ${item.name}:`, movementError);
        }
      }

      // Delete boleta (cascades to boleta_items in DB)
      const { error } = await supabase
        .from('boletas')
        .delete()
        .eq('id', boleta.id);

      if (error) throw error;

      alert('Factura/Boleta eliminada correctamente.');
      loadBoletas();
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      alert('Error al eliminar factura/boleta: ' + err.message);
    }
  };

  const handleSelectProduct = (product: any) => {
    const alreadyExists = addedItems.find(item => item.id === product.id);
    if (alreadyExists) {
      alert('Este producto ya ha sido agregado a la boleta. Edite su cantidad en la tabla.');
      return;
    }

    const newItem: BoletaItem = {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      quantity: '',
      net_price: Math.round((product.cost_price || 0) / 1.19),
      gross_price: product.cost_price || 0,
      sale_price: product.sale_price || 0,
      total: 0
    };

    setAddedItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (productId: string) => {
    setAddedItems(prev => prev.filter(item => item.id !== productId));
  };

  // Update item field directly from editable table with auto VAT calculations
  const handleUpdateItemField = (productId: string, field: 'quantity' | 'net_price' | 'gross_price' | 'sale_price', value: number | '') => {
    setAddedItems(prev =>
      prev.map(item => {
        if (item.id === productId) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'net_price') {
            updatedItem.gross_price = Math.round(Number(value) * 1.19);
          } else if (field === 'gross_price') {
            updatedItem.net_price = Math.round(Number(value) / 1.19);
          }
          const qty = updatedItem.quantity === '' ? 0 : Number(updatedItem.quantity);
          updatedItem.total = qty * updatedItem.gross_price;
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleOpenDetailModal = (boleta: Boleta) => {
    setSelectedBoleta(boleta);
    setIsDetailModalOpen(true);
  };

  // Sub-modal: New Product handlers
  const handleOpenNewProductModal = () => {
    setProductFormData({
      id: '',
      name: '',
      category_id: categories.length > 0 ? categories[0].id : '',
      sku: `B29-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: `780${Date.now().toString().slice(-9)}`,
      cost_price: 0,
      sale_price: 0,
      min_stock: 5
    });
    setProductFormMode('create');
    setIsProductModalOpen(true);
  };

  const handleOpenSelectProductToUpdate = () => {
    setUpdateProductSearch('');
    setIsSelectProductToUpdateOpen(true);
  };

  // Sub-modal: Edit Product handlers
  const handleOpenEditProductModal = (item: BoletaItem) => {
    const product = products.find(p => p.id === item.id);
    setProductFormData({
      id: item.id,
      name: item.name,
      category_id: product?.category_id || (categories.length > 0 ? categories[0].id : ''),
      sku: item.sku || '',
      barcode: item.barcode || '',
      cost_price: product?.cost_price || 0,
      sale_price: item.sale_price,
      min_stock: product?.min_stock || 5
    });
    setProductFormMode('edit');
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productFormData.name.trim()) return alert('El nombre es obligatorio');
    if (!productFormData.barcode.trim()) return alert('El código de barras es obligatorio');

    // Check duplicate name
    const duplicate = products.some(p => 
      p.name.trim().toLowerCase() === productFormData.name.trim().toLowerCase() &&
      (productFormMode === 'create' || p.id !== productFormData.id)
    );
    if (duplicate) {
      alert(`Ya existe un producto con el nombre "${productFormData.name}".`);
      return;
    }

    try {
      if (productFormMode === 'create') {
        const payload = {
          name: productFormData.name.trim(),
          category_id: productFormData.category_id || null,
          sku: productFormData.sku.trim(),
          barcode: productFormData.barcode.trim(),
          cost_price: productFormData.cost_price,
          sale_price: productFormData.sale_price,
          stock: 0, // Starts at 0, updated on boleta save
          min_stock: productFormData.min_stock,
          active: true
        };

        const { data, error } = await supabase
          .from('products')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          // Refresh local cache list
          await fetchProducts();
          // Auto select newly created product
          handleSelectProduct(data);
          setIsProductModalOpen(false);
          alert('Producto creado en catálogo y agregado a la boleta.');
        }
      } else {
        const payload = {
          name: productFormData.name.trim(),
          category_id: productFormData.category_id || null,
          sku: productFormData.sku.trim(),
          barcode: productFormData.barcode.trim(),
          cost_price: productFormData.cost_price,
          sale_price: productFormData.sale_price,
          min_stock: productFormData.min_stock
        };

        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', productFormData.id);

        if (error) throw error;

        // Update in local addedItems list too
        setAddedItems(prev =>
          prev.map(item => {
            if (item.id === productFormData.id) {
              return {
                ...item,
                name: productFormData.name.trim(),
                sku: productFormData.sku.trim(),
                barcode: productFormData.barcode.trim(),
                sale_price: productFormData.sale_price
              };
            }
            return item;
          })
        );

        await fetchProducts(); // Sync catalog cache
        setIsProductModalOpen(false);
        alert('Producto actualizado en la base de datos.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error al guardar producto: ' + err.message);
    }
  };

  const handleSaveBoleta = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!invoiceNumber.trim()) errors.invoiceNumber = 'El número de boleta es obligatorio';
    if (!purchaseDate) errors.purchaseDate = 'La fecha de compra es obligatoria';
    if (!supplier.trim()) errors.supplier = 'El proveedor es obligatorio';
    
    if (addedItems.length === 0) {
      errors.items = 'Falta agregar producto';
    }

    const invalidQtyOrPrice = addedItems.some(item => 
      item.quantity === '' || 
      Number(item.quantity) <= 0 || 
      item.net_price < 0 || 
      item.gross_price < 0 || 
      item.sale_price < 0
    );
    if (invalidQtyOrPrice) {
      errors.items = 'Las cantidades deben ser mayores a 0 y los precios no pueden ser menores a 0';
    }

    if (amountPaid < 0) {
      errors.amountPaid = 'El monto pagado no puede ser menor a 0';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstError = Object.values(errors)[0];
      alert(`Error al guardar: ${firstError}`);
      return;
    }

    setIsSaving(true);
    try {
      const userId = JSON.parse(localStorage.getItem('pos_session') || '{}').id;

      if (editingBoletaId) {
        // --- MODO EDICIÓN ---
        // 1. Obtener ítems originales de la base de datos
        const { data: originalItems, error: fetchError } = await supabase
          .from('boleta_items')
          .select('*')
          .eq('boleta_id', editingBoletaId);

        if (fetchError) throw new Error('Error al obtener ítems originales: ' + fetchError.message);

        // 2. Revertir el stock correspondiente a dichos ítems originales
        if (originalItems && originalItems.length > 0) {
          for (const orig of originalItems) {
            const { data: prodData } = await supabase
              .from('products')
              .select('stock')
              .eq('id', orig.product_id)
              .single();

            const currentStock = prodData ? prodData.stock : 0;
            const revertedStock = Math.max(0, currentStock - Number(orig.quantity));

            // Actualizar stock del producto
            await supabase
              .from('products')
              .update({ stock: revertedStock })
              .eq('id', orig.product_id);

            // Registrar movimiento de salida de reversión
            await supabase.from('inventory_movements').insert([{
              product_id: orig.product_id,
              user_id: userId || null,
              type: 'salida',
              quantity: Number(orig.quantity),
              reason: `Reversión por edición de Factura/Boleta N° ${invoiceNumber.trim()}`
            }]);
          }
        }

        // 3. Eliminar ítems antiguos
        const { error: deleteError } = await supabase
          .from('boleta_items')
          .delete()
          .eq('boleta_id', editingBoletaId);

        if (deleteError) throw new Error('Error al limpiar ítems antiguos: ' + deleteError.message);

        // 4. Actualizar cabecera de la boleta
        const { error: updateBoletaError } = await supabase
          .from('boletas')
          .update({
            invoice_number: invoiceNumber.trim(),
            purchase_date: purchaseDate,
            supplier: supplier.trim(),
            payment_method: paymentMethod,
            amount_paid: amountPaid,
            total_amount: totalAmount
          })
          .eq('id', editingBoletaId);

        if (updateBoletaError) throw new Error('Error al actualizar cabecera: ' + updateBoletaError.message);

        // 5. Insertar los nuevos ítems e incrementar stock
        const itemsToInsert = addedItems.map(item => ({
          boleta_id: editingBoletaId,
          product_id: item.id,
          quantity: Number(item.quantity),
          net_price: item.net_price,
          gross_price: item.gross_price,
          sale_price: item.sale_price,
          total: item.total
        }));

        const { error: itemsError } = await supabase
          .from('boleta_items')
          .insert(itemsToInsert);

        if (itemsError) throw new Error('Error al guardar nuevos ítems: ' + itemsError.message);

        // Incrementar el stock y precios correspondientes
        for (const item of addedItems) {
          const { data: prodData } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.id)
            .single();

          const currentStock = prodData ? prodData.stock : 0;
          const newStock = currentStock + Number(item.quantity);

          await supabase
            .from('products')
            .update({
              stock: newStock,
              cost_price: item.gross_price,
              sale_price: item.sale_price
            })
            .eq('id', item.id);

          // Registrar movimiento de entrada de ajuste
          await supabase.from('inventory_movements').insert([{
            product_id: item.id,
            user_id: userId || null,
            type: 'entrada',
            quantity: Number(item.quantity),
            reason: `Ajuste por edición de Factura/Boleta N° ${invoiceNumber.trim()}`
          }]);
        }

        alert('Factura/Boleta actualizada con éxito y stock recalculado.');
        setIsRegisterModalOpen(false);
        setEditingBoletaId(null);
        loadBoletas();
        fetchProducts();

      } else {
        // --- MODO CREACIÓN ---
        // 1. Insert header into boletas table in Supabase
        const { data: boletaData, error: boletaError } = await supabase
          .from('boletas')
          .insert([{
            invoice_number: invoiceNumber.trim(),
            purchase_date: purchaseDate,
            supplier: supplier.trim(),
            payment_method: paymentMethod,
            amount_paid: amountPaid,
            total_amount: totalAmount
          }])
          .select()
          .single();

        if (boletaError || !boletaData) {
          throw new Error('Error al guardar cabecera de boleta: ' + boletaError?.message);
        }

        // 2. Insert items into boleta_items table in Supabase
        if (addedItems.length > 0) {
          const itemsToInsert = addedItems.map(item => ({
            boleta_id: boletaData.id,
            product_id: item.id,
            quantity: Number(item.quantity),
            net_price: item.net_price,
            gross_price: item.gross_price,
            sale_price: item.sale_price,
            total: item.total
          }));

          const { error: itemsError } = await supabase
            .from('boleta_items')
            .insert(itemsToInsert);

          if (itemsError) {
            throw new Error('Error al guardar items de boleta: ' + itemsError.message);
          }

          // 3. Update stock and cost prices in products table
          for (const item of addedItems) {
            // Fetch current stock from Supabase
            const { data: prodData } = await supabase
              .from('products')
              .select('stock')
              .eq('id', item.id)
              .single();

            const currentStock = prodData ? prodData.stock : 0;
            const newStock = Math.max(0, currentStock + Number(item.quantity));

            // Update stock and cost price
            const { error: updateError } = await supabase
              .from('products')
              .update({
                stock: newStock,
                cost_price: item.gross_price,
                sale_price: item.sale_price
              })
              .eq('id', item.id);

            if (updateError) {
              console.error(`Error al actualizar stock/precio del producto ${item.name}:`, updateError);
            }

            // 4. Create inventory movement record for audit trail
            const { error: movementError } = await supabase
              .from('inventory_movements')
              .insert([{
                product_id: item.id,
                user_id: userId || null,
                type: 'entrada',
                quantity: Number(item.quantity),
                reason: `Compra Boleta N° ${invoiceNumber.trim()}`
              }]);

            if (movementError) {
              console.error(`Error al registrar movimiento del producto ${item.name}:`, movementError);
            }
          }
        }

        alert('Boleta registrada con éxito en Supabase y stock actualizado.');
        setIsRegisterModalOpen(false);
        loadBoletas();
        fetchProducts();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error inesperado al guardar la boleta');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredBoletas = boletas.filter(b => 
    b.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.invoice_number.includes(searchTerm)
  );

  const filteredSearchProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.barcode && p.barcode.includes(productSearch)) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const filteredUpdateProducts = products.filter(p =>
    p.name.toLowerCase().includes(updateProductSearch.toLowerCase()) ||
    (p.barcode && p.barcode.includes(updateProductSearch)) ||
    (p.sku && p.sku.toLowerCase().includes(updateProductSearch.toLowerCase()))
  );

  return (
    <div className="boletas-container flex-col gap-4">
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="text-2xl font-bold">Módulo Facturas/Boletas</h1>
          <p className="text-muted">Registro y visualización centralizada de facturas y boletas de compra en Supabase</p>
        </div>
        <div>
          <Button variant="primary" onClick={handleOpenRegisterModal}>
            <Plus size={18} />
            Registrar Factura/Boleta
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="w-full" style={{ maxWidth: '400px' }}>
            <Input 
              placeholder="Buscar por proveedor o número de factura/boleta..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search size={18} />}
              fullWidth
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted">Cargando boletas desde Supabase...</div>
          ) : filteredBoletas.length === 0 ? (
            <div className="text-center py-8 text-muted">No se registran facturas ni boletas de compra en el sistema.</div>
          ) : (
            <div className="items-table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Factura/Boleta</TableHead>
                    <TableHead>Fecha Compra</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Forma Pago</TableHead>
                    <TableHead className="text-right">Monto Pagado</TableHead>
                    <TableHead className="text-right">Total Boleta</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBoletas.map(boleta => (
                    <TableRow key={boleta.id}>
                      <TableCell className="font-semibold">{boleta.invoice_number}</TableCell>
                      <TableCell>{new Date(boleta.purchase_date + 'T12:00:00').toLocaleDateString('es-CL')}</TableCell>
                      <TableCell>{boleta.supplier}</TableCell>
                      <TableCell>
                        <span className={`badge-payment ${boleta.payment_method}`}>
                          {boleta.payment_method === 'debito' ? 'Débito' : 
                           boleta.payment_method === 'credito' ? 'Crédito' : 
                           boleta.payment_method === 'efectivo' ? 'Efectivo' : 
                           boleta.payment_method === 'transferencia' ? 'Transferencia' : 'Otro'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCLP(boleta.amount_paid)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatCLP(boleta.total_amount)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="sm" className="text-primary" onClick={() => handleOpenDetailModal(boleta)} title="Ver detalles">
                            <Eye size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-info" onClick={() => handleOpenEditModal(boleta)} title="Editar">
                            <Edit2 size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeleteBoleta(boleta)} title="Eliminar">
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal - Registrar Boleta */}
      <Modal 
        isOpen={isRegisterModalOpen} 
        onClose={() => {
          setIsRegisterModalOpen(false);
          setEditingBoletaId(null);
        }} 
        title={editingBoletaId ? "Editar Factura/Boleta de Compra" : "Registrar Factura/Boleta de Compra"} 
        width="lg"
      >
        <form onSubmit={handleSaveBoleta} className="flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: 'var(--space-2)' }}>
            <Input 
              label="Número de Factura/Boleta" 
              required 
              value={invoiceNumber} 
              onChange={e => setInvoiceNumber(e.target.value)} 
              error={formErrors.invoiceNumber}
              fullWidth 
            />
            <Input 
              label="Fecha de Compra" 
              type="date" 
              required 
              value={purchaseDate} 
              onChange={e => setPurchaseDate(e.target.value)} 
              error={formErrors.purchaseDate}
              fullWidth 
            />
            <Input 
              label="Proveedor" 
              required 
              value={supplier} 
              onChange={e => setSupplier(e.target.value)} 
              error={formErrors.supplier}
              fullWidth 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="input-group w-full">
              <label className="input-label">Forma de Pago</label>
              <select 
                className="input-field" 
                value={paymentMethod} 
                onChange={e => setPaymentMethod(e.target.value as any)}
                required
              >
                <option value="efectivo">Efectivo</option>
                <option value="debito">Tarjeta de Débito</option>
                <option value="credito">Tarjeta de Crédito</option>
                <option value="transferencia">Transferencia</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <CurrencyInput 
              label="Monto Pagado" 
              required 
              value={amountPaid} 
              onChange={val => setAmountPaid(val)} 
              fullWidth 
            />
          </div>

          {/* Autocomplete Product Selection Row */}
          <div className="product-selector-wrapper">
            <h3 className="font-semibold mb-2 flex items-center gap-1 text-sm text-primary">
              <PlusCircle size={16} /> Buscar o Crear Producto en esta Factura/Boleta
            </h3>
            <div className="product-selector-row">
              <div className="relative flex-grow min-w-[200px] search-container" ref={dropdownRef} style={{ flex: 2 }}>
                <label className="input-label text-xs">Escribe para Buscar Producto</label>
                <div className="relative">
                  <Input
                    placeholder="Buscar por nombre, código o SKU..."
                    value={productSearch}
                    onChange={e => {
                      setProductSearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                  />
                  {showDropdown && productSearch.trim() !== '' && (
                    <div className="autocomplete-dropdown">
                      {filteredSearchProducts.slice(0, 8).map(p => (
                        <div
                          key={p.id}
                          className="autocomplete-item"
                          onClick={() => {
                            handleSelectProduct(p);
                            setProductSearch('');
                            setShowDropdown(false);
                          }}
                        >
                          <div>
                            <span className="font-semibold text-gray-800">{p.name}</span>
                            <div className="text-xs text-gray-500">
                              Código: {p.barcode || 'N/A'} {p.sku ? `| SKU: ${p.sku}` : ''}
                            </div>
                          </div>
                          <span className="font-bold text-primary">{formatCLP(p.sale_price)}</span>
                        </div>
                      ))}
                      {filteredSearchProducts.length === 0 && (
                        <div className="px-4 py-3 text-gray-500 text-sm text-center">
                          No se encontraron productos. 
                          <button
                            type="button"
                            className="text-primary font-bold underline ml-1 hover:text-primary-dark"
                            onClick={() => {
                              handleOpenNewProductModal();
                              setShowDropdown(false);
                            }}
                          >
                            Crear nuevo producto
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="product-selector-actions">
                <Button type="button" variant="outline" onClick={handleOpenNewProductModal}>
                  <Plus size={16} style={{ marginRight: '4px' }} /> Agregar Producto
                </Button>
                <Button type="button" variant="outline" onClick={handleOpenSelectProductToUpdate}>
                  <Edit2 size={16} style={{ marginRight: '4px' }} /> Actualizar Producto
                </Button>
              </div>
            </div>
          </div>

          {/* Added items list */}
          <div>
            <h3 className="font-semibold mb-2 text-sm text-gray-700">Ítems de esta Boleta</h3>
            
            <div className="items-table-container">
              <Table style={{ minWidth: '750px' }}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead style={{ width: '80px' }}>Cantidad</TableHead>
                    <TableHead style={{ width: '120px' }}>P. Neto (Costo)</TableHead>
                    <TableHead style={{ width: '120px' }}>P. Bruto (Costo)</TableHead>
                    <TableHead style={{ width: '120px' }}>Precio Venta</TableHead>
                    <TableHead className="text-right" style={{ width: '110px' }}>Total</TableHead>
                    <TableHead className="text-center" style={{ width: '100px' }}>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addedItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-semibold text-sm text-gray-800">{item.name}</div>
                        {item.sku && <div className="text-xs text-muted mt-0.5">SKU: {item.sku}</div>}
                        {item.barcode && <div className="text-xs text-muted mt-0.5">Código: {item.barcode}</div>}
                      </TableCell>
                      <TableCell>
                        <input 
                          type="number"
                          className="input-field text-center text-sm"
                          style={{ padding: '4px', margin: 0, width: '100%' }}
                          min="1"
                          required
                          value={item.quantity === '' ? '' : item.quantity}
                          onWheel={e => e.currentTarget.blur()}
                          onChange={e => {
                            const val = e.target.value;
                            handleUpdateItemField(item.id, 'quantity', val === '' ? '' : Math.max(1, Number(val)));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <input 
                          type="number"
                          className="input-field text-right text-sm"
                          style={{ padding: '4px', margin: 0, width: '100%' }}
                          min="0"
                          required
                          value={item.net_price}
                          onWheel={e => e.currentTarget.blur()}
                          onChange={e => handleUpdateItemField(item.id, 'net_price', e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                        />
                      </TableCell>
                      <TableCell>
                        <input 
                          type="number"
                          className="input-field text-right text-sm"
                          style={{ padding: '4px', margin: 0, width: '100%' }}
                          min="0"
                          required
                          value={item.gross_price}
                          onWheel={e => e.currentTarget.blur()}
                          onChange={e => handleUpdateItemField(item.id, 'gross_price', e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                        />
                      </TableCell>
                      <TableCell>
                        <input 
                          type="number"
                          className="input-field text-right text-sm font-semibold text-primary"
                          style={{ padding: '4px', margin: 0, width: '100%' }}
                          min="0"
                          required
                          value={item.sale_price}
                          onWheel={e => e.currentTarget.blur()}
                          onChange={e => handleUpdateItemField(item.id, 'sale_price', e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                        />
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm text-gray-800">
                        {formatCLP(item.total)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={() => handleOpenEditProductModal(item)} title="Editar información del producto en catálogo">
                            <Edit2 size={16} />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => handleRemoveItem(item.id)} title="Remover de la boleta">
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {addedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted text-sm">
                        No se han añadido productos a la boleta. Utilice el buscador superior.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="items-table-footer">
                <span>Total General Factura/Boleta:</span>
                <span className="items-table-footer-val">{formatCLP(totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <Button 
              variant="outline" 
              type="button" 
              onClick={() => {
                setIsRegisterModalOpen(false);
                setEditingBoletaId(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar Boleta'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal - Ver Detalles Boleta */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Detalles de Factura/Boleta de Compra" width="md">
        {selectedBoleta && (
          <div className="boleta-detail-modal">
            <div className="boleta-detail-grid">
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Número de Factura/Boleta</span>
                <span className="boleta-detail-value font-bold text-primary">{selectedBoleta.invoice_number}</span>
              </div>
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Fecha de Compra</span>
                <span className="boleta-detail-value">
                  {new Date(selectedBoleta.purchase_date + 'T12:00:00').toLocaleDateString('es-CL')}
                </span>
              </div>
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Proveedor</span>
                <span className="boleta-detail-value font-medium">{selectedBoleta.supplier}</span>
              </div>
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Forma de Pago</span>
                <span className="boleta-detail-value capitalize">
                  {selectedBoleta.payment_method === 'debito' ? 'Tarjeta Débito' : 
                   selectedBoleta.payment_method === 'credito' ? 'Tarjeta Crédito' : 
                   selectedBoleta.payment_method === 'efectivo' ? 'Efectivo' : 
                   selectedBoleta.payment_method === 'transferencia' ? 'Transferencia' : 'Otro'}
                </span>
              </div>
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Monto Pagado</span>
                <span className="boleta-detail-value font-semibold">{formatCLP(selectedBoleta.amount_paid)}</span>
              </div>
              <div className="boleta-detail-item">
                <span className="boleta-detail-label">Total General</span>
                <span className="boleta-detail-value total">{formatCLP(selectedBoleta.total_amount)}</span>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-2)' }}>
              <h3 className="font-semibold mb-2 text-sm text-gray-700">Productos Comprados</h3>
              <div className="items-table-container">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center" style={{ width: '80px' }}>Cant.</TableHead>
                      <TableHead className="text-right" style={{ width: '110px' }}>P. Neto</TableHead>
                      <TableHead className="text-right" style={{ width: '110px' }}>P. Bruto</TableHead>
                      <TableHead className="text-right" style={{ width: '110px' }}>P. Venta</TableHead>
                      <TableHead className="text-right" style={{ width: '120px' }}>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedBoleta.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted text-sm">
                          Esta factura/boleta no tiene productos registrados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedBoleta.items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-semibold text-sm">{item.name}</div>
                            {item.sku && <div className="text-xs text-muted">SKU: {item.sku}</div>}
                            {item.barcode && <div className="text-xs text-muted">Código: {item.barcode}</div>}
                          </TableCell>
                          <TableCell className="text-center font-medium">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCLP(item.net_price)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCLP(item.gross_price)}</TableCell>
                          <TableCell className="text-right font-medium text-primary">{formatCLP(item.sale_price)}</TableCell>
                          <TableCell className="text-right font-bold text-primary">{formatCLP(item.total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Cerrar Ventana
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal - Seleccionar Producto para Actualizar */}
      <Modal isOpen={isSelectProductToUpdateOpen} onClose={() => setIsSelectProductToUpdateOpen(false)} title="Seleccionar Producto para Actualizar" width="sm">
        <div className="flex flex-col gap-4">
          <Input 
            placeholder="Buscar por nombre, código o SKU..."
            value={updateProductSearch}
            onChange={e => setUpdateProductSearch(e.target.value)}
            fullWidth
            autoFocus
          />
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)' }}>
            {filteredUpdateProducts.slice(0, 10).map(p => (
              <div 
                key={p.id}
                onClick={() => {
                  setProductFormData({
                    id: p.id,
                    name: p.name,
                    category_id: p.category_id || '',
                    sku: p.sku || '',
                    barcode: p.barcode || '',
                    cost_price: p.cost_price || 0,
                    sale_price: p.sale_price || 0,
                    min_stock: p.min_stock || 5
                  });
                  setProductFormMode('edit');
                  setIsSelectProductToUpdateOpen(false);
                  setUpdateProductSearch('');
                  setIsProductModalOpen(true);
                }}
                className="select-product-item"
              >
                <div>
                  <div className="font-semibold text-sm text-gray-800">{p.name}</div>
                  <div className="text-xs text-muted">Barra: {p.barcode || 'N/A'} {p.sku ? `| SKU: ${p.sku}` : ''}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-primary">{formatCLP(p.sale_price)}</div>
                  <div className="text-xs text-muted">Stock: {p.stock}</div>
                </div>
              </div>
            ))}
            {filteredUpdateProducts.length === 0 && (
              <div className="p-4 text-center text-muted text-sm">No se encontraron productos.</div>
            )}
          </div>
          <div className="flex justify-end mt-2">
            <Button variant="outline" type="button" onClick={() => setIsSelectProductToUpdateOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Sub-Modal: Crear o Editar Producto desde Boleta (Unificado) */}
      <Modal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} title={productFormMode === 'create' ? "Crear Producto Nuevo en Catálogo" : "Editar Producto en Catálogo"} width="sm">
        <form onSubmit={handleSaveProduct} className="flex-col gap-4">
          <Input 
            label="Nombre del Producto" 
            required 
            value={productFormData.name} 
            onChange={e => setProductFormData({...productFormData, name: e.target.value})} 
            fullWidth 
          />
          
          <div className="input-group w-full">
            <label className="input-label">Categoría</label>
            <select 
              className="input-field" 
              value={productFormData.category_id} 
              onChange={e => setProductFormData({...productFormData, category_id: e.target.value})}
              required
            >
              <option value="" disabled>Seleccione una categoría</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <Input 
              label="SKU (Opcional)" 
              value={productFormData.sku} 
              onChange={e => setProductFormData({...productFormData, sku: e.target.value})} 
              fullWidth 
            />
            <Input 
              label="Código de Barras" 
              required 
              value={productFormData.barcode} 
              onChange={e => setProductFormData({...productFormData, barcode: e.target.value})} 
              fullWidth 
            />
          </div>

          <div className="flex gap-4">
            <CurrencyInput 
              label="Precio Costo Defecto" 
              value={productFormData.cost_price} 
              onChange={val => setProductFormData({...productFormData, cost_price: val})} 
              fullWidth 
            />
            <CurrencyInput 
              label="Precio Venta Defecto" 
              required 
              value={productFormData.sale_price} 
              onChange={val => setProductFormData({...productFormData, sale_price: val})} 
              fullWidth 
            />
          </div>

          <Input 
            label="Stock Mínimo (Alerta)" 
            type="number" 
            required 
            value={productFormData.min_stock} 
            onChange={e => setProductFormData({...productFormData, min_stock: Math.max(0, Number(e.target.value))})} 
            fullWidth 
          />

          <div className="flex justify-end gap-2 mt-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <Button variant="outline" type="button" onClick={() => setIsProductModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit">
              {productFormMode === 'create' ? 'Crear Producto' : 'Actualizar Producto'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
