const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure chat uploads directory exists
const chatUploadsDir = path.join(__dirname, '../../uploads/chat');
if (!fs.existsSync(chatUploadsDir)) {
  fs.mkdirSync(chatUploadsDir, { recursive: true });
}

// Multer Disk Storage Configuration for Chat Files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, chatUploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'chat-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per attachment
});

exports.chatUploadMiddleware = upload.single('file');

// Helper to determine media type
function detectFileType(mimetype, originalname) {
  if (mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype === 'application/pdf' || mimetype.includes('pdf')) return 'document';
  }
  if (originalname) {
    const ext = path.extname(originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return 'image';
    if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(ext)) return 'video';
    if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) return 'audio';
    if (['.pdf', '.doc', '.docx', '.txt', '.zip', '.rar', '.csv'].includes(ext)) return 'document';
  }
  return 'file';
}

// Helper to get socket.io instance
function getSocketIO() {
  try {
    const { getIO } = require('../socket/chat.socket');
    return getIO();
  } catch (err) {
    return null;
  }
}

// Helper to resolve vendor profile ID from user ID
async function getVendorProfileIdForUser(userId) {
  const res = await db.query('SELECT id FROM vendor_profiles WHERE user_id = $1', [userId]);
  return res.rows.length > 0 ? res.rows[0].id : null;
}

// GET /api/v1/chat/conversations
// List all conversations for the logged-in customer, vendor, or admin
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    let vendorId = null;
    if (userRole === 'vendor') {
      vendorId = await getVendorProfileIdForUser(userId);
    }

    let whereClause = '';
    let queryParams = [userId];

    const queryType = req.query.type; // 'client' | 'admin_vendor' | undefined

    if (isAdmin) {
      // Admins see all admin_vendor conversations
      whereClause = `WHERE c.type = 'admin_vendor'`;
      queryParams = [];
    } else if (userRole === 'vendor') {
      if (queryType === 'client') {
        // Only customer booking conversations
        whereClause = `WHERE c.vendor_id = $2::UUID AND (c.type IS NULL OR c.type = 'customer_vendor')`;
      } else if (queryType === 'admin_vendor') {
        // Only platform admin support conversation
        whereClause = `WHERE c.vendor_id = $2::UUID AND c.type = 'admin_vendor'`;
      } else {
        // Both customer conversations and platform admin support conversation
        whereClause = `WHERE c.vendor_id = $2::UUID`;
      }
      queryParams = [userId, vendorId];
    } else {
      // Customers see their vendor conversations
      whereClause = `WHERE c.customer_id = $1 AND (c.type IS NULL OR c.type = 'customer_vendor')`;
      queryParams = [userId];
    }

    // Query conversations
    const query = `
      SELECT 
        c.id,
        c.customer_id,
        c.vendor_id,
        c.admin_id,
        c.type,
        c.booking_id,
        c.last_message_at,
        c.created_at,
        -- Customer details (if customer_vendor)
        u_cust.name AS customer_name,
        u_cust.email AS customer_email,
        u_cust.mobile AS customer_mobile,
        -- Vendor details
        vp.business_name,
        vp.location AS vendor_location,
        vp.profile_image AS vendor_profile_image,
        u_vend.name AS vendor_owner_name,
        u_vend.id AS vendor_user_id,
        -- Admin details (if assigned)
        u_admin.name AS admin_name,
        u_admin.email AS admin_email,
        -- Booking details (if attached)
        b.project_name,
        b.status AS booking_status,
        b.total_amount AS booking_total_amount,
        b.start_date AS booking_start_date,
        b.end_date AS booking_end_date,
        -- Last message
        (
          SELECT json_build_object(
            'id', m.id,
            'message', m.message,
            'file_name', m.file_name,
            'file_type', m.file_type,
            'sender_id', m.sender_id,
            'sender_role', m.sender_role,
            'created_at', m.created_at,
            'is_read', m.is_read
          )
          FROM messages m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) AS last_message,
        -- Unread messages count for this user
        (
          SELECT COUNT(*)::int 
          FROM messages m 
          WHERE m.conversation_id = c.id 
            AND ${isAdmin ? "m.sender_role != 'admin'" : "m.sender_id != $1"}
            AND m.is_read = FALSE
        ) AS unread_count,
        -- Active complaint/dispute context if exists
        (
          SELECT json_build_object(
            'id', comp.id,
            'complaint_number', comp.complaint_number,
            'status', comp.status,
            'subject', comp.subject,
            'desired_resolution_type', comp.desired_resolution_type,
            'desired_resolution_amount', comp.desired_resolution_amount,
            'vendor_offer_type', comp.vendor_offer_type,
            'vendor_offer_amount', comp.vendor_offer_amount,
            'settlement_agreed', comp.settlement_agreed,
            'resolution_deadline', comp.resolution_deadline,
            'days_remaining', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (comp.resolution_deadline - NOW())) / 86400)),
            'hours_remaining', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (comp.resolution_deadline - NOW())) / 3600)),
            'is_expired', (NOW() > comp.resolution_deadline)
          )
          FROM complaints comp
          WHERE comp.booking_id = c.booking_id
            AND comp.status NOT IN ('resolved', 'dismissed')
          ORDER BY comp.created_at DESC
          LIMIT 1
        ) AS active_complaint
      FROM conversations c
      LEFT JOIN users u_cust ON u_cust.id = c.customer_id
      JOIN vendor_profiles vp ON vp.id = c.vendor_id
      JOIN users u_vend ON u_vend.id = vp.user_id
      LEFT JOIN users u_admin ON u_admin.id = c.admin_id
      LEFT JOIN bookings b ON b.id = c.booking_id
      ${whereClause}
      ORDER BY c.last_message_at DESC;
    `;

    const result = await db.query(query, queryParams);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getConversations error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch conversations.' });
  }
};

// POST /api/v1/chat/conversations
// Find or create a conversation between customer and vendor OR admin and vendor
exports.getOrCreateConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';
    let { vendor_id, customer_id, booking_id, type } = req.body;

    const convType = type === 'admin_vendor' || isAdmin ? 'admin_vendor' : 'customer_vendor';
    let conversationId = null;

    if (convType === 'admin_vendor') {
      let targetVendorId = vendor_id;
      if (userRole === 'vendor') {
        targetVendorId = await getVendorProfileIdForUser(userId);
        if (!targetVendorId) {
          return res.status(403).json({ success: false, message: 'Vendor profile not found for this account.' });
        }
      }

      if (!targetVendorId) {
        return res.status(400).json({
          success: false,
          message: 'vendor_id is required to establish an admin-vendor conversation.',
        });
      }

      // Check if admin_vendor conversation already exists for this vendor
      const existing = await db.query(
        `SELECT id FROM conversations WHERE vendor_id = $1 AND type = 'admin_vendor' LIMIT 1;`,
        [targetVendorId]
      );

      if (existing.rows.length > 0) {
        conversationId = existing.rows[0].id;
      } else {
        const adminIdToSet = isAdmin ? userId : null;
        const newConv = await db.query(
          `INSERT INTO conversations (admin_id, vendor_id, type, last_message_at)
           VALUES ($1, $2, 'admin_vendor', NOW())
           RETURNING id;`,
          [adminIdToSet, targetVendorId]
        );
        conversationId = newConv.rows[0].id;
      }
    } else {
      // Customer <-> Vendor chat
      if (userRole === 'customer') {
        customer_id = userId;
        if (!vendor_id && booking_id) {
          const bRes = await db.query('SELECT vendor_id FROM bookings WHERE id = $1', [booking_id]);
          if (bRes.rows.length > 0) vendor_id = bRes.rows[0].vendor_id;
        }
      } else if (userRole === 'vendor') {
        const myVendorId = await getVendorProfileIdForUser(userId);
        if (!myVendorId) {
          return res.status(403).json({ success: false, message: 'Vendor profile not found for this account.' });
        }
        vendor_id = myVendorId;
        if (!customer_id && booking_id) {
          const bRes = await db.query('SELECT customer_id FROM bookings WHERE id = $1', [booking_id]);
          if (bRes.rows.length > 0) customer_id = bRes.rows[0].customer_id;
        }
      }

      if (!customer_id || !vendor_id) {
        return res.status(400).json({
          success: false,
          message: 'Both customer_id and vendor_id are required to establish a conversation.',
        });
      }

      let existing;
      if (booking_id) {
        existing = await db.query(
          `SELECT id FROM conversations WHERE customer_id = $1 AND vendor_id = $2 AND booking_id = $3 LIMIT 1;`,
          [customer_id, vendor_id, booking_id]
        );
      } else {
        existing = await db.query(
          `SELECT id FROM conversations WHERE customer_id = $1 AND vendor_id = $2 AND booking_id IS NULL AND (type IS NULL OR type = 'customer_vendor') LIMIT 1;`,
          [customer_id, vendor_id]
        );
      }

      if (existing.rows.length > 0) {
        conversationId = existing.rows[0].id;
      } else {
        const newConv = await db.query(
          `INSERT INTO conversations (customer_id, vendor_id, booking_id, type, last_message_at)
           VALUES ($1, $2, $3, 'customer_vendor', NOW())
           RETURNING id;`,
          [customer_id, vendor_id, booking_id || null]
        );
        conversationId = newConv.rows[0].id;
      }
    }

    // Fetch full enriched conversation details
    const convDetails = await db.query(
      `SELECT 
        c.id,
        c.customer_id,
        c.vendor_id,
        c.admin_id,
        c.type,
        c.booking_id,
        c.last_message_at,
        c.created_at,
        u_cust.name AS customer_name,
        u_cust.email AS customer_email,
        u_cust.mobile AS customer_mobile,
        vp.business_name,
        vp.location AS vendor_location,
        vp.profile_image AS vendor_profile_image,
        u_vend.name AS vendor_owner_name,
        u_vend.id AS vendor_user_id,
        u_admin.name AS admin_name,
        u_admin.email AS admin_email,
        b.project_name,
        b.status AS booking_status,
        b.total_amount AS booking_total_amount,
        b.start_date AS booking_start_date,
        b.end_date AS booking_end_date,
        -- Active complaint/dispute context if exists
        (
          SELECT json_build_object(
            'id', comp.id,
            'complaint_number', comp.complaint_number,
            'status', comp.status,
            'subject', comp.subject,
            'desired_resolution_type', comp.desired_resolution_type,
            'desired_resolution_amount', comp.desired_resolution_amount,
            'vendor_offer_type', comp.vendor_offer_type,
            'vendor_offer_amount', comp.vendor_offer_amount,
            'settlement_agreed', comp.settlement_agreed,
            'resolution_deadline', comp.resolution_deadline,
            'days_remaining', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (comp.resolution_deadline - NOW())) / 86400)),
            'hours_remaining', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (comp.resolution_deadline - NOW())) / 3600)),
            'is_expired', (NOW() > comp.resolution_deadline)
          )
          FROM complaints comp
          WHERE comp.booking_id = c.booking_id
            AND comp.status NOT IN ('resolved', 'dismissed')
          ORDER BY comp.created_at DESC
          LIMIT 1
        ) AS active_complaint
      FROM conversations c
      LEFT JOIN users u_cust ON u_cust.id = c.customer_id
      JOIN vendor_profiles vp ON vp.id = c.vendor_id
      JOIN users u_vend ON u_vend.id = vp.user_id
      LEFT JOIN users u_admin ON u_admin.id = c.admin_id
      LEFT JOIN bookings b ON b.id = c.booking_id
      WHERE c.id = $1;`,
      [conversationId]
    );

    return res.status(200).json({
      success: true,
      data: convDetails.rows[0],
    });
  } catch (err) {
    console.error('getOrCreateConversation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to initiate conversation.' });
  }
};

// GET /api/v1/chat/conversations/:id/messages
// Get all messages for a specific conversation & auto mark as read
exports.getMessages = async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    // Verify participant authorization
    const convCheck = await db.query(
      `SELECT c.*, vp.user_id AS vendor_user_id 
       FROM conversations c
       JOIN vendor_profiles vp ON vp.id = c.vendor_id
       WHERE c.id = $1;`,
      [conversationId]
    );

    if (convCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    const conv = convCheck.rows[0];
    const isParticipant = conv.customer_id === userId || conv.vendor_user_id === userId || isAdmin;
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Access denied to this conversation.' });
    }

    // Automatically mark incoming messages as read
    if (isAdmin) {
      await db.query(
        `UPDATE messages 
         SET is_read = TRUE, read_at = NOW() 
         WHERE conversation_id = $1 AND sender_role != 'admin' AND is_read = FALSE;`,
        [conversationId]
      );
    } else {
      await db.query(
        `UPDATE messages 
         SET is_read = TRUE, read_at = NOW() 
         WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE;`,
        [conversationId, userId]
      );
    }

    // Notify partner via socket that messages were read
    const io = getSocketIO();
    if (io) {
      io.to(`conv:${conversationId}`).emit('messages_read', {
        conversation_id: conversationId,
        read_by: userId,
        read_at: new Date(),
      });
    }

    // Fetch messages list
    const messages = await db.query(
      `SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.sender_role,
        m.message,
        m.file_url,
        m.file_name,
        m.file_type,
        m.file_size,
        m.is_read,
        m.read_at,
        m.created_at,
        u.name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC;`,
      [conversationId]
    );

    return res.status(200).json({ success: true, data: messages.rows });
  } catch (err) {
    console.error('getMessages error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve messages.' });
  }
};

// POST /api/v1/chat/conversations/:id/messages
// Send a message (text and/or file attachment)
exports.sendMessage = async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';
    const messageText = req.body.message || '';

    let file_url = null;
    let file_name = null;
    let file_type = null;
    let file_size = null;

    if (req.file) {
      file_url = `/uploads/chat/${req.file.filename}`;
      file_name = req.file.originalname;
      file_type = detectFileType(req.file.mimetype, req.file.originalname);
      file_size = req.file.size;
    }

    if (!messageText.trim() && !file_url) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty. Please provide text or an attachment.',
      });
    }

    // Verify participant
    const convCheck = await db.query(
      `SELECT c.*, vp.user_id AS vendor_user_id, u_cust.name AS customer_name, vp.business_name
       FROM conversations c
       JOIN vendor_profiles vp ON vp.id = c.vendor_id
       LEFT JOIN users u_cust ON u_cust.id = c.customer_id
       WHERE c.id = $1;`,
      [conversationId]
    );

    if (convCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    const conv = convCheck.rows[0];
    const isCustomer = conv.customer_id === userId;
    const isVendor = conv.vendor_user_id === userId;

    if (!isCustomer && !isVendor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    let effectiveRole = 'customer';
    let recipientUserId = null;

    if (conv.type === 'admin_vendor') {
      if (isAdmin) {
        effectiveRole = 'admin';
        recipientUserId = conv.vendor_user_id;
        // Update admin_id on conversation to current admin responding
        await db.query(`UPDATE conversations SET admin_id = $1 WHERE id = $2`, [userId, conversationId]);
      } else {
        effectiveRole = 'vendor';
        recipientUserId = null; // Broadcasts to role:admin room
      }
    } else {
      effectiveRole = isCustomer ? 'customer' : isVendor ? 'vendor' : 'admin';
      recipientUserId = isCustomer ? conv.vendor_user_id : conv.customer_id;
    }

    // Insert message into database
    const insertRes = await db.query(
      `INSERT INTO messages (
        conversation_id, sender_id, sender_role, message, 
        file_url, file_name, file_type, file_size, is_read
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
      RETURNING *;`,
      [
        conversationId,
        userId,
        effectiveRole,
        messageText.trim(),
        file_url,
        file_name,
        file_type,
        file_size,
      ]
    );

    const savedMessage = insertRes.rows[0];

    // Update conversation last_message_at
    await db.query(
      `UPDATE conversations SET last_message_at = NOW() WHERE id = $1;`,
      [conversationId]
    );

    // Get sender name for enrichment
    const senderRes = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
    savedMessage.sender_name = senderRes.rows[0]?.name || (effectiveRole === 'admin' ? 'Platform Support' : 'User');

    // Broadcast via Socket.IO
    const io = getSocketIO();
    if (io) {
      // Broadcast to all clients inside conversation room
      io.to(`conv:${conversationId}`).emit('new_message', savedMessage);

      // Notification routing
      if (conv.type === 'admin_vendor') {
        if (effectiveRole === 'admin') {
          // Notify vendor user
          io.to(`user:${conv.vendor_user_id}`).emit('chat_notification', {
            conversation_id: conversationId,
            sender_id: userId,
            sender_name: 'Platform Support',
            sender_role: 'admin',
            message: savedMessage.message,
            file_name: savedMessage.file_name,
            file_type: savedMessage.file_type,
            created_at: savedMessage.created_at,
          });
        } else {
          // Vendor sent message -> notify all admins
          io.to('role:admin').emit('chat_notification', {
            conversation_id: conversationId,
            sender_id: userId,
            sender_name: savedMessage.sender_name,
            sender_role: 'vendor',
            business_name: conv.business_name,
            message: savedMessage.message,
            file_name: savedMessage.file_name,
            file_type: savedMessage.file_type,
            created_at: savedMessage.created_at,
          });
        }
      } else {
        if (recipientUserId) {
          io.to(`user:${recipientUserId}`).emit('chat_notification', {
            conversation_id: conversationId,
            sender_id: userId,
            sender_name: savedMessage.sender_name,
            sender_role: effectiveRole,
            message: savedMessage.message,
            file_name: savedMessage.file_name,
            file_type: savedMessage.file_type,
            created_at: savedMessage.created_at,
          });
        }
      }
    }

    return res.status(201).json({ success: true, data: savedMessage });
  } catch (err) {
    console.error('sendMessage error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
};

// PATCH /api/v1/chat/conversations/:id/read
// Explicitly mark all messages in a conversation as read
exports.markConversationRead = async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

    if (isAdmin) {
      await db.query(
        `UPDATE messages 
         SET is_read = TRUE, read_at = NOW() 
         WHERE conversation_id = $1 AND sender_role != 'admin' AND is_read = FALSE;`,
        [conversationId]
      );
    } else {
      await db.query(
        `UPDATE messages 
         SET is_read = TRUE, read_at = NOW() 
         WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE;`,
        [conversationId, userId]
      );
    }

    const io = getSocketIO();
    if (io) {
      io.to(`conv:${conversationId}`).emit('messages_read', {
        conversation_id: conversationId,
        read_by: userId,
        read_at: new Date(),
      });
    }

    return res.status(200).json({ success: true, message: 'Messages marked as read.' });
  } catch (err) {
    console.error('markConversationRead error:', err);
    return res.status(500).json({ success: false, message: 'Failed to mark messages as read.' });
  }
};

// GET /api/v1/chat/unread-count
// Total unread messages count with support for client vs admin segregation
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';
    const queryType = req.query.type; // 'client' | 'admin_vendor' | undefined

    let count = 0;
    let client_count = 0;
    let admin_count = 0;

    if (isAdmin) {
      const result = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.type = 'admin_vendor'
          AND m.sender_role != 'admin'
          AND m.is_read = FALSE;
      `);
      count = result.rows[0]?.count || 0;
      admin_count = count;
    } else if (userRole === 'vendor') {
      const vendorId = await getVendorProfileIdForUser(userId);

      // Unread messages from clients
      const clientRes = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.vendor_id = $1::UUID
          AND (c.type IS NULL OR c.type = 'customer_vendor')
          AND m.sender_id != $2
          AND m.is_read = FALSE;
      `, [vendorId, userId]);
      client_count = clientRes.rows[0]?.count || 0;

      // Unread messages from platform admin support
      const adminRes = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.vendor_id = $1::UUID
          AND c.type = 'admin_vendor'
          AND m.sender_role = 'admin'
          AND m.is_read = FALSE;
      `, [vendorId]);
      admin_count = adminRes.rows[0]?.count || 0;

      if (queryType === 'client') {
        count = client_count;
      } else if (queryType === 'admin_vendor') {
        count = admin_count;
      } else {
        count = client_count + admin_count;
      }
    } else {
      const result = await db.query(`
        SELECT COUNT(*)::int AS count
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.customer_id = $1
          AND m.sender_id != $1
          AND m.is_read = FALSE;
      `, [userId]);
      count = result.rows[0]?.count || 0;
      client_count = count;
    }

    return res.status(200).json({
      success: true,
      count,
      client_count,
      admin_count,
    });
  } catch (err) {
    console.error('getUnreadCount error:', err);
    return res.status(500).json({ success: false, count: 0, client_count: 0, admin_count: 0 });
  }
};
