import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { formatDate, formatTime } from "../../../shared/utils/formatters";

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/customer`;

export default function DigitalReceipt() {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const receiptRef = useRef(null);

  const fetchBooking = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setError("Please log in to view receipt.");
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
      } else {
        setError("Could not load receipt data.");
      }
    } catch (err) {
      console.error("Error fetching booking for receipt:", err);
      setError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-8 text-center text-[#b4b4b4]">Generating Receipt...</div>;
  if (error) return <div className="p-8 text-center text-[#e55353]">{error}</div>;
  if (!booking) return null;

  // ── Extract data from the booking object ──────────────────────────────
  const sd = booking.serviceDetails || {};
  const selectedServices = sd.selectedServices || [];
  const selectedAddons = sd.selectedAddons || [];
  const cachedServices = sd.availableServices || [];
  const cachedAddons = sd.availableAddons || [];
  const numberOfBags = sd.numberOfBags || 1;
  const bagDescription = sd.bagDescription || "";

  // Build a price lookup from the cached arrays
  const servicePriceLookup = {};
  cachedServices.forEach(s => {
    servicePriceLookup[s.name.toLowerCase()] = s.currentPrice;
  });
  const addonPriceLookup = {};
  cachedAddons.forEach(a => {
    addonPriceLookup[a.name.toLowerCase()] = a.currentPrice;
  });

  const pd = booking.paymentDetails || {};
  const total = pd.totalAmount || pd.amountToPay || 0;
  const downpayment = pd.downpaymentRequired || 0;
  const balance = pd.balance || 0;
  const paymentMethod = pd.method || "-";
  const paymentStatus = pd.status || "Pending";

  const cd = booking.collectionDetails || {};
  const collectionOption = cd.optionLabel || booking.collectionOption || "-";
  const refNumber = booking.id || bookingId;
  const dateCreated = booking.date || "-";

  // Build line items with prices
  const serviceLineItems = selectedServices.map(name => {
    const unitPrice = servicePriceLookup[name.toLowerCase()] || servicePriceLookup[name] || 0;
    return {
      name,
      type: "Service",
      qty: Number(numberOfBags) || 1,
      unitPrice,
      lineTotal: unitPrice * (Number(numberOfBags) || 1),
    };
  });

  const addonLineItems = selectedAddons.map(addon => {
    const name = typeof addon === "string" ? addon : addon.name;
    const qty = typeof addon === "string" ? 1 : Number(addon.quantity) || 1;
    const unitPrice = addonPriceLookup[name?.toLowerCase()] || addonPriceLookup[name] || 0;
    return {
      name,
      type: "Add-on",
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
    };
  });

  const allLineItems = [...serviceLineItems, ...addonLineItems];

  return (
    <>
      {/* Print styles */}
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #receipt-printable, #receipt-printable * { visibility: visible; }
            #receipt-printable {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 0;
              box-shadow: none !important;
            }
            .no-print { display: none !important; }
          }
        `}
      </style>

      <div className="min-h-screen bg-neutral-100 p-4 sm:p-8">
        {/* Action Bar */}
        <div className="mx-auto mb-6 flex max-w-2xl justify-between no-print">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-medium text-[#3878c2] hover:underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Details
          </button>
          <button
            onClick={handlePrint}
            className="rounded-lg bg-[#3878c2] px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-[#2d62a3] transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12Zm-2.25 0h.008v.008h-.008V12Z" />
            </svg>
            Print Receipt
          </button>
        </div>

        {/* Receipt */}
        <div id="receipt-printable" ref={receiptRef} className="mx-auto max-w-2xl bg-white shadow-xl sm:rounded-xl overflow-hidden">

          {/* Header */}
          <div className="bg-[#3878c2] px-8 py-6 text-center text-white">
            <h1 className="text-2xl font-black tracking-tight">HERLAND LAUNDRY</h1>
            <p className="text-[10px] font-medium tracking-[0.25em] opacity-80 mt-1">PROFESSIONAL WASH • DRY • FOLD</p>
            <p className="text-[11px] mt-3 opacity-70">72 Balite Street Brgy 44, Pasay City, Philippines</p>
          </div>

          <div className="px-8 py-8 sm:px-10">

            {/* Ref & Date */}
            <div className="flex items-start justify-between mb-6 pb-5 border-b border-dashed border-gray-200">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#b4b4b4]">Reference No.</p>
                <p className="text-base font-black font-mono text-[#1f2937] mt-0.5">{refNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#b4b4b4]">Date</p>
                <p className="text-sm font-medium text-[#1f2937] mt-0.5">{dateCreated}</p>
              </div>
            </div>

            {/* Collection Mode */}
            <div className="mb-6 rounded-lg bg-[#f0f7ff] border border-[#3878c2]/10 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#b4b4b4]">Mode</p>
              <p className="font-semibold text-[#3878c2] text-sm mt-0.5">{collectionOption}</p>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#b4b4b4]">Collection</p>
                <p className="text-sm font-semibold text-[#374151] mt-1">{formatDate(cd.collectionDate)}</p>
                <p className="text-xs text-[#6b7280]">{formatTime(cd.collectionTime)}</p>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#b4b4b4]">Delivery / Pick-up</p>
                <p className="text-sm font-semibold text-[#374151] mt-1">{formatDate(cd.deliveryDate)}</p>
                <p className="text-xs text-[#6b7280]">{formatTime(cd.deliveryTime)}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-b-2 border-[#3878c2] mb-5" />

            {/* Line Items Table */}
            <table className="w-full text-left text-sm mb-6">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-[#b4b4b4]">
                  <th className="pb-3 pr-4">Item</th>
                  <th className="pb-3 text-center w-16">Qty</th>
                  <th className="pb-3 text-right w-24">Unit</th>
                  <th className="pb-3 text-right w-24">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allLineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[#374151] capitalize">{item.name}</p>
                      <p className="text-[10px] text-[#9ca3af]">{item.type}</p>
                    </td>
                    <td className="py-3 text-center text-[#6b7280]">{item.qty}</td>
                    <td className="py-3 text-right text-[#6b7280]">
                      {item.unitPrice > 0 ? `₱${item.unitPrice.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3 text-right font-medium text-[#374151]">
                      {item.lineTotal > 0 ? `₱${item.lineTotal.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}

                {/* Bags info row */}
                {numberOfBags > 0 && (
                  <tr>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[#374151]">Total Loads / Bags</p>
                      {bagDescription && (
                        <p className="text-[10px] text-[#9ca3af] italic">{bagDescription}</p>
                      )}
                    </td>
                    <td className="py-3 text-center font-bold text-[#3878c2]">{numberOfBags}</td>
                    <td className="py-3" />
                    <td className="py-3" />
                  </tr>
                )}
              </tbody>
            </table>

            {/* Payment Summary */}
            <div className="rounded-xl bg-[#fafbfd] border border-gray-100 p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#6b7280]">Payment Method</span>
                <span className="font-semibold text-[#374151]">{paymentMethod}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6b7280]">Payment Status</span>
                <span className="font-semibold text-[#4bad40] capitalize">{paymentStatus}</span>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between text-sm">
                <span className="text-[#6b7280]">Total Amount</span>
                <span className="font-bold text-[#374151]">₱{Number(total).toFixed(2)}</span>
              </div>

              {/* Grand total */}
              <div className="border-t-2 border-[#3878c2] pt-3 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-widest text-[#3878c2]">
                  Total Amount
                </span>
                <span className="text-2xl font-black text-[#3878c2]">
                  ₱{Number(total).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Notes */}
            {booking.notes && (
              <div className="mt-5 rounded-lg bg-gray-50 border border-gray-100 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#b4b4b4] mb-1">Special Instructions</p>
                <p className="text-sm text-[#374151] italic">"{booking.notes}"</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-dashed border-gray-200 text-center">
              <div className="inline-block rounded-full bg-[#f0f7ff] px-6 py-2 text-[11px] font-bold uppercase tracking-widest text-[#3878c2]">
                Thank you for choosing us!
              </div>
              <p className="mt-3 text-[10px] text-[#b4b4b4]">
                This is an electronically generated receipt. No signature is required.
              </p>
              <p className="mt-1 text-[10px] text-[#b4b4b4]">
                Herland Laundry System © {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
