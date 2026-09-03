import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import VendorDashboard from './components/VendorDashboard';
import CustomerDashboard from './components/CustomerDashboard';
import AuthModal from './components/AuthModal';
import CartModal from './components/CartModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState('login');
  const [authInitialRole, setAuthInitialRole] = useState('customer');
  const getDefaultView = (userData) => {
    if (!userData) return 'marketplace';
    if (userData.role === 'admin' || userData.role === 'super_admin') return 'admin';
    if (userData.role === 'vendor') return 'vendor_studio';
    if (userData.role === 'customer') return 'customer_projects';
    return 'marketplace';
  };

  const [currentView, setCurrentView] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        return getDefaultView(u);
      }
    } catch (e) {}
    return 'marketplace';
  });
  const [pendingVendorCount, setPendingVendorCount] = useState(0);
  const [vendorRefreshKey, setVendorRefreshKey] = useState(0);

  // Cart State (Persisted in localStorage)
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('booking_cart')) || [];
    } catch (e) {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('booking_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cart]);

  const handleAddToCart = (item) => {
    const defaultStart = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const defaultEnd = item.start_date || defaultStart;

    const cartItem = {
      ...item,
      cart_id: `${item.id || item.vendor_id || 'item'}_${Date.now()}`,
      start_date: item.start_date || defaultStart,
      end_date: item.end_date || defaultEnd,
      pricing: item.pricing || item.base_price || 15000,
      base_price: item.base_price || item.pricing || 15000,
      pricing_unit: item.pricing_unit || 'day',
    };

    setCart((prev) => [...prev, cartItem]);
    setIsCartOpen(true);
  };

  const handleRemoveFromCart = (cartId) => {
    setCart((prev) => prev.filter((item, idx) => (item.cart_id || idx) !== cartId));
  };

  const handleUpdateCartItem = (cartId, updates) => {
    setCart((prev) =>
      prev.map((item, idx) =>
        (item.cart_id || idx) === cartId ? { ...item, ...updates } : item
      )
    );
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleCheckoutSuccess = (createdBookings) => {
    setCurrentView('customer_projects');
    alert(`Success! ${createdBookings?.length || 1} booking(s) confirmed and scheduled!`);
  };

  const fetchPendingVendorsCount = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/vendors/list');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const count = data.data.filter((v) => v.verification_status === 'pending').length;
        setPendingVendorCount(count);
      }
    } catch (e) {
      console.error('Failed to load pending vendor count:', e);
    }
  }, []);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to load session from localStorage', e);
    }
    fetchPendingVendorsCount();
  }, [fetchPendingVendorsCount]);

  const handleLoginSuccess = (userData, token) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    setIsAuthModalOpen(false);

    // Redirect user to appropriate dashboard
    if (userData.role === 'admin' || userData.role === 'super_admin') {
      setCurrentView('admin');
    } else if (userData.role === 'vendor') {
      setCurrentView('vendor_studio');
    } else if (userData.role === 'customer') {
      setCurrentView('customer_projects');
    }
    fetchPendingVendorsCount();
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setCurrentView('marketplace');
  };

  const handleVendorStatusChanged = () => {
    fetchPendingVendorsCount();
    setVendorRefreshKey((prev) => prev + 1);
  };

  const handleOpenAuth = (mode = 'login', role = 'customer') => {
    setAuthInitialMode(mode);
    setAuthInitialRole(role);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        user={user}
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        pendingCount={pendingVendorCount}
        cartCount={cart.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      <div className="flex-1">
        {currentView === 'admin' ? (
          <AdminPanel
            key={`admin-${vendorRefreshKey}`}
            user={user}
            onOpenAuth={handleOpenAuth}
            onBackToMarketplace={() => setCurrentView('marketplace')}
            onVendorStatusChanged={handleVendorStatusChanged}
          />
        ) : currentView === 'vendor_studio' ? (
          <VendorDashboard
            key={`vendor-${vendorRefreshKey}`}
            user={user}
            onBackToMarketplace={() => setCurrentView('marketplace')}
          />
        ) : currentView === 'customer_projects' ? (
          <CustomerDashboard
            key={`customer-${vendorRefreshKey}`}
            user={user}
            onOpenAuth={handleOpenAuth}
            onBackToMarketplace={() => setCurrentView('marketplace')}
            onAddToCart={handleAddToCart}
            onOpenCart={() => setIsCartOpen(true)}
          />
        ) : (
          <Dashboard
            key={`dash-${vendorRefreshKey}`}
            user={user}
            onOpenAuth={handleOpenAuth}
            onNavigateToAdmin={() => setCurrentView('admin')}
            onNavigateToStudio={() => setCurrentView('vendor_studio')}
            onNavigateToCustomerProjects={() => setCurrentView('customer_projects')}
            onAddToCart={handleAddToCart}
            onOpenCart={() => setIsCartOpen(true)}
          />
        )}
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authInitialMode}
        initialRole={authInitialRole}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        user={user}
        onOpenAuth={handleOpenAuth}
        onRemoveFromCart={handleRemoveFromCart}
        onUpdateCartItem={handleUpdateCartItem}
        onClearCart={handleClearCart}
        onCheckoutSuccess={handleCheckoutSuccess}
      />
    </div>
  );
}