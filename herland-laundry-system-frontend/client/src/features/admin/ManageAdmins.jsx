import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import InfoCard from '../../shared/components/InfoCard'
import { RadioRow } from '../../shared/components/OptionInput'
import { supabase } from '../../lib/supabase';
import { useToast } from '../../shared/components/Toast';

export default function ManageAdmins() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showPasswords, setShowPasswords] = useState({});
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('admins'); // 'admins' or 'promote'

  // Fetch Admins and Staff from backend
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
        // Keep both for the two view modes
        const mapped = data
            .filter(u => ['Admin', 'Staff'].includes(u.role)) 
            .map(user => ({
                ...user,
                name: user.full_name || user.name || 'Unknown',
            }));

        setAdmins(mapped);
      } else {
        console.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentDisplayList = useMemo(() => {
    // Filter by viewMode first
    const roleFiltered = admins.filter(u => 
        viewMode === 'admins' ? u.role === 'Admin' : u.role === 'Staff'
    );

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const searchFiltered =
      normalizedQuery.length === 0
        ? roleFiltered
        : roleFiltered.filter((member) => {
            const name = (member.name || '').toLowerCase();
            const email = (member.email || '').toLowerCase();
            return name.includes(normalizedQuery) || email.includes(normalizedQuery);
          });

    const sorted = [...searchFiltered].sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
    });

    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [admins, searchQuery, sortDirection, viewMode]);

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
                name: editData.name,
                phone: editData.phone,
                email: editData.email,
                address: editData.address,
                password: editData.password,
            })
        });

        if (response.ok) {
            setAdmins((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...editData } : c)));
            setEditingId(null);
            setEditData({});
            
            // If role changed but still in tracked roles, it will naturally move between filtered lists
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
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const togglePasswordVisibility = (id) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl md:max-w-5xl lg:max-w-6xl">

        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[#3878c2]">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center group"
              aria-label="Go back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="size-6 transition-transform group-active:-translate-x-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-semibold">Manage Admins</h1>
          </div>

          <div className="flex rounded-lg bg-[#f0f6ff] p-1 self-start sm:self-auto">
            <button
              onClick={() => setViewMode('admins')}
              className={`rounded-md px-4 py-1.5 text-sm font-bold transition-colors ${
                viewMode === 'admins' ? 'bg-[#3878c2] text-white shadow-sm' : 'text-[#3878c2] hover:bg-white/50'
              }`}
            >
              Existing Admins
            </button>
            <button
              onClick={() => setViewMode('promote')}
              className={`rounded-md px-4 py-1.5 text-sm font-bold transition-colors ${
                viewMode === 'promote' ? 'bg-[#3878c2] text-white shadow-sm' : 'text-[#3878c2] hover:bg-white/50'
              }`}
            >
              Promote Staff
            </button>
          </div>
        </header>

        {/* Filters and Sort */}
        <div className="mb-6 grid w-full grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-center md:gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={viewMode === 'admins' ? "Search Admins..." : "Search Staff to promote..."}
            className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-[#374151] bg-white placeholder:text-gray-400"
          />

          <div className="flex h-10 items-center justify-between gap-2 rounded-md border border-[#b4b4b4] px-3 bg-white min-w-[220px]">
            <p className="whitespace-nowrap text-xs font-semibold text-[#3878c2]">Sort by</p>
            <div className="flex items-center gap-1.5">
              <RadioRow
                id="admin-sort-ascending"
                name="adminSortDirection"
                label="Ascending"
                checked={sortDirection === 'asc'}
                onChange={() => setSortDirection('asc')}
              />
              <RadioRow
                id="admin-sort-descending"
                name="adminSortDirection"
                label="Descending"
                checked={sortDirection === 'desc'}
                onChange={() => setSortDirection('desc')}
              />
            </div>
          </div>
        </div>

        {/* Info label */}
        <div className="mb-4">
            <p className="text-sm text-gray-500 font-medium">
                {viewMode === 'admins' 
                    ? "Currently showing all users with Admin access."
                    : "Listing all Staff members. Change their role to 'Admin' to promote them."}
            </p>
        </div>

        {/* Cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading && <p className="text-gray-500 col-span-full">Loading...</p>}
          {!loading && currentDisplayList.length === 0 && (
            <p className="text-gray-500 col-span-full">
              {viewMode === 'admins' ? "No Admins found." : "No Staff members found to promote."}
            </p>
          )}

          {currentDisplayList.map((member) => (
            <InfoCard
              key={member.id}
              mode="employee"
              id={member.id}
              item={member}
              name={member.name}
              subtitle={member.role.toUpperCase()}
              meta={member.email}
              isExpanded={expandedId === member.id}
              isEditing={editingId === member.id}
              editData={editData}
              onToggleExpand={toggleExpand}
              onStartEditing={startEditing}
              onCancelEditing={cancelEditing}
              onSaveEdit={saveEdit}
              onInputChange={handleInputChange}
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
