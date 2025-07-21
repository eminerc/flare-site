const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Rate limiting for uploads
const uploadLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 uploads per windowMs
  message: { error: 'Too many upload attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for auth endpoints
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth attempts per windowMs
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
    }
  }
});

// JWT middleware for authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Optional auth middleware (doesn't require token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
};

// Database initialization
const initializeDatabase = async () => {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        email_verified BOOLEAN DEFAULT FALSE,
        trial_uploads_count INTEGER DEFAULT 0,
        trial_uploads_limit INTEGER DEFAULT 10,
        last_login TIMESTAMP
      );
    `);

    // Create photo_trials table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS photo_trials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        original_filename VARCHAR(255),
        original_path VARCHAR(500),
        processed_path VARCHAR(500),
        file_size INTEGER,
        mime_type VARCHAR(100),
        processing_status VARCHAR(50) DEFAULT 'pending',
        processing_error TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        metadata JSONB,
        is_public BOOLEAN DEFAULT FALSE
      );
    `);

    // Create feedback_responses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        email VARCHAR(255),
        feedback_type VARCHAR(100),
        rating INTEGER,
        comments TEXT,
        other_feedback TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET
      );
    `);

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_photo_trials_user_id ON photo_trials(user_id);
      CREATE INDEX IF NOT EXISTS idx_photo_trials_status ON photo_trials(processing_status);
      CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback_responses(user_id);
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

// Initialize database on startup
initializeDatabase();

// User Registration
router.post('/register', authLimit, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    await client.query('BEGIN');

    // Check if user already exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await client.query(`
      INSERT INTO users (email, password_hash, name, last_login) 
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
      RETURNING id, email, name, trial_uploads_count, trial_uploads_limit, created_at
    `, [email.toLowerCase(), passwordHash, name || null]);

    const user = userResult.rows[0];

    await client.query('COMMIT');

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        trialUploadsCount: user.trial_uploads_count,
        trialUploadsLimit: user.trial_uploads_limit,
        joinedAt: user.created_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  } finally {
    client.release();
  }
});

// User Login
router.post('/login', authLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const userResult = await pool.query(`
      SELECT id, email, password_hash, name, trial_uploads_count, trial_uploads_limit, created_at
      FROM users WHERE email = $1
    `, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        trialUploadsCount: user.trial_uploads_count,
        trialUploadsLimit: user.trial_uploads_limit,
        joinedAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Photo Upload for Trials
router.post('/upload-trial', uploadLimit, authenticateToken, upload.array('photos', 5), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.user;
    const uploadedFiles = req.files;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    await client.query('BEGIN');

    // Check user's trial upload limit
    const userResult = await client.query(`
      SELECT trial_uploads_count, trial_uploads_limit FROM users WHERE id = $1
    `, [userId]);

    const user = userResult.rows[0];
    if (user.trial_uploads_count >= user.trial_uploads_limit) {
      await client.query('ROLLBACK');
      return res.status(403).json({ 
        error: 'Trial upload limit reached',
        limit: user.trial_uploads_limit,
        used: user.trial_uploads_count
      });
    }

    const remainingUploads = user.trial_uploads_limit - user.trial_uploads_count;
    const filesToProcess = uploadedFiles.slice(0, remainingUploads);

    if (filesToProcess.length < uploadedFiles.length) {
      console.log(`User ${userId} attempted to upload ${uploadedFiles.length} files but only ${filesToProcess.length} were processed due to trial limits`);
    }

    const uploadResults = [];
    const uploadDir = path.join(__dirname, '../uploads/trials');
    const processedDir = path.join(__dirname, '../uploads/processed');

    // Ensure directories exist
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.mkdir(processedDir, { recursive: true });

    for (const file of filesToProcess) {
      try {
        const fileId = uuidv4();
        const timestamp = Date.now();
        const fileExt = path.extname(file.originalname).toLowerCase() || '.jpg';
        const originalFilename = `${fileId}_${timestamp}_original${fileExt}`;
        const processedFilename = `${fileId}_${timestamp}_processed${fileExt}`;
        
        const originalPath = path.join(uploadDir, originalFilename);
        const processedPath = path.join(processedDir, processedFilename);

        // Save original file
        await fs.writeFile(originalPath, file.buffer);

        // Process image with Sharp (simulate Flare enhancement)
        const imageInfo = await sharp(file.buffer).metadata();
        
        await sharp(file.buffer)
          .resize(2048, 2048, { 
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 90 })
          .modulate({
            brightness: 1.1,
            saturation: 1.15,
            hue: 0
          })
          .sharpen({ sigma: 1.0, flat: 1.0, jagged: 2.0 })
          .toFile(processedPath);

        // Save to database
        const trialResult = await client.query(`
          INSERT INTO photo_trials 
          (id, user_id, original_filename, original_path, processed_path, file_size, mime_type, processing_status, processed_at, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9)
          RETURNING id, uploaded_at
        `, [
          fileId,
          userId,
          file.originalname,
          originalPath,
          processedPath,
          file.size,
          file.mimetype,
          'completed',
          JSON.stringify({
            originalWidth: imageInfo.width,
            originalHeight: imageInfo.height,
            originalSize: file.size,
            uploadIp: req.ip,
            userAgent: req.headers['user-agent']
          })
        ]);

        uploadResults.push({
          id: fileId,
          originalName: file.originalname,
          status: 'completed',
          uploadedAt: trialResult.rows[0].uploaded_at,
          originalUrl: `/api/trials/image/${fileId}/original`,
          processedUrl: `/api/trials/image/${fileId}/processed`
        });

      } catch (fileError) {
        console.error('File processing error:', fileError);
        uploadResults.push({
          originalName: file.originalname,
          status: 'failed',
          error: 'Processing failed - please try a different image'
        });
      }
    }

    // Update user's upload count
    const successfulUploads = uploadResults.filter(r => r.status === 'completed').length;
    await client.query(`
      UPDATE users SET trial_uploads_count = trial_uploads_count + $1 WHERE id = $2
    `, [successfulUploads, userId]);

    await client.query('COMMIT');

    res.json({
      message: 'Photos processed successfully',
      results: uploadResults,
      remainingUploads: user.trial_uploads_limit - user.trial_uploads_count - successfulUploads,
      processedCount: successfulUploads,
      totalUploaded: uploadedFiles.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed. Please try again.' });
  } finally {
    client.release();
  }
});

// Get user's trial photos
router.get('/my-trials', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await pool.query(`
      SELECT id, original_filename, processing_status, uploaded_at, processed_at, metadata, file_size
      FROM photo_trials 
      WHERE user_id = $1 
      ORDER BY uploaded_at DESC 
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM photo_trials WHERE user_id = $1
    `, [userId]);

    const trials = result.rows.map(trial => ({
      id: trial.id,
      originalName: trial.original_filename,
      status: trial.processing_status,
      uploadedAt: trial.uploaded_at,
      processedAt: trial.processed_at,
      fileSize: trial.file_size,
      originalUrl: `/api/trials/image/${trial.id}/original`,
      processedUrl: `/api/trials/image/${trial.id}/processed`,
      metadata: trial.metadata
    }));

    const total = parseInt(countResult.rows[0].total);

    res.json({
      trials,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: offset + trials.length < total
      }
    });

  } catch (error) {
    console.error('Get trials error:', error);
    res.status(500).json({ error: 'Failed to fetch trials' });
  }
});

// Serve trial images
router.get('/image/:trialId/:type', authenticateToken, async (req, res) => {
  try {
    const { trialId, type } = req.params;
    const { userId } = req.user;

    // Verify user owns this trial
    const result = await pool.query(`
      SELECT original_path, processed_path, mime_type FROM photo_trials 
      WHERE id = $1 AND user_id = $2
    `, [trialId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trial not found' });
    }

    const trial = result.rows[0];
    const imagePath = type === 'original' ? trial.original_path : trial.processed_path;

    // Check if file exists
    try {
      await fs.access(imagePath);
      
      // Set appropriate headers
      res.setHeader('Content-Type', trial.mime_type || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
      
      res.sendFile(path.resolve(imagePath));
    } catch (fileError) {
      console.error('File not found:', imagePath);
      res.status(404).json({ error: 'Image file not found' });
    }

  } catch (error) {
    console.error('Image serve error:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Submit feedback
router.post('/feedback', optionalAuth, async (req, res) => {
  try {
    const { email, feedbackType, rating, comments, otherFeedback } = req.body;
    const userId = req.user?.userId || null;

    // Validation
    if (!email || !feedbackType) {
      return res.status(400).json({ error: 'Email and feedback type are required' });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const feedbackId = uuidv4();
    await pool.query(`
      INSERT INTO feedback_responses 
      (id, user_id, email, feedback_type, rating, comments, other_feedback, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      feedbackId,
      userId,
      email.toLowerCase(),
      feedbackType,
      rating || null,
      comments || null,
      otherFeedback || null,
      req.ip
    ]);

    res.status(201).json({
      message: 'Feedback submitted successfully',
      id: feedbackId
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get user profile/stats
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    const userResult = await pool.query(`
      SELECT email, name, trial_uploads_count, trial_uploads_limit, created_at, last_login
      FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get trial stats
    const trialStats = await pool.query(`
      SELECT 
        COUNT(*) as total_trials,
        COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as successful_trials,
        COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed_trials,
        SUM(file_size) as total_file_size
      FROM photo_trials WHERE user_id = $1
    `, [userId]);

    res.json({
      user: {
        email: user.email,
        name: user.name,
        trialUploadsCount: user.trial_uploads_count,
        trialUploadsLimit: user.trial_uploads_limit,
        joinedAt: user.created_at,
        lastLogin: user.last_login
      },
      stats: {
        ...trialStats.rows[0],
        total_file_size: parseInt(trialStats.rows[0].total_file_size || 0)
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Admin endpoints (add authentication middleware for admin users)
router.get('/admin/stats', async (req, res) => {
  try {
    // Add admin authentication here
    
    const userStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as users_today,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as users_this_week
      FROM users
    `);

    const trialStats = await pool.query(`
      SELECT 
        COUNT(*) as total_trials,
        COUNT(CASE WHEN uploaded_at > NOW() - INTERVAL '24 hours' THEN 1 END) as trials_today,
        SUM(file_size) as total_storage_used
      FROM photo_trials
    `);

    res.json({
      users: userStats.rows[0],
      trials: trialStats.rows[0]
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB per file.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 5 files per upload.' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field name.' });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({ error: error.message });
  }

  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Cleanup function for old files (run periodically)
const cleanupOldFiles = async () => {
  try {
    // Delete trials older than 30 days
    const oldTrials = await pool.query(`
      SELECT original_path, processed_path FROM photo_trials 
      WHERE uploaded_at < NOW() - INTERVAL '30 days'
    `);

    for (const trial of oldTrials.rows) {
      try {
        if (trial.original_path) await fs.unlink(trial.original_path);
        if (trial.processed_path) await fs.unlink(trial.processed_path);
      } catch (fileError) {
        console.log('File already deleted or not found:', fileError.message);
      }
    }

    // Delete database records
    const deleteResult = await pool.query(`
      DELETE FROM photo_trials WHERE uploaded_at < NOW() - INTERVAL '30 days'
    `);

    console.log(`Cleaned up ${deleteResult.rowCount} old trial records`);

  } catch (error) {
    console.error('Cleanup error:', error);
  }
};

// Run cleanup every 24 hours
setInterval(cleanupOldFiles, 24 * 60 * 60 * 1000);

module.exports = router;