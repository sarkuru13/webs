import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Client, Databases, Query } from 'appwrite';
import QRCode from 'react-qr-code';

// --- Appwrite Configuration ---
// It's recommended to move this to a separate config file
const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '');

const databases = new Databases(client);
const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || '';
const COURSE_COLLECTION_ID = import.meta.env.VITE_APPWRITE_COURSE_COLLECTION_ID || '';
const LOCATION_COLLECTION_ID = import.meta.env.VITE_APPWRITE_LOCATION_COLLECTION_ID || '';


// --- Helper Functions for Data Fetching ---

/**
 * Fetches all courses from the Appwrite database.
 * @returns {Promise<Array>} A promise that resolves to an array of course documents.
 */
const fetchCourses = async () => {
    const response = await databases.listDocuments(DATABASE_ID, COURSE_COLLECTION_ID);
    return response.documents;
};

/**
 * Fetches the most recent location from the Appwrite database.
 * @returns {Promise<Object|null>} A promise that resolves to the latest location document or null.
 */
const fetchLatestLocation = async () => {
    const response = await databases.listDocuments(
        DATABASE_ID,
        LOCATION_COLLECTION_ID,
        [Query.orderDesc('$createdAt'), Query.limit(1)]
    );
    return response.documents.length > 0 ? response.documents[0] : null;
};


// --- Main Component ---

function CourseLinkPage() {
  // --- State Management ---
  const { programme, semester } = useParams();
  const [course, setCourse] = useState(null);
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }));

  // --- Data Fetching and Real-time Subscriptions ---
  useEffect(() => {
    let unsubscribeCourse;
    let unsubscribeLocation;

    async function initializeData() {
      try {
        setLoading(true);

        // 1. Fetch initial course data
        const courses = await fetchCourses();
        const decodedProgramme = decodeURIComponent(programme || '').toLowerCase();
        const foundCourse = courses.find(c => c.Programme.toLowerCase() === decodedProgramme);

        if (foundCourse) {
          setCourse(foundCourse);
          // Subscribe to real-time updates for this specific course
          unsubscribeCourse = client.subscribe(
            `databases.${DATABASE_ID}.collections.${COURSE_COLLECTION_ID}.documents.${foundCourse.$id}`,
            (response) => {
              // Check if the update event matches and update the course state
              if (response.events.includes(`databases.${DATABASE_ID}.collections.${COURSE_COLLECTION_ID}.documents.${foundCourse.$id}.update`)) {
                setCourse(response.payload);
              }
            }
          );
        } else {
          setError('The requested course could not be found.');
        }

        // 2. Fetch initial location data
        const latestLocation = await fetchLatestLocation();
        if (latestLocation) {
          setLocation({ latitude: latestLocation.Latitude, longitude: latestLocation.Longitude });
        }

        // Subscribe to any new document creation in the location collection
        unsubscribeLocation = client.subscribe(
          `databases.${DATABASE_ID}.collections.${LOCATION_COLLECTION_ID}.documents`,
          (response) => {
            // When a new location is created, fetch the absolute latest one again
            if (response.events.includes(`databases.${DATABASE_ID}.collections.${LOCATION_COLLECTION_ID}.documents.*.create`)) {
              fetchLatestLocation().then(newLocation => {
                if (newLocation) {
                  setLocation({ latitude: newLocation.Latitude, longitude: newLocation.Longitude });
                }
              });
            }
          }
        );

      } catch (err) {
        console.error("Data Fetching Error:", err);
        setError('Failed to load course data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    initializeData();

    // 3. Set up a timer to update the current time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }));
    }, 60000); // Update every minute

    // 4. Cleanup function to unsubscribe and clear intervals
    return () => {
      if (unsubscribeCourse) unsubscribeCourse();
      if (unsubscribeLocation) unsubscribeLocation();
      clearInterval(timeInterval);
    };
  }, [programme]); // Rerun effect if the programme parameter changes

  // --- QR Code Value Generation ---
  const qrValue = course && course.LinkStatus === 'Active'
    ? JSON.stringify({
        courseId: course.$id,
        semester: parseInt(semester, 10),
        dateTime: new Date().toISOString(),
        location: location.latitude && location.longitude ? { ...location } : null,
      })
    : '';

  // --- Render Logic ---

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-100 text-slate-600">
        <div className="w-12 h-12 border-4 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-lg font-medium">Loading Course...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                 <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-800">Error</h3>
            <p className="mt-2 text-base text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!course) {
      // This state can be hit if loading is done but the course wasn't found (and no error was thrown)
      return null;
  }

  const isLinkActive = course.LinkStatus === 'Active';

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-lg mx-auto bg-white rounded-3xl shadow-2xl shadow-slate-300/60 overflow-hidden">
        
        {/* Header Section */}
        <div className="p-8 pb-6 bg-slate-50 border-b border-slate-200 text-center">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            {course.Programme}
          </h1>
          <p className="text-lg font-medium text-indigo-600">
            Semester {semester}
          </p>
        </div>

        {/* QR Code Section */}
        <div className="p-8">
          <div className={`relative aspect-square transition-all duration-300 ease-in-out ${isLinkActive ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            {isLinkActive && (
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-md">
                <QRCode
                  value={qrValue}
                  size={512}
                  viewBox={`0 0 256 256`}
                  className="w-full h-auto"
                />
              </div>
            )}
          </div>

          {/* Inactive Link Placeholder */}
          {!isLinkActive && (
            <div className="aspect-square bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-center p-6 -mt-[calc(100%)]">
               <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
               </div>
              <p className="text-xl font-semibold text-slate-700">Link is Inactive</p>
              <p className="text-base text-slate-500">Please contact the administrator.</p>
            </div>
          )}
        </div>

        {/* Footer Section */}
        <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
            <div>
                <p className="text-sm font-medium text-slate-400">Status</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${isLinkActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {isLinkActive ? 'Active' : 'Inactive'}
                </span>
            </div>
            <div>
                <p className="text-sm font-medium text-slate-400 text-right">Current Time</p>
                <p className="text-base font-semibold text-slate-600">{currentTime}</p>
            </div>
        </div>
      </div>
    </div>
  );
}

export default CourseLinkPage;
