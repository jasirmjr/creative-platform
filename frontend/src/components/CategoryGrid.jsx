import React, { useState } from 'react';
import { Camera, Film, Mic, Radio, Aperture, Layers, Music, MonitorPlay, ArrowUpRight } from 'lucide-react';

const CATEGORIES = [
  {
    id: 'cinematography',
    type: 'talent',
    name: 'Cinematographers & DoPs',
    tag: 'Talent',
    count: '140+ Available',
    icon: Camera,
    color: '#6366f1',
    description: 'Award-winning narrative, commercial & music video directors of photography.'
  },
  {
    id: 'camera-rentals',
    type: 'gear',
    name: 'Cinema Cameras & Lenses',
    tag: 'Gear Rental',
    count: '320+ Units',
    icon: Aperture,
    color: '#06b6d4',
    description: 'ARRI Alexa Mini LF, RED V-Raptor, Sony FX6/FX3 with Cooke & Cine Prime lenses.'
  },
  {
    id: 'editing',
    type: 'talent',
    name: 'Video Editors & Colorists',
    tag: 'Talent',
    count: '95+ Available',
    icon: Film,
    color: '#ec4899',
    description: 'DaVinci Resolve certified colorists, long-form documentary & reel editors.'
  },
  {
    id: 'lighting-grip',
    type: 'gear',
    name: 'Lighting & Grip Trucks',
    tag: 'Gear Rental',
    count: '180+ Packages',
    icon: Layers,
    color: '#f59e0b',
    description: 'Aputure 1200d, Nanlite, Asteras, C-stands, dollies and generator backup trucks.'
  },
  {
    id: 'sound-engineers',
    type: 'talent',
    name: 'Sound Recordists & Mixers',
    tag: 'Talent',
    count: '60+ Available',
    icon: Mic,
    color: '#10b981',
    description: 'Location audio recordists with Sound Devices mixpre kits & wireless lavs.'
  },
  {
    id: 'drone-operators',
    type: 'talent',
    name: 'Licensed Drone Pilots',
    tag: 'Talent',
    count: '45+ Available',
    icon: Radio,
    color: '#a855f7',
    description: 'DGCA certified FPV and DJI Inspire 3 aerial cinematography specialists.'
  }
];

export default function CategoryGrid({ onSelectCategory }) {
  const [filter, setFilter] = useState('all');

  const filteredCategories = CATEGORIES.filter(cat => {
    if (filter === 'all') return true;
    return cat.type === filter;
  });

  return (
    <section id="categories" style={{ padding: '60px 0 80px' }}>
      <div className="container">
        
        {/* Section Header */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: '36px',
          gap: '16px'
        }}>
          <div>
            <div className="badge" style={{ marginBottom: '8px' }}>Explore Market</div>
            <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Browse by Creative Discipline
            </h2>
          </div>

          {/* Filter Pills */}
          <div style={{
            display: 'flex',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)'
          }}>
            {['all', 'talent', 'gear'].map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: filter === type ? 'var(--primary)' : 'transparent',
                  color: filter === type ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                {type === 'all' ? 'All Categories' : type === 'talent' ? '🎬 Talent' : '📦 Gear Rental'}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px'
        }}>
          {filteredCategories.map(cat => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                className="glass-card"
                onClick={() => onSelectCategory(cat)}
                style={{
                  padding: '28px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: `${cat.color}20`,
                      border: `1px solid ${cat.color}50`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={24} color={cat.color} />
                    </div>
                    
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      background: cat.type === 'talent' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                      color: cat.type === 'talent' ? '#818cf8' : '#22d3ee',
                      border: `1px solid ${cat.type === 'talent' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`
                    }}>
                      {cat.tag}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '8px' }}>
                    {cat.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                    {cat.description}
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-color)',
                  fontSize: '13px',
                  color: 'var(--text-muted)'
                }}>
                  <span>{cat.count}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#818cf8', fontWeight: 600 }}>
                    <span>Explore</span>
                    <ArrowUpRight size={16} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
