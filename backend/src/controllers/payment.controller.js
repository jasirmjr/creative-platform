const db = require('../config/db');

/**
 * Helper to generate standardized, human-readable receipt serial numbers
 */
function formatReceiptNumber(paymentType, date, id) {
  const year = new Date(date).getFullYear();
  const shortId = (id || '').replace(/-/g, '').slice(0, 6).toUpperCase();
  let prefix = 'GEN';
  if (paymentType === 'advance') prefix = 'ADV';
  else if (paymentType === 'balance') prefix = 'BAL';
  else if (paymentType === 'vendor_deposit') prefix = 'DEP';
  else if (paymentType === 'full') prefix = 'FUL';
  else if (paymentType === 'refund') prefix = 'RFD';

  return `RCP-${prefix}-${year}-${shortId}`;
}

/**
 * GET /api/v1/payments/:id/receipt
 * Retrieves full receipt details for any transaction
 */
exports.getReceiptDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT p.*,
             b.id as booking_id_val,
             b.project_name, b.project_description, b.location as booking_location,
             b.start_date, b.end_date, b.duration, b.total_amount, b.advance_amount, b.paid_amount,
             b.status as booking_status, b.payment_status as booking_payment_status,
             b.customer_id,
             c_user.name as customer_name, c_user.email as customer_email, c_user.mobile as customer_mobile,
             v_prof.id as vendor_profile_id, v_prof.business_name as vendor_business_name,
             v_prof.skills as vendor_skills, v_prof.experience as vendor_experience,
             v_prof.location as vendor_location, v_prof.deposit_status as vendor_deposit_status,
             v_prof.deposit_amount as vendor_deposit_amount,
             v_user.name as vendor_owner_name, v_user.email as vendor_email, v_user.mobile as vendor_mobile
      FROM payments p
      LEFT JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN users c_user ON b.customer_id = c_user.id
      LEFT JOIN vendor_profiles v_prof ON (p.vendor_id = v_prof.id OR b.vendor_id = v_prof.id)
      LEFT JOIN users v_user ON v_prof.user_id = v_user.id
      WHERE p.id::text = $1 OR p.razorpay_payment_id = $1 OR p.razorpay_order_id = $1
      LIMIT 1;
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment record or receipt not found.',
      });
    }

    const row = result.rows[0];
    const receiptNumber = formatReceiptNumber(row.payment_type, row.created_at, row.id);
    const amount = Number(row.amount || 0);

    let receiptData = {
      receipt_id: row.id,
      receipt_number: receiptNumber,
      issued_at: row.created_at,
      payment_type: row.payment_type,
      payment_status: row.payment_status,
      gateway: {
        payment_id: row.razorpay_payment_id || 'N/A',
        order_id: row.razorpay_order_id || 'N/A',
        currency: 'INR',
        amount_paid: amount,
      },
    };

    if (row.payment_type === 'vendor_deposit') {
      // 1. VENDOR ONBOARDING GUARANTEE DEPOSIT RECEIPT
      receiptData = {
        ...receiptData,
        type_badge: 'VENDOR ONBOARDING GUARANTEE DEPOSIT',
        type_category: 'vendor_deposit',
        title: 'Vendor Studio Onboarding & Listing Guarantee Receipt',
        escrow_status: 'ACTIVE PLATFORM DEPOSIT',
        description: 'One-time onboarding security and guarantee deposit for creative studio marketplace listing.',
        seller: {
          name: 'Creative Talent Platform Pvt. Ltd.',
          company_name: 'Creative Talent Platform Pvt. Ltd.',
          address_1: '42 MG Road, Indiranagar',
          address_2: 'Bangalore, Karnataka, 560038, India',
          address_3: 'GSTIN: 29AAACC1206Q1ZB • support@creativehub.com',
        },
        customer: {
          name: row.vendor_owner_name || row.vendor_business_name || 'Registered Creative Studio',
          address_1: row.vendor_business_name ? `${row.vendor_business_name} (${row.vendor_skills || 'Creative Studio'})` : 'Creative Studio',
          address_2: row.vendor_location || 'Bangalore, Karnataka, India',
          address_3: `Contact: +91 ${row.vendor_mobile || 'N/A'} • ${row.vendor_email || 'N/A'}`,
        },
        payer: {
          name: row.vendor_owner_name || row.vendor_business_name || 'Registered Creative Studio',
          business_name: row.vendor_business_name || 'Creative Studio',
          email: row.vendor_email || 'N/A',
          mobile: row.vendor_mobile || 'N/A',
          discipline: row.vendor_skills || 'Creative Professional',
          location: row.vendor_location || 'India',
        },
        payee: {
          name: 'Creative Platform Operations',
          entity: 'Creative Talent Platform Pvt. Ltd.',
          email: 'finance@creativehub.com',
          location: 'Bangalore, Karnataka, India',
        },
        line_items: [
          {
            description: `Onboarding & Marketplace Listing Security Deposit - ${row.vendor_business_name || 'Studio'}`,
            details: `Discipline: ${row.vendor_skills || 'Creative Professional'} • Verified Marketplace Badge`,
            quantity: '1 Listing',
            unit_price: amount,
            subtotal: amount,
            tax: 0,
            total: amount,
          },
        ],
        financial_summary: {
          subtotal: amount,
          tax: 0,
          total_paid: amount,
          balance_due: 0,
          currency: 'INR',
        },
        legal_notes: [
          'This receipt certifies payment of the platform onboarding deposit.',
          'Maintains active verified listing status on the creative talent marketplace.',
          'Refundable subject to platform terms of service and anti-no-show compliance.',
        ],
      };
    } else if (row.payment_type === 'balance') {
      // 2. FINAL BALANCE SETTLEMENT RECEIPT
      const totalBudget = Number(row.total_amount || amount);
      const totalPaidSoFar = Number(row.paid_amount || totalBudget);
      const advancePaid = Math.max(0, totalPaidSoFar - amount);

      receiptData = {
        ...receiptData,
        type_badge: 'FINAL BALANCE SETTLEMENT',
        type_category: 'balance',
        title: 'Project Final Balance Settlement Receipt',
        escrow_status: 'ESCROW RELEASED & SETTLED',
        description: `Final balance settlement for completed production "${row.project_name || 'Creative Project'}".`,
        seller: {
          name: row.vendor_business_name || row.vendor_owner_name || 'Creative Studio Partner',
          company_name: row.vendor_business_name || row.vendor_owner_name || 'Creative Studio Partner',
          address_1: row.vendor_skills ? `${row.vendor_skills} • Marketplace Partner` : 'Creative Studio',
          address_2: row.vendor_location || 'Bangalore, Karnataka, India',
          address_3: `Contact: +91 ${row.vendor_mobile || 'N/A'} • ${row.vendor_email || 'support@creativehub.com'}`,
        },
        customer: {
          name: row.customer_name || 'Client',
          address_1: `Project: ${row.project_name || 'Creative Production'}`,
          address_2: row.booking_location || 'Bangalore, Karnataka, India',
          address_3: `Contact: +91 ${row.customer_mobile || 'N/A'} • ${row.customer_email || 'N/A'}`,
        },
        project: {
          booking_id: row.booking_id_val,
          project_name: row.project_name || 'Creative Production',
          project_description: row.project_description || '',
          location: row.booking_location || 'India',
          start_date: row.start_date,
          end_date: row.end_date,
          duration: row.duration || 'Shoot Duration',
          status: row.booking_status,
        },
        payer: {
          name: row.customer_name || 'Client',
          email: row.customer_email || 'N/A',
          mobile: row.customer_mobile || 'N/A',
          role: 'Client / Producer',
        },
        payee: {
          name: row.vendor_business_name || row.vendor_owner_name || 'Creative Studio Partner',
          owner: row.vendor_owner_name,
          discipline: row.vendor_skills || 'Creative Professional',
          mobile: row.vendor_mobile || 'N/A',
          email: row.vendor_email || 'N/A',
        },
        line_items: [
          {
            description: `Final Balance Settlement (Shoot Completed) - ${row.project_name || 'Production'}`,
            details: `${row.duration || 'Full Project'} at ${row.booking_location || 'Location'}`,
            quantity: row.duration || '1 Project',
            unit_price: amount,
            subtotal: amount,
            tax: 0,
            total: amount,
          },
        ],
        financial_summary: {
          subtotal: amount,
          tax: 0,
          total_project_value: totalBudget,
          advance_previously_paid: advancePaid,
          balance_paid_in_this_tx: amount,
          total_cumulative_paid: totalPaidSoFar,
          remaining_balance_due: 0,
          currency: 'INR',
        },
        legal_notes: [
          'All project commitments have been completed and verified.',
          'The platform escrow for this booking is now fully released and settled.',
          'Full copyright and production deliverables ownership transferred as per booking agreement.',
        ],
      };
    } else {
      // 3. PROJECT ADVANCE BOOKING DEPOSIT RECEIPT (Default: 'advance' or 'full')
      const totalBudget = Number(row.total_amount || (amount / 0.3));
      const totalPaidSoFar = Number(row.paid_amount || amount);
      const remainingBalance = Math.max(0, totalBudget - totalPaidSoFar);

      receiptData = {
        ...receiptData,
        type_badge: 'ADVANCE BOOKING DEPOSIT (ESCROW HELD)',
        type_category: 'advance',
        title: 'Project Advance Booking Token Receipt',
        escrow_status: 'HELD IN PLATFORM ESCROW',
        description: `Advance deposit token locking creative dates for "${row.project_name || 'Creative Project'}".`,
        seller: {
          name: row.vendor_business_name || row.vendor_owner_name || 'Creative Studio Partner',
          company_name: row.vendor_business_name || row.vendor_owner_name || 'Creative Studio Partner',
          address_1: row.vendor_skills ? `${row.vendor_skills} • Marketplace Partner` : 'Creative Studio',
          address_2: row.vendor_location || 'Bangalore, Karnataka, India',
          address_3: `Contact: +91 ${row.vendor_mobile || 'N/A'} • ${row.vendor_email || 'support@creativehub.com'}`,
        },
        customer: {
          name: row.customer_name || 'Client',
          address_1: `Project: ${row.project_name || 'Creative Production'}`,
          address_2: row.booking_location || 'Bangalore, Karnataka, India',
          address_3: `Contact: +91 ${row.customer_mobile || 'N/A'} • ${row.customer_email || 'N/A'}`,
        },
        project: {
          booking_id: row.booking_id_val,
          project_name: row.project_name || 'Creative Production',
          project_description: row.project_description || '',
          location: row.booking_location || 'India',
          start_date: row.start_date,
          end_date: row.end_date,
          duration: row.duration || 'Shoot Duration',
          status: row.booking_status,
        },
        payer: {
          name: row.customer_name || 'Client',
          email: row.customer_email || 'N/A',
          mobile: row.customer_mobile || 'N/A',
          role: 'Client / Producer',
        },
        payee: {
          name: row.vendor_business_name || row.vendor_owner_name || 'Creative Studio Partner',
          owner: row.vendor_owner_name,
          discipline: row.vendor_skills || 'Creative Professional',
          mobile: row.vendor_mobile || 'N/A',
          email: row.vendor_email || 'N/A',
        },
        line_items: [
          {
            description: `Advance Booking Deposit (30% Token to Lock Shoot Dates) - ${row.project_name || 'Production'}`,
            details: `Scheduled for ${new Date(row.start_date).toLocaleDateString()} to ${new Date(row.end_date || row.start_date).toLocaleDateString()}`,
            quantity: row.duration || '1 Booking',
            unit_price: totalBudget,
            subtotal: amount,
            tax: 0,
            total: amount,
          },
        ],
        financial_summary: {
          subtotal: amount,
          tax: 0,
          total_project_value: totalBudget,
          advance_paid_in_this_tx: amount,
          total_cumulative_paid: totalPaidSoFar,
          remaining_balance_due: remainingBalance,
          currency: 'INR',
        },
        legal_notes: [
          'This advance deposit is held securely in platform escrow.',
          'Shoot dates are locked exclusively on the vendor calendar.',
          'The remaining balance is payable upon shoot completion prior to final delivery.',
        ],
      };
    }

    return res.status(200).json({
      success: true,
      data: receiptData,
    });
  } catch (error) {
    console.error('Get Receipt Details Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while generating receipt.',
    });
  }
};

/**
 * GET /api/v1/payments/booking/:bookingId
 * Returns all payments associated with a specific booking (advance, balance, etc.)
 */
exports.getBookingPayments = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const result = await db.query(
      `SELECT id, booking_id, razorpay_order_id, razorpay_payment_id, amount, payment_type, payment_status, created_at
       FROM payments
       WHERE booking_id = $1
       ORDER BY created_at ASC`,
      [bookingId]
    );

    const formatted = result.rows.map((p) => ({
      ...p,
      receipt_number: formatReceiptNumber(p.payment_type, p.created_at, p.id),
      amount: Number(p.amount),
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Get Booking Payments Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

/**
 * GET /api/v1/payments/vendor/:vendorId/deposit
 * Returns the onboarding listing deposit payment for a specific vendor
 */
exports.getVendorDepositPayment = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const result = await db.query(
      `SELECT id, vendor_id, razorpay_order_id, razorpay_payment_id, amount, payment_type, payment_status, created_at
       FROM payments
       WHERE vendor_id = $1 AND payment_type = 'vendor_deposit'
       ORDER BY created_at DESC
       LIMIT 1`,
      [vendorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No listing deposit payment record found for this vendor.',
      });
    }

    const payment = result.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        ...payment,
        receipt_number: formatReceiptNumber(payment.payment_type, payment.created_at, payment.id),
        amount: Number(payment.amount),
      },
    });
  } catch (error) {
    console.error('Get Vendor Deposit Payment Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
