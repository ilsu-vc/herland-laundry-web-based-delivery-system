import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/admin`;

const Colors = {
  blue: '#3878C2',
  blueMuted: '#6B7C93',
  sky: '#63BCE6',
  skyFaint: 'rgba(99, 188, 230, 0.12)',
  skyBd: 'rgba(99, 188, 230, 0.25)',
  green: '#4BAD40',
  greenFaint: 'rgba(75, 173, 64, 0.12)',
  yellow: '#ffde59',
  gray: '#b4b4b4',
  text: '#1F2937',
  subtext: '#64748B',
  white: '#FFFFFF',
  danger: '#EB5757',
  dangerFaint: 'rgba(235, 87, 87, 0.10)',
  border: '#E5EAF2',
  pageBg: '#F7FAFC',
};

const card = {
  background: Colors.white,
  border: `1px solid ${Colors.border}`,
  borderRadius: '1rem',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.06)',
};

const typography = {
  h1: {
    fontSize: '2rem',
    fontWeight: 900,
    color: Colors.text,
    letterSpacing: '-0.04em',
    lineHeight: 1.15,
    margin: 0,
  },
  h2: {
    fontSize: '1.25rem',
    fontWeight: 850,
    color: Colors.text,
    letterSpacing: '-0.025em',
    margin: 0,
  },
  h3: {
    fontSize: '1rem',
    fontWeight: 800,
    color: Colors.text,
    letterSpacing: '-0.02em',
    margin: 0,
  },
  body: {
    fontSize: '0.95rem',
    color: Colors.subtext,
    lineHeight: 1.65,
    margin: 0,
  },
  small: {
    fontSize: '0.875rem',
    color: Colors.subtext,
    lineHeight: 1.55,
    margin: 0,
  },
};

const fallbackServices = [
  {
    id: 'fallback-full-service',
    name: 'Full Service Laundry',
    currentPrice: 220,
    previousPrice: null,
    estimatedHours: 24,
  },
];

const defaultLoadOptions = [
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

const fallbackSchedule = {
  opens: '10:00',
  closes: '22:00',
};

const defaultFaqs = [
  {
    id: 'default-1',
    question: 'What services does Herland Laundry offer?',
    answer: 'Herland Laundry offers full service laundry including wash, dry, fold, detergent, and fabric conditioner.',
  },
  {
    id: 'default-2',
    question: 'How much is the laundry service?',
    answer: 'The laundry service starts at ₱220 depending on the selected load type and quantity.',
  },
  {
    id: 'default-3',
    question: 'How long does laundry usually take?',
    answer: 'Laundry is usually completed within the estimated service hours shown in the service details.',
  },
];

function formatCurrency(value) {
  const number = Number(value || 0);

  return `₱${number.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeItem(item) {
  return {
    id: item.id,
    name: item.name || '',
    currentPrice: Number(item.currentPrice ?? item.current_price ?? 0),
    previousPrice:
      item.previousPrice !== undefined
        ? item.previousPrice
        : item.previous_price !== undefined
          ? item.previous_price
          : null,
    estimatedHours: Number(item.estimatedHours ?? item.estimated_hours ?? 0),
  };
}

function normalizeSchedule(schedule) {
  return {
    opens: schedule?.opens || fallbackSchedule.opens,
    closes: schedule?.closes || fallbackSchedule.closes,
    previousOpens: schedule?.previousOpens ?? schedule?.previous_opens ?? null,
    previousCloses: schedule?.previousCloses ?? schedule?.previous_closes ?? null,
  };
}

function SectionLabel({ children }) {
  return (
    <div className="mb-2">
      <p
        style={{
          fontSize: '0.6875rem',
          fontWeight: 800,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: Colors.blueMuted,
          marginBottom: 10,
        }}
      >
        {children}
      </p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'block',
          fontSize: '0.78rem',
          fontWeight: 800,
          color: Colors.blueMuted,
          marginBottom: 7,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(15, 23, 42, 0.38)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          ...card,
          width: 'min(520px, 100%)',
          padding: '1.5rem',
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.22)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 18,
          }}
        >
          <h2 style={typography.h2}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: Colors.skyFaint,
              color: Colors.blue,
              width: 34,
              height: 34,
              borderRadius: 999,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

export default function ManageServices() {
  const [services, setServices] = useState(fallbackServices);
  const [loadOptions, setLoadOptions] = useState(defaultLoadOptions);
  const [schedule, setSchedule] = useState(fallbackSchedule);
  const [previousSchedule, setPreviousSchedule] = useState(null);
  const [faqs, setFaqs] = useState(defaultFaqs);

  const [loadEnabled, setLoadEnabled] = useState({
    regular: true,
    heavy: true,
    perPiece: true,
  });

  const [serviceDraft, setServiceDraft] = useState({
    name: '',
    currentPrice: '',
    estimatedHours: '',
  });

  const [faqDraft, setFaqDraft] = useState({
    question: '',
    answer: '',
  });

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [history, setHistory] = useState([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editType, setEditType] = useState('');
  const [editItem, setEditItem] = useState(null);

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [editingFaqId, setEditingFaqId] = useState(null);

  const openTimeRef = useRef(null);
  const closeTimeRef = useRef(null);

  const hasPreviousSchedule = useMemo(() => {
    return Boolean(previousSchedule?.opens && previousSchedule?.closes);
  }, [previousSchedule]);

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;

    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const addHistory = (message, details = '') => {
    const now = new Date();

    const newLog = {
      id: `${now.getTime()}-${Math.random()}`,
      message,
      details,
      formattedDate: now.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      formattedTime: now.toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setHistory((prev) => [newLog, ...prev]);
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
  };

  const fetchServicesData = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const headers = await getAuthHeaders();

      const [servicesResponse, faqsResponse] = await Promise.all([
        fetch(`${API_BASE}/services`, { headers }),
        fetch(`${API_BASE}/services/faqs`, { headers }),
      ]);

      if (!servicesResponse.ok) {
        throw new Error('Unable to load services.');
      }

      const servicesData = await servicesResponse.json();

      const incomingServices = Array.isArray(servicesData.services)
        ? servicesData.services.map(normalizeItem)
        : fallbackServices;

      const incomingSchedule = normalizeSchedule(servicesData.schedule);

      setServices(incomingServices.length ? incomingServices : fallbackServices);
      setSchedule({
        opens: incomingSchedule.opens,
        closes: incomingSchedule.closes,
      });

      if (incomingSchedule.previousOpens && incomingSchedule.previousCloses) {
        setPreviousSchedule({
          opens: incomingSchedule.previousOpens,
          closes: incomingSchedule.previousCloses,
        });
      }

      if (faqsResponse.ok) {
        const faqsData = await faqsResponse.json();

        if (Array.isArray(faqsData) && faqsData.length) {
          setFaqs(faqsData);
        }
      }
    } catch (error) {
      setFetchError(error.message || 'Something went wrong while loading services.');
      setServices(fallbackServices);
      setSchedule(fallbackSchedule);
      setFaqs(defaultFaqs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicesData();
  }, []);

  const handleAddItem = async (type) => {
    const draft = serviceDraft;
    const name = draft.name.trim();
    const price = Number(draft.currentPrice);
    const hours = Number(draft.estimatedHours);

    if (!name || Number.isNaN(price) || price < 0 || Number.isNaN(hours) || hours < 0) {
      setFetchError('Please enter a valid name, price, and estimated hours.');
      return;
    }

    try {
      setFetchError('');

      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE}/services/items`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          name,
          currentPrice: price,
          estimatedHours: hours,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to add service.');
      }

      const createdItem = normalizeItem(await response.json());

      setServices((prev) => [...prev, createdItem]);
      setServiceDraft({
        name: '',
        currentPrice: '',
        estimatedHours: '',
      });

      addHistory('Service added', `${name} was added with price ${formatCurrency(price)}.`);
      showSuccess('Service added successfully.');
    } catch (error) {
      setFetchError(error.message || 'Unable to add item.');
    }
  };

  const openEditItemModal = (type, item) => {
    setEditType(type);

    if (type === 'load') {
      setEditItem({
        id: item.id,
        oldId: item.id,
        label: item.label,
        sublabel: item.sublabel,
        description: item.description,
        price: Number(item.price || 0),
      });
    } else {
      setEditItem({
        ...item,
        currentPrice: Number(item.currentPrice || 0),
        estimatedHours: Number(item.estimatedHours || 0),
      });
    }

    setIsEditModalOpen(true);
  };

  const openEditScheduleModal = () => {
    setEditType('schedule');
    setEditItem({
      opens: schedule.opens,
      closes: schedule.closes,
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditType('');
    setEditItem(null);
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;

    try {
      setFetchError('');

      if (editType === 'load') {
        const updatedLoad = {
          id: editItem.id.trim(),
          label: editItem.label.trim(),
          sublabel: editItem.sublabel.trim(),
          description: editItem.description.trim(),
          price: Number(editItem.price),
        };

        if (
          !updatedLoad.id ||
          !updatedLoad.label ||
          !updatedLoad.sublabel ||
          !updatedLoad.description ||
          Number.isNaN(updatedLoad.price) ||
          updatedLoad.price < 0
        ) {
          setFetchError('Please enter a valid load type ID, label, sublabel, description, and price.');
          return;
        }

        setLoadOptions((prev) =>
          prev.map((item) => (item.id === editItem.oldId ? updatedLoad : item))
        );

        if (editItem.oldId !== updatedLoad.id) {
          setLoadEnabled((prev) => {
            const next = { ...prev, [updatedLoad.id]: prev[editItem.oldId] ?? true };
            delete next[editItem.oldId];
            return next;
          });
        }

        addHistory('Load type updated', `${updatedLoad.label} was updated.`);
        showSuccess('Load type updated successfully.');
        closeEditModal();
        return;
      }

      const headers = await getAuthHeaders();

      if (editType === 'schedule') {
        const prevSchedule = {
          opens: schedule.opens,
          closes: schedule.closes,
        };

        const response = await fetch(`${API_BASE}/services/schedule`, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            opens: editItem.opens,
            closes: editItem.closes,
            previousOpens: prevSchedule.opens,
            previousCloses: prevSchedule.closes,
          }),
        });

        if (!response.ok) {
          throw new Error('Unable to update shop schedule.');
        }

        setPreviousSchedule(prevSchedule);
        setSchedule({
          opens: editItem.opens,
          closes: editItem.closes,
        });

        addHistory(
          'Shop schedule updated',
          `Schedule changed from ${prevSchedule.opens} - ${prevSchedule.closes} to ${editItem.opens} - ${editItem.closes}.`
        );

        showSuccess('Shop schedule updated successfully.');
        closeEditModal();
        return;
      }

      const oldItem = services.find((item) => item.id === editItem.id);
      const oldPrice = Number(oldItem?.currentPrice || 0);

      const response = await fetch(`${API_BASE}/services/items/${editItem.id}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPrice: Number(editItem.currentPrice),
          previousPrice: oldPrice,
          estimatedHours: Number(editItem.estimatedHours),
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to update service.');
      }

      const updatedItem = {
        ...editItem,
        currentPrice: Number(editItem.currentPrice),
        previousPrice: oldPrice,
        estimatedHours: Number(editItem.estimatedHours),
      };

      setServices((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));

      addHistory(
        'Service updated',
        `${updatedItem.name} changed from ${formatCurrency(oldPrice)} to ${formatCurrency(updatedItem.currentPrice)}.`
      );

      showSuccess('Service updated successfully.');
      closeEditModal();
    } catch (error) {
      setFetchError(error.message || 'Unable to save changes.');
    }
  };

  const handleRevertSchedule = async () => {
    if (!hasPreviousSchedule) return;

    try {
      setFetchError('');
      const headers = await getAuthHeaders();

      const oldSchedule = {
        opens: schedule.opens,
        closes: schedule.closes,
      };

      const response = await fetch(`${API_BASE}/services/schedule`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          opens: previousSchedule.opens,
          closes: previousSchedule.closes,
          previousOpens: oldSchedule.opens,
          previousCloses: oldSchedule.closes,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to revert schedule.');
      }

      setSchedule({
        opens: previousSchedule.opens,
        closes: previousSchedule.closes,
      });

      setPreviousSchedule(oldSchedule);

      addHistory('Shop schedule reverted', `Schedule reverted to ${previousSchedule.opens} - ${previousSchedule.closes}.`);
      showSuccess('Shop schedule reverted successfully.');
    } catch (error) {
      setFetchError(error.message || 'Unable to revert schedule.');
    }
  };

  const closeDeleteModal = () => {
    setPendingDelete(null);
    setShowDeleteConfirmModal(false);
  };

  const handleDeleteItem = async () => {
    if (!pendingDelete) return;

    try {
      setFetchError('');
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE}/services/items/${pendingDelete.item.id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error('Unable to delete service.');
      }

      setServices((prev) => prev.filter((item) => item.id !== pendingDelete.item.id));
      addHistory('Service deleted', `${pendingDelete.item.name} was deleted.`);
      showSuccess('Service deleted successfully.');
      closeDeleteModal();
    } catch (error) {
      setFetchError(error.message || 'Unable to delete item.');
    }
  };

  const handleSaveFaq = async () => {
    const question = faqDraft.question.trim();
    const answer = faqDraft.answer.trim();

    if (!question || !answer) {
      setFetchError('Please enter both FAQ question and answer.');
      return;
    }

    try {
      setFetchError('');
      const isDefaultFaq = String(editingFaqId || '').startsWith('default-');
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE}/services/faqs`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: isDefaultFaq ? undefined : editingFaqId || undefined,
          question,
          answer,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to save FAQ.');
      }

      const savedFaq = await response.json();
      const normalizedFaq = {
        id: savedFaq.id || editingFaqId || `${Date.now()}`,
        question: savedFaq.question || question,
        answer: savedFaq.answer || answer,
      };

      if (editingFaqId) {
        setFaqs((prev) => prev.map((faq) => (faq.id === editingFaqId ? normalizedFaq : faq)));
        addHistory('FAQ updated', question);
        showSuccess('FAQ updated successfully.');
      } else {
        setFaqs((prev) => [...prev, normalizedFaq]);
        addHistory('FAQ added', question);
        showSuccess('FAQ added successfully.');
      }

      setFaqDraft({
        question: '',
        answer: '',
      });
      setEditingFaqId(null);
    } catch (error) {
      setFetchError(error.message || 'Unable to save FAQ.');
    }
  };

  const handleEditFaq = (faq) => {
    setEditingFaqId(faq.id);
    setFaqDraft({
      question: faq.question,
      answer: faq.answer,
    });
  };

  const handleCancelFaqEdit = () => {
    setEditingFaqId(null);
    setFaqDraft({
      question: '',
      answer: '',
    });
  };

  const handleDeleteFaq = async (faq) => {
    try {
      setFetchError('');

      if (!String(faq.id).startsWith('default-')) {
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE}/services/faqs/${faq.id}`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          throw new Error('Unable to delete FAQ.');
        }
      }

      setFaqs((prev) => prev.filter((item) => item.id !== faq.id));
      addHistory('FAQ deleted', faq.question);
      showSuccess('FAQ deleted successfully.');
    } catch (error) {
      setFetchError(error.message || 'Unable to delete FAQ.');
    }
  };

  const handleMoveFaq = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= faqs.length) return;

    const reordered = [...faqs];
    const [movedItem] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, movedItem);

    setFaqs(reordered);

    try {
      const orderedIds = reordered
        .filter((faq) => !String(faq.id).startsWith('default-'))
        .map((faq) => faq.id);

      if (!orderedIds.length) return;

      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE}/services/faqs/reorder`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderedIds }),
      });

      if (!response.ok) {
        throw new Error('Unable to reorder FAQs.');
      }

      addHistory('FAQs reordered', 'FAQ display order was updated.');
    } catch (error) {
      setFetchError(error.message || 'Unable to reorder FAQs.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100%',
        background: Colors.pageBg,
        padding: '1.5rem',
      }}
    >
      <div className="mb-8">
        <h1 style={typography.h1}>Manage Services</h1>
        <p style={{ ...typography.body, marginTop: '0.5rem' }}>
          View and manage laundry services, load types, shop schedule, and FAQs.
        </p>
      </div>

      {loading && (
        <div
          style={{
            ...card,
            padding: '1rem 1.25rem',
            marginBottom: 20,
            color: Colors.blue,
            fontWeight: 700,
          }}
        >
          Loading services...
        </div>
      )}

      {fetchError && (
        <div
          style={{
            padding: '0.9rem 1rem',
            borderRadius: '0.875rem',
            background: Colors.dangerFaint,
            color: Colors.danger,
            fontWeight: 700,
            marginBottom: 20,
            border: `1px solid rgba(235, 87, 87, 0.16)`,
          }}
        >
          {fetchError}
        </div>
      )}

      <SectionLabel>Service</SectionLabel>

      <div
        style={{
          ...card,
          borderLeft: `4px solid ${Colors.blue}`,
          padding: '1.375rem 1.5rem',
          marginBottom: 32,
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <span
            style={{
              padding: '3px 12px',
              borderRadius: '2rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: Colors.greenFaint,
              color: Colors.green,
            }}
          >
            Active
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 24,
            paddingRight: 80,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 340px' }}>
            <h3 style={{ ...typography.h3, marginBottom: 4 }}>Full Service Laundry</h3>
            <p style={{ ...typography.small, lineHeight: 1.6 }}>
              Includes wash, dry, fold, detergent, and fabric conditioner.
            </p>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '0.75rem', color: Colors.blueMuted, marginBottom: 2 }}>
              Starting at
            </p>
            <p
              style={{
                fontSize: '1.875rem',
                fontWeight: 900,
                color: Colors.green,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                margin: 0,
              }}
            >
              {formatCurrency(220)}
            </p>
            <p style={{ fontSize: '0.75rem', color: Colors.blueMuted, marginTop: 2 }}>
              / load
            </p>
          </div>
        </div>
      </div>

      <SectionLabel>Services</SectionLabel>

      <div
        style={{
          ...card,
          padding: '1.25rem',
          marginBottom: 32,
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Service Name">
            <input
              value={serviceDraft.name}
              onChange={(event) =>
                setServiceDraft((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Full Service Laundry"
              style={{
                width: '100%',
                border: `1px solid ${Colors.border}`,
                borderRadius: '0.75rem',
                padding: '0.75rem 0.85rem',
                outline: 'none',
              }}
            />
          </Field>

          <Field label="Current Price">
            <input
              type="number"
              min="0"
              value={serviceDraft.currentPrice}
              onChange={(event) =>
                setServiceDraft((prev) => ({ ...prev, currentPrice: event.target.value }))
              }
              placeholder="220"
              style={{
                width: '100%',
                border: `1px solid ${Colors.border}`,
                borderRadius: '0.75rem',
                padding: '0.75rem 0.85rem',
                outline: 'none',
              }}
            />
          </Field>

          <Field label="Estimated Hours">
            <input
              type="number"
              min="0"
              value={serviceDraft.estimatedHours}
              onChange={(event) =>
                setServiceDraft((prev) => ({ ...prev, estimatedHours: event.target.value }))
              }
              placeholder="24"
              style={{
                width: '100%',
                border: `1px solid ${Colors.border}`,
                borderRadius: '0.75rem',
                padding: '0.75rem 0.85rem',
                outline: 'none',
              }}
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={() => handleAddItem('service')}
          style={{
            marginTop: 14,
            padding: '9px 22px',
            borderRadius: '0.75rem',
            background: Colors.blue,
            color: Colors.white,
            fontSize: '0.875rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Add Service
        </button>
      </div>

      <SectionLabel>Load Types</SectionLabel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5" style={{ marginBottom: 32 }}>
        {loadOptions.map((opt) => {
          const enabled = loadEnabled[opt.id];

          return (
            <div
              key={opt.id}
              style={{
                ...card,
                padding: '1.25rem 1.375rem',
                position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', top: 14, right: 14 }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '2rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: enabled ? Colors.greenFaint : 'rgba(200,200,200,0.2)',
                    color: enabled ? Colors.green : Colors.blueMuted,
                  }}
                >
                  {enabled ? 'Active' : 'Disabled'}
                </span>
              </div>

              <div style={{ paddingRight: 70, marginBottom: 12 }}>
                <h3 style={{ ...typography.h3, marginBottom: 2 }}>{opt.label}</h3>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: Colors.blue,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  {opt.sublabel}
                </p>
                <p
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 900,
                    color: Colors.green,
                    letterSpacing: '-0.02em',
                    marginBottom: 6,
                  }}
                >
                  {formatCurrency(opt.price)}
                </p>
                <p style={{ ...typography.small, lineHeight: 1.6 }}>{opt.description}</p>
              </div>

              <div style={{ height: 1, background: Colors.skyBd, margin: '12px 0' }} />

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => openEditItemModal('load', opt)}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: '0.625rem',
                    background: Colors.skyFaint,
                    color: Colors.blue,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setLoadEnabled((prev) => ({
                      ...prev,
                      [opt.id]: !prev[opt.id],
                    }))
                  }
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: '0.625rem',
                    border: 'none',
                    cursor: 'pointer',
                    background: enabled ? Colors.dangerFaint : Colors.greenFaint,
                    color: enabled ? Colors.danger : Colors.green,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  {enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <SectionLabel>Shop Schedule</SectionLabel>

      <div
        style={{
          ...card,
          padding: '1.375rem 1.5rem',
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3 style={{ ...typography.h3, marginBottom: 6 }}>Operating Hours</h3>
            <p style={typography.small}>
              Current schedule: <strong>{schedule.opens}</strong> to <strong>{schedule.closes}</strong>
            </p>

            {hasPreviousSchedule && (
              <p style={{ ...typography.small, marginTop: 4 }}>
                Previous schedule: <strong>{previousSchedule.opens}</strong> to{' '}
                <strong>{previousSchedule.closes}</strong>
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={openEditScheduleModal}
              style={{
                padding: '8px 22px',
                borderRadius: '0.625rem',
                background: Colors.skyFaint,
                color: Colors.blue,
                fontSize: '0.875rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Edit Schedule
            </button>

            <button
              type="button"
              disabled={!hasPreviousSchedule}
              onClick={handleRevertSchedule}
              style={{
                padding: '8px 22px',
                borderRadius: '0.625rem',
                border: 'none',
                cursor: hasPreviousSchedule ? 'pointer' : 'not-allowed',
                background: hasPreviousSchedule ? Colors.greenFaint : 'rgba(180, 180, 180, 0.18)',
                color: hasPreviousSchedule ? Colors.green : Colors.blueMuted,
                fontSize: '0.875rem',
                fontWeight: 700,
              }}
            >
              Revert Schedule
            </button>
          </div>
        </div>
      </div>

      <SectionLabel>FAQs</SectionLabel>

      <div
        style={{
          ...card,
          padding: '1.25rem',
          marginBottom: 20,
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Question">
            <input
              value={faqDraft.question}
              onChange={(event) =>
                setFaqDraft((prev) => ({ ...prev, question: event.target.value }))
              }
              placeholder="Enter FAQ question"
              style={{
                width: '100%',
                border: `1px solid ${Colors.border}`,
                borderRadius: '0.75rem',
                padding: '0.75rem 0.85rem',
                outline: 'none',
              }}
            />
          </Field>

          <Field label="Answer">
            <input
              value={faqDraft.answer}
              onChange={(event) =>
                setFaqDraft((prev) => ({ ...prev, answer: event.target.value }))
              }
              placeholder="Enter FAQ answer"
              style={{
                width: '100%',
                border: `1px solid ${Colors.border}`,
                borderRadius: '0.75rem',
                padding: '0.75rem 0.85rem',
                outline: 'none',
              }}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSaveFaq}
            style={{
              padding: '9px 22px',
              borderRadius: '0.75rem',
              background: Colors.blue,
              color: Colors.white,
              fontSize: '0.875rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {editingFaqId ? 'Update FAQ' : 'Add FAQ'}
          </button>

          {editingFaqId && (
            <button
              type="button"
              onClick={handleCancelFaqEdit}
              style={{
                padding: '9px 22px',
                borderRadius: '0.75rem',
                background: Colors.skyFaint,
                color: Colors.blue,
                fontSize: '0.875rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
        {faqs.map((faq, index) => (
          <div
            key={faq.id}
            style={{
              ...card,
              padding: '1.125rem 1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: '1 1 360px' }}>
                <h3 style={{ ...typography.h3, marginBottom: 5 }}>{faq.question}</h3>
                <p style={typography.small}>{faq.answer}</p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMoveFaq(index, 'up')}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '0.625rem',
                    border: 'none',
                    background: index === 0 ? 'rgba(180, 180, 180, 0.18)' : Colors.skyFaint,
                    color: index === 0 ? Colors.blueMuted : Colors.blue,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: index === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Up
                </button>

                <button
                  type="button"
                  disabled={index === faqs.length - 1}
                  onClick={() => handleMoveFaq(index, 'down')}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '0.625rem',
                    border: 'none',
                    background:
                      index === faqs.length - 1 ? 'rgba(180, 180, 180, 0.18)' : Colors.skyFaint,
                    color: index === faqs.length - 1 ? Colors.blueMuted : Colors.blue,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: index === faqs.length - 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Down
                </button>

                <button
                  type="button"
                  onClick={() => handleEditFaq(faq)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '0.625rem',
                    border: 'none',
                    background: Colors.greenFaint,
                    color: Colors.green,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteFaq(faq)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '0.625rem',
                    border: 'none',
                    background: Colors.dangerFaint,
                    color: Colors.danger,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SectionLabel>Activity History</SectionLabel>

      <div
        style={{
          ...card,
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {history.length === 0 ? (
            <p style={typography.small}>No activity history yet.</p>
          ) : (
            history.map((log) => (
              <div
                key={log.id}
                style={{
                  border: `1px solid ${Colors.border}`,
                  borderRadius: '0.875rem',
                  padding: '0.875rem 1rem',
                  background: '#FBFDFF',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    color: Colors.text,
                  }}
                >
                  {log.message}
                </p>
                {log.details && <p style={{ ...typography.small, marginTop: 4 }}>{log.details}</p>}
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: '0.75rem',
                    color: Colors.blueMuted,
                    fontWeight: 600,
                  }}
                >
                  {log.formattedDate} • {log.formattedTime}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {isEditModalOpen && editItem && (
        <Modal
          title={
            editType === 'schedule'
              ? 'Edit Shop Schedule'
              : editType === 'load'
                ? 'Edit Load Type'
                : 'Edit Item'
          }
          onClose={closeEditModal}
        >
          {editType === 'schedule' ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <Field label="Opens">
                <input
                  ref={openTimeRef}
                  type="time"
                  value={editItem.opens}
                  onChange={(event) =>
                    setEditItem((prev) => ({ ...prev, opens: event.target.value }))
                  }
                  style={{
                    width: '100%',
                    border: `1px solid ${Colors.border}`,
                    borderRadius: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    outline: 'none',
                  }}
                />
              </Field>

              <Field label="Closes">
                <input
                  ref={closeTimeRef}
                  type="time"
                  value={editItem.closes}
                  onChange={(event) =>
                    setEditItem((prev) => ({ ...prev, closes: event.target.value }))
                  }
                  style={{
                    width: '100%',
                    border: `1px solid ${Colors.border}`,
                    borderRadius: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    outline: 'none',
                  }}
                />
              </Field>
            </div>
          ) : editType === 'load' ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <Field label="Load Type ID">
                <input
                  value={editItem.id}
                  onChange={(event) =>
                    setEditItem((prev) => ({ ...prev, id: event.target.value }))
                  }
                  style={{
                    width: '100%',
                    border: `1px solid ${Colors.border}`,
                    borderRadius: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    outline: 'none',
                  }}
                />
              </Field>

              <Field label="Label">
                <input
                  value={editItem.label}
                  onChange={(event) =>
                    setEditItem((prev) => ({ ...prev, label: event.target.value }))
                  }
                  style={{
                    width: '100%',
                    border: `1px solid ${Colors.border}`,
                    borderRadius: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    outline: 'none',
                  }}
                />
              </Field>

              <Field label="Sublabel">
                <input
                  value={editItem.sublabel}
                  onChange={(event) =>
                    setEditItem((prev) => ({ ...prev, sublabel: event.target.value }))
                  }
                  style={{
                    width: '100%',
                    border: `1px solid ${Colors.border}`,
                    borderRadius: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    outline: 'none',
                  }}
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={editItem.description}
                  onChange={(event) =>
                    setEditItem((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={4}
                  style={{
                    width: '100%',
                    border: `1px solid ${Colors.border}`,
                    borderRadius: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </Field>

              <Field label="Price">
                <input
                  type="number"
                  min="0"
                  value={editItem.price}
                  onChange={(event) =>
                    setEditItem((prev) => ({ ...prev, price: event.target.value }))
                  }
                  style={{
                    width: '100%',
                    border: `1px solid ${Colors.border}`,
                    borderRadius: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    outline: 'none',
                  }}
                />
              </Field>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              <Field label="Name">
                <input
                  value={editItem.name}
                  onChange={(event) =>
                    setEditItem((prev) => ({ ...prev, name: event.target.value }))
                  }
                  style={{
                    width: '100%',
                    border: `1px solid ${Colors.border}`,
                    borderRadius: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    outline: 'none',
                  }}
                />
              </Field>

              <Field label="Current Price">
                <input
                  type="number"
                  min="0"
                  value={editItem.currentPrice}
                  onChange={(event) =>
                    setEditItem((prev) => ({ ...prev, currentPrice: event.target.value }))
                  }
                  style={{
                    width: '100%',
                    border: `1px solid ${Colors.border}`,
                    borderRadius: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    outline: 'none',
                  }}
                />
              </Field>

              <Field label="Estimated Hours">
                <input
                  type="number"
                  min="0"
                  value={editItem.estimatedHours}
                  onChange={(event) =>
                    setEditItem((prev) => ({ ...prev, estimatedHours: event.target.value }))
                  }
                  style={{
                    width: '100%',
                    border: `1px solid ${Colors.border}`,
                    borderRadius: '0.75rem',
                    padding: '0.75rem 0.85rem',
                    outline: 'none',
                  }}
                />
              </Field>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={closeEditModal}
              style={{
                padding: '9px 18px',
                borderRadius: '0.75rem',
                background: Colors.skyFaint,
                color: Colors.blue,
                fontSize: '0.875rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveEdit}
              style={{
                padding: '9px 18px',
                borderRadius: '0.75rem',
                background: Colors.green,
                color: Colors.white,
                fontSize: '0.875rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Save Changes
            </button>
          </div>
        </Modal>
      )}

      {showDeleteConfirmModal && pendingDelete && (
        <Modal title="Delete Item" onClose={closeDeleteModal}>
          <p style={typography.body}>
            Are you sure you want to delete <strong>{pendingDelete.item.name}</strong>?
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={closeDeleteModal}
              style={{
                padding: '9px 18px',
                borderRadius: '0.75rem',
                background: Colors.skyFaint,
                color: Colors.blue,
                fontSize: '0.875rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDeleteItem}
              style={{
                padding: '9px 18px',
                borderRadius: '0.75rem',
                background: Colors.danger,
                color: Colors.white,
                fontSize: '0.875rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}

      {showSuccessModal && (
        <Modal title="Success" onClose={() => setShowSuccessModal(false)}>
          <p style={typography.body}>{successMessage}</p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              style={{
                padding: '9px 18px',
                borderRadius: '0.75rem',
                background: Colors.green,
                color: Colors.white,
                fontSize: '0.875rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Okay
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}