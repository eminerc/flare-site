const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Import routes
const trialsRoutes = require('./routes/trials');
const feedbackRoutes = require('./routes/feedback');

// Production-ready CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      // Development origins
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://127.0.0.1:3000',
      // Production origins for my-flare.com
      'https://my-flare.com',
      'https://www.my-flare.com',
      'http://my-flare.com',
      'http://www.my-flare.com',
      // Custom environment variable for flexibility
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      // In production, be more strict; in development, be more lenient
      if (process.env.NODE_ENV === 'production') {
        callback(new Error('Not allowed by CORS'));
      } else {
        console.log('Development mode: allowing origin anyway');
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Content-Length', 'Content-Range'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Preflight handler for complex requests
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (corsOptions.origin(origin, (err, allowed) => {
    if (allowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    }
    res.sendStatus(200);
  }));
});

// Security middleware - Enhanced for production
app.use(helmet({
  crossOriginResourcePolicy: { 
    policy: "cross-origin"
  },
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://my-flare.com", "https://www.my-flare.com"]
    }
  } : false
}));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n📨 [${timestamp}] ${req.method} ${req.originalUrl}`);
    console.log(`🌍 Origin: ${req.headers.origin || 'none'}`);
    console.log(`🔑 Auth: ${req.headers.authorization ? 'Bearer token present' : 'No auth header'}`);
    console.log(`📋 Content-Type: ${req.headers['content-type'] || 'none'}`);
  }
  next();
});

// Other middleware
app.use(compression());

// Morgan logging - Enhanced for production
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for accurate IP addresses (important for production)
app.set('trust proxy', 1);

// Create upload directories if they don't exist
const uploadDirs = [
  './uploads',
  './uploads/trials',
  './uploads/processed',
  './uploads/temp'
];

uploadDirs.forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  } catch (error) {
    console.error(`❌ Failed to create directory ${dir}:`, error);
  }
});

// Serve static files from uploads directory with CORS
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Debug middleware (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use('*', (req, res, next) => {
    console.log(`🔍 Route match attempt: ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('💗 Health check requested');
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 'auto-detected',
    cors: 'configured-for-production',
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    domain: process.env.NODE_ENV === 'production' ? 'my-flare.com' : 'localhost'
  });
});

// Basic API test endpoint
app.get('/api/test', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧪 API test endpoint hit');
  }
  res.json({
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    cors: 'working',
    environment: process.env.NODE_ENV || 'development',
    domain: process.env.NODE_ENV === 'production' ? 'my-flare.com' : 'localhost',
    headers: {
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']?.substring(0, 50)
    }
  });
});

// Mount API routes
console.log('🔗 Mounting /api/trials routes...');
app.use('/api/trials', trialsRoutes);

console.log('🔗 Mounting /api/feedback routes...');
app.use('/api/feedback', feedbackRoutes);

// Test endpoints (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/trials-test', (req, res) => {
    console.log('🧪 Trials test endpoint hit directly');
    res.json({
      message: 'Trials API route is accessible!',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      cors: 'working'
    });
  });

  app.get('/api/feedback-test', (req, res) => {
    console.log('🧪 Feedback test endpoint hit directly');
    res.json({
      message: 'Feedback API route is accessible!',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      cors: 'working'
    });
  });
}

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // Handle React routing - send all non-API requests to React
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error('\n🚨 ERROR HANDLER TRIGGERED:');
  console.error('🚨 Error message:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error('🚨 Error stack:', err.stack);
  }
  console.error('🚨 Request details:', {
    method: req.method,
    url: req.originalUrl,
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']?.substring(0, 100)
  });
  
  // Ensure CORS headers are set even for errors
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle specific error types
  if (err.message && err.message.includes('CORS')) {
    console.error('🚨 CORS Error detected');
    return res.status(403).json({ 
      error: 'CORS policy violation',
      origin: req.headers.origin,
      message: 'Cross-origin request blocked'
    });
  }
  
  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({ error: 'Too many files' });
  }
  
  // Handle JSON parsing errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  // Generic error response
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { 
      stack: err.stack,
      details: {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers
      }
    })
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`❌ 404 - API endpoint not found: ${req.method} ${req.originalUrl}`);
  }
  
  // Ensure CORS headers for 404s
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  const availableEndpoints = [
    'GET /health',
    'GET /api/test',
    'GET /api/trials/health',
    'POST /api/trials/register',
    'POST /api/trials/login',
    'GET /api/trials/profile',
    'POST /api/trials/upload-zip',
    'GET /api/trials/download/:trialId',
    'POST /api/feedback/submit',
    'GET /api/feedback/analytics',
    'GET /api/feedback/entries',
    'GET /api/feedback/health'
  ];

  // Add test endpoints only in development
  if (process.env.NODE_ENV !== 'production') {
    availableEndpoints.push('GET /api/trials-test', 'GET /api/feedback-test');
  }
  
  res.status(404).json({ 
    error: 'API endpoint not found',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    availableEndpoints
  });
});

// Catch-all 404 handler
app.use('*', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  }
  
  // Ensure CORS headers
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  res.status(404).json({ 
    error: 'Route not found', 
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Server startup with port conflict handling
const findAvailablePort = (startPort = 5000) => {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
};

const startServer = async () => {
  try {
    const preferredPort = parseInt(process.env.PORT) || 5000;
    const availablePort = await findAvailablePort(preferredPort);
    
    if (availablePort !== preferredPort && process.env.NODE_ENV !== 'production') {
      console.log(`⚠️  Port ${preferredPort} is in use, using port ${availablePort} instead`);
    }
    
    const server = app.listen(availablePort, () => {
      if (process.env.NODE_ENV === 'production') {
        console.log('🚀 PRODUCTION SERVER STARTED');
        console.log('============================');
        console.log(`🌐 Domain: https://my-flare.com`);
        console.log(`📝 Environment: ${process.env.NODE_ENV}`);
        console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
        console.log(`🔧 CORS: Configured for my-flare.com`);
        console.log('============================');
      } else {
        console.log('\n🚀 DEVELOPMENT SERVER WITH PRODUCTION CONFIG!');
        console.log('=============================================');
        console.log(`🌐 Server running on: http://localhost:${availablePort}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
        console.log(`🔧 CORS: Configured for my-flare.com + localhost`);
        console.log('\n🧪 Test these endpoints:');
        console.log(`   Health: http://localhost:${availablePort}/health`);
        console.log(`   API Test: http://localhost:${availablePort}/api/test`);
        console.log(`   Feedback Test: http://localhost:${availablePort}/api/feedback-test`);
        console.log(`   Submit Feedback: POST http://localhost:${availablePort}/api/feedback/submit`);
        console.log(`   Feedback Analytics: http://localhost:${availablePort}/api/feedback/analytics`);
        console.log('=============================================\n');
      }
    });
    
    // Graceful shutdown handlers
    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
      
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${availablePort} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
      }
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app;