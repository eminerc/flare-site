import React from "react";
import "./App.css";

function CameraPage() {
  return (
    <div className="camera-page">
      <div className="camera-header">
        <h2>Flare Camera Demo</h2>
        <p>
          Flare isn't just for editing—it's a camera engine built to capture
          sharp, vivid shots even in tough conditions.
        </p>
      </div>

      <div className="camera-demo-section">
        <div className="demo-row">
          <div className="demo-box">
            <h3>Low Light</h3>
            <div className="demo-comparison">
              <img
                src="/demo/lowlight_before.jpg"
                alt="Low light before"
                className="demo-image"
              />
              <img
                src="/demo/lowlight_after.jpg"
                alt="Low light after"
                className="demo-image"
              />
            </div>
          </div>

          <div className="demo-box">
            <h3>Zoom Clarity</h3>
            <div className="demo-comparison">
              <img
                src="/demo/zoom_before.jpg"
                alt="Zoom before"
                className="demo-image"
              />
              <img
                src="/demo/zoom_after.jpg"
                alt="Zoom after"
                className="demo-image"
              />
            </div>
          </div>
        </div>

        <div className="demo-caption">
          <p>
            We built Flare to outperform your stock camera, especially when it
            matters most.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CameraPage;
