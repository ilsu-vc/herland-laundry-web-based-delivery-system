import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import VerticalStepper from "../../../shared/components/VerticalStepper";
import { supabase } from "../../../lib/supabase";
import { formatDate, formatTime } from "../../../shared/utils/formatters";
import { useToast } from "../../../shared/components/Toast";
import { useConfirm } from "../../../shared/components/ConfirmationModal";

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/customer`;
const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

const STATUS_META = {
  BookingReceived:           { label: 'Booking Received' },
  BookingAccepted:           { label: 'Booking Accepted' },
  BookingEdited:             { label: 'Booking Edited' },
  PaymentConfirmed:          { label: 'Payment Confirmed' },
  RiderDispatchedForPickup:  { label: 'Rider Dispatch for Pickup' },
  PickedUpFromCustomer:      { label: 'Picked Up from Customer' },
  InProgress:                { label: 'Laundry In Progress' },
  OutForDelivery:            { label: 'Out for Delivery' },
  ReadyForPickup:            { label: 'Ready for Pick-up' },
  LaundryDelivered:          { label: 'Laundry Delivered' },
  BookingCompleted:          { label: 'Booking Completed' },
  FeedbackSubmitted:         { label: 'Feedback Submitted' },
  BookingCancelled:          { label: 'Booking Cancelled' },
  PaymentFlagged:            { label: 'Payment Flagged' },
};

const STATUS_LABEL_TO_KEY = Object.entries(STATUS_META).reduce((acc, [key, meta]) => {
  acc[meta.label] = key;
  return acc;
}, {});

const ACTION_EFFECTS = {
  BookingReceived: { actionLabel: 'Confirm Payment', status: 'Payment Confirmed', nextStage: 'payment' },
  PaymentConfirmed: { actionLabel: 'Accept Booking', status: 'Booking Accepted', nextStage: 'dynamic' },
  BookingEdited: { actionLabel: 'Confirm Payment', status: 'Payment Confirmed', nextStage: 'dynamic' },
  BookingAccepted: { actionLabel: 'Dispatch Rider for Pickup', status: 'Rider Dispatched for Pickup', nextStage: 'shipping' },
  RiderDispatchedForPickup: { actionLabel: 'Confirm Pick Up', status: 'Picked Up from Customer', nextStage: 'shipping' },
  PickedUpFromCustomer: { actionLabel: 'Start Laundry', status: 'Laundry In Progress', nextStage: 'preparation' },
  InProgress: { actionLabel: 'Dispatch Rider for Delivery', status: 'Out for Delivery', nextStage: 'shipping' },
  OutForDelivery: { actionLabel: 'Confirm Delivery', status: 'Laundry Delivered', nextStage: 'shipping' },
  ReadyForPickup: { actionLabel: 'Complete Booking', status: 'Booking Completed', nextStage: 'final' },
  LaundryDelivered: { actionLabel: 'Complete Booking', status: 'Booking Completed', nextStage: 'final' },
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
  if (!booking) return '';
  const latestTimelineStatus = getLatestStatusFromTimeline(booking.timeline);
  return getStatusKey(latestTimelineStatus || booking.status || booking.stage);
}

export default function BookingDetails() {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editTimeLeft, setEditTimeLeft] = useState(null); // seconds remaining, null = not computed yet
  const editWarningShown = useRef(false);

  const activeRole = String(window.sessionStorage.getItem('activeRole') || '').toLowerCase();
  const isAdminOrStaff = activeRole === 'admin' || activeRole === 'staff';

  const fetchBooking = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setError("Please log in to view booking details.");
        setLoading(false);
        return;
      }

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

  // ── 15-minute edit countdown timer ──────────────────────────────────────
  useEffect(() => {
    if (!booking?.created_at) return;
    if (booking.status?.toLowerCase() !== "pending") return;

    const createdAt = new Date(booking.created_at).getTime();
    const deadline = createdAt + EDIT_WINDOW_MS;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setEditTimeLeft(remaining);

      if (remaining <= 0 && !editWarningShown.current) {
        if (!isAdminOrStaff) {
          editWarningShown.current = true;
          showToast(
            "⚠️ The 15-minute editing window has expired. You can no longer edit this booking.",
            "error"
          );
        }
      }
    };

    tick(); // immediate first check
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [booking?.created_at, booking?.status]);

  const formatCountdown = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const isEditWindowOpen = isAdminOrStaff || (editTimeLeft !== null && editTimeLeft > 0);
  // ─────────────────────────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (!(await confirm("Are you sure you want to cancel this booking?"))) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        showToast("Session expired. Please log in again.", "error");
        return;
      }

      const response = await fetch(`${API_BASE}/my-bookings/${bookingId}/cancel`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        showToast("Booking cancelled successfully.", "success");
        fetchBooking();
      } else {
        const data = await response.json();
        showToast(data.error || "Failed to cancel booking.", "error");
      }
    } catch (err) {
      console.error("Error cancelling booking:", err);
      showToast("An error occurred. Please try again.", "error");
    }
  };

  const handleEdit = () => {
    if (!isEditWindowOpen) {
      showToast(
        "⚠️ The 15-minute editing window has expired. You can no longer edit this booking.",
        "error"
      );
      return;
    }
    navigate(`/book?edit=${bookingId}`);
  };

  const handlePayNow = () => {
    navigate('/payment', {
      state: {
        bookingReference: booking.referenceNumber || booking.id,
        amountToPay: booking.paymentDetails?.amountToPay || booking.paymentDetails?.totalAmount,
        paymentReference: booking.paymentDetails?.referenceNumber,
        isDownpayment: booking.paymentDetails?.downpaymentRequired > 0
      }
    });
  };

  const handleNextStatus = async () => {
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
      showToast("No available next status for this booking.", "error");
      return;
    }

    if (!(await confirm(`Are you sure you want to advance the status to "${action.status}"?`))) return;

    const payment = booking.paymentDetails || booking.payment_details || {};
    const paymentMethod = payment.method || 'GCash';

    if (
      action.status === 'Payment Confirmed' &&
      paymentMethod === 'GCash' &&
      !payment.referenceNumber
    ) {
      showToast('GCash reference number is required before confirming payment.', 'error');
      return;
    }

    const nextStage =
      action.nextStage === 'dynamic'
        ? booking.collectionOption === 'pickedUpDelivered' || booking.collection_option === 'pickedUpDelivered'
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        showToast("Session expired. Please log in again.", "error");
        return;
      }

      const ADMIN_API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/admin`;
      
      const response = await fetch(`${ADMIN_API_BASE}/bookings/${bookingId}/status`, {
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

      showToast(`Booking updated to ${action.status}.`, "success");
      fetchBooking();
    } catch (err) {
      console.error("Error updating status:", err);
      showToast("Could not update the booking status.", "error");
    }
  };

  const buildFullTimeline = (bk) => {
    if (!bk) return [];

    const timeline = bk.timeline || [
      { status: "Booking Received", timestamp: new Date().toISOString() },
    ];

    // Check if terminal statuses exist
    const hasCompleted = timeline.some((s) => s.status === "Laundry Delivered");
    const hasCancelled = timeline.some((s) => s.status === "Booking Cancelled");
    const hasFlagged = timeline.some((s) => s.status === "Payment Flagged");
    if (hasCompleted || hasCancelled || hasFlagged) return timeline;

    // Determine which future steps to show
    const allStatuses = timeline.map((s) => s.status);
    const isDelivery =
      bk.collectionOption === "dropOffDelivered" ||
      bk.collectionOption === "pickedUpDelivered";
    const isPickupRequired = bk.collectionOption === "pickedUpDelivered";

    const futureSteps = [
      "Booking Received",
      "Payment Confirmed",
      "Booking Accepted",
    ];

    if (isPickupRequired) {
      futureSteps.push("Rider Dispatched for Pickup");
      futureSteps.push("Picked Up from Customer");
    }

    futureSteps.push("Laundry In Progress");

    if (isDelivery) {
      futureSteps.push("Out for Delivery");
      futureSteps.push("Laundry Delivered");
    } else {
      futureSteps.push("Ready for Pick-up");
    }

    futureSteps.push("Booking Completed");
    futureSteps.push("Feedback Submitted");

    // Add any future steps that haven't been reached yet (with null timestamp)
    const result = [...timeline];
    for (const step of futureSteps) {
      if (!allStatuses.includes(step)) {
        result.push({ status: step, timestamp: null });
      }
    }

    return result;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white px-4 py-6 sm:py-10">
        <div className="mx-auto w-full max-w-2xl md:max-w-5xl lg:max-w-6xl">
          <p className="text-lg text-[#b4b4b4]">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white px-4 py-6 sm:py-10">
        <div className="mx-auto w-full max-w-2xl md:max-w-5xl lg:max-w-6xl">
          <header className="mb-6 flex items-center gap-2 text-[#3878c2]">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center"
              aria-label="Go back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-semibold">Booking Details</h1>
          </header>
          <p className="text-lg text-[#e55353]">{error}</p>
        </div>
      </div>
    );
  }

  const referenceNumber = booking?.id || bookingId;
  const fullTimeline = buildFullTimeline(booking);


  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl md:max-w-5xl lg:max-w-6xl">
        {/* Header */}
        <header className="mb-6 flex items-center gap-2 text-[#3878c2]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center"
            aria-label="Go back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
          </button>
          <h1 className="text-2xl font-semibold">Booking Details</h1>
          <div className="ml-auto flex gap-2">
            {isAdminOrStaff && booking && ACTION_EFFECTS[getBookingStatusKey(booking)] && (
              <button
                onClick={handleNextStatus}
                className="rounded-lg border border-[#3878c2] bg-[#3878c2] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2d62a3] shadow-sm transition"
              >
                Next: {ACTION_EFFECTS[getBookingStatusKey(booking)].actionLabel}
              </button>
            )}
            {activeRole === 'admin' && booking?.status?.toLowerCase() !== "cancelled" && (
              <button
                onClick={() => navigate(`/bookings/${bookingId}/receipt`)}
                className="rounded-lg border border-[#4bad40] px-3 py-1.5 text-sm font-medium text-[#4bad40] hover:bg-[#4bad40]/5 transition"
              >
                View Receipt
              </button>
            )}
            {booking?.status?.toLowerCase() === "pending" && (
              <>
                {/* Edit button with countdown */}
                <button
                  onClick={handleEdit}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition flex items-center gap-1.5 ${
                    isEditWindowOpen
                      ? 'border-[#3878c2] text-[#3878c2] hover:bg-[#3878c2]/5'
                      : 'border-gray-300 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  Edit
                  {!isAdminOrStaff && editTimeLeft !== null && editTimeLeft > 0 && (
                    <span className="text-[10px] font-mono bg-[#3878c2]/10 text-[#3878c2] px-1.5 py-0.5 rounded">
                      {formatCountdown(editTimeLeft)}
                    </span>
                  )}
                  {!isAdminOrStaff && editTimeLeft !== null && editTimeLeft <= 0 && (
                    <span className="text-[10px] font-mono bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">
                      Expired
                    </span>
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  className="rounded-lg border border-[#e55353] px-3 py-1.5 text-sm font-medium text-[#e55353] hover:bg-[#e55353]/5 transition"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </header>

        {/* Reference Number */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#b4b4b4]">
            Reference number
          </h2>
          <p className="text-xl font-bold break-all text-[#3878c2]">
            {referenceNumber}
          </p>
          {booking?.riderName && (
            <div className="mt-2 flex items-center gap-2">
              <div className="size-2 rounded-full bg-[#4bad40] animate-pulse"></div>
              <p className="text-sm font-semibold text-[#4bad40]">
                Assigned Rider: <span className="font-bold">{booking.riderName}</span>
              </p>
            </div>
          )}
        </div>

        <div className="mb-8 border-t border-[#f0f0f0]" />

        {/* Cancellation Notice - Show only if booking is cancelled */}
        {booking?.status?.toLowerCase() === "cancelled" && (
          <div className="mb-6 rounded-2xl border border-[#e55353]/20 bg-[#fef2f2] p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-[#e55353]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#e55353] mb-2">Booking Cancelled</h4>
                <p className="text-xs text-[#374151] leading-relaxed">
                  {booking?.cancellationReason ? (
                    <>
                      <span className="font-medium">Reason:</span> {booking.cancellationReason}
                    </>
                  ) : (
                    "This booking has been cancelled by our staff. Common reasons for cancellation include: failed or incomplete payment verification, inability to process the requested services, scheduling conflicts, or other operational issues. If you have questions about this cancellation, please contact our support team."
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Timeline */}
          <div className="lg:col-span-1">
            <h3 className="mb-4 text-lg font-semibold text-[#3878c2]">Tracking</h3>
            <div className="rounded-2xl border border-[#3878c2]/20 bg-[#f9fbff] p-6 shadow-sm">
              <VerticalStepper steps={fullTimeline} />
            </div>
          </div>

          {/* Right Column: Booking Info */}
          <div className="space-y-6 lg:col-span-2">
            {/* Service Summary Card */}
            <div className="rounded-2xl border border-[#3878c2]/20 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-[#3878c2]">
                Service Summary
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-[#b4b4b4]">
                    Selected Services
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-[#374151]">
                    {booking?.serviceDetails?.selectedServices?.length > 0 ? (
                      booking.serviceDetails.selectedServices.map((s) => (
                        <li key={s} className="capitalize">{s}</li>
                      ))
                    ) : (
                      <li>-</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#b4b4b4]">
                    Add-Ons
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-[#374151]">
                    {booking?.serviceDetails?.selectedAddons?.length > 0 ? (
                      booking.serviceDetails.selectedAddons.map((addon) => (
                        <li key={addon.name}>
                          {addon.name}: {addon.quantity} pcs
                        </li>
                      ))
                    ) : (
                      <li>None</li>
                    )}
                  </ul>
                </div>
                <div className="sm:col-span-2 grid grid-cols-2 gap-4 border-t border-[#f0f0f0] pt-4 mt-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-[#b4b4b4]">
                      No. of Bags/Loads
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#374151]">
                      {booking?.serviceDetails?.numberOfBags || "-"}
                    </p>
                  </div>
                  {booking?.serviceDetails?.bagDescription && (
                    <div className="col-span-1">
                      <p className="text-xs font-semibold uppercase text-[#b4b4b4]">
                        Bag Description
                      </p>
                      <p className="mt-1 text-sm text-[#374151] italic">
                        "{booking.serviceDetails.bagDescription}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Collection & Delivery Card */}
            <div className="rounded-2xl border border-[#3878c2]/20 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-[#3878c2]">
                Collection & Delivery
              </h3>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-[#b4b4b4]">
                      Collection
                    </p>
                    <div className="text-sm text-[#374151]">
                      <p className="font-medium">
                        {formatDate(booking?.collectionDetails?.collectionDate)}
                      </p>
                      <p>{formatTime(booking?.collectionDetails?.collectionTime)}</p>
                      <p className="mt-1 text-xs text-[#b4b4b4]">
                        {booking?.collectionDetails?.pickupAddress}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-[#b4b4b4]">
                      Delivery
                    </p>
                    <div className="text-sm text-[#374151]">
                      <p className="font-medium">
                        {formatDate(booking?.collectionDetails?.deliveryDate)}
                      </p>
                      <p>{formatTime(booking?.collectionDetails?.deliveryTime)}</p>
                      <p className="mt-1 text-xs text-[#b4b4b4]">
                        {booking?.collectionDetails?.deliveryAddress}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-[#eef6ff] p-3 text-sm text-[#3878c2]">
                  <span className="font-semibold">Mode:</span>{" "}
                  {booking?.collectionDetails?.optionLabel || "-"}
                </div>
                {booking?.collectionDetails?.customerAddress && (
                  <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm text-[#374151]">
                    <span className="font-semibold text-[#b4b4b4] uppercase text-xs">Home / Pinned Address:</span>
                    <p className="mt-1 font-medium">{booking.collectionDetails.customerAddress}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Card */}
            <div className="rounded-2xl border border-[#3878c2]/20 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-[#3878c2]">
                Payment Details
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-[#b4b4b4]">
                    Method
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#374151]">
                    {booking?.paymentDetails?.method || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#b4b4b4]">
                    Status
                  </p>
                  <span className="mt-1 inline-flex items-center rounded-full bg-[#fdf2f2] px-2.5 py-0.5 text-xs font-medium text-[#e55353] capitalize">
                    {booking?.paymentDetails?.status || "Pending"}
                  </span>
                </div>
                {booking?.paymentDetails?.method === "GCash" && (
                  <div className="sm:col-span-2 mt-2 space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-[#b4b4b4]">
                        GCash Reference Number
                      </p>
                      <p className="mt-1 text-xl font-black text-[#374151] font-mono tracking-wider">
                        {booking?.paymentDetails?.referenceNumber && booking.paymentDetails.referenceNumber !== "-" 
                          ? booking.paymentDetails.referenceNumber 
                          : <span className="text-gray-400 font-normal italic text-base">Empty</span>}
                      </p>
                    </div>

                    {!isAdminOrStaff && (!booking?.paymentDetails?.referenceNumber || booking?.paymentDetails?.referenceNumber === "-") && (
                      <button
                        onClick={handlePayNow}
                        className="w-full rounded-lg border border-[#4bad40] bg-[#4bad40] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#3e8e35] transition shadow-sm"
                      >
                        Submit GCash Reference
                      </button>
                    )}
                  </div>
                )}
                <div className="sm:col-span-2 space-y-3 mt-2 border-t border-[#f0f0f0] pt-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[#3878c2] font-bold uppercase text-xs">Total Amount</span>
                    <span className="text-2xl font-black text-[#3878c2]">₱{booking?.paymentDetails?.totalAmount?.toFixed(2) || "0.00"}</span>
                  </div>
                  {booking?.paymentDetails?.method === "GCash" && (
                    <p className="mt-1 text-xs text-[#b4b4b4]">
                      Payment to be settled upon collection.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {booking?.notes && (
              <div className="rounded-2xl border border-[#3878c2]/20 bg-white p-6 shadow-sm">
                <h3 className="mb-2 text-lg font-semibold text-[#3878c2]">
                  Special Instructions
                </h3>
                <p className="text-sm text-[#374151] italic">
                  "{booking.notes}"
                </p>
              </div>
            )}

            {/* Feedback Section */}
            {(booking?.status?.toLowerCase() === "delivered" || booking?.status?.toLowerCase() === "completed" || booking?.status?.toLowerCase() === "booking completed") && (
              <div className="rounded-2xl border border-[#3878c2]/20 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-[#3878c2]">
                  {isAdminOrStaff ? "Customer Feedback" : "Your Experience"}
                </h3>

                {(booking.customer_feedback || booking.rider_feedback || booking.customerFeedback || booking.riderFeedback) ? (
                  isAdminOrStaff ? (
                    <div className="space-y-4">
                      {/* Render Customer Feedback */}
                      {(booking.customer_feedback || booking.customerFeedback) && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <p className="text-sm font-bold text-[#374151] mb-2">Service Feedback</p>
                          <div className="flex items-center mb-2">
                            <span className="text-[#f59e0b] font-bold text-lg mr-1">★</span>
                            <span className="font-semibold text-[#374151]">{(booking.customer_feedback || booking.customerFeedback).rating} / 5</span>
                          </div>
                          {(booking.customer_feedback || booking.customerFeedback).review_tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {(booking.customer_feedback || booking.customerFeedback).review_tags.map(tag => (
                                <span key={tag} className="text-[10px] bg-[#3878c2]/10 text-[#3878c2] px-2 py-1 rounded-full uppercase font-semibold">{tag}</span>
                              ))}
                            </div>
                          )}
                          {(booking.customer_feedback || booking.customerFeedback).review_comment && (
                            <p className="text-sm text-[#374151] italic">"{(booking.customer_feedback || booking.customerFeedback).review_comment}"</p>
                          )}
                        </div>
                      )}

                      {/* Render Rider Feedback */}
                      {(booking.rider_feedback || booking.riderFeedback) && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mt-3">
                          <p className="text-sm font-bold text-[#374151] mb-2">Rider Feedback</p>
                          <div className="flex items-center mb-2">
                            <span className="text-[#f59e0b] font-bold text-lg mr-1">★</span>
                            <span className="font-semibold text-[#374151]">{(booking.rider_feedback || booking.riderFeedback).rating} / 5</span>
                          </div>
                          {(booking.rider_feedback || booking.riderFeedback).review_tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {(booking.rider_feedback || booking.riderFeedback).review_tags.map(tag => (
                                <span key={tag} className="text-[10px] bg-[#3878c2]/10 text-[#3878c2] px-2 py-1 rounded-full uppercase font-semibold">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 text-center py-6">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mx-auto h-12 w-12 text-[#4bad40] mb-2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                       </svg>
                      <p className="text-lg font-semibold text-[#374151]">Feedback Submitted</p>
                      <p className="text-sm text-[#b4b4b4]">Thank you for sharing your experience with us!</p>
                    </div>
                  )
                ) : (
                  isAdminOrStaff ? (
                    <div className="space-y-4 text-center py-6">
                      <p className="text-sm font-medium text-[#b4b4b4]">Waiting for customer to submit feedback.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-[#374151]">
                        How was our service? Your feedback helps us improve!
                      </p>

                      <button
                        onClick={() => navigate(`/feedback/${bookingId}`)}
                        className="w-full rounded-xl bg-[#3878c2] py-3 text-sm font-bold text-white shadow-md hover:bg-[#2d62a3] transition-all"
                      >
                        Submit Feedback
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}