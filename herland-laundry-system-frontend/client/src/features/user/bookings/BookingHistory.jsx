import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import {
  ACTIVE_STATUSES,
  PAST_STATUSES,
  getStatusMeta,
  getStatusKey,
} from '../../../shared/components/StatusMeta';

const Colors = {
  blue: '#3878C2',
  blueMuted: '#5f7f9f',
  skyFaint: '#f5fbff',
  skyFaintSm: '#f8fcff',
  skyBd: '#d7ecfb',
  green: '#4bad40',
  greenFaint: 'rgba(75, 173, 64, 0.12)',
  white: '#ffffff',
};

const card = {
  background: Colors.white,
  borderRadius: '1rem',
  border: `1px solid ${Colors.skyBd}`,
  boxShadow: '0 8px 24px rgba(56, 120, 194, 0.08)',
};

const typography = {
  h1: {
    fontSize: '2rem',
    fontWeight: 900,
    color: Colors.blue,
    margin: 0,
  },
  h2: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: Colors.blue,
    margin: 0,
  },
  body: {
    fontSize: '0.95rem',
    color: Colors.blueMuted,
    margin: 0,
  },
};

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/customer`;

const STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active Status' },
  { value: 'all', label: 'All Status' },
  { value: 'past', label: 'Past Status' },
  { value: 'BookingReceived', label: 'Booking Received' },
  { value: 'BookingAccepted', label: 'Booking Accepted' },
  { value: 'BookingEdited', label: 'Booking Edited' },
  { value: 'PaymentConfirmed', label: 'Payment Confirmed' },
  { value: 'RiderDispatchedForPickup', label: 'Rider Dispatched for Pickup' },
  { value: 'PickedUpFromCustomer', label: 'Picked Up from Customer' },
  { value: 'InProgress', label: 'Laundry In Progress' },
  { value: 'ReadyForPickup', label: 'Ready for Pick-up' },
  { value: 'OutForDelivery', label: 'Out for Delivery' },
  { value: 'LaundryDelivered', label: 'Laundry Delivered' },
  { value: 'FeedbackSubmitted', label: 'Feedback Submitted' },
  { value: 'BookingCancelled', label: 'Booking Cancelled' },
  { value: 'PaymentFlagged', label: 'Payment Flagged' },
];

function formatDateOnly(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function isToday(value) {
  if (!value) return false;

  const date = new Date(value);
  const today = new Date();

  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function getLatestStatusFromTimeline(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) return '';

  const latest = timeline[timeline.length - 1];
  return latest?.status || '';
}

function getBookingStatusKey(booking) {
  const latestTimelineStatus = getLatestStatusFromTimeline(booking.timeline);
  return getStatusKey(latestTimelineStatus || booking.status || booking.stage);
}

function getServiceLabel(serviceDetails, serviceType) {
  if (!serviceDetails) return serviceType || 'Full Service Laundry';

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

  return serviceType || 'Full Service Laundry';
}

function getPickupAddress(collectionDetails) {
  return (
    collectionDetails?.pickupAddress ||
    collectionDetails?.pickup_address ||
    collectionDetails?.address ||
    collectionDetails?.collectionAddress ||
    collectionDetails?.collection_address ||
    'Customer address'
  );
}

function getDeliveryAddress(collectionDetails) {
  return (
    collectionDetails?.deliveryAddress ||
    collectionDetails?.delivery_address ||
    collectionDetails?.address ||
    collectionDetails?.deliveryAddressText ||
    collectionDetails?.delivery_address_text ||
    'Customer address'
  );
}

function normalizeBooking(raw) {
  const collectionDetails = raw.collectionDetails || raw.collection_details || {};
  const serviceDetails = raw.serviceDetails || raw.service_details || {};
  const timeline = Array.isArray(raw.timeline) ? raw.timeline : [];
  const createdAt = raw.createdAt || raw.created_at || raw.date || raw.schedule || '';

  const referenceNumber =
    raw.referenceNumber ||
    raw.reference_number ||
    raw.id ||
    raw.booking_id ||
    '';

  return {
    ...raw,

    id: String(referenceNumber),
    dbId: raw.dbId || raw.db_id || raw.booking_id || raw.id,

    referenceNumber: String(referenceNumber),

    status: raw.status || getLatestStatusFromTimeline(timeline) || 'Booking Received',
    stage: raw.stage || '',
    timeline,

    serviceType:
      raw.serviceType ||
      raw.service_type ||
      getServiceLabel(serviceDetails, raw.service_type),

    serviceDetails,

    collectionOption:
      raw.collectionOption ||
      raw.collection_option ||
      raw.collection_options ||
      'pickedUpDelivered',

    collectionDetails,

    pickupAddress: getPickupAddress(collectionDetails),
    deliveryAddress: getDeliveryAddress(collectionDetails),

    createdAt,
    date: formatDateOnly(createdAt),
  };
}

export default function BookingHistory() {
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getAuthSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session;
  };

  const fetchBookingHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const session = await getAuthSession();
      const token = session?.access_token;
      const user = session?.user;

      if (!token || !user) {
        navigate('/landing');
        return;
      }

      const response = await fetch(`${API_BASE}/my-bookings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bookings.');
      }

      const data = await response.json();

      const list = Array.isArray(data)
        ? data
        : data.bookings || data.data || [];

      setBookings(list.map(normalizeBooking));
    } catch (err) {
      console.error('Error loading booking history:', err);
      setError(err.message || 'Could not load booking history.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchBookingHistory();
  }, [fetchBookingHistory]);

  const filteredBookings = useMemo(() => {
    const hasSearch = searchTerm.trim().length > 0;
    const defaultView = !hasSearch && statusFilter === 'active';

    return bookings.filter((booking) => {
      const statusKey = getBookingStatusKey(booking);

      const matchSearch =
        !hasSearch ||
        String(booking.referenceNumber).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(booking.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(booking.dbId).toLowerCase().includes(searchTerm.toLowerCase());

      let matchStatus = true;

      if (statusFilter === 'active') {
        matchStatus = ACTIVE_STATUSES.includes(statusKey);
      } else if (statusFilter === 'past') {
        matchStatus = PAST_STATUSES.includes(statusKey);
      } else if (statusFilter !== 'all') {
        matchStatus = statusKey === statusFilter;
      }

      const matchDate = defaultView ? isToday(booking.createdAt) : true;

      return matchSearch && matchStatus && matchDate;
    });
  }, [bookings, searchTerm, statusFilter]);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 style={typography.h1}>Booking History</h1>
        <p style={{ ...typography.body, marginTop: '0.5rem' }}>
          View your active laundry bookings and track their current status
        </p>
      </div>

      {/* Search + filter */}
      <div style={card} className="p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by reference number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 rounded-xl focus:outline-none"
              style={{
                background: Colors.skyFaintSm,
                border: `1.5px solid ${Colors.skyBd}`,
                color: Colors.blue,
                fontSize: '0.9375rem',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-xl focus:outline-none"
            style={{
              background: Colors.skyFaintSm,
              border: `1.5px solid ${Colors.skyBd}`,
              color: Colors.blue,
              fontSize: '0.9375rem',
              minWidth: '220px',
            }}
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bookings list */}
      <div style={card} className="p-6">
        <h2 style={{ ...typography.h2, marginBottom: '1.5rem' }}>
          {searchTerm || statusFilter !== 'active'
            ? 'Bookings'
            : "Today's Active Bookings"}
        </h2>

        {loading && (
          <p style={{ color: Colors.blueMuted, textAlign: 'center', padding: '2rem 0' }}>
            Loading bookings...
          </p>
        )}

        {!loading && error && (
          <p style={{ color: '#ff0000', textAlign: 'center', padding: '2rem 0' }}>
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="space-y-3">
            {filteredBookings.length === 0 && (
              <p style={{ color: Colors.blueMuted, textAlign: 'center', padding: '2rem 0' }}>
                No bookings match your search.
              </p>
            )}

            {filteredBookings.map((booking) => {
              const statusKey = getBookingStatusKey(booking);
              const meta = getStatusMeta(statusKey);
              const color = meta.color;
              const dbId = booking.dbId || booking.id;

              return (
                <button
                  key={dbId}
                  type="button"
                  onClick={() => navigate(`/bookings/${encodeURIComponent(dbId)}`)}
                  className="w-full rounded-xl overflow-hidden transition-all duration-150 hover:shadow-md text-left"
                  style={{
                    display: 'flex',
                    border: `1px solid ${Colors.blue}`,
                  }}
                >
                  {/* Colored left status bar */}
                  <div
                    style={{
                      width: 5,
                      flexShrink: 0,
                      background: color,
                      borderRadius: '0.75rem 0 0 0.75rem',
                    }}
                  />

                  {/* Card body */}
                  <div className="flex-1 p-5" style={{ background: Colors.white }}>
                    {/* Top row: reference + status badge */}
                    <div className="flex items-center justify-between mb-3 gap-4">
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          color: Colors.blue,
                        }}
                      >
                        {booking.referenceNumber}
                      </span>

                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: color,
                          color: color === '#ffde59' ? '#3878C2' : Colors.white,
                          border: `1px solid ${color}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <p
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: Colors.blueMuted,
                        marginBottom: '1rem',
                      }}
                    >
                      Booking received on {booking.date}
                    </p>

                    {/* Fields grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: Colors.blueMuted,
                          }}
                        >
                          PICKUP
                        </p>
                        <p
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 600,
                            color: Colors.blue,
                            marginTop: '0.25rem',
                          }}
                        >
                          {booking.pickupAddress}
                        </p>
                      </div>

                      <div>
                        <p
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: Colors.blueMuted,
                          }}
                        >
                          DELIVERY
                        </p>
                        <p
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 600,
                            color: Colors.blue,
                            marginTop: '0.25rem',
                          }}
                        >
                          {booking.deliveryAddress}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}