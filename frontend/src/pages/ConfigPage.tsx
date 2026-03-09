import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import ProductManagement from '../components/config/ProductManagement.tsx';
import OperatorManagement from '../components/config/OperatorManagement.tsx';
import StagesManagement from '../components/config/StagesManagement.tsx';
import ReworkConfigManagement from '../components/config/ReworkConfigManagement.tsx';
import ProductionTargetPanel from '../components/config/ProductionTargetPanel.tsx';
import ExportPanel from '../components/config/ExportPanel.tsx';

interface TabDef {
  id: string;
  label: string;
  roles: string[];
}

const ALL_TABS: TabDef[] = [
  { id: 'products', label: 'Products', roles: ['admin'] },
  { id: 'stages', label: 'Stages', roles: ['admin'] },
  { id: 'operators', label: 'Operators', roles: ['admin'] },
  { id: 'rework-config', label: 'Rework Config', roles: ['supervisor', 'admin'] },
  { id: 'target', label: 'Production Target', roles: ['supervisor', 'admin'] },
  { id: 'export', label: 'Export', roles: ['supervisor', 'admin'] },
];

export default function ConfigPage() {
  const { user } = useAuth();
  const role = user?.role || '';

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => t.roles.includes(role)),
    [role],
  );

  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id || 'products');

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Configuration</h2>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-6 overflow-x-auto" aria-label="Configuration tabs">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'products' && <ProductManagement />}
      {activeTab === 'stages' && <StagesManagement />}
      {activeTab === 'operators' && <OperatorManagement />}
      {activeTab === 'rework-config' && <ReworkConfigManagement />}
      {activeTab === 'target' && <ProductionTargetPanel />}
      {activeTab === 'export' && <ExportPanel />}
    </div>
  );
}
