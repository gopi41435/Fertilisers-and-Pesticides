'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Image from 'next/image';
import {
  Building2,
  FileText,
  Package,
  Users,
  DollarSign,
  BarChart3,
  LogOut,
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
    } catch {
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
        className="fixed top-4 left-4 z-50 md:hidden bg-white p-2 rounded-xl shadow-lg border border-gray-200 transition-all duration-300 hover:shadow-xl hover:scale-105"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <X className="h-5 w-5 transition-transform duration-300 rotate-90" />
        ) : (
          <Menu className="h-5 w-5 transition-transform duration-300" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden animate-fadeIn"
          onClick={toggleMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 h-screen flex flex-col z-50 transition-all duration-500 ease-out
          ${isMobile ? 'w-64' : 'w-64'}
          ${isMobileMenuOpen || !isMobile ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Deity Images Header - Matching the main header style */}
        <div className="p-1 border-b bg-gradient-to-r from-blue-50 to-blue-100/80 flex items-center justify-between">
          {/* Left: Lord Hanuman Image */}
          <div className="flex items-center w-12">
            <div className="relative group">
              <div className="absolute -inset-1 bg-blue-400/20 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
              <Image
                src="/images/hanuman.jpeg"
                alt="Lord Hanuman"
                width={48}
                height={48}
                className="object-contain relative transform transition duration-700 hover:scale-110"
              />
              {!isMobile && (
                <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full w-3 h-3 flex items-center justify-center ring-2 ring-white">
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h1><b>MOHAN</b></h1>
          </div>

          {/* Right: Lord Vinayaka Image */}
          <div className="flex items-center w-12">
            <div className="relative group">
              <div className="absolute -inset-1 bg-blue-400/20 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
              <Image
                src="/images/vinayaka.jpg"
                alt="Lord Ganesha"
                width={48}
                height={48}
                className="object-contain relative transform transition duration-700 hover:scale-110"
              />
              {!isMobile && (
                <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full w-3 h-3 flex items-center justify-center ring-2 ring-white">
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto bg-gradient-to-b from-white to-blue-50/80">
          <ul className="space-y-2">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-4 py-3 rounded-xl transition-all duration-300 group ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 transform scale-[1.02]'
                        : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:shadow-md'
                    }`}
                    style={{ transitionDelay: `${index * 50}ms` }}
                    onClick={() => isMobile && setIsMobileMenuOpen(false)}
                  >
                    <Icon 
                      className={`h-5 w-5 mr-3 transition-all duration-300 ${
                        isActive ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'
                      }`} 
                    />
                    <span className="font-medium truncate">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200/50 bg-white/80 backdrop-blur-sm mt-auto">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-gray-600 hover:text-blue-600 rounded-xl transition-all duration-300 hover:bg-blue-50 group"
          >
            <LogOut className="h-5 w-5 mr-3 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
            <span className="font-medium">Logout</span>
            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>
            </div>
          </button>
        </div>
      </aside>

      {/* Add global styles for animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </>
  );
};
