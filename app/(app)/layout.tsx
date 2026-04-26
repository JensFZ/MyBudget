'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      <div className="flex items-center px-4 h-12 md:hidden shrink-0" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1 text-slate-300 hover:text-white"
          aria-label="Open navigation"
        >
          <Menu size={22} />
        </button>
      </div>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
