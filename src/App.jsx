import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import CourseLinkPage from './pages/CourseLinkPage';

function App() {
  // This effect runs once when the app loads
  useEffect(() => {
    // Check for a saved theme in localStorage and apply it
    const theme = localStorage.getItem('theme');
    if (theme) {
      document.documentElement.classList.add(theme);
    } else {
      // Default to light mode if no theme is saved
      document.documentElement.classList.add('light');
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
        <Route path="/link/:programme/:semester" element={<CourseLinkPage />} />
      </Routes>
    </Router>
  );
}

export default App;