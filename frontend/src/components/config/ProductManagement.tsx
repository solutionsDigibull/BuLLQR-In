import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import type { Product, ProductCreate, ProductUpdate } from '../../types/config.ts';
import type { ProductionStage } from '../../types/scan.ts';
import {
  listProducts,
  createProduct,
  updateProduct,
  setProductStages,
} from '../../services/config.ts';
import { getStages } from '../../services/scan.ts';

type ModalMode = 'create' | 'edit' | null;

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  // All global stages (for checkbox list)
  const [allStages, setAllStages] = useState<ProductionStage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(true);

  // Form fields
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  // Map of stageId -> sequence (only for checked stages)
  const [formStageMap, setFormStageMap] = useState<Map<string, number>>(new Map());
  // Stage search filter
  const [stageSearch, setStageSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [productsData, stagesData] = await Promise.all([
          listProducts(),
          getStages(),
        ]);
        if (!cancelled) {
          setProducts(productsData);
          setAllStages(stagesData);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Failed to load data.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setStagesLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function openCreate() {
    setFormCode('');
    setFormName('');
    setFormStageMap(new Map());
    setStageSearch('');
    setModalMode('create');
    setSelectedProduct(null);
  }

  function openEdit(product: Product) {
    setFormCode(product.product_code);
    setFormName(product.product_name);
    // Build the map from product's saved data
    const map = new Map<string, number>();
    const seqs = product.stage_sequences || {};
    for (const sid of product.stage_ids || []) {
      map.set(sid, seqs[sid] ?? 1);
    }
    setFormStageMap(map);
    setStageSearch('');
    setSelectedProduct(product);
    setModalMode('edit');
  }

  function closeModal() {
    setModalMode(null);
    setSelectedProduct(null);
    setError(null);
  }

  function toggleStage(stageId: string, globalSequence: number) {
    setFormStageMap((prev) => {
      const next = new Map(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        // Default sequence: next available number, or use the global sequence
        const maxSeq = next.size > 0 ? Math.max(...next.values()) : 0;
        next.set(stageId, Math.max(maxSeq + 1, globalSequence));
      }
      return next;
    });
  }

  function updateSequence(stageId: string, value: number) {
    setFormStageMap((prev) => {
      const next = new Map(prev);
      next.set(stageId, value);
      return next;
    });
  }

  function buildStagesPayload() {
    return Array.from(formStageMap.entries()).map(([stage_id, sequence]) => ({
      stage_id,
      sequence,
    }));
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: ProductCreate = {
      product_code: formCode.trim(),
      product_name: formName.trim(),
    };
    if (!data.product_code || !data.product_name) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createProduct(data);
      if (formStageMap.size > 0) {
        const updated = await setProductStages(created.id, buildStagesPayload());
        setProducts((prev) => [...prev, updated]);
      } else {
        setProducts((prev) => [...prev, created]);
      }
      closeModal();
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.detail || 'Failed to create product.' : 'Failed to create product.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setSaving(true);
    setError(null);
    try {
      // Update product fields if changed
      const data: ProductUpdate = {};
      if (formCode.trim() !== selectedProduct.product_code) data.product_code = formCode.trim();
      if (formName.trim() !== selectedProduct.product_name) data.product_name = formName.trim();

      let updated = selectedProduct;
      if (data.product_code || data.product_name) {
        updated = await updateProduct(selectedProduct.id, data);
      }

      // Always save stages (covers id changes + sequence changes)
      updated = await setProductStages(selectedProduct.id, buildStagesPayload());

      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      closeModal();
    } catch (err) {
      setError(isAxiosError(err) ? err.response?.data?.detail || 'Failed to update product.' : 'Failed to update product.');
    } finally {
      setSaving(false);
    }
  }

  // Helper to get stage names for display, ordered by product-specific sequence
  function getStageNames(product: Product): string {
    const ids = product.stage_ids;
    if (!ids || ids.length === 0) return '—';
    const seqs = product.stage_sequences || {};
    return allStages
      .filter((s) => ids.includes(s.id))
      .sort((a, b) => (seqs[a.id] ?? a.stage_sequence) - (seqs[b.id] ?? b.stage_sequence))
      .map((s) => s.stage_name)
      .join(', ');
  }

  // Sorted stages for the modal: checked ones sorted by their sequence, unchecked by global sequence
  const sortedAllStages = [...allStages].sort((a, b) => a.stage_sequence - b.stage_sequence);

  // Filtered stages based on search
  const filteredStages = stageSearch.trim()
    ? sortedAllStages.filter((s) =>
        s.stage_name.toLowerCase().includes(stageSearch.trim().toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(stageSearch.trim().toLowerCase()))
      )
    : sortedAllStages;

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
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Products</h3>
        <button
          onClick={openCreate}
          className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark transition-colors"
        >
          + New Product
        </button>
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
              <th className="px-4 py-3 text-left">Product Code</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Stages</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{product.product_code}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{product.product_name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                  {getStageNames(product)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(product)} className="text-xs text-gray-500 hover:text-gray-700">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No products configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <form
            onSubmit={modalMode === 'create' ? handleCreateSubmit : handleEditSubmit}
            className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto dark:bg-gray-800"
          >
            <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
              {modalMode === 'create' ? 'New Product' : 'Edit Product'}
            </h4>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-2 text-sm text-red-700 mb-3">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label htmlFor="product-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product Code
                </label>
                <input
                  id="product-code"
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  maxLength={100}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  placeholder="e.g. CABLE-001"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product Name
                </label>
                <input
                  id="product-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={255}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  placeholder="e.g. USB Type-C Cable"
                />
              </div>

              {/* Stage Assignment with Sequence */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Production Stages
                </label>
                {stagesLoading ? (
                  <p className="text-xs text-gray-400">Loading stages...</p>
                ) : allStages.length === 0 ? (
                  <p className="text-xs text-gray-400">No stages configured. Create stages first.</p>
                ) : (
                  <div className="border border-gray-200 rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                    <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                      <input
                        type="text"
                        value={stageSearch}
                        onChange={(e) => setStageSearch(e.target.value)}
                        placeholder="Search stages..."
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:placeholder-gray-400"
                      />
                    </div>
                    <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                      {filteredStages.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">No stages match your search.</p>
                      ) : (
                        filteredStages.map((stage) => {
                          const isChecked = formStageMap.has(stage.id);
                          const seq = formStageMap.get(stage.id) ?? stage.stage_sequence;
                          return (
                            <div key={stage.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleStage(stage.id, stage.stage_sequence)}
                                className="rounded border-gray-300 text-primary focus:ring-primary shrink-0"
                              />
                              {isChecked ? (
                                <input
                                  type="number"
                                  min={1}
                                  value={seq}
                                  onChange={(e) => updateSequence(stage.id, parseInt(e.target.value) || 1)}
                                  className="w-12 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-primary dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                                />
                              ) : (
                                <span className="w-12 text-gray-400 font-mono text-xs text-center">—</span>
                              )}
                              <span className={isChecked ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-400 dark:text-gray-500'}>
                                {stage.stage_name}
                              </span>
                              {stage.description && (
                                <span className="text-gray-400 dark:text-gray-500 text-xs ml-1 truncate">— {stage.description}</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
                {formStageMap.size > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formStageMap.size} stage{formStageMap.size !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
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
