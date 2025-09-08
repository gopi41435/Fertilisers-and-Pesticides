'use client';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard/companies', label: 'Companies' },
  { href: '/dashboard/invoices', label: 'Invoices' },
  { href: '/dashboard/products', label: 'Products' },
  { href: '/dashboard/customers', label: 'Customers' },
  { href: '/dashboard/turnover', label: 'Turnover' },
  { href: '/dashboard/overview', label: 'Overview' },
];

export const Header = () => {
  const pathname = usePathname();
  const currentPage = navItems.find(item => item.href === pathname)?.label || 'Dashboard';

  return (
    <div className="fixed top-0 left-64 right-0 p-5 bg-white border-b border-gray-200 z-10 shadow-md flex items-center justify-between">
      {/* Left: Page Title */}
        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
            <span className="bg-gradient-to-r from-gray-600 to-emerald-400 bg-clip-text text-transparent">
                Lakshmi Priya Fertilisers
            </span>     
        </h2>


      {/* Right: Company Info */}
      <div className="flex items-center gap-3">
    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium shadow-sm">
      PL.No: 15/2019
    </span>
  </div>
    </div>
  );
};
