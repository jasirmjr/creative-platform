import React, { useState } from 'react';

export default function BookingModal({ item, isOpen, onClose, onSuccess, token }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resource_id: item.id,
          start_date: startDate,
          end_date: endDate,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit booking');

      onSuccess(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
        >
          ✕
        </button>

        <div className="mb-6">
          <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Booking Reservation
          </span>
          <h3 className="text-xl font-bold text-slate-900 mt-2">{item.title}</h3>
          <p className="text-xs text-blue-600 font-semibold mt-0.5">{item.business_name || item.provider_name}</p>
          <p className="text-xs text-slate-600 mt-2 font-mono">
            Rate: ₹{Number(item.base_price).toLocaleString()} / {item.pricing_unit}
          </p>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Project Notes & Location</label>
            <textarea
              rows="3"
              placeholder="Specify shoot location, crew requirements, or gear delivery notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {submitting ? 'Creating Hold...' : 'Confirm Requirement & Reserve'}
          </button>
        </form>
      </div>
    </div>
  );
}