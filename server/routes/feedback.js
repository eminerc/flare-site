const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Database initialization for feedback table
const initializeFeedbackDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_type TEXT,
        what_matters TEXT,
        which_better TEXT,
        use_over_phone TEXT,
        current_behavior TEXT,
        thoughts TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET,
        user_agent TEXT,
        session_id TEXT
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_submitted_at ON feedback(submitted_at);
      CREATE INDEX IF NOT EXISTS idx_feedback_user_type ON feedback(user_type);
    `);

    console.log('Feedback database table initialized successfully');
  } catch (error) {
    console.error('Feedback database initialization error:', error);
  }
};

// Initialize feedback database on startup
initializeFeedbackDatabase();

// Submit feedback endpoint - NO RATE LIMITING! 🚀
router.post('/submit', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      userType, 
      whatMatters, 
      whichBetter, 
      useOverPhone, 
      currentBehavior, 
      thoughts 
    } = req.body;

    // Validation
    if (!userType) {
      return res.status(400).json({ 
        error: 'User type is required',
        field: 'userType' 
      });
    }

    // Optional: Validate userType is one of the expected values
    const validUserTypes = [
      'Regular person who just wants better photos',
      'Content creator or social media person',
      'Photographer / photo-adjacent pro',
      'I work on or manage a product/business',
      "I'm in tech or just curious"
    ];

    if (!validUserTypes.includes(userType)) {
      return res.status(400).json({ 
        error: 'Invalid user type',
        field: 'userType' 
      });
    }

    await client.query('BEGIN');

    // Insert feedback into database
    const result = await client.query(`
      INSERT INTO feedback (
        user_type, 
        what_matters, 
        which_better, 
        use_over_phone, 
        current_behavior, 
        thoughts,
        ip_address,
        user_agent,
        session_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING id, submitted_at
    `, [
      userType,
      whatMatters || null,
      whichBetter || null,
      useOverPhone || null,
      currentBehavior || null,
      thoughts || null,
      req.ip || null,
      req.headers['user-agent'] || null,
      req.sessionID || null
    ]);

    await client.query('COMMIT');

    const feedback = result.rows[0];

    console.log(`📝 New feedback submitted: ${feedback.id} from ${req.ip}`);

    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedbackId: feedback.id,
      submittedAt: feedback.submitted_at
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Feedback submission error:', error);
    res.status(500).json({ 
      error: 'Failed to submit feedback. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Get feedback analytics (optional admin endpoint)
router.get('/analytics', async (req, res) => {
  try {
    // Get total count
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM feedback');
    
    // Get user type breakdown
    const userTypeResult = await pool.query(`
      SELECT user_type, COUNT(*) as count 
      FROM feedback 
      WHERE user_type IS NOT NULL 
      GROUP BY user_type 
      ORDER BY count DESC
    `);

    // Get what matters breakdown
    const whatMattersResult = await pool.query(`
      SELECT what_matters, COUNT(*) as count 
      FROM feedback 
      WHERE what_matters IS NOT NULL 
      GROUP BY what_matters 
      ORDER BY count DESC
    `);

    // Get use over phone breakdown
    const useOverPhoneResult = await pool.query(`
      SELECT use_over_phone, COUNT(*) as count 
      FROM feedback 
      WHERE use_over_phone IS NOT NULL 
      GROUP BY use_over_phone 
      ORDER BY count DESC
    `);

    // Get recent submissions (last 24 hours)
    const recentResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM feedback 
      WHERE submitted_at > NOW() - INTERVAL '24 hours'
    `);

    res.json({
      total: parseInt(totalResult.rows[0].total),
      recent24h: parseInt(recentResult.rows[0].count),
      userTypes: userTypeResult.rows,
      whatMatters: whatMattersResult.rows,
      useOverPhone: useOverPhoneResult.rows,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get all feedback entries (optional admin endpoint with pagination)
router.get('/entries', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 per page
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT 
        id,
        user_type,
        what_matters,
        which_better,
        use_over_phone,
        current_behavior,
        thoughts,
        submitted_at
      FROM feedback 
      ORDER BY submitted_at DESC 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await pool.query('SELECT COUNT(*) as total FROM feedback');
    const total = parseInt(countResult.rows[0].total);

    res.json({
      entries: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Entries fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback entries' });
  }
});

// Health check for feedback system
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1 FROM feedback LIMIT 1');
    res.json({ 
      status: 'healthy', 
      service: 'feedback',
      rateLimiting: 'disabled - bring on the feedback!',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Feedback health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      service: 'feedback',
      error: error.message 
    });
  }
});

module.exports = router;