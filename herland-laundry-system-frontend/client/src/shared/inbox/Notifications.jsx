import { useMemo, useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const USER_NOTIFICATIONS = [
  {
    id: "NTF-1029",
    title: "Laundry ready for pickup",
    message:
      "Your booking HL-906735-6662 is ready. Drop by today before 7:00 PM.",
    time: "Feb 7, 2026 · 10:15 AM",
    read: false,
  },
  {
    id: "NTF-1030",
    title: "Payment confirmed",
    message: "We have received your payment for booking HL-906735-6662.",
    time: "Feb 6, 2026 · 2:08 PM",
    read: false,
  },
  {
    id: "NTF-1031",
    title: "Driver en route",
    message:
      "Your pickup driver is on the way. Estimated arrival in 20 minutes.",
    time: "Feb 6, 2026 · 9:40 AM",
    read: false,
  },
  {
    id: "NTF-1032",
    title: "Booking accepted",
    message:
      "We have received your booking. We will update you once processing starts.",
    time: "Feb 5, 2026 · 5:10 PM",
    read: true,
  },
];

const STAFF_NOTIFICATIONS = [
  {
    id: "STF-2101",
    title: "New walk-in drop-off",
    message: "Booking HL-906740-1021 has arrived at the front desk.",
    time: "Feb 8, 2026 · 8:45 AM",
    read: false,
  },
  {
    id: "STF-2102",
    title: "Machine maintenance check",
    message: "Dryer #2 is due for a maintenance check before 3:00 PM today.",
    time: "Feb 7, 2026 · 1:20 PM",
    read: false,
  },
  {
    id: "STF-2103",
    title: "Rush booking assigned",
    message: "Please prioritize booking HL-906738-9910 for same-day release.",
    time: "Feb 6, 2026 · 11:05 AM",
    read: true,
  },
];

const RIDER_NOTIFICATIONS = [
  {
    id: "RDR-3101",
    title: "Pickup assigned",
    message: "New pickup assigned: HL-906742-4408 at Batasan Hills.",
    time: "Feb 8, 2026 · 9:12 AM",
    read: false,
  },
  {
    id: "RDR-3102",
    title: "Customer not available",
    message: "Customer for HL-906739-7753 requested a reschedule at 2:30 PM.",
    time: "Feb 7, 2026 · 2:04 PM",
    read: false,
  },
  {
    id: "RDR-3103",
    title: "Delivery completed",
    message: "Delivery completed for HL-906736-2231. Proof photo uploaded.",
    time: "Feb 6, 2026 · 5:28 PM",
    read: true,
  },
];

const ROLE_NOTIFICATIONS = {
  user: USER_NOTIFICATIONS,
  staff: STAFF_NOTIFICATIONS,
  rider: RIDER_NOTIFICATIONS,
};

const FILTERS = ["All", "Unread", "Today"];
const LONG_PRESS_DURATION = 600; // milliseconds

const getRoleFromPath = (pathname = "") => {
  if (pathname.startsWith("/staff")) return "staff";
  if (pathname.startsWith("/rider")) return "rider";
  return "user";
};

export default function Notifications() {
  const location = useLocation();
  const navigate = useNavigate();
  // We no longer manually pick role-based standard notifications,
  // we fetch them fully from the backend for the current user.
  const [filter, setFilter] = useState("All");
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      // Fetch notifications safely from the secure endpoint without passing userId manually
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Transform backend timestamp to readable time string
        const mappedData = data.map(item => ({
          id: item.id,
          title: item.title || "Notification",
          message: item.message,
          read: item.is_read,
          created_at: item.created_at,
          time: new Date(item.created_at).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
          })
        }));
        setNotifications(mappedData);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (filter === "Unread") return notifications.filter((n) => !n.read);
    if (filter === "Today") {
      const today = new Date().toDateString();
      return notifications.filter(n => new Date(n.created_at).toDateString() === today);
    }
    return notifications;
  }, [filter, notifications]);

  const toggleRead = async (id) => {
    const item = notifications.find(n => n.id === id);
    if (!item || item.read) return; // Only process if unread
    
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      await fetch(`${import.meta.env.VITE_API_URL}/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      await fetch(`${import.meta.env.VITE_API_URL}/api/v1/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const deleteNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      await fetch(`${import.meta.env.VITE_API_URL}/api/v1/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl md:max-w-5xl lg:max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
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
              <h1 className="text-2xl font-semibold">Notifications</h1>
            </div>
            <p className="text-sm text-[#b4b4b4]">
              {unreadCount === 0
                ? "You are all caught up."
                : `${unreadCount} unread message${unreadCount > 1 ? "s" : ""}`}
            </p>
          </div>

          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="text-sm font-semibold text-[#4bad40] disabled:text-[#b4b4b4]"
          >
            Mark all as read
          </button>
        </header>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const isActive = filter === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-1.5 text-xs sm:px-4 sm:text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#63bce6] text-white"
                    : "border border-[#3878c2] text-[#3878c2] hover:bg-[#63bce6]/20"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Notifications List */}
        {isLoading ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center space-y-4">
             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3878c2]"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center space-y-6">
            <img
              src="/images/WashingMachine.png"
              alt="Washing Machine"
              className="h-48 w-auto"
            />
            <p className="text-lg text-[#b4b4b4]">
              No notifications right now.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {filteredNotifications.map((item) => (
              <li key={item.id} className={`flex items-center justify-between w-full px-3 py-4 transition ${item.read ? "bg-white" : "bg-[#63bce6]/10"}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleRead(item.id)}
                  onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') toggleRead(item.id); }}
                  className="flex-1 text-left cursor-pointer pr-4"
                >
                  <h2
                    className={`text-sm transition-colors ${
                      item.read
                        ? "font-medium text-[#9ca3af]"
                        : "font-semibold text-[#3878c2]"
                    }`}
                  >
                    {item.title}
                  </h2>
                  <p
                    className={`mt-1 text-sm transition-colors ${
                      item.read ? "text-[#b4b4b4]" : "text-[#374151]"
                    }`}
                  >
                    {item.message}
                  </p>
                  <p className="mt-1 text-xs text-[#b4b4b4]">{item.time}</p>
                </div>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(item.id);
                  }}
                  className="text-[#e55353] hover:text-red-700 transition p-2 rounded-full hover:bg-red-50 flex-shrink-0"
                  aria-label="Delete notification"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

      </div>
    </div>
  );
}
