import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import UploadScan from './pages/UploadScan';
import UploadAudio from './pages/UploadAudio';
import Results from './pages/Results';
import History from './pages/History';
import About from './pages/About';
import Login from './pages/Login';
import PatientDashboard from './pages/PatientDashboard';
import DoctorPanel from './pages/DoctorPanel';
import Telemedicine from './pages/Telemedicine';
import Breathing from './pages/Breathing';
import SmokingTracker from './pages/SmokingTracker';
import WeatherAQI from './pages/WeatherAQI';
import Medications from './pages/Medications';
import { getCurrentUser } from './api';
import { ToastProvider } from './components/Toast';
import brandLogo from './assets/hero_logo.png';

// --- Error Boundary Component ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { 
    console.error("AccuVital System Fault:", error, errorInfo);
    // Attempt local storage purge on failure
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#030712] text-white p-8 text-center">
          <div className="max-w-md">
            <h1 className="text-3xl font-black mb-4">Neural Link Interrupted</h1>
            <p className="text-slate-400 mb-8">A configuration conflict in your browser cache has caused a temporary fault. We have cleared your local state.</p>
            <button onClick={() => window.location.href = '/'} className="btn-primary">Force System Reboot</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const existingUser = getCurrentUser();
      if (existingUser && existingUser.username) {
        setUser(existingUser);
      } else {
        localStorage.removeItem('user'); // Corrupted
      }
    } catch (e) {
      setUser(null);
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  // Protected Route wrapper
  const ProtectedRoute = ({ children, role }) => {
    const currentUser = user || getCurrentUser();
    if (!currentUser) return <Navigate to="/login" replace />;
    
    if (role && currentUser.role !== role) {
      return <Navigate to={currentUser.role === 'patient' ? '/patient-dashboard' : '/doctor-panel'} replace />;
    }
    return children;
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <div className="min-h-screen flex flex-col font-sans relative">
            {/* Global Branding Watermark - Vignan Logo */}
            <div 
              className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden opacity-35 mix-blend-overlay"
            >
              <img 
                src={brandLogo} 
                alt="Vignan Logo" 
                className="w-[90vh] h-[90vh] object-contain animate-pulse-slow filter grayscale contrast-125"
              />
            </div>

            <Navbar user={user} onLogout={handleLogout} />
            <main className="flex-grow container mx-auto px-4 py-8 pt-24 relative z-10">
              <Routes>
                <Route path="/login" element={!user ? <Login onLogin={setUser} /> : <Navigate to={user.role === 'patient' ? '/patient-dashboard' : '/doctor-panel'} />} />
                
                <Route path="/patient-dashboard" element={<ProtectedRoute role="patient"><PatientDashboard user={user} /></ProtectedRoute>} />
                <Route path="/doctor-panel" element={<ProtectedRoute role="doctor"><DoctorPanel /></ProtectedRoute>} />
                <Route path="/telemedicine" element={<ProtectedRoute><Telemedicine /></ProtectedRoute>} />
                
                <Route path="/breathing" element={<ProtectedRoute><Breathing /></ProtectedRoute>} />
                <Route path="/quitsmoking" element={<ProtectedRoute><SmokingTracker /></ProtectedRoute>} />
                <Route path="/weather" element={<ProtectedRoute><WeatherAQI /></ProtectedRoute>} />
                <Route path="/medications" element={<ProtectedRoute><Medications /></ProtectedRoute>} />

                <Route path="/upload" element={<ProtectedRoute><UploadScan user={user} /></ProtectedRoute>} />
                <Route path="/upload-audio" element={<ProtectedRoute><UploadAudio user={user} /></ProtectedRoute>} />
                <Route path="/results/:id" element={<ProtectedRoute><Results /></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute><History user={user} /></ProtectedRoute>} />
                
                <Route path="/about" element={<About />} />
                <Route path="/" element={<Home user={user} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
