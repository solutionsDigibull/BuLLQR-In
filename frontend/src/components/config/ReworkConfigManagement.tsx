import { useState, useEffect } from 'react';
import {
  listReworkCategories,
  createReworkCategory,
  deleteReworkCategory,
  createReworkConfig,
  updateReworkConfig,
  deleteReworkConfig,
} from '../../services/config.ts';
import type { ReworkCategory, ReworkConfigItem, ReworkConfigCreate } from '../../types/config.ts';

export default function ReworkConfigManagement() {
  const [categories, setCategories] = useState<ReworkCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // Expanded categories
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Rework type form (per category)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState<ReworkConfigCreate>({ rework_detail: '', copq_cost: 0, description: '' });
  const [savingType, setSavingType] = useState(false);

  useEffect(() => { loadCategories(); }, []);

  async function loadCategories() {
    try {
      const data = await listReworkCategories(true);
      setCategories(data);
    } catch {
      setError('Failed to load rework categories');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- Category CRUD ----
  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryName.trim()) return;
    setSavingCategory(true);
    setError('');
    try {
      const created = await createReworkCategory({ name: categoryName.trim() });
      setShowCategoryForm(false);
      setCategoryName('');
      await loadCategories();
      setExpandedIds((prev) => new Set(prev).add(created.id));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create category');
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its rework types? This cannot be undone.`)) return;
    try {
      await deleteReworkCategory(id);
      await loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete category');
    }
  }

  // ---- Rework Type CRUD ----
  function openAddType(categoryId: string) {
    setActiveCategoryId(categoryId);
    setEditingId(null);
    setTypeForm({ rework_detail: '', copq_cost: 0, description: '', category_id: categoryId });
    setShowTypeForm(true);
  }

  function openEditType(rc: ReworkConfigItem) {
    setActiveCategoryId(rc.category_id);
    setEditingId(rc.id);
    setTypeForm({ rework_detail: rc.rework_detail, copq_cost: rc.copq_cost, description: rc.description || '', category_id: rc.category_id || undefined });
    setShowTypeForm(true);
  }

  function closeTypeForm() {
    setShowTypeForm(false);
    setEditingId(null);
    setActiveCategoryId(null);
  }

  async function handleTypeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSavingType(true);
    try {
      if (editingId) {
        await updateReworkConfig(editingId, typeForm);
      } else {
        await createReworkConfig(typeForm);
      }
      closeTypeForm();
      await loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save rework type');
    } finally {
      setSavingType(false);
    }
  }

  async function handleDeleteType(id: string) {
    if (!confirm('Delete this rework type? This cannot be undone.')) return;
    try {
      await deleteReworkConfig(id);
      await loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete');
    }
  }

  // ---- Search filtering ----
  function filterConfigs(configs: ReworkConfigItem[] | undefined): ReworkConfigItem[] {
    if (!configs) return [];
    if (!search.trim()) return configs;
    const q = search.toLowerCase();
    return configs.filter(
      (rc) => rc.rework_detail.toLowerCase().includes(q) || (rc.description || '').toLowerCase().includes(q),
    );
  }

  function filteredCategories(): ReworkCategory[] {
    if (!search.trim()) return categories;
    return categories.filter((cat) => {
      const nameMatch = cat.name.toLowerCase().includes(search.toLowerCase());
      const configMatch = filterConfigs(cat.rework_configs).length > 0;
      return nameMatch || configMatch;
    });
  }

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading rework categories...</p>;

  const visibleCategories = filteredCategories();

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 px-4 py-2 rounded text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 dark:text-red-400 hover:text-red-800">&times;</button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex justify-between items-center">
        <h3 className="text-base font-medium text-gray-700 dark:text-gray-200">Rework Types</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search defects..."
              className="pl-7 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => { setShowCategoryForm(true); setCategoryName(''); }}
            className="px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary-dark"
          >
            + Add Rework Name
          </button>
        </div>
      </div>

      {/* New category form */}
      {showCategoryForm && (
        <form onSubmit={handleCreateCategory} className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-md p-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rework Name</label>
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Input AMP"
              className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-200"
            />
          </div>
          <button type="submit" disabled={savingCategory} className="px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary-dark disabled:opacity-50">
            {savingCategory ? 'Creating...' : 'Create'}
          </button>
          <button type="button" onClick={() => setShowCategoryForm(false)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-500">
            Cancel
          </button>
        </form>
      )}

      {/* Category sections */}
      {visibleCategories.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
          No rework names yet. Click "+ Add Rework Name" to create one.
        </p>
      )}

      {visibleCategories.map((cat) => {
        const isExpanded = expandedIds.has(cat.id) || search.trim().length > 0;
        const configs = filterConfigs(cat.rework_configs);
        const isFormForThisCategory = showTypeForm && activeCategoryId === cat.id;

        return (
          <div key={cat.id} className="border dark:border-gray-700 rounded-md overflow-hidden">
            {/* Category header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750"
              onClick={() => toggleExpand(cat.id)}
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium text-gray-800 dark:text-gray-100">{cat.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">
                  {cat.rework_configs?.length || 0}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id, cat.name); }}
                className="text-red-500 dark:text-red-400 hover:text-red-700 text-xs"
                title="Delete category"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Expanded body */}
            {isExpanded && (
              <div className="p-4 space-y-3">
                {/* Add rework type button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => openAddType(cat.id)}
                    className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary-dark"
                  >
                    + Add Rework Type
                  </button>
                </div>

                {/* Rework type form (inline) */}
                {isFormForThisCategory && (
                  <form onSubmit={handleTypeSubmit} className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-md p-3 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rework Detail</label>
                        <input
                          value={typeForm.rework_detail}
                          onChange={(e) => setTypeForm({ ...typeForm, rework_detail: e.target.value })}
                          required
                          className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">COPQ Cost</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={typeForm.copq_cost}
                          onChange={(e) => setTypeForm({ ...typeForm, copq_cost: parseFloat(e.target.value) || 0 })}
                          required
                          className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                        <input
                          value={typeForm.description}
                          onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                          className="w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-200"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={savingType} className="px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary-dark disabled:opacity-50">
                        {savingType ? 'Saving...' : editingId ? 'Update' : 'Create'}
                      </button>
                      <button type="button" onClick={closeTypeForm} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-500">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Rework types table */}
                {configs.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                        <th className="px-4 py-2">Rework Detail</th>
                        <th className="px-4 py-2">COPQ Cost</th>
                        <th className="px-4 py-2">Description</th>
                        <th className="px-4 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {configs.map((rc) => (
                        <tr key={rc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{rc.rework_detail}</td>
                          <td className="px-4 py-2 font-mono text-gray-800 dark:text-gray-200">{rc.copq_cost.toFixed(2)}</td>
                          <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{rc.description || '—'}</td>
                          <td className="px-4 py-2 space-x-2">
                            <button onClick={() => openEditType(rc)} className="text-primary dark:text-blue-400 hover:underline text-xs">Edit</button>
                            <button onClick={() => handleDeleteType(rc.id)} className="text-red-500 dark:text-red-400 hover:underline text-xs">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
                    No rework types in this category. Click "+ Add Rework Type" to create one.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
