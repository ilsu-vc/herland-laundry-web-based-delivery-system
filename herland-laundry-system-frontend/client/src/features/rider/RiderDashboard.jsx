import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { formatDate, formatTime } from '../../shared/utils/formatters';
import { supabase } from '../../lib/supabase';

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/rider`;

const Colors = {
  blue: '#3878C2',
  blueMuted: '#6B8DB3',
  sky: '#63BCE6',
  skyFaint: '#EEF8FD',
  green: '#4BAD40',
  greenFaint: 'rgba(75, 173, 64, 0.1)',
  red: '#e55353',
};

const STATUS_META = {
  'Rider Dispatched for Pickup': {
    label: 'Pickup',
    type: 'Pickup',
    color: Colors.blue,
    bg: 'rgba(56,120,194,0.1)',
  },
  'Booking Accepted': {
    label: 'Pickup',
    type: 'Pickup',
    color: Colors.blue,
    bg: 'rgba(56,120,194,0.1)',
  },
  'Out for Delivery': {
    label: 'Delivery',
    type: 'Delivery',
    color: Colors.green,
    bg: 'rgba(75,173,64,0.1)',
  },
  'Ready for Pick-up': {
    label: 'Delivery',
    type: 'Delivery',
    color: Colors.green,
    bg: 'rgba(75,173,64,0.1)',
  },
  'Laundry Delivered': {
    label: 'Delivery',
    type: 'Delivery',
    color: Colors.blueMuted,
    bg: 'rgba(107,139,174,0.1)',
  },
  'Picked Up from Customer': {
    label: 'Pickup',
    type: 'Pickup',
    color: Colors.blueMuted,
    bg: 'rgba(107,139,174,0.1)',
  },
  Delivered: {
    label: 'Delivery',
    type: 'Delivery',
    color: Colors.blueMuted,
    bg: 'rgba(107,139,174,0.1)',
  },
  'Picked Up': {
    label: 'Pickup',
    type: 'Pickup',
    color: Colors.blueMuted,
    bg: 'rgba(107,139,174,0.1)',
  },
};

const card = {
  background: '#ffffff',
  borderRadius: '1.25rem',
  boxShadow: '0 10px 30px rgba(56, 120, 194, 0.08)',
  border: '1px solid rgba(56, 120, 194, 0.12)',
};

const alertCard = {
  ...card,
  overflow: 'hidden',
};

const typography = {
  h1: {
    fontSize: '2rem',
    fontWeight: 800,
    color: Colors.blue,
    lineHeight: 1.2,
  },
  h2: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: Colors.blue,
    lineHeight: 1.3,
  },
  body: {
    fontSize: '0.9375rem',
    color: Colors.blueMuted,
    lineHeight: 1.6,
  },
};

function getListFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.bookings)) return data.bookings;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.tasks)) return data.tasks;
  return [];
}

function getFallbackAddresses(collectionDetails = {}) {
  const option = collectionDetails.option || collectionDetails.collectionOption || '';

  const pickupAddress =
    collectionDetails.pickupAddress ||
    collectionDetails.collectionAddress ||
    collectionDetails.dropOffAddress ||
    '';

  const deliveryAddress =
    collectionDetails.customerAddress ||
    collectionDetails.deliveryAddress ||
    collectionDetails.pickupAddress ||
    collectionDetails.collectionAddress ||
    '';

  if (option === 'dropOffPickUpLater') {
    return {
      pickupAddress: 'Herland Laundry',
      deliveryAddress,
    };
  }

  if (option === 'pickupDelivery' || option === 'pickUpDelivery') {
    return {
      pickupAddress,
      deliveryAddress,
    };
  }

  if (option === 'pickupOnly' || option === 'pickUpOnly') {
    return {
      pickupAddress,
      deliveryAddress: 'Herland Laundry',
    };
  }

  return {
    pickupAddress,
    deliveryAddress,
  };
}

function mapBookingData(booking) {
  const collectionDetails = booking.collection_details || {};
  const fallbackAddresses = getFallbackAddresses(collectionDetails);

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

    raw: booking,
  };
}

function toDateOnly(value) {
  if (!value) return '';

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}

function isTodayTask(booking) {
  const today = toDateOnly(new Date());
  const type = STATUS_META[booking.status]?.type || '';

  if (type === 'Pickup') {
    return toDateOnly(booking.pickupDate) === today;
  }

  if (type === 'Delivery') {
    return toDateOnly(booking.deliveryDate) === today;
  }

  return toDateOnly(booking.pickupDate) === today || toDateOnly(booking.deliveryDate) === today;
}

function isCompletedTask(booking) {
  return booking.status === 'Picked Up' || booking.status === 'Delivered' || booking.status === 'Picked Up from Customer' || booking.status === 'Laundry Delivered';
}

function isPastOrOverdue(booking) {
  const today = toDateOnly(new Date());
  const type = STATUS_META[booking.status]?.type || '';
  
  let taskDate = '';
  if (type === 'Pickup') {
    taskDate = toDateOnly(booking.pickupDate);
  } else if (type === 'Delivery') {
    taskDate = toDateOnly(booking.deliveryDate);
  } else {
    taskDate = toDateOnly(booking.pickupDate) || toDateOnly(booking.deliveryDate);
  }

  if (!taskDate) return false;
  return taskDate < today;
}

function meta(booking) {
  return STATUS_META[booking.status] || {
    label: booking.status || 'Task',
    type: '',
    color: Colors.blueMuted,
    bg: 'rgba(107,139,174,0.1)',
  };
}

export default function RiderDashboard() {
  const navigate = useNavigate();

  const [assignedBookings, setAssignedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      if (!token) {
        throw new Error('You must be logged in as a rider to view tasks.');
      }

      const assignedRes = await fetch(`${API_BASE}/assigned-bookings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!assignedRes.ok) {
        const message = await assignedRes.text();
        throw new Error(message || 'Failed to fetch assigned tasks.');
      }

      const assignedData = await assignedRes.json();

      setAssignedBookings(getListFromResponse(assignedData).map(mapBookingData));
    } catch (err) {
      console.error('Error loading rider dashboard:', err);
      setError(err.message || 'Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const channel = supabase
      .channel('rider-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [dashboardFilter, setDashboardFilter] = useState('All');

  const categorizedTasks = useMemo(() => {
    const past = [];
    const todayTasks = [];
    const upcoming = [];
    const today = toDateOnly(new Date());

    assignedBookings.forEach(task => {
      const type = STATUS_META[task.status]?.type || '';
      let taskDate = '';
      
      if (type === 'Pickup') {
        taskDate = toDateOnly(task.pickupDate);
      } else if (type === 'Delivery') {
        taskDate = toDateOnly(task.deliveryDate);
      } else {
        taskDate = toDateOnly(task.pickupDate) || toDateOnly(task.deliveryDate);
      }

      if (!taskDate) {
        todayTasks.push(task);
      } else if (taskDate < today) {
        past.push(task);
      } else if (taskDate === today) {
        todayTasks.push(task);
      } else {
        upcoming.push(task);
      }
    });

    return { past, todayTasks, upcoming };
  }, [assignedBookings]);

  const activeAssignedTasks = useMemo(() => {
    return assignedBookings.filter(b => !isCompletedTask(b) && !isPastOrOverdue(b));
  }, [assignedBookings]);

  const completedTasks = useMemo(() => {
    return assignedBookings.filter(isCompletedTask);
  }, [assignedBookings]);



  return (
    <div className="relative flex min-h-screen flex-col" style={{ background: Colors.skyFaint }}>
      <main className="flex-1 p-6 pb-24 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 style={typography.h1}>Rider Dashboard</h1>
          <p style={{ ...typography.body, marginTop: '0.5rem' }}>
            Monitor your assigned pickup and delivery tasks.
          </p>
        </div>

        {loading && (
          <div className="mb-8 rounded-xl bg-white p-6 text-center shadow-sm">
            <p style={{ ...typography.body, color: Colors.blueMuted }}>
              Loading dashboard data...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="mb-8 rounded-xl bg-white p-6 text-center shadow-sm">
            <p style={{ ...typography.body, color: Colors.red }}>
              {error}
            </p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:gap-6">
          {/* Assigned Tasks */}
          <button
            onClick={() => navigate('/rider/manage-tasks')}
            className="text-center transition-all duration-200 hover:-translate-y-1 active:scale-95 md:text-left"
            style={alertCard}
          >
            <div className="block p-4 md:hidden">
              <span
                className="block text-3xl font-black"
                style={{ color: Colors.blue }}
              >
                {activeAssignedTasks.length}
              </span>
              <p
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: Colors.blue,
                  marginTop: '0.5rem',
                }}
              >
                Assigned Tasks
              </p>
            </div>

            <div className="hidden items-center justify-between p-6 md:flex">
              <div>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: Colors.blue }}>
                  Assigned Tasks
                </p>
                <span
                  className="mt-3 block text-3xl font-black"
                  style={{ color: Colors.blue }}
                >
                  {activeAssignedTasks.length}
                </span>
              </div>

              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: 'rgba(56,120,194,0.1)' }}
              >
                <svg
                  className="h-6 w-6"
                  style={{ color: Colors.blue }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 18.75a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm7.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM3 6.75h10.5v7.5H3v-7.5Zm10.5 3h3.75L21 13.5v.75h-7.5v-4.5Z"
                  />
                </svg>
              </div>
            </div>
          </button>

          {/* Completed Tasks */}
          <button
            onClick={() => navigate('/rider/manage-tasks')}
            className="text-center transition-all duration-200 hover:-translate-y-1 active:scale-95 md:text-left"
            style={alertCard}
          >
            <div className="block p-4 md:hidden">
              <span
                className="block text-3xl font-black"
                style={{ color: Colors.green }}
              >
                {completedTasks.length}
              </span>
              <p
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: Colors.blue,
                  marginTop: '0.5rem',
                }}
              >
                Completed Tasks
              </p>
            </div>

            <div className="hidden items-center justify-between p-6 md:flex">
              <div>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: Colors.blue }}>
                  Completed Tasks
                </p>
                <span
                  className="mt-3 block text-3xl font-black"
                  style={{ color: Colors.green }}
                >
                  {completedTasks.length}
                </span>
              </div>

              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: Colors.greenFaint }}
              >
                <svg
                  className="h-6 w-6"
                  style={{ color: Colors.green }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Assigned Tasks Today */}
        <div className="grid grid-cols-1 gap-8">
          <div>
            <div style={card} className="p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 style={typography.h2}>Active Tasks</h2>
                <button
                  onClick={() => navigate('/rider/manage-tasks')}
                  className="rounded-lg px-4 py-2 transition-all duration-150"
                  style={{
                    background: Colors.skyFaint,
                    color: Colors.blue,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  View All Tasks
                </button>
              </div>

              {/* Filters */}
              <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
                {['Today', 'Past', 'Upcoming', 'All'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDashboardFilter(filter)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '2rem',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      background: dashboardFilter === filter ? Colors.blue : 'rgba(107,139,174,0.1)',
                      color: dashboardFilter === filter ? '#fff' : Colors.blueMuted,
                      border: `1px solid ${dashboardFilter === filter ? Colors.blue : 'transparent'}`,
                      transition: 'all 0.2s',
                    }}
                  >
                    {filter === 'Past' ? 'Past (Overdue)' : filter}
                  </button>
                ))}
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                {!loading && assignedBookings.length === 0 && (
                  <div className="py-8 text-center">
                    <p style={{ fontSize: '0.9375rem', color: Colors.blueMuted }}>
                      No assigned tasks.
                    </p>
                  </div>
                )}

                {/* Helper component for rendering a section */}
                {(() => {
                  const renderSection = (title, tasks, color) => {
                    if (tasks.length === 0) {
                      // Only show the empty message if it's the specific filter being viewed
                      if (dashboardFilter !== 'All' && title.includes(dashboardFilter) || (dashboardFilter === 'Past' && title.includes('Past'))) {
                         return (
                           <div className="py-8 text-center">
                             <p style={{ fontSize: '0.9375rem', color: Colors.blueMuted }}>
                               No {dashboardFilter.toLowerCase()} tasks found.
                             </p>
                           </div>
                         );
                      }
                      return null;
                    }

                    // If a specific filter is selected (not 'All'), don't render other sections
                    if (dashboardFilter === 'Past' && !title.includes('Past')) return null;
                    if (dashboardFilter === 'Today' && !title.includes('Today')) return null;
                    if (dashboardFilter === 'Upcoming' && !title.includes('Upcoming')) return null;

                    return (
                      <div className="mb-6 last:mb-0">
                        <div className="mb-3 border-b border-gray-100 pb-2">
                          <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {title} ({tasks.length})
                          </h3>
                        </div>
                        {tasks.map((booking, index) => {
                          const taskMeta = meta(booking);
                          return (
                            <div key={booking.dbId || booking.id}>
                              <button
                                onClick={() => navigate('/rider/manage-tasks')}
                                className="w-full py-4 text-left transition-all duration-150 hover:bg-gray-50/50"
                              >
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: Colors.blue }}>
                                    #{booking.id}
                                  </span>
                                  <span
                                    className="rounded-full px-3 py-1 text-xs font-semibold"
                                    style={{
                                      background: taskMeta.bg,
                                      color: taskMeta.color,
                                      border: `1px solid ${taskMeta.color}`,
                                    }}
                                  >
                                    {taskMeta.label}
                                  </span>
                                </div>

                                <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: Colors.blue }}>
                                  {booking.customerName}
                                </p>

                                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                                  <div>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: Colors.blueMuted }}>
                                      Pickup
                                    </p>
                                    <p style={{ fontSize: '0.8125rem', color: '#1f2937' }}>
                                      {booking.pickupAddress}
                                    </p>
                                    {(booking.pickupDate || booking.pickupTime) && (
                                      <p style={{ fontSize: '0.75rem', color: Colors.blue, marginTop: 2 }}>
                                        {booking.pickupDate ? formatDate(booking.pickupDate) : ''}
                                        {booking.pickupDate && booking.pickupTime ? ' • ' : ''}
                                        {booking.pickupTime ? formatTime(booking.pickupTime) : ''}
                                      </p>
                                    )}
                                  </div>

                                  <div>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: Colors.blueMuted }}>
                                      Delivery
                                    </p>
                                    <p style={{ fontSize: '0.8125rem', color: '#1f2937' }}>
                                      {booking.deliveryAddress}
                                    </p>
                                    {(booking.deliveryDate || booking.deliveryTime) && (
                                      <p style={{ fontSize: '0.75rem', color: Colors.blue, marginTop: 2 }}>
                                        {booking.deliveryDate ? formatDate(booking.deliveryDate) : ''}
                                        {booking.deliveryDate && booking.deliveryTime ? ' • ' : ''}
                                        {booking.deliveryTime ? formatTime(booking.deliveryTime) : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </button>

                              {index < tasks.length - 1 && (
                                <div style={{ height: '1px', background: Colors.blue, opacity: 0.1 }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  };

                  return (
                    <>
                      {renderSection("Past (Overdue)", categorizedTasks.past, Colors.red)}
                      {renderSection("Tasks for Today", categorizedTasks.todayTasks, Colors.green)}
                      {renderSection("Upcoming", categorizedTasks.upcoming, Colors.blue)}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </main>


    </div>
  );
}