import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header.tsx';
import Sidebar from './Sidebar.tsx';
import ErrorBoundary from '../ErrorBoundary.tsx';

export default function AppLayout() {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <div className="h-screen flex flex-col">
      <Header onToggleSidebar={() => setSidebarVisible((v) => !v)} sidebarVisible={sidebarVisible} />
      <div className="flex flex-1 overflow-hidden">
        {sidebarVisible && <Sidebar />}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
