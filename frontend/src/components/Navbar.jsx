import React from 'react';
import { Sparkles, Video, User, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Navbar({ onOpenAuth, user, onLogout, backendHealthy }) {
  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(20px)',
      backgroundColor: 'rgba(10, 12, 16, 0.8)',
      borderBottom: '1px solid var(--border-color)',
      padding: '16px 0'
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', cursor: 'pointer' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
          }}>
            <Video size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              CREATIVE<span style={{ color: '#818cf8' }}>HUB</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Talent & Gear Marketplace
            </div>
          </div>
        </div>

        {/* Center Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          <a href="#categories" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}>Categories</a>
          <a href="#talents" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}>Find Talent</a>
          <a href="#gear" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}>Rent Gear</a>
          <a href="#how-it-works" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}>How it Works</a>
        </div>

        {/* Right Actions & Backend Health */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Backend Status Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '12px',
            background: backendHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${backendHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: backendHealthy ? '#34d399' : '#f87171'
          }}>
            {backendHealthy ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{backendHealthy ? 'API Connected' : 'API Connecting...'}</span>
          </div>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px'
              }}>
                <User size={16} color="#818cf8" />
                <span style={{ fontWeight: 600 }}>{user.name || user.mobile}</span>
                <span style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  background: 'var(--primary)',
                  borderRadius: '4px'
                }}>{user.role}</span>
              </div>
              <button onClick={onLogout} className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Log out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={onOpenAuth} className="btn btn-primary">
              <Sparkles size={16} />
              <span>Get Started / Login</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
