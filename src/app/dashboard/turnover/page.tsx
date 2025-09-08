'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line } from 'recharts';

interface Invoice {
  total_amount: number;
  date: string;
  company_id: string;
  companies?: {
    name: string;
  } | null;
}

interface Sale {
  total_price: number;
  purchase_date: string;
}

interface TurnoverData {
  date: string;
  purchaseTurnover: number;
  salesTurnover: number;
  netTurnover: number;
  invoiceCount: number;
}

interface CompanyTurnover {
  name: string;
  purchaseTurnover: number;
  invoiceCount: number;
  avgInvoiceValue: number;
  marketShare: number;
}

interface MonthlyTurnover {
  month: string;
  purchaseTurnover: number;
  salesTurnover: number;
  netTurnover: number;
  invoiceCount: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: string;
}

export default function Turnover() {
  const [totalPurchaseTurnover, setTotalPurchaseTurnover] = useState<number>(0);
  const [totalSalesTurnover, setTotalSalesTurnover] = useState<number>(0);
  const [dailyTurnover, setDailyTurnover] = useState<TurnoverData[]>([]);
  const [monthlyTurnover, setMonthlyTurnover] = useState<MonthlyTurnover[]>([]);
  const [companyTurnover, setCompanyTurnover] = useState<CompanyTurnover[]>([]);
  const [totalInvoices, setTotalInvoices] = useState<number>(0);
  const [avgDailyTurnover, setAvgDailyTurnover] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');

  useEffect(() => {
    fetchTurnoverData();
  }, []);

  const fetchTurnoverData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch invoice data (purchases)
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          total_amount,
          date,
          company_id,
          companies (
            name
          )
        `)
        .order('date', { ascending: true });
      
      if (invoicesError) throw invoicesError;

      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_price, purchase_date')
        .order('purchase_date', { ascending: true });
      
      if (salesError) throw salesError;

      const purchases = (invoicesData || []) as Invoice[];
      const sales = (salesData || []) as Sale[];
      


      // Calculate totals
      const totalPurchases = purchases.reduce((sum, invoice) => sum + invoice.total_amount, 0);
      const totalSales = sales.reduce((sum, sale) => sum + sale.total_price, 0);
      const invoiceCount = purchases.length;

      // Daily turnover aggregation
      const dailyPurchases = purchases.reduce<Record<string, { total: number; count: number }>>((acc, invoice) => {
        const date = invoice.date;
        if (!acc[date]) {
          acc[date] = { total: 0, count: 0 };
        }
        acc[date].total += invoice.total_amount;
        acc[date].count += 1;
        return acc;
      }, {});

      const dailySales = sales.reduce<Record<string, number>>((acc, sale) => {
        const date = sale.purchase_date;
        acc[date] = (acc[date] || 0) + sale.total_price;
        return acc;
      }, {});

      // Get all unique dates
      const allDates = Array.from(new Set([
        ...Object.keys(dailyPurchases),
        ...Object.keys(dailySales)
      ])).sort();

      const dailyTurnoverData = allDates.map(date => {
        const purchaseTurnover = dailyPurchases[date]?.total || 0;
        const salesTurnover = dailySales[date] || 0;
        return {
          date,
          purchaseTurnover,
          salesTurnover,
          netTurnover: salesTurnover - purchaseTurnover,
          invoiceCount: dailyPurchases[date]?.count || 0
        };
      });

      // Monthly turnover aggregation
      const monthlyPurchases = purchases.reduce<Record<string, { total: number; count: number }>>((acc, invoice) => {
        const date = new Date(invoice.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!acc[monthKey]) {
          acc[monthKey] = { total: 0, count: 0 };
        }
        acc[monthKey].total += invoice.total_amount;
        acc[monthKey].count += 1;
        return acc;
      }, {});

      const monthlySales = sales.reduce<Record<string, number>>((acc, sale) => {
        const date = new Date(sale.purchase_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        acc[monthKey] = (acc[monthKey] || 0) + sale.total_price;
        return acc;
      }, {});

      const allMonths = Array.from(new Set([
        ...Object.keys(monthlyPurchases),
        ...Object.keys(monthlySales)
      ])).sort();

      const monthlyTurnoverData = allMonths.map(monthKey => {
        const purchaseTurnover = monthlyPurchases[monthKey]?.total || 0;
        const salesTurnover = monthlySales[monthKey] || 0;
        return {
          month: new Date(monthKey + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
          purchaseTurnover,
          salesTurnover,
          netTurnover: salesTurnover - purchaseTurnover,
          invoiceCount: monthlyPurchases[monthKey]?.count || 0
        };
      });

      // Company-wise turnover analysis
      const companyAnalysis = purchases.reduce<Record<string, { name: string; total: number; count: number }>>((acc, invoice) => {
        const companyId = invoice.company_id;
        const companyName = invoice.companies?.name || 'Unknown Company';
        
        if (!acc[companyId]) {
          acc[companyId] = { name: companyName, total: 0, count: 0 };
        }
        acc[companyId].total += invoice.total_amount;
        acc[companyId].count += 1;
        return acc;
      }, {});

      const companyTurnoverData = Object.values(companyAnalysis)
        .map(company => ({
          name: company.name,
          purchaseTurnover: company.total,
          invoiceCount: company.count,
          avgInvoiceValue: company.count > 0 ? company.total / company.count : 0,
          marketShare: totalPurchases > 0 ? (company.total / totalPurchases) * 100 : 0
        }))
        .sort((a, b) => b.purchaseTurnover - a.purchaseTurnover);

      // Calculate average daily turnover
      const avgDaily = dailyTurnoverData.length > 0 
        ? dailyTurnoverData.reduce((sum, day) => sum + day.purchaseTurnover + day.salesTurnover, 0) / dailyTurnoverData.length 
        : 0;

      setTotalPurchaseTurnover(totalPurchases);
      setTotalSalesTurnover(totalSales);
      setTotalInvoices(invoiceCount);
      setDailyTurnover(dailyTurnoverData);
      setMonthlyTurnover(monthlyTurnoverData);
      setCompanyTurnover(companyTurnoverData);
      setAvgDailyTurnover(avgDaily);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error fetching turnover: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium mb-2">
            {viewMode === 'daily' 
              ? `Date: ${new Date(label || '').toLocaleDateString('en-IN')}`
              : `Month: ${label}`
            }
          </p>
          {payload.map((item, index) => (
            <p key={index} style={{ color: item.color }}>
              {item.dataKey === 'purchaseTurnover' && `Purchase Turnover: ₹${item.value.toLocaleString('en-IN')}`}
              {item.dataKey === 'salesTurnover' && `Sales Turnover: ₹${item.value.toLocaleString('en-IN')}`}
              {item.dataKey === 'netTurnover' && `Net Turnover: ₹${item.value.toLocaleString('en-IN')}`}
              {item.dataKey === 'invoiceCount' && `Invoices: ${item.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const currentData = viewMode === 'daily' ? dailyTurnover : monthlyTurnover;
  const xAxisKey = viewMode === 'daily' ? 'date' : 'month';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Turnover Analysis Dashboard
          </h1>
          <p className="text-gray-600 mt-2">Detailed turnover breakdown with purchase and sales analysis</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Purchase Turnover</h2>
            <p className="text-2xl font-bold text-indigo-600">₹{totalPurchaseTurnover.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-teal-50 p-6 rounded-2xl border border-green-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Sales Turnover</h2>
            <p className="text-2xl font-bold text-green-600">₹{totalSalesTurnover.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Net Turnover</h2>
            <p className="text-2xl font-bold text-blue-600">₹{(totalSalesTurnover - totalPurchaseTurnover).toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-2xl border border-orange-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Avg Daily Turnover</h2>
            <p className="text-2xl font-bold text-orange-600">₹{Math.round(avgDailyTurnover).toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Turnover Trend Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Turnover Trend Analysis</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'daily'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Daily View
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'monthly'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Monthly View
              </button>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-2 text-gray-600">Loading turnover data...</span>
            </div>
          ) : currentData.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-500">No turnover data available yet.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={currentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey={xAxisKey}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => 
                    viewMode === 'daily' 
                      ? new Date(value).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                      : value
                  }
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="purchaseTurnover" 
                  fill="#6366F1" 
                  name="Purchase Turnover (₹)"
                  radius={[2, 2, 0, 0]}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="salesTurnover" 
                  fill="#10B981" 
                  name="Sales Turnover (₹)"
                  radius={[2, 2, 0, 0]}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="netTurnover" 
                  stroke="#F59E0B" 
                  strokeWidth={3}
                  dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                  name="Net Turnover (₹)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Company Analysis Section */}
        {companyTurnover.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Company Turnover Table */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Company Turnover Breakdown</h2>
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                      <th className="px-4 py-3 text-left font-semibold text-sm">Company</th>
                      <th className="px-4 py-3 text-right font-semibold text-sm">Turnover</th>
                      <th className="px-4 py-3 text-right font-semibold text-sm">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {companyTurnover.slice(0, 8).map((company) => (
                      <tr key={company.name} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center">
                            <span className="inline-block w-2 h-2 bg-indigo-600 rounded-full mr-2"></span>
                            <span className="font-medium text-gray-900">{company.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-indigo-600">
                          ₹{company.purchaseTurnover.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {company.marketShare.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Performers Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Top 5 Companies by Turnover</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={companyTurnover.slice(0, 5)} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    type="number"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    width={80}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Purchase Turnover']}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem'
                    }}
                  />
                  <Bar 
                    dataKey="purchaseTurnover" 
                    fill="#8B5CF6"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Detailed Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-6 rounded-2xl border border-cyan-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Turnover Ratio</h3>
            <p className="text-2xl font-bold text-cyan-600">
              {totalPurchaseTurnover > 0 ? `${(totalSalesTurnover / totalPurchaseTurnover).toFixed(2)}` : '0'}
            </p>
            <p className="text-sm text-gray-600 mt-1">Sales/Purchase ratio</p>
          </div>
          
          <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-6 rounded-2xl border border-pink-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Active Suppliers</h3>
            <p className="text-2xl font-bold text-pink-600">{companyTurnover.length}</p>
            <p className="text-sm text-gray-600 mt-1">Companies in portfolio</p>
          </div>
          
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-6 rounded-2xl border border-amber-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Avg Invoice Value</h3>
            <p className="text-2xl font-bold text-amber-600">
              ₹{totalInvoices > 0 ? Math.round(totalPurchaseTurnover / totalInvoices).toLocaleString('en-IN') : '0'}
            </p>
            <p className="text-sm text-gray-600 mt-1">Per invoice average</p>
          </div>
          
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-6 rounded-2xl border border-emerald-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Profit Margin</h3>
            <p className="text-2xl font-bold text-emerald-600">
              {totalSalesTurnover > 0 ? `${(((totalSalesTurnover - totalPurchaseTurnover) / totalSalesTurnover) * 100).toFixed(1)}%` : '0%'}
            </p>
            <p className="text-sm text-gray-600 mt-1">Gross profit margin</p>
          </div>
        </div>

        {/* Comprehensive Company Performance Table */}
        {companyTurnover.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Comprehensive Company Performance</h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                    <th className="px-6 py-4 text-left font-semibold">Rank</th>
                    <th className="px-6 py-4 text-left font-semibold">Company Name</th>
                    <th className="px-6 py-4 text-right font-semibold">Purchase Turnover</th>
                    <th className="px-6 py-4 text-right font-semibold">No. of Invoices</th>
                    <th className="px-6 py-4 text-right font-semibold">Avg Invoice Value</th>
                    <th className="px-6 py-4 text-right font-semibold">Market Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {companyTurnover.map((company, index) => (
                    <tr key={company.name} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">#{index + 1}</td>
                      <td className="px-6 py-4 text-gray-900 font-medium">{company.name}</td>
                      <td className="px-6 py-4 text-right font-semibold text-indigo-600">
                        ₹{company.purchaseTurnover.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {company.invoiceCount}
                      </td>
                      <td className="px-6 py-4 text-right text-purple-600 font-medium">
                        ₹{Math.round(company.avgInvoiceValue).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {company.marketShare.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
