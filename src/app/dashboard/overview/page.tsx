'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

interface Sale {
  purchase_date: string;
  total_price: number;
}

interface ChartData {
  date: string;
  sales: number;
}

export default function Overview() {
  const [salesData, setSalesData] = useState<ChartData[]>([]);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [growthPercentage, setGrowthPercentage] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select('purchase_date, total_price')
        .order('purchase_date', { ascending: true });

      if (error) throw error;

      const aggregated = data.reduce((acc: { [key: string]: number }, sale: Sale) => {
        const date = sale.purchase_date;
        acc[date] = (acc[date] || 0) + sale.total_price;
        return acc;
      }, {});

      const chartData = Object.keys(aggregated)
        .map((date) => ({ date, sales: aggregated[date] }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const total = data.reduce((sum: number, sale: Sale) => sum + sale.total_price, 0);

      let growth = null;
      if (chartData.length > 1) {
        const firstSales = chartData[0].sales;
        const lastSales = chartData[chartData.length - 1].sales;
        growth = ((lastSales - firstSales) / firstSales) * 100;
      }

      setSalesData(chartData);
      setTotalSales(total);
      setGrowthPercentage(growth);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error fetching sales data: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl p-6 md:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Lakshmi Priya Fertilizers
          </h1>
          <p className="text-gray-600 mt-2">Company Overview</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-6 rounded-2xl border border-teal-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Total Sales</h2>
            <p className="text-3xl font-bold text-teal-600">₹{totalSales.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-6 rounded-2xl border border-teal-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Sales Growth</h2>
            <p className="text-3xl font-bold">
              {growthPercentage !== null ? (
                <span className={growthPercentage >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {growthPercentage >= 0 ? '+' : ''}{growthPercentage.toFixed(2)}%
                </span>
              ) : (
                <span className="text-gray-500">N/A</span>
              )}
            </p>
          </div>
        </div>

        {/* Sales Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Sales Trend</h2>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              <span className="ml-2 text-gray-600">Loading sales data...</span>
            </div>
          ) : salesData.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-500">No sales data available yet.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#6b7280' }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  tick={{ fill: '#6b7280' }}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip 
                  formatter={(value) => [`₹${value}`, 'Sales']}
                  labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-IN')}`}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem'
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#1D4ED8' }}
                  name="Sales (₹)"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
