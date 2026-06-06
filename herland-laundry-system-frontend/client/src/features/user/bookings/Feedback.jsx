import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useToast } from "../../../shared/components/Toast";

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/customer`;
const C = {
  blue: "#3878C2",
  sky: "#63BCE6",
  green: "#4BAD40",
  white: "#FFFFFF",
  skyFaint: "rgba(99,188,230,0.10)",
  skyFaintStrong: "rgba(99,188,230,0.12)",
  skyBorder: "rgba(99,188,230,0.30)",
  skyBorderStrong: "rgba(99,188,230,0.38)",
  blueMuted: "rgba(56,120,194,0.50)",
};

const laundryTags = {
  positive: [
    "Clean & Fresh",
    "Neat Folding",
    "Complete Items",
    "No Damage",
    "Good Value",
  ],
  negative: [
    "Poor Cleaning",
    "Poorly Folded",
    "Unpleasant Smell",
    "Damaged Items",
    "Missing Items",
  ],
};

const riderTags = {
  positive: [
    "On Time",
    "Polite",
    "Friendly",
    "Careful Handling",
    "Easy to Contact",
  ],
  negative: [
    "Not on Time",
    "Rude",
    "Hard to Contact",
    "Careless Handling",
    "Wrong Address",
  ],
};

const cardStyle = {
  background: C.white,
  border: `1px solid ${C.skyBorder}`,
  borderRadius: "1.25rem",
  boxShadow: "0 4px 24px rgba(56,120,194,0.07)",
};

function StarIcon({ active, hover }) {
  return (
    <svg
      width="38"
      height="38"
      viewBox="0 0 24 24"
      fill={active ? C.blue : hover ? C.sky : "none"}
      stroke={active ? C.blue : hover ? C.sky : C.skyBorderStrong}
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden="true"
      className="sm:h-10 sm:w-10"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function StarRating({ value, onChange, label }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div
      className="flex items-center justify-center gap-1.5"
      role="radiogroup"
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = value >= star;
        const hover = hovered >= star && !active;

        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onClick={() => onChange(value === star ? 0 : star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(0)}
            className="transition-transform duration-100 focus:outline-none"
            style={{
              transform: active || hover ? "scale(1.12)" : "scale(1)",
            }}
          >
            <StarIcon active={active} hover={hover} />
          </button>
        );
      })}
    </div>
  );
}

function TagButton({ label, selected, disabled, positive, onClick }) {
  const selectedColor = positive ? C.sky : C.blue;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 focus:outline-none sm:text-[0.8rem]"
      style={{
        background: selected ? selectedColor : C.white,
        border: `1.5px solid ${selected ? selectedColor : C.skyBorder}`,
        color: selected ? C.white : C.blue,
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: selected ? "0 2px 8px rgba(56,120,194,0.18)" : "none",
      }}
    >
      {label}
    </button>
  );
}

function TagSection({
  rating,
  selectedTags,
  setSelectedTags,
  tagSet,
  emptyText,
  positiveText,
  negativeText,
}) {
  const hasRating = rating > 0;
  const positive = rating >= 4;
  const tags = positive ? tagSet.positive : tagSet.negative;

  const toggleTag = (tag) => {
    if (!hasRating) return;

    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((item) => item !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div>
      <p
        className="mb-3 text-sm font-semibold"
        style={{ color: hasRating ? C.blue : C.blueMuted }}
      >
        {!hasRating ? emptyText : positive ? positiveText : negativeText}
      </p>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <TagButton
            key={tag}
            label={tag}
            selected={selectedTags.includes(tag)}
            disabled={!hasRating}
            positive={positive}
            onClick={() => toggleTag(tag)}
          />
        ))}
      </div>

      {hasRating && selectedTags.length > 0 && (
        <p className="mt-3 text-xs font-medium" style={{ color: C.blueMuted }}>
          {selectedTags.length} selected
        </p>
      )}
    </div>
  );
}

export default function RatingsPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [booking, setBooking] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [customerRating, setCustomerRating] = useState(0);
  const [customerReviewTags, setCustomerReviewTags] = useState([]);
  const [customerReviewComment, setCustomerReviewComment] = useState("");

  const [riderRating, setRiderRating] = useState(0);
  const [riderReviewTags, setRiderReviewTags] = useState([]);

  const [commentFocused, setCommentFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fetchBooking = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setError("Please log in to submit feedback.");
        setLoading(false);
        return;
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const response = await fetch(
        `${API_BASE}/my-bookings/${encodeURIComponent(bookingId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Validation 1: Booking is delivered/completed
        const terminalStatuses = ['delivered', 'completed', 'booking completed'];
        if (!terminalStatuses.includes((data.status || '').toLowerCase())) {
          setError("Feedback can only be provided for completed bookings.");
          setLoading(false);
          return;
        }

        // Validation 2: Feedback doesn't already exist
        if (data.customer_feedback || data.rider_feedback) {
          setError("Feedback has already been submitted for this booking.");
          setLoading(false);
          return;
        }

        setBooking(data);
      } else if (response.status === 404) {
        setError("Booking not found.");
      } else {
        setError("Could not load booking details.");
      }
    } catch (err) {
      console.error("Error fetching booking:", err);
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  if (loading) {
    return (
      <main className="min-h-screen px-7 py-12 flex items-center justify-center" style={{ background: C.skyFaint }}>
        <p className="text-lg font-medium" style={{ color: C.blueMuted }}>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen px-7 py-12 flex items-center justify-center" style={{ background: C.skyFaint }}>
        <div style={cardStyle} className="p-8 text-center max-w-md w-full">
          <p className="text-lg font-bold mb-6 text-[#e55353]">{error}</p>
          <button
            onClick={() => navigate(`/bookings/${bookingId}`)}
            className="rounded-xl px-8 py-3 text-sm font-bold transition-all duration-150"
            style={{
              background: C.blue,
              color: C.white,
            }}
          >
            Return to booking
          </button>
        </div>
      </main>
    );
  }

  const bookingRows = [
    { label: "Reference No.", value: booking?.id || bookingId },
    { label: "Service Type", value: booking?.customerName || booking?.service_type || "Laundry Service" },
    { label: "Rider Name", value: booking?.riderName || booking?.rider_name || (booking?.rider_id ? "Assigned" : "N/A") },
  ];

  const handleCustomerRating = (value) => {
    if ((customerRating >= 4) !== (value >= 4)) {
      setCustomerReviewTags([]);
    }

    setCustomerRating(value);
  };

  const handleRiderRating = (value) => {
    if ((riderRating >= 4) !== (value >= 4)) {
      setRiderReviewTags([]);
    }

    setRiderRating(value);
  };

  const handleCommentChange = (e) => {
    setCustomerReviewComment(e.target.value.slice(0, 500));
  };

  const canSubmit = customerRating > 0 && riderRating > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        showToast("Session expired. Please log in again.", "error");
        return;
      }

      const payload = {
        customer_feedback: {
          rating: customerRating,
          review_tags: customerReviewTags,
          review_comment: customerReviewComment.trim() || null,
        },
        rider_feedback: {
          rider_id: booking.rider_id,
          rating: riderRating,
          review_tags: riderReviewTags,
        }
      };

      const response = await fetch(`${API_BASE}/my-bookings/${encodeURIComponent(bookingId)}/feedback`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showToast("Feedback submitted successfully. Thank you!", "success");
        setSubmitted(true);
      } else {
        const data = await response.json();
        showToast(data.error || "Failed to submit feedback.", "error");
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
      showToast("An error occurred. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCustomerRating(0);
    setCustomerReviewTags([]);
    setCustomerReviewComment("");

    setRiderRating(0);
    setRiderReviewTags([]);

    setSubmitted(false);
  };

  return (
    <main
      className="min-h-screen px-7 py-12 sm:px-8 md:flex md:items-center md:justify-center md:px-10 md:py-8"
      style={{
        background: C.skyFaint,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div className="mx-auto flex w-full max-w-screen-xl flex-col md:min-h-[70vh]">
        {!submitted ? (
          <>
            <header className="mb-5 sm:mb-6">
              <button
                type="button"
                onClick={() => navigate(`/bookings/${bookingId}`)}
                className="mb-4 inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:text-[#63bce6]"
                style={{ color: C.blue }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Return to booking
              </button>
              <h1
                className="text-2xl font-extrabold tracking-tight sm:text-3xl"
                style={{ color: C.blue }}
              >
                How was your experience?
              </h1>

              <p
                className="mt-2 text-sm sm:text-[0.94rem]"
                style={{ color: C.blueMuted }}
              >
                Your feedback helps us serve you better.
              </p>
            </header>

            <section className="grid flex-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-4">
                <div style={cardStyle} className="px-5 py-5 sm:px-6">
                  <p className="mb-4 text-sm font-bold" style={{ color: C.blue }}>
                    Booking Details
                  </p>

                  <div className="flex flex-col gap-2">
                    {bookingRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-baseline gap-2"
                      >
                        <span
                          className="whitespace-nowrap text-[0.7rem] font-bold uppercase tracking-wider"
                          style={{ color: C.blue }}
                        >
                          {row.label}
                        </span>

                        <span
                          className="text-sm font-semibold"
                          style={{ color: C.sky }}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={cardStyle}
                  className="flex flex-1 flex-col justify-center px-5 py-6 sm:px-6"
                >
                  <div className="flex flex-col items-center text-center">
                    <p
                      className="text-base font-bold sm:text-[1.06rem]"
                      style={{ color: C.blue }}
                    >
                      Rate your laundry experience
                    </p>

                    <div className="mt-3">
                      <StarRating
                        value={customerRating}
                        onChange={handleCustomerRating}
                        label="Laundry rating"
                      />
                    </div>
                  </div>

                  <div
                    className="my-4 border-t"
                    style={{ borderColor: C.skyBorder }}
                  />

                  <div className="flex flex-col items-center text-center">
                    <p
                      className="text-base font-bold sm:text-[1.06rem]"
                      style={{ color: C.blue }}
                    >
                      Rate the rider
                    </p>

                    <div className="mt-3">
                      <StarRating
                        value={riderRating}
                        onChange={handleRiderRating}
                        label="Rider rating"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={cardStyle} className="flex flex-col px-5 py-6 sm:px-6">
                <TagSection
                  rating={customerRating}
                  selectedTags={customerReviewTags}
                  setSelectedTags={setCustomerReviewTags}
                  tagSet={laundryTags}
                  emptyText="Select a laundry rating first"
                  positiveText="What did you like about your laundry?"
                  negativeText="What went wrong with your laundry?"
                />

                <div
                  className="my-4 border-t"
                  style={{ borderColor: C.skyBorder }}
                />

                <TagSection
                  rating={riderRating}
                  selectedTags={riderReviewTags}
                  setSelectedTags={setRiderReviewTags}
                  tagSet={riderTags}
                  emptyText="Select a rider rating first"
                  positiveText="What did you like about the rider?"
                  negativeText="What can our rider improve?"
                />
              </div>

              <div style={cardStyle} className="flex flex-col px-5 py-6 sm:px-6">
                <p className="mb-4 text-sm font-semibold" style={{ color: C.blue }}>
                  Additional comments
                </p>

                <textarea
                  value={customerReviewComment}
                  onChange={handleCommentChange}
                  onFocus={() => setCommentFocused(true)}
                  onBlur={() => setCommentFocused(false)}
                  placeholder="Tell us more about your laundry experience..."
                  className="min-h-72 w-full flex-1 resize-none rounded-xl p-4 text-sm transition-all duration-150 focus:outline-none md:min-h-[7rem]"
                  style={{
                    background: C.skyFaintStrong,
                    border: `1.5px solid ${
                      commentFocused ? C.sky : C.skyBorder
                    }`,
                    boxShadow: commentFocused
                      ? "0 0 0 3px rgba(99,188,230,0.18)"
                      : "none",
                    color: C.blue,
                    lineHeight: 1.65,
                  }}
                />

                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs" style={{ color: C.blueMuted }}>
                    Optional • Up to 500 characters
                  </p>

                  <p className="text-xs" style={{ color: C.blueMuted }}>
                    {customerReviewComment.length} / 500
                  </p>
                </div>
              </div>
            </section>

            <div className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate(`/bookings/${bookingId}`)}
                className="w-full sm:w-auto rounded-xl px-6 py-3 text-sm font-bold transition-all duration-150 border-2"
                style={{
                  borderColor: C.blue,
                  color: C.blue,
                  background: 'transparent'
                }}
              >
                Return to booking
              </button>

              <p className="text-xs sm:text-sm text-center flex-1" style={{ color: C.blueMuted }}>
                {!canSubmit
                  ? "Please select both laundry and rider ratings to submit"
                  : "Tags and comments are optional"}
              </p>

              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={handleSubmit}
                className="w-full rounded-xl px-8 py-3 text-sm font-bold transition-all duration-150 sm:w-auto"
                style={{
                  background: canSubmit ? C.green : "rgba(99,188,230,0.18)",
                  color: canSubmit ? C.white : "rgba(99,188,230,0.65)",
                  cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
                  boxShadow: canSubmit
                    ? "0 4px 14px rgba(75,173,64,0.28)"
                    : "none",
                }}
              >
                {submitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </>
        ) : (
          <section className="flex flex-1 items-center">
            <div
              className="flex w-full flex-col items-center rounded-2xl px-8 py-12 text-center"
              style={cardStyle}
            >
              <h2
                className="mb-6 text-2xl font-extrabold tracking-tight"
                style={{ color: C.blue }}
              >
                Thank you for your feedback!
              </h2>

              <button
                type="button"
                onClick={() => navigate(`/bookings/${bookingId}`)}
                className="rounded-xl px-8 py-3 text-sm font-bold transition-all duration-150"
                style={{
                  background: C.green,
                  color: C.white,
                  boxShadow: "0 4px 14px rgba(75,173,64,0.28)",
                }}
              >
                Return to booking
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}