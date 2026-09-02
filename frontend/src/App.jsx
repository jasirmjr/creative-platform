import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import VendorDashboard from './components/VendorDashboard';
import AuthModal from './components/AuthModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState('marketplace'); // 'marketplace' | 'admin'
  const [pendingVendorCount, setPendingVendorCount] = useState(0);
  const [vendorRefreshKey, setVendorRefreshKey] = useState(0);

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

  const [authModalMode, setAuthModalMode] = useState('member');

  const handleOpenAuth = (mode = 'member') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        user={user}
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        pendingCount={pendingVendorCount}
        onOpenAuth={() => handleOpenAuth('member')}
        onLogout={handleLogout}
      />

      <div className="flex-1">
        {currentView === 'admin' ? (
          <AdminPanel
            key={`admin-${vendorRefreshKey}`}
            user={user}
            onOpenAuth={() => handleOpenAuth('admin')}
            onBackToMarketplace={() => setCurrentView('marketplace')}
            onVendorStatusChanged={handleVendorStatusChanged}
          />
        ) : currentView === 'vendor_studio' ? (
          <VendorDashboard
            key={`vendor-${vendorRefreshKey}`}
            user={user}
            onBackToMarketplace={() => setCurrentView('marketplace')}
          />
        ) : (
          <Dashboard
            key={`dash-${vendorRefreshKey}`}
            user={user}
            onOpenAuth={() => handleOpenAuth('member')}
            onNavigateToAdmin={() => setCurrentView('admin')}
            onNavigateToStudio={() => setCurrentView('vendor_studio')}
          />
        )}
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        defaultMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}