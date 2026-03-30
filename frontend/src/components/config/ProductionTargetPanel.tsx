import { useState, useEffect } from 'react';
import { listProducts, setProductionTarget } from '../../services/config.ts';
import type { Product } from '../../types/config.ts';

export default function ProductionTargetPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-product input state: { [productId]: inputValue }
  const [inputs, setInputs] = useState<Record<string, string>>({});
  // Per-product saving/error/success state
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    listProducts()
      .then((data) => {
        setProducts(data);
        const initial: Record<string, string> = {};
        data.forEach((p) => {
          initial[p.id] = p.production_target != null ? String(p.production_target) : '';
        });
        setInputs(initial);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSetTarget(product: Product) {
    const qty = parseInt(inputs[product.id] ?? '');
    if (!qty || qty < 1) {
      setErrors((prev) => ({ ...prev, [product.id]: 'Enter a valid quantity (≥ 1)' }));
      return;
    }
    setErrors((prev) => ({ ...prev, [product.id]: '' }));
    setSaving((prev) => ({ ...prev, [product.id]: true }));
    try {
      const updated = await setProductionTarget(product.id, { production_target: qty });
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccess((prev) => ({ ...prev, [product.id]: true }));
      setTimeout(() => setSuccess((prev) => ({ ...prev, [product.id]: false })), 2500);
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        [product.id]: err.response?.data?.detail || 'Failed to set target',
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [product.id]: false }));
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading products...</p>;

  if (products.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No products found. Create products first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium text-gray-700 dark:text-gray-200">
        Production Targets — Per Product
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Set a daily production target quantity for each product. These targets are shown as progress on the Scan page.
      </p>

      <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          <div className="col-span-2">Code</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2 text-center">Current Target</div>
          <div className="col-span-5">Set New Target</div>
        </div>

        {products.map((product) => {
          const isSaving = saving[product.id] ?? false;
          const error = errors[product.id] ?? '';
          const isSuccess = success[product.id] ?? false;
          const hasTarget = product.production_target != null;

          return (
            <div key={product.id} className="px-4 py-3 bg-white dark:bg-gray-800">
              <div className="grid grid-cols-12 gap-4 items-center">
                {/* Code */}
                <div className="col-span-2">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {product.product_code}
                  </span>
                </div>

                {/* Name */}
                <div className="col-span-3">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {product.product_name}
                  </span>
                </div>

                {/* Current target */}
                <div className="col-span-2 text-center">
                  {hasTarget ? (
                    <span className="inline-block text-sm font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {product.production_target}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">Not set</span>
                  )}
                </div>

                {/* Input + button */}
                <div className="col-span-5">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={inputs[product.id] ?? ''}
                      onChange={(e) =>
                        setInputs((prev) => ({ ...prev, [product.id]: e.target.value }))
                      }
                      placeholder="e.g. 200"
                      disabled={isSaving}
                      className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => handleSetTarget(product)}
                      disabled={isSaving}
                      className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary-dark disabled:opacity-50 whitespace-nowrap"
                    >
                      {isSaving ? 'Saving...' : hasTarget ? 'Update' : 'Set Target'}
                    </button>
                    {isSuccess && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Saved ✓</span>
                    )}
                  </div>
                  {error && (
                    <p className="text-xs text-red-500 mt-1">{error}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
