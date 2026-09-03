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
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [vendorAvailability, setVendorAvailability] = useState({});
  const [expandedCalendarId, setExpandedCalendarId] = useState(null);

  const token = localStorage.getItem('token');
  const todayStr = new Date().toISOString().split('T')[0];

  // Auto-expand calendar for single item or first item
  useEffect(() => {
    if (cart.length > 0 && expandedCalendarId === null) {
      setExpandedCalendarId(cart[0].cart_id !== undefined ? cart[0].cart_id : 0);
    }
  }, [cart]);

  // Fetch blocked / booked date ranges for each vendor in cart
  useEffect(() => {
    if (!isOpen || cart.length === 0) return;

    const vendorIds = [...new Set(cart.map((item) => item.vendor_id || item.id).filter(Boolean))];

    vendorIds.forEach(async (vId) => {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/v1/schedule/vendor/${vId}`);
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
      // Prepare payload
      const itemsPayload = cart.map((item) => {
        const start = item.start_date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const end = item.end_date || item.start_date || start;
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);
        const days = Math.max(1, Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) || 1);
        const price = Number(item.base_price || item.pricing || 15000);

        return {
          vendor_id: item.vendor_id || item.id,
          resource_id: item.resource_id || null,
          project_name: item.project_name || `${item.business_name || item.title || 'Creative'} Production`,
          project_description: item.project_description || item.notes || null,
          start_date: start,
          end_date: end,
          location: item.location || 'India',
          duration: `${days} Day(s)`,
          estimated_budget: price * days,
          additional_requirements: item.additional_requirements || null,
        };
      });

      const res = await fetch('http://127.0.0.1:5000/api/v1/bookings/checkout-cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: itemsPayload }),
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
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 sm:p-8 shadow-xl relative my-8 max-h-[90vh] overflow-y-auto flex flex-col justify-between"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
        >
          ✕
        </button>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              Production Hold Cart
            </span>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Your Production Booking Cart
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review your requested creative talent and equipment before submitting for availability review.
          </p>
        </div>

        {error && (
          <div className="my-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Cart Items List */}
        <div className="my-6 space-y-4 max-h-[45vh] overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <span className="text-3xl block mb-2">🛒</span>
              <p className="text-sm font-semibold text-slate-700">Your Cart is Empty</p>
              <p className="text-xs text-slate-400 mt-1">
                Browse our approved talent and studios to request production holds.
              </p>
            </div>
          ) : (
            cart.map((item, idx) => {
              const defaultStart = item.start_date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
              const defaultEnd = item.end_date || item.start_date || defaultStart;
              const start = new Date(defaultStart);
              const end = new Date(defaultEnd);
              const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
              const price = Number(item.base_price || item.pricing || 15000);
              const itemTotal = price * days;
              const vId = item.vendor_id || item.id;
              const blockedRanges = vendorAvailability[vId] || [];
              const conflict = getItemConflict(item);

              return (
                <div
                  key={item.cart_id || idx}
                  className={`p-4 rounded-xl flex flex-col gap-3 shadow-2xs border transition-all ${
                    conflict ? 'bg-amber-50/40 border-amber-300' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">
                          {item.business_name || item.title}
                        </h4>
                        <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          Verified
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Lead: {item.owner_name || item.provider_name || 'Creative Pro'} &bull; {item.location || 'India'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        ₹{itemTotal.toLocaleString()}
                      </span>
                      <span className="block text-[11px] text-slate-400 font-mono">
                        (₹{price.toLocaleString()}/{item.pricing_unit || 'day'} &times; {days}d)
                      </span>
                    </div>
                  </div>

                  {/* Conflict Alert Banner */}
                  {conflict && (
                    <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 animate-fadeIn">
                      <span className="text-base leading-none">⚠️</span>
                      <div>
                        <strong className="font-bold block">Provider Unavailable on Selected Dates:</strong>
                        <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                          {item.business_name || item.title} is{' '}
                          {conflict.type === 'booking'
                            ? 'already booked for a production'
                            : `marked off-duty (${conflict.reason || 'Unavailable'})`}{' '}
                          from <strong>{new Date(conflict.start_date).toLocaleDateString()}</strong> to{' '}
                          <strong>{new Date(conflict.end_date).toLocaleDateString()}</strong>.
                        </p>
                        <p className="text-[11px] text-amber-900 mt-1 font-semibold">
                          &rarr; Please select different shoot dates to enable booking.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Interactive Calendar Header & Toggle */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span>📅</span>
                        <span>Shoot Schedule Dates</span>
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Select start and end dates directly on the calendar below
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCalendarId(
                          expandedCalendarId === (item.cart_id !== undefined ? item.cart_id : idx)
                            ? null
                            : (item.cart_id !== undefined ? item.cart_id : idx)
                        )
                      }
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <span>📅</span>
                      <span>
                        {expandedCalendarId === (item.cart_id !== undefined ? item.cart_id : idx)
                          ? 'Minimize Calendar'
                          : 'Expand Calendar'}
                      </span>
                    </button>
                  </div>

                  {/* VISUAL INTERACTIVE CALENDAR (Shows Booked in Red & Off-Duty in Orange) */}
                  {expandedCalendarId === (item.cart_id !== undefined ? item.cart_id : idx) && (
                    <div className="mt-1 animate-fadeIn">
                      <InteractiveCalendarPicker
                        startDate={defaultStart}
                        endDate={defaultEnd}
                        blockedRanges={blockedRanges}
                        minDate={todayStr}
                        onChange={({ start_date, end_date }) => {
                          onUpdateCartItem?.(item.cart_id !== undefined ? item.cart_id : idx, {
                            start_date,
                            end_date: end_date || start_date,
                          });
                        }}
                      />
                    </div>
                  )}

                  {/* Synced Date Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        min={todayStr}
                        value={defaultStart}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          onUpdateCartItem?.(item.cart_id !== undefined ? item.cart_id : idx, {
                            start_date: newStart,
                            end_date: newStart,
                          });
                        }}
                        className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none transition-all ${
                          conflict
                            ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/20'
                            : 'border-slate-300 focus:border-blue-600'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Date</label>
                      <input
                        type="date"
                        min={defaultStart || todayStr}
                        value={defaultEnd}
                        onChange={(e) =>
                          onUpdateCartItem?.(item.cart_id !== undefined ? item.cart_id : idx, { end_date: e.target.value })
                        }
                        className={`w-full bg-white border rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none transition-all ${
                          conflict
                            ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/20'
                            : 'border-slate-300 focus:border-blue-600'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Optional Notes */}
                  <div>
                    <input
                      type="text"
                      placeholder="Project name or brief notes (e.g. Commercial Shoot in Studio A)..."
                      value={item.project_name || ''}
                      onChange={(e) =>
                        onUpdateCartItem?.(item.cart_id || idx, { project_name: e.target.value })
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  {/* Item Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Duration: <strong>{days} Day(s)</strong>
                    </span>
                    <button
                      onClick={() => onRemoveFromCart?.(item.cart_id || idx)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer transition-colors"
                    >
                      Remove Item
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer & Checkout Summary */}
        <div className="pt-4 border-t border-slate-200">
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed mb-4">
            ✓ <strong>Direct Booking:</strong> Your shoot dates are confirmed directly with the selected talent and studio. Visible immediately in your dashboard, the vendor studio, and admin panel.
          </div>

          {!token && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between mb-4">
              <span>Account required to complete booking.</span>
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Sign In / Join
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs text-slate-500 block">Total Production Cost</span>
              <span className="text-xl font-bold text-slate-900 font-mono">
                ₹{totalAmount.toLocaleString()}
              </span>
            </div>

            {cart.length > 0 && (
              <button
                onClick={onClearCart}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer underline"
              >
                Clear Cart
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Continue Browsing
            </button>

            <button
              onClick={handleCheckout}
              disabled={submitting || cart.length === 0 || hasAnyConflict}
              className={`flex-1 py-2.5 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                hasAnyConflict
                  ? 'bg-amber-600 hover:bg-amber-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <span>
                {hasAnyConflict
                  ? '⚠️ Resolve Date Conflicts to Book'
                  : submitting
                  ? 'Confirming Booking...'
                  : `Confirm & Book Now (${cart.length})`}
              </span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
