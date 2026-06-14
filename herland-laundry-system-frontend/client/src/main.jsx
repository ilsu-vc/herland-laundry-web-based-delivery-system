import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { useLocation, useNavigate } from 'react-router-dom'

import Sidebar from './shared/navigation/Sidebar'
import TopNavbar from './shared/navigation/TopNavbar'
import { useLayout } from './app/LayoutContext'
import AppRoutes from './app/Routes'
import Providers from './app/Providers'
import './index.css'
import 'flowbite'

import { supabase } from './lib/supabase'

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const isLoginRoute = location.pathname === '/login'
  const isSignupRoute = location.pathname === '/signup'
  const isForgotPasswordRoute = location.pathname === '/forgot-password'
  const isResetPasswordRoute = location.pathname === '/reset-password'
  const isLandingRoute = location.pathname === '/' || location.pathname === '/landing' || location.pathname === '/guest'
  const isRoleSwitcherRoute = location.pathname === '/role-switcher'
  const isAuthPage = isForgotPasswordRoute || isResetPasswordRoute
  const isPublicRoute = isLandingRoute || isLoginRoute || isSignupRoute || isRoleSwitcherRoute
  const { hideBottomNav } = useLayout()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false)

  const isManagerRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff')
  const shouldHideBottomNav = hideBottomNav || isLoginRoute || isSignupRoute || isManagerRoute
  const shouldShowDesktopSidebar = !isPublicRoute && !isAuthPage
  const shouldShowDesktopTopNavbar = isLandingRoute || isLoginRoute || isSignupRoute

  useEffect(() => {
    const syncSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Session error:', error.message)
        if (error.message.includes('Refresh Token') || error.message.includes('refresh token')) {
          await supabase.auth.signOut().catch(() => {})
          window.sessionStorage.removeItem('activeRole')
          navigate('/login', { replace: true })
          return
        }
      }

      if (session) {
        let role = window.sessionStorage.getItem('activeRole')

        // If we have a session but NO role in storage, fetch it from profile
        if (!role) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()

          role = profile?.role || 'Customer'
          window.sessionStorage.setItem('activeRole', role)
        }

        // Auto-redirect authenticated users away from public landing/auth pages
        // But NOT if they are on the reset-password or forgot-password page
        if (isPublicRoute && !isRoleSwitcherRoute && !isAuthPage) {
          const dashboardMap = {
            'Admin': '/admin',
            'Staff': '/staff',
            'Rider': '/rider',
            'Customer': '/dashboard'
          }
          navigate(dashboardMap[role] || '/dashboard', { replace: true })
        }
      } else {
        // Clear role if no session
        window.sessionStorage.removeItem('activeRole')
      }
    }

    syncSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        window.sessionStorage.removeItem('activeRole')
        navigate('/', { replace: true })
      } else if (event === 'PASSWORD_RECOVERY') {
        // User clicked the reset link from their email — send them to the reset form
        navigate('/reset-password', { replace: true })
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        syncSession()
      }
    })

    // ── Global 401 Interceptor ──────────────────────────────────────
    // If any API call returns 401, the session is dead. Auto-sign out
    // and redirect to login instead of showing a broken dashboard.
    const originalFetch = window.fetch
    let isLoggingOut = false

    window.fetch = async (...args) => {
      const response = await originalFetch(...args)

      if (response.status === 401 && !isLoggingOut) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
        // Only intercept our own API calls, not third-party requests
        if (url.includes('/api/v1/')) {
          isLoggingOut = true
          console.warn('[Session] Token expired or invalid. Signing out automatically.')
          window.sessionStorage.removeItem('activeRole')
          await supabase.auth.signOut().catch(() => {})
          navigate('/login', { replace: true })
          // Reset flag after a short delay to allow the redirect to complete
          setTimeout(() => { isLoggingOut = false }, 3000)
        }
      }

      return response
    }

    return () => {
      subscription.unsubscribe()
      window.fetch = originalFetch // restore original fetch on unmount
    }
  }, [location.pathname, navigate, isPublicRoute, isRoleSwitcherRoute])

  useEffect(() => {
    // Keep URL in sync with role for direct navigation
    if (location.pathname.startsWith('/staff')) {
      window.sessionStorage.setItem('activeRole', 'Staff')
    } else if (location.pathname.startsWith('/rider')) {
      window.sessionStorage.setItem('activeRole', 'Rider')
    } else if (location.pathname.startsWith('/admin')) {
      window.sessionStorage.setItem('activeRole', 'Admin')
    }

    // Reset window scroll position to the top whenever the page changes
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className={`min-h-screen bg-white ${isLoginRoute ? 'h-screen overflow-hidden' : ''}`}>
      {shouldShowDesktopSidebar && (
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((current) => !current)}
          className="max-lg:hidden"
        />
      )}

      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        className="lg:hidden"
        showCollapse={false}
        side="right"
      />

      <div
        className={`min-h-screen transition-all duration-300 ease-in-out ${
          shouldShowDesktopSidebar
            ? isSidebarCollapsed
              ? 'lg:ml-[72px] lg:w-[calc(100%-72px)]'
              : 'lg:ml-[256px] lg:w-[calc(100%-256px)]'
            : 'lg:ml-0 lg:w-full'
        }`}
      >
        <TopNavbar
          onMenuClick={() => setIsMobileSidebarOpen((current) => !current)}
          className={shouldShowDesktopTopNavbar ? '' : 'lg:hidden'}
        />

        <div
          className={`mx-auto w-full ${
            isLandingRoute
              ? 'max-w-none px-0'
              : 'max-w-none px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8'
          } ${isLoginRoute ? '' : 'pb-24 lg:pb-10'}`}
        >
          <div className="min-w-0">
            <AppRoutes />
          </div>
        </div>

        {!shouldHideBottomNav && (
          <div className="lg:hidden">

          </div>
        )}
      </div>
    </div>
  )
}

function AppRoot() {
  return (
    <React.StrictMode>
      <Providers>
        <AppShell />
      </Providers>
    </React.StrictMode>
  )
}

ReactDOM.createRoot(document.getElementById('app')).render(<AppRoot />)