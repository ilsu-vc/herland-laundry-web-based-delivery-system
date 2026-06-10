import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { parseDateString } from '../../shared/utils/formatters';

const Colors = {
  blue: '#3878C2',
  sky: '#63BCE6',
  green: '#4BAD40',
  yellow: '#ffde59',
  gray: '#b4b4b4',
  white: '#FFFFFF',
  red: '#EB5757',
  blueMuted: 'rgba(56,120,194,0.68)',
  skyFaint: 'rgba(99,188,230,0.12)',
  skyFaintSm: 'rgba(99,188,230,0.08)',
  greenFaint: 'rgba(75,173,64,0.12)',
  redFaint: 'rgba(235,87,87,0.1)',
  skyBd: 'rgba(99,188,230,0.24)',
};

const card = {
  background: Colors.white,
  border: `1px solid ${Colors.skyBd}`,
  borderRadius: 18,
  boxShadow: '0 8px 28px rgba(56,120,194,0.08)',
};

const typography = {
  h1: {
    fontSize: '2rem',
    fontWeight: 900,
    color: Colors.blue,
    lineHeight: 1.1,
    margin: 0,
    fontFamily: 'Inter, sans-serif',
  },
  h2: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: Colors.blue,
    lineHeight: 1.2,
    margin: 0,
    fontFamily: 'Inter, sans-serif',
  },
  body: {
    fontSize: '0.95rem',
    color: Colors.blueMuted,
    lineHeight: 1.6,
    margin: 0,
    fontFamily: 'Inter, sans-serif',
  },
};

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/admin`;

const REPORT_OPTIONS = [
  {
    value: 'booking-volume',
    label: 'Booking Volume Trend',
    description: 'Track total number of bookings over time.',
    supportedCharts: ['bar', 'line'],
  },
  {
    value: 'collected-amount',
    label: 'Collected Amount Trend',
    description: 'Total amount collected from completed bookings only.',
    supportedCharts: ['bar', 'line'],
  },
  {
    value: 'success-failure',
    label: 'Booking Success vs Failure Rate',
    description: 'Compare successful completed bookings vs failed or cancelled ones.',
    supportedCharts: ['bar', 'pie'],
  },
  {
    value: 'total-collected',
    label: 'Total Amount Collected',
    description: 'Summary of total amount collected with supporting stats.',
    supportedCharts: ['bar'],
  },
];

const PIE_COLORS = [Colors.blue, Colors.red];

function isBookingLikeObject(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;

  return (
    'id' in item ||
    'reference_number' in item ||
    'referenceNumber' in item ||
    'user_id' in item ||
    'userId' in item ||
    'created_at' in item ||
    'createdAt' in item ||
    'schedule' in item ||
    'status' in item ||
    'stage' in item ||
    'amount_to_pay' in item ||
    'amountToPay' in item ||
    'service_details' in item ||
    'serviceDetails' in item
  );
}

function normalizeBookingsResponse(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const directPossibleArrays = [
    payload?.bookings,
    payload?.data,
    payload?.data?.bookings,
    payload?.data?.data,
    payload?.data?.rows,
    payload?.data?.records,
    payload?.data?.results,
    payload?.rows,
    payload?.records,
    payload?.results,
    payload?.items,
    payload?.payload,
    payload?.payload?.bookings,
    payload?.response,
    payload?.response?.bookings,
  ];

  for (const possibleArray of directPossibleArrays) {
    if (Array.isArray(possibleArray)) {
      return possibleArray;
    }
  }

  function findBookingArray(value, depth = 0) {
    if (!value || depth > 5) return [];

    if (Array.isArray(value)) {
      if (value.length === 0) return [];
      if (value.some(isBookingLikeObject)) return value;
      return [];
    }

    if (typeof value !== 'object') return [];

    const preferredKeys = [
      'bookings',
      'data',
      'rows',
      'records',
      'results',
      'items',
      'payload',
      'response',
    ];

    for (const key of preferredKeys) {
      const found = findBookingArray(value[key], depth + 1);
      if (found.length > 0) return found;
    }

    for (const key of Object.keys(value)) {
      const found = findBookingArray(value[key], depth + 1);
      if (found.length > 0) return found;
    }

    return [];
  }

  return findBookingArray(payload);
}

function getBookingDate(booking) {
  return (
    booking.created_at ||
    booking.createdAt ||
    booking.date ||
    booking.schedule ||
    booking.timeline?.[0]?.timestamp ||
    null
  );
}

function getBookingStatus(booking) {
  return String(booking.status || booking.bookingStatus || booking.stage || '').trim();
}

function getLowerStatus(booking) {
  return getBookingStatus(booking).toLowerCase();
}

function isCompletedBooking(booking) {
  const status = getLowerStatus(booking);
  const stage = String(booking.stage || '').toLowerCase();
  const timeline = Array.isArray(booking.timeline) ? booking.timeline : [];
  const timelineText = timeline.map((item) => String(item.status || '').toLowerCase()).join(' ');

  return (
    status.includes('laundry delivered') ||
    status.includes('feedback submitted') ||
    status.includes('completed') ||
    status.includes('complete') ||
    status === 'done' ||
    status === 'delivered' ||
    status === 'success' ||
    stage === 'done' ||
    stage === 'final' ||
    timelineText.includes('laundry delivered') ||
    timelineText.includes('feedback submitted') ||
    timelineText.includes('completed')
  );
}

function isFailedBooking(booking) {
  const status = getLowerStatus(booking);
  const stage = String(booking.stage || '').toLowerCase();
  const timeline = Array.isArray(booking.timeline) ? booking.timeline : [];
  const timelineText = timeline.map((item) => String(item.status || '').toLowerCase()).join(' ');

  return (
    status.includes('cancel') ||
    status.includes('fail') ||
    status.includes('flagged') ||
    status === 'cancelled' ||
    status === 'failure' ||
    stage === 'cancelled' ||
    stage === 'failed' ||
    timelineText.includes('cancel') ||
    timelineText.includes('fail') ||
    timelineText.includes('flagged')
  );
}

function getAmount(booking) {
  return Number(
    booking.amount_to_pay ||
      booking.amountToPay ||
      booking.payment_details?.totalAmount ||
      booking.paymentDetails?.totalAmount ||
      booking.payment_details?.total_amount ||
      booking.paymentDetails?.total_amount ||
      booking.payment_details?.amount ||
      booking.paymentDetails?.amount ||
      0
  );
}

function getBookingLabel(dateValue, period) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  if (period === 'weekly') {
    return `Week ${Math.ceil(date.getDate() / 7)}`;
  }

  if (period === 'yearly') {
    return String(date.getFullYear());
  }

  return date.toLocaleDateString('en-PH', { month: 'short' });
}

function isWithinDateRange(booking, startDate, endDate) {
  const dateValue = getBookingDate(booking);
  if (!dateValue) return true;

  const date = parseDateString(dateValue);
  if (!date) return true;

  let start = null;
  let end = null;

  if (startDate) {
    start = parseDateString(startDate);
    if (!start) return true;
    start.setHours(0, 0, 0, 0);
  }

  if (endDate) {
    end = parseDateString(endDate);
    if (!end) return true;
    end.setHours(23, 59, 59, 999);
  }

  if (start && date < start) return false;
  if (end && date > end) return false;

  return true;
}

function formatMoney(value) {
  return `₱${Number(value || 0).toLocaleString()}`;
}

function ChartTooltip({ active, payload, label, peso }) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: Colors.white,
        border: `1px solid ${Colors.skyBd}`,
        borderRadius: 12,
        padding: '10px 16px',
        boxShadow: '0 4px 20px rgba(56,120,194,0.14)',
        fontFamily: 'Inter, sans-serif',
        minWidth: 120,
      }}
    >
      {label && (
        <p
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: Colors.blueMuted,
            marginBottom: 6,
          }}
        >
          {label}
        </p>
      )}

      {payload.map((p, i) => (
        <p
          key={i}
          style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            color: p.color || Colors.blue,
            marginBottom: i < payload.length - 1 ? 3 : 0,
          }}
        >
          {p.name ? (
            <span style={{ fontWeight: 500, color: Colors.blueMuted }}>{p.name}: </span>
          ) : null}
          {peso ? '₱' : ''}
          {Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function SelectInput({ label, value, onChange, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: Colors.blueMuted,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </label>

      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            width: '100%',
            background: Colors.white,
            border: `1.5px solid ${Colors.skyBd}`,
            borderRadius: 10,
            padding: '10px 38px 10px 14px',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: Colors.blue,
            cursor: 'pointer',
            outline: 'none',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 1px 4px rgba(56,120,194,0.06)',
          }}
        >
          {children}
        </select>

        <svg
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            flexShrink: 0,
          }}
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke={Colors.blue}
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: Colors.blueMuted,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </label>

      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          background: Colors.white,
          border: `1.5px solid ${Colors.skyBd}`,
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: Colors.blue,
          outline: 'none',
          fontFamily: 'Inter, sans-serif',
          boxShadow: '0 1px 4px rgba(56,120,194,0.06)',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

function SummaryIcon({ type }) {
  if (type === 'completed') {
    return (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    );
  }

  if (type === 'failed') {
    return (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12V16.5Zm9-4.5a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    );
  }

  if (type === 'money') {
    return (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    );
  }

  return (
    <svg
      className="w-6 h-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2.25 4.5H6.75A2.25 2.25 0 0 1 4.5 18.25V5.75A2.25 2.25 0 0 1 6.75 3.5h6.879c.596 0 1.168.237 1.591.659l2.621 2.621c.422.423.659.995.659 1.591v9.879a2.25 2.25 0 0 1-2.25 2.25Z" />
    </svg>
  );
}

function SummaryCard({ label, value, color, icon, iconBg }) {
  return (
    <div
      className="text-center md:text-left"
      style={{
        ...card,
        overflow: 'hidden',
      }}
    >
      <div className="block md:hidden p-4">
        <span
          className="block text-3xl font-black"
          style={{ color }}
        >
          {value}
        </span>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: Colors.blue, marginTop: '0.5rem' }}>
          {label}
        </p>
      </div>

      <div className="hidden md:flex p-6 items-center justify-between">
        <div>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: Colors.blue }}>
            {label}
          </p>
          <span
            className="block text-3xl font-black mt-3"
            style={{ color }}
          >
            {value}
          </span>
        </div>

        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: iconBg, color }}
        >
          <SummaryIcon type={icon} />
        </div>
      </div>
    </div>
  );
}

function ReportsContent({ bookings }) {
  const [report, setReport] = useState('booking-volume');
  const [period, setPeriod] = useState('monthly');
  const [chartType, setChartType] = useState('bar');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [appliedStartDate, setAppliedStartDate] = useState('2026-01-01');
  const [appliedEndDate, setAppliedEndDate] = useState('2026-12-31');

  const reportMeta = REPORT_OPTIONS.find((o) => o.value === report) || REPORT_OPTIONS[0];
  const supported = reportMeta.supportedCharts;
  const activeChart = supported.includes(chartType) ? chartType : supported[0];
  const isPeso = report === 'collected-amount' || report === 'total-collected';
  const isSplit = report === 'success-failure';
  const isTotalCollected = report === 'total-collected';

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => isWithinDateRange(booking, appliedStartDate, appliedEndDate));
  }, [bookings, appliedStartDate, appliedEndDate]);

  const summaryTotals = useMemo(() => {
    const completedBookings = bookings.filter(isCompletedBooking);
    const failedBookings = bookings.filter(isFailedBooking);

    return {
      totalBookings: bookings.length,
      totalCompleted: completedBookings.length,
      totalFailed: failedBookings.length,
      totalCollected: completedBookings.reduce((sum, booking) => sum + getAmount(booking), 0),
    };
  }, [bookings]);

  const data = useMemo(() => {
    const map = new Map();

    filteredBookings.forEach((booking) => {
      const dateValue = getBookingDate(booking);
      if (!dateValue) return;

      const label = getBookingLabel(dateValue, period);

      if (!map.has(label)) {
        if (report === 'success-failure') {
          map.set(label, { label, success: 0, failed: 0 });
        } else {
          map.set(label, { label, value: 0 });
        }
      }

      const item = map.get(label);

      if (report === 'booking-volume') {
        item.value += 1;
      }

      if (report === 'collected-amount') {
        if (isCompletedBooking(booking)) {
          item.value += getAmount(booking);
        }
      }

      if (report === 'total-collected') {
        if (isCompletedBooking(booking)) {
          item.value += getAmount(booking);
        }
      }

      if (report === 'success-failure') {
        if (isCompletedBooking(booking)) {
          item.success += 1;
        } else if (isFailedBooking(booking)) {
          item.failed += 1;
        }
      }
    });

    return Array.from(map.values());
  }, [filteredBookings, period, report]);

  const pieData = useMemo(() => {
    if (!isSplit) return [];

    return [
      {
        name: 'Successful Bookings',
        value: data.reduce((sum, item) => sum + Number(item.success || 0), 0),
      },
      {
        name: 'Failed / Cancelled',
        value: data.reduce((sum, item) => sum + Number(item.failed || 0), 0),
      },
    ];
  }, [data, isSplit]);

  const tcTotal = useMemo(() => {
    return data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  }, [data]);

  const tcHighest = useMemo(() => {
    const amountData = data.filter((item) => Number(item.value || 0) > 0);
    if (!amountData.length) return null;

    return amountData.reduce((best, item) => {
      return Number(item.value || 0) > Number(best.value || 0) ? item : best;
    }, amountData[0]);
  }, [data]);

  const completedInRange = filteredBookings.filter(isCompletedBooking).length;
  const tcAvg = completedInRange > 0 ? Math.round(tcTotal / completedInRange) : 0;

  const axisStyle = {
    fontSize: 12,
    fill: 'rgba(56,120,194,0.6)',
    fontWeight: 600,
  };

  const gridColor = 'rgba(99,188,230,0.18)';
  const yWidth = isPeso ? 76 : 42;

  const handleApplyFilter = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
  };

  const handleClearFilter = () => {
    setStartDate('2026-01-01');
    setEndDate('2026-12-31');
    setAppliedStartDate('2026-01-01');
    setAppliedEndDate('2026-12-31');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <SummaryCard
          label="Total Bookings"
          value={summaryTotals.totalBookings.toLocaleString()}
          color={Colors.blue}
          icon="bookings"
          iconBg="rgba(56,120,194,0.12)"
        />

        <SummaryCard
          label="Completed Bookings"
          value={summaryTotals.totalCompleted.toLocaleString()}
          color={Colors.green}
          icon="completed"
          iconBg="rgba(75,173,64,0.12)"
        />

        <SummaryCard
          label="Failed / Cancelled"
          value={summaryTotals.totalFailed.toLocaleString()}
          color={Colors.red}
          icon="failed"
          iconBg="rgba(235,87,87,0.1)"
        />

        <SummaryCard
          label="Total Amount Collected"
          value={formatMoney(summaryTotals.totalCollected)}
          color={Colors.sky}
          icon="money"
          iconBg="rgba(99,188,230,0.14)"
        />
      </div>

      <div
        style={{
          ...card,
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: Colors.blueMuted,
          }}
        >
          Filters
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SelectInput value={report} label="Report" onChange={setReport}>
            {REPORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>

          <SelectInput value={period} label="Time Period" onChange={setPeriod}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </SelectInput>

          <SelectInput
            value={activeChart}
            label="Chart Type"
            onChange={(value) => {
              if (supported.includes(value)) {
                setChartType(value);
              }
            }}
          >
            {['bar', 'line', 'pie'].map((type) => (
              <option key={type} value={type} disabled={!supported.includes(type)}>
                {type === 'bar' ? 'Bar Chart' : type === 'line' ? 'Line Chart' : 'Pie Chart'}
              </option>
            ))}
          </SelectInput>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <DateInput label="Start Date" value={startDate} onChange={setStartDate} />
          </div>

          <div style={{ flex: 1, minWidth: 160 }}>
            <DateInput label="End Date" value={endDate} onChange={setEndDate} />
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 160,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 12,
            }}
          >
            <button
              onClick={handleApplyFilter}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: Colors.blue,
                color: Colors.white,
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(56,120,194,0.2)',
              }}
            >
              Apply Filter
            </button>

            <button
              onClick={handleClearFilter}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: `1.5px solid ${Colors.skyBd}`,
                background: Colors.white,
                color: Colors.blue,
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              Clear Filter
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          ...card,
          padding: '1.5rem 1.75rem',
          border: `1.5px solid rgba(56,120,194,0.3)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 24,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <h3 style={{ ...typography.h2, margin: 0 }}>{reportMeta.label}</h3>

              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: Colors.skyFaint,
                  color: Colors.blue,
                  border: `1px solid ${Colors.skyBd}`,
                  borderRadius: 999,
                  padding: '2px 10px',
                }}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </span>
            </div>

            <p style={{ fontSize: '0.875rem', color: Colors.blueMuted, margin: 0 }}>
              {reportMeta.description}
            </p>
          </div>

          {isSplit && activeChart !== 'pie' && (
            <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: Colors.blue }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: Colors.blueMuted }}>
                  Successful
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: Colors.red }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: Colors.blueMuted }}>
                  Failed / Cancelled
                </span>
              </div>
            </div>
          )}
        </div>

        {data.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4rem 0',
              gap: 12,
            }}
          >
            <svg
              width={48}
              height={48}
              viewBox="0 0 24 24"
              fill="none"
              stroke={Colors.skyBd}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>

            <p style={{ fontSize: '1rem', fontWeight: 700, color: Colors.blue }}>No data available</p>

            <p
              style={{
                fontSize: '0.875rem',
                color: Colors.blueMuted,
                textAlign: 'center',
                maxWidth: 320,
              }}
            >
              No valid data yet for this report. Create bookings first or check your booking records.
            </p>
          </div>
        ) : isTotalCollected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <p
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: Colors.blueMuted,
                    marginBottom: 6,
                  }}
                >
                  Total Collected ({period})
                </p>

                <p style={{ fontSize: '2.25rem', fontWeight: 900, color: Colors.blue, lineHeight: 1 }}>
                  {formatMoney(tcTotal)}
                </p>
              </div>

              {[
                { label: 'Completed Bookings', value: completedInRange.toLocaleString() },
                { label: 'Avg per Booking', value: formatMoney(tcAvg) },
                {
                  label: 'Highest Period',
                  value: tcHighest ? `${tcHighest.label} (${formatMoney(tcHighest.value)})` : 'None',
                },
              ].map(({ label, value }) => (
                <div key={label} style={{ minWidth: 140 }}>
                  <p
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      color: Colors.blueMuted,
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </p>

                  <p style={{ fontSize: '1.125rem', fontWeight: 800, color: Colors.blue }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <p
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: Colors.blueMuted,
                  marginBottom: 12,
                }}
              >
                Amount collected per period
              </p>

              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatMoney(value)}
                    width={80}
                  />
                  <Tooltip content={<ChartTooltip peso />} />
                  <Bar dataKey="value" fill={Colors.blue} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : activeChart === 'pie' && isSplit ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={340}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={130}
                  innerRadius={60}
                  dataKey="value"
                  paddingAngle={3}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index]} />
                  ))}
                </Pie>

                <Tooltip content={<ChartTooltip />} />

                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: Colors.blue }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : activeChart === 'line' ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => (isPeso ? formatMoney(value) : String(value))}
                width={yWidth}
              />
              <Tooltip content={<ChartTooltip peso={isPeso} />} />

              {isSplit ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="success"
                    stroke={Colors.blue}
                    strokeWidth={2.5}
                    dot={{ fill: Colors.blue, r: 4 }}
                    name="Successful Bookings"
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    stroke={Colors.red}
                    strokeWidth={2.5}
                    dot={{ fill: Colors.red, r: 4 }}
                    name="Failed / Cancelled"
                  />
                </>
              ) : (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={Colors.blue}
                  strokeWidth={2.5}
                  dot={{ fill: Colors.blue, r: 4 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }} barSize={isSplit ? 20 : 32}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => (isPeso ? formatMoney(value) : String(value))}
                width={yWidth}
              />
              <Tooltip content={<ChartTooltip peso={isPeso} />} />

              {isSplit ? (
                <>
                  <Bar dataKey="success" fill={Colors.blue} radius={[5, 5, 0, 0]} name="Successful Bookings" />
                  <Bar dataKey="failed" fill={Colors.red} radius={[5, 5, 0, 0]} name="Failed / Cancelled" />
                </>
              ) : (
                <Bar dataKey="value" fill={Colors.blue} radius={[5, 5, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function Reports() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function fetchReportsData() {
      try {
        setLoading(true);
        setError('');

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const token = session?.access_token;

        if (!token) {
          throw new Error('Unauthorized: Admin access required');
        }

        let loadedBookings = [];

        try {
          const response = await fetch(`${API_BASE}/bookings`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const payload = await response.json();
            loadedBookings = normalizeBookingsResponse(payload);
          }
        } catch {
          loadedBookings = [];
        }

        if (!loadedBookings.length) {
          const { data, error: supabaseError } = await supabase
            .from('bookings')
            .select('*')
            .order('created_at', { ascending: false });

          if (supabaseError) {
            throw supabaseError;
          }

          loadedBookings = Array.isArray(data) ? data : [];
        }

        if (isMounted) {
          setBookings(loadedBookings);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Something went wrong while loading reports.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchReportsData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 style={typography.h1}>Reports</h1>

        <p style={{ ...typography.body, marginTop: '0.5rem' }}>
          Performance analytics and service quality reports
        </p>
      </div>

      {loading ? (
        <div
          style={{
            ...card,
            minHeight: 260,
            padding: '3rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: Colors.blueMuted,
            fontWeight: 700,
          }}
        >
          Loading reports...
        </div>
      ) : error ? (
        <div
          style={{
            ...card,
            minHeight: 220,
            padding: '3rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: Colors.red,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      ) : (
        <ReportsContent bookings={bookings} />
      )}
    </div>
  );
}