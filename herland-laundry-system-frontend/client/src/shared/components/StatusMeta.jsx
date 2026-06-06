export const STATUS_META = {
  BookingReceived: { label: "Booking Received", color: "#b4b4b4" },
  BookingAccepted: { label: "Booking Accepted", color: "#ffde59" },
  BookingEdited: { label: "Booking Edited", color: "#ffde59" },
  PaymentConfirmed: { label: "Payment Confirmed", color: "#ffde59" },
  RiderDispatchedForPickup: { label: "Rider Dispatched for Pickup", color: "#ffde59" },
  PickedUpFromCustomer: { label: "Picked Up from Customer", color: "#ffde59" },
  InProgress: { label: "In Progress", color: "#ffde59" },
  OutForDelivery: { label: "Out for Delivery", color: "#ffde59" },
  ReadyForPickup: { label: "Ready for Pick-up", color: "#63bce6" },
  LaundryDelivered: { label: "Laundry Delivered", color: "#63bce6" },
  FeedbackSubmitted: { label: "Feedback Submitted", color: "#4bad40" },
  BookingCancelled: { label: "Booking Cancelled", color: "#ff0000" },
  PaymentFlagged: { label: "Payment Flagged", color: "#ff0000" },
};

export const STATUS_ORDER = [
  "BookingReceived",
  "BookingAccepted",
  "BookingEdited",
  "PaymentConfirmed",
  "RiderDispatchedForPickup",
  "PickedUpFromCustomer",
  "InProgress",
  "ReadyForPickup",
  "OutForDelivery",
  "LaundryDelivered",
  "FeedbackSubmitted",
  "BookingCancelled",
  "PaymentFlagged",
];

export const ACTIVE_STATUSES = [
  "BookingReceived",
  "BookingAccepted",
  "BookingEdited",
  "PaymentConfirmed",
  "RiderDispatchedForPickup",
  "PickedUpFromCustomer",
  "InProgress",
  "ReadyForPickup",
  "OutForDelivery",
];

export const PAST_STATUSES = [
  "LaundryDelivered",
  "FeedbackSubmitted",
  "BookingCancelled",
  "PaymentFlagged",
];

export const getStatusKey = (status = "") => {
  const lower = status.toLowerCase();
  if (
    lower === "pending" ||
    lower === "received" ||
    lower.includes("booking received") ||
    lower.includes("placed")
  )
    return "BookingReceived";
  if (lower === "accepted" || lower.includes("booking accepted"))
    return "BookingAccepted";
  if (lower === "edited" || lower.includes("edited")) return "BookingEdited";
  if (lower.includes("payment confirmed") || lower === "confirmed")
    return "PaymentConfirmed";
  if (lower.includes("dispatched for pickup") || lower.includes("rider dispatched"))
    return "RiderDispatchedForPickup";
  if (lower.includes("picked up from customer") || lower === "picked_up")
    return "PickedUpFromCustomer";
  if (lower === "flagged" || lower.includes("flagged")) return "PaymentFlagged";
  if (lower.includes("in progress") || lower === "progress")
    return "InProgress";
  if (lower.includes("ready for pick") || lower === "ready")
    return "ReadyForPickup";
  if (lower.includes("out for delivery") || lower === "out" || lower === "ready_for_delivery")
    return "OutForDelivery";
  if (lower === "cancelled" || lower.includes("cancelled"))
    return "BookingCancelled";
  if (
    lower === "laundry delivered" ||
    lower.includes("laundry delivered") ||
    lower === "delivered" ||
    lower === "completed" ||
    lower.includes("completed")
  )
    return "LaundryDelivered";
  if (
    lower === "feedback submitted" ||
    lower.includes("feedback submitted") ||
    lower.includes("feedback")
  )
    return "FeedbackSubmitted";
  return "BookingReceived";
};

export const getStatusMeta = (status) => {
  if (!status) return STATUS_META.BookingReceived;
  return (
    STATUS_META[status] ||
    STATUS_META[getStatusKey(status)] ||
    STATUS_META.BookingReceived
  );
};