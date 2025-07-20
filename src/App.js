import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HomePage } from "./HomePage";
import TrialsPage from './TrialsPage';
import DemoGallery from "./DemoGallery";
import FeedbackPage from "./FeedbackPage";
import CameraDemo from "./CameraDemo";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/gallery" element={<DemoGallery />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/camera" element={<CameraDemo />} />
        <Route path="/trials" element={<TrialsPage />} />
      </Routes>
    </Router>
  );
}

export default App;
