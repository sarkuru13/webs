import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { fetchHolidays, addHoliday, updateHoliday, deleteHoliday } from '../services/holidayService';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { PlusCircle, Upload, Download, Edit, Trash2, XCircle, Calendar, Search } from 'lucide-react';

const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-CA'); // yyyy-MM-dd format
const formatDisplayDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// A responsive card for displaying holiday info on mobile
const HolidayCard = ({ holiday, onEdit, onDelete }) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 flex flex-col"
    >
        <div className="flex-grow">
            <h3 className="font-bold text-gray-800 dark:text-white">{holiday.Title}</h3>
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                {formatDisplayDate(holiday.Date_from)} to {formatDisplayDate(holiday.Date_to)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 truncate">
                {holiday.Description || 'No description'}
            </p>
        </div>
        <div className="flex justify-end gap-2 mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
            <button onClick={() => onEdit(holiday)} className="p-2 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><Edit className="w-5 h-5" /></button>
            <button onClick={() => onDelete(holiday.$id)} className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 className="w-5 h-5" /></button>
        </div>
    </motion.div>
);

function Holidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [currentHoliday, setCurrentHoliday] = useState(null);
  const [formData, setFormData] = useState({});
  const [importData, setImportData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const holidayResponse = await fetchHolidays();
        const sortedHolidays = (holidayResponse || []).sort((a, b) => new Date(a.Date_from) - new Date(b.Date_from));
        setHolidays(sortedHolidays);
      } catch (err) {
        setError('Failed to fetch holidays: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredHolidays = useMemo(() => {
    if (!searchTerm) {
        return holidays;
    }
    return holidays.filter(holiday =>
        holiday.Title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [holidays, searchTerm]);

  const openModal = (type, holiday = null) => {
    setModalContent(type);
    setCurrentHoliday(holiday);
    if (type === 'add') {
      setFormData({ Title: '', Date_from: '', Date_to: '', Description: '' });
    } else if (type === 'edit' && holiday) {
      setFormData({
        Title: holiday.Title,
        Date_from: formatDate(holiday.Date_from),
        Date_to: formatDate(holiday.Date_to),
        Description: holiday.Description || '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalContent(null);
    setImportData([]);
  }, []);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (new Date(formData.Date_to) < new Date(formData.Date_from)) {
      toast.error('End date cannot be before start date.');
      return;
    }
    const isEditing = modalContent === 'edit';
    const toastId = toast.loading(isEditing ? 'Updating holiday...' : 'Adding holiday...');

    try {
      const dataToSubmit = {
        ...formData,
        Date_from: new Date(formData.Date_from).toISOString(),
        Date_to: new Date(formData.Date_to).toISOString(),
      };

      if (isEditing) {
        const updated = await updateHoliday(currentHoliday.$id, dataToSubmit);
        setHolidays(prev => prev.map(h => h.$id === updated.$id ? updated : h).sort((a, b) => new Date(a.Date_from) - new Date(b.Date_from)));
        toast.success('Holiday updated!', { id: toastId });
      } else {
        const newHoliday = await addHoliday(dataToSubmit);
        setHolidays(prev => [...prev, newHoliday].sort((a, b) => new Date(a.Date_from) - new Date(b.Date_from)));
        toast.success('Holiday added!', { id: toastId });
      }
      closeModal();
    } catch (err) {
      toast.error(err.message || 'An error occurred.', { id: toastId });
    }
  };

  const handleDelete = async (holidayId) => {
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      const toastId = toast.loading('Deleting holiday...');
      try {
        await deleteHoliday(holidayId);
        setHolidays(prev => prev.filter(h => h.$id !== holidayId));
        toast.success('Holiday deleted.', { id: toastId });
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        
        const validatedData = jsonData.map(row => {
            const errors = [];
            if (!row.Title) errors.push("Title is missing.");
            if (!row.Date_from || isNaN(Date.parse(row.Date_from))) errors.push("Invalid 'Date_from'.");
            if (!row.Date_to || isNaN(Date.parse(row.Date_to))) errors.push("Invalid 'Date_to'.");
            return { ...row, isValid: errors.length === 0, errors };
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
        toast.error("No valid holidays to import."); return;
    }
    const toastId = toast.loading(`Importing ${validData.length} holidays...`);
    try {
        const creationPromises = validData.map(row => addHoliday({
            Title: row.Title,
            Date_from: new Date(row.Date_from).toISOString(),
            Date_to: new Date(row.Date_to).toISOString(),
            Description: row.Description || '',
        }));
        const newHolidays = await Promise.all(creationPromises);
        setHolidays(prev => [...prev, ...newHolidays].sort((a, b) => new Date(a.Date_from) - new Date(b.Date_from)));
        toast.success(`Successfully imported ${newHolidays.length} holidays!`, { id: toastId });
        closeModal();
    } catch (err) {
        toast.error(err.message, { id: toastId });
    }
  };
  
  const handleExport = () => {
    const formattedData = holidays.map(h => ({
        'Title': h.Title, 'Date_from': formatDate(h.Date_from), 'Date_to': formatDate(h.Date_to), 'Description': h.Description || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Holidays");
    worksheet['!cols'] = [{wch:30},{wch:15},{wch:15},{wch:40}];
    saveAs(new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })]), 'Holidays_Export.xlsx');
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Holiday Management</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Manage the academic holiday schedule.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openModal('add')} className="flex items-center bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"><PlusCircle className="w-5 h-5 mr-2" />Add Holiday</button>
              <label className="flex items-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors shadow-md cursor-pointer"><Upload className="w-5 h-5 mr-2" />Import<input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" /></label>
              <button onClick={handleExport} className="flex items-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors shadow-md"><Download className="w-5 h-5 mr-2" />Export</button>
            </div>
          </div>
          
          <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Search holidays by title..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"/>
          </div>

          {/* Table for Desktop */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date From</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date To</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        <AnimatePresence>
                            {filteredHolidays.length > 0 ? filteredHolidays.map(holiday => (
                                <motion.tr key={holiday.$id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{holiday.Title}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatDate(holiday.Date_from)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatDate(holiday.Date_to)}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs truncate">{holiday.Description || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => openModal('edit', holiday)} className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-4">Edit</button>
                                        <button onClick={() => handleDelete(holiday.$id)} className="text-red-600 hover:text-red-900 dark:hover:text-red-400">Delete</button>
                                    </td>
                                </motion.tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="text-center py-10">
                                        <Calendar className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                                        <p className="mt-4 text-gray-500 dark:text-gray-400">{searchTerm ? 'No holidays match your search.' : 'No holidays found.'}</p>
                                        <p className="text-sm text-gray-400 dark:text-gray-500">{searchTerm ? 'Try a different search term.' : 'Add a new holiday to get started.'}</p>
                                    </td>
                                </tr>
                            )}
                        </AnimatePresence>
                    </tbody>
                </table>
            </div>
          </div>

          {/* Cards for Mobile */}
          <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence>
                {filteredHolidays.length > 0 ? filteredHolidays.map(holiday => (
                    <HolidayCard key={holiday.$id} holiday={holiday} onEdit={openModal.bind(null, 'edit')} onDelete={handleDelete} />
                )) : (
                    <div className="col-span-full text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
                        <Calendar className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-gray-500 dark:text-gray-400">{searchTerm ? 'No holidays match your search.' : 'No holidays found.'}</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">{searchTerm ? 'Try a different search term.' : 'Add a new holiday to get started.'}</p>
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
                  {modalContent === 'add' && 'Add New Holiday'}
                  {modalContent === 'edit' && 'Edit Holiday'}
                  {modalContent === 'import' && 'Import Holidays'}
                </h3>
                <button onClick={closeModal} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><XCircle className="w-6 h-6 text-gray-500" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                {(modalContent === 'add' || modalContent === 'edit') && (
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div><label className="block text-sm font-medium">Title</label><input type="text" name="Title" value={formData.Title || ''} onChange={e => setFormData({...formData, Title: e.target.value})} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Start Date</label><input type="date" name="Date_from" value={formData.Date_from || ''} onChange={e => setFormData({...formData, Date_from: e.target.value})} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required /></div>
                        <div><label className="block text-sm font-medium">End Date</label><input type="date" name="Date_to" value={formData.Date_to || ''} onChange={e => setFormData({...formData, Date_to: e.target.value})} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" required /></div>
                    </div>
                    <div><label className="block text-sm font-medium">Description (Optional)</label><textarea name="Description" value={formData.Description || ''} onChange={e => setFormData({...formData, Description: e.target.value})} className="w-full mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg" rows="3"></textarea></div>
                    <div className="bg-gray-50 dark:bg-gray-900 -mx-6 -mb-6 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl mt-6">
                        <button type="button" onClick={closeModal} className="bg-white dark:bg-gray-700 py-2 px-4 border rounded-lg">Cancel</button>
                        <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg">{modalContent === 'edit' ? 'Save Changes' : 'Add Holiday'}</button>
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
                                    <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-2 py-2 text-left text-xs font-medium">Title</th><th className="px-2 py-2 text-left text-xs font-medium">Dates</th><th className="px-2 py-2 text-left text-xs font-medium">Status</th></tr></thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {importData.map((row, i) => (
                                            <tr key={i} className={!row.isValid ? 'bg-red-50 dark:bg-red-900/30' : ''}>
                                                <td className="px-2 py-2 text-sm">{row.Title}{!row.isValid && <p className="text-xs text-red-600">{row.errors.join(', ')}</p>}</td>
                                                <td className="px-2 py-2 text-sm">{row.Date_from} to {row.Date_to}</td>
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

export default Holidays;
