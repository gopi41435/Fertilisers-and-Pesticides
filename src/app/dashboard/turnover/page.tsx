'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Sale {
  total_price: number;
  purchase_date: string;
}

interface ChartData {
  date: string;
  sales: number;
}

export default function Turnover() {
  const [totalSales, setTotalSales] = useState<number>(0);
  const [salesData, setSalesData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTurnover();
  }, []);

  const fetchTurnover = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from('sales').select('total_price, purchase_date');
      if (error) throw error;

      const total = data.reduce((sum: number, sale: Sale) => sum + sale.total_price, 0);
      const aggregated = data.reduce((acc: { [key: string]: number }, sale: Sale) => {
        const date = sale.purchase_date;
        acc[date] = (acc[date] || 0) + sale.total_price;
        return acc;
      }, {});
      
      const chartData = Object.keys(aggregated)
        .map((date) => ({ date, sales: aggregated[date] }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setTotalSales(total);
      setSalesData(chartData);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error fetching turnover: ${message}`);
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
          <p className="text-gray-600 mt-2">Total Turnover</p>
        </div>

        {/* Total Sales Card */}
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-6 rounded-2xl border border-teal-100 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Total Sales</h2>
          <p className="text-3xl font-bold text-teal-600">₹{totalSales.toFixed(2)}</p>
        </div>

        {/* Sales Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Sales by Date</h2>
          
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
              <BarChart data={salesData}>
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
                <Bar 
                  dataKey="sales" 
                  fill="#10B981" 
                  name="Sales (₹)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
