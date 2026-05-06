/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  motion, 
  AnimatePresence 
} from 'motion/react';
import { 
  getDocs, 
  collection, 
  addDoc, 
  query, 
  where, 
  serverTimestamp, 
  doc, 
  getDocFromServer,
  onSnapshot,
  orderBy,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  ShoppingBag, 
  ClipboardList, 
  Phone, 
  User as UserIcon, 
  MapPin, 
  CheckCircle2, 
  Upload, 
  Loader2, 
  LogOut,
  ChevronRight,
  Info,
  Shirt,
  FileDown,
  Printer,
  Download,
  Search,
  LayoutDashboard,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  PlusCircle,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { db, auth } from './lib/firebase';
import { Order, OrderStatus, OperationType, Product } from './types';

// Error Handler
const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

const ADMIN_EMAILS = ['ferdy.ap@gmail.com'];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [stockLimits, setStockLimits] = useState<Record<string, number>>({});
  const [stockUsed, setStockUsed] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingStock, setEditingStock] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<'preorder' | 'history' | 'stats' | 'products'>('preorder');
  const [activeAdminTab, setActiveAdminTab] = useState<'orders' | 'stats' | 'products'>('orders');

  // Product Form State
  const [productFormData, setProductFormData] = useState({
    name: '',
    description: '',
    price: 0,
    imageUrl: '',
    availableSizes: 'S,M,L,XL,XXL,XXXL',
    availableColors: 'Hitam,Putih,Navy,Maroon',
    isActive: true
  });

  // Search State
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    size: 'M' as Order['size'],
    color: 'Hitam',
    quantity: 1,
    paymentProofUrl: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('unavailable'))) {
          console.error("Firestore connectivity issue:", error);
          alert("Gagal terhubung ke database. Pastikan Firestore sudah diaktifkan di Console Firebase: https://console.firebase.google.com/project/graceful-karma-249804/firestore/databases/ai-studio-9918bc32-5def-4153-b1fb-d59b607750c3/data");
        }
      }
    };
    testConnection();

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u ? ADMIN_EMAILS.includes(u.email || '') : false);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }

    const q = isAdmin 
      ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
      : query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });

    const unsubscribeStock = onSnapshot(doc(db, 'settings', 'stock'), (snapshot) => {
      if (snapshot.exists()) {
        setStockLimits(snapshot.data().stockLimits);
      }
    });

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
      if (productsData.length > 0 && !selectedProductId) {
        setSelectedProductId(productsData[0].id!);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeStock();
      unsubscribeProducts();
    };
  }, [user, isAdmin]);

  useEffect(() => {
    const usage = orders.reduce((acc, order) => {
      const key = `${order.productId}_${order.size}`;
      acc[key] = (acc[key] || 0) + order.quantity;
      return acc;
    }, {} as Record<string, number>);
    
    setStockUsed(usage);
  }, [orders]);

  const syncToSheet = async (orderData: Partial<Order> & { id?: string }) => {
    try {
      await fetch('/api/sync-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...orderData,
          updatedAt: new Date().toISOString() // Use ISO for Sheet
        })
      });
    } catch (error) {
      console.warn('Google Sheet sync failed:', error);
    }
  };

  const sendConfirmationEmail = async (email: string, name: string, orderDetails: any, orderId: string) => {
    try {
      await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, orderDetails, orderId })
      });
    } catch (error) {
      console.warn('Email confirmation failed:', error);
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) { // Keep it under 800KB for Firestore doc limit
        alert("Ukuran file terlalu besar. Maksimal 800KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, paymentProofUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.paymentProofUrl) {
      alert("Silakan upload bukti pembayaran");
      return;
    }

    setSubmitting(true);
    try {
      const selectedProduct = products.find(p => p.id === selectedProductId);
      if (!selectedProduct) {
        alert("Produk tidak ditemukan");
        setSubmitting(false);
        return;
      }

      // Re-verify stock before submission
      const stockKey = `${selectedProductId}_${formData.size}`;
      const currentUsed = stockUsed[stockKey] || 0;
      const limit = stockLimits[stockKey] || 50; // Default limit
      if (currentUsed + formData.quantity > limit) {
        alert("Maaf, stok untuk ukuran ini baru saja habis atau tidak mencukupi.");
        setSubmitting(false);
        return;
      }

      const orderData = {
        userId: user.uid,
        productId: selectedProductId,
        productName: selectedProduct.name,
        ...formData,
        status: OrderStatus.PENDING,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Sync to Sheet
      syncToSheet({ id: docRef.id, ...orderData });

      // Send Email Confirmation
      if (user.email) {
        sendConfirmationEmail(user.email, formData.name, {
          productName: selectedProduct.name,
          size: formData.size,
          color: formData.color,
          quantity: formData.quantity,
          totalAmount: selectedProduct.price * formData.quantity
        }, docRef.id.slice(-6).toUpperCase());
      }

      setSuccess(true);
      setFormData({
        name: '',
        phone: '',
        address: '',
        size: 'M',
        color: 'Hitam',
        quantity: 1,
        paymentProofUrl: ''
      });
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (!isAdmin) return;
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      // Find order for notification
      const order = orders.find(o => o.id === orderId);
      if (order) {
        // Notify via WA
        fetch('/api/notify-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: order.phone,
            name: order.name,
            status: newStatus,
            orderId: orderId.slice(-6).toUpperCase()
          })
        }).catch(e => console.warn("WA Notification failed:", e));

        // Sync to Sheet
        syncToSheet({ ...order, status: newStatus });
      }

      // Update local state for modal if open
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSubmitting(true);
    try {
      const data = {
        ...productFormData,
        availableSizes: productFormData.availableSizes.split(',').map(s => s.trim()),
        availableColors: productFormData.availableColors.split(',').map(c => c.trim()),
        price: Number(productFormData.price),
        createdAt: serverTimestamp()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id!), data);
      } else {
        await addDoc(collection(db, 'products'), data);
      }
      setIsAddingProduct(false);
      setEditingProduct(null);
      setProductFormData({
        name: '',
        description: '',
        price: 0,
        imageUrl: '',
        availableSizes: 'S,M,L,XL,XXL,XXXL',
        availableColors: 'Hitam,Putih,Navy,Maroon',
        isActive: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = (productId: string) => {
    if (!isAdmin) return;
    setProductToDelete(productId);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'products', productToDelete));
      setProductToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${productToDelete}`);
    } finally {
      setSubmitting(false);
    }
  };

  const saveStockLimits = async (newLimits: Record<string, number>) => {
    if (!isAdmin) return;
    try {
      const { setDoc } = await import('firebase/firestore');
      const stockRef = doc(db, 'settings', 'stock');
      await setDoc(stockRef, { stockLimits: newLimits }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/stock');
    }
    setEditingStock(false);
  };

  const handlePublicSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/order-status/${searchPhone}`);
      const data = await res.json();
      setSearchResults(data.orders || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!isAdmin) return;
    if (!confirm('Apakah Anda yakin ingin menghapus pesanan ini?')) return;
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      setSelectedOrder(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  const exportToExcel = () => {
    if (!isAdmin) return;
    const worksheet = XLSX.utils.json_to_sheet(orders.map(o => ({
      ID: o.id,
      Nama: o.name,
      Telepon: o.phone,
      Alamat: o.address,
      Ukuran: o.size,
      Warna: o.color,
      Jumlah: o.quantity,
      Status: o.status,
      Tanggal: o.createdAt ? (o.createdAt as any).toDate().toLocaleString() : ''
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
    XLSX.writeFile(workbook, "Data_Preorder_KOMITS_2025.xlsx");
  };

  const generateInvoice = (order: Order) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("INVOICE RESMI", 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text("KOMITS 2025 OFFICIAL MERCHANDISE", 105, 28, { align: 'center' });
    
    // Horizontal line
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);
    
    // Customer Info
    doc.setFontSize(12);
    doc.text(`No Pesanan: ${order.id?.slice(-8).toUpperCase()}`, 20, 45);
    doc.text(`Tanggal: ${new Date().toLocaleDateString()}`, 20, 52);
    
    doc.text("Informasi Pelanggan:", 20, 70);
    doc.setFontSize(10);
    doc.text(`Nama: ${order.name}`, 20, 77);
    doc.text(`WA: ${order.phone}`, 20, 83);
    doc.text(`Alamat: ${order.address}`, 20, 89, { maxWidth: 100 });
    
    // Order Table
    autoTable(doc, {
      startY: 100,
      head: [['Produk', 'Detail', 'Jumlah']],
      body: [
        ['Kaos KOMITS 2025', `${order.size} - ${order.color}`, `${order.quantity} pcs`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
    });
    
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    
    // Status
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text(`STATUS: ${order.status.toUpperCase()}`, 20, finalY + 20);
    
    // Footer
    doc.setTextColor(150);
    doc.setFontSize(8);
    doc.text("Ini adalah dokumen resmi yang digenerate otomatis oleh sistem KOMITS 2025.", 105, 280, { align: 'center' });
    
    doc.save(`Invoice_${order.name.replace(/\s/g, '_')}.pdf`);
  };

  const generateShippingLabels = () => {
    if (!isAdmin) return;
    const doc = new jsPDF();
    
    let yPos = 20;
    orders.filter(o => o.status === OrderStatus.VERIFIED || o.status === OrderStatus.PROCESSING).forEach((order, index) => {
      if (index > 0 && index % 4 === 0) {
        doc.addPage();
        yPos = 20;
      }
      
      const currentY = yPos + (index % 4) * 60;
      
      // Label Box
      doc.setDrawColor(200);
      doc.rect(20, currentY, 170, 55);
      
      // Label Header
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("PENGIRIM: KOMITS 2025 (Official Office)", 25, currentY + 10);
      doc.text("0812-3456-7890", 25, currentY + 15);
      
      doc.line(20, currentY + 20, 190, currentY + 20);
      
      // Label Body
      doc.text("PENERIMA:", 25, currentY + 30);
      doc.setFontSize(14);
      doc.text(order.name.toUpperCase(), 25, currentY + 38);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Tlp: ${order.phone}`, 25, currentY + 44);
      doc.text(`Alamat: ${order.address}`, 25, currentY + 50, { maxWidth: 160 });
      
      // Order ID on corner
      doc.setFontSize(8);
      doc.text(`ID: ${order.id?.slice(-6).toUpperCase()}`, 160, currentY + 10);
      doc.text(`${order.size} - ${order.color}`, 160, currentY + 15);
    });
    
    doc.save("Label_Pengiriman_KOMITS_2025.pdf");
  };

  const getAnalytics = () => {
    const colorData: Record<string, number> = {};
    const statusData: Record<string, number> = {
      'Pending': 0,
      'Verified': 0,
      'Shipped': 0,
      'Processing': 0,
      'Completed': 0
    };
    let totalRevenue = 0;

    orders.forEach(order => {
      // Color Stats
      colorData[order.color] = (colorData[order.color] || 0) + order.quantity;
      
      // Status Stats
      const statusLabel = order.status.charAt(0).toUpperCase() + order.status.slice(1);
      statusData[statusLabel] = (statusData[statusLabel] || 0) + 1;

      // Revenue Calculation
      if (order.status !== OrderStatus.PENDING) {
        const product = products.find(p => p.id === order.productId);
        const price = product?.price || 0;
        totalRevenue += price * order.quantity;
      }
    });

    const colorChartData = Object.entries(colorData).map(([name, value]) => ({ name, value }));
    const statusChartData = Object.entries(statusData).map(([name, value]) => ({ name, value }));

    return { colorChartData, statusChartData, totalRevenue };
  };

  const { colorChartData, statusChartData, totalRevenue } = getAnalytics();
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F7FA]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] font-sans text-gray-900 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">KOMITS 2025</h1>
          </div>
          
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-gray-500">
                  Welcome {isAdmin && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[10px] ml-1 uppercase font-bold">Admin</span>}
                </p>
                <p className="text-sm font-semibold">{user.displayName}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2"
            >
              <UserIcon className="w-4 h-4" />
              Login with Google
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8">
        {user && (
          <div className="mb-10 -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-2 bg-gray-100/80 backdrop-blur-sm p-1.5 rounded-[1.25rem] w-fit max-w-full overflow-x-auto no-scrollbar scroll-smooth">
              {isAdmin ? (
                <>
                  <button 
                    onClick={() => { setActiveTab('preorder'); setActiveAdminTab('orders'); }}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[13px] font-black whitespace-nowrap transition-all active:scale-95 ${activeTab === 'preorder' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <ClipboardList className="w-4 h-4" />
                    PESANAN
                  </button>
                  <button 
                    onClick={() => { setActiveTab('stats'); setActiveAdminTab('stats'); }}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[13px] font-black whitespace-nowrap transition-all active:scale-95 ${activeTab === 'stats' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    STATISTIK
                  </button>
                  <button 
                    onClick={() => { setActiveTab('products'); setActiveAdminTab('products'); }}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[13px] font-black whitespace-nowrap transition-all active:scale-95 ${activeTab === 'products' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    PRODUK
                  </button>
                  <div className="w-px h-6 bg-gray-200 self-center mx-1 shrink-0" />
                  <button 
                    onClick={() => setActiveTab('form')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[13px] font-black whitespace-nowrap transition-all active:scale-95 ${activeTab === 'form' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    BUAT PESANAN
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setActiveTab('preorder')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-black transition-all active:scale-95 ${activeTab === 'preorder' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Shirt className="w-4 h-4" />
                    PREORDER BARU
                  </button>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-black transition-all active:scale-95 ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <ClipboardList className="w-4 h-4" />
                    RIWAYAT
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Banner - Only show on Preorder Tab or when not logged in */}
        {(!user || activeTab === 'preorder' || activeTab === 'form') && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2.5rem] p-8 sm:p-10 mb-10 text-white relative overflow-hidden shadow-xl shadow-blue-900/10"
          >
            <div className="relative z-10 sm:max-w-md">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/10 backdrop-blur-md border border-white/20 w-fit px-3 py-1 rounded-full mb-6"
              >
                <p className="text-white font-mono text-[10px] uppercase tracking-[0.2em] font-bold">Limited Anniversary Edition</p>
              </motion.div>
              <h2 className="text-3xl sm:text-5xl font-black mb-4 leading-tight tracking-tight">
                KOMITS 2025<br />
                <span className="text-blue-300">Official Store</span>
              </h2>
              <p className="text-blue-100 text-sm sm:text-lg opacity-90 leading-relaxed font-medium mb-8">
                Selamat Datang di Official Komits 2025 Merchandise. Koleksi eksklusif untuk mendukung pergerakan sosial.
              </p>
              
              {!user && (
                <button 
                  onClick={handleLogin}
                  className="bg-white text-blue-700 font-black px-8 py-4 rounded-2xl flex items-center gap-2 hover:bg-blue-50 transition-all active:scale-95 shadow-lg"
                >
                  <ShoppingBag className="w-5 h-5" />
                  BELANJA SEKARANG
                </button>
              )}
            </div>

            {/* Merchandise Image Stack */}
            <div className="absolute top-0 right-0 h-full w-full pointer-events-none overflow-hidden sm:block">
              {/* Product 1: Black T-Shirt */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, rotate: 10, x: 100 }}
                animate={{ opacity: 0.6, scale: 1, rotate: -15, x: 0 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="absolute -right-12 top-1/2 -translate-y-1/2 w-64 h-64 sm:w-96 sm:h-96"
              >
                <img 
                  src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=600" 
                  alt="Merchandise Mockup 1" 
                  className="w-full h-full object-contain filter drop-shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </motion.div>

              {/* Product 2: White Hoodie / Sweatshirt */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, rotate: -20, x: 100 }}
                animate={{ opacity: 0.4, scale: 0.9, rotate: 10, x: 40 }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                className="absolute right-12 bottom-0 w-48 h-48 sm:w-80 sm:h-80"
              >
                <img 
                  src="https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=600" 
                  alt="Merchandise Mockup 2" 
                  className="w-full h-full object-contain filter drop-shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </motion.div>

              {/* Decorative Blur Orbs */}
              <div className="absolute top-1/4 right-0 w-64 h-64 bg-blue-400 rounded-full blur-[100px] opacity-20" />
              <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-400 rounded-full blur-[120px] opacity-20" />
            </div>
          </motion.div>
        )}

          {isAdmin && activeAdminTab === 'stats' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 sm:space-y-8 mb-12"
            >
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-blue-50 shadow-sm">
                  <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-5">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Total Pendapatan</p>
                  <h4 className="text-2xl font-black text-gray-900">Rp {totalRevenue.toLocaleString()}</h4>
                  <p className="text-[10px] text-gray-400 mt-2 italic font-medium">*Non-pending orders</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-green-50 shadow-sm">
                  <div className="bg-green-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-5">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Pesanan Sukses</p>
                  <h4 className="text-2xl font-black text-gray-900">{orders.filter(o => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.VERIFIED).length}</h4>
                  <p className="text-[10px] text-gray-400 mt-2 italic font-medium">Verified & Completed</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-orange-50 shadow-sm">
                  <div className="bg-orange-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-5">
                    <Loader2 className="w-6 h-6 text-orange-600" />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Proses Verifikasi</p>
                  <h4 className="text-2xl font-black text-gray-900">{orders.filter(o => o.status === OrderStatus.PENDING).length}</h4>
                  <p className="text-[10px] text-gray-400 mt-2 italic font-medium">Status: Pending</p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm min-h-[380px] sm:min-h-[450px]">
                  <h4 className="font-black text-gray-800 mb-8 flex items-center gap-2 text-sm sm:text-base tracking-tight">
                    <div className="bg-blue-100 p-1.5 rounded-lg">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                    </div>
                    POPULARITAS WARNA
                  </h4>
                  <div className="h-[250px] sm:h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={colorChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="name" fontSize={10} stroke="#9CA3AF" axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip 
                          cursor={{ fill: '#F9FAFB', radius: 8 }}
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }}
                          itemStyle={{ fontWeight: '800', fontSize: '12px' }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="#2563eb" 
                          radius={[8, 8, 0, 0]} 
                          animationDuration={1500}
                          barSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm min-h-[380px] sm:min-h-[450px]">
                  <h4 className="font-black text-gray-800 mb-8 flex items-center gap-2 text-sm sm:text-base tracking-tight">
                    <div className="bg-indigo-100 p-1.5 rounded-lg">
                      <PieChartIcon className="w-4 h-4 text-indigo-600" />
                    </div>
                    STATUS PEMBAYARAN
                  </h4>
                  <div className="h-[250px] sm:h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {isAdmin && activeAdminTab === 'products' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-blue-100 rounded-3xl p-6 mb-8 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-blue-600 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  Admin: Manajemen Produk
                </h3>
                <button 
                  onClick={() => {
                    setIsAddingProduct(true);
                    setEditingProduct(null);
                    setProductFormData({
                      name: '',
                      description: '',
                      price: 0,
                      imageUrl: '',
                      availableSizes: 'S,M,L,XL,XXL,XXXL',
                      availableColors: 'Hitam,Putih,Navy,Maroon',
                      isActive: true
                    });
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
                >
                  Tambah Produk Baru
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.map(product => (
                  <div key={product.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm">{product.name}</h4>
                      <p className="text-xs text-gray-500">Rp {product.price.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{product.isActive ? 'Aktif' : 'Nonaktif'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingProduct(product);
                          setIsAddingProduct(true);
                          setProductFormData({
                            name: product.name,
                            description: product.description,
                            price: product.price,
                            imageUrl: product.imageUrl,
                            availableSizes: product.availableSizes.join(','),
                            availableColors: product.availableColors.join(','),
                            isActive: product.isActive
                          });
                        }}
                        className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                        <button 
                          onClick={() => handleDeleteProduct(product.id!)}
                          className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors group"
                          title="Hapus Produk"
                        >
                          <LogOut className="w-4 h-4 rotate-90 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {isAddingProduct && (
                  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsAddingProduct(false)}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl p-6"
                    >
                      <h3 className="font-bold text-xl mb-6">{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</h3>
                      <form onSubmit={handleSubmitProduct} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Nama Produk</label>
                            <input 
                              required
                              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm"
                              value={productFormData.name}
                              onChange={e => setProductFormData({...productFormData, name: e.target.value})}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Harga (Rp)</label>
                            <input 
                              required
                              type="number"
                              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm"
                              value={productFormData.price}
                              onChange={e => setProductFormData({...productFormData, price: parseInt(e.target.value) || 0})}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Deskripsi</label>
                          <textarea 
                            required
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm min-h-[80px]"
                            value={productFormData.description}
                            onChange={e => setProductFormData({...productFormData, description: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Image URL</label>
                          <input 
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm"
                            value={productFormData.imageUrl}
                            onChange={e => setProductFormData({...productFormData, imageUrl: e.target.value})}
                            placeholder="https://example.com/image.jpg"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Ukuran (Pisahkan ,)</label>
                            <input 
                              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm"
                              value={productFormData.availableSizes}
                              onChange={e => setProductFormData({...productFormData, availableSizes: e.target.value})}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Warna (Pisahkan ,)</label>
                            <input 
                              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm"
                              value={productFormData.availableColors}
                              onChange={e => setProductFormData({...productFormData, availableColors: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox"
                            checked={productFormData.isActive}
                            onChange={e => setProductFormData({...productFormData, isActive: e.target.checked})}
                          />
                          <label className="text-xs font-bold text-gray-600">Produk Aktif / Dijual</label>
                        </div>
                        <div className="flex gap-3 pt-4">
                          <button 
                            type="button"
                            onClick={() => setIsAddingProduct(false)}
                            className="flex-1 px-4 py-3 border border-gray-200 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            Batal
                          </button>
                          <button 
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                          >
                            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Simpan Produk
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Delete Product Confirmation Modal */}
              <AnimatePresence>
                {productToDelete && (
                  <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setProductToDelete(null)}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="relative bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center"
                    >
                      <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="w-10 h-10 text-red-500" />
                      </div>
                      <h3 className="text-xl font-black text-gray-900 mb-3">Hapus Produk?</h3>
                      <p className="text-gray-500 text-sm leading-relaxed mb-8">
                        Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin menghapus produk ini secara permanen?
                      </p>
                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={confirmDeleteProduct}
                          disabled={submitting}
                          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
                        >
                          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ya, Hapus Permanen'}
                        </button>
                        <button 
                          onClick={() => setProductToDelete(null)}
                          disabled={submitting}
                          className="w-full bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold py-4 rounded-2xl transition-all"
                        >
                          Batalkan
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Admin: Manajemen Stok Per Item
                  </h3>
                  <button 
                    onClick={() => setEditingStock(!editingStock)}
                    className="text-sm font-bold text-blue-600 hover:underline"
                  >
                    {editingStock ? 'Batal Edit' : 'Edit Kuota'}
                  </button>
                </div>

                <div className="space-y-6">
                  {products.map(product => (
                    <div key={product.id} className="bg-gray-50 p-4 rounded-2xl">
                      <h5 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">{product.name}</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                        {product.availableSizes.map(size => {
                          const stockKey = `${product.id}_${size}`;
                          const used = stockUsed[stockKey] || 0;
                          const limit = stockLimits[stockKey] || 50;
                          return (
                            <div key={size} className={`p-3 rounded-xl border transition-all ${used >= limit ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                              <p className="text-[10px] font-bold text-gray-400 mb-1">SIZE {size}</p>
                              {editingStock ? (
                                <input 
                                  type="number"
                                  className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-bold"
                                  defaultValue={limit}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setStockLimits(prev => ({ ...prev, [stockKey]: val }));
                                  }}
                                />
                              ) : (
                                <div className="flex items-baseline gap-1">
                                  <span className="text-base font-bold">{used}</span>
                                  <span className="text-[10px] text-gray-400">/ {limit}</span>
                                </div>
                              )}
                              <div className="w-full bg-gray-200 h-1 rounded-full mt-2 overflow-hidden">
                                <div 
                                  className={`h-full transition-all ${used >= limit ? 'bg-red-500' : 'bg-blue-500'}`}
                                  style={{ width: `${Math.min(100, (used / (limit || 1)) * 100)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                
                {editingStock && (
                  <button 
                    onClick={() => saveStockLimits(stockLimits)}
                    className="mt-6 w-full bg-blue-600 text-white font-bold py-2 rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Simpan Semua Perubahan Kuota Stok
                  </button>
                )}
              </div>
            </motion.div>
          )}

        {!user && activeAdminTab !== 'stats' ? (
          <div className="space-y-8">
            {/* Search Tool for Non-Logged In */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-gray-200 rounded-[2.5rem] p-6 sm:p-8 shadow-sm"
            >
              <h3 className="text-lg sm:text-xl font-bold mb-5 flex items-center gap-2">
                <div className="bg-blue-50 p-2 rounded-xl">
                  <Search className="w-5 h-5 text-blue-600" />
                </div>
                Cek Status Pesanan
              </h3>
              <form onSubmit={handlePublicSearch} className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="tel"
                  placeholder="Nomor WhatsApp (08...)"
                  className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 sm:py-3.5 outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all text-sm font-semibold"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                />
                <button 
                  type="submit"
                  disabled={searching}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold px-8 py-4 sm:py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation shadow-lg shadow-blue-100"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Cek Status
                </button>
              </form>

              <AnimatePresence>
                {hasSearched && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-8 pt-8 border-t border-gray-50 space-y-4"
                  >
                    {searchResults.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500 font-medium">Tidak ditemukan pesanan untuk nomor ini.</p>
                        <p className="text-[10px] text-gray-400 mt-1">Pastikan nomor yang dimasukkan benar.</p>
                      </div>
                    ) : (
                      searchResults.map((order) => (
                        <div key={order.id} className="flex items-center justify-between bg-gray-50/50 p-5 rounded-[1.5rem] border border-gray-100/50">
                          <div className="min-w-0 pr-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1.5">ID: {order.id}</p>
                            <p className="text-sm font-bold text-gray-900 truncate leading-tight mb-1">{order.productName}</p>
                            <p className="text-[11px] text-gray-500 font-medium">{order.size} • {order.color} • {order.quantity} pcs</p>
                            <p className="text-[10px] text-gray-400 mt-1 italic">Atas nama: {order.name}</p>
                          </div>
                          <span className={`text-[10px] uppercase font-black px-4 py-2 rounded-xl shrink-0 tracking-widest ${
                            order.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                            order.status === 'verified' ? 'bg-green-600 text-white shadow-sm shadow-green-100' :
                            'bg-blue-600 text-white shadow-sm shadow-blue-100'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="text-center bg-white border border-gray-200 rounded-3xl p-12 shadow-sm">

            <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Info className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Silakan Login Terlebih Dahulu</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              Anda perlu login menggunakan akun Google Anda untuk melakukan preorder dan melihat status pesanan.
            </p>
            <button 
              onClick={handleLogin}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-bold transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-200"
            >
              Mulai Sekarang
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        ) : user && (activeTab === 'preorder' || activeTab === 'form') ? (
            <div className="max-w-xl mx-auto">
              {/* Form Section */}
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Shirt className="w-5 h-5 text-blue-600" />
                    Formulir Preorder
                  </h3>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Pilih Produk</label>
                      <select 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition-all appearance-none"
                        value={selectedProductId}
                        onChange={e => setSelectedProductId(e.target.value)}
                      >
                        {products.filter(p => p.isActive || isAdmin).map(product => (
                          <option key={product.id} value={product.id}>{product.name} (Rp {product.price.toLocaleString()})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Nama Lengkap</label>
                      <input 
                        required
                        type="text"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition-all"
                        placeholder="Contoh: Budi Santoso"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">No Telepon / WA</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          required
                          type="tel"
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition-all"
                          placeholder="081234567890"
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Alamat Pengiriman</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-3 w-4 h-4 text-gray-400" />
                        <textarea 
                          required
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition-all min-h-[100px] resize-none"
                          placeholder="Tuliskan alamat lengkap pengiriman..."
                          value={formData.address}
                          onChange={e => setFormData({ ...formData, address: e.target.value })}
                        />
                      </div>
                    </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Ukuran</label>
                          <select 
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-3 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition-all appearance-none"
                            value={formData.size}
                            onChange={e => setFormData({ ...formData, size: e.target.value })}
                          >
                            {(products.find(p => p.id === selectedProductId)?.availableSizes || ['S', 'M', 'L', 'XL', 'XXL', 'XXXL']).map(s => {
                              const stockKey = `${selectedProductId}_${s}`;
                              const used = stockUsed[stockKey] || 0;
                              const limit = stockLimits[stockKey] || 50;
                              const isSoldOut = used >= limit;
                              return (
                                <option key={s} value={s} disabled={isSoldOut}>
                                  {s} {isSoldOut ? '(SOLD OUT)' : `(Stok: ${limit - used})`}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Warna</label>
                        <select 
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-3 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition-all appearance-none"
                          value={formData.color}
                          onChange={e => setFormData({ ...formData, color: e.target.value })}
                        >
                          {(products.find(p => p.id === selectedProductId)?.availableColors || ['Hitam', 'Putih', 'Navy', 'Maroon']).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Jumlah</label>
                      <input 
                        type="number"
                        min="1"
                        max="100"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition-all"
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Bukti Pembayaran</label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:bg-gray-50 ${formData.paymentProofUrl ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
                      >
                        {formData.paymentProofUrl ? (
                          <>
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                            <span className="text-xs font-bold text-green-600">Berhasil diupload</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-gray-300" />
                            <span className="text-xs font-medium text-gray-400">Klik untuk upload bukti</span>
                          </>
                        )}
                      </div>
                      <input 
                        type="file"
                        ref={fileInputRef}
                        hidden
                        accept="image/*"
                        onChange={handleFileUpload}
                      />
                    </div>

                    <button 
                      disabled={submitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-100 mt-4 flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Kirim Preorder Sekarang'}
                    </button>

                    <AnimatePresence>
                      {success && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="bg-green-50 text-green-700 p-4 rounded-xl text-center text-sm font-medium border border-green-100"
                        >
                          Pesanan Anda berhasil dikirim!
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </form>
                </div>

                {/* Info Card - Simplified for single column */}
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-amber-800">
                  <Info className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold mb-1">Informasi Pembayaran</p>
                    <p className="text-xs leading-relaxed opacity-80">
                      Transfer ke rekening <strong>Bank ABC 123456789 a.n. KOMITS</strong>. 
                      Upload bukti transfer untuk verifikasi.
                    </p>
                  </div>
                </div>
              </motion.section>
            </div>
        ) : user && (activeTab === 'history' || (isAdmin && activeTab === 'preorder')) ? (
          <div className="w-full">
            {/* Orders Tracking - Full Width */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm overflow-hidden">
                <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                    {isAdmin ? 'Manajemen Pesanan' : 'Riwayat Pesanan Anda'}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button 
                        onClick={exportToExcel}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        Excel
                      </button>
                      <button 
                        onClick={generateShippingLabels}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Label WA
                      </button>
                    </div>
                  )}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                  {orders.length === 0 ? (
                    <div className="text-center py-12 col-span-2">
                      <p className="text-gray-400 text-sm italic">Belum ada pesanan.</p>
                      {!isAdmin && (
                        <button 
                          onClick={() => setActiveTab('preorder')}
                          className="mt-4 text-blue-600 font-bold text-sm hover:underline"
                        >
                          Mulai Preorder Sekarang
                        </button>
                      )}
                    </div>
                  ) : (
                    orders.map((order, idx) => (
                      <motion.div 
                        key={order.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => setSelectedOrder(order)}
                        className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50 hover:bg-white hover:border-blue-100 hover:shadow-md transition-all group cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Order ID: {order.id?.slice(-6).toUpperCase()}</p>
                            <h4 className="font-bold text-gray-800 line-clamp-1">{order.productName || 'Produk'}</h4>
                            <p className="text-[10px] text-gray-500">{order.size} - {order.color}</p>
                          </div>
                          <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg flex items-center gap-1 shrink-0 ${
                            order.status === OrderStatus.PENDING ? 'bg-orange-100 text-orange-600' :
                            order.status === OrderStatus.VERIFIED ? 'bg-green-600 text-white shadow-sm shadow-green-100' :
                            'bg-blue-600 text-white'
                          }`}>
                            {order.status === OrderStatus.VERIFIED && <CheckCircle2 className="w-2.5 h-2.5" />}
                            {order.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-white/50 p-2 rounded-lg">
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Pesan</p>
                            <p className="text-sm font-bold text-gray-600">{order.quantity} pcs</p>
                          </div>
                          <div className="bg-white/50 p-2 rounded-lg">
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Tanggal</p>
                            <p className="text-sm font-bold text-gray-600">
                              {order.createdAt ? (order.createdAt as any).toDate().toLocaleDateString() : '-'}
                            </p>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-2 text-[10px] text-blue-600 font-bold mb-2 truncate">
                            <UserIcon className="w-3 h-3" />
                            {order.name}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{order.address}</span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.section>
          </div>
        ) : null}
      </main>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xl">Detail Pesanan</h3>
                  <p className="text-xs text-gray-400 font-mono">ID: {selectedOrder.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <LogOut className="w-5 h-5 rotate-180" />
                </button>
              </div>

              <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar space-y-6">
                {/* Download Invoice Button for Verified Orders */}
                {(selectedOrder.status === OrderStatus.VERIFIED || selectedOrder.status === OrderStatus.COMPLETED || isAdmin) && (
                  <button 
                    onClick={() => generateInvoice(selectedOrder)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-3 rounded-2xl font-bold text-sm hover:bg-blue-100 transition-colors border border-blue-100"
                  >
                    <Download className="w-4 h-4" />
                    Download Invoice PDF
                  </button>
                )}

                {/* Status Section */}
                <div className="flex flex-col gap-4 bg-gray-50 p-4 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status Pesanan</p>
                      <p className="font-bold text-blue-600 capitalize">{selectedOrder.status}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${
                      selectedOrder.status === OrderStatus.VERIFIED ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">Admin Controls: Update Status</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {[OrderStatus.PENDING, OrderStatus.VERIFIED, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.COMPLETED].map((status) => (
                          <button
                            key={status}
                            onClick={() => handleUpdateStatus(selectedOrder.id!, status)}
                            disabled={selectedOrder.status === status}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              selectedOrder.status === status 
                                ? 'bg-blue-600 text-white cursor-default' 
                                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                            }`}
                          >
                            {status.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => handleDeleteOrder(selectedOrder.id!)}
                          className="w-full py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors border border-red-100"
                        >
                          Hapus Pesanan (Admin Only)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Items Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Informasi Produk</h4>
                  <div className="flex items-center gap-4 bg-white border border-gray-100 p-4 rounded-2xl">
                    <div className="bg-blue-50 p-3 rounded-xl">
                      <Shirt className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">{selectedOrder.productName || 'Kaos KOMITS 2025'}</p>
                      <p className="text-sm text-gray-500">{selectedOrder.size} • {selectedOrder.color} • {selectedOrder.quantity} pcs</p>
                    </div>
                  </div>
                </div>

                {/* Delivery Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Alamat Pengiriman</h4>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <UserIcon className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                      <div>
                        <p className="text-xs font-bold text-gray-400">Penerima</p>
                        <p className="text-sm font-medium">{selectedOrder.name}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Phone className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                      <div>
                        <p className="text-xs font-bold text-gray-400">Telepon</p>
                        <p className="text-sm font-medium">{selectedOrder.phone}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                      <div>
                        <p className="text-xs font-bold text-gray-400">Alamat</p>
                        <p className="text-sm font-medium leading-relaxed">{selectedOrder.address}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Proof Section */}
                <div className="space-y-4 pb-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bukti Pembayaran</h4>
                  <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                    <img 
                      src={selectedOrder.paymentProofUrl} 
                      alt="Payment Proof" 
                      className="w-full h-auto object-contain max-h-[300px]"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

