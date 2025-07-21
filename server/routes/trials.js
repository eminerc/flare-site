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
const yauzl = require('yauzl');
const yazl = require('yazl');

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Rate limiting
const uploadLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many upload attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure multer for ZIP file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for ZIP files
    files: 1 // Only one ZIP file at a time
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only ZIP files are allowed.'), false);
    }
  }
});

// JWT middleware
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

// Database initialization
const initializeDatabase = async () => {
  try {
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS zip_trials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        original_filename VARCHAR(255),
        original_path VARCHAR(500),
        processed_path VARCHAR(500),
        download_path VARCHAR(500),
        file_size INTEGER,
        images_count INTEGER DEFAULT 0,
        processing_status VARCHAR(50) DEFAULT 'pending',
        processing_error TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        download_expires_at TIMESTAMP,
        metadata JSONB
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_zip_trials_user_id ON zip_trials(user_id);
      CREATE INDEX IF NOT EXISTS idx_zip_trials_status ON zip_trials(processing_status);
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

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    await client.query('BEGIN');

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'User already exists' });
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const userResult = await client.query(`
      INSERT INTO users (email, password_hash, name, last_login) 
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
      RETURNING id, email, name, trial_uploads_count, trial_uploads_limit, created_at
    `, [email.toLowerCase(), passwordHash, name || null]);

    const user = userResult.rows[0];
    await client.query('COMMIT');

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

    const userResult = await pool.query(`
      SELECT id, email, password_hash, name, trial_uploads_count, trial_uploads_limit, created_at
      FROM users WHERE email = $1
    `, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

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

// Get user profile
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
    res.json({
      user: {
        email: user.email,
        name: user.name,
        trialUploadsCount: user.trial_uploads_count,
        trialUploadsLimit: user.trial_uploads_limit,
        joinedAt: user.created_at,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ZIP file upload and processing
router.post('/upload-zip', uploadLimit, authenticateToken, upload.single('zipFile'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { userId } = req.user;
    const zipFile = req.file;

    if (!zipFile) {
      return res.status(400).json({ error: 'No ZIP file uploaded' });
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

    const trialId = uuidv4();
    const timestamp = Date.now();
    const uploadDir = path.join(__dirname, '../uploads/trials');
    const processedDir = path.join(__dirname, '../uploads/processed');
    const tempDir = path.join(__dirname, '../uploads/temp', trialId);

    // Ensure directories exist
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.mkdir(processedDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });

    const originalZipPath = path.join(uploadDir, `${trialId}_${timestamp}_original.zip`);
    const processedZipPath = path.join(processedDir, `${trialId}_${timestamp}_processed.zip`);

    // Save original ZIP
    await fs.writeFile(originalZipPath, zipFile.buffer);

    // Extract and process images
    const processedImages = await processZipFile(zipFile.buffer, tempDir);
    
    if (processedImages.length === 0) {
      await client.query('ROLLBACK');
      // Clean up temp directory
      await fs.rmdir(tempDir, { recursive: true }).catch(console.error);
      return res.status(400).json({ error: 'No valid images found in ZIP file' });
    }

    // Create processed ZIP
    await createProcessedZip(processedImages, processedZipPath);

    // Set download expiration (7 days from now)
    const downloadExpiresAt = new Date();
    downloadExpiresAt.setDate(downloadExpiresAt.getDate() + 7);

    // Save to database
    await client.query(`
      INSERT INTO zip_trials 
      (id, user_id, original_filename, original_path, processed_path, download_path, file_size, images_count, processing_status, processed_at, download_expires_at, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, $11)
    `, [
      trialId,
      userId,
      zipFile.originalname,
      originalZipPath,
      processedZipPath,
      `/api/trials/download/${trialId}`,
      zipFile.size,
      processedImages.length,
      'completed',
      downloadExpiresAt,
      JSON.stringify({
        originalSize: zipFile.size,
        processedImages: processedImages.length,
        uploadIp: req.ip,
        userAgent: req.headers['user-agent']
      })
    ]);

    // Update user's upload count
    await client.query(`
      UPDATE users SET trial_uploads_count = trial_uploads_count + 1 WHERE id = $1
    `, [userId]);

    await client.query('COMMIT');

    // Clean up temp directory
    await fs.rmdir(tempDir, { recursive: true }).catch(console.error);

    res.json({
      message: 'ZIP file processed successfully',
      status: 'completed',
      trialId: trialId,
      imagesProcessed: processedImages.length,
      downloadUrl: `/api/trials/download/${trialId}`,
      expiresAt: downloadExpiresAt,
      remainingUploads: user.trial_uploads_limit - user.trial_uploads_count - 1
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ZIP upload error:', error);
    res.status(500).json({ error: 'ZIP processing failed. Please try again.' });
  } finally {
    client.release();
  }
});

// Download processed ZIP
router.get('/download/:trialId', authenticateToken, async (req, res) => {
  try {
    const { trialId } = req.params;
    const { userId } = req.user;

    const result = await pool.query(`
      SELECT processed_path, original_filename, download_expires_at FROM zip_trials 
      WHERE id = $1 AND user_id = $2 AND processing_status = 'completed'
    `, [trialId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Download not found or expired' });
    }

    const trial = result.rows[0];
    
    // Check if download has expired
    if (new Date() > new Date(trial.download_expires_at)) {
      return res.status(410).json({ error: 'Download link has expired' });
    }

    // Check if file exists
    try {
      await fs.access(trial.processed_path);
      
      const filename = `enhanced_${trial.original_filename}`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      res.sendFile(path.resolve(trial.processed_path));
    } catch (fileError) {
      console.error('File not found:', trial.processed_path);
      res.status(404).json({ error: 'Download file not found' });
    }

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Helper function to process ZIP file
async function processZipFile(zipBuffer, tempDir) {
  return new Promise((resolve, reject) => {
    const processedImages = [];
    
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        return reject(err);
      }

      let entriesProcessed = 0;
      let totalEntries = 0;

      // Count total entries first
      const entries = [];
      
      zipfile.on('entry', (entry) => {
        entries.push(entry);
      });

      zipfile.on('end', () => {
        totalEntries = entries.length;
        if (totalEntries === 0) {
          return resolve(processedImages);
        }
        
        // Process entries
        processEntries();
      });

      const processEntries = async () => {
        for (const entry of entries) {
          if (/\/$/.test(entry.fileName)) {
            // Directory entry
            entriesProcessed++;
            continue;
          }

          // Check if it's an image file
          const isImage = /\.(jpg|jpeg|png|webp)$/i.test(entry.fileName);
          if (!isImage) {
            entriesProcessed++;
            continue;
          }

          try {
            await processImageEntry(entry, zipfile, tempDir, processedImages);
          } catch (error) {
            console.error('Error processing image entry:', error);
          }
          
          entriesProcessed++;
          
          if (entriesProcessed === totalEntries) {
            resolve(processedImages);
          }
        }
      };

      zipfile.readEntry();
    });
  });
}

// Helper to process individual image entry
function processImageEntry(entry, zipfile, tempDir, processedImages) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, async (err, readStream) => {
      if (err) {
        return reject(err);
      }

      try {
        const chunks = [];
        readStream.on('data', chunk => chunks.push(chunk));
        readStream.on('end', async () => {
          try {
            const imageBuffer = Buffer.concat(chunks);
            const processedBuffer = await enhanceImage(imageBuffer);
            
            const filename = path.basename(entry.fileName);
            const processedPath = path.join(tempDir, `enhanced_${filename}`);
            
            await fs.writeFile(processedPath, processedBuffer);
            processedImages.push({
              originalName: filename,
              processedPath: processedPath,
              buffer: processedBuffer
            });
            
            resolve();
          } catch (processError) {
            console.error('Error processing image:', processError);
            resolve(); // Continue processing other images
          }
        });

        readStream.on('error', (streamError) => {
          console.error('Stream error:', streamError);
          resolve();
        });
      } catch (error) {
        console.error('Error handling stream:', error);
        resolve();
      }
    });
  });
}

// Helper function to enhance image with Sharp
async function enhanceImage(imageBuffer) {
  return await sharp(imageBuffer)
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
    .toBuffer();
}

// Helper function to create processed ZIP
async function createProcessedZip(processedImages, outputPath) {
  return new Promise((resolve, reject) => {
    const zipFile = new yazl.ZipFile();
    
    processedImages.forEach(image => {
      zipFile.addBuffer(image.buffer, image.originalName);
    });
    
    zipFile.outputStream.pipe(require('fs').createWriteStream(outputPath))
      .on('close', resolve)
      .on('error', reject);
    
    zipFile.end();
  });
}

// Health check
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

module.exports = router;