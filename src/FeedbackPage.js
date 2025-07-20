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

  const handleSubmit = (e) => {
    e.preventDefault();
    // Basic validation - require first question
    if (formData.userType) {
      alert('Thank you for your feedback!');
      setFormData({
        userType: '',
        whatMatters: '',
        whichBetter: '',
        useOverPhone: '',
        currentBehavior: '',
        thoughts: ''
      });
    } else {
      alert('Please answer at least the first question');
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
                'Flare makes my image mroe beautiful image and puts it in my gallery',
                'Flare gives me multiple improved photo options and post-processing controls'
              ].map((option) => (
                <label key={option} className="radio-option">
                  <input
                    type="radio"
                    name="whichBetter"
                    value={option}
                    checked={formData.whichBetter === option}
                    onChange={handleInputChange}
                  />
                  <span className="radio-text">{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>4. Would you use this over your phone's stock camera/gallery app if it made <strong>every</strong> photo look better automatically?<span className="subtitle">(Worth an app downlaod???)</span></label>
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
                  />
                  <span className="radio-text">{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>5. What do you <strong>currently</strong> do to your photos before sharing/posting?<span className="subtitle">(Hands on v. hands off)</span></label>
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
            />
          </div>
          
          <button onClick={handleSubmit} className="submit-button">
            Send Feedback
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeedbackPage;