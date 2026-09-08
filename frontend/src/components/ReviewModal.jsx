import React, { useState } from 'react';

export default function ReviewModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
  token: propToken,
}) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !booking) return null;

  const token = propToken || sessionStorage.getItem('token');

  const ratingDescriptions = {
    1: '1 Star - Needs Significant Improvement',
    2: '2 Stars - Below Expectations',
    3: '3 Stars - Met Expectations',
    4: '4 Stars - Great Work & Very Professional',
    5: '5 Stars - Exceptional & Highly Recommended!',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_id: booking.id,
          rating,
          comment,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit review');

      onSuccess(data.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-base cursor-pointer"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            Verified Client Review
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">
            Rate Your Production Experience
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Review for <strong>{booking.business_name || booking.provider_name || 'Creative Partner'}</strong> on project &ldquo;{booking.project_name || 'Creative Shoot'}&rdquo;.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star Rating Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Overall Rating *
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-3xl transition-transform hover:scale-110 cursor-pointer focus:outline-none"
                >
                  <span
                    className={
                      (hoverRating || rating) >= star
                        ? 'text-amber-400'
                        : 'text-slate-200'
                    }
                  >
                    ★
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs font-medium text-amber-700 mt-1.5">
              {ratingDescriptions[hoverRating || rating]}
            </p>
          </div>

          {/* Review Text */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Your Review / Feedback *
            </label>
            <textarea
              rows={4}
              required
              placeholder="How was the communication, work quality, professionalism, and turnaround time?..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 transition-all leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || !comment.trim()}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>⭐</span>
              <span>{submitting ? 'Submitting...' : 'Post Verified Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
