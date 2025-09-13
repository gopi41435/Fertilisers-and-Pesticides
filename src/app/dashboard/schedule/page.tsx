
'use client';

import { useState, useEffect } from 'react';

export default function SchedulePage() {
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const targetDate = new Date('2025-10-01T12:00:00+05:30').getTime(); // Launch date: October 1, 2025, 12:00 PM IST

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });

      if (distance < 0) {
        clearInterval(interval);
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setMessage('Please enter a valid email address.');
      return;
    }
    setMessage('Thank you for subscribing! We’ll notify you soon.');
    setEmail('');
    setTimeout(() => setMessage(''), 5000); // Clear message after 5 seconds
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold  mb-4 bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
          Coming Soon
        </h1>
        <p className="text-gray-600 mb-6 text-sm sm:text-base">
          We are working hard to bring you an amazing scheduling experience. Stay tuned!
        </p>

        {/* Countdown Timer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {Object.entries(countdown).map(([unit, value]) => (
            <div key={unit} className="bg-gray-100 p-3 rounded-lg">
              <div className="text-2xl sm:text-3xl font-bold text-teal-600">{value.toString().padStart(2, '0')}</div>
              <div className="text-xs sm:text-sm text-gray-500 capitalize">{unit}</div>
            </div>
          ))}
        </div>

        {/* Subscription Form */}
        <form onSubmit={handleSubscribe} className="mb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm sm:text-base"
              required
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
            >
              Notify Me
            </button>
          </div>
        </form>

        {message && <p className="text-sm sm:text-base text-green-600">{message}</p>}

        {/* Footer */}
        <p className="text-gray-500 text-xs sm:text-sm mt-4">
          Expected launch: October 1, 2025 | © 2025 Your Company
        </p>
      </div>
    </div>
  );
}
 