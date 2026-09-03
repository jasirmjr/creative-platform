import React, { useState } from 'react';

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

  if (!isOpen) return null;

  const token = localStorage.getItem('token');

  // Calculate total across all cart items
  const totalAmount = cart.reduce((sum, item) => {
    const start = new Date(item.start_date || Date.now() + 86400000);
    const end = new Date(item.end_date || Date.now() + 86400000 * 2);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
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
        const end = item.end_date || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);
        const days = Math.max(1, Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 sm:p-8 shadow-xl relative my-8 max-h-[90vh] overflow-y-auto flex flex-col justify-between">
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
              const defaultEnd = item.end_date || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
              const start = new Date(defaultStart);
              const end = new Date(defaultEnd);
              const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
              const price = Number(item.base_price || item.pricing || 15000);
              const itemTotal = price * days;

              return (
                <div
                  key={item.cart_id || idx}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3 shadow-2xs"
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

                  {/* Dates Configuration */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={defaultStart}
                        onChange={(e) =>
                          onUpdateCartItem?.(item.cart_id || idx, { start_date: e.target.value })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Date</label>
                      <input
                        type="date"
                        value={defaultEnd}
                        onChange={(e) =>
                          onUpdateCartItem?.(item.cart_id || idx, { end_date: e.target.value })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
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
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed mb-4">
            📋 <strong>Managed Review Policy:</strong> Submitting holds sends your project requirements to our curation team to confirm provider availability before any payment is requested.
          </div>

          {!token && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between mb-4">
              <span>Account required to submit hold requests.</span>
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
              <span className="text-xs text-slate-500 block">Total Estimated Production Hold</span>
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
              disabled={submitting || cart.length === 0}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <span>{submitting ? 'Submitting Holds...' : `Request Production Holds (${cart.length})`}</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
