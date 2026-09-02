import React from 'react';
import { Search, MapPin, Camera, Star, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function Hero({ onOpenAuth }) {
  return (
    <section style={{ padding: '70px 0 50px', position: 'relative' }}>
      <div className="container" style={{ textAlign: 'center', maxWidth: '860px' }}>
        
        {/* Top Tag */}
        <div style={{ display: 'inline-flex', marginBottom: '20px' }}>
          <div className="badge">
            <Zap size={14} />
            <span>Next-Gen Marketplace for Video, Audio & Cinema Production</span>
          </div>
        </div>

        {/* Main Heading */}
        <h1 style={{
          fontSize: '52px',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-0.03em',
          marginBottom: '20px'
        }}>
          Book Verified <span style={{
            background: 'linear-gradient(135deg, #818cf8 0%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Creative Talent</span> & High-End <span style={{
            background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Production Gear</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '18px',
          color: 'var(--text-secondary)',
          maxWidth: '660px',
          margin: '0 auto 36px',
          fontWeight: 400
        }}>
          Directly connect with vetted directors of photography, editors, sound engineers, and rent RED / ARRI / Sony cinema cameras with secured escrow payments.
        </p>

        {/* Search Bar Container */}
        <div className="glass-card" style={{
          padding: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          maxWidth: '750px',
          margin: '0 auto 40px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            flex: '1 1 220px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 'var(--radius-md)'
          }}>
            <Search size={18} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="E.g. Cinematographer, Sony FX3, Colorist..." 
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                outline: 'none',
                width: '100%',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{
            flex: '0 1 180px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 'var(--radius-md)'
          }}>
            <MapPin size={18} color="var(--text-muted)" />
            <select style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              outline: 'none',
              width: '100%',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
              <option value="mumbai" style={{ background: '#12161f' }}>Mumbai</option>
              <option value="delhi" style={{ background: '#12161f' }}>Delhi NCR</option>
              <option value="bengaluru" style={{ background: '#12161f' }}>Bengaluru</option>
              <option value="hyderabad" style={{ background: '#12161f' }}>Hyderabad</option>
              <option value="all" style={{ background: '#12161f' }}>All Locations</option>
            </select>
          </div>

          <button onClick={onOpenAuth} className="btn btn-primary" style={{ flex: '0 0 auto', padding: '12px 28px' }}>
            <span>Search</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Feature Highlights */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '32px',
          color: 'var(--text-muted)',
          fontSize: '13px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} color="#34d399" />
            <span>100% ID & Equipment Verified</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={16} color="#fbbf24" />
            <span>Escrow Protected Payments</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={16} color="#818cf8" />
            <span>Instant Gear Availability</span>
          </div>
        </div>

      </div>
    </section>
  );
}
