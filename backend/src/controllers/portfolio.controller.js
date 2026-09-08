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
// Protected: Returns all gallery works for the logged-in vendor ONLY
exports.getMyPortfolio = async (req, res) => {
  try {
    const userId = req.user.id;

    const vpRes = await db.query('SELECT id FROM vendor_profiles WHERE user_id = $1', [userId]);
    if (vpRes.rows.length === 0) {
      // User is not a registered vendor or has no studio profile; return empty gallery
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
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
// Helper to extract preview thumbnail from external media URLs (Instagram, YouTube, Vimeo)
async function resolveMediaThumbnail(url) {
  if (!url) return null;
  const trimmed = url.trim();

  // 1. YouTube
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      thumbnailUrl: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
    };
  }

  // 2. Vimeo
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      type: 'vimeo',
      thumbnailUrl: `https://vumbnail.com/${vimeoMatch[3]}.jpg`,
    };
  }

  // 3. Instagram
  const igMatch = trimmed.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  if (igMatch && igMatch[1]) {
    const code = igMatch[1];
    try {
      const res = await fetch(`https://www.instagram.com/reel/${code}/embed/`);
      if (res.ok) {
        const html = await res.text();
        const matchImg = html.match(/class=["']EmbeddedMediaImage["'][^>]*src=["']([^"']+)["']/i);
        if (matchImg && matchImg[1]) {
          return {
            type: 'instagram',
            thumbnailUrl: matchImg[1].replace(/&amp;/g, '&'),
          };
        }
      }
    } catch (e) {
      console.warn('Instagram thumbnail resolution error:', e.message);
    }
    return {
      type: 'instagram',
      thumbnailUrl: null,
    };
  }

  return null;
}

// Protected: Adds a new work to the vendor's gallery (accepts direct media_url or multipart device file)
exports.createPortfolioItem = async (req, res) => {
  try {
    const userId = req.user.id;
    let { title, description, media_url, media_type, thumbnail_url } = req.body;

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

    // Auto-resolve thumbnail if not provided
    if (!thumbnail_url && media_url) {
      const resolved = await resolveMediaThumbnail(media_url);
      if (resolved && resolved.thumbnailUrl) {
        thumbnail_url = resolved.thumbnailUrl;
      }
    }

    const vpRes = await db.query('SELECT id FROM vendor_profiles WHERE user_id = $1', [userId]);
    if (vpRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only registered vendors can upload works to a studio gallery.',
      });
    }
    const vendorId = vpRes.rows[0].id;

    const insertQuery = `
      INSERT INTO portfolios (vendor_id, title, description, media_url, media_type, thumbnail_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const { rows } = await db.query(insertQuery, [
      vendorId,
      title,
      description || null,
      media_url,
      media_type,
      thumbnail_url || null,
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
      SELECT id, vendor_id, title, description, media_url, media_type, thumbnail_url, created_at
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

// GET /api/v1/portfolios/media-preview?url=...
// Public: Extracts clean preview metadata (thumbnail, type) from external media URLs
exports.getMediaPreview = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL parameter is required.' });
    }

    const resolved = await resolveMediaThumbnail(url);
    return res.status(200).json({
      success: true,
      data: resolved || { type: 'unknown', thumbnailUrl: null },
    });
  } catch (error) {
    console.error('Get Media Preview Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to extract media preview' });
  }
};

