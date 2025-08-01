import React, { useState, useEffect, useMemo } from 'react';
import { fetchCourses, updateCourse } from '../services/courseService';
import { getStudents } from '../services/studentService';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, QrCode, XCircle, BookOpen, Search } from 'lucide-react';

// Reusable component for the course link cards
const CourseLinkCard = ({ course, onToggleStatus, onTakeAttendance }) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
    >
        <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{course.Programme}</h2>
            <div className="flex items-center gap-2 mt-2">
                <span className={`w-3 h-3 rounded-full ${course.LinkStatus === 'Active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Link Status: <span className={course.LinkStatus === 'Active' ? 'text-green-500' : 'text-red-500'}>{course.LinkStatus}</span>
                </p>
            </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-6">
            <button
                onClick={() => onToggleStatus(course)}
                className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-white font-semibold transition-colors ${
                    course.LinkStatus === 'Active' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                }`}
            >
                <Power className="w-5 h-5" />
                {course.LinkStatus === 'Active' ? 'Deactivate' : 'Activate'}
            </button>
            <button
                onClick={() => onTakeAttendance(course)}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
            >
                <QrCode className="w-5 h-5" />
                Generate QR
            </button>
        </div>
    </motion.div>
);


function Attendance() {
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [courseResponse, studentResponse] = await Promise.all([
          fetchCourses(),
          getStudents(),
        ]);
        setCourses(courseResponse?.filter(c => c.Status === 'Active') || []);
        setStudents(studentResponse?.documents || []);
      } catch (err) {
        setError('Failed to fetch data: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const availableSemesters = useMemo(() => {
    if (!selectedCourse) return [];
    const studentsInCourse = students.filter(s => s.Course?.$id === selectedCourse.$id && s.Status === 'Active');
    const semesters = new Set(studentsInCourse.map(s => s.Semester).filter(Boolean));
    return Array.from(semesters).sort((a, b) => a - b);
  }, [selectedCourse, students]);

  const filteredCourses = useMemo(() => {
    if (!searchTerm) {
      return courses;
    }
    return courses.filter(course =>
      course.Programme.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [courses, searchTerm]);

  const handleToggleLinkStatus = async (course) => {
    const newStatus = course.LinkStatus === 'Active' ? 'Inactive' : 'Active';
    const toastId = toast.loading(`${newStatus === 'Active' ? 'Activating' : 'Deactivating'} link...`);
    try {
      const updatedData = { LinkStatus: newStatus };
      const fullCourseData = { ...course, ...updatedData };
      const updated = await updateCourse(course.$id, fullCourseData);
      setCourses(prev => prev.map(c => (c.$id === course.$id ? { ...c, ...updated } : c)));
      toast.success(`Link ${newStatus.toLowerCase()}d successfully.`, { id: toastId });
    } catch (err) {
      toast.error('Failed to update link status: ' + err.message, { id: toastId });
    }
  };

  const handleOpenSemesterModal = (course) => {
    setSelectedCourse(course);
    setSelectedSemester('');
    setIsModalOpen(true);
  };

  const handleConfirmSemester = () => {
    if (!selectedSemester) {
      toast.error("Please select a semester.");
      return;
    }
    navigate(`/link/${encodeURIComponent(selectedCourse.Programme)}/${selectedSemester}`);
    setIsModalOpen(false);
  };

  if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500"></div></div>;
  if (error) return <div className="p-8 text-center text-red-600 bg-red-100 dark:bg-red-900/30 rounded-lg">{error}</div>;

  return (
    <>
      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-gray-700 dark:text-white' }} />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Attendance Links</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Activate and manage QR code links for course attendance.</p>
            </div>
            <div className="relative w-full md:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search courses..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-64 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredCourses.length > 0 ? filteredCourses.map(course => (
                <CourseLinkCard 
                    key={course.$id} 
                    course={course}
                    onToggleStatus={handleToggleLinkStatus}
                    onTakeAttendance={handleOpenSemesterModal}
                />
              )) : (
                <div className="col-span-full text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
                    <BookOpen className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                    <p className="mt-4 text-gray-500 dark:text-gray-400">{searchTerm ? 'No courses match your search.' : 'No courses available.'}</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">{searchTerm ? 'Try a different search term.' : "Add a course in the 'Courses' section to begin."}</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
              <div className="p-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Select Semester</h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><XCircle className="w-6 h-6 text-gray-500" /></button>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mt-1">For course: <span className="font-semibold">{selectedCourse?.Programme}</span></p>
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                  <select
                    value={selectedSemester}
                    onChange={e => setSelectedSemester(e.target.value)}
                    className="w-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a semester</option>
                    {availableSemesters.map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg">Cancel</button>
                <button type="button" onClick={handleConfirmSemester} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">Confirm & Proceed</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Attendance;