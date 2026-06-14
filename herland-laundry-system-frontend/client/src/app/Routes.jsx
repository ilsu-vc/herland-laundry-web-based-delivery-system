import React, { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const Login = lazy(() => import('../features/auth/Login'))
const Signup = lazy(() => import('../features/auth/SignUp'))
const BookNow = lazy(() => import('../features/auth/BookNow'))
const PaymentForm = lazy(() => import('../features/auth/PaymentForm'))
const BookingHistory = lazy(() => import('../features/user/bookings/BookingHistory'))
const BookingDetails = lazy(() => import('../features/user/bookings/BookingDetails'))
const Feedback = lazy(() => import('../features/user/bookings/Feedback'))
const Notifications = lazy(() => import('../shared/inbox/Notifications'))
const Profile = lazy(() => import('../features/user/profile/Profile'))
const DigitalReceipt = lazy(() => import('../features/user/bookings/DigitalReceipt'))
const LandingPage = lazy(() => import('../features/landing/LandingPage'))
// Dashboard component removed; routes now resolve based on role
const RiderDashboard = lazy(() => import('../features/rider/RiderDashboard'))
const ManageTasks = lazy(() => import('../features/rider/ManageTasks'))
const CompletedTasks = lazy(() => import('../features/rider/CompletedTasks'))
const StaffDashboard = lazy(() => import('../features/staff/StaffDashboard'))
const AdminDashboard = lazy(() => import('../features/admin/AdminDashboard'))
const ManageBookings = lazy(() => import('../features/admin/ManageBookings'))
const ManageEmployees = lazy(() => import('../features/admin/ManageEmployees'))
const ManageServices = lazy(() => import('../features/admin/ManageServices'))
const ManageUsers = lazy(() => import('../features/admin/ManageUsers'))
const Reports = lazy(() => import('../features/admin/Reports'))
const FeedbackReports = lazy(() => import('../features/admin/FeedbackReports'))

const ForgotPassword = lazy(() => import('../features/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('../features/auth/ResetPassword'))
const ManageAdmins = lazy(() => import('../features/admin/ManageAdmins'))

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-4 border-[#3878c2] border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[#3878c2] font-semibold text-sm">Loading...</p>
    </div>
  </div>
)

function resolveNotificationsPathByRole() {
	const activeRole = String(window.sessionStorage.getItem('activeRole') || '').toLowerCase()

	if (activeRole === 'admin') return '/admin/notifications'
	if (activeRole === 'staff' || activeRole === 'employee') return '/staff/notifications'
	if (activeRole === 'rider') return '/rider/notifications'
	return '/user/notifications'
}

function NotificationsRoleRedirect() {
	return <Navigate to={resolveNotificationsPathByRole()} replace />
}

function resolveDashboardByRole() {
	const activeRole = String(window.sessionStorage.getItem('activeRole') || '').toLowerCase();

	if (activeRole === 'admin') return <AdminDashboard />;
	if (activeRole === 'staff' || activeRole === 'employee') return <StaffDashboard />;
	if (activeRole === 'rider') return <RiderDashboard />;
	// default for customers / guests
	return <BookingHistory />;
}

function resolveBookingsElementByRole() {
	const activeRole = String(window.sessionStorage.getItem('activeRole') || '').toLowerCase()
	if (activeRole === 'rider') return <ManageTasks />
	return <BookingHistory />
}

export default function AppRoutes() {
	return (
		<Suspense fallback={<PageLoader />}>
			<Routes>
				<Route path="/" element={<LandingPage />} />
				<Route path="/dashboard" element={resolveDashboardByRole()} />
				<Route path="/landing" element={<LandingPage />} />
				<Route path="/guest" element={<LandingPage />} />
				<Route path="/user" element={resolveDashboardByRole()} />
				<Route path="/rider" element={<RiderDashboard />} />
				<Route path="/rider/dashboard" element={<RiderDashboard />} />
				<Route path="/rider/manage-tasks" element={<ManageTasks />} />
				<Route path="/rider/tasks/active" element={<ManageTasks />} />
				<Route path="/rider/completed-tasks" element={<CompletedTasks />} />
				<Route path="/rider/tasks/completed" element={<CompletedTasks />} />
				<Route path="/staff" element={<StaffDashboard />} />
				<Route path="/staff/manage-bookings" element={<ManageBookings />} />
				<Route path="/admin" element={<AdminDashboard />} />
				<Route path="/admin/manage-bookings" element={<ManageBookings />} />
				<Route path="/admin/manage-employees" element={<ManageEmployees />} />
				<Route path="/admin/manage-admins" element={<ManageAdmins />} />
				<Route path="/admin/manage-services" element={<ManageServices />} />
				<Route path="/admin/manage-users" element={<ManageUsers />} />
				<Route path="/admin/reports" element={<Reports />} />
				<Route path="/admin/feedback-reports" element={<FeedbackReports />} />

				<Route path="/login" element={<Login />} />
				<Route path="/signup" element={<Signup />} />
				<Route path="/user/book-now" element={<BookNow />} />
				<Route path="/user/bookings" element={<BookingHistory />} />
				<Route path="/forgot-password" element={<ForgotPassword />} />
				<Route path="/reset-password" element={<ResetPassword />} />
				<Route 
					path="/book" 
					element={
						(String(window.sessionStorage.getItem('activeRole') || '').toLowerCase() === 'rider') 
							? <Navigate to="/rider" replace /> 
							: <BookNow />
					} 
				/>
				<Route 
					path="/payment" 
					element={
						(String(window.sessionStorage.getItem('activeRole') || '').toLowerCase() === 'rider') 
							? <Navigate to="/rider" replace /> 
							: <PaymentForm />
					} 
				/>
				<Route path="/bookings" element={resolveBookingsElementByRole()} />
				<Route path="/bookings/:bookingId" element={<BookingDetails />} />
				<Route path="/bookings/:bookingId/receipt" element={<DigitalReceipt />} />
				<Route path="/feedback/:bookingId" element={<Feedback />} />
				<Route path="/notifications" element={<NotificationsRoleRedirect />} />
				<Route path="/user/notifications" element={<Notifications />} />
				<Route path="/staff/notifications" element={<Notifications />} />
				<Route path="/rider/notifications" element={<Notifications />} />
				<Route path="/admin/notifications" element={<Notifications />} />
				<Route path="/profile" element={<Profile />} />
			</Routes>
		</Suspense>
	)
}