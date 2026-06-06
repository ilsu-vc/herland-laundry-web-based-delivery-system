/**
 * ManageBookings.jsx
 *
 * Admin dashboard component for managing laundry service bookings.
 * Supports viewing, filtering, sorting, and searching bookings by status
 * or customer. Admins can advance bookings through a multi-stage workflow
 * (received → payment → preparation → shipping → final → done), set payment
 * amounts, and track progress via a timeline stepper. All booking data is
 * fetched from and persisted to the Supabase backend through REST API calls.
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import BottomNavbar from '../../shared/navigation/BottomNavbar';
import { STATUS_ORDER, getStatusKey, getStatusMeta } from '../../shared/components/StatusMeta';
import { FilterSelect, RadioRow } from '../../shared/components/OptionInput';
import VerticalStepper from '../../shared/components/VerticalStepper';
import { supabase } from '../../lib/supabase';
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { useConfirm } from "../../shared/components/ConfirmationModal";
import BookNow from "../auth/BookNow";

import { GOOGLE_MAPS_LIBRARIES } from "../../shared/constants/maps";

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/admin`;



const STAGE_ACTIONS = {
  received: ["Accept Booking", "Cancel Booking"],
  payment: ["Confirm Payment", "Flag Payment"],
  pickup: ["Dispatch Rider for Pickup"],  // Only for pickedUpDelivered
  preparation: ["Start Laundry"],
  shipping: [],  // Buttons are determined dynamically by collection option
  final: ["Complete Booking"],
  done: [],
};

const ACTION_EFFECTS = {
  "Accept Booking":              { status: "Booking Accepted",          nextStage: "payment" },
  "Cancel Booking":              { status: "Booking Cancelled",         nextStage: "done" },
  "Confirm Payment":             { status: "Payment Confirmed",         nextStage: "__dynamic__" }, // resolved below
  "Flag Payment":                { status: "Payment Flagged",           nextStage: "done" },
  "Dispatch Rider for Pickup":   { status: "Rider Dispatched for Pickup", nextStage: "preparation" },
  "Start Laundry":               { status: "In Progress",               nextStage: "shipping" },
  "Dispatch Rider for Delivery": { status: "Out for Delivery",          nextStage: "final" },
  "Mark Ready for Pickup":       { status: "Ready for Pick-up",         nextStage: "final" },
  "Complete Booking":            { status: "Booking Completed",         nextStage: "done" },
};

const STAGE_BY_STATUS = {
  "Booking Received":              "received",
  "Booking Accepted":              "payment",
  "Booking Edited":                "payment",
  "Payment Confirmed":             "preparation", // fallback; for pickedUpDelivered it will be "pickup"
  "Payment Flagged":               "done",
  "Rider Dispatched for Pickup":   "preparation",
  "Picked Up from Customer":       "preparation",
  "In Progress":                   "shipping",
  "Ready for Pick-up":             "final",
  "Out for Delivery":              "final",
  "Booking Completed":             "done",
  "Booking Cancelled":             "done",
};

const RED_BUTTONS = ["Cancel Booking", "Flag Payment"];

const getButtonsForBooking = (booking) => {
  // At the shipping stage, button depends on collection option
  if (booking.stage === "shipping") {
    const option = booking.collectionOption || "dropOffPickUpLater";
    if (option === "dropOffPickUpLater") return ["Mark Ready for Pickup"];
    return ["Dispatch Rider for Delivery"]; // dropOffDelivered or pickedUpDelivered
  }

  // At the pickup stage, only pickedUpDelivered bookings land here
  if (booking.stage === "pickup") {
    return ["Dispatch Rider for Pickup"];
  }

  return [...(STAGE_ACTIONS[booking.stage] || [])];
};

const getCurrentStatus = (booking) =>
  booking.timeline[booking.timeline.length - 1]?.status || "Booking Received";

const toTitleCase = (value = "") =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const formatDateForDisplay = (dateValue) => {
  if (!dateValue) return "-";
  const dateObject = new Date(dateValue);
  if (Number.isNaN(dateObject.getTime())) return dateValue;
  return dateObject.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTimeForDisplay = (timeValue) => {
  if (!timeValue) return "-";
  if (!timeValue.includes(":")) return timeValue;

  const [hourText, minuteText] = timeValue.split(":");
  const hourValue = Number(hourText);
  if (Number.isNaN(hourValue)) return timeValue;

  const period = hourValue >= 12 ? "PM" : "AM";
  const formattedHour = hourValue % 12 || 12;
  return `${String(formattedHour).padStart(2, "0")}:${minuteText} ${period}`;
};

const getServicesSummary = (booking) => {
  const saved = booking.serviceDetails;
  if (saved?.selectedServices?.length) {
    return saved.selectedServices.map((service) => toTitleCase(service));
  }

  if (saved?.services) {
    return Object.entries(saved.services)
      .filter(([, selected]) => Boolean(selected))
      .map(([service]) => toTitleCase(service));
  }

  return [];
};

const getAddonsSummary = (booking) => {
  const saved = booking.serviceDetails;
  if (saved?.selectedAddons?.length) {
    return saved.selectedAddons.map((addon) => `${toTitleCase(addon.name)} (${addon.quantity})`);
  }

  if (saved?.addons) {
    return Object.entries(saved.addons)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([addon, quantity]) => `${toTitleCase(addon)} (${quantity})`);
  }

  return [];
};

const getCollectionDetails = (booking) => ({
  mode: booking.collectionDetails?.optionLabel || booking.optionLabel || "-",
  collectionDate: booking.collectionDetails?.collectionDate || "",
  collectionTime: booking.collectionDetails?.collectionTime || "",
  deliveryDate: booking.collectionDetails?.deliveryDate || "",
  deliveryTime: booking.collectionDetails?.deliveryTime || "",
  lat: booking.collectionDetails?.lat || null,
  lng: booking.collectionDetails?.lng || null,
  pickupAddress: booking.collectionDetails?.pickupAddress || "",
  deliveryAddress: booking.collectionDetails?.deliveryAddress || "",
  customerAddress: booking.collectionDetails?.customerAddress || "",
});

const getPaymentDetails = (booking) => {
  const payment = booking.paymentDetails || {};
  const method = payment.method || "GCash";
  const rawReferenceNumber = payment.referenceNumber;
  const isGcashMethod = method.toLowerCase() === "gcash";
  
  // Show reference number if it's not a placeholder and not empty
  const referenceNumber = (rawReferenceNumber !== undefined && rawReferenceNumber !== null && rawReferenceNumber !== "-")
      ? rawReferenceNumber
      : "";

  return {
    method,
    referenceNumber,
    status: payment.status || "Pending",
    amountToPay: payment.amountToPay,
  };
};

const hasReferenceNumber = (referenceNumber) => {
  if (referenceNumber === undefined || referenceNumber === null) return false;
  const normalizedReference = String(referenceNumber).trim();
  return normalizedReference !== "" && normalizedReference !== "-";
};

const canConfirmPaymentForBooking = (booking) => {
  const payment = booking?.paymentDetails || {};
  const paymentMethod = String(payment.method || "GCash").toLowerCase();

  if (paymentMethod !== "gcash") return true;
  return hasReferenceNumber(payment.referenceNumber);
};

function getMonthYear(dateString) {
  if (!dateString || dateString === "-") return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function ManageBookings() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [bookings, setBookings] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all"); // New state
  const [selectedMonth, setSelectedMonth] = useState("All Time");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [sortDirection, setSortDirection] = useState("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [amountDrafts, setAmountDrafts] = useState({});
  const [amountError, setAmountError] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingBookingId, setCancellingBookingId] = useState(null);

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim(),
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Fetch bookings from the database via backend API
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError("");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_BASE}/bookings`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBookings(data);
      } else {
        console.error('Failed to fetch bookings from backend');
        setFetchError('Could not load bookings from the server. Please refresh and try again.');
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setFetchError('Could not connect to the server. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === expandedId) || null,
    [bookings, expandedId]
  );

  useEffect(() => {
    if (!selectedBooking) return;

    const existingAmount = selectedBooking.paymentDetails?.amountToPay;
    setAmountDrafts((prev) => {
      if (prev[selectedBooking.id] !== undefined) return prev;
      return {
        ...prev,
        [selectedBooking.id]:
          existingAmount !== undefined && existingAmount !== null
            ? String(existingAmount)
            : "",
      };
    });
  }, [selectedBooking]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
    setIsEditing(false);
  };

  const applyAction = async (bookingId, actionLabel) => {
    // Special handling for Cancel Booking - show modal first
    if (actionLabel === "Cancel Booking") {
      setCancellingBookingId(bookingId);
      setShowCancelModal(true);
      return;
    }

    const effect = ACTION_EFFECTS[actionLabel];
    if (!effect) return;

    const currentBooking = bookings.find((booking) => booking.id === bookingId);

    if (actionLabel === "Confirm Payment") {
      if (!canConfirmPaymentForBooking(currentBooking)) return;
    }

    // Resolve dynamic nextStage for "Confirm Payment"
    // pickedUpDelivered needs a pickup leg before laundry starts
    let resolvedNextStage = effect.nextStage;
    if (resolvedNextStage === "__dynamic__") {
      resolvedNextStage = currentBooking?.collectionOption === "pickedUpDelivered"
        ? "pickup"
        : "preparation";
    }

    // Build the updated timeline for the API call
    const updatedTimeline = [
      ...(currentBooking?.timeline || []),
      { status: effect.status, timestamp: new Date().toISOString() },
    ];

    // Update local state immediately for responsive UI
    setBookings((prev) =>
      prev.map((booking) => {
        if (booking.id !== bookingId) return booking;

        const nextPaymentDetails = booking.paymentDetails
          ? {
              ...booking.paymentDetails,
              status:
                actionLabel === "Confirm Payment"
                  ? "Payment Confirmed"
                  : actionLabel === "Flag Payment"
                  ? "Payment Flagged"
                  : booking.paymentDetails.status,
            }
          : booking.paymentDetails;

        return {
          ...booking,
          timeline: updatedTimeline,
          stage: resolvedNextStage,
          paymentDetails: nextPaymentDetails,
        };
      })
    );

    // Persist to database via backend
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const dbId = currentBooking?.dbId || bookingId;

      await fetch(`${API_BASE}/bookings/${dbId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: effect.status,
          nextStage: resolvedNextStage,
          timeline: updatedTimeline,
        }),
      });
    } catch (error) {
      console.error('Failed to persist status update:', error);
    }
  };

  const handleCancelWithReason = async () => {
    if (!cancelReason.trim()) {
      return; // Don't proceed without a reason
    }

    const bookingId = cancellingBookingId;
    const effect = ACTION_EFFECTS["Cancel Booking"];
    const currentBooking = bookings.find((booking) => booking.id === bookingId);

    // Build the updated timeline for the API call
    const updatedTimeline = [
      ...(currentBooking?.timeline || []),
      { status: effect.status, timestamp: new Date().toISOString() },
    ];

    // Update local state immediately for responsive UI
    setBookings((prev) =>
      prev.map((booking) => {
        if (booking.id !== bookingId) return booking;

        return {
          ...booking,
          timeline: updatedTimeline,
          stage: effect.nextStage,
          cancellationReason: cancelReason.trim(), // Store the reason locally
        };
      })
    );

    // Persist to database via backend with cancellation reason
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const dbId = currentBooking?.dbId || bookingId;

      await fetch(`${API_BASE}/bookings/${dbId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: effect.status,
          nextStage: effect.nextStage,
          timeline: updatedTimeline,
          cancellationReason: cancelReason.trim(),
        }),
      });
    } catch (error) {
      console.error('Failed to persist cancellation:', error);
    }

    // Close modal and reset state
    setShowCancelModal(false);
    setCancelReason("");
    setCancellingBookingId(null);
  };

  const undoStatus = async (bookingId) => {
    const currentBooking = bookings.find((booking) => booking.id === bookingId);
    if (!currentBooking || !currentBooking.timeline || currentBooking.timeline.length <= 1) return;
    if (!(await confirm("Are you sure you want to revert this booking to its previous status?"))) return;

    const updatedTimeline = currentBooking.timeline.slice(0, -1);
    const previousStatusObj = updatedTimeline[updatedTimeline.length - 1];
    const previousStatus = previousStatusObj.status;
    const previousStage = STAGE_BY_STATUS[previousStatus] || "received";

    // Update local state immediately for responsive UI
    setBookings((prev) =>
      prev.map((booking) => {
        if (booking.id !== bookingId) return booking;

        const nextPaymentDetails = booking.paymentDetails
          ? {
              ...booking.paymentDetails,
              status:
                previousStatus === "Payment Confirmed"
                  ? "Payment Confirmed"
                  : previousStatus === "Payment Flagged"
                  ? "Payment Flagged"
                  : booking.paymentDetails.status,
            }
          : booking.paymentDetails;

        return {
          ...booking,
          timeline: updatedTimeline,
          stage: previousStage,
          paymentDetails: nextPaymentDetails,
        };
      })
    );

    // Persist to database via backend using the normal status endpoint
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const dbId = currentBooking?.dbId || bookingId;

      await fetch(`${API_BASE}/bookings/${dbId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: previousStatus,
          nextStage: previousStage,
          timeline: updatedTimeline,
        }),
      });
    } catch (error) {
      console.error('Failed to persist undo status update:', error);
    }
  };

  const saveAmountToPay = async (bookingId) => {
    const targetBooking = bookings.find((booking) => booking.id === bookingId);
    const paymentStatus = targetBooking?.paymentDetails?.status;
    const isPaymentConfirmed = typeof paymentStatus === "string" && paymentStatus.toLowerCase().includes("payment confirmed");

    if (isPaymentConfirmed) {
      setAmountError("Amount can no longer be edited after payment is confirmed.");
      return;
    }

    const draft = (amountDrafts[bookingId] || "").trim();
    const parsedAmount = Number(draft);

    if (!draft || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError("Enter a valid amount greater than 0.");
      return;
    }

    setAmountError("");
    setSaveLoading(true);
    setSaveSuccess("");

    // Update local state immediately for responsiveness
    setBookings((prev) =>
      prev.map((booking) => {
        if (booking.id !== bookingId) return booking;
        return {
          ...booking,
          paymentDetails: {
            ...(booking.paymentDetails || {}),
            amountToPay: parsedAmount,
          },
        };
      })
    );

    // Persist to database via backend
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const dbId = targetBooking?.dbId || bookingId;

      console.log(`Sending amount update for booking ${dbId}: ${parsedAmount}`);

      const response = await fetch(`${API_BASE}/bookings/${dbId}/amount`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ amountToPay: parsedAmount }),
      });

      if (response.ok) {
        setSaveSuccess("Amount saved successfully!");
        // Clear success message after 3 seconds
        setTimeout(() => setSaveSuccess(""), 3000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to persist amount update:', response.status, errorData);
        setAmountError(errorData.error || "Failed to save amount. Please try again.");
      }
    } catch (error) {
      console.error('Error persisting amount update:', error);
      setAmountError("Could not connect to the server. Please check your connection.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Extract unique months
  const availableMonths = useMemo(() => {
    const months = new Set();
    bookings.forEach(b => {
      const my = getMonthYear(b.date);
      if (my) months.add(my);
    });
    return ["All Time", ...Array.from(months).sort((a, b) => new Date(b) - new Date(a))];
  }, [bookings]);

  // Filter bookings based on selected status and month
  const filteredBookings = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const statusFiltered = bookings.filter((booking) => {
      if (filterStatus !== "all" && getStatusKey(getCurrentStatus(booking)) !== filterStatus) return false;
      if (selectedMonth !== "All Time") {
        const my = getMonthYear(booking.date);
        if (my !== selectedMonth) return false;
      }
      return true;
    });

    const searchFiltered =
      normalizedQuery.length === 0
        ? statusFiltered
        : statusFiltered.filter((booking) => {
            const bookingId = (booking.id || "").toLowerCase();
            const customerName = (booking.customerName || "").toLowerCase();
            return bookingId.includes(normalizedQuery) || customerName.includes(normalizedQuery);
          });

    const sorted = [...searchFiltered].sort((firstBooking, secondBooking) => {
      const timeA = new Date(firstBooking.createdAt || 0).getTime();
      const timeB = new Date(secondBooking.createdAt || 0).getTime();
      // By default sort ascending dates (oldest first)
      return timeA - timeB;
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [filterStatus, selectedMonth, bookings, sortDirection, searchQuery]);

  // Reset to page 1 if filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, selectedMonth, sortDirection, searchQuery]);

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl md:max-w-5xl lg:max-w-6xl">
        <header className="mb-3">
          <div className="flex items-center gap-2 text-[#3878c2]">
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
            <h1 className="text-2xl font-semibold">Manage Bookings</h1>
          </div>
        </header>

        <div className="mb-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_130px_160px_minmax(220px,auto)] md:items-center md:gap-3">
            <label htmlFor="booking-search" className="sr-only">
              Search by reference number or customer name
            </label>
            <input
              id="booking-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference # or customer"
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-[#374151] placeholder:text-gray-400 md:min-w-0"
            />

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-10 w-full border border-gray-300 rounded-md px-3 text-sm bg-white text-[#374151] cursor-pointer outline-none"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>

            <FilterSelect
              id="booking-status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={[
                { value: "all", label: "All Statuses" },
                ...STATUS_ORDER.map((key) => ({
                  value: key,
                  label: getStatusMeta(key).label,
                })),
              ]}
              className="h-10 w-full border border-gray-300 rounded-md px-3 text-sm bg-white"
            />

            <div className="flex h-10 min-w-[220px] items-center justify-between gap-2 rounded-md border border-[#b4b4b4] px-3 sm:col-span-2 lg:col-span-1">
              <p className="whitespace-nowrap text-xs font-semibold text-[#3878c2]">Sort by</p>
              <div className="flex items-center gap-1.5">
                <RadioRow
                  id="sort-ascending"
                  name="sortDirection"
                  label="Ascending"
                  checked={sortDirection === "asc"}
                  onChange={() => setSortDirection("asc")}
                />
                <RadioRow
                  id="sort-descending"
                  name="sortDirection"
                  label="Descending"
                  checked={sortDirection === "desc"}
                  onChange={() => setSortDirection("desc")}
                />
              </div>
            </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading && <p className="text-gray-500 col-span-full">Loading bookings...</p>}
          {fetchError && <p className="text-amber-600 text-sm col-span-full">{fetchError}</p>}
          {!loading && filteredBookings.length === 0 && (
            <p className="text-gray-500 col-span-full">No bookings found for this status.</p>
          )}

          {paginatedBookings.map((booking) => {
            const activeColor = getStatusMeta(getCurrentStatus(booking)).color;
            const buttons = getButtonsForBooking(booking);

            return (
              <div
                key={booking.id}
                className="relative w-full rounded-2xl border border-[#3878c2] bg-white text-left shadow-sm overflow-hidden transition hover:shadow-lg hover:scale-[1.01]"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl"
                  style={{ backgroundColor: activeColor }}
                />

                <div className="relative p-5 flex flex-col gap-2">
                  <button onClick={() => toggleExpand(booking.id)} className="text-left w-full">
                    <h2 className="text-base font-semibold text-[#3878c2] break-words">{booking.customerName}</h2>
                    <p className="text-xs text-[#374151] mt-0.5">{booking.id}</p>
                    <p className="text-xs text-[#374151] mt-0.5">Booking received on {booking.date}</p>
                  </button>

                  {/* Action buttons */}
                  {expandedId === booking.id && buttons.length > 0 && (
                    <p className="mt-2 text-xs text-[#374151]">Expanded in full-screen view.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-8 mb-4 flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-[#3878c2] px-4 py-2 text-sm font-semibold text-[#3878c2] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3878c2]/5 transition"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-[#374151]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg bg-[#3878c2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2d62a3] shadow-sm transition"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {selectedBooking && (() => {
        const buttons = getButtonsForBooking(selectedBooking);
        const serviceList = getServicesSummary(selectedBooking);
        const addonList = getAddonsSummary(selectedBooking);
        const collectionDetails = getCollectionDetails(selectedBooking);
        const paymentDetails = getPaymentDetails(selectedBooking);
        const isPaymentConfirmed = paymentDetails.status.toLowerCase().includes("payment confirmed");
        const canConfirmPayment = canConfirmPaymentForBooking(selectedBooking);
        const isBookingConfirmed = selectedBooking.timeline.some(
          (entry) => 
            entry.status === "Booking Accepted" || 
            entry.status === "Booking Edited" ||
            entry.status === "Payment Confirmed" ||
            selectedBooking.stage !== "received"
        );
        const weight = selectedBooking.serviceDetails?.weight;
        const notes = selectedBooking.notes || "-";

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-white px-4 py-6 sm:py-10">
            {isEditing ? (
              <BookNow 
                inlineEditId={selectedBooking.id} 
                onEditSuccess={() => {
                  setIsEditing(false);
                  fetchBookings();
                }}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <div className="mx-auto w-full max-w-2xl md:max-w-5xl lg:max-w-6xl">
                <header className="mb-6 flex items-center gap-2 text-[#3878c2]">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedId(null);
                      setIsEditing(false);
                    }}
                    className="inline-flex items-center"
                    aria-label="Back to bookings"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                  </button>
                  <h1 className="text-2xl font-semibold">Booking Details</h1>
                  <div className="ml-auto">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="rounded-lg border border-[#3878c2] px-3 py-1.5 text-sm font-medium text-[#3878c2] hover:bg-[#3878c2]/5 transition"
                    >
                      Edit Booking
                    </button>
                  </div>
                </header>

              <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-base font-semibold text-[#3878c2] break-words">{selectedBooking.customerName}</h2>
                  <p className="text-xs text-[#374151] mt-0.5">{selectedBooking.id}</p>
                  <p className="text-xs text-[#374151] mt-0.5">Booking received on {selectedBooking.date}</p>
                </div>
                {selectedBooking.timeline && selectedBooking.timeline.length > 1 && (
                  <button
                    onClick={() => undoStatus(selectedBooking.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#e55353] px-3 py-1.5 text-xs font-semibold text-[#e55353] hover:bg-[#e55353] hover:text-white transition shadow-sm"
                    title="Revert to the previous status"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                    </svg>
                    Undo Status
                  </button>
                )}
              </div>

              {buttons.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {buttons.map((label) => {
                    const isRed = RED_BUTTONS.includes(label);
                    const isConfirmPaymentButton = label === "Confirm Payment";
                    const isDisabled = isConfirmPaymentButton && !canConfirmPayment;
                    return (
                      <button
                        key={label}
                        disabled={isDisabled}
                        onClick={() => applyAction(selectedBooking.id, label)}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold text-white transition ${
                          isDisabled
                            ? "cursor-not-allowed bg-[#9ca3af]"
                            : `hover:opacity-90 ${isRed ? "bg-[#ff0000]" : "bg-[#63bce6]"}`
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
              {buttons.includes("Confirm Payment") && !canConfirmPayment ? (
                <p className="-mt-4 mb-6 text-xs text-[#ff0000]">
                  Cannot confirm payment yet. Customer must submit a GCash reference number first.
                </p>
              ) : null}

              <div className="space-y-5">
                <section className="rounded-2xl border border-[#b4b4b4] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-[#3878c2]">Booking Details</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-[#3878c2]">Services</p>
                      <p className="mt-1 text-sm text-[#374151]">{serviceList.length ? serviceList.join(", ") : "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#3878c2]">Add-ons</p>
                      <p className="mt-1 text-sm text-[#374151]">{addonList.length ? addonList.join(", ") : "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#3878c2]">Collection Mode</p>
                      <p className="mt-1 text-sm text-[#374151]">{collectionDetails.mode}</p>
                    </div>
                    {selectedBooking.riderName && (
                      <div>
                        <p className="text-xs font-semibold text-[#4bad40]">Assigned Rider</p>
                        <p className="mt-1 text-sm font-bold text-[#4bad40]">{selectedBooking.riderName}</p>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <p className="text-xs font-semibold text-[#3878c2]">Pickup Address</p>
                      <p className="mt-1 text-sm text-[#374151]">{collectionDetails.pickupAddress || "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs font-semibold text-[#3878c2]">Delivery Address</p>
                      <p className="mt-1 text-sm text-[#374151]">{collectionDetails.deliveryAddress || "-"}</p>
                    </div>
                    {collectionDetails.customerAddress && (
                      <div className="md:col-span-2 rounded-lg bg-gray-50 border border-gray-100 p-3 mt-1">
                        <p className="text-xs font-semibold text-[#b4b4b4] uppercase">Pinned Address (Geo-Map)</p>
                        <p className="mt-1 text-sm text-[#374151] font-medium">{collectionDetails.customerAddress}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-[#3878c2]">Scheduled Pickup</p>
                      <p className="mt-1 text-sm text-[#374151]">
                        {formatDateForDisplay(collectionDetails.collectionDate)} • {formatTimeForDisplay(collectionDetails.collectionTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#3878c2]">Scheduled Drop-Off</p>
                      <p className="mt-1 text-sm text-[#374151]">
                        {formatDateForDisplay(collectionDetails.deliveryDate)} • {formatTimeForDisplay(collectionDetails.deliveryTime)}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs font-semibold text-[#3878c2]">Notes</p>
                      <p className="mt-1 text-sm text-[#374151] whitespace-pre-wrap">{notes}</p>
                    </div>

                    <div className="md:col-span-2 mt-2">
                      <p className="text-xs font-semibold text-[#3878c2] mb-2">Location Map</p>
                      {collectionDetails.lat ? (
                         <div className="relative w-full h-48 rounded-xl overflow-hidden border border-[#b4b4b4] shadow-sm">
                            {isMapLoaded ? (
                              <GoogleMap
                                mapContainerStyle={{ width: '100%', height: '100%' }}
                                center={{ lat: collectionDetails.lat, lng: collectionDetails.lng }}
                                zoom={17}
                                options={{ disableDefaultUI: true, zoomControl: true, draggable: false }}
                              >
                                <Marker position={{ lat: collectionDetails.lat, lng: collectionDetails.lng }} />
                              </GoogleMap>
                            ) : (
                               <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
                                   <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3878c2] mb-2"></div>
                                   <span className="text-xs text-[#3878c2]">Loading Maps...</span>
                               </div>
                            )}
                         </div>
                      ) : (
                         <div className="w-full p-4 rounded-xl border border-[#b4b4b4] bg-gray-50 flex flex-col items-center justify-center text-sm text-[#b4b4b4]">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6 mb-1 opacity-50">
                               <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                             </svg>
                             No exact GPS coordinates available for this booking.
                         </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#b4b4b4] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-[#3878c2]">Payment Details</h3>
                  <div className={`grid gap-4 ${isBookingConfirmed ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
                    <div>
                      <p className="text-xs font-semibold text-[#3878c2]">Payment Method</p>
                      <p className="mt-1 text-sm text-[#374151]">{paymentDetails.method}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#3878c2]">Reference Number</p>
                      <p className="mt-1 text-sm text-[#374151] break-all">{paymentDetails.referenceNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#3878c2]">Payment Status</p>
                      <p className="mt-1 text-sm text-[#374151]">{paymentDetails.status}</p>
                    </div>
                    {isBookingConfirmed && (
                      <div>
                        <p className="text-xs font-semibold text-[#3878c2]">Amount to Pay</p>
                        <p className="mt-1 text-sm text-[#374151]">
                          {typeof paymentDetails.amountToPay === "number"
                            ? `₱${paymentDetails.amountToPay.toLocaleString("en-PH", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : "Not set"}
                        </p>
                      </div>
                    )}
                  </div>

                  {isBookingConfirmed && (
                    <>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="w-full sm:max-w-xs">
                          <label htmlFor="amount-to-pay" className="mb-1 block text-xs font-semibold text-[#3878c2]">
                            Staff Input: Amount to Pay
                          </label>
                          <input
                            id="amount-to-pay"
                            type="number"
                            min="1"
                            step="0.01"
                            value={amountDrafts[selectedBooking.id] || ""}
                            disabled={isPaymentConfirmed}
                            onChange={(event) => {
                              setAmountError("");
                              setAmountDrafts((prev) => ({
                                ...prev,
                                [selectedBooking.id]: event.target.value,
                              }));
                            }}
                            placeholder="Enter total amount"
                            className={`h-10 w-full rounded-md border border-[#b4b4b4] px-3 text-sm ${
                              isPaymentConfirmed ? "cursor-not-allowed bg-gray-100 text-gray-500" : "bg-white text-[#374151]"
                            }`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => saveAmountToPay(selectedBooking.id)}
                          disabled={isPaymentConfirmed || saveLoading}
                          className={`h-10 rounded-md px-4 text-sm font-semibold text-white transition-all ${
                            isPaymentConfirmed || saveLoading 
                              ? "cursor-not-allowed bg-[#9ca3af]" 
                              : "bg-[#4bad40] hover:bg-[#439a39] active:scale-95"
                          } flex items-center justify-center min-w-[120px]`}
                        >
                          {saveLoading ? (
                            <div className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving...
                            </div>
                          ) : "Save Amount"}
                        </button>
                      </div>
                      {isPaymentConfirmed ? (
                        <p className="mt-2 text-xs text-[#374151]">Amount is locked because payment is already confirmed.</p>
                      ) : null}
                      {saveSuccess ? (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#4bad40] font-medium animate-pulse">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          {saveSuccess}
                        </div>
                      ) : null}
                      {amountError ? (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#ff0000] font-medium">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                          </svg>
                          {amountError}
                        </div>
                      ) : null}
                    </>
                  )}
                </section>

                <section className="rounded-2xl border border-[#b4b4b4] p-4">
                  <h3 className="mb-4 text-sm font-semibold text-[#3878c2]">Booking Progress</h3>
                  <VerticalStepper steps={selectedBooking.timeline} />
                </section>

                {(['Booking Completed', 'delivered', 'completed'].includes(getCurrentStatus(selectedBooking)) || selectedBooking.customerFeedback || selectedBooking.riderFeedback) && (
                  <section className="rounded-2xl border border-[#b4b4b4] p-4">
                    <h3 className="mb-4 text-sm font-semibold text-[#3878c2]">Customer Feedback</h3>
                    {(!selectedBooking.customerFeedback && !selectedBooking.riderFeedback) ? (
                      <p className="text-sm text-[#b4b4b4] italic">No feedback submitted yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {/* Customer Laundry Feedback */}
                        {selectedBooking.customerFeedback && (
                          <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
                            <p className="text-xs font-semibold text-[#374151] mb-2 uppercase">Laundry Service</p>
                            <div className="flex gap-1 mb-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill={star <= selectedBooking.customerFeedback.rating ? "#facc15" : "#e5e7eb"}
                                  className="size-5"
                                >
                                  <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                </svg>
                              ))}
                            </div>
                            {selectedBooking.customerFeedback.review_tags && selectedBooking.customerFeedback.review_tags.length > 0 && (
                               <div className="flex flex-wrap gap-2 mb-2">
                                  {selectedBooking.customerFeedback.review_tags.map(tag => (
                                      <span key={tag} className="bg-[#eaf3fc] text-[#3878c2] px-2 py-1 rounded-md text-[10px] font-bold">
                                          {tag}
                                      </span>
                                  ))}
                               </div>
                            )}
                            {selectedBooking.customerFeedback.review_comment && (
                               <p className="text-sm text-[#374151] mt-2 italic bg-white p-3 rounded border border-gray-200">
                                   "{selectedBooking.customerFeedback.review_comment}"
                               </p>
                            )}
                          </div>
                        )}

                        {/* Rider Feedback */}
                        {selectedBooking.riderFeedback && (
                          <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
                            <p className="text-xs font-semibold text-[#374151] mb-2 uppercase">Rider Rating</p>
                            <div className="flex gap-1 mb-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill={star <= selectedBooking.riderFeedback.rating ? "#facc15" : "#e5e7eb"}
                                  className="size-5"
                                >
                                  <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                </svg>
                              ))}
                            </div>
                            {selectedBooking.riderFeedback.review_tags && selectedBooking.riderFeedback.review_tags.length > 0 && (
                               <div className="flex flex-wrap gap-2">
                                  {selectedBooking.riderFeedback.review_tags.map(tag => (
                                      <span key={tag} className="bg-[#eaf3fc] text-[#3878c2] px-2 py-1 rounded-md text-[10px] font-bold">
                                          {tag}
                                      </span>
                                  ))}
                               </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Cancellation Reason Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-[#3878c2]">
              Cancel Booking
            </h3>
            <p className="mb-4 text-sm text-[#374151]">
              Please provide a reason for cancelling this booking. This will be shown to the customer.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter cancellation reason (e.g., Failed payment verification, Service unavailable, etc.)"
              className="w-full rounded-xl border border-[#d9e8fb] p-3 text-sm focus:border-[#3878c2] focus:ring-1 focus:ring-[#3878c2] outline-none min-h-[100px] resize-none"
              maxLength={500}
            />
            <div className="mt-1 text-xs text-[#b4b4b4] text-right">
              {cancelReason.length}/500 characters
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                  setCancellingBookingId(null);
                }}
                className="flex-1 rounded-lg border border-[#b4b4b4] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCancelWithReason}
                disabled={!cancelReason.trim()}
                className="flex-1 rounded-lg bg-[#e55353] px-4 py-2 text-sm font-medium text-white hover:bg-[#d44444] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavbar />
    </div>
  );
}