const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('.'));
app.use('/assets', express.static('assets'));
app.use('/pages', express.static('pages'));
app.use('/components', express.static('components'));

// Configure multer for file uploads (for demo functionality)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'backend/uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ storage: storage });

// Routes
// Serve main pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'demo.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'contact.html'));
});

app.get('/showcase', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'showcase.html'));
});

// API Routes (prepared for future implementation)

// Contact form submission
app.post('/api/contact', (req, res) => {
  console.log('Contact form submission:', req.body);
  // TODO: Implement contact form processing
  res.json({ 
    success: true, 
    message: 'Contact form submitted successfully' 
  });
});

// Partnership form submission (ISP replacement)
app.post('/api/partnership', (req, res) => {
  console.log('Partnership form submission:', req.body);
  // TODO: Implement partnership form processing
  res.json({ 
    success: true, 
    message: 'Partnership application submitted successfully' 
  });
});

// Demo image upload and processing
app.post('/api/demo/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      message: 'No image file uploaded' 
    });
  }
  
  console.log('Demo image uploaded:', req.file.filename);
  // TODO: Implement image processing with diffusion models
  res.json({ 
    success: true, 
    message: 'Image uploaded successfully',
    filename: req.file.filename,
    originalName: req.file.originalname
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Handle 404s
app.use('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Flare website server running on http://localhost:${PORT}`);
  console.log(`📱 Demo API ready at http://localhost:${PORT}/api/demo/upload`);
  console.log(`📧 Contact API ready at http://localhost:${PORT}/api/contact`);
  console.log(`🤝 Partnership API ready at http://localhost:${PORT}/api/partnership`);
  console.log(`\n🎯 Pages available:`);
  console.log(`   Home: http://localhost:${PORT}/`);
  console.log(`   Demo: http://localhost:${PORT}/demo`);
  console.log(`   Contact: http://localhost:${PORT}/contact`);
  console.log(`   Showcase: http://localhost:${PORT}/showcase`);
});

module.exports = app;