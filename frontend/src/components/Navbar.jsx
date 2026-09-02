import React from 'react';

export default function Navbar({
  user,
  onOpenAuth,
  onLogout,
  currentView = 'marketplace',
  onNavigate,
  pendingCount = 0,
}) {
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate?.('marketplace')}
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-sm">
            C
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900 block leading-tight">
              CREATIVE <span className="text-blue-600">HUB</span>
            </span>
            <span className="text-[10px] text-slate-500 block tracking-wider uppercase font-medium">
              Talent & Gear Managed Hub
            </span>
          </div>
        </div>

        {/* View Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => onNavigate?.('marketplace')}
            className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              currentView === 'marketplace'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Marketplace
          </button>

          {user?.role === 'vendor' && (
            <button
              onClick={() => onNavigate?.('vendor_studio')}
              className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                currentView === 'vendor_studio'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🎨 My Studio</span>
            </button>
          )}

          <button
            onClick={() => onNavigate?.('admin')}
            className={`px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              currentView === 'admin'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Admin Panel</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-slate-800 leading-tight">{user.name || user.mobile}</p>
                <span
                  className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                    isAdmin
                      ? 'text-purple-700 bg-purple-50 border-purple-200'
                      : 'text-blue-700 bg-blue-50 border-blue-200'
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              Sign In / Join
            </button>
          )}
        </div>
      </div>
    </header>
  );
}