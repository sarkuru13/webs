import React, { useState, useEffect } from 'react';
import { getStudents } from '../services/studentService';
import { fetchCourses } from '../services/courseService';
import { getAttendance } from '../services/attendanceService';
import { ComposedChart, Area, Line, ScatterChart, Scatter, ZAxis, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, BookOpen, UserCheck, AlertCircle, UserX, Percent, MonitorSmartphone } from 'lucide-react';

// --- Reusable Components ---

// Professional color palette
const COLORS = {
  present: '#16a34a', // Green
  absent: '#dc2626', // Red
  blue: '#2563eb',
  purple: '#7c3aed',
  orange: '#f97316',
  cyan: '#0891b2',
};
const COLOR_ARRAY = Object.values(COLORS);

// StatCard component
const StatCard = ({ title, value, icon, color, subtext }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
    <div className={`p-2 rounded-lg ${color.bg}`}>
      {React.cloneElement(icon, { className: `w-5 h-5 ${color.text}` })}
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
      {subtext && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtext}</p>
      )}
    </div>
  </div>
);

// Chart container with clean, professional styling
const ChartContainer = ({ title, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
    <div style={{ width: '100%', height: 320 }}>{children}</div>
  </div>
);

// General custom tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label || payload[0].payload.name}</p>
        {payload.map((entry, index) => (
          <p key={`tooltip-${index}`} className="text-sm" style={{ color: entry.color || entry.stroke || entry.fill }}>
            {`${entry.name}: ${entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// --- Custom Hook for Media Query ---
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Set initial state based on current window size to avoid flash of incorrect content
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    // Add listener for window resize
    const listener = () => setMatches(media.matches);
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, [matches, query]);

  return matches;
};


// --- Main Overview Component ---

function Overview({ user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)'); // Corresponds to Tailwind's 'lg' breakpoint

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        const [studentsResponse, coursesResponse, attendanceResponse] = await Promise.all([
          getStudents(),
          fetchCourses(),
          getAttendance()
        ]);

        const students = studentsResponse.documents || [];
        const courses = coursesResponse || [];
        const attendance = attendanceResponse || [];

        const today = new Date().toDateString();
        const todaysRecords = attendance.filter(r => new Date(r.Marked_at).toDateString() === today);
        const todaysAttendance = {
          present: todaysRecords.filter(r => r.Status === 'Present').length,
          absent: todaysRecords.filter(r => r.Status === 'Absent').length,
          total: todaysRecords.length
        };

        const attendanceByCourseToday = courses.map(course => {
          const courseStudents = students.filter(s => s.Course?.$id === course.$id);
          const courseStudentIds = new Set(courseStudents.map(s => s.$id));
          const courseRecordsToday = todaysRecords.filter(r => courseStudentIds.has(r.Student_Id?.$id));
          
          const presentCount = courseRecordsToday.filter(r => r.Status === 'Present').length;
          const absentCount = courseRecordsToday.filter(r => r.Status === 'Absent').length;
          
          return {
            name: course.Programme,
            present: presentCount,
            absent: absentCount,
            total: presentCount + absentCount
          };
        }).filter(c => c.total > 0);

        const attendanceTrend = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateString = d.toDateString();
          const recordsForDay = attendance.filter(r => new Date(r.Marked_at).toDateString() === dateString);
          return {
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            Present: recordsForDay.filter(r => r.Status === 'Present').length,
            Absent: recordsForDay.filter(r => r.Status === 'Absent').length,
          };
        }).reverse();

        const currentYear = new Date().getFullYear();
        const yearlyRecords = attendance.filter(r => new Date(r.Marked_at).getFullYear() === currentYear);
        const yearlyAttendanceTrend = Array.from({ length: 12 }, (_, i) => {
          const monthData = {
            month: new Date(0, i).toLocaleString('en-US', { month: 'short' })
          };
          courses.forEach(course => {
            monthData[course.Programme] = 0;
          });
          return monthData;
        });

        yearlyRecords.forEach(record => {
          const monthIndex = new Date(record.Marked_at).getMonth();
          const student = students.find(s => s.$id === record.Student_Id?.$id);
          if (student && student.Course) {
            const courseName = student.Course.Programme;
            yearlyAttendanceTrend[monthIndex][courseName] += record.Status === 'Present' ? 1 : -1;
          }
        });

        const todaysPieData = [
          { name: 'Present', value: todaysAttendance.present, fill: COLORS.present },
          { name: 'Absent', value: todaysAttendance.absent, fill: COLORS.absent },
        ];

        setStats({
          todaysAttendance,
          attendanceByCourseToday,
          todaysPieData,
          attendanceTrend,
          yearlyAttendanceTrend,
          courses
        });

      } catch (err) {
        console.error('Error fetching statistics:', err);
        setError("Failed to load dashboard data. Please try refreshing the page.");
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [user]);

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-600"></div></div>;
  if (error) return <div className="p-8 text-center text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center gap-2"><AlertCircle className="w-6 h-6" />{error}</div>;

  return (
    <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Welcome, {user?.name || 'Admin'}!</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Here's your attendance system overview.</p>
          </div>
        </div>

        {stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard title="Today's Present" value={stats.todaysAttendance.present} icon={<UserCheck />} color={{ bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' }} subtext="Students marked as present" />
              <StatCard title="Today's Absent" value={stats.todaysAttendance.absent} icon={<UserX />} color={{ bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' }} subtext="Students marked as absent" />
              <StatCard title="Attendance Rate" value={`${stats.todaysAttendance.total > 0 ? Math.round(stats.todaysAttendance.present / stats.todaysAttendance.total * 100) : 0}%`} icon={<Percent />} color={{ bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' }} subtext="For all marked students today" />
            </div>

            {isDesktop ? (
              // --- DESKTOP LAYOUT (lg screens and up) ---
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartContainer title="Today's Attendance Ratio">
                    <ResponsiveContainer width="100%" height="100%">
                      {stats.todaysAttendance.total > 0 ? (
                        <PieChart>
                          <Pie data={stats.todaysPieData} cx="50%" cy="50%" labelLine={false} innerRadius="60%" outerRadius="80%" paddingAngle={5} dataKey="value">
                            {stats.todaysPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend iconType="circle" />
                        </PieChart>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">No attendance marked today.</div>
                      )}
                    </ResponsiveContainer>
                  </ChartContainer>
                  <ChartContainer title="Today's Attendance by Course">
                    <ResponsiveContainer width="100%" height="100%">
                      {stats.attendanceByCourseToday.length > 0 ? (
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <CartesianGrid />
                          <XAxis type="number" dataKey="present" name="Present" unit="" stroke="#6b7280" />
                          <YAxis type="number" dataKey="absent" name="Absent" unit="" stroke="#6b7280" />
                          <ZAxis type="number" dataKey="total" range={[60, 400]} name="Total Students" unit="" />
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                          <Legend />
                          <Scatter name="Courses" data={stats.attendanceByCourseToday} fillOpacity={0.7}>
                            {stats.attendanceByCourseToday.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLOR_ARRAY[index % COLOR_ARRAY.length]} />
                            ))}
                          </Scatter>
                        </ScatterChart>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">No attendance marked today.</div>
                      )}
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>

                <ChartContainer title="7-Day Attendance Trend">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={stats.attendanceTrend} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" align="center" verticalAlign="bottom" />
                      <Area type="monotone" dataKey="Present" fill={COLORS.present} stroke="false" fillOpacity={0.2} name="Present Area" />
                      <Line type="monotone" dataKey="Present" stroke={COLORS.present} strokeWidth={2} name="Present" />
                      <Line type="monotone" dataKey="Absent" stroke={COLORS.absent} strokeWidth={2} name="Absent" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartContainer>

                <ChartContainer title={`Yearly Attendance Analysis (${new Date().getFullYear()})`}>
                  <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                    <div style={{ minWidth: '600px', width: '100%', height: '320px' }}>
                      <ResponsiveContainer>
                        <BarChart data={stats.yearlyAttendanceTrend} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend iconType="circle" align="center" verticalAlign="bottom" wrapperStyle={{paddingTop: '20px'}}/>
                          {stats.courses.map((course, index) => (
                            <Bar key={course.$id} dataKey={course.Programme} stackId="a" fill={COLOR_ARRAY[index % COLOR_ARRAY.length]} name={course.Programme} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </ChartContainer>
              </>
            ) : (
              // --- MOBILE LAYOUT (screens smaller than lg) ---
              <>
                <ChartContainer title="Today's Attendance Ratio">
                  <ResponsiveContainer width="100%" height="100%">
                    {stats.todaysAttendance.total > 0 ? (
                      <PieChart>
                        <Pie data={stats.todaysPieData} cx="50%" cy="50%" labelLine={false} innerRadius="60%" outerRadius="80%" paddingAngle={5} dataKey="value">
                          {stats.todaysPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" />
                      </PieChart>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">No attendance marked today.</div>
                    )}
                  </ResponsiveContainer>
                </ChartContainer>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center">
                  <MonitorSmartphone className="w-10 h-10 mx-auto text-indigo-500 mb-3" />
                  <h3 className="text-md font-semibold text-gray-900 dark:text-white">More Analytics on Desktop</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    For detailed trends and course analysis, please view on a larger screen.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Overview;
