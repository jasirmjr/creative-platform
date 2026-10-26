import React, { useState, useEffect } from 'react';
import ReceiptModal from './ReceiptModal';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PaymentModal({
  isOpen,
  onClose,
  booking,
  token,
  onSuccess,
  defaultPaymentType = 'advance', // 'advance' | 'balance' | 'full'
}) {
  const [paymentType, setPaymentType] = useState(defaultPaymentType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [simulatedMethod, setSimulatedMethod] = useState('upi'); // 'upi' | 'card' | 'netbanking'
  const [simulatedUpiId, setSimulatedUpiId] = useState('creative.client@okhdfcbank');
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  useEffect(() => {
    if (isOpen && booking) {
      setError('');
      setPaymentSuccess(null);
      setOrderData(null);
      // If already partially paid, default to balance
      const currentPaid = Number(booking.paid_amount || 0);
      const total = Number(booking.total_amount || 0);
      if (currentPaid > 0 && currentPaid < total) {
        setPaymentType('balance');
      } else {
        setPaymentType(defaultPaymentType);
      }
    }
  }, [isOpen, booking, defaultPaymentType]);

  if (!isOpen || !booking) return null;

  const total = Number(booking.total_amount) || 0;
  const currentPaid = Number(booking.paid_amount) || 0;
  const advanceAmount = Number(booking.advance_amount) || Math.round(total * 0.3);
  const balanceRemaining = Math.max(0, total - currentPaid);

  const selectedPayAmount =
    paymentType === 'advance'
      ? advanceAmount
      : paymentType === 'balance'
      ? balanceRemaining
      : balanceRemaining;

  // Initialize Razorpay Order
  const handleInitiateOrder = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `/api/v1/bookings/${booking.id}/create-razorpay-order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ payment_type: paymentType }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create payment order');

      setOrderData(data);

      // If live keys, ensure Razorpay SDK is loaded and open checkout popup
      if (!data.is_mock) {
        const loaded = await loadRazorpayScript();
        if (loaded && window.Razorpay) {
          launchLiveRazorpay(data);
        } else {
          setError('Failed to load Razorpay Checkout SDK. Please check your internet connection.');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Launch live Razorpay popup
  const launchLiveRazorpay = (order) => {
    const options = {
      key: order.key_id,
      amount: order.amount_paise,
      currency: order.currency || 'INR',
      name: 'Creative Platform',
      description: `Payment for ${booking.project_name || 'Production Service'}`,
      order_id: order.order_id,
      prefill: {
        name: order.booking?.customer_name || '',
        email: order.booking?.customer_email || '',
        contact: order.booking?.customer_mobile || '',
      },
      theme: {
        color: '#2563eb',
      },
      handler: async function (response) {
        await handleVerifyPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          payment_type: order.payment_type,
          amount: order.amount,
          is_mock: false,
        });
      },
      modal: {
        ondismiss: function () {
          console.log('Razorpay modal dismissed');
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  // Complete and verify payment (Simulator or Live)
  const handleVerifyPayment = async (payload) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `/api/v1/bookings/${booking.id}/verify-razorpay-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment verification failed');

      setPaymentSuccess(data);
      onSuccess?.(data.data, data.transaction);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger test simulated payment
  const handleSimulatedPayment = async () => {
    if (!orderData) return;
    const mockPaymentId = `rzp_pay_${simulatedMethod.toUpperCase()}_${Date.now().toString().slice(-6)}`;
    await handleVerifyPayment({
      razorpay_order_id: orderData.order_id,
      razorpay_payment_id: mockPaymentId,
      payment_type: orderData.payment_type,
      amount: orderData.amount,
      is_mock: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative my-8 animate-fadeIn">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-lg cursor-pointer transition-colors"
        >
          ✕
        </button>

        {/* ================= SUCCESS STATE ================= */}
        {paymentSuccess ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-emerald-200 shadow-xs">
              ✓
            </div>
            <h2 className="text-xl font-bold text-slate-900">Payment Verified!</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {paymentSuccess.message}
            </p>

            {/* Digital Receipt Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 my-6 text-left space-y-3 font-mono text-xs">
              <div className="flex justify-between pb-2 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-sans font-bold">
                <span>Receipt Summary</span>
                <span className="text-emerald-600 font-bold">● CONFIRMED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction Ref:</span>
                <span className="font-bold text-slate-800">{paymentSuccess.transaction?.payment_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order ID:</span>
                <span className="text-slate-700">{paymentSuccess.transaction?.order_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Type:</span>
                <span className="capitalize text-slate-800 font-semibold">{paymentSuccess.transaction?.payment_type}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm">
                <span className="text-slate-900 font-sans font-bold">Amount Paid:</span>
                <span className="text-emerald-700 font-bold text-base">₹{Number(paymentSuccess.transaction?.amount).toLocaleString()}</span>
              </div>
              {Number(paymentSuccess.transaction?.balance_due) > 0 && (
                <div className="flex justify-between text-amber-700 pt-1 text-[11px]">
                  <span>Balance Due on Shoot:</span>
                  <span className="font-bold">₹{Number(paymentSuccess.transaction?.balance_due).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setIsReceiptOpen(true)}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                View & Print Official Receipt
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Done & View Project
              </button>
            </div>
          </div>
        ) : (
          /* ================= PAYMENT FLOW ================= */
          <div>
            {/* Header */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200 mb-2">
                <span>Razorpay Checkout</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {currentPaid > 0 ? 'Settle Project Balance' : 'Advance Booking Deposit'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Project: <strong className="text-slate-800">{booking.project_name || 'Creative Production'}</strong>
                {booking.business_name && ` with ${booking.business_name}`}
              </p>
            </div>

            {error && (
              <div className="p-3.5 mb-5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {error}
              </div>
            )}

            {/* Financial Overview Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Booking Fee</span>
                  <span className="text-base font-bold text-slate-900 font-mono">₹{total.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Already Paid</span>
                  <span className="text-base font-bold text-slate-700 font-mono">₹{currentPaid.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 text-xs">
                <span className="text-slate-600 font-medium">
                  {paymentType === 'advance' ? 'Advance Token (30% to Lock Dates):' : 'Remaining Balance:'}
                </span>
                <span className="text-lg font-extrabold text-blue-600 font-mono">
                  ₹{selectedPayAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Step 1: Select Payment Option (only if no order created yet) */}
            {!orderData && (
              <div className="space-y-4 mb-6">
                <label className="text-xs font-bold text-slate-800 block">Choose Payment Option</label>

                {currentPaid === 0 ? (
                  <div className="space-y-2.5">
                    {/* Option A: Advance Deposit */}
                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        paymentType === 'advance'
                          ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentType"
                        value="advance"
                        checked={paymentType === 'advance'}
                        onChange={() => setPaymentType('advance')}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>Pay 30% Advance Deposit (Recommended)</span>
                          <span className="font-mono text-blue-700">₹{advanceAmount.toLocaleString()}</span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Secures and locks the creative crew and shoot dates on the vendor's schedule. The remaining 70% is due upon shoot completion.
                        </p>
                      </div>
                    </label>

                    {/* Option B: Full Payment */}
                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        paymentType === 'full'
                          ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentType"
                        value="full"
                        checked={paymentType === 'full'}
                        onChange={() => setPaymentType('full')}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>Pay Full Amount (100%)</span>
                          <span className="font-mono text-slate-900">₹{total.toLocaleString()}</span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Pay the complete project cost upfront in a single transaction.
                        </p>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>Final Balance Settlement</span>
                      <span className="font-mono text-blue-700">₹{balanceRemaining.toLocaleString()}</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-1">
                      Advance deposit of ₹{currentPaid.toLocaleString()} was already verified. Settle the final balance to conclude this project.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleInitiateOrder}
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>{loading ? 'Generating Razorpay Order...' : `Proceed to Pay ₹${selectedPayAmount.toLocaleString()}`}</span>
                  <span>&rarr;</span>
                </button>
              </div>
            )}

            {/* Step 2: Interactive Razorpay Simulator Card (Shown when mock engine is active) */}
            {orderData && orderData.is_mock && (
              <div className="mt-4 border border-blue-200 bg-linear-to-b from-blue-50/70 to-white rounded-2xl p-5 shadow-xs animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-blue-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-900">Razorpay Test Checkout</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    Test Mode
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mt-2 mb-4">
                  Select a test method below to simulate an instant successful payment. (Live Razorpay keys in <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">.env</code> will auto-switch to real bank checkout).
                </p>

                {/* Simulated Payment Methods */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setSimulatedMethod('upi')}
                    className={`py-2 px-1 text-center text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      simulatedMethod === 'upi'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    UPI / QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulatedMethod('card')}
                    className={`py-2 px-1 text-center text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      simulatedMethod === 'card'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulatedMethod('netbanking')}
                    className={`py-2 px-1 text-center text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      simulatedMethod === 'netbanking'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    NetBanking
                  </button>
                </div>

                {simulatedMethod === 'upi' && (
                  <div className="mb-4 text-xs">
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">Simulated VPA / UPI ID</label>
                    <input
                      type="text"
                      value={simulatedUpiId}
                      onChange={(e) => setSimulatedUpiId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                    />
                  </div>
                )}

                {simulatedMethod === 'card' && (
                  <div className="mb-4 text-xs">
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">Test Card (Auto-Filled)</label>
                    <input
                      type="text"
                      readOnly
                      value="4111 •••• •••• 1111 (Visa Test)"
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700"
                    />
                  </div>
                )}

                {simulatedMethod === 'netbanking' && (
                  <div className="mb-4 text-xs">
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">Test Bank</label>
                    <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-medium">
                      HDFC Bank (Simulated Gateway)
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSimulatedPayment}
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <span>{loading ? 'Verifying Transaction...' : `Simulate Successful Payment (₹${orderData.amount.toLocaleString()})`}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Official Transaction Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        paymentId={paymentSuccess?.transaction?.receipt_id || paymentSuccess?.transaction?.payment_id}
        bookingId={booking?.id}
        token={token}
      />
    </div>
  );
}
