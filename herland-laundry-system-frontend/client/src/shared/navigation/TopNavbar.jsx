import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { getRoleNavigation } from './navItems';
import { supabase } from '../../lib/supabase';

export default function TopNavbar({
  showBack = false,
  rightContent = null,
  className = '',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeRole = window.sessionStorage.getItem('activeRole');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const navItems = getRoleNavigation(location.pathname);
  
  // Draggable Scroll Logic
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [dragMoved, setDragMoved] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [navItems]);

  const scrollLeftByArrow = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -250, behavior: 'smooth' });
    }
  };

  const scrollRightByArrow = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 250, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragMoved(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    if (Math.abs(walk) > 5) {
      setDragMoved(true);
    }
    scrollRef.current.scrollLeft = scrollLeft - walk;
    checkScroll();
  };

  const onNavItemClick = (e, item) => {
    // Prevent navigation if the user was dragging
    if (dragMoved) {
      e.preventDefault();
      return;
    }
    handleNavItemClick(item);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
    });

    return () => authSubscription.unsubscribe();
  }, []);

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

  const handleNavItemClick = (item) => {
    if (!item.sectionId) {
      if (item.path === '/' && (location.pathname === '/' || location.pathname === '/landing')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      navigate(item.path);
      return;
    }

    if (location.pathname !== '/' && location.pathname !== '/landing') {
      navigate('/');
      setTimeout(() => {
        const section = document.getElementById(item.sectionId);
        if (section) {
          const navbarHeight = 80; // Height of the fixed navbar
          const elementPosition = section.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - navbarHeight;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 100);
      return;
    }

    const section = document.getElementById(item.sectionId);
    if (section) {
      const navbarHeight = 80; // Height of the fixed navbar
      const elementPosition = section.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navbarHeight;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className={`sticky top-0 z-50 bg-[#1a232e] shadow-sm ${className}`}>
      <style>{`
        .nav-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #5299bf transparent;
        }
        .nav-scrollbar::-webkit-scrollbar {
          height: 6px !important;
        }
        .nav-scrollbar::-webkit-scrollbar-track {
          background: transparent !important;
        }
        .nav-scrollbar::-webkit-scrollbar-thumb {
          background-color: #5299bf !important;
          border-radius: 10px !important;
        }
        .nav-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #4081a3 !important;
        }
        .nav-scrollbar::-webkit-scrollbar-button {
          display: none !important;
        }
      `}</style>
      <div className="navbar w-full max-w-[1400px] mx-auto px-5 sm:px-6 md:px-8 xl:px-10 flex items-center h-20">
        <div className="flex-1 flex items-center overflow-hidden">
          {showBack ? (
            <button
              type="button"
              onClick={() => {
                const role = activeRole?.toLowerCase();
                if (role === 'staff' || location.pathname.startsWith('/staff')) {
                  navigate('/staff');
                } else if (role === 'rider' || location.pathname.startsWith('/rider')) {
                  navigate('/rider');
                } else {
                  navigate(-1);
                }
              }}
              className="btn btn-ghost btn-square"
              aria-label="Go back"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="#3878c2"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </button>
          ) : (
            <div className="flex items-center w-full">
              {/* Mobile Logo */}
              <button
                type="button"
                onClick={() => navigate('/')}
                className="btn btn-ghost px-0 lg:hidden shrink-0"
                aria-label="Go to landing page"
              >
                <img
                  src="/images/SecondaryLogo.png"
                  alt="Herland Laundry"
                  className="h-10"
                />
              </button>

              {/* Desktop Nav */}
              <div className="hidden lg:flex items-center w-full min-w-0">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="btn btn-ghost px-0 shrink-0 mr-6 xl:mr-8 -ml-2 md:-ml-4"
                  aria-label="Go to landing page"
                >
                  <img
                    src="/images/SecondaryLogo.png"
                    alt="Herland Laundry"
                    className="h-10"
                  />
                </button>

                <div className="flex-1 flex items-center min-w-0 relative group">
                  {canScrollLeft && (
                    <button
                      type="button"
                      onClick={scrollLeftByArrow}
                      className="absolute left-0 z-10 flex h-8 w-8 -translate-x-3 items-center justify-center rounded-full bg-white shadow-md text-[#3878c2] hover:bg-gray-50 border border-gray-100 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                  )}

                  <div 
                    ref={scrollRef}
                    onScroll={checkScroll}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    className={`flex-1 flex items-center justify-start gap-x-2 sm:gap-x-4 md:gap-x-6 px-4 overflow-x-auto nav-scrollbar pb-2 pt-2 flex-nowrap ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none active:cursor-grabbing`}
                  >
                    {navItems.filter(item => (!item.requiresAuth || session) && (!item.requiresGuest || !session)).map((item) => (
                      <button
                        key={`${item.label}-${item.path}`}
                        type="button"
                        onClick={(e) => onNavItemClick(e, item)}
                        className="btn btn-ghost text-[#3878c2] px-4 text-[15px] font-medium whitespace-nowrap transition-all duration-200 hover:scale-105 shrink-0 xl:first:ml-auto xl:last:mr-auto flex items-center gap-1.5"
                      >
                        {item.label}
                        {item.label === 'Notifications' && unreadCount > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3878c2] text-[10px] font-bold text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {canScrollRight && (
                    <button
                      type="button"
                      onClick={scrollRightByArrow}
                      className="absolute right-0 z-10 flex h-8 w-8 translate-x-3 items-center justify-center rounded-full bg-white shadow-md text-[#3878c2] hover:bg-gray-50 border border-gray-100 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Section (Hamburger / Actions) */}
        <div className="flex-none flex items-center gap-2">
          {rightContent ? (
            rightContent
          ) : (
            <button
              className="btn btn-square btn-ghost"
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="#3878c2"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
}
