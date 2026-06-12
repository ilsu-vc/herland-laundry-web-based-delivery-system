import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { parseDateString, formatDateMMDDYYYY } from '../../shared/utils/formatters';

const Colors = {
  blue: '#3878C2',
  sky: '#63BCE6',
  green: '#4BAD40',
  white: '#FFFFFF',
  blueMuted: 'rgba(56, 120, 194, 0.68)',
  skyFaint: 'rgba(99, 188, 230, 0.10)',
  skyBd: 'rgba(99, 188, 230, 0.28)',
  greenFaint: 'rgba(75, 173, 64, 0.10)',
  greenBd: 'rgba(75, 173, 64, 0.25)',
  red: '#EB5757',
  redFaint: 'rgba(235, 87, 87, 0.08)',
  redBd: 'rgba(235, 87, 87, 0.25)',
};

const card = {
  background: Colors.white,
  border: `1px solid ${Colors.skyBd}`,
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(56, 120, 194, 0.08)',
};

const typography = {
  h1: {
    fontSize: '2rem',
    fontWeight: 900,
    color: Colors.blue,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    margin: 0,
  },
  h2: {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: Colors.blue,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    margin: 0,
  },
  body: {
    fontSize: '0.95rem',
    color: Colors.blueMuted,
    lineHeight: 1.6,
    margin: 0,
  },
};

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/admin`;

const EMPTY_FILTERS = {
  feedbackType: 'all',
  feedbackStatus: 'all',
  timePeriod: 'all',
  startDate: '',
  endDate: '',
};

function formatDate(value) {
  if (!value) return 'No date';
  const formatted = formatDateMMDDYYYY(value);
  return formatted || 'No date';
}

function getInitials(name) {
  if (!name) return 'NA';

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function getDisplayName(profile, fallback = 'Unknown User') {
  return profile?.full_name || profile?.email || fallback;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.filter(Boolean);

  if (typeof tags === 'string') {
    return tags
      .replace(/[{}"]/g, '')
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function getServiceText(booking) {
  if (!booking) return 'Full Service Laundry';

  const serviceDetails = booking.service_details || {};

  return (
    booking.service_type ||
    serviceDetails.service_type ||
    serviceDetails.serviceName ||
    serviceDetails.service ||
    serviceDetails.name ||
    'Full Service Laundry'
  );
}

function getAddOnsText(booking) {
  if (!booking?.service_details) return 'None';

  const serviceDetails = booking.service_details;

  const possibleAddOns =
    serviceDetails.addons ||
    serviceDetails.addOns ||
    serviceDetails.selectedAddOns ||
    serviceDetails.add_ons ||
    [];

  if (Array.isArray(possibleAddOns) && possibleAddOns.length > 0) {
    return possibleAddOns
      .map(item => {
        if (typeof item === 'string') return item;
        return item?.name || item?.label || item?.title || '';
      })
      .filter(Boolean)
      .join(', ');
  }

  return 'None';
}

function isWithinTimePeriod(createdAt, period) {
  if (!createdAt || period === 'all') return true;

  const date = new Date(createdAt);
  const now = new Date();
  const start = new Date(now);

  if (period === 'weekly') {
    start.setDate(now.getDate() - 7);
  }

  if (period === 'monthly') {
    start.setMonth(now.getMonth() - 1);
  }

  if (period === 'yearly') {
    start.setFullYear(now.getFullYear() - 1);
  }

  return date >= start && date <= now;
}

function isWithinDateRange(createdAt, startDate, endDate) {
  const date = parseDateString(createdAt);
  if (!date) return false;

  if (startDate) {
    const start = parseDateString(startDate);
    if (!start) return false;
    start.setHours(0, 0, 0, 0);

    if (date < start) return false;
  }

  if (endDate) {
    const end = parseDateString(endDate);
    if (!end) return false;
    end.setHours(23, 59, 59, 999);

    if (date > end) return false;
  }

  return true;
}

function getAverage(values) {
  const validValues = values.filter(value => Number(value) > 0);

  if (!validValues.length) return null;

  const total = validValues.reduce((sum, value) => sum + Number(value), 0);
  return (total / validValues.length).toFixed(1);
}

function getPositive(records) {
  return records.filter(record => {
    const laundryPositive = record.laundryRating >= 4;
    const riderPositive = record.riderRating >= 4;

    if (record.laundryRating && record.riderRating) return laundryPositive && riderPositive;
    if (record.laundryRating) return laundryPositive;
    if (record.riderRating) return riderPositive;

    return false;
  }).length;
}

function getNegative(records) {
  return records.filter(record => {
    const laundryNegative = record.laundryRating && record.laundryRating <= 3;
    const riderNegative = record.riderRating && record.riderRating <= 3;

    return laundryNegative || riderNegative;
  }).length;
}

function StarDisplay({ rating, size = 13 }) {
  const starColor = rating >= 4 ? Colors.green : rating === 3 ? Colors.sky : Colors.red;

  if (!rating) {
    return (
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: Colors.blueMuted,
        }}
      >
        No rating
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= rating ? starColor : 'none'}
          stroke={star <= rating ? starColor : Colors.skyBd}
          strokeWidth={1.8}
          strokeLinejoin="round"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function TagPill({ tag, positive }) {
  return (
    <span
      style={{
        fontSize: '0.6875rem',
        fontWeight: 700,
        borderRadius: '2rem',
        padding: '3px 10px',
        background: positive ? Colors.greenFaint : Colors.redFaint,
        color: positive ? Colors.green : Colors.red,
        border: `1px solid ${positive ? Colors.greenBd : Colors.redBd}`,
        lineHeight: 1.4,
      }}
    >
      {tag}
    </span>
  );
}

function SummaryCard({ label, value, sub, color }) {
  return (
    <div style={{ ...card, padding: '1.125rem 1.25rem' }}>
      <p
        style={{
          fontSize: '1.65rem',
          fontWeight: 900,
          color,
          lineHeight: 1,
          margin: 0,
        }}
      >
        {value}
      </p>

      <p
        style={{
          fontSize: '0.8125rem',
          fontWeight: 800,
          color: '#1f2937',
          marginTop: 8,
          marginBottom: 0,
        }}
      >
        {label}
      </p>

      <p
        className="hidden sm:block"
        style={{
          fontSize: '0.75rem',
          color: Colors.blueMuted,
          marginTop: 3,
          marginBottom: 0,
        }}
      >
        {sub}
      </p>
    </div>
  );
}

function SelectInput({ label, value, onChange, children }) {
  return (
    <div>
      <p
        style={{
          fontSize: '0.75rem',
          fontWeight: 800,
          color: Colors.blueMuted,
          marginBottom: 6,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </p>

      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={event => onChange(event.target.value)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            background: Colors.white,
            border: `1.5px solid ${Colors.skyBd}`,
            borderRadius: 10,
            padding: '10px 36px 10px 14px',
            fontSize: '0.875rem',
            fontWeight: 700,
            color: Colors.blue,
            cursor: 'pointer',
            outline: 'none',
            fontFamily: 'Inter, sans-serif',
            width: '100%',
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
          }}
          width={13}
          height={13}
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
    <div>
      <p
        style={{
          fontSize: '0.75rem',
          fontWeight: 800,
          color: Colors.blueMuted,
          marginBottom: 6,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </p>

      <input
        type="date"
        value={value}
        onChange={event => onChange(event.target.value)}
        style={{
          background: Colors.white,
          border: `1.5px solid ${Colors.skyBd}`,
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: '0.875rem',
          fontWeight: 700,
          color: Colors.blue,
          outline: 'none',
          fontFamily: 'Inter, sans-serif',
          width: '100%',
          boxShadow: '0 1px 4px rgba(56,120,194,0.06)',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

function EmptyState({ title, message }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 1rem',
        gap: 10,
        textAlign: 'center',
      }}
    >
      <img
        src="/images/WashingMachine.png"
        alt=""
        style={{
          width: 92,
          height: 92,
          objectFit: 'contain',
          opacity: 0.85,
          marginBottom: 4,
        }}
      />

      <p style={{ fontWeight: 800, color: Colors.blue, margin: 0 }}>{title}</p>

      <p
        style={{
          fontSize: '0.875rem',
          color: Colors.blueMuted,
          textAlign: 'center',
          maxWidth: 340,
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        {message}
      </p>
    </div>
  );
}

function RatingSection({ title, rating, tags }) {
  const positive = Number(rating) >= 4;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <p
          style={{
            fontSize: '0.65rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: Colors.blueMuted,
            margin: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </p>

        <StarDisplay rating={rating} size={13} />
      </div>

      {tags?.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(tag => (
            <TagPill key={`${title}-${tag}`} tag={tag} positive={positive} />
          ))}
        </div>
      ) : (
        <p
          style={{
            fontSize: '0.8125rem',
            color: Colors.blueMuted,
            margin: 0,
          }}
        >
          No tags selected.
        </p>
      )}
    </div>
  );
}

function MetaLine({ label, value }) {
  return (
    <p
      style={{
        fontSize: '0.875rem',
        fontWeight: 900,
        color: Colors.blue,
        lineHeight: 1.4,
        margin: 0,
        wordBreak: 'break-word',
      }}
    >
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: Colors.blueMuted,
        }}
      >
        {label}:
      </span>{' '}
      {value || 'N/A'}
    </p>
  );
}

function FeedbackCard({ record }) {
  return (
    <div
      style={{
        border: `1px solid ${Colors.skyBd}`,
        borderRadius: 18,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'stretch',
        minHeight: 0,
        height: 'auto',
        background: Colors.white,
      }}
      className="flex-col lg:flex-row"
    >
      <div
        style={{
          background: 'rgba(56,120,194,0.04)',
          borderRight: `1px solid ${Colors.skyBd}`,
          padding: '1.45rem 1.4rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          flexShrink: 0,
        }}
        className="w-full lg:w-[25%]"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: Colors.skyFaint,
              border: `1.5px solid ${Colors.skyBd}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 900,
                color: Colors.blue,
              }}
            >
              {record.initials}
            </span>
          </div>

          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: '1rem',
                fontWeight: 900,
                color: '#0f172a',
                lineHeight: 1.2,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {record.customerName}
            </p>

            <p
              style={{
                fontSize: '0.75rem',
                color: Colors.blueMuted,
                marginTop: 5,
                marginBottom: 0,
              }}
            >
              {formatDate(record.createdAt)}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <MetaLine label="Reference No." value={record.referenceNumber} />
          <MetaLine label="Services" value={record.service} />
          <MetaLine label="Add-ons" value={record.addOns} />
          <MetaLine label="Rider Name" value={record.riderName} />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: '1.45rem 1.6rem',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          height: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 26,
            alignItems: 'flex-start',
          }}
          className="flex-col md:flex-row"
        >
          <RatingSection
            title="Laundry Experience"
            rating={record.laundryRating}
            tags={record.laundryTags}
          />

          <div
            style={{
              width: 1,
              alignSelf: 'stretch',
              background: Colors.skyBd,
              flexShrink: 0,
            }}
            className="hidden md:block"
          />

          <RatingSection
            title="Rider Feedback"
            rating={record.riderRating}
            tags={record.riderTags}
          />
        </div>

        {record.comment && (
          <div
            style={{
              borderTop: `1px solid ${Colors.skyBd}`,
              marginTop: 16,
              paddingTop: 16,
              flexShrink: 0,
              height: 'auto',
            }}
          >
            <p
              style={{
                fontSize: '0.875rem',
                color: '#1f2937',
                fontStyle: 'italic',
                margin: 0,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              "{record.comment}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FeedbackReports() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  const [customerFeedback, setCustomerFeedback] = useState([]);
  const [riderFeedback, setRiderFeedback] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchFeedbackReports();
  }, []);

  async function fetchFeedbackReports() {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`${API_BASE}/feedback-reports`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feedback reports');
      }

      const data = await response.json();

      setCustomerFeedback(data.customerFeedback || []);
      setRiderFeedback(data.riderFeedback || []);
      setBookings(data.bookings || []);
      setProfiles(data.profiles || []);
    } catch (error) {
      console.error('Error loading feedback reports:', error);
      setErrorMessage(error?.message || 'Unable to load feedback reports.');
    } finally {
      setLoading(false);
    }
  }

  const bookingMap = useMemo(() => {
    return new Map(bookings.map(booking => [booking.id, booking]));
  }, [bookings]);

  const profileMap = useMemo(() => {
    return new Map(profiles.map(profile => [profile.id, profile]));
  }, [profiles]);

  const supabaseRecords = useMemo(() => {
    const grouped = new Map();

    customerFeedback.forEach(item => {
      const booking = bookingMap.get(item.booking_id);
      const customerProfile = profileMap.get(item.user_id || booking?.user_id);
      const riderProfile = profileMap.get(booking?.rider_id);

      const customerName = getDisplayName(customerProfile, 'Unknown Customer');
      const riderName = getDisplayName(riderProfile, 'No rider assigned');

      grouped.set(item.booking_id, {
        id: `booking-${item.booking_id}`,
        bookingId: item.booking_id,
        referenceNumber: booking?.reference_number || `Booking #${item.booking_id}`,
        customerName,
        initials: getInitials(customerName),
        riderName,
        service: getServiceText(booking),
        addOns: getAddOnsText(booking),
        laundryRating: Number(item.rating || 0),
        riderRating: 0,
        laundryTags: normalizeTags(item.review_tags),
        riderTags: [],
        comment: item.review_comment || '',
        createdAt: item.created_at,
      });
    });

    riderFeedback.forEach(item => {
      const booking = bookingMap.get(item.booking_id);
      const riderProfile = profileMap.get(item.rider_id || booking?.rider_id);
      const customerProfile = profileMap.get(booking?.user_id);

      const riderName = getDisplayName(riderProfile, 'Unknown Rider');
      const customerName = getDisplayName(customerProfile, 'Unknown Customer');

      const existing = grouped.get(item.booking_id);

      grouped.set(item.booking_id, {
        id: `booking-${item.booking_id}`,
        bookingId: item.booking_id,
        referenceNumber: existing?.referenceNumber || booking?.reference_number || `Booking #${item.booking_id}`,
        customerName: existing?.customerName || customerName,
        initials: existing?.initials || getInitials(customerName),
        riderName: existing?.riderName || riderName,
        service: existing?.service || getServiceText(booking),
        addOns: existing?.addOns || getAddOnsText(booking),
        laundryRating: existing?.laundryRating || 0,
        riderRating: Number(item.rating || 0),
        laundryTags: existing?.laundryTags || [],
        riderTags: normalizeTags(item.review_tags),
        comment: existing?.comment || '',
        createdAt: existing?.createdAt || item.created_at,
      });
    });

    return Array.from(grouped.values()).sort((a, b) => {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [customerFeedback, riderFeedback, bookingMap, profileMap]);

  const records = useMemo(() => {
    return supabaseRecords;
  }, [supabaseRecords]);

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      if (appliedFilters.feedbackType === 'customer' && !record.laundryRating) {
        return false;
      }

      if (appliedFilters.feedbackType === 'rider' && !record.riderRating) {
        return false;
      }

      if (appliedFilters.feedbackStatus === 'positive') {
        const laundryPositive = record.laundryRating ? record.laundryRating >= 4 : true;
        const riderPositive = record.riderRating ? record.riderRating >= 4 : true;

        if (!laundryPositive || !riderPositive) return false;
      }

      if (appliedFilters.feedbackStatus === 'negative') {
        const laundryNegative = record.laundryRating && record.laundryRating <= 3;
        const riderNegative = record.riderRating && record.riderRating <= 3;

        if (!laundryNegative && !riderNegative) return false;
      }

      if (!isWithinTimePeriod(record.createdAt, appliedFilters.timePeriod)) {
        return false;
      }

      if (!isWithinDateRange(record.createdAt, appliedFilters.startDate, appliedFilters.endDate)) {
        return false;
      }

      return true;
    });
  }, [records, appliedFilters]);

  const customerRatings = filteredRecords.map(record => record.laundryRating);
  const riderRatings = filteredRecords.map(record => record.riderRating);

  const averageCustomerRating = getAverage(customerRatings);
  const averageRiderRating = getAverage(riderRatings);

  const totalReviews = filteredRecords.length;
  const positiveCount = getPositive(filteredRecords);
  const negativeCount = getNegative(filteredRecords);

  const positivePct = totalReviews ? Math.round((positiveCount / totalReviews) * 100) : 0;
  const negativePct = totalReviews ? Math.round((negativeCount / totalReviews) * 100) : 0;

  function updateFilter(key, value) {
    setFilters(previous => ({
      ...previous,
      [key]: value,
    }));
  }

  function handleApplyFilter() {
    setAppliedFilters(filters);
  }

  function handleClearFilter() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 style={typography.h1}>Feedback Reports</h1>

        <p style={{ ...typography.body, marginTop: '0.5rem' }}>
          Monitor customer satisfaction, rider performance, ratings, reviews, and common feedback trends.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <SummaryCard
            label="Average Customer Rating"
            value={averageCustomerRating ? `${averageCustomerRating} / 5` : '0 / 5'}
            sub="Laundry feedback"
            color={Colors.blue}
          />

          <SummaryCard
            label="Average Rider Rating"
            value={averageRiderRating ? `${averageRiderRating} / 5` : '0 / 5'}
            sub="Rider performance"
            color={Colors.sky}
          />

          <SummaryCard
            label="Total Reviews"
            value={String(totalReviews)}
            sub="Matching current filters"
            color={Colors.blue}
          />

          <SummaryCard
            label="Positive Feedback"
            value={`${positivePct}%`}
            sub="4–5 star ratings"
            color={Colors.green}
          />

          <SummaryCard
            label="Negative Feedback"
            value={`${negativePct}%`}
            sub="1–3 star ratings"
            color={Colors.red}
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
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: Colors.blueMuted,
              margin: 0,
            }}
          >
            Filters
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SelectInput
              label="Feedback Type"
              value={filters.feedbackType}
              onChange={value => updateFilter('feedbackType', value)}
            >
              <option value="all">All Feedback</option>
              <option value="customer">Customer Feedback</option>
              <option value="rider">Rider Feedback</option>
            </SelectInput>

            <SelectInput
              label="Feedback Status"
              value={filters.feedbackStatus}
              onChange={value => updateFilter('feedbackStatus', value)}
            >
              <option value="all">All Feedback</option>
              <option value="positive">Positive Feedback</option>
              <option value="negative">Negative Feedback</option>
            </SelectInput>

            <SelectInput
              label="Time Period"
              value={filters.timePeriod}
              onChange={value => updateFilter('timePeriod', value)}
            >
              <option value="all">All Time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </SelectInput>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
            }}
          >
            <div style={{ flex: 1, minWidth: 160 }}>
              <DateInput
                label="Start Date"
                value={filters.startDate}
                onChange={value => updateFilter('startDate', value)}
              />
            </div>

            <div style={{ flex: 1, minWidth: 160 }}>
              <DateInput
                label="End Date"
                value={filters.endDate}
                onChange={value => updateFilter('endDate', value)}
              />
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 160,
                display: 'flex',
                gap: 12,
              }}
            >
              <button
                onClick={handleApplyFilter}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: Colors.blue,
                  color: Colors.white,
                  fontSize: '0.875rem',
                  fontWeight: 800,
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
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${Colors.skyBd}`,
                  background: Colors.white,
                  color: Colors.blue,
                  fontSize: '0.875rem',
                  fontWeight: 800,
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

        {errorMessage && (
          <div
            style={{
              ...card,
              borderColor: Colors.redBd,
              background: Colors.redFaint,
              padding: '1rem 1.25rem',
            }}
          >
            <p style={{ color: Colors.red, fontWeight: 800, margin: 0 }}>
              {errorMessage}
            </p>
          </div>
        )}

        {loading ? (
          <div style={{ ...card, padding: '3rem 1rem', textAlign: 'center' }}>
            <p style={{ color: Colors.blue, fontWeight: 800, margin: 0 }}>
              Loading feedback reports...
            </p>
          </div>
        ) : (
          <div style={{ ...card, padding: '1.25rem 1.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <h2 style={typography.h2}>Customer & Rider Feedback</h2>

                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: Colors.blueMuted,
                    marginTop: 4,
                    marginBottom: 0,
                  }}
                >
                  Combined laundry and rider reviews per booking.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredRecords.length === 0 ? (
                <EmptyState
                  title="No feedback found"
                  message="No feedback matches the selected filters."
                />
              ) : (
                filteredRecords.map(record => (
                  <FeedbackCard key={record.id} record={record} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}