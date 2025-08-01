import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '../services/authService';
import Students from './Students';
import Courses from './Courses';
import Holidays from './Holidays';
import Attendance from './Attendance';
import AttendanceList from './AttendanceList';
import SettingsPage from './SettingsPage';
import Overview from './Overview';
import { Home, Users, BookOpen, Calendar, CheckCircle, Settings, List, LogOut, X, Menu } from 'lucide-react';

// A reusable navigation item component
const NavItem = ({ icon, label, section, activeSection, onClick }) => (
  <button
    onClick={() => onClick(section)}
    className={`w-full flex items-center px-4 py-3 text-left text-sm font-medium rounded-lg transition-all duration-200 ease-in-out ${
      activeSection === section
        ? 'bg-indigo-600 text-white shadow-md'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
    }`}
  >
    {React.cloneElement(icon, { className: "h-5 w-5 mr-3 flex-shrink-0" })}
    <span className="flex-grow">{label}</span>
  </button>
);

// Main Dashboard Component
function Dashboard() {
  const [user, setUser] = useState(null);
  // Initialize activeSection from localStorage, defaulting to null (Overview)
  const [activeSection, setActiveSection] = useState(() => {
      const savedSection = localStorage.getItem('activeSection');
      // We use null for the overview, so we need to handle the string 'null'
      return savedSection && savedSection !== 'null' ? savedSection : null;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // Effect to save the active section to localStorage whenever it changes
  useEffect(() => {
    // Storing null will result in the string "null", which is what we want
    localStorage.setItem('activeSection', activeSection);
  }, [activeSection]);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser || !(currentUser.labels?.includes('admin') || currentUser.prefs?.role === 'admin')) {
          navigate('/');
        } else {
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Error checking auth:', error.message);
        navigate('/');
      }
    };
    checkAuth();
  }, [navigate]);

  // Handle user logout
  const handleLogout = async () => {
    await logout();
    // Clear the saved section on logout
    localStorage.removeItem('activeSection');
    navigate('/');
  };

  // Toggle sidebar for mobile view
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Change the main content section
  const handleSectionChange = (section) => {
    setActiveSection(section);
    if (window.innerWidth < 768) { // Close sidebar on mobile after selection
      setIsSidebarOpen(false);
    }
  };

  // Render the appropriate component based on the active section
  const renderContent = () => {
    switch (activeSection) {
      case 'students': return <Students />;
      case 'attendance': return <Attendance />;
      case 'attendance-overview': return <AttendanceList />;
      case 'courses': return <Courses />;
      case 'holidays': return <Holidays />;
      case 'settings': return <SettingsPage />;
      default: return <Overview user={user} />;
    }
  };

  // Loading state while checking user session
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-500"></div>
          <p className="text-gray-700 dark:text-gray-300 text-lg font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Main dashboard layout
  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <img src="/nielit.png" alt="Logo" className="w-8 h-8" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/32x32/indigo/white?text=A'; }}/>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">AMS</h1>
          </div>
          <button className="md:hidden p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" onClick={toggleSidebar}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-grow p-4 space-y-2">
          <NavItem icon={<Home />} label="Dashboard" section={null} activeSection={activeSection} onClick={handleSectionChange} />
          <NavItem icon={<Users />} label="Students" section="students" activeSection={activeSection} onClick={handleSectionChange} />
          <NavItem icon={<CheckCircle />} label="Attendance Links" section="attendance" activeSection={activeSection} onClick={handleSectionChange} />
          <NavItem icon={<List />} label="Attendance Records" section="attendance-overview" activeSection={activeSection} onClick={handleSectionChange} />
          <NavItem icon={<BookOpen />} label="Courses" section="courses" activeSection={activeSection} onClick={handleSectionChange} />
          <NavItem icon={<Calendar />} label="Holidays" section="holidays" activeSection={activeSection} onClick={handleSectionChange} />
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <NavItem icon={<Settings />} label="Settings" section="settings" activeSection={activeSection} onClick={handleSectionChange} />
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-left text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors duration-200"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64">
        <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm p-4 flex justify-between items-center md:hidden border-b border-gray-200 dark:border-gray-700">
          <button onClick={toggleSidebar}>
            <Menu className="h-6 w-6" />
          </button>
          <h2 className="text-lg font-bold">Admin Dashboard</h2>
          <div className="w-6"></div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={toggleSidebar}></div>
      )}
    </div>
  );
}

export default Dashboard;
