import React, { useState, useEffect, useMemo } from 'react';
import { getStudents, createStudent, updateStudent, deleteStudent } from '../services/studentService';
import { fetchCourses } from '../services/courseService';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { PlusCircle, Upload, Download, Search, User, Edit, Trash2, XCircle, MoreVertical } from 'lucide-react';

// Reusable component for student cards
const StudentCard = ({ student, onDetails, onEdit, onDelete }) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300"
    >
        <div className="flex justify-between items-start">
            <div>
                <p className="font-bold text-gray-800 dark:text-white">{student.Name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">ABC ID: {student.ABC_ID}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${student.Status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                {student.Status}
            </span>
        </div>
        <div className="flex justify-end items-center gap-2 mt-4">
            <button onClick={() => onDetails(student)} className="text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">Details</button>
            <button onClick={() => onEdit(student)} className="text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">Edit</button>
            <button onClick={() => onDelete(student.$id)} className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400">Delete</button>
        </div>
    </motion.div>
);

function Students() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  // Form & Data States
  const [currentStudent, setCurrentStudent] = useState(null);
  const [formData, setFormData] = useState({});
  const [importData, setImportData] = useState([]);
  
  // Filter States
  const [courseFilter, setCourseFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // Default to show all students
  const [searchTerm, setSearchTerm] = useState('');

  // Export States
  const [exportCourse, setExportCourse] = useState('');
  const [exportSemester, setExportSemester] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [studentResponse, courseResponse] = await Promise.all([
          getStudents(),
          fetchCourses(),
        ]);
        setStudents(studentResponse.documents || []);
        setCourses(courseResponse || []);
      } catch (err) {
        setError('Failed to fetch data: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredAndGroupedStudents = useMemo(() => {
    const filtered = students.filter(student => {
        const matchesCourse = courseFilter ? student.Course?.$id === courseFilter : true;
        const matchesSemester = semesterFilter ? student.Semester === parseInt(semesterFilter) : true;
        const matchesStatus = statusFilter ? student.Status === statusFilter : true;
        const matchesSearch = searchTerm ? student.Name.toLowerCase().includes(searchTerm.toLowerCase()) || student.ABC_ID.toString().includes(searchTerm) || (student.Email && student.Email.toLowerCase().includes(searchTerm.toLowerCase())) : true;
        return matchesCourse && matchesSemester && matchesStatus && matchesSearch;
    });

    return filtered.reduce((acc, student) => {
        const courseName = student.Course?.Programme || 'Unassigned';
        const semester = student.Semester || 'N/A';
        if (!acc[courseName]) acc[courseName] = {};
        if (!acc[courseName][semester]) acc[courseName][semester] = [];
        acc[courseName][semester].push(student);
        return acc;
    }, {});
  }, [students, courseFilter, semesterFilter, statusFilter, searchTerm]);

  const availableSemesters = useMemo(() => {
    const filterId = courseFilter || exportCourse;
    if (!filterId) return [];
    const studentsInCourse = students.filter(s => s.Course?.$id === filterId);
    const semesters = new Set(studentsInCourse.map(s => s.Semester).filter(Boolean));
    return Array.from(semesters).sort((a, b) => a - b);
  }, [courseFilter, exportCourse, students]);

  const openModal = (type, student = null) => {
    setModalContent(type);
    setCurrentStudent(student);
    if (type === 'add') {
        setFormData({ Name: '', Gender: '', ABC_ID: '', Email: '', Status: 'Active', Course: '', Semester: '', Batch: '', Year: '', Address: '' });
    } else if (type === 'edit' && student) {
        setFormData({ ...student, Course: student.Course?.$id });
    } else if (type === 'export') {
        setExportCourse('');
        setExportSemester('');
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
    const toastId = toast.loading(isEditing ? 'Updating student...' : 'Adding student...');
    
    try {
        const dataToSubmit = {
            ...formData,
            ABC_ID: parseInt(formData.ABC_ID),
            Semester: formData.Semester ? parseInt(formData.Semester) : null,
            Batch: formData.Batch ? parseInt(formData.Batch) : null,
        };

        if (isEditing) {
            const updated = await updateStudent(currentStudent.$id, dataToSubmit);
            setStudents(prev => prev.map(s => s.$id === updated.$id ? updated : s));
            toast.success('Student updated!', { id: toastId });
        } else {
            const newStudent = await createStudent(dataToSubmit);
            setStudents(prev => [newStudent, ...prev]);
            toast.success('Student added!', { id: toastId });
        }
        closeModal();
    } catch (err) {
        toast.error(err.message || 'An error occurred.', { id: toastId });
    }
  };

  const handleDelete = async (studentId) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
        const toastId = toast.loading('Deleting student...');
        try {
            await deleteStudent(studentId);
            setStudents(prev => prev.filter(s => s.$id !== studentId));
            toast.success('Student deleted.', { id: toastId });
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
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const validatedData = jsonData.map(row => {
          const course = courses.find(c => c.Programme === row.Course);
          const errors = [];
          if (!row.Name) errors.push("Name is missing.");
          if (!row['ABC ID'] || isNaN(parseInt(row['ABC ID']))) errors.push("Invalid ABC ID.");
          if (students.some(s => s.ABC_ID === parseInt(row['ABC ID']))) errors.push("Duplicate ABC ID.");
          if (row.Email && students.some(s => s.Email === row.Email)) errors.push("Duplicate Email.");
          if (!course) errors.push("Course not found.");
          
          return { ...row, isValid: errors.length === 0, errors, CourseId: course?.$id };
      });
      setImportData(validatedData);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportConfirm = async () => {
    const validData = importData.filter(row => row.isValid);
    if (validData.length === 0) {
        toast.error("No valid students to import.");
        return;
    }
    const toastId = toast.loading(`Importing ${validData.length} students...`);
    try {
        const creationPromises = validData.map(row => createStudent({
            Name: row.Name,
            Gender: row.Gender,
            ABC_ID: parseInt(row['ABC ID']),
            Status: row.Status || 'Active',
            Course: row.CourseId,
            Semester: row.Semester ? parseInt(row.Semester) : null,
            Batch: row.Batch ? parseInt(row.Batch) : null,
            Year: row.Year,
            Address: row.Address,
            Email: row.Email || null,
        }));
        const newStudents = await Promise.all(creationPromises);
        setStudents(prev => [...newStudents, ...prev]);
        toast.success(`Successfully imported ${newStudents.length} students!`, { id: toastId });
        closeModal();
    } catch (err) {
        toast.error(err.message, { id: toastId });
    }
  };

  const handleExport = () => {
    let dataToExport = students;
    let courseName = 'All_Courses';
    let semesterName = '';

    if (exportCourse) {
        dataToExport = dataToExport.filter(s => s.Course?.$id === exportCourse);
        courseName = courses.find(c => c.$id === exportCourse)?.Programme.replace(' ', '_') || 'Course';
    }
    if (exportSemester) {
        dataToExport = dataToExport.filter(s => s.Semester === parseInt(exportSemester));
        semesterName = `_Sem${exportSemester}`;
    }

    if (dataToExport.length === 0) {
        toast.error("No students found for the selected criteria.");
        return;
    }

    const formattedData = dataToExport.map(student => ({
        'Name': student.Name,
        'ABC ID': student.ABC_ID,
        'Email': student.Email || 'N/A',
        'Gender': student.Gender,
        'Status': student.Status,
        'Course': student.Course?.Programme || 'N/A',
        'Semester': student.Semester || 'N/A',
        'Batch': student.Batch || 'N/A',
        'Year': student.Year || 'N/A',
        'Address': student.Address || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    worksheet['!cols'] = [{wch:25},{wch:15},{wch:30},{wch:10},{wch:10},{wch:30},{wch:10},{wch:10},{wch:10},{wch:40}];
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(data, `Students_${courseName}${semesterName}.xlsx`);
    closeModal();
  }

  if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500"></div></div>;
  if (error) return <div className="p-8 text-center text-red-600 bg-red-100 dark:bg-red-900/30 rounded-lg">{error}</div>;

  return (
    <>
      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-gray-700 dark:text-white' }} />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Student Management</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Manage student records, import, and export data.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openModal('add')} className="flex items-center bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"><PlusCircle className="w-5 h-5 mr-2" />Add Student</button>
              <button onClick={() => openModal('import')} className="flex items-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors shadow-md"><Upload className="w-5 h-5 mr-2" />Import</button>
              <button onClick={() => openModal('export')} className="flex items-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors shadow-md"><Download className="w-5 h-5 mr-2" />Export</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Search by name, ABC ID, or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <select value={courseFilter} onChange={e => {setCourseFilter(e.target.value); setSemesterFilter('')}} className="w-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.$id} value={c.$id}>{c.Programme}</option>)}
            </select>
            <select value={semesterFilter} onChange={e => setSemesterFilter(e.target.value)} className="w-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500" disabled={!courseFilter || availableSemesters.length === 0}>
              <option value="">All Semesters</option>
              {availableSemesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
              <option value="">All Students</option>
              <option value="Active">Active Students</option>
              <option value="Inactive">Inactive Students</option>
            </select>
          </div>

          <div className="space-y-6">
            <AnimatePresence>
              {Object.keys(filteredAndGroupedStudents).length > 0 ? (
                Object.entries(filteredAndGroupedStudents).map(([courseName, semesters]) => (
                  <motion.div key={courseName} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">{courseName}</h2>
                    {Object.entries(semesters).sort(([semA], [semB]) => semA - semB).map(([semester, studentList]) => (
                      <div key={semester} className="mt-4">
                        <h3 className="text-md font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/50 px-3 py-1 rounded-full inline-block mb-3">Semester {semester}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {studentList.map(student => (
                            <StudentCard key={student.$id} student={student} onDetails={openModal.bind(null, 'details')} onEdit={openModal.bind(null, 'edit')} onDelete={handleDelete} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ))
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
                  <User className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                  <p className="mt-4 text-gray-500 dark:text-gray-400">No students found.</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Try adjusting your filters or adding a new student.</p>
                </motion.div>
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
                  {modalContent === 'add' && 'Add New Student'}
                  {modalContent === 'edit' && 'Edit Student'}
                  {modalContent === 'details' && 'Student Details'}
                  {modalContent === 'import' && 'Import Students'}
                  {modalContent === 'export' && 'Export Students'}
                </h3>
                <button onClick={closeModal} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><XCircle className="w-6 h-6 text-gray-500" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                {(modalContent === 'add' || modalContent === 'edit') && (
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Name</label><input type="text" name="Name" value={formData.Name || ''} onChange={e => setFormData({...formData, Name: e.target.value})} className="w-full mt-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required /></div>
                        <div><label className="block text-sm font-medium">ABC ID</label><input type="number" name="ABC_ID" value={formData.ABC_ID || ''} onChange={e => setFormData({...formData, ABC_ID: e.target.value})} className="w-full mt-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required /></div>
                        <div className="md:col-span-2"><label className="block text-sm font-medium">Email</label><input type="email" name="Email" value={formData.Email || ''} onChange={e => setFormData({...formData, Email: e.target.value})} className="w-full mt-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" /></div>
                        <div><label className="block text-sm font-medium">Gender</label><select name="Gender" value={formData.Gender || ''} onChange={e => setFormData({...formData, Gender: e.target.value})} className="w-full mt-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
                        <div><label className="block text-sm font-medium">Status</label><select name="Status" value={formData.Status || ''} onChange={e => setFormData({...formData, Status: e.target.value})} className="w-full mt-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required><option>Active</option><option>Inactive</option></select></div>
                        <div><label className="block text-sm font-medium">Course</label><select name="Course" value={formData.Course || ''} onChange={e => setFormData({...formData, Course: e.target.value})} className="w-full mt-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required><option value="">Select</option>{courses.map(c => <option key={c.$id} value={c.$id}>{c.Programme}</option>)}</select></div>
                        <div><label className="block text-sm font-medium">Semester</label><input type="number" name="Semester" value={formData.Semester || ''} onChange={e => setFormData({...formData, Semester: e.target.value})} className="w-full mt-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" /></div>
                        <div><label className="block text-sm font-medium">Batch</label><input type="number" name="Batch" value={formData.Batch || ''} onChange={e => setFormData({...formData, Batch: e.target.value})} className="w-full mt-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" /></div>
                        
                        <div>
                          <label className="block text-sm font-medium">Year</label>
                          <select name="Year" value={formData.Year || ''} onChange={e => setFormData({...formData, Year: e.target.value})} className="w-full mt-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg">
                              <option value="">Select Year</option>
                              <option value="First">First</option>
                              <option value="Second">Second</option>
                              <option value="Third">Third</option>
                              <option value="Fourth">Fourth</option>
                              <option value="Fifth">Fifth</option>
                          </select>
                        </div>
                    </div>
                    <div><label className="block text-sm font-medium">Address</label><textarea name="Address" value={formData.Address || ''} onChange={e => setFormData({...formData, Address: e.target.value})} className="w-full mt-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" rows="3"></textarea></div>
                    <div className="bg-gray-50 dark:bg-gray-900 -mx-6 -mb-6 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl mt-6">
                        <button type="button" onClick={closeModal} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg">Cancel</button>
                        <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">{modalContent === 'edit' ? 'Save Changes' : 'Add Student'}</button>
                    </div>
                  </form>
                )}

                {modalContent === 'details' && currentStudent && (
                    <div className="space-y-4">
                        {Object.entries({ Name: currentStudent.Name, 'ABC ID': currentStudent.ABC_ID, Email: currentStudent.Email, Gender: currentStudent.Gender, Status: currentStudent.Status, Course: currentStudent.Course?.Programme, Semester: currentStudent.Semester, Batch: currentStudent.Batch, Year: currentStudent.Year, Address: currentStudent.Address }).map(([key, value]) => (
                            <div key={key}><p className="text-sm font-medium text-gray-500 dark:text-gray-400">{key}</p><p className="text-gray-900 dark:text-white">{value || 'N/A'}</p></div>
                        ))}
                    </div>
                )}

                {modalContent === 'import' && (
                    <div>
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900/50 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900"/>
                        {importData.length > 0 && (
                            <div className="mt-4 max-h-80 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Name</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">ABC ID</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Email</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Status</th></tr></thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {importData.map((row, i) => (
                                            <tr key={i} className={!row.isValid ? 'bg-red-50 dark:bg-red-900/30' : ''}>
                                                <td className="px-2 py-2 text-sm">{row.Name}{!row.isValid && <p className="text-xs text-red-600 dark:text-red-400">{row.errors.join(', ')}</p>}</td>
                                                <td className="px-2 py-2 text-sm">{row['ABC ID']}</td>
                                                <td className="px-2 py-2 text-sm">{row.Email}</td>
                                                <td className="px-2 py-2 text-sm">{row.isValid ? '✔️' : '❌'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="bg-gray-50 dark:bg-gray-900 -mx-6 -mb-6 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl mt-6">
                            <button type="button" onClick={closeModal} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg">Cancel</button>
                            <button type="button" onClick={handleImportConfirm} disabled={importData.length === 0 || !importData.some(r => r.isValid)} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400">Confirm Import</button>
                        </div>
                    </div>
                )}

                {modalContent === 'export' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Course</label>
                            <select value={exportCourse} onChange={e => setExportCourse(e.target.value)} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg">
                                <option value="">All Courses</option>
                                {courses.map(c => <option key={c.$id} value={c.$id}>{c.Programme}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Semester</label>
                            <select value={exportSemester} onChange={e => setExportSemester(e.target.value)} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" disabled={!exportCourse || availableSemesters.length === 0}>
                                <option value="">All Semesters</option>
                                {availableSemesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
                            </select>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 -mx-6 -mb-6 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl mt-6">
                            <button type="button" onClick={closeModal} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg">Cancel</button>
                            <button type="button" onClick={handleExport} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg">Export to Excel</button>
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

export default Students;