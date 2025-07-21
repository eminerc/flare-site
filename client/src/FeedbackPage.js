import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./App.css";

function FeedbackPage() {
  const [formData, setFormData] = useState({
    userType: '',
    whatMatters: '',
    whichBetter: '',
    useOverPhone: '',
    currentBehavior: '',
    thoughts: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  // Get API URL based on environment
  const getApiUrl = () => {
    // In production, use the production domain
    if (process.env.NODE_ENV === 'production') {
      return 'https://my-flare.com';
    }
    // In development, check if we have a custom API URL
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }
    // Default to localhost for development
    return 'http://localhost:5001';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation - require first question
    if (!formData.userType) {
      alert('Please answer at least the first question');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/feedback/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setSubmitStatus('success');
        console.log('✅ Feedback submitted successfully:', data);
        
        // Reset form after successful submission
        setFormData({
          userType: '',
          whatMatters: '',
          whichBetter: '',
          useOverPhone: '',
          currentBehavior: '',
          thoughts: ''
        });

        // Show success message for 3 seconds
        setTimeout(() => {
          setSubmitStatus(null);
        }, 3000);
        
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

    } catch (error) {
      console.error('❌ Feedback submission error:', error);
      setSubmitStatus('error');
      
      // Show error message for 5 seconds
      setTimeout(() => {
        setSubmitStatus(null);
      }, 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="feedback-page">
      <div className="feedback-container">
        <Link to="/" className="back-button">
          ← Back to Home
        </Link>
        
        <h1 className="feedback-title">Tell us what you think</h1>
        
        {/* Status Messages */}
        {submitStatus === 'success' && (
          <div className="status-message success-message">
            ✅ Thank you for your feedback! Your input has been saved successfully.
          </div>
        )}
        
        {submitStatus === 'error' && (
          <div className="status-message error-message">
            ❌ Sorry, there was an error submitting your feedback. Please try again.
          </div>
        )}
        
        <div className="feedback-form">
          
          <div className="form-group">
            <label>1. Who are you, really? <span className="subtitle">(Pick the closest one)</span></label>
            <div className="radio-group">
              {[
                'Regular person who just wants better photos',
                'Content creator or social media person', 
                'Photographer / photo-adjacent pro',
                'I work on or manage a product/business',
                "I'm in tech or just curious"
              ].map((option) => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="userType"
                    value={option}
                    checked={formData.userType === option}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                  <span className="radio-text">{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>2. After editing a photo, what matters more to you?<span className="subtitle">(Postablility v. reality)</span></label>
            <div className="radio-group">
              {[
                'How good it looks',
                'How true it is to the original'
              ].map((option) => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="whatMatters"
                    value={option}
                    checked={formData.whatMatters === option}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                  <span className="radio-text">{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>3. What's better?<span className="subtitle">(Hands on v. hands off)</span></label>
            <div className="radio-group">
              {[
                'Flare makes my image more beautiful and puts it in my gallery',
                'Flare gives me multiple improved photo options and post-processing controls'
              ].map((option) => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="whichBetter"
                    value={option}
                    checked={formData.whichBetter === option}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                  <span className="radio-text">{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>4. Would you use this over your phone's stock camera/gallery app if it made <strong>every</strong> photo look better automatically?<span className="subtitle">(Worth an app download???)</span></label>
            <div className="radio-group">
              {[
                'Yes',
                'Maybe',
                'No'
              ].map((option) => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="useOverPhone"
                    value={option}
                    checked={formData.useOverPhone === option}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                  <span className="radio-text">{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>5. What do you <strong>currently</strong> do to your photos before sharing/posting?<span className="subtitle">(Current behavior)</span></label>
            <div className="radio-group">
              {[
                'Just post a few as-is',
                'Sift through and choose, but don\'t edit',
                'Edit them before I share/post'
              ].map((option) => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="currentBehavior"
                    value={option}
                    checked={formData.currentBehavior === option}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                  <span className="radio-text">{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Thoughts? <span className="subtitle">(Optional — complaints, ideas, jokes, all welcome)</span></label>
            <textarea
              name="thoughts"
              value={formData.thoughts}
              onChange={handleInputChange}
              rows={4}
              placeholder="What's on your mind..."
              disabled={isSubmitting}
            />
          </div>
          
          <button 
            onClick={handleSubmit} 
            className={`submit-button ${isSubmitting ? 'submitting' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Send Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeedbackPage;