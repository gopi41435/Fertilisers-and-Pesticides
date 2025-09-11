'use client';
 
import { useState, useEffect } from 'react';

 

export const Header = () => {
  
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Check device size
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  

  return (
    <div className={`
      fixed top-0 right-0 bg-white border-b border-gray-200 z-10 shadow-md 
      flex items-center justify-between transition-all duration-300
      ${isMobile
        ? 'left-0 px-3 py-3 h-16'
        : isTablet
          ? 'left-64 px-4 py-4 h-17'
          : 'left-64 px-5 py-5 h-17'
      }
    `}>
      {/* Left: Page Title */}
      <div className={`flex flex-col ${isMobile ? 'ml-12' : 'ml-0'}`}>
        <h2 className={`
          font-extrabold mt-2 tracking-tight text-gray-900 flex items-center gap-2
          ${isMobile
            ? 'text-base leading-tight'
            : isTablet
              ? 'text-lg'
              : 'text-2xl'
          }
        `}>
          <span className="bg-gradient-to-r from-gray-600 to-emerald-400 bg-clip-text text-transparent">
            {isMobile ? 'Lakshmi Priya Fertilisers' : 'Lakshmi Priya Fertilisers'}
          </span>
        </h2>
      </div>

      {/* Right: Company Info */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className={`
          rounded-full bg-green-100 pt-2 text-green-700 font-medium shadow-sm
          ${isMobile
            ? 'px-2 py-1 text-xs'
            : isTablet
              ? 'px-2.5 py-1 text-xs'
              : 'px-3 py-1 text-xs'
          }
        `}>
          {isMobile ? '15/2019' : 'PL.No: 15/2019'}
        </span>

        {/* Additional info for larger screens */}
        {!isMobile && (
          <div className="hidden lg:flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-500">Online</span>
          </div>
        )}
      </div>
    </div>
  );
};
