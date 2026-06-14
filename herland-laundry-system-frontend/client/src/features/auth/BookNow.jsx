import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLayout } from "../../app/LayoutContext";
import { usePermissions } from "../../shared/permissions/UsePermissions";
import DateTimePicker from "../../shared/components/DateTimePicker";
import { supabase } from "../../lib/supabase";
import { formatDate, formatTime, getRouteAddresses } from "../../shared/utils/formatters";

import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";
import { useToast } from "../../shared/components/Toast";

import { GOOGLE_MAPS_LIBRARIES } from "../../shared/constants/maps";
const defaultCenter = { lat: 14.537751, lng: 121.001379 }; // Pasay approximate

/* =========================
   Parent Component
========================= */
export default function BookNow({ inlineEditId, onEditSuccess, onCancel }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const editId = inlineEditId || searchParams.get("edit");
  const isEditMode = !!editId;
  const [bookingLoaded, setBookingLoaded] = useState(!isEditMode);
  
  const [step, setStep] = useState(() => {
    if (isEditMode) return 1;
    const saved = localStorage.getItem('bookingStep');
    return saved ? parseInt(saved, 10) : 1;
  });

  // Helper to read JSON from localStorage
  const getLocalItem = (key, defaultVal) => {
    if (isEditMode) return defaultVal;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultVal;
    } catch {
      return defaultVal;
    }
  };

  // Clear localStorage when booking is completed successfully
  const clearBookingState = () => {
    localStorage.removeItem('bookingStep');
    localStorage.removeItem('bookingServices');
    localStorage.removeItem('bookingWeight');
    localStorage.removeItem('bookingPaymentMethod');
    localStorage.removeItem('bookingNumberOfBags');
    localStorage.removeItem('bookingBagDescription');
    localStorage.removeItem('bookingNotes');
    localStorage.removeItem('bookingCollectionInfo');
    localStorage.removeItem('bookingDeliveryInfo');
    localStorage.removeItem('bookingCustomerLocation');
    localStorage.removeItem('bookingSelectedLoad');
    localStorage.removeItem('bookingLoadQuantities');
  };

  // Auth Check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast("Please sign up or log in to create a booking.", "error");
        navigate('/login?redirect=book');
      }
    };
    checkAuth();
  }, [navigate, showToast]);

  const [services, setServices] = useState(() => getLocalItem('bookingServices', {}));
  const [weight, setWeight] = useState(() => {
    if (isEditMode) return 0;
    const saved = localStorage.getItem('bookingWeight');
    return saved ? parseFloat(saved) : 0;
  });
  const [availableServices, setAvailableServices] = useState([]);
  const [availableLoads, setAvailableLoads] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState(() => {
    if (isEditMode) return "gcash";
    return localStorage.getItem('bookingPaymentMethod') || "gcash";
  });
  const [numberOfBags, setNumberOfBags] = useState(() => {
    if (isEditMode) return 1;
    const saved = localStorage.getItem('bookingNumberOfBags');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [bagDescription, setBagDescription] = useState(() => {
    if (isEditMode) return "";
    return localStorage.getItem('bookingBagDescription') || "";
  });
  const [notes, setNotes] = useState(() => {
    if (isEditMode) return "";
    return localStorage.getItem('bookingNotes') || "";
  });
  const { setHideBottomNav } = useLayout();
  const { requestLocationPermission } = usePermissions();
  const [collectionInfo, setCollectionInfo] = useState(() => getLocalItem('bookingCollectionInfo', {
    option: "pickedUpDelivered",
    optionLabel: "Pickup & Delivery",
    date: "",
    time: "",
  }));
  const [deliveryInfo, setDeliveryInfo] = useState(() => getLocalItem('bookingDeliveryInfo', {
    date: "",
    time: "",
  }));
  const [customerLocation, setCustomerLocation] = useState(() => getLocalItem('bookingCustomerLocation', {
    address: "",
    lat: null,
    lng: null
  }));

  // Save all booking state to localStorage
  useEffect(() => {
    if (!isEditMode) {
      localStorage.setItem('bookingStep', step.toString());
      localStorage.setItem('bookingServices', JSON.stringify(services));
      localStorage.setItem('bookingWeight', weight.toString());
      localStorage.setItem('bookingPaymentMethod', paymentMethod);
      localStorage.setItem('bookingNumberOfBags', numberOfBags.toString());
      localStorage.setItem('bookingBagDescription', bagDescription);
      localStorage.setItem('bookingNotes', notes);
      localStorage.setItem('bookingCollectionInfo', JSON.stringify(collectionInfo));
      localStorage.setItem('bookingDeliveryInfo', JSON.stringify(deliveryInfo));
      localStorage.setItem('bookingCustomerLocation', JSON.stringify(customerLocation));
    }
  }, [step, services, weight, paymentMethod, numberOfBags, bagDescription, notes, collectionInfo, deliveryInfo, customerLocation, isEditMode]);
  const [saveHomeAddress, setSaveHomeAddress] = useState(true);

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim(),
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Fetch available services from backend
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoadingServices(true);
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/customer/services`);
        if (response.ok) {
          const data = await response.json();
          setAvailableServices(data.services || []);
          setAvailableLoads(data.loadOptions || []);
          
          // Initialize state if not in edit mode
          if (!isEditMode) {
            setServices(prev => {
              const newServices = { ...prev };
              data.services.forEach(s => {
                const key = s.name.toLowerCase();
                if (newServices[key] === undefined) newServices[key] = 0;
              });
              return newServices;
            });

          }
        }
      } catch (err) {
        console.error("Error fetching services metadata:", err);
      } finally {
        setLoadingServices(false);
      }
    };
    fetchMetadata();
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode) {
      const fetchProfile = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/customer/profile`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (response.ok) {
              const profile = await response.json();
              if (profile.lat && profile.lng) {
                setCustomerLocation(prev => {
                  if (prev.lat) return prev; // Do not overwrite if we already have location from local storage
                  return {
                    address: profile.address || "",
                    lat: profile.lat,
                    lng: profile.lng,
                  };
                });
              }
            }
          }
        } catch (err) {
          console.error("Failed to load saved profile address:", err);
        }
      };
      fetchProfile();
    }
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode && !loadingServices) {
      const fetchBooking = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/customer/my-bookings/${editId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.status.toLowerCase() !== "pending") {
              showToast("Only pending bookings can be edited.", "error");
              if (onCancel) {
                onCancel();
              } else {
                navigate("/bookings");
              }
              return;
            }
            // Hydrate state
            // Merge with available items to ensure all keys exist
            const mergedServices = {};
            availableServices.forEach(s => {
              const key = s.name.toLowerCase();
              mergedServices[key] = data.serviceDetails.services?.[key] || 0;
            });
            setServices(mergedServices);


            setWeight(data.serviceDetails.weight || 0);
            setNumberOfBags(data.serviceDetails.numberOfBags || 1);
            setBagDescription(data.serviceDetails.bagDescription || "");
            setPaymentMethod(data.paymentDetails.method === "GCash" ? "gcash" : "cash");
            setNotes(data.notes || "");

            const storedSelectedLoads = Array.isArray(data.serviceDetails.selectedLoads)
              ? data.serviceDetails.selectedLoads
              : ['regular'];
            const storedLoadQuantities = data.serviceDetails.loadQuantities || {
              regular: data.serviceDetails.numberOfBags || 1,
              heavy: 1,
              perPiece: 1,
            };
            localStorage.setItem('bookingSelectedLoad', JSON.stringify(storedSelectedLoads));
            localStorage.setItem('bookingLoadQuantities', JSON.stringify(storedLoadQuantities));
            setCollectionInfo({
              option: "pickedUpDelivered",
              optionLabel: "Pickup & Delivery",
              date: data.collectionDetails.collectionDate,
              time: data.collectionDetails.collectionTime,
              collectionSlot: data.collectionDetails.collectionSlot || getSlotIdByValue(data.collectionDetails.collectionTime),
            });            
            setDeliveryInfo({
              date: data.collectionDetails.deliveryDate,
              time: data.collectionDetails.deliveryTime,
              deliverySlot: data.collectionDetails.deliverySlot || getSlotIdByValue(data.collectionDetails.deliveryTime),
            });
            if (data.collectionDetails.lat && data.collectionDetails.lng) {
              setCustomerLocation({
                address: data.collectionDetails.pickupAddress || data.collectionDetails.deliveryAddress,
                lat: data.collectionDetails.lat,
              });
            }
            setBookingLoaded(true);
          }
        } catch (err) {
          console.error("Error fetching booking for edit:", err);
        }
      };
      fetchBooking();
    }
  }, [isEditMode, editId]);

  const steps = [
    "Laundry Details",
    "Schedule",
    "Address Details",
    "Review & Confirm",
  ];

  useEffect(() => {
    setHideBottomNav(step === 3);

    return () => {
      setHideBottomNav(false);
    };
  }, [step, setHideBottomNav]);

  const calculateTotalEstimatedHours = () => {
    let total = 0;
    availableServices.forEach(s => {
      if (services[s.name.toLowerCase()]) {
        total += Number(s.estimatedHours) || 0;
      }
    });
    return total;
  };

  const handleStepChange = (newStep) => {
    // Check if moving to step 3 (Address) and request location permission
    if (newStep === 3) {
      // In edit mode, if we already have saved coordinates, still request fresh location
      requestLocationPermission((granted, coords) => {
        if (granted && coords) {
          setCustomerLocation(prev => ({
            ...prev,
            lat: coords.lat,
            lng: coords.lng,
            address: ""
          }));
        }
        // Always navigate to Step 3 so users can manually type their address if they deny GPS
        setStep(newStep);
      });
    } else {
      setStep(newStep);
    }
  };

  if (!bookingLoaded) {
    return (
      <div className="flex justify-center items-center py-20 min-h-screen" style={{ backgroundColor: "#EFF8FC" }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3878c2]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-3 md:px-2" style={{ backgroundColor: "#EFF8FC" }}>
      {inlineEditId && (
        <div className="max-w-none lg:max-w-7xl mx-auto px-4 py-3 border-b border-gray-200 flex items-center justify-between mb-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-[#3878c2]">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center text-sm font-semibold hover:opacity-80 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5 mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Cancel Editing
            </button>
          </div>
          <span className="text-xs text-gray-500 font-medium">Editing Booking: {inlineEditId}</span>
        </div>
      )}

      {/* Stepper Container */}
      <div className="max-w-3xl mx-auto mb-4 pt-2 overflow-visible px-4 sm:px-6">
        <style>
          {`
            .steps .step:first-child::before {
              background-color: transparent !important;
            }

            .steps .step::before {
              background-color: var(--step-line-color, #b4b4b4);
            }

            .steps .step {
              color: var(--step-label-color, #b4b4b4);
              position: relative;
            }

            .steps .step::after {
              background-color: var(--step-circle-color, #b4b4b4);
              border-color: var(--step-circle-color, #b4b4b4);
              position: relative;
              z-index: 2;
            }

            .steps .step.current-step::after {
              box-shadow: 0 0 0 7px rgba(99, 188, 230, 0.60);
            }

            .date-input::-webkit-calendar-picker-indicator,
            .time-input::-webkit-calendar-picker-indicator {
              opacity: 0;
              position: absolute;
              right: 0.75rem;
              width: 1.5rem;
              height: 1.5rem;
              cursor: pointer;
            }
          `}
        </style>

        <ul className="steps w-full overflow-visible">
          {steps.map((label, index) => {
            const stepNumber = index + 1;
            const isCompleted = step > stepNumber;
            const isCurrent = step === stepNumber;

            const circleColor = isCompleted || isCurrent ? "#3878c2" : "#b4b4b4";
            const lineColor = isCompleted || isCurrent ? "#3878c2" : "#b4b4b4";
            const labelColor = isCompleted || isCurrent ? "#3878c2" : "#b4b4b4";

            return (
              <li
                key={label}
                className={`step ${isCurrent ? "current-step" : ""}`}
                style={{
                  "--step-circle-color": circleColor,
                  "--step-line-color": lineColor,
                  "--step-label-color": labelColor,
                }}
              >
                <span className="font-semibold text-[0.6rem] sm:text-[0.65rem] md:text-xs">
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Step Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {step === 1 && (
          <StepSelectServices
            onNext={() => handleStepChange(2)}
            availableServices={availableServices}
            loading={loadingServices}
            services={services}
            setServices={setServices}
            weight={weight}
            setWeight={setWeight}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            numberOfBags={numberOfBags}
            setNumberOfBags={setNumberOfBags}
            bagDescription={bagDescription}
            setBagDescription={setBagDescription}
            availableLoads={availableLoads}
            isEditMode={isEditMode}
          />
        )}
        {step === 2 && (
          <StepSchedule
            onBack={() => setStep(1)}
            onNext={() => handleStepChange(3)}
            collectionInfo={collectionInfo}
            setCollectionInfo={setCollectionInfo}
            deliveryInfo={deliveryInfo}
            setDeliveryInfo={setDeliveryInfo}
            totalEstimatedHours={calculateTotalEstimatedHours()}
          />
        )}
        {step === 3 && (
          <StepAddress
            onBack={() => setStep(2)}
            onNext={async (location) => {
              if (location) setCustomerLocation(location);
              
              if (saveHomeAddress && location) {
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session) {
                    await fetch(`${import.meta.env.VITE_API_URL}/api/v1/customer/profile`, {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({
                        address: location.address,
                        lat: location.lat,
                        lng: location.lng,
                      }),
                    });
                  }
                } catch (err) {
                  console.error("Failed to save home address:", err);
                }
              }
              setStep(4);
            }}
            isMapLoaded={isMapLoaded}
            initialLocation={customerLocation}
            saveHomeAddress={saveHomeAddress}
            setSaveHomeAddress={setSaveHomeAddress}
          />
        )}
        {step === 4 && (
          <StepReview
            onBack={() => setStep(3)}
            availableServices={availableServices}
            services={services}
            weight={weight}
            paymentMethod={paymentMethod}
            collectionInfo={collectionInfo}
            deliveryInfo={deliveryInfo}
            customerLocation={customerLocation}
            notes={notes}
            setNotes={setNotes}
            numberOfBags={numberOfBags}
            bagDescription={bagDescription}
            isEditMode={isEditMode}
            editId={editId}
            saveHomeAddress={saveHomeAddress}
            clearBookingState={clearBookingState}
            onEditSuccess={onEditSuccess}
          />
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p
      style={{
        fontSize: '0.6875rem',
        fontWeight: 800,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: '#9ca3af',
        marginBottom: 10,
      }}
    >
      {children}
    </p>
  );
}


function BookNowStepTitle({ children }) {
  return (
    <h1
      style={{
        display: "block",
        margin: 0,
        padding: 0,
        fontFamily: "Inter, sans-serif",
        fontSize: "1.5rem",
        fontWeight: 800,
        lineHeight: 1.2,
        color: "#1f2937",
        letterSpacing: "-0.02em",
      }}
    >
      {children}
    </h1>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '0.875rem',
        border: '1px solid rgba(99,188,230,0.25)',
        boxShadow: '0 2px 12px rgba(56,120,194,0.07)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}


function BookNowTextBox({
  as = "input",
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder,
  type = "text",
  rows = 3,
  maxLength,
  disabled = false,
  id,
  className = "",
  style = {},
}) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);
  const Component = as === "textarea" ? "textarea" : "input";

  const resizeTextarea = (textarea) => {
    if (as !== "textarea" || !textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [value, as]);

  const baseStyle = {
    width: '100%',
    border: `1.5px solid ${isFocused ? '#3878c2' : '#e5e7eb'}`,
    borderRadius: '0.625rem',
    padding: '0.8125rem 1rem',
    fontSize: '0.9375rem',
    color: disabled ? '#b4b4b4' : '#1f2937',
    background: disabled ? '#f3f4f6' : '#fff',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
    ...style,
    resize: as === "textarea" ? 'none' : undefined,
    overflow: as === "textarea" ? 'hidden' : undefined,
  };

  return (
    <Component
      ref={as === "textarea" ? textareaRef : undefined}
      id={id}
      type={as === "textarea" ? undefined : type}
      value={value}
      onChange={(event) => {
        resizeTextarea(event.target);
        if (onChange) onChange(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        if (onBlur) onBlur(event);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        resizeTextarea(event.target);
        if (onFocus) onFocus(event);
      }}
      placeholder={placeholder}
      rows={as === "textarea" ? rows : undefined}
      maxLength={maxLength}
      disabled={disabled}
      className={className}
      style={baseStyle}
    />
  );
}

/* =========================
   Step 1 – Laundry Details
========================= */
function StepSelectServices({
  onNext,
  availableServices,
  loading,
  services,
  setServices,
  weight,
  setWeight,
  paymentMethod,
  setPaymentMethod,
  numberOfBags,
  setNumberOfBags,
  bagDescription,
  setBagDescription,
  availableLoads,
  isEditMode = false,
}) {
  const loadOptions = (() => {
    const validLoads = availableLoads.filter(load => load.isEnabled !== false);
    return validLoads.length > 0 ? validLoads : [
      {
        id: 'regular',
        label: 'Regular Light Mix',
        sublabel: 'Up to 7.5 kg',
        description: 'Shirts, Blouses/Polo, Pants, Socks, Underwear, etc.',
        price: 220,
      },
      {
        id: 'heavy',
        label: 'Heavy Load',
        sublabel: 'Up to 5 kg',
        description: 'Beddings, Towels, Jeans, Fleece, Regular Jackets, etc.',
        price: 220,
      },
      {
        id: 'perPiece',
        label: 'Per Piece',
        sublabel: '₱220 per item',
        description: 'Comforter, Duvet, Pillow, etc.',
        price: 220,
      },
    ];
  })();

  const getStoredValue = (key, fallback) => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch {
      return fallback;
    }
  };

  const getStoredLoads = () => {
    const stored = getStoredValue('bookingSelectedLoad', []);
    return Array.isArray(stored) ? stored : [];
  };

  const [selectedLoads, setSelectedLoads] = useState(() => getStoredLoads());
  const [loadQuantities, setLoadQuantities] = useState(() =>
    getStoredValue('bookingLoadQuantities', { regular: 1, heavy: 1, perPiece: 1 })
  );
  const [acceptedTerms, setAcceptedTerms] = useState(() => isEditMode);
  const [acceptedPolicy, setAcceptedPolicy] = useState(() => isEditMode);
  const [serviceError, setServiceError] = useState("");

  const [bagDescriptionDraft, setBagDescriptionDraft] = useState(bagDescription || "");

  useEffect(() => {
    setBagDescriptionDraft(bagDescription || "");
  }, [bagDescription]);

  useEffect(() => {
    if (!isEditMode) return;

    const storedLoads = getStoredLoads();
    const storedQuantities = getStoredValue('bookingLoadQuantities', {
      regular: numberOfBags || 1,
      heavy: 1,
      perPiece: 1,
    });

    setSelectedLoads(storedLoads);
    setLoadQuantities(storedQuantities);
  }, [isEditMode, numberOfBags]);

  const selectedLoadOptions = useMemo(
    () => loadOptions.filter(option => selectedLoads.includes(option.id)),
    [selectedLoads]
  );

  const totalSelectedQuantity = useMemo(
    () => selectedLoadOptions.reduce((sum, option) => sum + Number(loadQuantities[option.id] || 1), 0),
    [selectedLoadOptions, loadQuantities]
  );

  const total = useMemo(
    () => selectedLoadOptions.reduce((sum, option) => sum + option.price * Number(loadQuantities[option.id] || 1), 0),
    [selectedLoadOptions, loadQuantities]
  );

  const canProceed = acceptedTerms && acceptedPolicy;

  const agreementRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '0.875rem 1.375rem',
    minHeight: 88,
    cursor: 'pointer',
  };

  const agreementCheckboxStyle = {
    width: 18,
    height: 18,
    accentColor: '#3878c2',
    flexShrink: 0,
  };

  const agreementTextStyle = {
    fontSize: '0.9375rem',
    color: '#374151',
    lineHeight: 1.5,
  };

  useEffect(() => {
    localStorage.setItem('bookingSelectedLoad', JSON.stringify(selectedLoads));
  }, [selectedLoads]);

  useEffect(() => {
    localStorage.setItem('bookingLoadQuantities', JSON.stringify(loadQuantities));
  }, [loadQuantities]);

  useEffect(() => {
    const fullService = availableServices.find(service =>
      service.name?.toLowerCase().includes('full service')
    );
    const serviceKey = (fullService?.name || 'Full Service Laundry').toLowerCase();

    setServices(prev => {
      const resetServices = Object.keys(prev || {}).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
      }, {});

      return {
        ...resetServices,
        [serviceKey]: totalSelectedQuantity,
      };
    });

    setNumberOfBags(totalSelectedQuantity);
    setPaymentMethod('gcash');
  }, [availableServices, totalSelectedQuantity, setServices, setNumberOfBags, setPaymentMethod]);

  const changeQty = (id, delta, event) => {
    event.stopPropagation();
    setServiceError("");
    setLoadQuantities(prev => ({
      ...prev,
      [id]: Math.max(1, Number(prev[id] || 1) + delta),
    }));
  };

  const toggleLoadType = id => {
    setServiceError("");
    setSelectedLoads(prev => {
      if (prev.includes(id)) {
        return prev.filter(loadId => loadId !== id);
      }

      return [...prev, id];
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3878c2]"></div>
      </div>
    );
  }

  const handleNextSubmit = () => {
    const hasService = Object.values(services).some(val => val > 0);
    if (!hasService) {
      setServiceError("Please select at least one laundry service to continue.");
      return;
    }

    if (!canProceed) {
      setServiceError("Please accept the Terms & Conditions and booking agreement to continue.");
      return;
    }

    setBagDescription(bagDescriptionDraft);
    setServiceError("");
    onNext();
  };

  return (
    <>
      <div className="px-0 sm:px-2">
        <div className="mb-8">
          <BookNowStepTitle>Laundry Details</BookNowStepTitle>
        </div>

        {serviceError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium animate-pulse">
             ⚠️ {serviceError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          <div>
            <SectionLabel>Service</SectionLabel>
            <Card>
              <div style={{ padding: '1.25rem 1.375rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#1f2937' }}>
                      Full Service Laundry
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 3 }}>
                      Includes wash, dry, fold, detergent, and fabric conditioner.
                    </p>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 20 }}>
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#3878c2', letterSpacing: '-0.03em' }}>
                      ₱220
                    </span>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 1 }}>/ load</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <SectionLabel>Load Type</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadOptions.map(option => {
                const active = selectedLoads.includes(option.id);

                return (
                  <div
                    key={option.id}
                    onClick={() => toggleLoadType(option.id)}
                    style={{
                      background: '#fff',
                      border: `2px solid ${active ? '#3878c2' : 'rgba(99,188,230,0.22)'}`,
                      borderRadius: '0.875rem',
                      padding: '1rem 1.25rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      boxShadow: active
                        ? '0 2px 12px rgba(56,120,194,0.12)'
                        : '0 1px 4px rgba(56,120,194,0.04)',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleLoadType(option.id)}
                      onClick={event => event.stopPropagation()}
                      style={{ width: 18, height: 18, accentColor: '#3878c2', flexShrink: 0 }}
                    />

                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: active ? '#1f2937' : '#374151' }}>
                        {option.label}
                      </p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 400, color: '#6b7280', marginTop: 1 }}>
                        {option.sublabel}
                      </p>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 400, color: '#6b7280', marginTop: 2 }}>
                        {option.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {active ? (
                        <>
                          <button
                            type="button"
                            onClick={event => changeQty(option.id, -1, event)}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              border: '1.5px solid #d1d5db',
                              background: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#6b7280',
                            }}
                          >
                            −
                          </button>

                          <span style={{ width: 22, textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: '#1f2937' }}>
                            {loadQuantities[option.id] || 1}
                          </span>

                          <button
                            type="button"
                            onClick={event => changeQty(option.id, 1, event)}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              border: '1.5px solid #d1d5db',
                              background: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#6b7280',
                            }}
                          >
                            +
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: '#d1d5db', fontWeight: 500 }}>
                          Qty: 0
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <SectionLabel>Laundry Bag Information</SectionLabel>
            <Card style={{ padding: '1.125rem 1.375rem' }}>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Describe your laundry bag and items inside
                </span>

                <BookNowLimitedTextBox
                  as="textarea"
                  value={bagDescriptionDraft}
                  onChange={event => setBagDescriptionDraft(event.target.value)}
                  onBlur={event => setBagDescription(event.target.value)}
                  placeholder="Example: 1 blue laundry bag with shirts and pants"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />

                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 6 }}>
                  Optional • Up to 500 characters
                </p>
              </label>
            </Card>
          </div>

          <div>
            <SectionLabel>Payment Method</SectionLabel>
            <Card style={{ padding: '1rem 1.375rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1f2937' }}>GCash</p>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <SectionLabel>Order Total</SectionLabel>
            <Card style={{ padding: '1.125rem 1.375rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 0.6fr 0.9fr',
                  gap: 12,
                  paddingBottom: 10,
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: '#374151',
                }}
              >
                <span>Load Type</span>
                <span style={{ textAlign: 'center' }}>Qty</span>
                <span style={{ textAlign: 'right' }}>Subtotal</span>
              </div>

              {selectedLoadOptions.map(option => {
                const quantity = loadQuantities[option.id] || 1;
                const subtotal = option.price * quantity;

                return (
                  <div
                    key={option.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 0.6fr 0.9fr',
                      gap: 12,
                      padding: '0.75rem 0',
                      borderBottom: '1px solid #f3f4f6',
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      alignItems: 'center',
                    }}
                  >
                    <span>{option.label}</span>
                    <span style={{ textAlign: 'center' }}>{quantity}</span>
                    <span style={{ textAlign: 'right' }}>₱{subtotal}</span>
                  </div>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
                <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#374151' }}>Total</span>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#3878c2', letterSpacing: '-0.03em' }}>
                  ₱{total}
                </span>
              </div>
            </Card>
          </div>

          <div>
            <SectionLabel>Agreement</SectionLabel>
            <Card style={{ padding: 0 }}>
              <label
                style={{
                  ...agreementRowStyle,
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={event => setAcceptedTerms(event.target.checked)}
                  style={agreementCheckboxStyle}
                />

                <span style={agreementTextStyle}>
                  I accept the Terms &amp; Conditions
                </span>
              </label>

              <label style={agreementRowStyle}>
                <input
                  type="checkbox"
                  checked={acceptedPolicy}
                  onChange={event => setAcceptedPolicy(event.target.checked)}
                  style={agreementCheckboxStyle}
                />

                <span style={agreementTextStyle}>
                  I understand that only the selected load type and quantity will be processed. Extra items or excess weight
                  will not be processed unless stated in my booking.
                </span>
              </label>
            </Card>
          </div>
        </div>

        <button
          onClick={handleNextSubmit}
          className={`mt-8 mx-auto xl:mr-0 xl:ml-auto block w-40 md:w-48 xl:w-52 py-2 md:py-3 xl:py-2.5 rounded-lg text-white font-bold text-base md:text-lg xl:text-base transition-all shadow-md active:scale-95 ${canProceed ? 'cursor-pointer hover:bg-[#3f9136]' : 'cursor-not-allowed opacity-70'}`}
          style={{ backgroundColor: canProceed ? "#4bad40" : "#b4b4b4" }}
        >
          Next
        </button>
      </div>
    </>
  );
}

function BookNowLimitedTextBox({
  maxLength = 500,
  onChange,
  onBlur,
  value = "",
  ...props
}) {
  const limitValue = (nextValue) => nextValue.slice(0, maxLength);

  const handleChange = (event) => {
    const limitedValue = limitValue(event.target.value);

    if (limitedValue !== event.target.value) {
      event.target.value = limitedValue;
    }

    if (onChange) onChange(event);
  };

  const handleBlur = (event) => {
    const limitedValue = limitValue(event.target.value);

    if (limitedValue !== event.target.value) {
      event.target.value = limitedValue;
    }

    if (onBlur) onBlur(event);
  };

  return (
    <BookNowTextBox
      {...props}
      value={limitValue(value || "")}
      onChange={handleChange}
      onBlur={handleBlur}
      maxLength={maxLength}
    />
  );
}


/* =========================
   Reusable Components
========================= */
function QuantityInput({ value, onChange, allowDecimal, minValue = 0 }) {
  const handleChange = (e) => {
    let val = e.target.value;

    // Allow empty input
    if (val === "") {
      onChange("");
      return;
    }

    // Allow only numbers (and 1 decimal if allowDecimal)
    const regex = allowDecimal ? /^(\d+\.?\d{0,1})?$/ : /^\d*$/;
    if (!regex.test(val)) return;

    // Remove leading zero if user types a non-zero number
    if (!allowDecimal && val.length > 1 && val.startsWith("0")) {
      val = val.replace(/^0+/, "");
    }

    onChange(val);
  };

  const handleBlur = () => {
    let num = parseFloat(value);
    if (isNaN(num) || num < minValue) num = minValue;

    if (allowDecimal) {
      num = Math.round(num * 10) / 10;
    } else {
      num = Math.floor(num);
    }

    onChange(num);
  };

  const handleIncrement = () => {
    let num = parseFloat(value) || 0;
    num += 1;
    if (allowDecimal) num = Math.ceil(num * 10) / 10;
    onChange(num);
  };

  const handleDecrement = () => {
    let num = parseFloat(value) || 0;
    num -= 1;
    if (num < minValue) num = minValue;
    if (allowDecimal) num = Math.floor(num * 10) / 10;
    onChange(num);
  };

  return (
    <div className="flex items-center max-w-[8rem]">
      <button
        onClick={handleDecrement}
        disabled={parseFloat(value) <= minValue || value === ""}
        className={`px-3 h-10 border rounded-l ${
          parseFloat(value) <= minValue || value === "" ? "opacity-40 cursor-not-allowed" : ""
        }`}
        style={{ borderColor: "#3878c2", color: "#3878c2" }}
      >
        −
      </button>

      <input
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        type="text"
        className="w-full h-10 text-center border-y bg-white outline-none"
        style={{ borderColor: "#3878c2", color: "#3878c2" }}
      />

      <button
        onClick={handleIncrement}
        className="px-3 h-10 border rounded-r"
        style={{ borderColor: "#3878c2", color: "#3878c2" }}
      >
        +
      </button>
    </div>
  );
}

/* =========================
   Icons
========================= */
function PlusIcon({ color = "currentColor" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke={color}
      className="w-4 h-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function CheckIcon({ color = "currentColor" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke={color}
      className="w-4 h-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

const timeSlots = [
  { id: "morning", label: "Morning", time: "8:30 AM", value: "08:30", hour: 8, minute: 30 },
  { id: "afternoon", label: "Afternoon", time: "1:00 PM", value: "13:00", hour: 13, minute: 0 },
];

function getSlotTime(slotId) {
  return timeSlots.find((slot) => slot.id === slotId)?.value || "";
}

function getSlotIdByValue(value) {
  return timeSlots.find((slot) => slot.value === value)?.id || null;
}

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getSlotDateTime(date, slotId) {
  const selectedSlot = timeSlots.find((slot) => slot.id === slotId);

  if (!date || !selectedSlot) return null;

  const dateTime = new Date(`${date}T00:00:00`);
  dateTime.setHours(selectedSlot.hour, selectedSlot.minute, 0, 0);

  return dateTime;
}

function isPastSlotToday(date, slotId) {
  const slotDateTime = getSlotDateTime(date, slotId);

  if (!slotDateTime || date !== getTodayDateString()) return false;

  return slotDateTime <= new Date();
}

function areAllTodayTimeSlotsPast() {
  const today = getTodayDateString();

  return timeSlots.every((slot) => isPastSlotToday(today, slot.id));
}

function getScheduleMinDateString() {
  return areAllTodayTimeSlotsPast() ? getTomorrowDateString() : getTodayDateString();
}

function isUnavailableScheduleDate(date) {
  return date === getTodayDateString() && areAllTodayTimeSlotsPast();
}

function ScheduleCard({ title, dateLabel, date, onDateChange, slot, onSlotChange }) {
  const minScheduleDate = getScheduleMinDateString();

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "1rem",
        boxShadow: "0 2px 16px rgba(56,120,194,0.09)",
        border: "1px solid rgba(99,188,230,0.28)",
        padding: "1.75rem",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <h2
          style={{
            fontWeight: 700,
            fontSize: "1.0625rem",
            color: "#1f2937",
          }}
        >
          {title}
        </h2>
      </div>

      <label style={{ display: "block", marginBottom: 6 }}>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "#9ca3af",
          }}
        >
          {dateLabel}
        </span>

        <div style={{ position: "relative", marginTop: 8 }}>
          <input
            type="date"
            value={date}
            min={minScheduleDate}
            onChange={(event) => onDateChange(event.target.value)}
            onClick={(e) => e.target.showPicker && e.target.showPicker()}
            style={{
              width: "100%",
              border: `1.5px solid ${date ? "#3878c2" : "#e5e7eb"}`,
              borderRadius: "0.625rem",
              padding: "0.75rem 1rem",
              fontSize: "0.9375rem",
              color: date ? "#1f2937" : "#9ca3af",
              background: "#fff",
              outline: "none",
              fontFamily: "Inter, sans-serif",
              boxSizing: "border-box",
              cursor: "pointer",
            }}
          />
        </div>
      </label>

      <div
        style={{
          overflow: "hidden",
          maxHeight: date ? 200 : 0,
          opacity: date ? 1 : 0,
          transition: "max-height 0.3s ease, opacity 0.25s ease",
          marginTop: date ? 20 : 0,
        }}
      >
        <span
          style={{
            display: "block",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "#9ca3af",
            marginBottom: 10,
          }}
        >
          {title.split(" ")[0]} Time Slot
        </span>

        <div className="flex gap-3">
          {timeSlots.map(({ id, label, time }) => {
            const active = slot === id;
            const disabled = isPastSlotToday(date, id);

            return (
              <button
                type="button"
                key={id}
                onClick={() => {
                  if (!disabled) onSlotChange(id);
                }}
                disabled={disabled}
                style={{
                  flex: 1,
                  border: `2px solid ${active ? "#3878c2" : "#e5e7eb"}`,
                  borderRadius: "0.75rem",
                  padding: "0.875rem 0.75rem",
                  background: active ? "rgba(56,120,194,0.05)" : "#fff",
                  cursor: disabled ? "not-allowed" : "pointer",
                  textAlign: "center",
                  transition: "all 0.15s",
                  fontFamily: "Inter, sans-serif",
                  opacity: disabled ? 0.45 : 1,
                }}
              >
                <p
                  style={{
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    color: active ? "#3878c2" : "#374151",
                    marginBottom: 2,
                  }}
                >
                  {label}
                </p>

                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: active ? "#3878c2" : "#9ca3af",
                    fontWeight: 500,
                  }}
                >
                  {time}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepSchedule({
  onBack,
  onNext,
  collectionInfo,
  setCollectionInfo,
  deliveryInfo,
  setDeliveryInfo,
  totalEstimatedHours,
}) {
  const { showToast } = useToast();
  const [error, setError] = useState("");
  const [isValidTime, setIsValidTime] = useState(false);

  const optionLabel = "Pickup & Delivery";

  useEffect(() => {
    if (collectionInfo.option !== "pickedUpDelivered" || collectionInfo.optionLabel !== optionLabel) {
      setCollectionInfo((previous) => ({
        ...previous,
        option: "pickedUpDelivered",
        optionLabel,
      }));
    }
  }, [collectionInfo.option, collectionInfo.optionLabel, setCollectionInfo]);

  function getPickupDeliveryScheduleError() {
    const collectionDateTime = getSlotDateTime(
      collectionInfo.date,
      collectionInfo.collectionSlot
    );

    const deliveryDateTime = getSlotDateTime(
      deliveryInfo.date,
      deliveryInfo.deliverySlot
    );

    if (!collectionDateTime || !deliveryDateTime) {
      return "Please select a date and time slot to continue.";
    }

    if (
      isUnavailableScheduleDate(collectionInfo.date) ||
      isUnavailableScheduleDate(deliveryInfo.date)
    ) {
      return "Please select a future date to continue.";
    }

    if (
      isPastSlotToday(collectionInfo.date, collectionInfo.collectionSlot) ||
      isPastSlotToday(deliveryInfo.date, deliveryInfo.deliverySlot)
    ) {
      return "Please select a future time slot to continue.";
    }

    if (deliveryDateTime <= collectionDateTime) {
      return "Delivery schedule must be after the pickup schedule.";
    }

    return "";
  }

  function validatePickupDeliverySchedule(showError = false) {
    const validationError = getPickupDeliveryScheduleError();

    if (showError) {
      setError(validationError);
    }

    return validationError === "";
  }

  useEffect(() => {
    setIsValidTime(validatePickupDeliverySchedule(false));
  }, [
    collectionInfo.date,
    collectionInfo.collectionSlot,
    deliveryInfo.date,
    deliveryInfo.deliverySlot,
  ]);

  function updatePickupDate(date) {
    setCollectionInfo((previous) => {
      if (previous.date === date) return previous;
      return {
        ...previous,
        option: "pickedUpDelivered",
        optionLabel,
        date,
        time: "",
        collectionSlot: null,
      };
    });

    setError((prev) => (prev ? "" : prev));
  }

  function updatePickupSlot(slotId) {
    setCollectionInfo((previous) => ({
      ...previous,
      option: "pickedUpDelivered",
      optionLabel,
      time: getSlotTime(slotId),
      collectionSlot: slotId,
    }));

    setError((prev) => (prev ? "" : prev));
  }

  function updateDeliveryDate(date) {
    setDeliveryInfo((previous) => {
      if (previous.date === date) return previous;
      return {
        ...previous,
        date,
        time: "",
        deliverySlot: null,
      };
    });

    setError((prev) => (prev ? "" : prev));
  }

  function updateDeliverySlot(slotId) {
    setDeliveryInfo((previous) => ({
      ...previous,
      time: getSlotTime(slotId),
      deliverySlot: slotId,
    }));

    setError((prev) => (prev ? "" : prev));
  }

  function handleNext() {
    const validationError = getPickupDeliveryScheduleError();

    if (validationError) {
      setError(validationError);
      showToast(validationError, "error");
      return;
    }

    setError("");
    onNext();
  }

  return (
    <div
      className="text-[#3878c2] space-y-6 px-0 sm:px-2"
      style={{
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <BookNowStepTitle>Pickup &amp; Delivery Schedule</BookNowStepTitle>

          {totalEstimatedHours > 0 && (
            <div className="text-xs font-medium text-gray-500 italic">
              Total Estimated Duration: {totalEstimatedHours} hours
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 18,
            padding: "0.85rem 1rem",
            borderRadius: "0.75rem",
            background: "#fee2e2",
            color: "#991b1b",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-5 mb-4">
        <ScheduleCard
          title="Pickup Schedule"
          dateLabel="Pickup Date"
          date={collectionInfo.date || ""}
          onDateChange={updatePickupDate}
          slot={collectionInfo.collectionSlot}
          onSlotChange={updatePickupSlot}
        />

        <ScheduleCard
          title="Delivery Schedule"
          dateLabel="Delivery Date"
          date={deliveryInfo.date || ""}
          onDateChange={updateDeliveryDate}
          slot={deliveryInfo.deliverySlot}
          onSlotChange={updateDeliverySlot}
        />
      </div>

      <div className="flex items-center justify-between gap-4 pb-12 mt-10">
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: "0.75rem 2rem",
            border: "1.5px solid #d1d5db",
            borderRadius: "0.625rem",
            fontWeight: 600,
            color: "#6b7280",
            background: "#fff",
            cursor: "pointer",
            fontSize: "0.9375rem",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Back
        </button>

        <button
          type="button"
          onClick={handleNext}
          style={{
            padding: "0.75rem 2.5rem",
            border: "none",
            borderRadius: "0.625rem",
            fontWeight: 700,
            color: "#fff",
            background: isValidTime ? "#4bad40" : "#d1d5db",
            cursor: isValidTime ? "pointer" : "not-allowed",
            fontSize: "0.9375rem",
            fontFamily: "Inter, sans-serif",
            letterSpacing: "-0.01em",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* =========================
   Step 3 - Address
========================= */
function StepAddress({ onBack, onNext, isMapLoaded, initialLocation, saveHomeAddress, setSaveHomeAddress }) {
  const { showToast } = useToast();
  const [autocomplete, setAutocomplete] = useState(null);
  const [location, setLocation] = useState(initialLocation?.lat ? initialLocation : { address: "", lat: null, lng: null });
  const [mapCenter, setMapCenter] = useState(initialLocation?.lat ? { lat: initialLocation.lat, lng: initialLocation.lng } : defaultCenter);
  const [searchValue, setSearchValue] = useState(initialLocation?.address || "");
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Auto-reverse geocode when location coordinates change
  useEffect(() => {
    if (initialLocation?.lat && initialLocation?.lng && !initialLocation?.address && isMapLoaded) {
      setIsGeocoding(true);
      try {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: initialLocation.lat, lng: initialLocation.lng } }, (results, status) => {
          setIsGeocoding(false);
          if (status === "OK" && results && results[0]) {
            const address = results[0].formatted_address;
            setLocation({ address, lat: initialLocation.lat, lng: initialLocation.lng });
            setSearchValue(address);
            setMapCenter({ lat: initialLocation.lat, lng: initialLocation.lng });
          }
        });
      } catch (err) {
        setIsGeocoding(false);
        console.error("Reverse geocoding failed:", err);
      }
    }
  }, [initialLocation?.lat, initialLocation?.lng, initialLocation?.address, isMapLoaded]);

  const onLoad = (autoC) => setAutocomplete(autoC);

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || place.name;
        setLocation({ address, lat, lng });
        setMapCenter({ lat, lng });
        setSearchValue(address);
      }
    }
  };

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMapCenter({ lat, lng });
    setIsGeocoding(true);

    // Attempt reverse geocoding to get a human-readable address
    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        setIsGeocoding(false);
        if (status === "OK" && results && results[0]) {
          const address = results[0].formatted_address;
          setLocation({ address, lat, lng });
          setSearchValue(address);
        } else {
          // Geocoding API not available yet — pin was dropped but address couldn't be resolved.
          // Store a friendly label + coordinates so rider navigation still works.
          setLocation({ address: "", lat, lng });
          setSearchValue("");
          // Prompt the customer to type their address in the search box
          showToast(
            "📍 Your pin has been set!\n\nWe couldn't automatically detect your street name. Please type your full address (e.g. '123 Rizal St, Las Piñas') in the search bar above so we can record it correctly.",
            "error"
          );
        }
      });
    } catch {
      setIsGeocoding(false);
      setLocation({ address: "", lat, lng });
      setSearchValue("");
      showToast(
        "📍 Your pin has been set!\n\nPlease type your complete address in the search bar above so we can record it.",
        "error"
      );
    }
  };

  // Allow manual address typing when geocoding isn't available
  const handleManualAddressConfirm = () => {
    if (searchValue.trim().length > 3) {
      setLocation((prev) => ({ ...prev, address: searchValue.trim() }));
    }
  };

  const handleNext = () => {
    if (!location.lat) {
      showToast("Please pin your location on the map or search for your address first.", "error");
      return;
    }
    if (!location.address || location.address.trim().length < 5) {
      showToast("Please confirm your address by searching for it or typing it in the search box above.", "error");
      return;
    }
    onNext(location);
  };


  return (
    <div className="flex flex-col min-h-[70vh] sm:min-h-[72vh] bg-[#eff8fc] text-[#1f2937] pb-6 px-0 sm:px-2 relative">
      <div className="z-20 mx-auto w-full max-w-2xl md:max-w-6xl lg:max-w-7xl px-2 sm:px-1 pt-2 pb-4">
        <div className="mb-8">
          <BookNowStepTitle>Address Details</BookNowStepTitle>
        </div>
        <label htmlFor="simple-search" className="sr-only">Search</label>
        <div className="flex items-center gap-2">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1f2937] bg-white shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-[#1f2937]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>

          {/* Autocomplete search */}
          <div className="relative flex-1 bg-[#eff8fc] shadow-sm rounded-lg">
            {isMapLoaded ? (
              <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
                <input
                  type="text"
                  id="simple-search"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#1f2937] bg-[#eff8fc] text-[#1f2937] placeholder:text-[#b4b4b4] focus:outline-none focus:ring-1 focus:ring-[#1f2937]"
                  placeholder="Search for your address or tap the map..."
                  value={searchValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchValue(val);
                    // If the user is typing manually (pin set but no geocoded address yet), save the typed text as the address
                    if (location.lat) {
                      setLocation((prev) => ({ ...prev, address: val }));
                    }
                  }}
                  onBlur={handleManualAddressConfirm}
                />
              </Autocomplete>
            ) : (
              <input
                type="text"
                disabled
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#1f2937] bg-[#eff8fc] text-[#b4b4b4]"
                placeholder="Loading map..."
              />
            )}
          </div>
        </div>
      </div>

      {/* Map area */}
      <div className="relative flex-1 min-h-[40vh] mx-2 sm:mx-0 sm:min-h-[50vh] bg-gray-50 overflow-hidden rounded-xl border border-[#1f2937]/20 shadow-inner mb-28">
        {isMapLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            center={mapCenter}
            zoom={location.lat ? 17 : 13}
            options={{ disableDefaultUI: false, zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
            onClick={handleMapClick}
          >
            {location.lat && (
              <Marker position={{ lat: location.lat, lng: location.lng }} />
            )}
          </GoogleMap>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1f2937] mb-2"></div>
            <span className="text-sm font-semibold text-[#1f2937]">Loading Maps...</span>
          </div>
        )}

        {/* Geocoding loading overlay */}
        {isGeocoding && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10">
            <div className="bg-white px-4 py-2 rounded-lg shadow-md flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1f2937]"></div>
              <span className="text-xs text-[#1f2937] font-semibold">Getting address...</span>
            </div>
          </div>
        )}

        {/* Tap hint if no location pinned yet */}
        {isMapLoaded && !location.lat && !isGeocoding && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 text-[#1f2937] text-xs font-semibold px-4 py-2 rounded-full shadow-md pointer-events-none whitespace-nowrap">
            📍 Tap the map to pin your location
          </div>
        )}
      </div>

      {/* Bottom dock */}
      <div
        className="fixed sm:absolute bottom-0 left-0 right-0 w-full px-4 pt-4 pb-6 sm:px-6 shadow-[0_-8px_15px_-3px_rgba(0,0,0,0.1)] rounded-t-3xl border-t border-[#1f2937]/20 z-30"
        style={{ backgroundColor: "#63bce6" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3">
            <p className="text-xs font-semibold text-white uppercase tracking-wider">Selected Location</p>
            <p className="text-sm font-bold text-white truncate">{location.address || "No location selected — tap map or search above"}</p>
          </div>
          {location.lat && (
            <label className="flex items-center justify-center gap-2 mb-3 text-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveHomeAddress}
                onChange={(e) => setSaveHomeAddress(e.target.checked)}
                className="w-4 h-4 rounded border-white text-[#1f2937] focus:ring-[#1f2937]"
              />
              <span className="text-sm font-medium">Save as my home address</span>
            </label>
          )}
          <button
            onClick={handleNext}
            disabled={!location.lat || isGeocoding}
            className={`w-full py-3 rounded-lg font-bold transition-all shadow-md ${!location.lat || isGeocoding ? "bg-white/50 text-[#1f2937]/50 cursor-not-allowed" : "bg-white text-[#1f2937] hover:bg-gray-50 active:scale-[0.98]"}`}
          >
            {isGeocoding ? "Getting address..." : "Confirm this location"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepReview({
  onBack,
  services = {},
  weight = 0,
  availableServices = [],
  paymentMethod = "gcash",
  collectionInfo = { optionLabel: "-", date: "", time: "" },
  deliveryInfo = { date: "", time: "" },
  customerLocation,
  notes,
  setNotes,
  numberOfBags,
  bagDescription,
  isEditMode,
  editId,
  saveHomeAddress,
  clearBookingState,
  onEditSuccess,
  availableLoads = [],
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [bookingStatus, setBookingStatus] = useState("success");
  const [backendError, setBackendError] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOptions = availableLoads.length > 0 ? availableLoads : [
    { id: 'regular', label: 'Regular Light Mix', price: 220 },
    { id: 'heavy', label: 'Heavy Load', price: 220 },
    { id: 'perPiece', label: 'Per Piece', price: 220 },
  ];

  const getStoredValue = (key, fallback) => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch {
      return fallback;
    }
  };

  const selectedLoads = getStoredValue('bookingSelectedLoad', ['regular']);
  const loadQuantities = getStoredValue('bookingLoadQuantities', { regular: numberOfBags || 1 });
  const selectedLoadOptions = loadOptions
    .filter(option => Array.isArray(selectedLoads) ? selectedLoads.includes(option.id) : selectedLoads === option.id)
    .map(option => ({
      ...option,
      quantity: Number(loadQuantities[option.id] || 1),
    }));

  const fallbackLaundryRows = selectedLoadOptions.length > 0
    ? selectedLoadOptions
    : [{ id: 'regular', label: 'Regular Light Mix', price: 220, quantity: Number(numberOfBags) || 1 }];

  const calculateTotal = () => {
    return fallbackLaundryRows.reduce(
      (sum, option) => sum + (Number(option.price) || 0) * (Number(option.quantity) || 1),
      0
    );
  };

  const generateReferenceNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `HL-${timestamp}-${randomPart}`;
  };

  const submitBooking = async () => {
    if (isSubmitting) return; // Prevent spam clicking
    setIsSubmitting(true);
    
    const nextReference = isEditMode ? editId : generateReferenceNumber();
    const nextPaymentReference = "";

    // Build the booking payload
    const selectedServices = Object.entries(services)
      .filter(([, isSelected]) => Boolean(isSelected))
      .map(([serviceName]) => serviceName);

    const routeAddresses = getRouteAddresses("pickedUpDelivered");
    const finalPickup = customerLocation?.address || routeAddresses.pickupAddress;
    const finalDelivery = customerLocation?.address || routeAddresses.deliveryAddress;

    const payload = {
      reference_number: nextReference,
      collection_option: "pickedUpDelivered",
      service_details: {
        services,
        selectedServices,
        weight,
        numberOfBags,
        bagDescription,
        selectedLoads: Array.isArray(selectedLoads) ? selectedLoads : [selectedLoads],
        loadQuantities,
        selectedLoadDetails: fallbackLaundryRows.map(({ id, label, price, quantity }) => ({
          id,
          label,
          price,
          quantity,
        })),
        availableServices, // Cache prices for historical accuracy
            },
      collection_details: {
        option: "pickedUpDelivered",
        optionLabel: "Pickup & Delivery",
        collectionDate: collectionInfo.date || "",
        collectionTime: collectionInfo.time || "",
        collectionSlot: collectionInfo.collectionSlot || null,
        deliveryDate: deliveryInfo.date || "",
        deliveryTime: deliveryInfo.time || "",
        deliverySlot: deliveryInfo.deliverySlot || null,
        pickupAddress: finalPickup,
        deliveryAddress: finalDelivery,
        customerAddress: customerLocation?.address || null,
        lat: customerLocation?.lat || null,
        lng: customerLocation?.lng || null,
      },
      payment_details: {
        method: paymentMethod === "gcash" ? "GCash" : "Cash",
        referenceNumber: paymentMethod === "gcash" ? "" : "-",
        status: paymentMethod === "gcash" ? "For confirmation" : "Pay on collection",
        totalAmount: calculateTotal(),
        downpaymentRequired: 0,
        amountToPay: calculateTotal(), // Full payment via GCash
        balance: 0,
      },
      notes: notes || "",
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("No authentication token found");
      }

      const url = isEditMode 
        ? `${import.meta.env.VITE_API_URL}/api/v1/customer/my-bookings/${editId}/update` 
        : `${import.meta.env.VITE_API_URL}/api/v1/customer/book`;
      
      const method = isEditMode ? "PATCH" : "POST";

      console.log("Booking request:", { url, method, payload });

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      console.log("Booking response:", response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log("Booking result:", result);
        const ref = isEditMode ? editId : (result.booking?.reference_number || nextReference);
        
        if (isEditMode) {
          showToast("Booking updated successfully.", "success");
          if (onEditSuccess) {
            onEditSuccess();
          } else {
            navigate(`/bookings/${editId}`);
          }
          return;
        }

        // If non-edit mode and user wants to save their address, store it in their profile
        if (saveHomeAddress && customerLocation?.lat) {
          try {
            await fetch(`${import.meta.env.VITE_API_URL}/api/v1/customer/profile`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                address: customerLocation.address,
                lat: customerLocation.lat,
                lng: customerLocation.lng,
              })
            });
          } catch (e) {
            console.error("Failed to save home address to profile:", e);
          }
        }

         setBookingStatus("success");
         setReferenceNumber(ref);
         setPaymentReference(nextPaymentReference);
         try {
           clearBookingState(); // Clear saved state on success
         } catch (clearError) {
           console.error("Error clearing booking state:", clearError);
         }
       } else {
        const errData = await response.json().catch(() => ({}));
        console.error("Booking request failed:", errData.error || response.statusText);
        setBookingStatus("error");
        setBackendError(errData.error || "Please try again.");
        setReferenceNumber("");
        setPaymentReference("");
      }
    } catch (err) {
      console.error("Booking request error:", err);
      setBookingStatus("error");
      setBackendError("An unexpected error occurred. Please try again.");
      setReferenceNumber("");
      setPaymentReference("");
    } finally {
      setIsSubmitting(false);
    }

    setIsSuccessOpen(true);
  };

  const displayAddress = customerLocation?.address || "-";
  const displayNotesLength = notes?.length || 0;
  const totalAmount = calculateTotal();

  const SectionCard = ({ label, children }) => (
    <section
      style={{
        background: '#fff',
        borderRadius: '1rem',
        border: '1px solid rgba(99,188,230,0.28)',
        boxShadow: '0 2px 14px rgba(56,120,194,0.07)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0.875rem 1.375rem',
          borderBottom: '1px solid #f3f4f6',
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#9ca3af',
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ padding: '1.25rem 1.375rem' }}>
        {children}
      </div>
    </section>
  );

  const Row = ({ label, value }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '0.375rem 0',
        fontSize: '0.9375rem',
      }}
    >
      <span style={{ color: '#6b7280', fontWeight: 500 }}>{label}</span>
      <span style={{ color: '#1f2937', fontWeight: 700, textAlign: 'right' }}>{value || '-'}</span>
    </div>
  );

  return (
    <div
      className="min-h-screen"
      style={{
        background: '#EFF8FC',
        fontFamily: 'Inter, sans-serif',
        minHeight: '100vh',
      }}
    >
      <div className="max-w-3xl mx-auto px-6 py-10" style={{ maxWidth: 768, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div className="mb-8" style={{ marginBottom: '2rem' }}>
          <BookNowStepTitle>Review &amp; Confirm</BookNowStepTitle>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionCard label="Laundry Details">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 0.6fr 0.9fr',
                gap: 12,
                paddingBottom: 10,
                borderBottom: '1px solid #e5e7eb',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: '#374151',
              }}
            >
              <span>Load Type</span>
              <span style={{ textAlign: 'center' }}>Qty</span>
              <span style={{ textAlign: 'right' }}>Subtotal</span>
            </div>

            {fallbackLaundryRows.map((option) => {
              const subtotal = option.price * option.quantity;

              return (
                <div
                  key={option.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 0.6fr 0.9fr',
                    gap: 12,
                    padding: '0.75rem 0',
                    borderBottom: '1px solid #f3f4f6',
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    alignItems: 'center',
                  }}
                >
                  <span>{option.label}</span>
                  <span style={{ textAlign: 'center' }}>{option.quantity}</span>
                  <span style={{ textAlign: 'right' }}>₱{subtotal}</span>
                </div>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#374151' }}>Total</span>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: '#3878c2', letterSpacing: '-0.03em' }}>
                ₱{totalAmount}
              </span>
            </div>
          </SectionCard>

          <SectionCard label="Laundry Bag & Items Description">
            <p
              style={{
                fontSize: '0.9375rem',
                color: '#1f2937',
                fontWeight: 500,
                marginBottom: 0,
              }}
            >
              {bagDescription || "No description provided."}
            </p>
          </SectionCard>

          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1rem',
            }}
          >
            <SectionCard label="Pickup Schedule">
              <Row label="Date" value={formatDate(collectionInfo.date)} />
              <Row label="Time" value={formatTime(collectionInfo.time)} />
            </SectionCard>

            <SectionCard label="Delivery Schedule">
              <Row label="Date" value={formatDate(deliveryInfo.date)} />
              <Row label="Time" value={formatTime(deliveryInfo.time)} />
            </SectionCard>
          </div>

          <SectionCard label="Address Details">
            <p
              style={{
                fontSize: '0.9375rem',
                color: '#1f2937',
                fontWeight: 500,
                marginBottom: 0,
              }}
            >
              {displayAddress}
            </p>

            <div style={{ marginTop: '1rem' }}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 220,
                  borderRadius: '0.875rem',
                  overflow: 'hidden',
                  border: '1px solid rgba(99,188,230,0.28)',
                  background: '#e5e7eb',
                }}
              >
                <iframe
                  title="Pinned delivery location"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(displayAddress)}&output=embed`}
                  width="100%"
                  height="100%"
                  style={{
                    border: 0,
                    pointerEvents: 'none',
                    filter: 'saturate(0.95)',
                  }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <div
            style={{
              background: '#fff',
              borderRadius: '1rem',
              border: '1px solid rgba(99,188,230,0.28)',
              boxShadow: '0 2px 14px rgba(56,120,194,0.07)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0.875rem 1.375rem',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#9ca3af',
                }}
              >
                Special Instructions
              </span>
            </div>

            <div style={{ padding: '1.25rem 1.375rem' }}>

              <BookNowLimitedTextBox
                as="textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notes or requests for your laundry"
                rows={4}
              />

              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 6 }}>
                Optional • Up to 500 characters
              </p>

            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            paddingTop: 28,
            paddingBottom: 48,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '0.75rem 2rem',
              border: '1.5px solid #d1d5db',
              borderRadius: '0.625rem',
              fontWeight: 600,
              color: '#6b7280',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Back
          </button>

          <button
            type="button"
            onClick={submitBooking}
            disabled={isSubmitting}
            style={{
              padding: '0.75rem 2.25rem',
              border: 'none',
              borderRadius: '0.625rem',
              fontWeight: 700,
              color: '#fff',
              background: isSubmitting ? '#9ca3af' : '#4bad40',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '0.9375rem',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '-0.01em',
            }}
          >
            {isSubmitting ? (isEditMode ? "Updating..." : "Confirming...") : (isEditMode ? "Update Booking" : "Confirm Booking")}
          </button>
        </div>
      </div>

      {isSuccessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 text-center text-[#3878c2] shadow-lg">
            {bookingStatus === "success" ? (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f7e6]">
                <svg
                  className="h-6 w-6 text-[#4bad40]"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              </div>
            ) : (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#fde8e8]">
                <svg
                  className="h-6 w-6 text-[#e55353]"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </div>
            )}
            <h3 className="text-base font-semibold">
              {bookingStatus === "success"
                ? "Booking successful"
                : "Booking failed"}
            </h3>
            <p className="mt-1 text-sm text-[#3878c2]">
              {bookingStatus === "success"
                ? `Reference number: ${referenceNumber || "-"}`
                : backendError}
            </p>
            {bookingStatus === "success" ? (
              <p className="mt-2 text-xs text-[#3878c2]">
                Our staff will provide your total amount. Kindly settle payment via GCash.
              </p>
            ) : null}
            <button
              onClick={() => {
                 if (bookingStatus === "success") {
                   navigate("/payment", {
                     state: {
                       bookingReference: referenceNumber,
                       paymentReference,
                       amountToPay: calculateTotal(), 
                       isDownpayment: false,
                     },
                   });
                   return;
                 }
                setIsSuccessOpen(false);
              }}
              className="mt-4 w-full rounded-lg bg-[#4bad40] py-2 text-white"
            >
              {bookingStatus === "success" ? "Proceed to Payment" : "Try again"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Icons
========================= */
function CalendarIcon() {
  return (
    <svg
      className="w-4 h-4 text-[#3878c2]"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 10h16m-8-3V4M7 7V4m10 3V4M5 20h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Zm3-7h.01v.01H8V13Zm4 0h.01v.01H12V13Zm4 0h.01v.01H16V13Zm-8 4h.01v.01H8V17Zm4 0h.01v.01H12V17Zm4 0h.01v.01H16V17Z"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="w-4 h-4 text-[#3878c2]"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}
