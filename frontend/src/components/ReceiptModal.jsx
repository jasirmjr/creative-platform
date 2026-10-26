import React, { useState, useEffect } from 'react';

export default function ReceiptModal({
  isOpen,
  onClose,
  paymentId,
  bookingId,
  vendorId,
  directReceiptData,
  token: propToken,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [bookingPayments, setBookingPayments] = useState([]);
  const [activePaymentId, setActivePaymentId] = useState(paymentId || null);

  const token = propToken || sessionStorage.getItem('token') || localStorage.getItem('token');

  // Load receipt or payments when modal opens
  useEffect(() => {
    if (!isOpen) {
      setReceipt(null);
      setError('');
      setBookingPayments([]);
      return;
    }

    if (directReceiptData) {
      setReceipt(directReceiptData);
      return;
    }

    // If bookingId is provided, first fetch all payments for this booking
    if (bookingId && !paymentId) {
      fetchBookingPayments(bookingId);
    } else if (activePaymentId || paymentId) {
      fetchReceipt(activePaymentId || paymentId);
    } else if (vendorId) {
      fetchVendorDepositReceipt(vendorId);
    }
  }, [isOpen, paymentId, bookingId, vendorId, directReceiptData]);

  // Fetch all payments for a booking
  const fetchBookingPayments = async (bId) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/payments/booking/${bId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch booking payments');

      const payments = data.data || [];
      setBookingPayments(payments);

      if (payments.length > 0) {
        // Default to the latest payment
        const latest = payments[payments.length - 1];
        setActivePaymentId(latest.id);
        fetchReceipt(latest.id);
      } else {
        setError('No completed payment transactions found for this booking.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch single receipt details
  const fetchReceipt = async (id) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/payments/${id}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load receipt details');
      setReceipt(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch vendor deposit receipt
  const fetchVendorDepositReceipt = async (vId) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/payments/vendor/${vId}/deposit`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to find deposit payment');
      if (data.data?.id) {
        fetchReceipt(data.data.id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printElement = document.getElementById('printable-receipt');
    if (!printElement) {
      window.print();
      return;
    }

    // Remove any previously created print iframe
    const existingIframe = document.getElementById('receipt-print-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    // Create a hidden isolated iframe for 100% clean, non-clipped printing
    const iframe = document.createElement('iframe');
    iframe.id = 'receipt-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    // Get all style and link tags from main document to preserve Tailwind & font styles
    const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((tag) => tag.outerHTML)
      .join('\n');

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Receipt_${receipt?.receipt_number || 'Official_Receipt'}</title>
          ${headStyles}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            html, body {
              background-color: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #printable-receipt {
              width: 100% !important;
              max-width: 720px !important;
              margin: 0 auto !important;
              padding: 16px 20px !important;
              box-shadow: none !important;
              border: none !important;
              background: #ffffff !important;
            }
          </style>
        </head>
        <body>
          ${printElement.outerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    // Trigger print after iframe renders styles
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
  };

  if (!isOpen) return null;

  const isDeposit = receipt?.payment_type === 'vendor_deposit';
  const isBalance = receipt?.payment_type === 'balance';
  const isAdvance = receipt?.payment_type === 'advance' || receipt?.payment_type === 'full';

  // Seller Details
  const sellerName =
    receipt?.seller?.name ||
    receipt?.seller?.company_name ||
    (isDeposit
      ? 'Creative Talent Platform Pvt. Ltd.'
      : receipt?.payee?.name || receipt?.payee?.owner || 'Creative Studio Partner');

  const sellerAddress1 =
    receipt?.seller?.address_1 ||
    (isDeposit
      ? '42 MG Road, Indiranagar'
      : receipt?.payee?.discipline
      ? `${receipt.payee.discipline} • Verified Marketplace Partner`
      : 'Creative Studio');

  const sellerAddress2 =
    receipt?.seller?.address_2 ||
    (isDeposit
      ? 'Bangalore, Karnataka, 560038, India'
      : receipt?.payee?.location || 'Bangalore, Karnataka, India');

  const sellerAddress3 =
    receipt?.seller?.address_3 ||
    (isDeposit
      ? 'GSTIN: 29AAACC1206Q1ZB • support@creativehub.com'
      : `Contact: ${receipt?.payee?.email || 'support@creativehub.com'}`);

  // Customer Details
  const customerName =
    receipt?.customer?.name ||
    (isDeposit
      ? receipt?.payer?.name || receipt?.payer?.business_name || 'Registered Creative Studio'
      : receipt?.payer?.name || 'Client');

  const customerAddress1 =
    receipt?.customer?.address_1 ||
    (isDeposit
      ? receipt?.payer?.business_name || 'Creative Studio Partner'
      : receipt?.project?.project_name
      ? `Project: ${receipt.project.project_name}`
      : 'Client Account');

  const customerAddress2 =
    receipt?.customer?.address_2 ||
    (isDeposit
      ? receipt?.payer?.location || 'Bangalore, Karnataka, India'
      : receipt?.project?.location || 'Bangalore, Karnataka, India');

  const customerAddress3 =
    receipt?.customer?.address_3 ||
    (receipt?.payer?.mobile && receipt.payer.mobile !== 'N/A'
      ? `Contact: +91 ${receipt.payer.mobile} • ${receipt?.payer?.email || ''}`
      : `Email: ${receipt?.payer?.email || 'N/A'}`);

  return (
    <>
      {/* Print media stylesheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          .receipt-modal-backdrop,
          .receipt-modal-backdrop * {
            background-color: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
          .receipt-modal-backdrop {
            position: static !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
            inset: auto !important;
          }
          .receipt-modal-card {
            position: static !important;
            display: block !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
          }
          .receipt-scroll-area {
            position: static !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
          }
          #printable-receipt,
          #printable-receipt * {
            visibility: visible !important;
          }
          #printable-receipt {
            position: relative !important;
            display: block !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
        className="receipt-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      >
        <div className="receipt-modal-card bg-slate-100 border border-slate-300 rounded-2xl w-full max-w-3xl shadow-2xl relative my-6 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Top Control Bar (Hidden on print) */}
          <div className="no-print bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Official Payment Receipt
              </span>
              {receipt?.receipt_number && (
                <span className="text-[11px] font-mono bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                  {receipt.receipt_number}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs"
              >
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center text-sm cursor-pointer transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Multiple payments switcher for bookings with both Advance & Balance */}
          {bookingPayments.length > 1 && (
            <div className="no-print bg-slate-50 border-b border-slate-200 px-6 py-2 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
              <span className="text-slate-500 font-medium">Select Receipt:</span>
              {bookingPayments.map((p) => {
                const isSelected = p.id === activePaymentId;
                const label =
                  p.payment_type === 'advance'
                    ? `Advance Deposit (₹${Number(p.amount).toLocaleString()})`
                    : p.payment_type === 'balance'
                    ? `Balance Settlement (₹${Number(p.amount).toLocaleString()})`
                    : `Payment (₹${Number(p.amount).toLocaleString()})`;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActivePaymentId(p.id);
                      fetchReceipt(p.id);
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Scrollable Document Area */}
          <div className="receipt-scroll-area flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/60">
            {loading && (
              <div className="py-20 text-center text-slate-500 text-xs font-medium">
                Loading official receipt document...
              </div>
            )}

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl my-4 text-center">
                {error}
              </div>
            )}

            {receipt && !loading && (
              /* THE PHYSICAL RECEIPT SHEET - Matching INV24.com Reference Layout */
              <div
                id="printable-receipt"
                className="bg-white border border-slate-300 shadow-md p-6 sm:p-10 mx-auto max-w-[720px] text-slate-900 font-sans"
              >
                {/* 1. Header: Big Blue RECEIPT Title + Company Logo */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-600 tracking-tight leading-none uppercase">
                      RECEIPT
                    </h1>
                  </div>

                  {/* Company Logo Badge */}
                  <div className="flex items-center gap-2 text-right">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center text-xs shadow-xs tracking-wider">
                      CH
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-black text-slate-900 leading-none">
                        CREATIVE HUB
                      </div>
                      <div className="text-[9px] font-bold text-blue-600 uppercase tracking-wider mt-0.5">
                        ONLINE ESCROW & TALENT
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Metadata Header Table: Receipt Number | Receipt Date | Payment Method */}
                <div className="mt-6 border border-slate-300 overflow-hidden">
                  <div className="grid grid-cols-3 divide-x divide-slate-300 bg-slate-50 text-center text-[11px] sm:text-xs font-bold text-slate-800">
                    <div className="py-1.5 px-2">Receipt Number</div>
                    <div className="py-1.5 px-2">Receipt Date</div>
                    <div className="py-1.5 px-2">Payment Method</div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-slate-300 border-t border-slate-300 text-center text-[11px] sm:text-xs font-medium text-slate-800 bg-white">
                    <div className="py-2 px-2 font-mono font-bold text-slate-900 truncate">
                      {receipt.receipt_number}
                    </div>
                    <div className="py-2 px-2 truncate">
                      {new Date(receipt.issued_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="py-2 px-2 truncate">
                      {receipt.gateway?.payment_id && receipt.gateway.payment_id !== 'N/A'
                        ? `Razorpay [${receipt.gateway.payment_id}]`
                        : 'Razorpay Gateway'}
                    </div>
                  </div>
                </div>

                {/* 3. SELLER & CUSTOMER Boxes (Side by Side Tables) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                  {/* SELLER Box */}
                  <div>
                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                      SELLER
                    </h3>
                    <div className="border border-slate-300 divide-y divide-slate-300 text-[11px] sm:text-xs text-slate-800 bg-white">
                      <div className="py-1.5 px-2.5 font-bold text-slate-900 truncate">
                        {sellerName}
                      </div>
                      <div className="py-1.5 px-2.5 text-slate-600 truncate">
                        {sellerAddress1}
                      </div>
                      <div className="py-1.5 px-2.5 text-slate-600 truncate">
                        {sellerAddress2}
                      </div>
                      <div className="py-1.5 px-2.5 text-slate-600 truncate">
                        {sellerAddress3}
                      </div>
                    </div>
                  </div>

                  {/* CUSTOMER Box */}
                  <div>
                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                      CUSTOMER
                    </h3>
                    <div className="border border-slate-300 divide-y divide-slate-300 text-[11px] sm:text-xs text-slate-800 bg-white">
                      <div className="py-1.5 px-2.5 font-bold text-slate-900 truncate">
                        {customerName}
                      </div>
                      <div className="py-1.5 px-2.5 text-slate-600 truncate">
                        {customerAddress1}
                      </div>
                      <div className="py-1.5 px-2.5 text-slate-600 truncate">
                        {customerAddress2}
                      </div>
                      <div className="py-1.5 px-2.5 text-slate-600 truncate">
                        {customerAddress3}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Itemized Ledger Table with Solid Blue Header */}
                <div className="mt-6 border border-slate-300 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-blue-600 text-white text-[11px] sm:text-xs font-bold uppercase tracking-wider">
                        <th className="py-2 px-3 border-r border-blue-500 w-1/2">DESCRIPTION</th>
                        <th className="py-2 px-2 border-r border-blue-500 text-center">QUANTITY</th>
                        <th className="py-2 px-2 border-r border-blue-500 text-right">UNIT PRICE</th>
                        <th className="py-2 px-2 border-r border-blue-500 text-right">SUBTOTAL</th>
                        <th className="py-2 px-2 text-right">TAX</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 text-[11px] sm:text-xs">
                      {/* Actual Line Items */}
                      {receipt.line_items?.map((item, idx) => (
                        <tr key={idx} className="bg-white">
                          <td className="py-2.5 px-3 border-r border-slate-300">
                            <div className="font-semibold text-slate-900">{item.description}</div>
                            {item.details && (
                              <div className="text-[10px] text-slate-500 mt-0.5">{item.details}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 border-r border-slate-300 text-center text-slate-700">
                            {item.quantity || '1 Item / Booking'}
                          </td>
                          <td className="py-2.5 px-2 border-r border-slate-300 text-right font-mono text-slate-700">
                            ₹{Number(item.unit_price || item.total || item.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-2 border-r border-slate-300 text-right font-mono font-semibold text-slate-900">
                            ₹{Number(item.subtotal || item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                            ₹{Number(item.tax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}

                      {/* Empty Ledger Rows (Authentic Invoice Format matching reference image) */}
                      {[...Array(4)].map((_, i) => (
                        <tr key={`empty-${i}`} className="h-7 bg-white">
                          <td className="border-r border-slate-300"></td>
                          <td className="border-r border-slate-300"></td>
                          <td className="border-r border-slate-300"></td>
                          <td className="border-r border-slate-300"></td>
                          <td></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* 5. Integrated Notes (Left) & Summary Totals (Right) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 border-t border-slate-300 text-[11px] sm:text-xs">
                    {/* Notes column */}
                    <div className="sm:col-span-7 p-3 sm:p-4 border-b sm:border-b-0 sm:border-r border-slate-300 bg-white flex flex-col justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block mb-1">Notes</span>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {isAdvance
                            ? 'Advance booking token (30%) held securely in Creative Escrow. Shoot dates are locked on vendor calendar. Balance payable upon shoot completion.'
                            : isBalance
                            ? 'Final balance settlement for shoot completion. Escrow released to creative vendor. Production account fully settled.'
                            : 'One-time onboarding security and guarantee deposit for verified marketplace listing.'}
                        </p>
                        {receipt.gateway?.order_id && receipt.gateway.order_id !== 'N/A' && (
                          <p className="text-[10px] text-slate-400 font-mono mt-2">
                            Order ID: {receipt.gateway.order_id} &bull; Payment ID: {receipt.gateway.payment_id}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Totals Summary */}
                    <div className="sm:col-span-5 divide-y divide-slate-300 bg-white text-[11px] sm:text-xs">
                      <div className="flex justify-between py-1.5 px-3 text-slate-700">
                        <span>Subtotal</span>
                        <span className="font-mono font-medium">
                          ₹{Number(receipt.financial_summary?.subtotal || receipt.gateway?.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 px-3 text-slate-700">
                        <span>Tax (0% / Exempt)</span>
                        <span className="font-mono font-medium">₹0.00</span>
                      </div>
                      <div className="flex justify-between py-2 px-3 font-bold text-slate-900 bg-slate-50">
                        <span>Total Paid</span>
                        <span className="font-mono text-sm text-blue-700">
                          ₹{Number(receipt.gateway?.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {isAdvance && receipt.financial_summary?.remaining_balance_due > 0 && (
                        <div className="flex justify-between py-1.5 px-3 text-amber-800 bg-amber-50/60 font-semibold text-[10px] sm:text-[11px]">
                          <span>Balance Due (On Shoot)</span>
                          <span className="font-mono">
                            ₹{Number(receipt.financial_summary.remaining_balance_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {isBalance && (
                        <div className="flex justify-between py-1.5 px-3 text-emerald-800 bg-emerald-50/60 font-semibold text-[10px] sm:text-[11px]">
                          <span>Balance Remaining</span>
                          <span className="font-mono">₹0.00 (Nil)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Thank You Banner */}
                <div className="mt-8 sm:mt-10 text-center">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 tracking-wider uppercase">
                    THANK YOU FOR THE PAYMENT!
                  </h4>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1">
                    This is an authentic computer-generated receipt issued by Creative Platform Pvt. Ltd. Verified and tracked on escrow ledger.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions (Hidden on Print) */}
          <div className="no-print bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-500">
              Receipt authenticated by Creative Talent Platform Pvt. Ltd.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              Close Receipt
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

