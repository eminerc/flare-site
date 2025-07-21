import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';

function TrialsPage() {
  const navigate = useNavigate();
  
  // API Base URL
  const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://my-flare.com' 
    : 'http://localhost:5001';

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', name: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [showMainInterface, setShowMainInterface] = useState(false);
  const [authError, setAuthError] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Check for existing token on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserProfile(token);
    }
  }, []);

  const fetchUserProfile = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/trials/profile`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setShowMainInterface(true);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch profile:', error);
      }
      localStorage.removeItem('token');
    }
  };

  // Handle file selection (ZIP files only)
  const handleFiles = useCallback((files) => {
    const validFiles = Array.from(files).filter(file => {
      const validTypes = ['application/zip', 'application/x-zip-compressed'];
      const maxSize = 50 * 1024 * 1024; // 50MB for ZIP files
      return validTypes.includes(file.type) && file.size <= maxSize;
    });

    if (validFiles.length !== files.length) {
      alert('Only ZIP files under 50MB are allowed.');
    }

    // Only allow one ZIP file at a time
    setSelectedFiles(validFiles.slice(0, 1));
  }, []);

  // Drag and drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  // File input change
  const handleFileInput = (e) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  // Remove selected file
  const removeFile = () => {
    setSelectedFiles([]);
  };

  // Login function
  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      setAuthError('Please fill in all fields');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/trials/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(loginForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(errorData.error || 'Invalid email or password');
      }
      
      const data = await response.json();
      
      localStorage.setItem('token', data.token);
      setUser(data.user);
      setShowLogin(false);
      setShowMainInterface(true);
      setLoginForm({ email: '', password: '' });
      setAuthError('');
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Login error:', error);
      }
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Register function
  const handleRegister = async () => {
    if (!registerForm.email || !registerForm.password) {
      setAuthError('Please fill in all required fields');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/trials/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(registerForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(errorData.error || 'Failed to create account');
      }
      
      const data = await response.json();
      
      localStorage.setItem('token', data.token);
      setUser(data.user);
      setShowLogin(false);
      setShowMainInterface(true);
      setIsRegistering(false);
      setRegisterForm({ email: '', password: '', name: '' });
      setAuthError('');
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Registration error:', error);
      }
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Upload ZIP file
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Please select a ZIP file to upload');
      return;
    }

    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('zipFile', selectedFiles[0]);

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/trials/upload-zip`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const data = await response.json();
      
      setUploadResults([data]);
      setSelectedFiles([]);
      setUploadError('');
      // Update user's remaining uploads
      setUser(prev => ({
        ...prev,
        trialUploadsCount: prev.trialUploadsCount + 1
      }));
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Upload error:', error);
      }
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setUploadResults([]);
    setSelectedFiles([]);
    setShowMainInterface(false);
  };

  const remainingUploads = user ? user.trialUploadsLimit - user.trialUploadsCount : 0;

  return (
    <div className="trials-page">
      {/* Navigation */}
      <div className="nav-buttons">
        <button className="nav-button home-button" onClick={() => navigate("/")}>
          Home
        </button>
        <button className="nav-button camera-button" onClick={() => navigate("/gallery")}>
          Gallery
        </button>
      </div>

      {/* Liquid Glass Overlay - Show when not authenticated */}
      {!showMainInterface && (
        <div className="liquid-glass-overlay" onClick={() => setShowLogin(true)}>
          <div className="glass-content">
            <h1 className="overlay-title">Flare Beta</h1>
            <p className="overlay-subtitle">click to sign in & try</p>
          </div>
        </div>
      )}

      {/* Main Interface - Show after authentication */}
      {showMainInterface && (
        <div className="trials-container">
          {/* User Status */}
          <div className="user-status">
            <span>Welcome, {user.name || user.email}!</span>
            <div className="user-info">
              <span>{remainingUploads} trials remaining</span>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>

          {/* Clean Upload Box */}
          <div className="clean-upload-container">
            
            {/* Upload Error Message */}
            {uploadError && (
              <div className="upload-error">
                {uploadError}
              </div>
            )}
            
            <div className={`upload-box ${dragActive ? 'drag-active' : ''}`}
                 onDragEnter={handleDrag}
                 onDragLeave={handleDrag}
                 onDragOver={handleDrag}
                 onDrop={handleDrop}>
              
              {selectedFiles.length === 0 ? (
                <div className="upload-prompt">
                  <div className="upload-text">upload a zip</div>
                  <input
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    onChange={handleFileInput}
                    className="file-input"
                    id="zip-upload"
                  />
                  <label htmlFor="zip-upload" className="upload-trigger">
                    click or drag & drop
                  </label>
                </div>
              ) : (
                <div className="file-selected">
                  <div className="file-info-main">
                    <span className="file-name-main">{selectedFiles[0].name}</span>
                    <span className="file-size-main">
                      {(selectedFiles[0].size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <div className="file-actions">
                    <button className="remove-btn" onClick={removeFile}>
                      remove
                    </button>
                    <button 
                      className="process-btn"
                      onClick={handleUpload}
                      disabled={uploading || remainingUploads === 0}
                      onFocus={() => setUploadError('')} // Clear error when button is focused
                    >
                      {uploading ? 'processing...' : 'enhance'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Beta Disclaimer */}
            <div className="beta-disclaimer">
              <p>beta version - processing may take several minutes</p>
              <p>your flare gallery will be curated and and displayed</p>
            </div>
          </div>
        </div>
      )}

      {/* Processing Status */}
      {uploading && (
        <div className="processing-status">
          <div className="spinner"></div>
          <p>processing your photos...</p>
          <p>this may take 3-5 minutes depending on file count</p>
        </div>
      )}

      {/* Results */}
      {uploadResults.length > 0 && (
        <div className="results-container">
          {uploadResults.map((result, index) => (
            <div key={index} className="result-box">
              {result.status === 'completed' ? (
                <div className="success-result">
                  <h3>✓ processing complete</h3>
                  <p>your enhanced photos are ready</p>
                  <a href={`${API_BASE_URL}${result.downloadUrl}`} className="download-link">
                    download enhanced zip
                  </a>
                </div>
              ) : (
                <div className="error-result">
                  <h3>✗ processing failed</h3>
                  <p>{result.error}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Login/Register Modal */}
      {showLogin && (
        <div className="modal-overlay" onClick={() => setShowLogin(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowLogin(false)}
            >
              ×
            </button>
            
            {isRegistering ? (
              <div className="auth-form">
                <h2>Sign Up for Beta Access</h2>
                
                {/* Error Message */}
                {authError && (
                  <div className="auth-error">
                    {authError}
                  </div>
                )}
                
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={registerForm.name}
                  onChange={e => {
                    setRegisterForm({...registerForm, name: e.target.value});
                    setAuthError(''); // Clear error when user types
                  }}
                />
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={registerForm.email}
                  onChange={e => {
                    setRegisterForm({...registerForm, email: e.target.value});
                    setAuthError(''); // Clear error when user types
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={registerForm.password}
                  onChange={e => {
                    setRegisterForm({...registerForm, password: e.target.value});
                    setAuthError(''); // Clear error when user types
                  }}
                />
                <button 
                  onClick={handleRegister} 
                  className="auth-submit"
                  disabled={authLoading}
                >
                  {authLoading ? 'Creating Account...' : 'Sign Up'}
                </button>
                <p>
                  Already have an account?{' '}
                  <button 
                    type="button"
                    className="auth-switch"
                    onClick={() => {
                      setIsRegistering(false);
                      setAuthError(''); // Clear error when switching
                    }}
                  >
                    Login
                  </button>
                </p>
              </div>
            ) : (
              <div className="auth-form">
                <h2>Login to Beta</h2>
                
                {/* Error Message */}
                {authError && (
                  <div className="auth-error">
                    {authError}
                  </div>
                )}
                
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={loginForm.email}
                  onChange={e => {
                    setLoginForm({...loginForm, email: e.target.value});
                    setAuthError(''); // Clear error when user types
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={loginForm.password}
                  onChange={e => {
                    setLoginForm({...loginForm, password: e.target.value});
                    setAuthError(''); // Clear error when user types
                  }}
                />
                <button 
                  onClick={handleLogin} 
                  className="auth-submit"
                  disabled={authLoading}
                >
                  {authLoading ? 'Logging in...' : 'Login'}
                </button>
                <p>
                  Don't have an account?{' '}
                  <button 
                    type="button"
                    className="auth-switch"
                    onClick={() => {
                      setIsRegistering(true);
                      setAuthError(''); // Clear error when switching
                    }}
                  >
                    Sign Up
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TrialsPage;