import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../../lib/supabase'

const C = {
	blue:      '#3878c2',
	green:     '#4bad40',
	sky:       '#63bce6',
	bg:        '#ffffff',
	skyBd:     'rgba(99,188,230,0.28)',
	blueMuted: '#6b8bae',
	white:     '#ffffff',
	red:       '#e55353',
	grayText:  '#b4b4b4',
}

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/notifications`

const FILTERS = ['Today', 'Unread', 'All']

const ICONS = {
	bell: (
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width={20} height={20}>
			<path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
		</svg>
	),
	trash: (
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width={17} height={17}>
			<path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
		</svg>
	),
}

const formatNotificationTime = (dateValue) => {
	if (!dateValue) return ''

	const date = new Date(dateValue)

	if (Number.isNaN(date.getTime())) return ''

	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	})
}

const mapNotification = (item) => ({
	id: item.id,
	title: item.title || 'Notification',
	message: item.message || '',
	created_at: item.created_at,
	time: formatNotificationTime(item.created_at),
	read: Boolean(item.is_read),
})

export default function Notifications() {
	const navigate = useNavigate()
	const [filter, setFilter] = useState('Today')
	const [notifications, setNotifications] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')
	const [deleteTargetId, setDeleteTargetId] = useState(null)

	const getToken = useCallback(async () => {
		const {
			data: { session },
		} = await supabase.auth.getSession()

		return session?.access_token
	}, [])

	const fetchNotifications = useCallback(async () => {
		setIsLoading(true)
		setError('')

		try {
			const token = await getToken()

			if (!token) {
				setNotifications([])
				setError('Please log in to view your notifications.')
				return
			}

			const response = await fetch(API_BASE, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			if (!response.ok) {
				throw new Error('Failed to fetch notifications.')
			}

			const data = await response.json()
			const notificationList = Array.isArray(data) ? data : data.notifications || []

			setNotifications(notificationList.map(mapNotification))
		} catch (err) {
			console.error('Fetch notifications error:', err)
			setError('Unable to load notifications.')
			setNotifications([])
		} finally {
			setIsLoading(false)
		}
	}, [getToken])

	useEffect(() => {
		fetchNotifications()

		const channel = supabase
			.channel('notifications-changes')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
				fetchNotifications()
			})
			.subscribe()

		return () => {
			supabase.removeChannel(channel)
		}
	}, [fetchNotifications])

	const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

	const todayUnreadCount = useMemo(() => {
		const today = new Date().toDateString()
		return notifications.filter(n => !n.read && new Date(n.created_at).toDateString() === today).length
	}, [notifications])

	const filtered = useMemo(() => {
		if (filter === 'Unread') return notifications.filter(n => !n.read)

		if (filter === 'Today') {
			const today = new Date().toDateString()
			return notifications.filter(n => new Date(n.created_at).toDateString() === today)
		}

		return notifications
	}, [filter, notifications])

	const getChipCount = (chip) => {
		if (chip === 'Today') return todayUnreadCount
		if (chip === 'Unread') return unreadCount
		if (chip === 'All') return unreadCount
		return 0
	}

	const toggleNotificationRead = async (id) => {
		const item = notifications.find(n => n.id === id)

		if (!item) return

		const nextReadState = !item.read
		const previousNotifications = notifications

		setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: nextReadState } : n))

		try {
			const token = await getToken()

			if (!token) {
				throw new Error('No auth token found.')
			}

			const response = await fetch(`${API_BASE}/${id}/${nextReadState ? 'read' : 'unread'}`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			if (!response.ok) {
				throw new Error(`Failed to mark notification as ${nextReadState ? 'read' : 'unread'}.`)
			}
		} catch (err) {
			console.error('Toggle notification read error:', err)

			setNotifications(previousNotifications)
			setError(`Unable to mark notification as ${nextReadState ? 'read' : 'unread'}.`)
		}
	}

	const markAllRead = async () => {
		if (unreadCount === 0) return

		const previousNotifications = notifications

		setNotifications(prev => prev.map(n => ({ ...n, read: true })))

		try {
			const token = await getToken()

			if (!token) {
				throw new Error('No auth token found.')
			}

			const response = await fetch(`${API_BASE}/read-all`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			if (!response.ok) {
				throw new Error('Failed to mark all notifications as read.')
			}
		} catch (err) {
			console.error('Mark all notifications read error:', err)

			setNotifications(previousNotifications)
			setError('Unable to mark all notifications as read.')
		}
	}

	const requestDeleteNotification = (id) => {
		setDeleteTargetId(id)
	}

	const cancelDeleteNotification = () => {
		setDeleteTargetId(null)
	}

	const confirmDeleteNotification = async () => {
		if (!deleteTargetId) return

		const id = deleteTargetId
		const previousNotifications = notifications

		setDeleteTargetId(null)
		setNotifications(prev => prev.filter(n => n.id !== id))

		try {
			const token = await getToken()

			if (!token) {
				throw new Error('No auth token found.')
			}

			const response = await fetch(`${API_BASE}/${id}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			if (!response.ok) {
				throw new Error('Failed to delete notification.')
			}
		} catch (err) {
			console.error('Delete notification error:', err)

			setNotifications(previousNotifications)
			setError('Unable to delete notification.')
		}
	}

	return (
		<div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, -apple-system, sans-serif' }}>

			{/* ── Header ──────────────────────────────────────────────────────── */}
			<div style={{ background: C.white, borderBottom: `1px solid ${C.skyBd}`, padding: '16px 20px' }}>
				<div>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							<button
								type="button"
								onClick={() => navigate(-1)}
								style={{
									background: 'none', border: 'none', cursor: 'pointer', padding: 0,
									color: C.blue, display: 'flex', alignItems: 'center',
								}}
							>
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width={22} height={22}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
								</svg>
							</button>
							<div>
								<h1 style={{ fontSize: '1.1875rem', fontWeight: 800, color: '#1f2937', letterSpacing: '-0.02em', margin: 0 }}>
									Notifications
								</h1>
								<p style={{ fontSize: '0.75rem', color: C.blueMuted, marginTop: 1, marginBottom: 0 }}>
									{unreadCount === 0
										? 'You are all caught up.'
										: `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`}
								</p>
							</div>
						</div>

						<button
							type="button"
							onClick={markAllRead}
							disabled={unreadCount === 0}
							style={{
								background: 'none', border: 'none', cursor: unreadCount === 0 ? 'default' : 'pointer',
								fontSize: '0.8125rem', fontWeight: 700,
								color: unreadCount === 0 ? C.skyBd : C.green,
								fontFamily: 'inherit', flexShrink: 0,
								padding: 0,
							}}
						>
							Mark all as read
						</button>
					</div>
				</div>
			</div>

			{/* ── Filter chips ────────────────────────────────────────────────── */}
			<div style={{ background: C.white, borderBottom: `1px solid ${C.skyBd}` }}>
				<div style={{ display: 'flex', gap: 8, padding: '14px 20px' }}>
					{FILTERS.map(chip => {
						const active = filter === chip
						const chipCount = getChipCount(chip)

						return (
							<button
								key={chip}
								type="button"
								onClick={() => setFilter(chip)}
								style={{
									padding: '5px 16px',
									borderRadius: '2rem',
									border: active ? `1.5px solid ${C.blue}` : `1.5px solid ${C.skyBd}`,
									background: active ? 'rgba(56,120,194,0.1)' : C.white,
									color: active ? C.blue : C.blueMuted,
									fontSize: '0.8125rem', fontWeight: active ? 700 : 500,
									cursor: 'pointer', fontFamily: 'inherit',
									transition: 'all 0.15s',
								}}
							>
								{chip}
								{chipCount > 0 && (
									<span style={{
										marginLeft: 6,
										fontSize: '0.6875rem', fontWeight: 800,
										background: active ? C.blue : 'rgba(56,120,194,0.12)',
										color: active ? C.white : C.blue,
										borderRadius: '2rem', padding: '0px 6px',
									}}>
										{chipCount}
									</span>
								)}
							</button>
						)
					})}
				</div>
			</div>

			{/* ── List ────────────────────────────────────────────────────────── */}
			<div style={{ padding: '16px 20px 120px' }}>

				{error && (
					<div style={{
						background: 'rgba(229,83,83,0.08)',
						border: '1px solid rgba(229,83,83,0.2)',
						color: C.red,
						borderRadius: '0.875rem',
						padding: '0.75rem 1rem',
						fontSize: '0.8125rem',
						fontWeight: 600,
						marginBottom: 12,
					}}>
						{error}
					</div>
				)}

				{isLoading && (
					<div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
						<div style={{
							width: 32, height: 32, borderRadius: '50%',
							border: `3px solid ${C.skyBd}`,
							borderTopColor: C.blue,
							animation: 'spin 0.7s linear infinite',
						}} />
						<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
					</div>
				)}

				{!isLoading && filtered.length === 0 && (
					<div style={{
						minHeight: '60vh',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						textAlign: 'center',
						gap: 24,
					}}>
						<img
							src="/images/WashingMachine.png"
							alt="No notifications"
							style={{
								height: 192,
								width: 'auto',
								display: 'block',
							}}
						/>

						<div>
							<h2 style={{
								fontSize: '1.125rem',
								fontWeight: 600,
								color: C.blue,
								margin: 0,
							}}>
								No notifications yet
							</h2>
							<p style={{
								marginTop: 4,
								marginBottom: 0,
								fontSize: '0.875rem',
								color: C.grayText,
							}}>
								You are all caught up. New updates will appear here.
							</p>
						</div>
					</div>
				)}

				{!isLoading && filtered.length > 0 && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						{filtered.map(item => (
							<div
								key={item.id}
								style={{
									background: item.read ? C.white : 'rgba(56,120,194,0.04)',
									borderRadius: '1rem',
									border: `1px solid ${item.read ? C.skyBd : 'rgba(56,120,194,0.22)'}`,
									boxShadow: item.read ? 'none' : '0 2px 12px rgba(56,120,194,0.07)',
									display: 'flex',
									alignItems: 'flex-start',
									gap: 12,
									padding: '1rem 1rem 1rem 1.125rem',
									overflow: 'hidden',
									position: 'relative',
								}}
							>
								{/* Unread left bar */}
								{!item.read && (
									<div style={{
										position: 'absolute', left: 0, top: 0, bottom: 0,
										width: 4, background: C.blue, borderRadius: '4px 0 0 4px',
									}} />
								)}

								{/* Content */}
								<div style={{ flex: 1, minWidth: 0 }}>
									<p style={{
										fontSize: '0.875rem',
										fontWeight: item.read ? 500 : 700,
										color: item.read ? C.blueMuted : '#1f2937',
										marginTop: 0,
										marginBottom: 3,
									}}>
										{item.title}
									</p>
									<p style={{
										fontSize: '0.8125rem',
										color: item.read ? C.blueMuted : '#374151',
										lineHeight: 1.5,
										marginTop: 0,
										marginBottom: 6,
									}}>
										{item.message}
									</p>
									<p style={{
										fontSize: '0.6875rem',
										color: item.read ? C.blueMuted : '#374151',
										fontWeight: 500,
										margin: 0,
									}}>
										{item.time}
									</p>
								</div>

								{/* Actions */}
								<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
									<button
										type="button"
										onClick={(e) => { e.stopPropagation(); requestDeleteNotification(item.id) }}
										style={{
											background: 'none', border: 'none', cursor: 'pointer',
											color: C.skyBd, padding: 4,
											display: 'flex', alignItems: 'center', justifyContent: 'center',
											borderRadius: '0.5rem',
										}}
										onMouseEnter={e => e.currentTarget.style.color = C.red}
										onMouseLeave={e => e.currentTarget.style.color = C.skyBd}
									>
										{ICONS.trash}
									</button>

									<button
										type="button"
										onClick={(e) => { e.stopPropagation(); toggleNotificationRead(item.id) }}
										style={{
											background: 'none', border: 'none', cursor: 'pointer',
											fontSize: '0.6875rem', fontWeight: 700,
											color: C.blueMuted,
											fontFamily: 'inherit', padding: '2px 4px',
											whiteSpace: 'nowrap',
										}}
									>
										{item.read ? 'Mark unread' : 'Mark read'}
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Delete Confirmation Modal */}
			{deleteTargetId && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
					<div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-lg">

						<div className="mb-4 flex justify-center">
							<div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-[#e55353]">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" width={42} height={42}>
									<path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
								</svg>
							</div>
						</div>

						<h3 className="mb-2 text-lg font-semibold text-[#3878c2]">
							Delete Notification?
						</h3>
						<p className="mb-6 text-sm text-[#374151]">
							Are you sure you want to delete this notification?
						</p>

						<div className="flex flex-col gap-3">
							<button
								type="button"
								onClick={confirmDeleteNotification}
								className="w-full rounded-lg bg-[#4bad40] py-2.5 font-semibold text-white"
							>
								Delete
							</button>
							<button
								type="button"
								onClick={cancelDeleteNotification}
								className="w-full rounded-lg border border-[#3878c2] py-2.5 font-semibold text-[#3878c2]"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}