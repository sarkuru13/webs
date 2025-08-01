import React, { useState, useEffect, useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { fetchHolidays } from '../services/holidayService';
import { getAttendance, createAttendance, updateAttendance, deleteAttendance } from '../services/attendanceService';
import { getStudents } from '../services/studentService';
import { fetchCourses } from '../services/courseService';
import { Calendar as CalendarIcon, UserCheck, UserX, Clock, PlusCircle, Edit, Trash2, Download, ChevronDown, XCircle } from 'lucide-react';

// Helper functions
const formatDate = (date) => date ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date) : '';
const formatToDateTimeLocal = (date) => {
    if (!date) return '';
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

// Reusable component for collapsible course sections
const CourseAccordion = ({ courseName, semesters, students, onEdit, onDelete }) => {
    const [isOpen, setIsOpen] = useState(true);
    const getStatusIcon = (status) => {
        switch (status) {
          case 'Present': return <UserCheck className="w-5 h-5 text-green-500" />;
          case 'Absent': return <UserX className="w-5 h-5 text-red-500" />;
          default: return null;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 text-left">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{courseName}</h3>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }}><ChevronDown className="w-5 h-5 text-gray-500" /></motion.div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <div className="pb-4 px-4 space-y-4">
                            {Object.entries(semesters).sort(([semA], [semB]) => semA - semB).map(([semester, records]) => (
                                <div key={semester}>
                                    <h4 className="text-md font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/50 px-3 py-1 rounded-full inline-block mb-3">Semester {semester}</h4>
                                    <div className="space-y-2">
                                        {records.map(record => {
                                            const student = students.find(s => s.$id === (record.Student_Id?.$id || record.Student_Id));
                                            return (
                                                <div key={record.$id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        {getStatusIcon(record.Status)}
                                                        <span className="font-medium text-gray-700 dark:text-gray-200">{student ? student.Name : 'Unknown Student'}</span>
                                                        <span className="text-sm text-gray-500 dark:text-gray-400">({record.Status})</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <button onClick={() => onEdit(record)} className="p-1 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400"><Edit className="w-4 h-4"/></button>
                                                        <button onClick={() => onDelete(record.$id)} className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

function AttendanceList() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [holidays, setHolidays] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [currentAttendance, setCurrentAttendance] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [bulkCourseId, setBulkCourseId] = useState('');
  const [bulkSemester, setBulkSemester] = useState('');
  const [studentStatuses, setStudentStatuses] = useState({});
  const [location, setLocation] = useState({ Latitude: '', Longitude: '' });
  
  const [exportType, setExportType] = useState('dateRange');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportStudentId, setExportStudentId] = useState('');
  const [exportCourseId, setExportCourseId] = useState('');
  const [exportSemester, setExportSemester] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [holidayDocs, attendanceResponse, studentsResponse, coursesResponse] = await Promise.all([
          fetchHolidays(), getAttendance(), getStudents(), fetchCourses()
        ]);
        setHolidays(holidayDocs.map(h => ({ from: new Date(h.Date_from), to: new Date(h.Date_to), title: h.Title })) || []);
        setAttendanceRecords(attendanceResponse || []);
        setStudents(studentsResponse?.documents || []);
        setCourses(coursesResponse?.filter(c => c.Status === 'Active') || []);
        setError(null);
      } catch (err) {
        setError('Failed to fetch data. Please try again.');
        toast.error('Failed to fetch data: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);
  
  const holidayDates = useMemo(() => {
    return holidays.flatMap(h => {
        const dates = [];
        let current = new Date(h.from);
        current.setHours(0,0,0,0);
        const endDate = new Date(h.to);
        endDate.setHours(0,0,0,0);
        while(current <= endDate) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    });
  }, [holidays]);

  const disabledDays = [{ dayOfWeek: [0, 6] }, ...holidayDates];

  const dailyRecords = useMemo(() => {
    if (!selectedDate) return [];
    return attendanceRecords.filter(r => new Date(r.Marked_at).toDateString() === selectedDate.toDateString());
  }, [selectedDate, attendanceRecords]);

  const groupedRecords = useMemo(() => {
    return dailyRecords.reduce((acc, record) => {
      const student = students.find(s => s.$id === (record.Student_Id?.$id || record.Student_Id));
      if (!student) return acc;
      const courseId = student.Course?.$id || 'unknown';
      const semester = student.Semester || 'N/A';
      if (!acc[courseId]) {
        const course = courses.find(c => c.$id === courseId);
        acc[courseId] = { courseName: course ? course.Programme : 'Unknown Course', semesters: {} };
      }
      if (!acc[courseId].semesters[semester]) acc[courseId].semesters[semester] = [];
      acc[courseId].semesters[semester].push(record);
      return acc;
    }, {});
  }, [dailyRecords, students, courses]);

  const openEditModal = (record) => {
    setCurrentAttendance(record);
    setEditFormData({ Status: record.Status, Marked_at: formatToDateTimeLocal(new Date(record.Marked_at)) });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const toastId = toast.loading('Updating...');
    try {
      const data = { ...currentAttendance, Status: editFormData.Status, Marked_at: new Date(editFormData.Marked_at).toISOString() };
      const updated = await updateAttendance(currentAttendance.$id, data);
      setAttendanceRecords(prev => prev.map(r => r.$id === updated.$id ? updated : r));
      toast.success('Attendance updated!', { id: toastId });
      setIsEditModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'An error occurred.', { id: toastId });
    }
  };
  
  const openBulkModal = () => {
    setBulkCourseId(''); setBulkSemester(''); setStudentStatuses({}); setLocation({ Latitude: '', Longitude: '' });
    setIsBulkModalOpen(true);
  };

  const availableSemesters = useMemo(() => {
    if (!bulkCourseId) return [];
    // Filter students by course and active status to determine available semesters
    const studentsInCourse = students.filter(s => s.Course?.$id === bulkCourseId && s.Status === 'Active');
    return Array.from(new Set(studentsInCourse.map(s => s.Semester).filter(Boolean))).sort((a, b) => a - b);
  }, [bulkCourseId, students]);

  useEffect(() => { setBulkSemester(''); }, [bulkCourseId]);

  const studentsForBulkAdd = useMemo(() => {
    if (!bulkCourseId) return [];
    // Filter for active students from the selected course
    let studentsInCourse = students.filter(s => s.Course?.$id === bulkCourseId && s.Status === 'Active');
    if (bulkSemester) {
        studentsInCourse = studentsInCourse.filter(s => s.Semester === parseInt(bulkSemester));
    }
    // Get IDs of students who already have an attendance record for the selected date
    const studentsWithAttendance = new Set(dailyRecords.map(r => r.Student_Id?.$id || r.Student_Id));
    // Return students who are in the course/semester, active, and don't have a record yet for this day
    return studentsInCourse.filter(s => !studentsWithAttendance.has(s.$id));
  }, [bulkCourseId, bulkSemester, students, dailyRecords]);
  
  const groupedStudentsForBulkAdd = useMemo(() => {
      return studentsForBulkAdd.reduce((acc, student) => {
          const semester = student.Semester || 'N/A';
          if (!acc[semester]) acc[semester] = [];
          acc[semester].push(student);
          return acc;
      }, {});
  }, [studentsForBulkAdd]);

  useEffect(() => {
    setStudentStatuses(studentsForBulkAdd.reduce((acc, s) => ({ ...acc, [s.$id]: 'Present' }), {}));
  }, [studentsForBulkAdd]);

  const handleBulkStatusChange = (studentId, status) => setStudentStatuses(prev => ({ ...prev, [studentId]: status }));
  const handleMarkAll = (status) => setStudentStatuses(studentsForBulkAdd.reduce((acc, s) => ({ ...acc, [s.$id]: status }), {}));

  const handleGetLocation = () => {
    toast.loading('Fetching location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ Latitude: pos.coords.latitude.toString(), Longitude: pos.coords.longitude.toString() });
        toast.dismiss(); toast.success('Location captured!');
      },
      (err) => { toast.dismiss(); toast.error('Failed to get location: ' + err.message); }
    );
  };

  const handleBulkSubmit = async () => {
    if (!bulkCourseId || !location.Latitude || !location.Longitude) {
        toast.error("Please select a course and set a location."); return;
    }
    const toastId = toast.loading('Submitting attendance...');
    try {
        const recordsToCreate = Object.entries(studentStatuses).map(([studentId, status]) => ({
            Student_Id: studentId, Status: status, Course_Id: bulkCourseId, Marked_By: 'Admin',
            Marked_at: selectedDate.toISOString(), Latitude: parseFloat(location.Latitude), Longitude: parseFloat(location.Longitude),
        }));
        if (recordsToCreate.length === 0) {
            toast.success("No new records to add.", { id: toastId }); setIsBulkModalOpen(false); return;
        }
        const newRecords = await Promise.all(recordsToCreate.map(data => createAttendance(data)));
        setAttendanceRecords(prev => [...prev, ...newRecords]);
        toast.success(`Added ${newRecords.length} attendance records!`, { id: toastId });
        setIsBulkModalOpen(false);
    } catch (err) {
        toast.error(err.message || 'An error occurred.', { id: toastId });
    }
  };

  const availableSemestersForExport = useMemo(() => {
    if (!exportCourseId) return [];
    // Filter for active students to determine available semesters for export
    const studentsInCourse = students.filter(s => s.Course?.$id === exportCourseId && s.Status === 'Active');
    return Array.from(new Set(studentsInCourse.map(s => s.Semester).filter(Boolean))).sort((a, b) => a - b);
  }, [exportCourseId, students]);

  useEffect(() => { setExportSemester(''); }, [exportCourseId]);

  const handleExport = () => {
    let dataToExport = [], filename = 'attendance_report.xlsx';
    if (exportType === 'dateRange') {
        if (!exportStartDate || !exportEndDate) { toast.error("Please select a start and end date."); return; }
        const start = new Date(exportStartDate); start.setHours(0,0,0,0);
        const end = new Date(exportEndDate); end.setHours(23,59,59,999);
        dataToExport = attendanceRecords.filter(r => { const d = new Date(r.Marked_at); return d >= start && d <= end; });
        filename = `Attendance_${exportStartDate}_to_${exportEndDate}.xlsx`;
    } else if (exportType === 'individualStudent') {
        if (!exportStudentId) { toast.error("Please select a student."); return; }
        dataToExport = attendanceRecords.filter(r => (r.Student_Id?.$id || r.Student_Id) === exportStudentId);
        const studentName = students.find(s => s.$id === exportStudentId)?.Name || 'student';
        filename = `Attendance_${studentName.replace(' ', '_')}.xlsx`;
    } else if (exportType === 'courseAndSemester') {
        if (!exportCourseId) { toast.error("Please select a course."); return; }
        // Filter for active students for this export type
        let filteredStudents = students.filter(s => s.Course?.$id === exportCourseId && s.Status === 'Active');
        if (exportSemester) filteredStudents = filteredStudents.filter(s => s.Semester === parseInt(exportSemester));
        const studentIds = new Set(filteredStudents.map(s => s.$id));
        dataToExport = attendanceRecords.filter(r => studentIds.has(r.Student_Id?.$id || r.Student_Id));
        const courseName = courses.find(c => c.$id === exportCourseId)?.Programme.replace(/\s/g, '_') || 'Course';
        filename = `Attendance_${courseName}${exportSemester ? `_Sem${exportSemester}` : ''}.xlsx`;
    }
    if (dataToExport.length === 0) { toast.error("No data found for the selected criteria."); return; }
    const formatted = dataToExport.map(r => {
        const student = students.find(s => s.$id === (r.Student_Id?.$id || r.Student_Id));
        const course = courses.find(c => c.$id === r.Course_Id);
        return { 'Date': new Date(r.Marked_at).toLocaleDateString(), 'Time': new Date(r.Marked_at).toLocaleTimeString(), 'Student Name': student?.Name || 'Unknown', 'ABC ID': student?.ABC_ID || 'N/A', 'Course': course?.Programme || 'Unknown', 'Semester': student?.Semester || 'N/A', 'Status': r.Status, 'Marked By': r.Marked_By };
    });
    const ws = XLSX.utils.json_to_sheet(formatted);
    ws['!cols'] = [ {wch:12}, {wch:12}, {wch:25}, {wch:15}, {wch:25}, {wch:10}, {wch:10}, {wch:15} ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), filename);
    setIsExportModalOpen(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure?')) {
        const toastId = toast.loading('Deleting...');
        try {
            await deleteAttendance(id);
            setAttendanceRecords(prev => prev.filter(r => r.$id !== id));
            toast.success('Record deleted.', { id: toastId });
        } catch (err) {
            toast.error(err.message || 'Failed to delete.', { id: toastId });
        }
    }
  };

  if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500"></div></div>;
  if (error) return <div className="p-8 text-center text-red-600 bg-red-100 dark:bg-red-900/30 rounded-lg">{error}</div>;

  return (
    <>
      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-gray-700 dark:text-white' }} />
      <style>{`
        .rdp { --rdp-cell-size: 40px; --rdp-accent-color: #4f46e5; }
        .rdp-day_selected { font-weight: bold; }
        .rdp-day_holiday { background-color: #e0f2fe; color: #0284c7; }
        .dark .rdp-day_holiday { background-color: #0c4a6e; color: #7dd3fc; }
        .dark .rdp { color: #d1d5db; }
      `}</style>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Attendance Records</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Review, manage, and export daily attendance.</p>
              </div>
              <div className="flex items-center gap-2">
                  <button onClick={() => setIsBulkModalOpen(true)} className="flex items-center bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"><PlusCircle className="w-5 h-5 mr-2" />Bulk Add</button>
                  <button onClick={() => setIsExportModalOpen(true)} className="flex items-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors shadow-md"><Download className="w-5 h-5 mr-2" />Export</button>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md h-fit">
              <DayPicker mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} disabled={disabledDays} modifiers={{ holiday: holidayDates }} modifiersClassNames={{ holiday: 'rdp-day_holiday' }} />
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Records for {formatDate(selectedDate)}</h2>
              </div>
              <AnimatePresence>
                {Object.keys(groupedRecords).length > 0 ? (
                  Object.entries(groupedRecords).map(([courseId, data]) => (
                    <CourseAccordion key={courseId} {...data} students={students} onEdit={openEditModal} onDelete={handleDelete} />
                  ))
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
                    <CalendarIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                    <p className="mt-4 text-gray-500 dark:text-gray-400">No attendance records for this day.</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">Select another date or use 'Bulk Add' to create records.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isEditModalOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"><form onSubmit={handleEditSubmit}><div className="p-6"><h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Attendance</h3><div className="space-y-4"><div><label className="block text-sm font-medium">Status</label><select name="Status" value={editFormData.Status} onChange={(e) => setEditFormData({...editFormData, Status: e.target.value})} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required><option>Present</option><option>Absent</option></select></div><div><label className="block text-sm font-medium">Marked At</label><input type="datetime-local" name="Marked_at" value={editFormData.Marked_at} onChange={(e) => setEditFormData({...editFormData, Marked_at: e.target.value})} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required /></div></div></div><div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl"><button type="button" onClick={() => setIsEditModalOpen(false)} className="bg-white dark:bg-gray-700 py-2 px-4 border rounded-lg">Cancel</button><button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">Save Changes</button></div></form></motion.div></motion.div>}
        {isBulkModalOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"><div className="p-6 border-b dark:border-gray-700"><h3 className="text-xl font-bold">Bulk Add for {formatDate(selectedDate)}</h3></div><div className="p-6 overflow-y-auto space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium">Course</label><select value={bulkCourseId} onChange={e => setBulkCourseId(e.target.value)} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required><option value="">Select Course</option>{courses.map(c => <option key={c.$id} value={c.$id}>{c.Programme}</option>)}</select></div><div><label className="block text-sm font-medium">Semester</label><select value={bulkSemester} onChange={e => setBulkSemester(e.target.value)} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" disabled={!bulkCourseId || availableSemesters.length === 0}><option value="">All Semesters</option>{availableSemesters.map(sem => <option key={sem} value={sem}>Semester {sem}</option>)}</select></div></div><div><label className="block text-sm font-medium">Location</label><div className="flex gap-2"><input type="text" placeholder="Lat" value={location.Latitude} onChange={e => setLocation({...location, Latitude: e.target.value})} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" /><input type="text" placeholder="Lon" value={location.Longitude} onChange={e => setLocation({...location, Longitude: e.target.value})} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" /><button type="button" onClick={handleGetLocation} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">📍</button></div></div><div className="flex justify-between items-center mt-4"><h4 className="font-semibold">Student Roster</h4><div className="space-x-2"><button onClick={() => handleMarkAll('Present')} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">All Present</button><button onClick={() => handleMarkAll('Absent')} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">All Absent</button></div></div><div className="max-h-64 overflow-y-auto space-y-3 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">{Object.keys(groupedStudentsForBulkAdd).length > 0 ? Object.entries(groupedStudentsForBulkAdd).map(([sem, list]) => (<div key={sem}><h5 className="font-bold text-sm text-gray-500 px-1 py-2">Semester {sem}</h5><div className="space-y-2">{list.map(s => (<div key={s.$id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded"><span className="font-medium text-sm">{s.Name}</span><div className="flex gap-1">{['Present', 'Absent'].map(status => (<button key={status} type="button" onClick={() => handleBulkStatusChange(s.$id, status)} className={`px-2 py-1 text-xs rounded-full ${studentStatuses[s.$id] === status ? 'text-white ' + (status === 'Present' ? 'bg-green-500' : status === 'Absent' ? 'bg-red-500' : 'bg-yellow-500') : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'}`}>{status}</button>))}</div></div>))}</div></div>)) : <p className="text-center text-gray-500 py-4">{bulkCourseId ? "All students marked or no active students." : "Select a course."}</p>}</div></div><div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl mt-auto"><button type="button" onClick={() => setIsBulkModalOpen(false)} className="bg-white dark:bg-gray-700 py-2 px-4 border rounded-lg">Cancel</button><button type="button" onClick={handleBulkSubmit} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">Save Attendance</button></div></motion.div></motion.div>}
        {isExportModalOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"><div className="p-6"><h3 className="text-xl font-bold mb-4">Export Attendance</h3><div className="space-y-4"><div><label className="block text-sm font-medium">Export Type</label><select value={exportType} onChange={e => setExportType(e.target.value)} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg"><option value="dateRange">Date Range</option><option value="individualStudent">Individual Student</option><option value="courseAndSemester">By Course/Semester</option></select></div>{exportType === 'dateRange' && (<div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium">Start Date</label><input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" /></div><div><label className="block text-sm font-medium">End Date</label><input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" /></div></div>)}{exportType === 'individualStudent' && (<div><label className="block text-sm font-medium">Student</label><select value={exportStudentId} onChange={e => setExportStudentId(e.target.value)} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg"><option value="">Select Student</option>{students.filter(s => s.Status === 'Active').map(s => <option key={s.$id} value={s.$id}>{s.Name}</option>)}</select></div>)}{exportType === 'courseAndSemester' && (<div className="space-y-4"><div><label className="block text-sm font-medium">Course</label><select value={exportCourseId} onChange={e => setExportCourseId(e.target.value)} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg"><option value="">Select Course</option>{courses.map(c => <option key={c.$id} value={c.$id}>{c.Programme}</option>)}</select></div><div><label className="block text-sm font-medium">Semester</label><select value={exportSemester} onChange={e => setExportSemester(e.target.value)} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" disabled={!exportCourseId || availableSemestersForExport.length === 0}><option value="">All Semesters</option>{availableSemestersForExport.map(sem => <option key={sem} value={sem}>Semester {sem}</option>)}</select></div></div>)}</div></div><div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl"><button type="button" onClick={() => setIsExportModalOpen(false)} className="bg-white dark:bg-gray-700 py-2 px-4 border rounded-lg">Cancel</button><button type="button" onClick={handleExport} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg">Export</button></div></motion.div></motion.div>}
      </AnimatePresence>
    </>
  );
}

export default AttendanceList;