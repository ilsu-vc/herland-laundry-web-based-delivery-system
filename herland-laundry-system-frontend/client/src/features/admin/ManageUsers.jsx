import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import InfoCard from '../../shared/components/InfoCard'
import { FilterSelect, RadioRow } from '../../shared/components/OptionInput'
import { supabase } from '../../lib/supabase';
import { useToast } from '../../shared/components/Toast';
import { useConfirm } from '../../shared/components/ConfirmationModal';

const getMonthYear = (dateValue) => {
  if (!dateValue) return '';
  const dateObject = new Date(dateValue);
  if (Number.isNaN(dateObject.getTime())) return '';
  return dateObject.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
};

export default function ManageUsers() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showPasswords, setShowPasswords] = useState({});
  const [filterJoinMonth, setFilterJoinMonth] = useState('all');
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch users from backend
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/users`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Map backend data to frontend structure if necessary
        // Assuming backend returns { id, full_name, email, phone, role, created_at, ... }
        const mappedUsers = data.map(user => ({
          ...user,
          name: user.full_name || user.name || 'Unknown',
          dateJoined: user.updated_at || new Date().toISOString(),
          // Ensure other fields are present
        })).filter(u => u.role === 'Customer' || !u.role); // Only show customers

        setCustomers(mappedUsers);
      } else {
        console.error('Failed to fetch backend users');
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const joinMonthOptions = useMemo(
    () => [...new Set(customers.map((customer) => getMonthYear(customer.dateJoined)).filter(Boolean))],
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const joinMonthFiltered =
      filterJoinMonth === 'all'
        ? customers
        : customers.filter((customer) => getMonthYear(customer.dateJoined) === filterJoinMonth);

    const searchFiltered =
      normalizedQuery.length === 0
        ? joinMonthFiltered
        : joinMonthFiltered.filter((customer) => {
            const id = (customer.id || '').toLowerCase();
            const name = (customer.name || '').toLowerCase();
            const phone = (customer.phone || '').toLowerCase();
            return id.includes(normalizedQuery) || name.includes(normalizedQuery) || phone.includes(normalizedQuery);
          });

    const sorted = [...searchFiltered].sort((firstCustomer, secondCustomer) => {
      const firstDate = new Date(firstCustomer.dateJoined).getTime();
      const secondDate = new Date(secondCustomer.dateJoined).getTime();

      if (firstDate === secondDate) {
        return firstCustomer.id.localeCompare(secondCustomer.id, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }

      return firstDate - secondDate;
    });

    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [customers, filterJoinMonth, searchQuery, sortDirection]);

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  const startEditing = (customer) => {
    setEditingId(customer.id);
    setEditData({ ...customer });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/users/${editingId}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                role: editData.role,
                phone: editData.phone,
                name: editData.name,
                email: editData.email,
                address: editData.address,
                password: editData.password,
            })
        });

        if (response.ok) {
            // If role changed to non-customer, remove from this list
            if (editData.role && editData.role !== 'Customer') {
                setCustomers((prev) => prev.filter((c) => c.id !== editingId));
            } else {
                setCustomers((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...editData } : c)));
            }
            setEditingId(null);
            setEditData({});
        } else {
            console.error('Failed to update role');
            // Handle error (e.g., show notification)
            showToast('Failed to update role. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error updating role:', error);
        showToast('An error occurred while updating role.', 'error');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
        const cleanValue = value.replace(/\D/g, '').slice(0, 11);
        setEditData((prev) => ({ ...prev, [name]: cleanValue }));
        return;
    }
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const togglePasswordVisibility = (id) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = async (id) => {
    if (!(await confirm('Are you sure you want to delete this user? This action cannot be undone.'))) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        if (expandedId === id) setExpandedId(null);
      } else {
        showToast('Failed to delete user.', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('An error occurred while deleting.', 'error');
    }
  };

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
          <h1 className="text-2xl font-semibold">Manage Users</h1>
        </header>

        <div className="mb-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-[minmax(220px,1fr)_180px_minmax(240px,auto)] md:items-center md:gap-3">
          <label htmlFor="users-search" className="sr-only">
            Search by user id, name, or phone number
          </label>
          <input
            id="users-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search user id, name, or phone"
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-[#374151] placeholder:text-gray-400 md:min-w-0 bg-white"
          />

          <FilterSelect
            id="users-join-month-filter"
            value={filterJoinMonth}
            onChange={(e) => setFilterJoinMonth(e.target.value)}
            options={[
              { value: 'all', label: 'All Join Months' },
              ...joinMonthOptions.map((monthYear) => ({
                value: monthYear,
                label: monthYear,
              })),
            ]}
            className="h-10 w-full border border-gray-300 rounded-md px-3 text-sm bg-white"
          />

          <div className="flex h-10 min-w-[240px] items-center justify-between gap-2 rounded-md border border-[#b4b4b4] px-3 sm:col-span-2 md:col-span-1 bg-white">
            <p className="whitespace-nowrap text-xs font-semibold text-[#3878c2]">Sort by</p>
            <div className="flex items-center gap-1.5">
              <RadioRow
                id="users-sort-ascending"
                name="usersSortDirection"
                label="Ascending"
                checked={sortDirection === 'asc'}
                onChange={() => setSortDirection('asc')}
              />
              <RadioRow
                id="users-sort-descending"
                name="usersSortDirection"
                label="Descending"
                checked={sortDirection === 'desc'}
                onChange={() => setSortDirection('desc')}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading && <p className="text-gray-500 col-span-full">Loading users...</p>}
          {!loading && filteredCustomers.length === 0 && <p className="text-gray-500 col-span-full">No users found for the selected filters.</p>}

          {filteredCustomers.map((customer) => (
            <InfoCard
              key={customer.id}
              mode="user"
              id={customer.id}
              item={customer}
              name={customer.name}
              meta={customer.id}
              isExpanded={expandedId === customer.id}
              isEditing={editingId === customer.id}
              editData={editData}
              onToggleExpand={toggleExpand}
              onStartEditing={startEditing}
              onCancelEditing={cancelEditing}
              onSaveEdit={saveEdit}
              onInputChange={handleInputChange}
              onDelete={handleDelete}
              onTogglePassword={togglePasswordVisibility}
              isPasswordVisible={Boolean(showPasswords[customer.id])}
              panelVariant="blue"
            />
          ))}
        </div>
      </div>


    </div>
  );
}
