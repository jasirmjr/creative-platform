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

export default function VendorDepositModal({
  isOpen,
  onClose,
  token,
  vendorProfile,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [simulatedMethod, setSimulatedMethod] = useState('upi'); // 'upi' | 'card' | 'netbanking'
  const [simulatedUpiId, setSimulatedUpiId] = useState('creative.studio@okhdfcbank');
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setPaymentSuccess(null);
      setOrderData(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const depositAmount = Number(vendorProfile?.deposit_amount || 2000);

  // Initialize Razorpay Order for Vendor Deposit
  const handleInitiateOrder = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/vendors/deposit/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to initiate listing deposit order');

      setOrderData(data);

      // If live keys, ensure Razorpay SDK is loaded and open popup
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
      description: `Studio Onboarding Deposit for ${order.vendor?.business_name || 'Creative Partner'}`,
      order_id: order.order_id,
      prefill: {
        name: order.vendor?.business_name || '',
      },
      theme: {
        color: '#2563eb',
      },
      handler: async function (response) {
        await handleVerifyPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          is_mock: false,
        });
      },
      modal: {
        ondismiss: function () {
          setLoading(false);
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  // Verify payment on backend
  const handleVerifyPayment = async (payload) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/vendors/deposit/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Deposit payment verification failed');

      setPaymentSuccess(data);
      if (onSuccess) onSuccess(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit test simulated payment
  const handleSimulatePayment = async () => {
    if (!orderData) return;
    const simPaymentId = `pay_sim_${Date.now()}`;
    await handleVerifyPayment({
      razorpay_order_id: orderData.order_id,
      razorpay_payment_id: simPaymentId,
      razorpay_signature: 'simulated_test_signature',
      is_mock: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-lg cursor-pointer transition-colors"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-6">
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
            Studio Onboarding & Listing Activation
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">
            Vendor Listing Deposit
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Activate your profile on the Creative Platform marketplace to showcase your works and receive verified client bookings.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3.5 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Step 1: Summary & Initiate */}
        {!paymentSuccess && !orderData && (
          <div className="space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Creative Studio:</span>
                <span className="font-semibold text-slate-800">
                  {vendorProfile?.business_name || 'Your Studio'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Marketplace Status:</span>
                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                  Pending Activation
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Listing Deposit:</span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  ₹{depositAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Value Props */}
            <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 text-xs space-y-2 text-slate-700">
              <div className="font-semibold text-purple-900">
                Why is this deposit required?
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-600 list-disc list-inside">
                <li>Locks your verified listing on the public landing page & search.</li>
                <li>Qualifies your studio to receive direct client project inquiries.</li>
                <li>Maintains high marketplace trust and verified partner quality.</li>
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Pay Later
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleInitiateOrder}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Initiating...' : `Proceed to Pay ₹${depositAmount.toLocaleString()}`}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Simulated Checkout (When Mock/Local Mode) */}
        {!paymentSuccess && orderData && orderData.is_mock && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                  Test Payment Sandbox
                </span>
                <p className="text-xs text-slate-700 font-medium mt-1">
                  Razorpay Simulation &bull; Amount: <span className="font-bold font-mono">₹{depositAmount.toLocaleString()}</span>
                </p>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSimulatedMethod('upi')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  simulatedMethod === 'upi'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                UPI / QR
              </button>
              <button
                type="button"
                onClick={() => setSimulatedMethod('card')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  simulatedMethod === 'card'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Debit Card
              </button>
              <button
                type="button"
                onClick={() => setSimulatedMethod('netbanking')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  simulatedMethod === 'netbanking'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Net Banking
              </button>
            </div>

            {/* Form Fields for Simulation */}
            {simulatedMethod === 'upi' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">Virtual Payment Address (VPA)</label>
                <input
                  type="text"
                  value={simulatedUpiId}
                  onChange={(e) => setSimulatedUpiId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-blue-600"
                />
                <p className="text-[10px] text-slate-400">Accepts any test UPI ID (e.g. gpay, phonepe, paytm)</p>
              </div>
            )}

            {simulatedMethod === 'card' && (
              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Card Number</label>
                  <input
                    type="text"
                    readOnly
                    value="4111 •••• •••• 1111"
                    className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-600 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Expiry</label>
                    <input
                      type="text"
                      readOnly
                      value="12 / 28"
                      className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-600 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">CVV</label>
                    <input
                      type="text"
                      readOnly
                      value="•••"
                      className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-600 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {simulatedMethod === 'netbanking' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">Select Bank</label>
                <select className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600">
                  <option>HDFC Bank</option>
                  <option>State Bank of India</option>
                  <option>ICICI Bank</option>
                  <option>Axis Bank</option>
                </select>
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={handleSimulatePayment}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {loading ? (
                <span>Verifying Simulation...</span>
              ) : (
                <span>Authorize & Confirm ₹{depositAmount.toLocaleString()} Deposit</span>
              )}
            </button>
          </div>
        )}

        {/* Step 3: Success Confirmation */}
        {paymentSuccess && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 font-bold rounded-full flex items-center justify-center mx-auto text-xl border border-emerald-200">
              OK
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Deposit Successfully Paid!
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Your creative studio profile is now verified and live on the marketplace landing page. Clients can now discover your services and book productions!
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-2 max-w-sm mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-500">Deposit Paid:</span>
                <span className="font-bold text-slate-900 font-mono">₹{depositAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Marketplace Status:</span>
                <span className="font-bold text-emerald-700">Active & Listed</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction Ref:</span>
                <span className="font-mono text-slate-600 text-[10px]">
                  {paymentSuccess.transaction?.payment_id || paymentSuccess.data?.deposit_payment_id || 'RZP_DEP_OK'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 max-w-sm mx-auto pt-2">
              <button
                type="button"
                onClick={() => setIsReceiptOpen(true)}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                View & Print Deposit Receipt
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                Go to Studio Dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Official Transaction Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        paymentId={paymentSuccess?.transaction?.receipt_id || paymentSuccess?.data?.deposit_payment_id}
        vendorId={vendorProfile?.id}
        token={token}
      />
    </div>
  );
}
