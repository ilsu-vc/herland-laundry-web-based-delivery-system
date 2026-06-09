import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import NavbarIcon from './NavbarIcons';

const primaryLogoSrc = '/images/PrimaryLogo.png';
const secondaryLogoSrc = '/images/SecondaryLogo.png';

const Colors = {
  white: '#ffffff',
  blue: '#3878C2',
  blueMuted: '#5D7FA3',
  skyFaint: '#EEF7FD',
  skyBd: '#D7ECFA',
};

const API_URL = import.meta.env.VITE_API_URL;

const visitorSections = [
  {
    title: 'MAIN',
    items: [
      { label: 'Home', path: '/landing', icon: 'home' },
      { label: 'How It Works', path: '/landing', sectionId: 'how-it-works', icon: 'howItWorks' },
      { label: 'Services', path: '/landing', sectionId: 'services', icon: 'landingServices' },
    ],
  },
  {
    title: 'GET STARTED',
    items: [
      { label: 'Login', path: '/login', icon: 'login' },
      { label: 'Register', path: '/register', icon: 'register' },
    ],
  },
  {
    title: 'SUPPORT',
    items: [
      { label: 'FAQs', path: '/landing', sectionId: 'faqs', icon: 'question' },
      { label: 'Contact Us', path: '/landing', sectionId: 'contact-us', icon: 'contact' },
    ],
  },
];

const customerSections = [
  {
    title: 'MAIN',
    items: [
      { label: 'Home', path: '/user', icon: 'home' },
      { label: 'Book Now', path: '/user/book-now', icon: 'bookNow' },
      { label: 'My Bookings', path: '/user/bookings', icon: 'bookings' },
    ],
  },
  {
    title: 'UPDATES',
    items: [
      { label: 'Notifications', path: '/user/notifications', icon: 'bell', showBadge: true },
      { label: 'Chat With Us', path: '/user/chat', icon: 'chat' },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { label: 'My Profile', path: '/profile', icon: 'profile' },
      { label: 'Log Out', action: 'logout', icon: 'logout' },
    ],
  },
];

const staffSections = [
  {
    title: 'MAIN',
    items: [
      { label: 'Home', path: '/dashboard', icon: 'home' },
      { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
      { label: 'Manage Bookings', path: '/dashboard/bookings', icon: 'bookings' },
    ],
  },
  {
    title: 'UPDATES',
    items: [
      { label: 'Notifications', path: '/dashboard/notifications', icon: 'bell', showBadge: true },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { label: 'My Profile', path: '/profile', icon: 'profile' },
      { label: 'Log Out', action: 'logout', icon: 'logout' },
    ],
  },
];

const riderSections = [
  {
    title: 'MAIN',
    items: [
      { label: 'Home', path: '/rider', icon: 'home' },
      { label: 'Dashboard', path: '/rider/dashboard', icon: 'dashboard' },
    ],
  },
  {
    title: 'TASKS',
    items: [
      { label: 'Active Tasks', path: '/rider/tasks/active', icon: 'bookings' },
      { label: 'Completed Tasks', path: '/rider/tasks/completed', icon: 'completedTasks' },
    ],
  },
  {
    title: 'UPDATES',
    items: [
      { label: 'Notifications', path: '/rider/notifications', icon: 'bell', showBadge: true },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { label: 'My Profile', path: '/profile', icon: 'profile' },
      { label: 'Log Out', action: 'logout', icon: 'logout' },
    ],
  },
];

const adminSections = [
  {
    title: 'MAIN',
    items: [
      { label: 'Home', path: '/dashboard', icon: 'home' },
      { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
      { label: 'Manage Bookings', path: '/dashboard/bookings', icon: 'bookings' },
      { label: 'Manage Services', path: '/dashboard/services', icon: 'manageServices' },
      { label: 'Reports', path: '/dashboard/reports', icon: 'reports' },
    ],
  },
  {
    title: 'PEOPLE',
    items: [
      { label: 'Manage Admins', path: '/dashboard/admins', icon: 'manageAdmins' },
      { label: 'Manage Employees', path: '/dashboard/employees', icon: 'manageEmployees' },
      { label: 'Manage Users', path: '/dashboard/users', icon: 'manageUsers' },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { label: 'My Profile', path: '/profile', icon: 'profile' },
      { label: 'Log Out', action: 'logout', icon: 'logout' },
    ],
  },
];

function getSectionsByRole(role, hasSession) {
  if (!hasSession) return visitorSections;

  const normalizedRole = String(role || 'Customer').toLowerCase();

  if (normalizedRole === 'admin') return adminSections;
  if (normalizedRole === 'rider') return riderSections;
  if (normalizedRole === 'staff' || normalizedRole === 'employee') return staffSections;

  return customerSections;
}

export default function Sidebar({
  collapsed,
  onToggle,
  isOpen,
  onClose = () => {},
  className = '',
  showCollapse = true,
  side = 'left',
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [activeRole, setActiveRole] = useState(
    sessionStorage.getItem('activeRole') || 'Customer'
  );
  const [userProfile, setUserProfile] = useState({
    name: '',
    avatar: '',
    role: 'Customer',
  });
  const [unreadCount, setUnreadCount] = useState(0);

  const hasSession = Boolean(session);
  const isCollapsed = collapsed ?? internalCollapsed;
  const isDrawer = typeof isOpen === 'boolean';
  const isVisible = isDrawer ? isOpen : true;
  const isRightSide = side === 'right';

  const navSections = useMemo(() => {
    const role = userProfile.role || activeRole;
    return getSectionsByRole(role, hasSession);
  }, [userProfile.role, activeRole, hasSession]);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      const currentSession = data?.session || null;

      if (!isMounted) return;

      setSession(currentSession);

      const storedRole = sessionStorage.getItem('activeRole');
      if (storedRole) setActiveRole(storedRole);

      if (currentSession?.access_token) {
        await loadProfile(currentSession.access_token);
        await loadNotifications(currentSession.access_token);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (!newSession) {
        setUserProfile({
          name: '',
          avatar: '',
          role: 'Customer',
        });
        setUnreadCount(0);
        return;
      }

      loadProfile(newSession.access_token);
      loadNotifications(newSession.access_token);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.access_token) return undefined;

    const handleNotificationsUpdated = () => {
      loadNotifications(session.access_token);
    };

    window.addEventListener('notificationsUpdated', handleNotificationsUpdated);
    return () => window.removeEventListener('notificationsUpdated', handleNotificationsUpdated);
  }, [session?.access_token]);

  async function loadProfile(accessToken) {
    try {
      if (!API_URL) {
        console.warn('VITE_API_URL is missing.');
        return;
      }

      const response = await fetch(`${API_URL}/api/v1/customer/profile`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();

      setUserProfile({
        name: data.full_name || data.email || 'User',
        avatar: data.avatar_url || '',
        role: data.role || sessionStorage.getItem('activeRole') || 'Customer',
      });

      if (data.role) {
        sessionStorage.setItem('activeRole', data.role);
        setActiveRole(data.role);
      }
    } catch (error) {
      console.error('Failed to load sidebar profile:', error);
    }
  }

  async function loadNotifications(accessToken) {
    try {
      if (!API_URL) return;

      const response = await fetch(`${API_URL}/api/v1/notifications`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      const notifications = Array.isArray(data) ? data : data.notifications || [];

      setUnreadCount(notifications.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    sessionStorage.removeItem('activeRole');

    setSession(null);
    setUserProfile({
      name: '',
      avatar: '',
      role: 'Customer',
    });
    setUnreadCount(0);

    navigate('/login');
    onClose();
  }

  function handleToggle() {
    if (onToggle) {
      onToggle();
      return;
    }

    setInternalCollapsed((current) => !current);
  }

  function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);

    if (section) {
      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }

  function handleItemClick(item) {
    if (item.action === 'logout') {
      handleLogout();
      return;
    }

    if (item.sectionId) {
      if (location.pathname !== item.path) {
        navigate(item.path);

        setTimeout(() => {
          scrollToSection(item.sectionId);
        }, 100);

        onClose();
        return;
      }

      scrollToSection(item.sectionId);
      onClose();
      return;
    }

    navigate(item.path);
    onClose();
  }

  function isItemActive(item) {
    if (!item.path) return false;

    if (item.sectionId) {
      return location.pathname === item.path;
    }

    if (item.path === '/dashboard' || item.path === '/user' || item.path === '/rider') {
      return location.pathname === item.path;
    }

    return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  }

  return (
    <>
      {isDrawer && (
        <div
          className={`fixed inset-0 bg-black/30 transition-opacity duration-300 ${
            isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          style={{ zIndex: 39 }}
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 h-screen flex flex-col transition-all duration-300 ease-in-out ${
          isRightSide ? 'right-0' : 'left-0'
        } ${className}`}
        style={{
          width: isCollapsed ? '72px' : '256px',
          background: Colors.white,
          borderLeft: isRightSide ? `1px solid ${Colors.skyBd}` : undefined,
          borderRight: isRightSide ? undefined : `1px solid ${Colors.skyBd}`,
          boxShadow: isRightSide
            ? '-4px 0 24px rgba(56,120,194,0.05)'
            : '4px 0 24px rgba(56,120,194,0.05)',
          transform: isVisible
            ? 'translateX(0)'
            : `translateX(${isRightSide ? '100%' : '-100%'})`,
          zIndex: 40,
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-center px-4 py-8 overflow-hidden"
          style={{ minHeight: '88px' }}
        >
          <img
            src={isCollapsed ? primaryLogoSrc : secondaryLogoSrc}
            alt="Herland Laundry"
            className="transition-all duration-300 ease-in-out"
            style={{
              height: isCollapsed ? '32px' : '48px',
              width: 'auto',
              objectFit: 'contain',
            }}
          />
        </div>

        {/* User Profile */}
        {hasSession && (
          <div className="px-2 pb-4 overflow-hidden">
            <button
              onClick={() => {
                navigate('/profile');
                onClose();
              }}
              title={isCollapsed ? userProfile.name || 'My Profile' : undefined}
              className="w-full flex items-center gap-3 rounded-xl transition-all duration-150"
              style={{
                padding: isCollapsed ? '10px 0' : '10px 12px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                background: Colors.skyFaint,
                color: Colors.blue,
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                style={{
                  background: Colors.white,
                  border: `1px solid ${Colors.skyBd}`,
                }}
              >
                {userProfile.avatar ? (
                  <img
                    src={userProfile.avatar}
                    alt={userProfile.name || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <NavbarIcon name="profile" />
                )}
              </div>

              <div
                className="min-w-0 text-left overflow-hidden transition-all duration-300"
                style={{
                  maxWidth: isCollapsed ? '0px' : '160px',
                  opacity: isCollapsed ? 0 : 1,
                }}
              >
                <p
                  className="truncate"
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: Colors.blue,
                  }}
                >
                  {userProfile.name || 'User'}
                </p>

                <p
                  className="truncate"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: Colors.blueMuted,
                  }}
                >
                  {userProfile.role || activeRole || 'Customer'}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
          {navSections.map((section) => (
            <div key={section.title} className="mb-6">
              <div
                className="px-3 mb-2 overflow-hidden transition-all duration-300"
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: Colors.blueMuted,
                  letterSpacing: '0.1em',
                  opacity: isCollapsed ? 0 : 1,
                  height: isCollapsed ? '0px' : '24px',
                  marginBottom: isCollapsed ? '0px' : '8px',
                }}
              >
                {section.title}
              </div>

              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isItemActive(item);

                  return (
                    <button
                      key={`${section.title}-${item.label}`}
                      onClick={() => handleItemClick(item)}
                      title={isCollapsed ? item.label : undefined}
                      className="w-full flex items-center gap-3 rounded-xl transition-all duration-150"
                      style={{
                        padding: isCollapsed ? '10px 0' : '10px 12px',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        background: active ? Colors.skyFaint : 'transparent',
                        color: active ? Colors.blue : Colors.blueMuted,
                        fontWeight: active ? 600 : 500,
                        fontSize: '0.9375rem',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = Colors.skyFaint;
                          e.currentTarget.style.color = Colors.blue;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = Colors.blueMuted;
                        }
                      }}
                    >
                      <span className={active ? 'opacity-100' : 'opacity-70'}>
                        <NavbarIcon name={item.icon} />
                      </span>

                      <span
                        className="overflow-hidden whitespace-nowrap transition-all duration-300 flex-1 text-left"
                        style={{
                          maxWidth: isCollapsed ? '0px' : '160px',
                          opacity: isCollapsed ? 0 : 1,
                        }}
                      >
                        {item.label}
                      </span>

                      {!isCollapsed && item.showBadge && unreadCount > 0 && (
                        <span
                          className="min-w-5 h-5 rounded-full flex items-center justify-center text-xs"
                          style={{
                            background: Colors.blue,
                            color: Colors.white,
                            fontWeight: 700,
                            padding: '0 6px',
                          }}
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sticky Collapse Button */}
        {showCollapse && (
          <div
            className="shrink-0 px-2 py-4"
            style={{ borderTop: `1px solid ${Colors.skyBd}` }}
          >
            <button
              onClick={handleToggle}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="w-full flex items-center gap-3 rounded-xl transition-all duration-150"
              style={{
                padding: isCollapsed ? '10px 0' : '10px 12px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                background: 'transparent',
                color: Colors.blueMuted,
                fontSize: '0.9375rem',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = Colors.skyFaint;
                e.currentTarget.style.color = Colors.blue;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = Colors.blueMuted;
              }}
            >
              <NavbarIcon name={isCollapsed ? 'chevronRight' : 'chevronLeft'} />

              <span
                className="overflow-hidden whitespace-nowrap transition-all duration-300"
                style={{
                  maxWidth: isCollapsed ? '0px' : '160px',
                  opacity: isCollapsed ? 0 : 1,
                }}
              >
                Collapse
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
