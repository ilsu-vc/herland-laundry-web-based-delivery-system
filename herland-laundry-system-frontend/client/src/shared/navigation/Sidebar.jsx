import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getRoleNavigation } from './navItems';
import { supabase } from '../../lib/supabase';

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/customer`;

export default function Sidebar({
    variant = 'drawer',
    isOpen = false,
    onClose = () => { },
    className = '',
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const activeRole = window.sessionStorage.getItem('activeRole');
    const navItems = getRoleNavigation(location.pathname);
    const [userProfile, setUserProfile] = useState({ name: 'User', avatar: null });
    const [session, setSession] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUserProfile = useCallback(async () => {
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            setSession(currentSession);
            if (!currentSession) return;

            const response = await fetch(`${API_BASE}/profile`, {
                headers: {
                    'Authorization': `Bearer ${currentSession.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUserProfile({
                    name: data.full_name || 'User',
                    avatar: data.avatar_url
                });
            }
        } catch (error) {
            console.error('Error fetching sidebar profile:', error);
        }
    }, [supabase]);

    useEffect(() => {
        // Initial fetch
        fetchUserProfile();

        // Listen for auth changes
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
                fetchUserProfile();
            }
        });

        // Listen for internal profile updates
        const handleProfileUpdate = () => {
            fetchUserProfile();
        };
        window.addEventListener('profileUpdated', handleProfileUpdate);

        return () => {
            authSubscription.unsubscribe();
            window.removeEventListener('profileUpdated', handleProfileUpdate);
        };
    }, [fetchUserProfile]);

    useEffect(() => {
        const fetchUnreadCount = async () => {
            if (!session?.access_token) return;
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/notifications`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setUnreadCount(data.filter(n => !n.is_read).length);
                }
            } catch (err) {}
        };

        fetchUnreadCount();
        window.addEventListener('notificationsUpdated', fetchUnreadCount);
        return () => window.removeEventListener('notificationsUpdated', fetchUnreadCount);
    }, [session, location.pathname]);

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            // Clear any local storage if used by the app explicitly
            window.sessionStorage.removeItem('activeRole');

            navigate('/login');
            onClose();
        } catch (error) {
            console.error('Logout error:', error.message);
        }
    };

    const isActivePath = (path) => {
        if (path === '/landing') {
            return location.pathname === '/landing' || location.pathname === '/guest';
        }

        if (path === '/dashboard') {
            return location.pathname === '/dashboard' || location.pathname === '/user';
        }

        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    const handleNavItemClick = (item) => {
        if (!item.sectionId) {
            if (item.path === '/landing' && location.pathname === '/landing') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                navigate(item.path);
            }
            onClose();
            return;
        }

        navigate('/landing');
        setTimeout(() => {
            const section = document.getElementById(item.sectionId);
            if (section) {
                section.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);
        onClose();
    };

    const ProfileSection = () => (
        <div
            onClick={() => { navigate('/profile'); onClose(); }}
            className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-[#63bce6]/10 transition-colors border-b border-gray-100 mb-2"
        >
            <div className="h-10 w-10 flex-none rounded-full bg-[#f0f6ff] overflow-hidden border border-[#3878c2]/20">
                {userProfile.avatar ? (
                    <img src={userProfile.avatar} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-[#3878c2]">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                        </svg>
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#3878c2] truncate">{userProfile.name}</p>
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">View Profile</p>
            </div>
        </div>
    );

    if (variant === 'desktop') {
        return (
            <aside className={`hidden lg:block ${className}`}>
                <div className="sticky top-20">
                    <div className="rounded-2xl bg-white p-2 shadow-sm border border-gray-100 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-hide pb-20">
                        {session && <ProfileSection />}
                        <div className="space-y-1">
                            {navItems.filter(item => (!item.requiresAuth || session) && (!item.requiresGuest || !session)).map((item) => {
                                const isActive = isActivePath(item.path);
                                return (
                                    <button
                                        key={`${item.label}-${item.path}`}
                                        type="button"
                                        onClick={() => handleNavItemClick(item)}
                                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${isActive
                                            ? 'bg-[#63bce6]/20 text-[#3878c2]'
                                            : 'text-[#3878c2] hover:bg-[#63bce6]/10'
                                            }`}
                                    >
                                        {item.icon ? (
                                            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#f0f6ff] text-[#3878c2]">
                                                {item.icon}
                                            </span>
                                        ) : null}
                                        <span className="whitespace-nowrap">{item.label}</span>
                                        {item.label === 'Notifications' && unreadCount > 0 && (
                                            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#3878c2] text-[10px] font-bold text-white">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}

                            {session && (
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                                >
                                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-red-50 text-red-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                                        </svg>
                                    </span>
                                    <span className="whitespace-nowrap">Logout</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </aside>
        );
    }

    return (
        <>
            {/* Overlay */}
            <div
                className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={`fixed top-0 right-0 h-full w-64 bg-white z-50 shadow-lg transform transition-transform overflow-y-auto scrollbar-hide pb-24 ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Logo */}
                <div className="p-4 border-b border-gray-200">
                    <img
                        src="/images/PrimaryLogo.png"
                        alt="Herland Laundry"
                        className="w-32 mx-auto"
                    />
                </div>

                {session && <ProfileSection />}

                {/* Menu */}
                <nav className="py-2 space-y-1">
                    {navItems.filter(item => (!item.requiresAuth || session) && (!item.requiresGuest || !session)).map((item) => (
                        <button
                            key={`${item.label}-${item.path}`}
                            onClick={() => handleNavItemClick(item)}
                            className="flex w-full items-center gap-3 px-6 py-3 text-left text-[#3878c2] font-semibold hover:bg-[#3878c2]/10 transition text-sm"
                        >
                            {item.icon ? <span className="text-[#3878c2]">{item.icon}</span> : null}
                            <span>{item.label}</span>
                            {item.label === 'Notifications' && unreadCount > 0 && (
                                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#3878c2] text-[10px] font-bold text-white">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </button>
                    ))}

                    {session && (
                        <button
                            onClick={handleLogout}
                            className="flex w-full items-center gap-3 px-6 py-3 text-left text-red-600 font-semibold hover:bg-red-50 transition text-sm"
                        >
                            <span className="text-red-600">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                                </svg>
                            </span>
                            <span>Logout</span>
                        </button>
                    )}
                </nav>
            </div>
        </>
    );
}
