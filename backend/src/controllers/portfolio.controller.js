const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Disk Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'work-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB limit (for high-res photos, 4K video clips, and PDF lookbooks)
});

exports.uploadMiddleware = upload.single('file');

// Helper to determine media type from mime or extension
function detectMediaType(mimetype, originalname) {
  if (mimetype) {
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype === 'application/pdf' || mimetype.includes('pdf')) return 'document';
    if (mimetype.startsWith('image/')) return 'image';
  }
  if (originalname) {
    const ext = path.extname(originalname).toLowerCase();
    if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(ext)) return 'video';
    if (['.pdf', '.doc', '.docx'].includes(ext)) return 'document';
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) return 'image';
  }
  return 'image';
}

// POST /api/v1/portfolios/upload
// Protected: Uploads a device file (image, video, or PDF) and returns public media URL
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file received from device.' });
    }

    const mediaType = detectMediaType(req.file.mimetype, req.file.originalname);
    const mediaUrl = `http://127.0.0.1:5000/uploads/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      message: 'Device file uploaded successfully',
      file: {
        filename: req.file.filename,
        original_name: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        media_url: mediaUrl,
        media_type: mediaType,
      },
    });
  } catch (error) {
    console.error('Upload File Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'File upload failed' });
  }
};

// GET /api/v1/portfolios/my
// Protected: Returns all gallery works for the logged-in vendor
exports.getMyPortfolio = async (req, res) => {
  try {
    const userId = req.user.id;

    let vpRes = await db.query('SELECT id FROM vendor_profiles WHERE user_id = $1', [userId]);
    if (vpRes.rows.length === 0) {
      const newVp = await db.query(
        `INSERT INTO vendor_profiles (user_id, business_name, verification_status)
         VALUES ($1, 'Creative Studio', 'pending')
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING id;`,
        [userId]
      );
      vpRes = newVp;
    }
    const vendorId = vpRes.rows[0].id;

    const { rows } = await db.query(
      'SELECT * FROM portfolios WHERE vendor_id = $1 ORDER BY created_at DESC;',
      [vendorId]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Get My Portfolio Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/portfolios
// Protected: Adds a new work to the vendor's gallery (accepts direct media_url or multipart device file)
exports.createPortfolioItem = async (req, res) => {
  try {
    const userId = req.user.id;
    let { title, description, media_url, media_type } = req.body;

    // If file was uploaded directly via multipart/form-data
    if (req.file) {
      media_url = `http://127.0.0.1:5000/uploads/${req.file.filename}`;
      if (!media_type) {
        media_type = detectMediaType(req.file.mimetype, req.file.originalname);
      }
    }

    if (!title || !media_url) {
      return res.status(400).json({
        success: false,
        message: 'Title and media file / URL are required.',
      });
    }

    if (!media_type) {
      media_type = 'image';
    }

    let vpRes = await db.query('SELECT id FROM vendor_profiles WHERE user_id = $1', [userId]);
    let vendorId;

    if (vpRes.rows.length === 0) {
      const newVp = await db.query(
        `INSERT INTO vendor_profiles (user_id, business_name, verification_status)
         VALUES ($1, 'Creative Studio', 'pending')
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING id;`,
        [userId]
      );
      vendorId = newVp.rows[0].id;
    } else {
      vendorId = vpRes.rows[0].id;
    }

    const insertQuery = `
      INSERT INTO portfolios (vendor_id, title, description, media_url, media_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const { rows } = await db.query(insertQuery, [
      vendorId,
      title,
      description || null,
      media_url,
      media_type,
    ]);

    return res.status(201).json({
      success: true,
      message: 'Work published to gallery successfully!',
      data: rows[0],
    });
  } catch (error) {
    console.error('Create Portfolio Item Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// DELETE /api/v1/portfolios/:id
// Protected: Deletes a gallery work owned by the vendor
exports.deletePortfolioItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const checkQuery = `
      SELECT p.id, p.media_url
      FROM portfolios p
      JOIN vendor_profiles vp ON p.vendor_id = vp.id
      WHERE p.id = $1 AND vp.user_id = $2;
    `;
    const checkRes = await db.query(checkQuery, [id, userId]);

    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work not found or you do not have permission to delete it.',
      });
    }

    // Attempt to remove local file from disk if stored in /uploads
    try {
      const itemUrl = checkRes.rows[0].media_url;
      if (itemUrl && itemUrl.includes('/uploads/')) {
        const fname = itemUrl.split('/uploads/').pop();
        const fpath = path.join(uploadDir, fname);
        if (fs.existsSync(fpath)) {
          fs.unlinkSync(fpath);
        }
      }
    } catch (e) {
      console.warn('Could not remove file from disk:', e.message);
    }

    await db.query('DELETE FROM portfolios WHERE id = $1;', [id]);

    return res.status(200).json({
      success: true,
      message: 'Work removed from gallery successfully.',
    });
  } catch (error) {
    console.error('Delete Portfolio Item Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/portfolios/vendor/:vendorId
// Public: Returns public gallery works for a specific vendor
exports.getPublicVendorPortfolio = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const query = `
      SELECT id, vendor_id, title, description, media_url, media_type, created_at
      FROM portfolios
      WHERE vendor_id = $1
      ORDER BY created_at DESC;
    `;
    const { rows } = await db.query(query, [vendorId]);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Get Public Vendor Portfolio Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
