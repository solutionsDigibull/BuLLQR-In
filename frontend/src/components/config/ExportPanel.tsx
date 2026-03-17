import { useState, useEffect } from 'react';
import { generateReports, listProducts } from '../../services/config.ts';
import type { Product } from '../../types/config.ts';

export default function ExportPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    listProducts()
      .then((data) => setProducts(data))
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    if (!selectedProductId) {
      setError('Please select a product.');
      return;
    }
    setError('');
    setMessage('');
    setGenerating(true);
    try {
      const blob = await generateReports(startDate || undefined, endDate || undefined, selectedProductId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `production_report_${startDate || 'all'}_${endDate || 'all'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setMessage('Report downloaded successfully');
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded text-sm">{error}
          <button onClick={() => setError('')} className="ml-2 text-red-500">&times;</button>
        </div>
      )}
      {message && <div className="bg-green-50 text-green-700 px-4 py-2 rounded text-sm">{message}</div>}

      <h3 className="text-base font-medium text-gray-700 dark:text-gray-200">Export Reports</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Generate a two-sheet Excel report containing detailed scan records and COPQ summary.
      </p>

      <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-md p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Product</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">Select a product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.product_code} — {p.product_name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-200"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">Leave empty to export all data.</p>
        <button
          onClick={handleGenerate}
          disabled={generating || !selectedProductId}
          className="px-4 py-2 bg-primary text-white text-sm rounded hover:bg-primary-dark disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate & Download Report'}
        </button>
      </div>
    </div>
  );
}
