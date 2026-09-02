import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CategoryGrid from './components/CategoryGrid';
import AuthModal from './components/AuthModal';
import { Sparkles, CheckCircle, Code2, Server, Globe, ArrowRight } from 'lucide-react';

export default function App() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [apiEndpoints, setApiEndpoints] = useState(null);
  const [activeTab, setActiveTab] = useState('browse');

  // Check Backend Health on mount & retrieve session
  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }

    const checkHealth = async () => {
      try {
        const res = await fetch('/health');
        if (res.ok) {
          const data = await res.json();
          setBackendHealthy(true);
        }
      } catch (err) {
        setBackendHealthy(false);
      }
    };

    const fetchApiInfo = async () => {
      try {
        const res = await fetch('/');
        if (res.ok) {
          const data = await res.json();
          setApiEndpoints(data.endpoints);
        }
      } catch (e) {}
    };

    checkHealth();
    fetchApiInfo();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Ambient background glows */}
      <div className="ambient-bg">
        <div className="ambient-blob-1"></div>
        <div className="ambient-blob-2"></div>
      </div>

      {/* Top Navigation */}
      <Navbar
        onOpenAuth={() => setIsAuthOpen(true)}
        user={user}
        onLogout={handleLogout}
        backendHealthy={backendHealthy}
      />

      {/* Main Content */}
      <main style={{ flex: 1 }}>
        <Hero onOpenAuth={() => setIsAuthOpen(true)} />
        <CategoryGrid onSelectCategory={(cat) => setIsAuthOpen(true)} />

        {/* Backend & Architecture Overview Section */}
        <section style={{ padding: '60px 0 80px', borderTop: '1px solid var(--border-color)' }}>
          <div className="container">
            <div className="badge" style={{ marginBottom: '12px' }}>System Architecture</div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>
              Full-Stack Architecture Overview
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
              
              {/* Frontend Card */}
              <div className="glass-card" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(6, 182, 212, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Globe size={22} color="#06b6d4" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Frontend App</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Port 5173 (React + Vite)</span>
                  </div>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Organized under the <code style={{ color: '#22d3ee', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>frontend/</code> folder. Contains UI components, design tokens, and proxy routes.
                </p>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>📁 <code>frontend/src/components</code> (Navbar, Hero, Auth, Cards)</div>
                  <div>⚡ <code>frontend/vite.config.js</code> (Auto-proxy to backend)</div>
                </div>
              </div>

              {/* Backend Card */}
              <div className="glass-card" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Server size={22} color="#818cf8" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Backend API</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Port 5000 (Node.js + Express + PostgreSQL)</span>
                  </div>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Organized under the <code style={{ color: '#818cf8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>backend/</code> folder. Houses REST controllers, authentication middleware, and schema migrations.
                </p>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>📁 <code>backend/src/controllers</code> (OTP, Auth, Users)</div>
                  <div>🗄️ <code>backend/src/config/migrate.js</code> (PostgreSQL Schema)</div>
                </div>
              </div>

            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '30px 0',
        backgroundColor: 'rgba(10, 12, 16, 0.95)',
        color: 'var(--text-muted)',
        fontSize: '13px'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>© {new Date().getFullYear()} Creative Talent Platform. All rights reserved.</div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>API Documentation</a>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
