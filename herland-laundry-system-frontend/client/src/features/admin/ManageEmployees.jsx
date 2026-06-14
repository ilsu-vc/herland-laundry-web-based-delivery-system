import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import InfoCard from '../../shared/components/InfoCard'
import { FilterSelect, RadioRow } from '../../shared/components/OptionInput'
import { supabase } from '../../lib/supabase';
import { useToast } from '../../shared/components/Toast';
import { useConfirm } from '../../shared/components/ConfirmationModal';


  export default function ManageEmployees() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [employee, setEmployee] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showPasswords, setShowPasswords] = useState({});
  const [filterRole, setFilterRole] = useState('all');
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch employees from backend
  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
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
        // Filter for ONLY staff, rider, admin
        const mappedEmployees = data
            .filter(u => ['Staff', 'Rider'].includes(u.role)) 
            .map(user => ({
                ...user,
                name: user.full_name || user.name || 'Unknown',
                // Ensure other fields are present
            }));

        setEmployee(mappedEmployees);
      } else {
        console.error('Failed to fetch employees');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };



  const filteredEmployees = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const roleFiltered =
      filterRole === 'all'
        ? employee
        : employee.filter((member) => member.role === filterRole);

    const searchFiltered =
      normalizedQuery.length === 0
        ? roleFiltered
        : roleFiltered.filter((member) => {
            const name = (member.name || '').toLowerCase();
            const id = (member.id || '').toLowerCase();
            const role = (member.role || '').toLowerCase();
            return (
              name.includes(normalizedQuery) ||
              id.includes(normalizedQuery) ||
              role.includes(normalizedQuery)
            );
          });

    const sorted = [...searchFiltered].sort((a, b) => {
        // Handle potential missing IDs
        const idA = a.id || '';
        const idB = b.id || '';
        return idA.localeCompare(idB, undefined, {
            numeric: true,
            sensitivity: 'base',
        });
    });

    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [employee, filterRole, searchQuery, sortDirection]);

  const toggleExpand = (id) =>
    setExpandedId(expandedId === id ? null : id);

  const startEditing = (member) => {
    setEditingId(member.id);
    setEditData({ ...member });
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
                email: editData.email,
                name: editData.name,
                address: editData.address,
                password: editData.password,
            })
        });

        if (response.ok) {
            setEmployee((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...editData } : c)));
            setEditingId(null);
            setEditData({});
            // If role changed to customer, it should disappear from this list
            if (editData.role === 'Customer') {
                 setEmployee(prev => prev.filter(c => c.id !== editingId));
            }
        } else {
            console.error('Failed to update role');
            showToast('Failed to update role.', 'error');
        }
    } catch (error) {
        console.error('Error updating role:', error);
        showToast('An error occurred.', 'error');
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
    if (!(await confirm('Are you sure you want to delete this employee? This action cannot be undone.'))) return;

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
        setEmployee((prev) => prev.filter((s) => s.id !== id));
        if (expandedId === id) setExpandedId(null);
      } else {
        showToast('Failed to delete employee.', 'error');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
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
          <h1 className="text-2xl font-semibold">Manage Employees</h1>
        </header>

        {/* Filters */}
        <div className="mb-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-[minmax(220px,1fr)_160px_minmax(240px,auto)] md:items-center md:gap-3">

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, name, or access type"
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-[#374151] bg-white"
          />

          <FilterSelect
            id="employee-role-filter"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            options={[
              { value: 'all', label: 'All Access Types' },
              { value: 'Staff', label: 'Staff Access' },
              { value: 'Rider', label: 'Rider Access' },
            ]}
            className="h-10 w-full border border-gray-300 rounded-md px-3 text-sm bg-white"
          />

          <div className="flex h-10 min-w-[240px] items-center justify-between gap-2 rounded-md border border-[#b4b4b4] px-3 sm:col-span-2 md:col-span-1 bg-white">
            <p className="whitespace-nowrap text-xs font-semibold text-[#3878c2]">Sort by Employee ID</p>
            <div className="flex items-center gap-1.5">
              <RadioRow
                id="employee-sort-ascending"
                name="employeeSortDirection"
                label="Ascending"
                checked={sortDirection === 'asc'}
                onChange={() => setSortDirection('asc')}
              />
              <RadioRow
                id="employee-sort-descending"
                name="employeeSortDirection"
                label="Descending"
                checked={sortDirection === 'desc'}
                onChange={() => setSortDirection('desc')}
              />
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEmployees.length === 0 && (
            <p className="text-gray-500 col-span-full">
              No employees found.
            </p>
          )}

          {filteredEmployees.map((member) => (
            <InfoCard
              key={member.id}
              mode="employee"
              id={member.id}
              item={member}
              name={member.name}
              subtitle={member.role.toUpperCase()}
              meta={`ID: ${member.id}`}
              isExpanded={expandedId === member.id}
              isEditing={editingId === member.id}
              editData={editData}
              onToggleExpand={toggleExpand}
              onStartEditing={startEditing}
              onCancelEditing={cancelEditing}
              onSaveEdit={saveEdit}
              onInputChange={handleInputChange}
              onDelete={handleDelete}
              onTogglePassword={togglePasswordVisibility}
              isPasswordVisible={Boolean(showPasswords[member.id])}
              panelVariant="blue"
            />
          ))}
        </div>
      </div>


    </div>
  );
}
