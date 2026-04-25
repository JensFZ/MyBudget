'use client';

import { fmt } from '@/lib/format';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface AccountCardProps {
  id: number;
  name: string;
  balance: number;
  type: string;
  hasUncleared?: boolean;
}

export default function AccountCard({ id, name, balance, type, hasUncleared }: AccountCardProps) {
  return (
    <Link
      href={`/accounts/${id}`}
      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100"
    >
      <div className="flex items-center gap-2">
        {hasUncleared && (
          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
        )}
        {!hasUncleared && <span className="w-2 h-2 flex-shrink-0" />}
        <span className="text-sm">{name}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-sm font-medium ${balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
          {fmt(balance)}
        </span>
        <ChevronRight size={14} className="text-gray-300" />
      </div>
    </Link>
  );
}
