/**
 * Helper to format date for display
 */
export const formatDate = (date) => {
  if (!date) return "-";
  const today = new Date();
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";

  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  const formattedDate = `${month}/${day}/${year}`;
  
  return today.toDateString() === d.toDateString()
    ? `Today | ${formattedDate}`
    : formattedDate;
};

export const parseDateString = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const stringValue = String(value).trim();
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const usDateOnly = /^\d{2}\/\d{2}\/\d{4}$/;

  if (isoDateOnly.test(stringValue)) {
    const [year, month, day] = stringValue.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  if (usDateOnly.test(stringValue)) {
    const [month, day, year] = stringValue.split('/').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(stringValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export const formatDateMMDDYYYY = (date) => {
  const parsed = parseDateString(date);
  if (!parsed) return '';

  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const year = parsed.getFullYear();

  return `${month}/${day}/${year}`;
};

/**
 * Helper to format time to 12-hour
 */
export const formatTime = (time) => {
  if (!time) return "-";
  const [hourStr, min] = time.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${hour.toString().padStart(2, "0")}:${min} ${ampm}`;
};

/**
 * Get pickup and delivery addresses based on collection option
 */
export const getRouteAddresses = (option) => {
  if (option === "pickedUpDelivered") {
    return {
      pickupAddress: "Customer address (pickup)",
      deliveryAddress: "Customer address (delivery)",
    };
  }

  if (option === "dropOffDelivered") {
    return {
      pickupAddress: "Herland Laundry - Main Branch",
      deliveryAddress: "Customer address (delivery)",
    };
  }

  return {
    pickupAddress: "Herland Laundry - Main Branch",
    deliveryAddress: "Herland Laundry - Main Branch",
  };
};

/**
 * Helper to format Add-Ons quantities
 */
export const formatAddonQuantity = (key, value) => {
  if (key === "detergent" || key === "conditioner") {
    return value * 2; // 2pcs per bundle
  }
  return value;
};
