'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

interface Company {
  id: string;
  name: string;
  type?: string;
  created_at: string;
}

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({ name: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error fetching companies: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Company name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('companies')
        .insert([{
          name: formData.name.trim(),
          type: formData.type.trim() || null
        }]);

      if (error) throw error;

      toast.success('Company added successfully');
      setFormData({ name: '', type: '' });
      fetchCompanies();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error adding company: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-100 p-2 sm:p-4 md:p-6 transition-colors duration-300">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl transform transition-all duration-500 hover:shadow-2xl p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 md:mb-10 animate-fadeIn">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-teal-600 to-blue-700 bg-clip-text text-transparent drop-shadow-lg animate-pulse-slow">
            Company Management
          </h1>
        </div>

        {/* Add Company Form */}
        <div className="bg-gradient-to-r from-teal-50 to-blue-100 p-4 sm:p-6 rounded-2xl shadow-md mb-6 sm:mb-8 md:mb-10 transform transition-all duration-300 hover:scale-101">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-4 sm:mb-6 animate-slideIn">
            Add New Company
          </h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 animate-fadeInUp">
            <div className="transform transition-all duration-300 hover:shadow-md">
              <label className="block text-xs sm:text-sm md:text-base font-semibold text-gray-700 mb-2">Company Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter company name"
                className="w-full px-4 py-2 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-300 text-sm sm:text-base bg-white shadow-inner"
                required
              />
            </div>

            <div className="transform transition-all duration-300 hover:shadow-md">
              <label className="block text-xs sm:text-sm md:text-base font-semibold text-gray-700 mb-2">Type (optional)</label>
              <input
                type="text"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                placeholder="E.g., Supplier, Vendor, etc."
                className="w-full px-4 py-2 sm:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-300 text-sm sm:text-base bg-white shadow-inner"
              />
            </div>

            <div className="md:col-span-2 transform transition-all duration-300 hover:shadow-md">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-teal-600 to-blue-700 hover:from-teal-700 hover:to-blue-800 text-white font-semibold py-2 sm:py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg disabled:opacity-70 animate-bounce-slow text-sm sm:text-base"
              >
                {isSubmitting ? "Adding..." : "➕ Add Company"}
              </button>
            </div>
          </form>
        </div>

        {/* Companies List */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-md border border-gray-100 animate-fadeInUp">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 animate-slideIn">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">All Companies</h2>
            <span className="text-xs sm:text-sm md:text-base text-gray-600 bg-gray-100 px-3 py-1 rounded-full mt-2 sm:mt-0 animate-pulse-slow">
              {companies.length} {companies.length === 1 ? 'company' : 'companies'}
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-8 sm:py-10 md:py-12 animate-spin-slow">
              <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-t-2 border-b-2 border-teal-600"></div>
              <span className="ml-3 text-sm sm:text-base md:text-lg text-gray-600">Loading companies...</span>
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 animate-fadeIn">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 mx-auto text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <p className="text-sm sm:text-base md:text-lg text-gray-500">No companies added yet. Add your first company above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 animate-fadeInUp">
              <table className="w-full min-w-[40rem]">
                <thead>
                  <tr className="bg-gradient-to-r from-teal-600 to-blue-700 text-white">
                    <th className="px-4 py-3 text-left font-semibold text-sm sm:text-base">Company Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-sm sm:text-base">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-sm sm:text-base">Added Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {companies.map((company) => (
                    <tr
                      key={company.id}
                      className="hover:bg-gray-50 transition-all duration-300 hover:shadow-md animate-slideIn"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 flex items-center">
                        <div className="bg-blue-100 p-2 rounded-lg mr-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-blue-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                        </div>
                        {company.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm sm:text-base">
                        {company.type || (
                          <span className="text-gray-400 italic">Not specified</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm sm:text-base">
                        {new Date(company.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
