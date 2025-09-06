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
    <div className="fixed top-0 left-64 right-0 p-6 bg-white border-b border-gray-200 z-10 shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800">
        {currentPage}
      </h2>
    </div>
  );
};
