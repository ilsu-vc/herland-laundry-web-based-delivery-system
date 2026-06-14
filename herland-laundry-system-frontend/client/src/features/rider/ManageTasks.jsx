import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDate, formatTime } from '../../shared/utils/formatters'
import { supabase } from '../../lib/supabase'

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/rider`

const C = {
	blue:      '#3878c2',
	green:     '#4bad40',
	sky:       '#63bce6',
	bg:        '#EFF8FC',
	skyBd:     'rgba(99,188,230,0.28)',
	blueMuted: '#6b8bae',
	white:     '#ffffff',
	red:       '#e55353',
}

const STATUS_META = {
	'Rider Dispatched for Pickup': {
		label: 'Pickup',
		type: 'Pickup',
		color: C.blue,
		bg: 'rgba(56,120,194,0.1)',
	},
	'Booking Accepted': {
		label: 'Pickup',
		type: 'Pickup',
		color: C.blue,
		bg: 'rgba(56,120,194,0.1)',
	},
	'Out for Delivery': {
		label: 'Delivery',
		type: 'Delivery',
		color: C.green,
		bg: 'rgba(75,173,64,0.1)',
	},
	'Ready for Pick-up': {
		label: 'Delivery',
		type: 'Delivery',
		color: C.green,
		bg: 'rgba(75,173,64,0.1)',
	},
	'Laundry Delivered': {
		label: 'Delivery',
		type: 'Delivery',
		color: C.blueMuted,
		bg: 'rgba(107,139,174,0.1)',
	},
	'Picked Up from Customer': {
		label: 'Pickup',
		type: 'Pickup',
		color: C.blueMuted,
		bg: 'rgba(107,139,174,0.1)',
	},
	'Delivered': {
		label: 'Delivery',
		type: 'Delivery',
		color: C.blueMuted,
		bg: 'rgba(107,139,174,0.1)',
	},
	'Picked Up': {
		label: 'Pickup',
		type: 'Pickup',
		color: C.blueMuted,
		bg: 'rgba(107,139,174,0.1)',
	},
}

const FILTER_CHIPS = ['All', 'Pickup', 'Delivery']

function InfoBlock({ label, address, date, time }) {
	return (
		<div>
			<p style={{
				fontSize: '0.65rem',
				fontWeight: 800,
				letterSpacing: '0.09em',
				textTransform: 'uppercase',
				color: C.blueMuted,
				marginBottom: 5,
			}}>
				{label}
			</p>

			<p style={{
				fontSize: '0.875rem',
				color: '#1f2937',
				fontWeight: 500,
				lineHeight: 1.4,
			}}>
				{address || '-'}
			</p>

			{(date || time) && (
				<p style={{
					fontSize: '0.75rem',
					color: C.blue,
					marginTop: 4,
					fontWeight: 600,
				}}>
					{date ? formatDate(date) : ''}
					{date && time ? ' • ' : ''}
					{time ? formatTime(time) : ''}
				</p>
			)}
		</div>
	)
}

function FilterChips({ selected, onChange, counts }) {
	return (
		<div style={{
			display: 'flex',
			gap: 8,
			padding: '14px 20px',
			width: '100%',
			boxSizing: 'border-box',
		}}>
			{FILTER_CHIPS.map(chip => {
				const active = selected === chip

				return (
					<button
						key={chip}
						onClick={() => onChange(chip)}
						style={{
							padding: '5px 16px',
							borderRadius: '2rem',
							border: active ? `1.5px solid ${C.blue}` : `1.5px solid ${C.skyBd}`,
							background: active ? 'rgba(56,120,194,0.1)' : C.white,
							color: active ? C.blue : C.blueMuted,
							fontSize: '0.8125rem',
							fontWeight: active ? 700 : 500,
							cursor: 'pointer',
							fontFamily: 'inherit',
							transition: 'all 0.15s',
							display: 'flex',
							alignItems: 'center',
							gap: 6,
						}}
					>
						{chip}

						<span style={{
							fontSize: '0.6875rem',
							fontWeight: 800,
							background: active ? 'rgba(56,120,194,0.14)' : 'rgba(107,139,174,0.1)',
							color: active ? C.blue : C.blueMuted,
							borderRadius: '2rem',
							padding: '1px 6px',
							minWidth: 20,
							textAlign: 'center',
						}}>
							{counts?.[chip] || 0}
						</span>
					</button>
				)
			})}
		</div>
	)
}

function getListFromResponse(data) {
	if (Array.isArray(data)) return data
	if (Array.isArray(data?.bookings)) return data.bookings
	if (Array.isArray(data?.data)) return data.data
	if (Array.isArray(data?.tasks)) return data.tasks
	return []
}

function getFallbackAddresses(collectionDetails = {}) {
	const option = collectionDetails.option || collectionDetails.collectionOption || ''

	const pickupAddress =
		collectionDetails.pickupAddress ||
		collectionDetails.collectionAddress ||
		collectionDetails.dropOffAddress ||
		''

	const deliveryAddress =
		collectionDetails.customerAddress ||
		collectionDetails.deliveryAddress ||
		collectionDetails.pickupAddress ||
		collectionDetails.collectionAddress ||
		''

	if (option === 'dropOffPickUpLater') {
		return {
			pickupAddress: 'Herland Laundry',
			deliveryAddress,
		}
	}

	if (option === 'pickupDelivery' || option === 'pickUpDelivery') {
		return {
			pickupAddress,
			deliveryAddress,
		}
	}

	if (option === 'pickupOnly' || option === 'pickUpOnly') {
		return {
			pickupAddress,
			deliveryAddress: 'Herland Laundry',
		}
	}

	return {
		pickupAddress,
		deliveryAddress,
	}
}

function mapBookingData(booking) {
	const collectionDetails = booking.collection_details || {}
	const fallbackAddresses = getFallbackAddresses(collectionDetails)

	return {
		id: booking.reference_number || booking.id,
		dbId: booking.id,
		status: booking.status || '',
		customerName: booking.customerName || booking.customer_name || booking.profiles?.full_name || 'Customer',

		pickupAddress:
			collectionDetails.pickupAddress ||
			fallbackAddresses.pickupAddress ||
			'-',

		pickupDate:
			collectionDetails.collectionDate ||
			collectionDetails.pickupDate ||
			collectionDetails.date ||
			null,

		pickupTime:
			collectionDetails.collectionTime ||
			collectionDetails.pickupTime ||
			collectionDetails.time ||
			null,

		deliveryAddress:
			collectionDetails.customerAddress ||
			collectionDetails.deliveryAddress ||
			fallbackAddresses.deliveryAddress ||
			'-',

		deliveryDate:
			collectionDetails.deliveryDate ||
			null,

		deliveryTime:
			collectionDetails.deliveryTime ||
			null,

		lat:
			collectionDetails.lat ??
			collectionDetails.latitude ??
			null,

		lng:
			collectionDetails.lng ??
			collectionDetails.longitude ??
			null,

		raw: booking,
	}
}

function toDateOnly(value) {
	if (!value) return ''

	const date = new Date(value)

	if (!Number.isNaN(date.getTime())) {
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const day = String(date.getDate()).padStart(2, '0')

		return `${year}-${month}-${day}`
	}

	return String(value).slice(0, 10)
}

function isTodayTask(booking) {
	const today = toDateOnly(new Date())
	const type = STATUS_META[booking.status]?.type || ''

	if (type === 'Pickup') {
		return toDateOnly(booking.pickupDate) === today
	}

	if (type === 'Delivery') {
		return toDateOnly(booking.deliveryDate) === today
	}

	return toDateOnly(booking.pickupDate) === today || toDateOnly(booking.deliveryDate) === today
}

function isPastOrOverdue(booking) {
	const today = toDateOnly(new Date())
	const type = STATUS_META[booking.status]?.type || ''
	
	let taskDate = ''
	if (type === 'Pickup') {
		taskDate = toDateOnly(booking.pickupDate)
	} else if (type === 'Delivery') {
		taskDate = toDateOnly(booking.deliveryDate)
	} else {
		taskDate = toDateOnly(booking.pickupDate) || toDateOnly(booking.deliveryDate)
	}

	if (!taskDate) return false;
	return taskDate < today;
}

function getChipCounts(list) {
	return {
		All: list.length,
		Pickup: list.filter((booking) => STATUS_META[booking.status]?.type === 'Pickup').length,
		Delivery: list.filter((booking) => STATUS_META[booking.status]?.type === 'Delivery').length,
	}
}

export default function ManageTasks() {
	const navigate = useNavigate()

	const [bookings, setBookings] = useState([])
	const [availableBookings, setAvailableBookings] = useState([])
	const [activeTab, setActiveTab] = useState('available')
	const [assignedFilter, setAssignedFilter] = useState('All')
	const [availableFilter, setAvailableFilter] = useState('All')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [expandedId, setExpandedId] = useState(null)
	const [actionLoadingId, setActionLoadingId] = useState(null)

	const fetchAll = async () => {
		try {
			setLoading(true)
			setError('')

			const {
				data: { session },
			} = await supabase.auth.getSession()

			const token = session?.access_token

			if (!token) {
				throw new Error('You must be logged in as a rider to view tasks.')
			}

			const headers = {
				Authorization: `Bearer ${token}`,
			}

			const [availableRes, assignedRes] = await Promise.all([
				fetch(`${API_BASE}/available-bookings`, { headers }),
				fetch(`${API_BASE}/assigned-bookings`, { headers }),
			])

			if (!availableRes.ok) {
				const message = await availableRes.text()
				throw new Error(message || 'Failed to fetch available tasks.')
			}

			if (!assignedRes.ok) {
				const message = await assignedRes.text()
				throw new Error(message || 'Failed to fetch assigned tasks.')
			}

			const availableData = await availableRes.json()
			const assignedData = await assignedRes.json()

			setAvailableBookings(getListFromResponse(availableData).map(mapBookingData).filter(b => !isPastOrOverdue(b)))
			setBookings(getListFromResponse(assignedData).map(mapBookingData).filter(b => !isPastOrOverdue(b)))
		} catch (err) {
			console.error(err)
			setError(err.message || 'Something went wrong while loading tasks.')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchAll()
	}, [])

	const filter = activeTab === 'available' ? availableFilter : assignedFilter
	const setFilter = activeTab === 'available' ? setAvailableFilter : setAssignedFilter

	const displayAvailableBookings = useMemo(() => {
		return availableBookings
	}, [availableBookings])

	const displayAssignedBookings = useMemo(() => {
		return bookings
	}, [bookings])

	const currentBaseBookings = activeTab === 'available'
		? displayAvailableBookings
		: displayAssignedBookings

	const chipCounts = useMemo(() => {
		return getChipCounts(currentBaseBookings)
	}, [currentBaseBookings])

	const currentBookings = useMemo(() => {
		if (filter === 'All') return currentBaseBookings

		return currentBaseBookings.filter((booking) => {
			const type = STATUS_META[booking.status]?.type || ''
			return type === filter
		})
	}, [currentBaseBookings, filter])

	const categorizedCurrentBookings = useMemo(() => {
		const past = []
		const todayTasks = []
		const upcoming = []
		const today = toDateOnly(new Date())

		currentBookings.forEach(task => {
			const type = STATUS_META[task.status]?.type || ''
			let taskDate = ''
			
			if (activeTab === 'assigned') {
				if (task.status === 'Rider Dispatched for Pickup' || task.status === 'Booking Accepted') {
					task.isPickupAction = true
				} else if (task.status === 'Out for Delivery' || task.status === 'Ready for Pick-up') {
					task.isDeliveryAction = true
				}
			}

			if (type === 'Pickup') {
				taskDate = toDateOnly(task.pickupDate)
			} else if (type === 'Delivery') {
				taskDate = toDateOnly(task.deliveryDate)
			} else {
				taskDate = toDateOnly(task.pickupDate) || toDateOnly(task.deliveryDate)
			}

			if (!taskDate) {
				todayTasks.push(task)
			} else if (taskDate < today) {
				past.push(task)
			} else if (taskDate === today) {
				todayTasks.push(task)
			} else {
				upcoming.push(task)
			}
		})

		return { past, todayTasks, upcoming }
	}, [currentBookings])

	const selectedBooking = useMemo(
		() => currentBookings.find((booking) => booking.id === expandedId) || null,
		[currentBookings, expandedId]
	)

	const meta = (booking) => {
		return STATUS_META[booking.status] || {
			label: booking.status || 'Task',
			type: '',
			color: C.blueMuted,
			bg: 'rgba(107,139,174,0.1)',
		}
	}

	const handleAccept = async (booking) => {
		try {
			setActionLoadingId(booking.dbId)
			setError('')

			const {
				data: { session },
			} = await supabase.auth.getSession()

			const token = session?.access_token

			if (!token) {
				throw new Error('You must be logged in as a rider to accept tasks.')
			}

			const res = await fetch(`${API_BASE}/accept/${booking.dbId}`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			if (!res.ok) {
				const message = await res.text()
				throw new Error(message || 'Failed to accept task.')
			}

			setExpandedId(null)
			await fetchAll()
		} catch (err) {
			console.error(err)
			setError(err.message || 'Something went wrong while accepting the task.')
		} finally {
			setActionLoadingId(null)
		}
	}

	const handleDecline = async (booking) => {
		const confirmed = window.confirm('Are you sure you want to decline this task?')

		if (!confirmed) return

		try {
			setActionLoadingId(booking.dbId)
			setError('')

			const {
				data: { session },
			} = await supabase.auth.getSession()

			const token = session?.access_token

			if (!token) {
				throw new Error('You must be logged in as a rider to decline tasks.')
			}

			const res = await fetch(`${API_BASE}/decline/${booking.dbId}`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			if (!res.ok) {
				const message = await res.text()
				throw new Error(message || 'Failed to decline task.')
			}

			setExpandedId(null)
			await fetchAll()
		} catch (err) {
			console.error(err)
			setError(err.message || 'Something went wrong while declining the task.')
		} finally {
			setActionLoadingId(null)
		}
	}

	const handleUpdateStatus = async (booking, newStatus) => {
		const confirmed = window.confirm(`Are you sure you want to mark this task as "${newStatus}"?`)
		if (!confirmed) return

		try {
			setActionLoadingId(booking.dbId)
			setError('')

			const { data: { session } } = await supabase.auth.getSession()
			const token = session?.access_token

			if (!token) throw new Error('You must be logged in as a rider.')

			const newTimeline = [
				...(Array.isArray(booking.raw.timeline) ? booking.raw.timeline : []),
				{ status: newStatus, timestamp: new Date().toISOString() }
			]

			const res = await fetch(`${API_BASE}/update-status/${booking.dbId}`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ new_status: newStatus, timeline: newTimeline })
			})

			if (!res.ok) {
				const message = await res.text()
				throw new Error(message || 'Failed to update task status.')
			}

			setExpandedId(null)
			await fetchAll()
		} catch (err) {
			console.error(err)
			setError(err.message || 'Something went wrong while updating task status.')
		} finally {
			setActionLoadingId(null)
		}
	}

	const hasCoordinates =
		selectedBooking?.lat !== null &&
		selectedBooking?.lat !== undefined &&
		selectedBooking?.lng !== null &&
		selectedBooking?.lng !== undefined

	return (
		<>
			{/* ── Header ──────────────────────────────────────────────────────── */}
			<div style={{
				background: C.white,
				borderBottom: `1px solid ${C.skyBd}`,
				padding: '16px 20px',
			}}>
				<div style={{
					display: 'flex',
					alignItems: 'center',
					gap: 10,
				}}>
					<button
						type="button"
						onClick={() => navigate(-1)}
						style={{
							background: 'none',
							border: 'none',
							cursor: 'pointer',
							padding: 0,
							color: C.blue,
							display: 'flex',
							alignItems: 'center',
						}}
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width={22} height={22}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
						</svg>
					</button>

					<h1 style={{
						fontSize: '1.1875rem',
						fontWeight: 800,
						color: '#1f2937',
						letterSpacing: '-0.02em',
					}}>
						Manage Tasks
					</h1>
				</div>
			</div>

			{/* ── Tabs ────────────────────────────────────────────────────────── */}
			<div style={{
				background: C.white,
				borderBottom: `1px solid ${C.skyBd}`,
			}}>
				<div style={{
					display: 'flex',
				}}>
					{[
						{ key: 'available', label: 'Available Tasks', count: displayAvailableBookings.length },
						{ key: 'assigned', label: 'Assigned Tasks', count: displayAssignedBookings.length },
					].map(({ key, label, count }) => {
						const isActive = activeTab === key

						return (
							<button
								key={key}
								onClick={() => {
									setActiveTab(key)
									setExpandedId(null)
								}}
								style={{
									padding: '14px 20px',
									border: 'none',
									borderBottom: isActive ? `2.5px solid ${C.blue}` : '2.5px solid transparent',
									background: 'none',
									cursor: 'pointer',
									fontSize: '0.875rem',
									fontWeight: isActive ? 700 : 500,
									color: isActive ? C.blue : C.blueMuted,
									fontFamily: 'inherit',
									display: 'flex',
									alignItems: 'center',
									gap: 6,
								}}
							>
								{label}

								<span style={{
									fontSize: '0.75rem',
									fontWeight: 700,
									background: isActive ? 'rgba(56,120,194,0.12)' : 'rgba(107,139,174,0.1)',
									color: isActive ? C.blue : C.blueMuted,
									borderRadius: '2rem',
									padding: '1px 7px',
									minWidth: 22,
									textAlign: 'center',
								}}>
									{count}
								</span>
							</button>
						)
					})}
				</div>
			</div>

			{/* ── Filter chips ────────────────────────────────────────────────── */}
			<div style={{
				background: C.white,
				borderBottom: `1px solid ${C.skyBd}`,
			}}>
				<FilterChips selected={filter} onChange={setFilter} counts={chipCounts} />
			</div>

			{/* ── Task list ───────────────────────────────────────────────────── */}
			<div style={{
				padding: '20px 0 120px',
				boxSizing: 'border-box',
			}}>
				{loading && (
					<p style={{
						fontSize: '0.875rem',
						color: C.blue,
						padding: '12px 20px',
					}}>
						Loading tasks…
					</p>
				)}

				{error && (
					<div style={{
						background: C.white,
						borderRadius: '1rem',
						border: `1px solid rgba(229,83,83,0.25)`,
						padding: '1rem',
						margin: '0 20px 12px',
					}}>
						<p style={{
							fontSize: '0.875rem',
							color: C.red,
							fontWeight: 600,
						}}>
							{error}
						</p>
					</div>
				)}

				{!loading && currentBookings.length === 0 && (
					<div style={{
						textAlign: 'center',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 16,
						paddingTop: 48,
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

						<p style={{
							fontSize: '0.9375rem',
							color: C.blueMuted,
						}}>
							No active tasks found.
						</p>
					</div>
				)}

				<div style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 24,
				}}>
					{(() => {
						const renderSection = (title, tasks, titleColor) => {
							if (tasks.length === 0) return null

							return (
								<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
									<div style={{ paddingBottom: 4, borderBottom: `1px solid ${C.skyBd}` }}>
										<h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: titleColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
											{title} ({tasks.length})
										</h3>
									</div>

									{tasks.map((booking) => {
										const m = meta(booking)
										const isAvailable = activeTab === 'available'
										const isActionLoading = actionLoadingId === booking.dbId

										return (
											<div
												key={booking.id}
												style={{
													background: C.white,
													borderRadius: '1rem',
													border: `1px solid ${C.skyBd}`,
													boxShadow: '0 2px 12px rgba(56,120,194,0.06)',
													overflow: 'hidden',
													display: 'flex',
												}}
											>
												<div style={{
													width: 4,
													flexShrink: 0,
													background: m.color,
												}} />

												<div style={{
													flex: 1,
													padding: '1.125rem 1.25rem',
												}}>
													<div style={{
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'space-between',
														gap: 8,
														marginBottom: 12,
													}}>
														<div style={{
															display: 'flex',
															alignItems: 'center',
															gap: 6,
															flexWrap: 'wrap',
														}}>
															<p style={{
																fontSize: '0.9375rem',
																fontWeight: 700,
																color: '#1f2937',
															}}>
																{booking.customerName}
															</p>

															<span style={{
																fontSize: '0.75rem',
																color: C.blueMuted,
															}}>
																#{booking.id}
															</span>
														</div>

														<span style={{
															fontSize: '0.6875rem',
															fontWeight: 700,
															background: m.bg,
															color: m.color,
															borderRadius: '2rem',
															padding: '2px 10px',
															textTransform: 'uppercase',
															letterSpacing: '0.06em',
															flexShrink: 0,
														}}>
															{m.label}
														</span>
													</div>

													<div style={{
														display: 'grid',
														gridTemplateColumns: '1fr 1fr',
														gap: 16,
														marginBottom: 14,
													}}>
														<InfoBlock
															label="Pickup From"
															address={booking.pickupAddress}
															date={booking.pickupDate}
															time={booking.pickupTime}
														/>

														<InfoBlock
															label="Deliver To"
															address={booking.deliveryAddress}
															date={booking.deliveryDate}
															time={booking.deliveryTime}
														/>
													</div>

													{isAvailable ? (
														<div style={{
															display: 'grid',
															gridTemplateColumns: '1fr 1fr',
															gap: 8,
														}}>
															<button
																onClick={() => handleAccept(booking)}
																disabled={isActionLoading}
																style={{
																	width: '100%',
																	padding: '9px 0',
																	background: C.green,
																	border: `1.5px solid ${C.green}`,
																	borderRadius: '0.625rem',
																	fontSize: '0.8125rem',
																	fontWeight: 700,
																	color: '#fff',
																	cursor: isActionLoading ? 'not-allowed' : 'pointer',
																	fontFamily: 'inherit',
																	opacity: isActionLoading ? 0.7 : 1,
																}}
															>
																{isActionLoading ? 'Accepting…' : 'Accept Task'}
															</button>

															<button
																onClick={() => handleDecline(booking)}
																disabled={isActionLoading}
																style={{
																	width: '100%',
																	padding: '9px 0',
																	background: C.white,
																	border: `1.5px solid ${C.red}`,
																	borderRadius: '0.625rem',
																	fontSize: '0.8125rem',
																	fontWeight: 700,
																	color: C.red,
																	cursor: isActionLoading ? 'not-allowed' : 'pointer',
																	fontFamily: 'inherit',
																	opacity: isActionLoading ? 0.7 : 1,
																}}
															>
																{isActionLoading ? 'Declining…' : 'Decline'}
															</button>
														</div>
													) : (
														<button
															onClick={() => setExpandedId(booking.id)}
															style={{
																width: '100%',
																padding: '9px 0',
																background: 'none',
																border: `1.5px solid ${C.blue}`,
																borderRadius: '0.625rem',
																fontSize: '0.8125rem',
																fontWeight: 700,
																color: C.blue,
																cursor: 'pointer',
																fontFamily: 'inherit',
															}}
														>
															View Details &amp; Map
														</button>
													)}
												</div>
											</div>
										)
									})}
								</div>
							)
						}

						return (
							<>
								{renderSection('Past (Overdue)', categorizedCurrentBookings.past, C.red)}
								{renderSection('Tasks for Today', categorizedCurrentBookings.todayTasks, C.green)}
								{renderSection('Upcoming', categorizedCurrentBookings.upcoming, C.blue)}
							</>
						)
					})()}
				</div>
			</div>

			{/* ── Detail overlay ──────────────────────────────────────────────── */}
			{selectedBooking && (
				<div style={{
					position: 'fixed',
					inset: 0,
					zIndex: 50,
					background: C.bg,
					overflowY: 'auto',
					fontFamily: 'Inter, -apple-system, sans-serif',
				}}>
					<div style={{
						background: C.white,
						borderBottom: `1px solid ${C.skyBd}`,
						padding: '16px 20px',
					}}>
						<div style={{
							display: 'flex',
							alignItems: 'center',
							gap: 10,
						}}>
							<button
								type="button"
								onClick={() => setExpandedId(null)}
								style={{
									background: 'none',
									border: 'none',
									cursor: 'pointer',
									padding: 0,
									color: C.blue,
									display: 'flex',
									alignItems: 'center',
								}}
							>
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width={22} height={22}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
								</svg>
							</button>

							<h1 style={{
								fontSize: '1.1875rem',
								fontWeight: 800,
								color: '#1f2937',
								letterSpacing: '-0.02em',
							}}>
								Booking Details
							</h1>
						</div>
					</div>

					<div style={{
						padding: '20px 0 120px',
						boxSizing: 'border-box',
					}}>
						{/* Customer card */}
						<div style={{
							background: C.white,
							borderRadius: '1rem',
							border: `1px solid ${C.skyBd}`,
							boxShadow: '0 2px 12px rgba(56,120,194,0.06)',
							padding: '1.25rem',
							marginBottom: 12,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: 12,
						}}>
							<div>
								<p style={{
									fontSize: '1.0625rem',
									fontWeight: 800,
									color: '#1f2937',
									letterSpacing: '-0.01em',
								}}>
									{selectedBooking.customerName}
								</p>

								<p style={{
									fontSize: '0.8125rem',
									color: C.blueMuted,
									marginTop: 2,
								}}>
									Booking #{selectedBooking.id}
								</p>
							</div>

							{(() => {
								const m = meta(selectedBooking)

								return (
									<span style={{
										fontSize: '0.75rem',
										fontWeight: 700,
										background: m.bg,
										color: m.color,
										borderRadius: '2rem',
										padding: '4px 14px',
										textTransform: 'uppercase',
										letterSpacing: '0.06em',
										flexShrink: 0,
									}}>
										{m.label}
									</span>
								)
							})()}
						</div>

						{/* Pickup + Delivery */}
						<div style={{
							display: 'grid',
							gridTemplateColumns: '1fr 1fr',
							gap: 12,
							marginBottom: 12,
						}}>
							<div style={{
								background: C.white,
								borderRadius: '1rem',
								border: `1px solid ${C.skyBd}`,
								boxShadow: '0 2px 12px rgba(56,120,194,0.06)',
								overflow: 'hidden',
							}}>
								<div style={{
									height: 4,
									background: C.blue,
								}} />

								<div style={{
									padding: '1.125rem',
								}}>
									<InfoBlock
										label="Pickup Information"
										address={selectedBooking.pickupAddress}
										date={selectedBooking.pickupDate}
										time={selectedBooking.pickupTime}
									/>
								</div>
							</div>

							<div style={{
								background: C.white,
								borderRadius: '1rem',
								border: `1px solid ${C.skyBd}`,
								boxShadow: '0 2px 12px rgba(56,120,194,0.06)',
								overflow: 'hidden',
							}}>
								<div style={{
									height: 4,
									background: C.green,
								}} />

								<div style={{
									padding: '1.125rem',
								}}>
									<InfoBlock
										label="Delivery Information"
										address={selectedBooking.deliveryAddress}
										date={selectedBooking.deliveryDate}
										time={selectedBooking.deliveryTime}
									/>
								</div>
							</div>
						</div>

						{/* Receipt */}
						{/* Action block for active assigned tasks */}
						{(['Booking Accepted', 'Rider Dispatched for Pickup', 'Ready for Pick-up', 'Out for Delivery'].includes(selectedBooking.status)) && (
							<div style={{
								background: C.white,
								borderRadius: '1rem',
								border: `1px solid ${C.skyBd}`,
								boxShadow: '0 2px 12px rgba(56,120,194,0.06)',
								padding: '1.25rem',
								marginBottom: 12,
							}}>
								<p style={{
									fontSize: '0.65rem',
									fontWeight: 800,
									letterSpacing: '0.09em',
									textTransform: 'uppercase',
									color: C.blueMuted,
									marginBottom: 14,
								}}>
									Update Status
								</p>

								{['Booking Accepted', 'Rider Dispatched for Pickup'].includes(selectedBooking.status) && (
									<button
										onClick={() => handleUpdateStatus(selectedBooking, 'Picked Up from Customer')}
										disabled={actionLoadingId === selectedBooking.dbId}
										style={{
											width: '100%',
											padding: '12px 0',
											background: C.blue,
											color: '#fff',
											borderRadius: '0.75rem',
											border: 'none',
											fontSize: '0.9rem',
											fontWeight: 700,
											cursor: actionLoadingId === selectedBooking.dbId ? 'not-allowed' : 'pointer',
											fontFamily: 'inherit',
											opacity: actionLoadingId === selectedBooking.dbId ? 0.7 : 1,
											boxShadow: '0 4px 14px rgba(56,120,194,0.24)',
										}}
									>
										{actionLoadingId === selectedBooking.dbId ? 'Updating...' : 'Confirm Pick Up'}
									</button>
								)}

								{['Ready for Pick-up', 'Out for Delivery'].includes(selectedBooking.status) && (
									<button
										onClick={() => handleUpdateStatus(selectedBooking, 'Laundry Delivered')}
										disabled={actionLoadingId === selectedBooking.dbId}
										style={{
											width: '100%',
											padding: '12px 0',
											background: C.green,
											color: '#fff',
											borderRadius: '0.75rem',
											border: 'none',
											fontSize: '0.9rem',
											fontWeight: 700,
											cursor: actionLoadingId === selectedBooking.dbId ? 'not-allowed' : 'pointer',
											fontFamily: 'inherit',
											opacity: actionLoadingId === selectedBooking.dbId ? 0.7 : 1,
											boxShadow: '0 4px 14px rgba(75,173,64,0.28)',
										}}
									>
										{actionLoadingId === selectedBooking.dbId ? 'Updating...' : 'Confirm Delivery'}
									</button>
								)}
							</div>
						)}

						{/* Navigation */}
						<div style={{
							background: C.white,
							borderRadius: '1rem',
							border: `1px solid ${C.skyBd}`,
							boxShadow: '0 2px 12px rgba(56,120,194,0.06)',
							padding: '1.25rem',
						}}>
							<p style={{
								fontSize: '0.65rem',
								fontWeight: 800,
								letterSpacing: '0.09em',
								textTransform: 'uppercase',
								color: C.blueMuted,
								marginBottom: 14,
							}}>
								Navigation
							</p>

							{hasCoordinates ? (
								<div>
									<div style={{
										background: C.bg,
										borderRadius: '0.75rem',
										border: `1px solid ${C.skyBd}`,
										padding: '12px 14px',
										marginBottom: 14,
									}}>
										<p style={{
											fontSize: '0.65rem',
											fontWeight: 700,
											textTransform: 'uppercase',
											letterSpacing: '0.08em',
											color: C.blueMuted,
											marginBottom: 4,
										}}>
											Pinned Address
										</p>

										<p style={{
											fontSize: '0.875rem',
											fontWeight: 600,
											color: '#1f2937',
										}}>
											{selectedBooking.deliveryAddress}
										</p>
									</div>

									<a
										href={`https://www.google.com/maps/dir/?api=1&destination=${selectedBooking.lat},${selectedBooking.lng}`}
										target="_blank"
										rel="noopener noreferrer"
										style={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											gap: 8,
											width: '100%',
											padding: '12px 0',
											background: C.green,
											color: '#fff',
											borderRadius: '0.75rem',
											border: 'none',
											fontSize: '0.9rem',
											fontWeight: 700,
											textDecoration: 'none',
											boxSizing: 'border-box',
											boxShadow: '0 4px 14px rgba(75,173,64,0.28)',
										}}
									>
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width={18} height={18}>
											<path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.125A59.769 59.769 0 0121.485 12 59.768 59.768 0 013.27 20.875L5.999 12zm0 0h7.5" />
										</svg>

										Open in Google Maps
									</a>
								</div>
							) : (
								<div style={{
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									justifyContent: 'center',
									padding: '24px 0',
									textAlign: 'center',
								}}>
									<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={C.skyBd} width={40} height={40} style={{ marginBottom: 10 }}>
										<path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
									</svg>

									<p style={{
										fontSize: '0.875rem',
										fontWeight: 600,
										color: C.blueMuted,
									}}>
										GPS Coordinates Not Available
									</p>

									<p style={{
										fontSize: '0.75rem',
										color: C.blueMuted,
										marginTop: 4,
									}}>
										Manual navigation required
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	)
}