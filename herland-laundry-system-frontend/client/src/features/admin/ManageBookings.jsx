import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { parseDateString, formatDateMMDDYYYY } from '../../shared/utils/formatters';

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

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/admin`;

export const STATUS_META = {
  BookingReceived:           { label: 'Booking Received',            color: '#b4b4b4' },
  BookingAccepted:           { label: 'Booking Accepted',            color: '#ffde59' },
  BookingEdited:             { label: 'Booking Edited',              color: '#ffde59' },
  PaymentConfirmed:          { label: 'Payment Confirmed',           color: '#ffde59' },
  RiderDispatchedForPickup:  { label: 'Rider Dispatch for Pickup', color: '#ffde59' },
  PickedUpFromCustomer:      { label: 'Picked Up from Customer',     color: '#ffde59' },
  InProgress:                { label: 'Laundry In Progress',         color: '#ffde59' },
  OutForDelivery:            { label: 'Out for Delivery',            color: '#ffde59' },
  ReadyForPickup:            { label: 'Ready for Pick-up',           color: '#63bce6' },
  LaundryDelivered:          { label: 'Laundry Delivered',           color: '#63bce6' },
  BookingCompleted:          { label: 'Booking Completed',           color: '#63bce6' },
  FeedbackSubmitted:         { label: 'Feedback Submitted',          color: '#4bad40' },
  BookingCancelled:          { label: 'Booking Cancelled',           color: '#ff0000' },
  PaymentFlagged:            { label: 'Payment Flagged',             color: '#ff0000' },
};

const STATUS_LABEL_TO_KEY = Object.entries(STATUS_META).reduce((acc, [key, meta]) => {
  acc[meta.label] = key;
  return acc;
}, {});

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  ...Object.entries(STATUS_META).map(([key, { label }]) => ({ value: key, label })),
];

const ACTION_EFFECTS = {
  BookingReceived: {
    actionLabel: 'Confirm Payment',
    status: 'Payment Confirmed',
    nextStage: 'payment',
  },
  PaymentConfirmed: {
    actionLabel: 'Accept Booking',
    status: 'Booking Accepted',
    nextStage: 'dynamic',
  },
  BookingEdited: {
    actionLabel: 'Confirm Payment',
    status: 'Payment Confirmed',
    nextStage: 'dynamic',
  },
  BookingAccepted: {
    actionLabel: 'Dispatch Rider for Pickup',
    status: 'Rider Dispatched for Pickup',
    nextStage: 'shipping',
  },
  RiderDispatchedForPickup: {
    actionLabel: 'Confirm Pick Up',
    status: 'Picked Up from Customer',
    nextStage: 'shipping',
  },
  PickedUpFromCustomer: {
    actionLabel: 'Start Laundry',
    status: 'Laundry In Progress',
    nextStage: 'preparation',
  },
  InProgress: {
    actionLabel: 'Dispatch Rider for Delivery',
    status: 'Out for Delivery',
    nextStage: 'shipping',
  },
  OutForDelivery: {
    actionLabel: 'Confirm Delivery',
    status: 'Laundry Delivered',
    nextStage: 'shipping',
  },
  ReadyForPickup: {
    actionLabel: 'Complete Booking',
    status: 'Booking Completed',
    nextStage: 'final',
  },
  LaundryDelivered: {
    actionLabel: 'Complete Booking',
    status: 'Booking Completed',
    nextStage: 'final',
  },
};

function getStatusKey(status) {
  if (!status) return 'BookingReceived';

  if (STATUS_META[status]) return status;

  return STATUS_LABEL_TO_KEY[status] || status.replace(/\s+/g, '');
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

function getBookingStatusMeta(booking) {
  const statusKey = getBookingStatusKey(booking);
  return STATUS_META[statusKey] || {
    label: booking.status || statusKey || 'Unknown Status',
    color: Colors.blue,
  };
}

function formatDateOnly(value) {
  if (!value) return '';

  const parsedDate = parseDateString(value);
  if (parsedDate) return formatDateMMDDYYYY(parsedDate);

  return String(value).slice(0, 10);
}

function getAmountFromBooking(booking) {
  const paymentAmount = booking.paymentDetails?.amountToPay;
  const directAmount = booking.amountToPay;
  const dbAmount = booking.amount_to_pay;

  const amount = paymentAmount ?? directAmount ?? dbAmount ?? 0;

  if (typeof amount === 'string' && amount.includes('₱')) {
    return amount;
  }

  return `₱${Number(amount || 0).toLocaleString('en-PH')}`;
}

function normalizeBooking(raw) {
  const paymentDetails = raw.paymentDetails || raw.payment_details || {};
  const serviceDetails = raw.serviceDetails || raw.service_details || {};
  const collectionDetails = raw.collectionDetails || raw.collection_details || {};
  const collectionOption = raw.collectionOption || raw.collection_option || raw.collection_options || '';
  const createdAt = raw.createdAt || raw.created_at || raw.schedule || '';
  const date = raw.date || formatDateOnly(raw.schedule || raw.created_at || raw.createdAt);

  return {
    ...raw,

    id: raw.id && typeof raw.id === 'string'
      ? raw.id
      : raw.referenceNumber || raw.reference_number || `HL-${String(raw.id || '').padStart(6, '0')}`,

    dbId: raw.dbId || raw.db_id || raw.booking_id || raw.id,

    customerName:
      raw.customerName ||
      raw.customer_name ||
      raw.customer ||
      raw.profiles?.full_name ||
      raw.customer_profile?.full_name ||
      'Unknown Customer',

    riderName:
      raw.riderName ||
      raw.rider_name ||
      raw.rider?.full_name ||
      raw.rider_profile?.full_name ||
      '',

    service:
      raw.service ||
      raw.serviceType ||
      raw.service_type ||
      'Full Service Laundry',

    serviceType:
      raw.serviceType ||
      raw.service_type ||
      'Full Service Laundry',

    date,
    createdAt,

    stage: raw.stage || 'received',
    status: raw.status || getLatestStatusFromTimeline(raw.timeline) || 'Booking Received',
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],

    collectionOption,
    collectionDetails,

    paymentDetails: {
      ...paymentDetails,
      amountToPay: paymentDetails.amountToPay ?? raw.amountToPay ?? raw.amount_to_pay ?? 0,
    },

    serviceDetails,

    notes: raw.notes || '',

    amount: getAmountFromBooking({
      ...raw,
      paymentDetails,
    }),

    customerFeedback: raw.customerFeedback || raw.customer_feedback || null,
    riderFeedback: raw.riderFeedback || raw.rider_feedback || null,
    cancellationReason: raw.cancellationReason || raw.cancellation_reason || '',
  };
}
const getTodayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ManageBookings() {
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('BookingReceived');

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [saveLoading, setSaveLoading] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [yearInput, setYearInput] = useState('');
  const [monthInput, setMonthInput] = useState('');
  const [dateFrom, setDateFrom] = useState(getTodayString());
  const [dateTo, setDateTo] = useState(getTodayString());

  // applied values
  const [appliedYear, setAppliedYear] = useState('');
  const [appliedMonth, setAppliedMonth] = useState('');
  const [appliedFrom, setAppliedFrom] = useState(getTodayString());
  const [appliedTo, setAppliedTo] = useState(getTodayString());

  const selectedStatusLabel =
    STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter)?.label || 'Booking Received';

  const availableYears = useMemo(() => {
    const years = new Set();
    bookings.forEach((b) => {
      const dateObj = parseDateString(b.createdAt || b.date);
      if (dateObj) {
        years.add(String(dateObj.getFullYear()));
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [bookings]);

  const availableMonths = useMemo(() => {
    const months = new Set();
    bookings.forEach((b) => {
      const dateObj = parseDateString(b.createdAt || b.date);
      if (dateObj) {
        const y = String(dateObj.getFullYear());
        if (!yearInput || y === yearInput) {
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          months.add(m);
        }
      }
    });
    const monthNames = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return Array.from(months)
      .sort()
      .map((val) => [val, monthNames[parseInt(val, 10)]]);
  }, [bookings, yearInput]);

  const applyDateFilter = () => {
    setAppliedYear(yearInput);
    setAppliedMonth(monthInput);
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
  };

  const clearDateFilter = () => {
    setYearInput('');
    setMonthInput('');
    setDateFrom('');
    setDateTo('');
    setAppliedYear('');
    setAppliedMonth('');
    setAppliedFrom('');
    setAppliedTo('');
  };

  const hasActiveDateFilter = appliedYear || appliedMonth || appliedFrom || appliedTo;

  const getAuthToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token;
  };

  const fetchBookings = async () => {
    setLoading(true);
    setFetchError('');

    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error('No active Supabase session found.');
      }

      const response = await fetch(`${API_BASE}/bookings`, {
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
    } catch (error) {
      console.error(error);
      setFetchError(error.message || 'Something went wrong while loading bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();

    const channel = supabase
      .channel('admin-bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    return bookings.filter((booking) => {
      const bookingStatusKey = getBookingStatusKey(booking);

      const matchSearch =
        booking.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(booking.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(booking.dbId).toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'all' || bookingStatusKey === statusFilter;

      let matchDate = true;
      const bookingDate = parseDateString(booking.date);

      if (appliedYear) {
        matchDate = matchDate && bookingDate?.getFullYear() === Number(appliedYear);
      }

      if (appliedMonth) {
        matchDate = matchDate && String(bookingDate?.getMonth() + 1).padStart(2, '0') === appliedMonth;
      }

      if (appliedFrom) {
        const fromDate = parseDateString(appliedFrom);
        if (!fromDate || !bookingDate) return false;
        fromDate.setHours(0, 0, 0, 0);
        matchDate = matchDate && bookingDate >= fromDate;
      }

      if (appliedTo) {
        const toDate = parseDateString(appliedTo);
        if (!toDate || !bookingDate) return false;
        toDate.setHours(23, 59, 59, 999);
        matchDate = matchDate && bookingDate <= toDate;
      }

      return matchSearch && matchStatus && matchDate;
    });
  }, [bookings, searchTerm, statusFilter, appliedYear, appliedMonth, appliedFrom, appliedTo]);

  const received = bookings.filter((booking) => {
    const key = getBookingStatusKey(booking);
    return key === 'BookingReceived';
  }).length;

  const inProg = bookings.filter((booking) => {
    const key = getBookingStatusKey(booking);

    return [
      'BookingAccepted',
      'BookingEdited',
      'PaymentConfirmed',
      'RiderDispatchedForPickup',
      'PickedUpFromCustomer',
      'InProgress',
      'OutForDelivery',
    ].includes(key);
  }).length;

  const completed = bookings.filter((booking) => {
    const key = getBookingStatusKey(booking);

    return [
      'FeedbackSubmitted',
      'LaundryDelivered',
      'ReadyForPickup',
      'BookingCompleted',
    ].includes(key);
  }).length;

  const handleUpdateStatus = async (booking) => {
    const statusKey = getBookingStatusKey(booking);
    let action = { ...ACTION_EFFECTS[statusKey] };

    // Dynamic bypass for Drop-off vs Pickup workflows
    const isPickupRequired = booking.collectionOption === 'pickedUpDelivered';
    const isDeliveryRequired = booking.collectionOption === 'dropOffDelivered' || booking.collectionOption === 'pickedUpDelivered';

    if (statusKey === 'BookingAccepted' && !isPickupRequired) {
      action = { actionLabel: 'Start Laundry', status: 'Laundry In Progress', nextStage: 'preparation' };
    }

    if (statusKey === 'InProgress' && !isDeliveryRequired) {
      action = { actionLabel: 'Mark Ready for Pick-up', status: 'Ready for Pick-up', nextStage: 'final' };
    }

    if (!action || !action.status) {
      alert('No available next status for this booking.');
      return;
    }

    const payment = booking.paymentDetails || {};
    const paymentMethod = payment.method || 'GCash';

    if (
      action.status === 'Payment Confirmed' &&
      paymentMethod === 'GCash' &&
      !payment.referenceNumber
    ) {
      alert('GCash reference number is required before confirming payment.');
      return;
    }

    const nextStage =
      action.nextStage === 'dynamic'
        ? booking.collectionOption === 'pickedUpDelivered'
          ? 'shipping'
          : 'preparation'
        : action.nextStage;

    const newTimeline = [
      ...(Array.isArray(booking.timeline) ? booking.timeline : []),
      {
        status: action.status,
        timestamp: new Date().toISOString(),
      },
    ];

    const dbId = booking.dbId || booking.id;

    setSaveLoading(dbId);
    setSaveSuccess('');

    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error('No active Supabase session found.');
      }

      const response = await fetch(`${API_BASE}/bookings/${dbId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: action.status,
          nextStage,
          timeline: newTimeline,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update booking status.');
      }

      setBookings((prev) =>
        prev.map((item) =>
          (item.dbId || item.id) === dbId
            ? normalizeBooking({
                ...item,
                status: action.status,
                stage: nextStage,
                timeline: newTimeline,
              })
            : item
        )
      );

      setSaveSuccess(`${booking.id} updated to ${action.status}.`);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Something went wrong while updating status.');
    } finally {
      setSaveLoading('');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 style={typography.h1}>Manage Bookings</h1>
        <p style={{ ...typography.body, marginTop: '0.5rem' }}>
          View and manage all customer bookings
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 lg:gap-6 mb-8">
        {/* New */}
        <div style={card} className="p-4 lg:p-6">
          <div className="flex flex-col items-center justify-center text-center gap-1 lg:flex-row lg:items-center lg:justify-between lg:text-left lg:gap-0">
            <div className="flex flex-col-reverse lg:flex-col">
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: Colors.blueMuted }}>
                Booking Received
              </p>
              <p
                className="text-3xl font-black lg:mt-2"
                style={{ color: STATUS_META.BookingReceived.color }}
              >
                {received}
              </p>
            </div>
            <div
              className="hidden lg:flex w-12 h-12 rounded-xl items-center justify-center"
              style={{ background: 'rgba(180,180,180,0.15)' }}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke={STATUS_META.BookingReceived.color}
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
        </div>

        {/* Laundry In Progress */}
        <div style={card} className="p-4 lg:p-6">
          <div className="flex flex-col items-center justify-center text-center gap-1 lg:flex-row lg:items-center lg:justify-between lg:text-left lg:gap-0">
            <div className="flex flex-col-reverse lg:flex-col">
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: Colors.blueMuted }}>
                Laundry In Progress
              </p>
              <p
                className="text-3xl font-black lg:mt-2"
                style={{ color: STATUS_META.InProgress.color }}
              >
                {inProg}
              </p>
            </div>
            <div
              className="hidden lg:flex w-12 h-12 rounded-xl items-center justify-center"
              style={{ background: 'rgba(255,222,89,0.18)' }}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke={STATUS_META.InProgress.color}
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Completed */}
        <div style={card} className="p-4 lg:p-6">
          <div className="flex flex-col items-center justify-center text-center gap-1 lg:flex-row lg:items-center lg:justify-between lg:text-left lg:gap-0">
            <div className="flex flex-col-reverse lg:flex-col">
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: Colors.blueMuted }}>
                Booking Completed
              </p>
              <p
                className="text-3xl font-black lg:mt-2"
                style={{ color: STATUS_META.FeedbackSubmitted.color }}
              >
                {completed}
              </p>
            </div>
            <div
              className="hidden lg:flex w-12 h-12 rounded-xl items-center justify-center"
              style={{ background: Colors.greenFaint }}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke={STATUS_META.FeedbackSubmitted.color}
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Search + filter */}
      <div style={card} className="p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by booking ID or customer name..."
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

        {/* divider */}
        <div style={{ height: 1, background: Colors.skyBd, margin: '16px 0' }} />

        {/* Date filters row */}
        <>
          {/* Mobile layout */}
          <div className="md:hidden w-full">
            {/* Line 1: Filter by + Year + Month */}
            <div className="grid grid-cols-[auto_1fr_1fr] gap-3 items-end w-full">
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: Colors.blueMuted,
                  paddingBottom: 10,
                  whiteSpace: 'nowrap',
                }}
              >
                Filter by:
              </span>

              {/* Year */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: Colors.blueMuted,
                    letterSpacing: '0.05em',
                  }}
                >
                  Year
                </label>
                <select
                  value={yearInput}
                  onChange={(e) => setYearInput(e.target.value)}
                  style={{
                    background: Colors.skyFaintSm,
                    border: `1.5px solid ${Colors.skyBd}`,
                    color: Colors.blue,
                    fontSize: '0.9rem',
                    borderRadius: '0.75rem',
                    padding: '9px 12px',
                    width: '100%',
                    outline: 'none',
                  }}
                >
                  <option value="">All</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: Colors.blueMuted,
                    letterSpacing: '0.05em',
                  }}
                >
                  Month
                </label>
                <select
                  value={monthInput}
                  onChange={(e) => setMonthInput(e.target.value)}
                  style={{
                    background: Colors.skyFaintSm,
                    border: `1.5px solid ${Colors.skyBd}`,
                    color: Colors.blue,
                    fontSize: '0.9rem',
                    borderRadius: '0.75rem',
                    padding: '9px 12px',
                    width: '100%',
                    outline: 'none',
                  }}
                >
                  <option value="">All</option>
                  {availableMonths.map(([val, name]) => (
                    <option key={val} value={val}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line 2: Date From + Date To */}
            <div className="grid grid-cols-2 gap-3 w-full mt-3">
              {/* Date From */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: Colors.blueMuted,
                    letterSpacing: '0.05em',
                  }}
                >
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    background: Colors.skyFaintSm,
                    border: `1.5px solid ${Colors.skyBd}`,
                    color: Colors.blue,
                    fontSize: '0.9rem',
                    borderRadius: '0.75rem',
                    padding: '9px 12px',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>

              {/* Date To */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: Colors.blueMuted,
                    letterSpacing: '0.05em',
                  }}
                >
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    background: Colors.skyFaintSm,
                    border: `1.5px solid ${Colors.skyBd}`,
                    color: Colors.blue,
                    fontSize: '0.9rem',
                    borderRadius: '0.75rem',
                    padding: '9px 12px',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
            </div>

            {/* Line 3: Apply Filter + Clear Filter */}
            <div className="grid grid-cols-2 gap-3 w-full mt-4">
              <button
                onClick={applyDateFilter}
                style={{
                  padding: '11px 12px',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: Colors.blue,
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}
              >
                Apply Filter
              </button>

              <button
                onClick={clearDateFilter}
                style={{
                  padding: '11px 12px',
                  borderRadius: '0.75rem',
                  border: `1.5px solid ${Colors.skyBd}`,
                  background: hasActiveDateFilter ? Colors.skyFaintSm : 'transparent',
                  color: hasActiveDateFilter ? Colors.blue : Colors.blueMuted,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}
              >
                Clear Filter
              </button>
            </div>
          </div>

          {/* Tablet + Desktop layout */}
          <div className="hidden md:grid md:grid-cols-[auto_repeat(6,minmax(0,1fr))] md:gap-3 md:items-end md:w-full">
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: Colors.blueMuted,
                paddingBottom: 10,
                whiteSpace: 'nowrap',
              }}
            >
              Filter by:
            </span>

            {/* Year */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: Colors.blueMuted,
                  letterSpacing: '0.05em',
                }}
              >
                Year
              </label>
              <select
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                style={{
                  background: Colors.skyFaintSm,
                  border: `1.5px solid ${Colors.skyBd}`,
                  color: Colors.blue,
                  fontSize: '0.9rem',
                  borderRadius: '0.75rem',
                  padding: '9px 12px',
                  width: '100%',
                  outline: 'none',
                }}
              >
                <option value="">All</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Month */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: Colors.blueMuted,
                  letterSpacing: '0.05em',
                }}
              >
                Month
              </label>
              <select
                value={monthInput}
                onChange={(e) => setMonthInput(e.target.value)}
                style={{
                  background: Colors.skyFaintSm,
                  border: `1.5px solid ${Colors.skyBd}`,
                  color: Colors.blue,
                  fontSize: '0.9rem',
                  borderRadius: '0.75rem',
                  padding: '9px 12px',
                  width: '100%',
                  outline: 'none',
                }}
              >
                <option value="">All</option>
                {availableMonths.map(([val, name]) => (
                  <option key={val} value={val}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: Colors.blueMuted,
                  letterSpacing: '0.05em',
                }}
              >
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  background: Colors.skyFaintSm,
                  border: `1.5px solid ${Colors.skyBd}`,
                  color: Colors.blue,
                  fontSize: '0.9rem',
                  borderRadius: '0.75rem',
                  padding: '9px 12px',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>

            {/* Date To */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: Colors.blueMuted,
                  letterSpacing: '0.05em',
                }}
              >
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  background: Colors.skyFaintSm,
                  border: `1.5px solid ${Colors.skyBd}`,
                  color: Colors.blue,
                  fontSize: '0.9rem',
                  borderRadius: '0.75rem',
                  padding: '9px 12px',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>

            <button
              onClick={applyDateFilter}
              style={{
                padding: '9px 12px',
                borderRadius: '0.75rem',
                border: 'none',
                background: Colors.blue,
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                width: '100%',
              }}
            >
              Apply Filter
            </button>

            <button
              onClick={clearDateFilter}
              style={{
                padding: '9px 12px',
                borderRadius: '0.75rem',
                border: `1.5px solid ${Colors.skyBd}`,
                background: hasActiveDateFilter ? Colors.skyFaintSm : 'transparent',
                color: hasActiveDateFilter ? Colors.blue : Colors.blueMuted,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                width: '100%',
              }}
            >
              Clear Filter
            </button>
          </div>
        </>
      </div>

      {saveSuccess && (
        <div
          className="mb-6 rounded-xl px-4 py-3"
          style={{
            background: Colors.greenFaint,
            color: Colors.green,
            fontSize: '0.875rem',
            fontWeight: 700,
          }}
        >
          {saveSuccess}
        </div>
      )}

      {/* Bookings list */}
      <div style={card} className="p-6">
        <h2 style={{ ...typography.h2, marginBottom: '1.5rem' }}>{selectedStatusLabel}</h2>

        {loading && (
          <p style={{ color: Colors.blueMuted, textAlign: 'center', padding: '2rem 0' }}>
            Loading bookings...
          </p>
        )}

        {!loading && fetchError && (
          <p style={{ color: '#ff0000', textAlign: 'center', padding: '2rem 0' }}>
            {fetchError}
          </p>
        )}

        {!loading && !fetchError && (
          <div className="space-y-3">
            {filtered.length === 0 && (
              <p style={{ color: Colors.blueMuted, textAlign: 'center', padding: '2rem 0' }}>
                No bookings match your search.
              </p>
            )}

            {filtered.map((booking) => {
              const meta = getBookingStatusMeta(booking);
              const color = meta.color;
              const statusKey = getBookingStatusKey(booking);
              const action = ACTION_EFFECTS[statusKey];
              const dbId = booking.dbId || booking.id;

              return (
                <div
                  key={dbId}
                  className="rounded-xl overflow-hidden transition-all duration-150 hover:shadow-md"
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
                    {/* Top row: ID + status badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: Colors.blue }}>
                        {booking.id}
                      </span>
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: color,
                          color: color === '#ffde59' ? '#3878C2' : Colors.white,
                          border: `1px solid ${color}`,
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>

                    {/* Fields grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <p
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: Colors.blueMuted,
                          }}
                        >
                          CUSTOMER
                        </p>
                        <p
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 600,
                            color: Colors.blue,
                          }}
                        >
                          {booking.customerName}
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
                          SERVICE
                        </p>
                        <p
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 600,
                            color: Colors.blue,
                          }}
                        >
                          {booking.serviceType || booking.service}
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
                          DATE
                        </p>
                        <p
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 600,
                            color: Colors.blue,
                          }}
                        >
                          {booking.date || '-'}
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
                          AMOUNT
                        </p>
                        <p
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 600,
                            color: Colors.green,
                          }}
                        >
                          {booking.amount}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => navigate(`/bookings/${dbId}`)}
                        className="px-4 py-2 rounded-lg transition-all duration-150 hover:shadow-md"
                        style={{
                          background: Colors.blue,
                          color: Colors.white,
                          fontSize: '0.875rem',
                          fontWeight: 600,
                        }}
                      >
                        View Details
                      </button>

                      <button
                        onClick={() => handleUpdateStatus(booking)}
                        disabled={!action || saveLoading === dbId}
                        className="px-4 py-2 rounded-lg transition-all duration-150 hover:shadow-md"
                        style={{
                          background: action ? Colors.skyFaint : '#f1f5f9',
                          color: action ? Colors.blue : Colors.blueMuted,
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: action ? 'pointer' : 'not-allowed',
                          opacity: saveLoading === dbId ? 0.7 : 1,
                        }}
                      >
                        {saveLoading === dbId
                          ? 'Updating...'
                          : action?.actionLabel || 'No Action Available'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}