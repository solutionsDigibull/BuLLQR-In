import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import type { Operator, OperatorCreate, OperatorUpdate } from '../../types/config.ts';
import { listOperators, createOperator, updateOperator, deleteOperator } from '../../services/config.ts';

const ROLES = [
  { value: 'operator', label: 'Operator' },
  { value: 'quality_inspector', label: 'Quality Inspector' },
  { value: 'supervisor', label: 'Supervisor' },
] as const;

// Label lookup including admin for displaying existing admin users in the table
const ROLE_LABEL: Record<string, string> = {
  operator: 'Operator',
  quality_inspector: 'Quality Inspector',
  supervisor: 'Supervisor',
  admin: 'Administrator',
};

const ROLE_COLORS: Record<string, string> = {
  operator: 'bg-blue-100 text-blue-700',
  quality_inspector: 'bg-purple-100 text-purple-700',
  supervisor: 'bg-orange-100 text-orange-700',
  admin: 'bg-red-100 text-red-700',
};

type ModalMode = 'create' | 'edit' | null;

export default function OperatorManagement() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedOp, setSelectedOp] = useState<Operator | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form fields
  const [formOperatorId, setFormOperatorId] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState<OperatorCreate['role']>('operator');
  const [formActive, setFormActive] = useState(true);

  // Filter
  const [filterRole, setFilterRole] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listOperators(filterRole || undefined);
        if (!cancelled) {
          setOperators(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Failed to load operators.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filterRole]);

  function openCreate() {
    setFormOperatorId('');
    setFormFullName('');
    setFormRole('operator');
    setFormActive(true);
    setModalMode('create');
    setSelectedOp(null);
    setError(null);
  }

  function openEdit(op: Operator) {
    setFormOperatorId(op.username);
    setFormFullName(op.full_name);
    setFormRole(op.role);
    setFormActive(op.is_active);
    setSelectedOp(op);
    setModalMode('edit');
    setError(null);
  }

  function closeModal() {
    setModalMode(null);
    setSelectedOp(null);
    setError(null);
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const operatorId = formOperatorId.trim();
    if (!operatorId || !formFullName.trim()) return;
    const data: OperatorCreate = {
      username: operatorId,
      password: operatorId,
      full_name: formFullName.trim(),
      role: formRole,
    };
    setSaving(true);
    setError(null);
    try {
      const created = await createOperator(data);
      setOperators((prev) => [...prev, created]);
      closeModal();
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.detail || 'Failed to create operator.' : 'Failed to create operator.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOp) return;
    const data: OperatorUpdate = {};
    if (formOperatorId.trim() && formOperatorId.trim() !== selectedOp.username) data.username = formOperatorId.trim();
    if (formFullName.trim() !== selectedOp.full_name) data.full_name = formFullName.trim();
    if (formRole !== selectedOp.role) data.role = formRole;
    if (formActive !== selectedOp.is_active) data.is_active = formActive;
    if (Object.keys(data).length === 0) { closeModal(); return; }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateOperator(selectedOp.id, data);
      setOperators((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      closeModal();
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.detail || 'Failed to update operator.' : 'Failed to update operator.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(op: Operator) {
    if (!window.confirm(`Delete operator "${op.full_name}" (${op.username})? This cannot be undone.`)) return;
    setDeleting(op.id);
    setError(null);
    try {
      await deleteOperator(op.id);
      setOperators((prev) => prev.filter((o) => o.id !== op.id));
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.detail || 'Failed to delete operator.' : 'Failed to delete operator.');
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Operators</h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search operators..."
              className="pl-7 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => { setFilterRole(e.target.value); setLoading(true); }}
            className="border border-gray-300 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={openCreate}
            className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark transition-colors"
          >
            + New Operator
          </button>
        </div>
      </div>

      {error && !modalMode && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider dark:bg-gray-700 dark:text-gray-300">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">EMP ID</th>
              <th className="px-4 py-3 text-center">Role</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {operators.filter((op) => {
              const q = search.toLowerCase();
              return !q || op.full_name.toLowerCase().includes(q) || op.username.toLowerCase().includes(q);
            }).map((op) => (
              <tr key={op.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${!op.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{op.full_name}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{op.username}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${ROLE_COLORS[op.role] || 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABEL[op.role] || op.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => openEdit(op)} className="text-xs text-gray-500 hover:text-gray-700">
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(op)}
                      disabled={deleting === op.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      {deleting === op.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {operators.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No operators found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <form
            onSubmit={modalMode === 'create' ? handleCreateSubmit : handleEditSubmit}
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 dark:bg-gray-800"
          >
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              {modalMode === 'create' ? 'New Operator' : `Edit: ${selectedOp?.full_name}`}
            </h4>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-2 text-sm text-red-700 mb-3">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label htmlFor="op-operator-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Operator ID
                </label>
                <input
                  id="op-operator-id"
                  type="text"
                  value={formOperatorId}
                  onChange={(e) => setFormOperatorId(e.target.value)}
                  maxLength={100}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  autoFocus={modalMode === 'create'}
                />
              </div>
              <div>
                <label htmlFor="op-fullname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  id="op-fullname"
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  maxLength={255}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                />
              </div>
              <div>
                <label htmlFor="op-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  id="op-role"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as OperatorCreate['role'])}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              {modalMode === 'edit' && (
                <div className="flex items-center gap-2">
                  <input
                    id="op-active"
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="op-active" className="text-sm text-gray-700 dark:text-gray-300">
                    Active
                  </label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button type="button" onClick={closeModal} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : modalMode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
