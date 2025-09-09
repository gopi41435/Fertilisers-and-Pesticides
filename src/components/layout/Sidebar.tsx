'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  Building2, 
  FileText, 
  Package, 
  Users, 
  DollarSign, 
  BarChart3,
  LogOut,
  Zap,
  Menu,
  X,
  Calendar
} from 'lucide-react';

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const navItems = [
    { href: '/dashboard/companies', label: 'Companies', icon: Building2 },
    { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },
    { href: '/dashboard/products', label: 'Products', icon: Package },
    { href: '/dashboard/customers', label: 'Customers', icon: Users },
    { href: '/dashboard/turnover', label: 'Turnover', icon: DollarSign },
    { href: '/dashboard/overview', label: 'Overview', icon: BarChart3 },
    { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  ];

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <button
        onClick={toggleMobileMenu}
        className="fixed top-4 left-4 z-50 md:hidden bg-white p-2 rounded-lg shadow-lg border border-gray-200"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-screen bg-white shadow-lg border-r border-gray-200 flex flex-col z-50 transition-transform duration-300 ease-in-out
        ${isMobile ? 'w-64' : 'w-64'}
        ${isMobileMenuOpen || !isMobile ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200">
          <h1 className="text-lg sm:text-xl font-bold text-green-900 flex items-center">
            <Zap className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-blue-600" />
            <span className="hidden sm:inline">Admin Dashboard</span>
            <span className="sm:hidden">Admin</span>
          </h1>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-3 sm:p-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link 
                    href={item.href}
                    className={`flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-all text-sm sm:text-base ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    onClick={() => isMobile && setIsMobileMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 mr-2.5 sm:mr-3 opacity-75 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* Logout Button */}
        <div className="p-3 sm:p-4 border-t border-gray-200 mt-auto">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 sm:px-4 py-2.5 sm:py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-all text-sm sm:text-base"
          >
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5 mr-2.5 sm:mr-3 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};