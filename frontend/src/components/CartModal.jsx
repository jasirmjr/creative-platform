import React, { useState, useEffect } from 'react';
import InteractiveCalendarPicker from './InteractiveCalendarPicker';

export default function CartModal({
  isOpen,
  onClose,
  cart,
  onRemoveFromCart,
  onUpdateCartItem,
  onClearCart,
  onCheckoutSuccess,
  onOpenAuth,
  user,
  token: propToken,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [vendorAvailability, setVendorAvailability] = useState({});
  const [expandedCalendarId, setExpandedCalendarId] = useState(null);

  // Multi-Talent Crew Bundle: Master Project Brief States
  const [masterProjectName, setMasterProjectName] = useState('Commercial Production Shoot');
  const [masterLocation, setMasterLocation] = useState('Film Studio / On-Location');
  const [masterStartDate, setMasterStartDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [masterEndDate, setMasterEndDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  );
  const [syncFeedback, setSyncFeedback] = useState(null);

  const token = propToken || sessionStorage.getItem('token');
  const todayStr = new Date().toISOString().split('T')[0];

  // Auto-expand calendar for single item or first item if not expanded
  useEffect(() => {
    if (cart.length === 1 && expandedCalendarId === null) {
      setExpandedCalendarId(cart[0].cart_id !== undefined ? cart[0].cart_id : 0);
    }
  }, [cart]);

  // Fetch blocked / booked date ranges for each vendor in cart
  useEffect(() => {
    if (!isOpen || cart.length === 0) return;

    const vendorIds = [...new Set(cart.map((item) => item.vendor_id || item.id).filter(Boolean))];

    vendorIds.forEach(async (vId) => {
      try {
        const res = await fetch(`/api/v1/schedule/vendor/${vId}`);
        const data = await res.json();
        if (data.success) {
          setVendorAvailability((prev) => ({
            ...prev,
            [vId]: data.all_blocked_ranges || [],
          }));
        }
      } catch (e) {
        console.error('Failed to load vendor availability in cart:', e);
      }
    });
  }, [isOpen, cart]);

  // Synchronize dates across all crew members with 1 click
  const handleSyncAllDates = () => {
    if (!masterStartDate) return;
    const effectiveEnd = masterEndDate || masterStartDate;
    cart.forEach((item, idx) => {
      const itemId = item.cart_id !== undefined ? item.cart_id : idx;
      onUpdateCartItem?.(itemId, {
        start_date: masterStartDate,
        end_date: effectiveEnd,
        project_name: masterProjectName,
        location: masterLocation,
      });
    });
    setSyncFeedback(`Dates synchronized across all ${cart.length} crew members!`);
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  // Helper to check if a cart item has conflicting dates
  const getItemConflict = (item) => {
    const vId = item.vendor_id || item.id;
    const blockedRanges = vendorAvailability[vId] || [];
    if (blockedRanges.length === 0) return null;

    const itemStart = item.start_date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const itemEnd = item.end_date || item.start_date || itemStart;

    for (const b of blockedRanges) {
      const bStart = b.start_date.split('T')[0];
      const bEnd = b.end_date.split('T')[0];

      // Overlap condition
      if (!(itemEnd < bStart || itemStart > bEnd)) {
        return b;
      }
    }
    return null;
  };

  const hasAnyConflict = cart.some((item) => getItemConflict(item) !== null);

  if (!isOpen) return null;

  // Calculate total across all cart items
  const totalAmount = cart.reduce((sum, item) => {
    const start = new Date(item.start_date || Date.now() + 86400000);
    const end = new Date(item.end_date || item.start_date || start);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) || 1);
    const price = Number(item.base_price || item.pricing || 15000);
    return sum + price * days;
  }, 0);

  const handleCheckout = async () => {
    if (!token) {
      setError('Please sign in with your registered account to submit your production hold.');
      onOpenAuth?.();
      return;
    }

    if (cart.length === 0) return;

    setError('');
    setSubmitting(true);

    try {
      // Prepare payload with crew roles and master project details
      const itemsPayload = cart.map((item) => {
        const start = item.start_date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const end = item.end_date || item.start_date || start;
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);
        const days = Math.max(1, Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) || 1);
        const price = Number(item.base_price || item.pricing || 15000);
        const crewRole = item.crew_role || item.skills || item.category_name || (item.category ? item.category.name : null) || 'Creative Specialist';

        return {
          vendor_id: item.vendor_id || item.id,
          resource_id: item.resource_id || null,
          project_name: masterProjectName.trim() || item.project_name || `${item.business_name || item.title || 'Creative'} Production`,
          project_description: item.project_description || item.notes || null,
          start_date: start,
          end_date: end,
          location: masterLocation.trim() || item.location || 'India',
          duration: `${days} Day(s)`,
          estimated_budget: price * days,
          additional_requirements: item.additional_requirements || null,
          crew_role: crewRole,
        };
      });

      const res = await fetch('/api/v1/bookings/checkout-cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: itemsPayload,
          master_project_name: masterProjectName.trim(),
          master_location: masterLocation.trim(),
          master_notes: '',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Checkout failed');

      onClearCart();
      onClose();
      onCheckoutSuccess?.(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl p-6 sm:p-7 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto flex flex-col justify-between"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-heading">
              Review Production Booking
            </h2>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {cart.length} {cart.length === 1 ? 'Talent' : 'Crew Members'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Compact Project Details & Schedule Synchronizer */}
        {cart.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Commercial Ad Shoot"
                  value={masterProjectName}
                  onChange={(e) => setMasterProjectName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Shoot Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Studio 4, Film City"
                  value={masterLocation}
                  onChange={(e) => setMasterLocation(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                />
              </div>
            </div>

            {/* Master Shoot Schedule Sync */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-200/60">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                  Master Schedule:
                </span>
                <input
                  type="date"
                  min={todayStr}
                  value={masterStartDate}
                  onChange={(e) => setMasterStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-600"
                />
                <span className="text-slate-400 text-xs">&rarr;</span>
                <input
                  type="date"
                  min={masterStartDate || todayStr}
                  value={masterEndDate}
                  onChange={(e) => setMasterEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={handleSyncAllDates}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-2xs whitespace-nowrap ml-1"
                >
                  Sync to All
                </button>
              </div>

              {syncFeedback && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  ✓ {syncFeedback}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Cart Items Table */}
        <div className="my-2 border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
          {cart.length === 0 ? (
            <div className="py-12 text-center bg-slate-50">
              <p className="text-sm font-semibold text-slate-700">Your Booking Cart is Empty</p>
              <p className="text-xs text-slate-400 mt-1">
                Browse our approved talent and studios to assemble your production crew.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar max-h-[46vh] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4 font-semibold">Creative / Studio</th>
                    <th className="py-3 px-3 font-semibold">Shoot Dates</th>
                    <th className="py-3 px-3 font-semibold text-center">Days</th>
                    <th className="py-3 px-3 font-semibold">Rate</th>
                    <th className="py-3 px-3 font-semibold">Subtotal</th>
                    <th className="py-3 px-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cart.map((item, idx) => {
                    const itemId = item.cart_id !== undefined ? item.cart_id : idx;
                    const defaultStart = item.start_date || masterStartDate || todayStr;
                    const defaultEnd = item.end_date || masterEndDate || defaultStart;
                    const start = new Date(defaultStart);
                    const end = new Date(defaultEnd);
                    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
                    const price = Number(item.base_price || item.pricing || 15000);
                    const itemTotal = price * days;
                    const conflict = getItemConflict(item);
                    const crewRole = item.crew_role || item.skills || item.category_name || (item.category ? item.category.name : null) || 'Creative Specialist';

                    return (
                      <tr key={itemId} className={`hover:bg-slate-50/70 transition-colors ${conflict ? 'bg-amber-50/30' : ''}`}>
                        {/* Creative / Studio */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-2xs">
                              {item.profile_image ? (
                                <img src={item.profile_image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                (item.business_name || item.title || 'S').charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-bold text-slate-900 truncate text-xs">
                                  {item.business_name || item.title}
                                </h4>
                                <span className="text-blue-500 text-[10px]">✓</span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">
                                {crewRole} &bull; {item.location || 'India'}
                              </p>
                              {conflict && (
                                <span className="inline-block mt-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                                  ⚠ Unavailable ({conflict.reason || 'Off-Duty'} {new Date(conflict.start_date).toLocaleDateString()} to {new Date(conflict.end_date).toLocaleDateString()})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Shoot Dates */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="date"
                              min={todayStr}
                              value={defaultStart}
                              onChange={(e) => {
                                const newStart = e.target.value;
                                onUpdateCartItem?.(itemId, {
                                  start_date: newStart,
                                  end_date: newStart > defaultEnd ? newStart : defaultEnd,
                                });
                              }}
                              className={`bg-slate-50/70 border rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-blue-600 ${
                                conflict ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                              }`}
                            />
                            <span className="text-slate-400 text-xs">&rarr;</span>
                            <input
                              type="date"
                              min={defaultStart || todayStr}
                              value={defaultEnd}
                              onChange={(e) => {
                                onUpdateCartItem?.(itemId, {
                                  end_date: e.target.value,
                                });
                              }}
                              className={`bg-slate-50/70 border rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-blue-600 ${
                                conflict ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Days */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                            {days}d
                          </span>
                        </td>

                        {/* Rate */}
                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-600">
                          ₹{price.toLocaleString()}/{item.pricing_unit || 'day'}
                        </td>

                        {/* Subtotal */}
                        <td className="py-3.5 px-3 whitespace-nowrap font-bold text-slate-900 font-mono">
                          ₹{itemTotal.toLocaleString()}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onRemoveFromCart?.(itemId)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer transition-colors"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer & Checkout Summary */}
        <div className="pt-4 border-t border-slate-100 mt-2">
          {!token && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between mb-3">
              <span>Account required to complete booking.</span>
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Sign In
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Total Production Cost</span>
                <span className="text-2xl font-extrabold text-slate-900 font-mono">
                  ₹{totalAmount.toLocaleString()}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="text-xs text-slate-400 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Add More Talent
              </button>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={submitting || cart.length === 0 || hasAnyConflict}
                className={`px-6 py-2.5 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                  hasAnyConflict
                    ? 'bg-amber-600 hover:bg-amber-700 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <span>
                  {hasAnyConflict
                    ? 'Resolve Schedule Conflicts'
                    : submitting
                    ? 'Confirming Booking...'
                    : `Confirm & Book Crew (${cart.length})`}
                </span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
