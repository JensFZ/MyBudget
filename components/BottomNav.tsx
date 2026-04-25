'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutList, CreditCard, Landmark, BarChart3 } from 'lucide-react';

const tabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/plan', label: 'Plan', icon: LayoutList },
  { href: '/spending', label: 'Spending', icon: CreditCard },
  { href: '/accounts', label: 'Accounts', icon: Landmark },
  { href: '/reflect', label: 'Reflect', icon: BarChart3 },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-200 flex z-50">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
              active ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <div className="relative">
              <Icon size={22} />
              {href === '/' && (
                <span className="absolute -top-1 -right-2 bg-blue-600 text-white text-[9px] rounded-full px-1 leading-4 min-w-[16px] text-center">
                  3
                </span>
              )}
            </div>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
