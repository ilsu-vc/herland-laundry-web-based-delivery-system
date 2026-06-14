import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';

const Colors = {
  blue: '#3878C2',
  blueMuted: '#6B8DB3',
  sky: '#63BCE6',
  skyFaint: '#EEF8FD',
  green: '#4BAD40',
  greenFaint: 'rgba(75, 173, 64, 0.1)',
};

const STATUS_META = {
  BookingReceived: { label: 'Booking Received', color: '#b4b4b4' },
  BookingAccepted: { label: 'Booking Accepted', color: '#ffde59' },
  BookingEdited: { label: 'Booking Edited', color: '#ffde59' },
  PaymentConfirmed: { label: 'Payment Confirmed', color: '#ffde59' },
  RiderDispatchedForPickup: { label: 'Rider Dispatch for Pickup', color: '#ffde59' },
  PickedUpFromCustomer: { label: 'Picked Up from Customer', color: '#ffde59' },
  InProgress: { label: 'Laundry In Progress', color: '#ffde59' },
  OutForDelivery: { label: 'Out for Delivery', color: '#ffde59' },
  ReadyForPickup: { label: 'Ready for Pick-up', color: '#63bce6' },
  LaundryDelivered: { label: 'Laundry Delivered', color: '#63bce6' },
  BookingCompleted: { label: 'Booking Completed', color: '#63bce6' },
  FeedbackSubmitted: { label: 'Feedback Submitted', color: '#4bad40' },
  BookingCancelled: { label: 'Booking Cancelled', color: '#ff0000' },
  PaymentFlagged: { label: 'Payment Flagged', color: '#ff0000' },
};

const STATUS_LABEL_TO_KEY = Object.entries(STATUS_META).reduce((acc, [key, meta]) => {
  acc[meta.label] = key;
  return acc;
}, {});

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

const normalizeText = (value) => {
  return String(value || '').toLowerCase().trim();
};

const isToday = (dateValue) => {
  if (!dateValue) return false;

  const date = new Date(dateValue);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const formatTime = (dateValue) => {
  if (!dateValue) return 'No time';

  return new Date(dateValue).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getStatusKey = (status) => {
  if (!status) return 'BookingReceived';

  if (STATUS_META[status]) return status;

  return STATUS_LABEL_TO_KEY[status] || String(status).replace(/\s+/g, '');
};

const getLatestStatusFromTimeline = (timeline) => {
  if (!Array.isArray(timeline) || timeline.length === 0) return '';

  const latest = timeline[timeline.length - 1];
  return latest?.status || '';
};

const getBookingStatusKey = (booking) => {
  const latestTimelineStatus = getLatestStatusFromTimeline(booking.timeline);
  return getStatusKey(latestTimelineStatus || booking.status || booking.stage);
};

const getBookingStatusMeta = (booking) => {
  const statusKey = getBookingStatusKey(booking);

  return STATUS_META[statusKey] || {
    label: booking.status || booking.stage || 'In Progress',
    color: Colors.blue,
  };
};

const isBookingReceived = (booking) => {
  return getBookingStatusKey(booking) === 'BookingReceived';
};

const isVerifyPayment = (booking) => {
  const statusKey = getBookingStatusKey(booking);
  const stage = normalizeText(booking.stage);

  return (
    statusKey === 'BookingAccepted' ||
    statusKey === 'BookingEdited' ||
    stage === 'payment'
  );
};

const isLaundryInProgress = (booking) => {
  return getBookingStatusKey(booking) === 'InProgress';
};

const getBookingStatusLabel = (booking) => {
  return getBookingStatusMeta(booking).label;
};

const getServiceLabel = (serviceDetails) => {
  if (!serviceDetails) return 'Full Service Laundry';

  if (typeof serviceDetails === 'string') {
    return serviceDetails;
  }

  if (serviceDetails.loadType) {
    return serviceDetails.loadType;
  }

  if (serviceDetails.service) {
    return serviceDetails.service;
  }

  if (serviceDetails.name) {
    return serviceDetails.name;
  }

  if (Array.isArray(serviceDetails.loads) && serviceDetails.loads.length > 0) {
    return serviceDetails.loads
      .map((load) => load.label || load.name || load.type)
      .filter(Boolean)
      .join(', ');
  }

  return 'Full Service Laundry';
};

const getCustomerName = (booking, profileMap) => {
  const profile = profileMap.get(booking.user_id);

  return (
    profile?.full_name ||
    booking.customer_name ||
    booking.customerName ||
    'Customer'
  );
};

const getBookingDisplayId = (booking) => {
  return booking.reference_number || booking.id;
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const profileMap = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(
          'id, reference_number, user_id, status, stage, created_at, service_details, timeline'
        )
        .order('created_at', { ascending: false });

      if (bookingsError) {
        throw bookingsError;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, role');

      if (profilesError) {
        throw profilesError;
      }

      setBookings(bookingsData || []);
      setProfiles(profilesData || []);
    } catch (err) {
      console.error('Error loading admin dashboard:', err);
      setError('Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const bookingsToday = useMemo(() => {
    return bookings.filter((booking) => isToday(booking.created_at));
  }, [bookings]);

  const bookingReceivedCount = useMemo(() => {
    return bookingsToday.filter(isBookingReceived).length;
  }, [bookingsToday]);

  const verifyPaymentCount = useMemo(() => {
    return bookingsToday.filter(isVerifyPayment).length;
  }, [bookingsToday]);

  const laundryInProgressCount = useMemo(() => {
    return bookingsToday.filter(isLaundryInProgress).length;
  }, [bookingsToday]);



  return (
    <div className="min-h-screen w-full" style={{ background: Colors.skyFaint }}>
      <main className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 style={typography.h1}>Dashboard</h1>
          <p style={{ ...typography.body, marginTop: '0.5rem' }}>
            Monitor real-time operations, bookings, and system status
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
            <p style={{ ...typography.body, color: '#EB5757' }}>
              {error}
            </p>
          </div>
        )}

        {/* Alert Cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-6 mb-8">
          {/* Booking Received */}
          <button
            onClick={() => navigate('/staff/manage-bookings?filter=BookingReceived')}
            className="text-center md:text-left transition-all duration-200 hover:-translate-y-1 active:scale-95"
            style={alertCard}
          >
            <div className="block md:hidden p-4">
              <span
                className="block text-3xl font-black"
                style={{ color: STATUS_META.BookingReceived.color }}
              >
                {bookingReceivedCount}
              </span>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: Colors.blue, marginTop: '0.5rem' }}>
                Booking Received
              </p>
            </div>

            <div className="hidden md:flex p-6 items-center justify-between">
              <div>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: Colors.blue }}>
                  Booking Received
                </p>
                <span
                  className="block text-3xl font-black mt-3"
                  style={{ color: STATUS_META.BookingReceived.color }}
                >
                  {bookingReceivedCount}
                </span>
              </div>

              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(180,180,180,0.15)' }}
              >
                <svg
                  className="w-6 h-6"
                  style={{ color: STATUS_META.BookingReceived.color }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
            </div>
          </button>

          {/* Verify Payment */}
          <button
            onClick={() => navigate('/staff/manage-bookings?filter=payment')}
            className="text-center md:text-left transition-all duration-200 hover:-translate-y-1 active:scale-95"
            style={alertCard}
          >
            <div className="block md:hidden p-4">
              <span
                className="block text-3xl font-black"
                style={{ color: STATUS_META.PaymentConfirmed.color }}
              >
                {verifyPaymentCount}
              </span>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: Colors.blue, marginTop: '0.5rem' }}>
                Verify Payment
              </p>
            </div>

            <div className="hidden md:flex p-6 items-center justify-between">
              <div>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: Colors.blue }}>
                  Verify Payment
                </p>
                <span
                  className="block text-3xl font-black mt-3"
                  style={{ color: STATUS_META.PaymentConfirmed.color }}
                >
                  {verifyPaymentCount}
                </span>
              </div>

              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,222,89,0.18)' }}
              >
                <svg
                  className="w-6 h-6"
                  style={{ color: STATUS_META.PaymentConfirmed.color }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                  />
                </svg>
              </div>
            </div>
          </button>

          {/* Laundry In Progress */}
          <button
            onClick={() => navigate('/staff/manage-bookings?filter=InProgress')}
            className="text-center md:text-left transition-all duration-200 hover:-translate-y-1 active:scale-95"
            style={alertCard}
          >
            <div className="block md:hidden p-4">
              <span
                className="block text-3xl font-black"
                style={{ color: STATUS_META.InProgress.color }}
              >
                {laundryInProgressCount}
              </span>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: Colors.blue, marginTop: '0.5rem' }}>
                Laundry In Progress
              </p>
            </div>

            <div className="hidden md:flex p-6 items-center justify-between">
              <div>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: Colors.blue }}>
                  Laundry In Progress
                </p>
                <span
                  className="block text-3xl font-black mt-3"
                  style={{ color: STATUS_META.InProgress.color }}
                >
                  {laundryInProgressCount}
                </span>
              </div>

              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,222,89,0.18)' }}
              >
                <svg
                  className="w-6 h-6"
                  style={{ color: STATUS_META.InProgress.color }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-8">
          {/* All Bookings Today */}
          <div>
            <div style={card} className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 style={typography.h2}>All Bookings Today</h2>
                <button
                  onClick={() => navigate('/staff/manage-bookings')}
                  className="px-4 py-2 rounded-lg transition-all duration-150"
                  style={{
                    background: Colors.skyFaint,
                    color: Colors.blue,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  View All
                </button>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                {!loading && bookingsToday.length === 0 && (
                  <div className="py-8 text-center">
                    <p style={{ fontSize: '0.9375rem', color: Colors.blueMuted }}>
                      No bookings for today.
                    </p>
                  </div>
                )}

                {bookingsToday.map((booking, index) => {
                  const bookingId = getBookingDisplayId(booking);
                  const statusLabel = getBookingStatusLabel(booking);
                  const statusMeta = getBookingStatusMeta(booking);
                  const statusColor = statusMeta.color;

                  return (
                    <div key={booking.id}>
                      <button
                        onClick={() => navigate(`/bookings/${booking.id}`)}
                        className="w-full text-left py-4 transition-all duration-150 hover:bg-gray-50/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: Colors.blue }}>
                            {bookingId}
                          </span>
                          <span
                            className="px-3 py-1 rounded-full text-xs font-semibold"
                            style={{
                              background: statusColor,
                              color: statusColor === '#ffde59' ? Colors.blue : '#ffffff',
                              border: `1px solid ${statusColor}`,
                            }}
                          >
                            {statusLabel}
                          </span>
                        </div>

                        <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: Colors.blue }}>
                          {getCustomerName(booking, profileMap)}
                        </p>

                        <div className="flex items-center gap-4 mt-2">
                          <span style={{ fontSize: '0.8125rem', color: Colors.blueMuted }}>
                            {getServiceLabel(booking.service_details)}
                          </span>
                          <span style={{ fontSize: '0.8125rem', color: Colors.blueMuted }}>
                            • {formatTime(booking.created_at)}
                          </span>
                        </div>
                      </button>

                      {index < bookingsToday.length - 1 && (
                        <div style={{ height: '1px', background: Colors.blue, opacity: 0.2 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}