import React, { useState, useEffect, useMemo } from 'react';
import { fetchCourses, addCourse, updateCourse, deleteCourse } from '../services/courseService';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { PlusCircle, Upload, Download, Edit, Trash2, XCircle, BookOpen, Search } from 'lucide-react';

// Reusable component for course cards
const CourseCard = ({ course, onEdit, onDelete }) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
    >
        <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">{course.Programme}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{course.Duration} Months</p>
            <div className="flex items-center gap-2 mt-4">
                <span className={`w-3 h-3 rounded-full ${course.Status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Status: {course.Status}</p>
            </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => onEdit(course)} className="p-2 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><Edit className="w-5 h-5" /></button>
            <button onClick={() => onDelete(course.$id)} className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 className="w-5 h-5" /></button>
        </div>
    </motion.div>
);

function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null); // 'add', 'edit', 'import'

  // Form & Data States
  const [currentCourse, setCurrentCourse] = useState(null);
  const [formData, setFormData] = useState({});
  const [importData, setImportData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const courseResponse = await fetchCourses();
        setCourses(courseResponse || []);
      } catch (err) {
        setError('Failed to fetch data: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredCourses = useMemo(() => {
    if (!searchTerm) {
        return courses;
    }
    return courses.filter(course =>
        course.Programme.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [courses, searchTerm]);

  const openModal = (type, course = null) => {
    setModalContent(type);
    setCurrentCourse(course);
    if (type === 'add') {
      setFormData({ Programme: '', Duration: '', Status: 'Active' });
    } else if (type === 'edit' && course) {
      setFormData(course);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
    setImportData([]);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const isEditing = modalContent === 'edit';
    const toastId = toast.loading(isEditing ? 'Updating course...' : 'Adding course...');

    try {
      const dataToSubmit = {
        ...formData,
        Duration: parseInt(formData.Duration),
      };

      if (isEditing) {
        const updated = await updateCourse(currentCourse.$id, dataToSubmit);
        setCourses(prev => prev.map(c => c.$id === updated.$id ? updated : c));
        toast.success('Course updated!', { id: toastId });
      } else {
        const newCourse = await addCourse(dataToSubmit);
        setCourses(prev => [newCourse, ...prev]);
        toast.success('Course added!', { id: toastId });
      }
      closeModal();
    } catch (err) {
      toast.error(err.message || 'An error occurred.', { id: toastId });
    }
  };

  const handleDelete = async (courseId) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      const toastId = toast.loading('Deleting course...');
      try {
        await deleteCourse(courseId);
        setCourses(prev => prev.filter(c => c.$id !== courseId));
        toast.success('Course deleted.', { id: toastId });
      } catch (err) {
        toast.error(err.message, { id: toastId });
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const validatedData = jsonData.map(row => {
            const errors = [];
            const programme = row.Programme?.trim();
            const duration = row.Duration ? parseInt(row.Duration, 10) : NaN;

            if (!programme) errors.push("Programme name is missing.");
            if (isNaN(duration)) errors.push("Duration is invalid or missing.");

            if (programme && !isNaN(duration)) {
                if (courses.some(c => c.Programme.toLowerCase() === programme.toLowerCase() && c.Duration === duration)) {
                    errors.push("This course already exists.");
                }
            }
            return { ...row, Programme: programme, Duration: duration, isValid: errors.length === 0, errors };
        });
        setImportData(validatedData);
        openModal('import');
      } catch (err) {
        toast.error("Failed to read the Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  const handleImportConfirm = async () => {
    const validData = importData.filter(row => row.isValid);
    if (validData.length === 0) {
        toast.error("No valid courses to import.");
        return;
    }
    const toastId = toast.loading(`Importing ${validData.length} courses...`);
    try {
        const creationPromises = validData.map(row => addCourse({
            Programme: row.Programme,
            Duration: row.Duration,
            Status: row.Status || 'Active',
        }));
        const newCourses = await Promise.all(creationPromises);
        setCourses(prev => [...prev, ...newCourses]);
        toast.success(`Successfully imported ${newCourses.length} courses!`, { id: toastId });
        closeModal();
    } catch (err) {
        toast.error(err.message, { id: toastId });
    }
  };
  
  const handleExport = () => {
    const formattedData = courses.map(course => ({
        'Programme': course.Programme,
        'Duration': course.Duration,
        'Status': course.Status,
        'Link Status': course.LinkStatus || 'Inactive',
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Courses");
    worksheet['!cols'] = [{wch:30},{wch:15},{wch:15},{wch:15}];
    saveAs(new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })]), 'Courses_Export.xlsx');
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Course Management</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Add, edit, and manage all courses.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openModal('add')} className="flex items-center bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"><PlusCircle className="w-5 h-5 mr-2" />Add Course</button>
              <label className="flex items-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors shadow-md cursor-pointer"><Upload className="w-5 h-5 mr-2" />Import<input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" /></label>
              <button onClick={handleExport} className="flex items-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors shadow-md"><Download className="w-5 h-5 mr-2" />Export</button>
            </div>
          </div>
          
          <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                  type="text"
                  placeholder="Search courses by name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredCourses.length > 0 ? filteredCourses.map(course => (
                <CourseCard key={course.$id} course={course} onEdit={openModal.bind(null, 'edit')} onDelete={handleDelete} />
              )) : (
                <div className="col-span-full text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
                    <BookOpen className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                    <p className="mt-4 text-gray-500 dark:text-gray-400">{searchTerm ? 'No courses match your search.' : 'No courses found.'}</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">{searchTerm ? 'Try a different search term.' : 'Add a new course to get started.'}</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {modalContent === 'add' && 'Add New Course'}
                  {modalContent === 'edit' && 'Edit Course'}
                  {modalContent === 'import' && 'Import Courses'}
                </h3>
                <button onClick={closeModal} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><XCircle className="w-6 h-6 text-gray-500" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                {(modalContent === 'add' || modalContent === 'edit') && (
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div><label className="block text-sm font-medium">Programme Name</label><input type="text" name="Programme" value={formData.Programme || ''} onChange={e => setFormData({...formData, Programme: e.target.value})} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Duration (Months)</label><input type="number" name="Duration" value={formData.Duration || ''} onChange={e => setFormData({...formData, Duration: e.target.value})} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required /></div>
                        <div><label className="block text-sm font-medium">Status</label><select name="Status" value={formData.Status || ''} onChange={e => setFormData({...formData, Status: e.target.value})} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required><option>Active</option><option>Inactive</option></select></div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 -mx-6 -mb-6 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl mt-6">
                        <button type="button" onClick={closeModal} className="bg-white dark:bg-gray-700 py-2 px-4 border rounded-lg">Cancel</button>
                        <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">{modalContent === 'edit' ? 'Save Changes' : 'Add Course'}</button>
                    </div>
                  </form>
                )}

                {modalContent === 'import' && (
                    <div>
                        <label className="flex items-center justify-center w-full px-4 py-6 bg-gray-50 dark:bg-gray-700 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                            <div className="text-center">
                                <Upload className="w-10 h-10 mx-auto text-gray-400" />
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Click to upload or drag and drop</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">XLSX or XLS file</p>
                            </div>
                            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                        </label>
                        {importData.length > 0 && (
                            <div className="mt-4 max-h-80 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-2 py-2 text-left text-xs font-medium">Programme</th><th className="px-2 py-2 text-left text-xs font-medium">Duration</th><th className="px-2 py-2 text-left text-xs font-medium">Status</th></tr></thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {importData.map((row, i) => (
                                            <tr key={i} className={!row.isValid ? 'bg-red-50 dark:bg-red-900/30' : ''}>
                                                <td className="px-2 py-2 text-sm">{row.Programme}{!row.isValid && <p className="text-xs text-red-600">{row.errors.join(', ')}</p>}</td>
                                                <td className="px-2 py-2 text-sm">{row.Duration}</td>
                                                <td className="px-2 py-2 text-sm">{row.isValid ? '✔️' : '❌'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="bg-gray-50 dark:bg-gray-900 -mx-6 -mb-6 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl mt-6">
                            <button type="button" onClick={closeModal} className="bg-white dark:bg-gray-700 py-2 px-4 border rounded-lg">Cancel</button>
                            <button type="button" onClick={handleImportConfirm} disabled={importData.length === 0 || !importData.some(r => r.isValid)} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400">Confirm Import</button>
                        </div>
                    </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Courses;
