import React from 'react';
import { Search, LogOut, ShoppingCart, MessageSquare, Aperture } from 'lucide-react';

export default function Navbar({
  user,
  onOpenAuth,
  onLogout,
  currentView = 'marketplace',
  onNavigate,
  pendingCount = 0,
  cartCount = 0,
  onOpenCart,
  unreadChatCount = 0,
  onOpenChat,
}) {
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isVendor = user?.role === 'vendor';
  const isCustomer = user?.role === 'customer';
  // Dashboards have their own sidebar with messages, cart and search, so the header stays minimal there
  const inDashboard = currentView === 'vendor_studio' || currentView === 'customer_projects';

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  // Marketplace landing gets the floating glass navigation
  if (currentView === 'marketplace') {
    const dashboardTarget = isAdmin ? 'admin' : isVendor ? 'vendor_studio' : isCustomer ? 'customer_projects' : null;
    const dashboardLabel = isAdmin ? 'Admin Console' : isVendor ? 'My Studio' : 'My Dashboard';

    return (
      <header className="fixed top-6 inset-x-0 z-40 font-sans">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-10">
          <nav className="ch-glass flex items-center justify-between h-16 pl-6 pr-2.5 rounded-full">
            <div
              onClick={() => scrollTo('ch-top')}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <Aperture className="w-6 h-6 text-white" strokeWidth={1.6} />
              <span className="text-[17px] font-semibold tracking-[-0.02em] text-ch-text" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
                Creative Hub
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-9 text-sm text-ch-muted">
              <button type="button" onClick={() => scrollTo('ch-studios')} className="text-ch-text cursor-pointer">Talent</button>
              <button type="button" onClick={() => scrollTo('featured-categories')} className="hover:text-ch-text transition-colors cursor-pointer">Gear</button>
              <button type="button" onClick={() => scrollTo('ch-how')} className="hover:text-ch-text transition-colors cursor-pointer">How it works</button>
              <button type="button" onClick={() => (isVendor ? onNavigate?.('vendor_studio') : onOpenAuth('register', 'vendor'))} className="hover:text-ch-text transition-colors cursor-pointer">For studios</button>
            </div>

            <div className="flex items-center gap-2">
              {user && (
                <button
                  onClick={onOpenChat}
                  title="Messages"
                  className="relative w-11 h-11 rounded-full border border-ch-line text-ch-muted hover:text-ch-text hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  {unreadChatCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#3b8bff] text-white rounded-full text-[10px] font-semibold flex items-center justify-center">
                      {unreadChatCount}
                    </span>
                  )}
                </button>
              )}

              {(cartCount > 0 || (user && !isVendor && !isAdmin)) && (
                <button
                  onClick={onOpenCart}
                  title="Cart"
                  className="relative w-11 h-11 rounded-full border border-ch-line text-ch-muted hover:text-ch-text hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#3b8bff] text-white rounded-full text-[10px] font-semibold flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </button>
              )}

              {user ? (
                <>
                  {dashboardTarget && (
                    <button
                      onClick={() => onNavigate?.(dashboardTarget)}
                      className="ch-btn ch-btn-white !h-11 !px-5 flex items-center gap-2"
                    >
                      {isAdmin && pendingCount > 0 && (
                        <span className="px-1.5 bg-amber-500 text-white rounded-full text-[10px] font-bold">{pendingCount}</span>
                      )}
                      <span>{dashboardLabel}</span>
                    </button>
                  )}
                  <button
                    onClick={onLogout}
                    title="Sign Out"
                    className="w-11 h-11 rounded-full overflow-hidden bg-[#0b2a57] text-ch-ice text-xs font-semibold flex items-center justify-center hover:ring-2 hover:ring-white/20 transition-all cursor-pointer group relative"
                  >
                    {user?.profile_image ? (
                      <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (user.name || 'U').charAt(0).toUpperCase()
                    )}
                    <span className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center">
                      <LogOut className="w-4 h-4 text-white" />
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onOpenAuth('login')}
                    className="hidden sm:inline px-4 text-sm text-ch-muted hover:text-ch-text transition-colors cursor-pointer"
                  >
                    Log in
                  </button>
                  <button onClick={() => onOpenAuth('register')} className="ch-btn ch-btn-white !h-11">
                    Get started
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate?.('marketplace')}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none min-w-0"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-xs">
            C
          </div>
          <div>
            <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 block leading-tight font-heading whitespace-nowrap">
              CREATIVE <span className="text-blue-600">HUB</span>
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:block tracking-wider uppercase font-medium">
              Talent & Gear Managed Hub
            </span>
          </div>
        </div>

        {/* Minimal Search Bar */}
        <div className={`${inDashboard ? 'hidden' : 'hidden md:flex'} items-center relative flex-1 max-w-xs lg:max-w-sm`}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search courses, projects, gear..."
            className="w-full bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-200/90 rounded-full pl-10 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all shadow-2xs"
          />
        </div>

        {/* Right Section: Minimal Navigation & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Contextual Navigation Button */}
          {isVendor && currentView === 'vendor_studio' && (
            <button
              onClick={() => onNavigate?.('marketplace')}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs"
            >
              Marketplace
            </button>
          )}

          {isVendor && currentView === 'marketplace' && (
            <button
              onClick={() => onNavigate?.('vendor_studio')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              My Studio Dashboard
            </button>
          )}

          {isCustomer && (
            <button
              onClick={() => onNavigate?.(currentView === 'customer_projects' ? 'marketplace' : 'customer_projects')}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs"
            >
              {currentView === 'customer_projects' ? 'Marketplace' : 'My Dashboard'}
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => onNavigate?.('admin')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                currentView === 'admin'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
              }`}
            >
              <span>Admin Console</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          {/* Show Messages only outside dashboards (they have it in the sidebar) */}
          {user && !inDashboard && (
            <button
              onClick={onOpenChat}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
              {unreadChatCount > 0 && (
                <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-bold animate-pulse">
                  {unreadChatCount}
                </span>
              )}
            </button>
          )}

          {/* Show Cart only when relevant */}
          {(!isVendor || cartCount > 0) && !inDashboard && (
            <button
              onClick={onOpenCart}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <ShoppingCart className="w-4 h-4" aria-label="Cart" />
              {cartCount > 0 && (
                <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* User Profile */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                  {user?.profile_image ? (
                    <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (user.name || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-800 leading-tight hidden sm:inline">
                  {user.name || user.mobile}
                </span>
              </div>

              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="px-3.5 py-1.5 text-slate-700 hover:text-slate-900 text-xs font-semibold transition-colors cursor-pointer"
              >
                Log In
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}