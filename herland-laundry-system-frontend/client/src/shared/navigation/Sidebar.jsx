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
      { label: 'Register', path: '/signup', icon: 'register' },
    ],
  },
  {
    title: 'SUPPORT',
    items: [
      { label: 'FAQs', path: '/landing', sectionId: 'faq', icon: 'question' },
      { label: 'Contact Us', path: '/landing', sectionId: 'contact', icon: 'contact' },
    ],
  },
];

const customerSections = [
  {
    title: 'MAIN',
    items: [
      { label: 'Book Now', path: '/book', icon: 'bookNow' },
      { label: 'My Bookings', path: '/user/bookings', icon: 'bookings' },
    ],
  },
  {
    title: 'UPDATES',
    items: [
      { label: 'Notifications', path: '/user/notifications', icon: 'bell', showBadge: true },
      { label: 'Chat With Us', path: 'viber://chat?number=%2B639272276218', icon: 'chat', external: true },
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
      { label: 'Dashboard', path: '/staff', icon: 'dashboard' },
      { label: 'Manage Bookings', path: '/staff/manage-bookings', icon: 'bookings' },
    ],
  },
  {
    title: 'UPDATES',
    items: [
      { label: 'Notifications', path: '/staff/notifications', icon: 'bell', showBadge: true },
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
      { label: 'Dashboard', path: '/rider/dashboard', icon: 'dashboard' },
    ],
  },
  {
    title: 'TASKS',
    items: [
      { label: 'Manage Tasks', path: '/rider/manage-tasks', icon: 'bookings' },
      { label: 'Completed Tasks', path: '/rider/completed-tasks', icon: 'completedTasks' },
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
      { label: 'Dashboard', path: '/admin', icon: 'dashboard' },
      { label: 'Manage Bookings', path: '/admin/manage-bookings', icon: 'bookings' },
      { label: 'Manage Services', path: '/admin/manage-services', icon: 'manageServices' },
      { label: 'Reports', path: '/admin/reports', icon: 'reports' },
      { label: 'Feedback Reports', path: '/admin/feedback-reports', icon: 'feedbackReports' },
    ],
  },
  {
    title: 'PEOPLE',
    items: [
      { label: 'Manage Admins', path: '/admin/manage-admins', icon: 'manageAdmins' },
      { label: 'Manage Employees', path: '/admin/manage-employees', icon: 'manageEmployees' },
      { label: 'Manage Users', path: '/admin/manage-users', icon: 'manageUsers' },
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

function getItemKey(sectionTitle, item) {
  return `${sectionTitle}-${item.label}`;
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
  const [activeItemKey, setActiveItemKey] = useState('');

  const hasSession = Boolean(session);
  const isVisitorSidebar = !hasSession;
  const isCollapsed = collapsed ?? internalCollapsed;
  const isDrawer = typeof isOpen === 'boolean';
  const isVisible = isDrawer ? isOpen : true;
  const effectiveSide = isVisitorSidebar ? 'right' : side;
  const isRightSide = effectiveSide === 'right';

  const navSections = useMemo(() => {
    const role = userProfile.role || activeRole;
    return getSectionsByRole(role, hasSession);
  }, [userProfile.role, activeRole, hasSession]);

  const flatNavItems = useMemo(() => {
    return navSections.flatMap((section) =>
      section.items.map((item) => ({
        ...item,
        key: getItemKey(section.title, item),
        sectionTitle: section.title,
      }))
    );
  }, [navSections]);

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

    const channel = supabase
      .channel('sidebar-notifications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        loadNotifications(session.access_token);
      })
      .subscribe();

    return () => {
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdated);
      supabase.removeChannel(channel);
    };
  }, [session?.access_token]);

  useEffect(() => {
    setActiveItemKey((currentKey) => {
      const currentItem = flatNavItems.find((item) => item.key === currentKey);

      if (currentItem && doesItemMatchLocation(currentItem)) {
        return currentKey;
      }

      const exactMatch = flatNavItems.find(
        (item) =>
          !item.action &&
          !item.sectionId &&
          item.path === location.pathname
      );

      if (exactMatch) {
        return exactMatch.key;
      }

      const prefixMatches = flatNavItems
        .filter(
          (item) =>
            !item.action &&
            !item.sectionId &&
            item.path &&
            location.pathname.startsWith(`${item.path}/`)
        )
        .sort((a, b) => b.path.length - a.path.length);

      if (prefixMatches.length > 0) {
        return prefixMatches[0].key;
      }

      const sectionMatch = flatNavItems.find(
        (item) =>
          !item.action &&
          item.sectionId &&
          item.path === location.pathname
      );

      return sectionMatch?.key || '';
    });
  }, [location.pathname, flatNavItems]);

  function doesItemMatchLocation(item) {
    if (!item.path) return false;

    if (item.sectionId) {
      return location.pathname === item.path;
    }

    if (item.path === '/dashboard' || item.path === '/user' || item.path === '/rider') {
      return location.pathname === item.path;
    }

    return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  }

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
    // Clear the "Keep me signed in" flag so the next login starts ephemeral by default
    window.localStorage.removeItem('keepSignedIn');

    setSession(null);
    setUserProfile({
      name: '',
      avatar: '',
      role: 'Customer',
    });
    setUnreadCount(0);
    setActiveItemKey('');

    navigate('/login');
    onClose();
  }

  function handleToggle() {
    if (isDrawer && isVisible) {
      onClose();
      return;
    }

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

  function handleItemClick(sectionTitle, item) {
    if (item.action === 'logout') {
      handleLogout();
      return;
    }

    setActiveItemKey(getItemKey(sectionTitle, item));

    if (item.external) {
      window.location.href = item.path;
      onClose();
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

  function isItemActive(sectionTitle, item) {
    return activeItemKey === getItemKey(sectionTitle, item);
  }

  return (
    <>
      {isDrawer && (
        <div
          className={`fixed inset-0 bg-black/30 transition-opacity duration-300 ${
            isVisitorSidebar ? 'lg:hidden' : ''
          } ${isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          style={{ zIndex: 39 }}
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 h-screen flex flex-col transition-all duration-300 ease-in-out ${
          isRightSide ? 'right-0' : 'left-0'
        } ${isVisitorSidebar ? 'lg:hidden' : ''} ${className}`}
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
              className="w-full flex items-center rounded-xl transition-all duration-150"
              style={{
                gap: isCollapsed ? '0px' : '12px',
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
                  display: isCollapsed ? 'none' : 'block',
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
                  const active = isItemActive(section.title, item);

                  return (
                    <button
                      key={`${section.title}-${item.label}`}
                      onClick={() => handleItemClick(section.title, item)}
                      title={isCollapsed ? item.label : undefined}
                      className="w-full flex items-center rounded-xl transition-all duration-150"
                      style={{
                        gap: isCollapsed ? '0px' : '12px',
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
                          display: isCollapsed ? 'none' : 'block',
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
              className="w-full flex items-center rounded-xl transition-all duration-150"
              style={{
                gap: isCollapsed ? '0px' : '12px',
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
                  display: isCollapsed ? 'none' : 'block',
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