import React, { useState, useEffect } from 'react';
import { login, getCurrentUser, logout } from '../services/authService';
import { useNavigate } from 'react-router-dom';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [checkedSession, setCheckedSession] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const checkSession = async () => {
            try {
                const user = await getCurrentUser();
                if (user) {
                    if (user.prefs?.role === 'admin') {
                        navigate('/dashboard');
                    } else if (user.prefs?.role === 'teacher') {
                        navigate('/teacher-dashboard');
                    } else {
                        setCheckedSession(true);
                    }
                } else {
                    setCheckedSession(true);
                }
            } catch (err) {
                console.log('No active session found');
                setCheckedSession(true);
            }
        };
        checkSession();
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const user = await login(email, password);
            if (user.prefs?.role === 'admin') {
                navigate('/dashboard');
            } else if (user.prefs?.role === 'teacher') {
                navigate('/teacher-dashboard');
            } else {
                setError('Not authorized.');
                await logout();
            }
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    if (!checkedSession) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
                <svg className="animate-spin h-12 w-12 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-50 flex items-center justify-center p-4 sm:p-6 font-sans">
            <div className="w-full max-w-5xl mx-auto grid lg:grid-cols-2 rounded-3xl shadow-2xl overflow-hidden bg-white dark:bg-gray-800 transform transition-all duration-500">
                <div className="hidden lg:flex flex-col justify-center items-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-12 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDUwIDAgTCA1MCA1MCBNIDAgNTAgTCA1MCA1MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSkiIHN0cm9rZS13aWR0aD0iMSIgLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiIC8+PC9zdmc+')] opacity-10"></div>
                    <img 
                        src="/nielit.png" 
                        alt="NIELIT Tezpur Logo" 
                        className="w-40 h-40 mb-6 transform hover:scale-105 transition-transform duration-300"
                        onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/160x160/ffffff/000000?text=NIELIT'; }}
                    />
                    <h1 className="text-4xl font-bold mb-4 text-center tracking-tight">NIELIT Tezpur</h1>
                    <p className="text-xl text-indigo-100 text-center font-medium">Attendance Management System</p>
                    <p className="text-sm text-indigo-200 mt-2 text-center">Empowering efficient workforce management</p>
                </div>
                <div className="p-8 sm:p-10 lg:p-12 w-full flex flex-col justify-center">
                    <div className="lg:hidden flex flex-col justify-center items-center mb-8 text-center">
                        <img 
                            src="/nielit.png" 
                            alt="NIELIT Tezpur Logo" 
                            className="w-24 h-24 mb-4 transform hover:scale-105 transition-transform duration-300"
                            onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/96x96/000000/ffffff?text=NIELIT'; }}
                        />
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Welcome to AMS</h1>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-800 dark:text-gray-200 mb-2">Login</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm sm:text-base">Access the NIELIT Tezpur Attendance Management System</p>
                    {error && (
                        <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-lg mb-6 animate-fade-in" role="alert">
                            <div className="flex items-center">
                                <svg className="h-5 w-5 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p>{error}</p>
                            </div>
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="relative">
                            <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Email Address
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1fono-2.06 0L2 7" />
                                    </svg>
                                </span>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-300 placeholder-gray-400 dark:placeholder-gray-500 hover:border-blue-400"
                                    placeholder="Enter your email"
                                />
                            </div>
                        </div>
                        <div className="relative">
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                </span>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-300 placeholder-gray-400 dark:placeholder-gray-500 hover:border-blue-400"
                                    placeholder="Enter your password"
                                />
                            </div>
                        </div>
                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center items-center py-3 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all duration-300 dark:focus:ring-offset-gray-800 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                {isLoading ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                )}
                                {isLoading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </div>
                    </form>
                    <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
                        <p className="font-medium">National Institute of Electronics & Information Technology</p>
                        <p>Tezpur, Assam</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;