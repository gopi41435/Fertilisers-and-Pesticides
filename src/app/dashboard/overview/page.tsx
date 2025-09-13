'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface InvoiceRecord {
  date: string;
  total_amount: number;
  company_id: string | null;
  companies: { name: string }[] | null;
}

interface SaleRecord {
  purchase_date: string;
  total_price: number;
  customer_id: string | null;
  customers: { name: string }[] | null;
}

interface ReturnRecord {
  return_date: string;
  total_price: number;
  company_id: string | null;
}

interface CombinedData {
  date: string;
  purchases: number;
  sales: number;
}

interface CompanyData {
  id: string;
  name: string;
  purchases: number;
  sales: number;
  total: number;
}

interface CustomerData {
  id: string;
  name: string;
  purchases: number; // Using sales total_price as "purchases" from buyer perspective
  total: number;
}

interface Company {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: CombinedData;
  }>;
  label?: string;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: CompanyData | CustomerData;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function Overview() {
  const [combinedData, setCombinedData] = useState<CombinedData[]>([]);
  const [companyData, setCompanyData] = useState<CompanyData[]>([]);
  const [buyerData, setBuyerData] = useState<CustomerData[]>([]);
  const [totalPurchases, setTotalPurchases] = useState<number>(0);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [purchaseGrowth, setPurchaseGrowth] = useState<number | null>(null);
  const [salesGrowth, setSalesGrowth] = useState<number | null>(null);
  const [totalInvoices, setTotalInvoices] = useState<number>(0);
  const [avgInvoiceValue, setAvgInvoiceValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      setIsLoading(true);

      // Fetch invoices (purchases) with company details
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          date,
          total_amount,
          company_id,
          companies (
            name
          )
        `)
        .order('date', { ascending: true });

      if (invoicesError) throw invoicesError;

      // Fetch all companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name');
      if (companiesError) throw companiesError;

      const companiesMap = new Map(companiesData.map((c: Company) => [c.id, c.name]));

      // Fetch returns (purchase returns)
      const { data: returnsData, error: returnsError } = await supabase
        .from('returns')
        .select('total_price, return_date, company_id')
        .order('return_date', { ascending: true });

      if (returnsError) throw returnsError;

      // Fetch sales with customer details
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          purchase_date,
          total_price,
          customer_id,
          customers (
            name
          )
        `)
        .order('purchase_date', { ascending: true });

      if (salesError) throw salesError;

      const purchases = (invoicesData || []).map((inv: InvoiceRecord) => ({
        date: inv.date,
        total_amount: inv.total_amount,
        company_id: inv.company_id,
        companies: inv.companies || null,
      })) as InvoiceRecord[];

      const returns = (returnsData || []) as ReturnRecord[];

      const sales = (salesData || []).map((sale: SaleRecord) => ({
        purchase_date: sale.purchase_date,
        total_price: sale.total_price,
        customer_id: sale.customer_id,
        customers: sale.customers || null,
      })) as SaleRecord[];

      // Calculate totals
      const grossPurchaseAmount = purchases.reduce((sum, invoice) => sum + invoice.total_amount, 0);
      const totalReturns = returns.reduce((sum, ret) => sum + ret.total_price, 0);
      const totalPurchaseAmount = grossPurchaseAmount - totalReturns;
      const totalSaleAmount = sales.reduce((sum, sale) => sum + sale.total_price, 0);
      const invoiceCount = purchases.length;
      const avgValue = invoiceCount > 0 ? totalPurchaseAmount / invoiceCount : 0;

      // Aggregate purchases by date (gross)
      const grossPurchasesByDate = purchases.reduce<Record<string, number>>((acc, invoice) => {
        const date = invoice.date;
        acc[date] = (acc[date] || 0) + invoice.total_amount;
        return acc;
      }, {});

      // Aggregate returns by date
      const returnsByDate = returns.reduce<Record<string, number>>((acc, ret) => {
        const date = ret.return_date;
        acc[date] = (acc[date] || 0) + ret.total_price;
        return acc;
      }, {});

      // Aggregate sales by date
      const salesByDate = sales.reduce<Record<string, number>>((acc, sale) => {
        const date = sale.purchase_date;
        acc[date] = (acc[date] || 0) + sale.total_price;
        return acc;
      }, {});

      // Get all unique dates and create combined data
      const allDates = Array.from(new Set([
        ...Object.keys(grossPurchasesByDate),
        ...Object.keys(returnsByDate),
        ...Object.keys(salesByDate),
      ])).sort();

      const chartData = allDates.map(date => ({
        date,
        purchases: (grossPurchasesByDate[date] || 0) - (returnsByDate[date] || 0),
        sales: salesByDate[date] || 0,
      }));

      // Aggregate purchases by company
      const aggregatedByCompany = purchases.reduce<Record<string, { name: string; grossPurchases: number }>>((acc, invoice) => {
        const companyId = invoice.company_id || 'unknown';
        const companyName = invoice.companies && invoice.companies.length > 0
          ? invoice.companies[0].name
          : companiesMap.get(companyId) || `Unknown Company (${companyId})`;

        if (!acc[companyId]) {
          acc[companyId] = { name: companyName, grossPurchases: 0 };
        }
        acc[companyId].grossPurchases += invoice.total_amount;
        return acc;
      }, {});

      returns.forEach((ret) => {
        const companyId = ret.company_id || 'unknown';
        if (aggregatedByCompany[companyId]) {
          aggregatedByCompany[companyId].grossPurchases -= ret.total_price;
        }
      });

      const companyChartData = Object.entries(aggregatedByCompany).map(([companyId, company]) => ({
        id: companyId,
        name: company.name,
        purchases: company.grossPurchases,
        sales: 0,
        total: company.grossPurchases,
      })).sort((a, b) => b.total - a.total);

      // Aggregate sales by customer
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name');
      if (customersError) throw customersError;

      const customersMap = new Map(customersData.map((c: Customer) => [c.id, c.name]));

      const aggregatedByCustomer = sales.reduce<Record<string, { name: string; purchases: number }>>((acc, sale) => {
        const customerId = sale.customer_id || 'unknown';
        const customerName = sale.customers && sale.customers.length > 0
          ? sale.customers[0].name
          : customersMap.get(customerId) || `Unknown Customer (${customerId})`;

        if (!acc[customerId]) {
          acc[customerId] = { name: customerName, purchases: 0 };
        }
        acc[customerId].purchases += sale.total_price;
        return acc;
      }, {});

      const buyerChartData = Object.entries(aggregatedByCustomer).map(([customerId, customer]) => ({
        id: customerId,
        name: customer.name,
        purchases: customer.purchases,
        total: customer.purchases,
      })).sort((a, b) => b.total - a.total);

      // Calculate growth percentages
      let pGrowth = null;
      let sGrowth = null;

      if (chartData.length > 1) {
        const firstPurchases = chartData[0].purchases;
        const lastPurchases = chartData[chartData.length - 1].purchases;
        const firstSales = chartData[0].sales;
        const lastSales = chartData[chartData.length - 1].sales;

        if (firstPurchases > 0) {
          pGrowth = ((lastPurchases - firstPurchases) / firstPurchases) * 100;
        }
        if (firstSales > 0) {
          sGrowth = ((lastSales - firstSales) / firstSales) * 100;
        }
      }

      setCombinedData(chartData);
      setCompanyData(companyChartData);
      setBuyerData(buyerChartData);
      setTotalPurchases(totalPurchaseAmount);
      setTotalSales(totalSaleAmount);
      setTotalInvoices(invoiceCount);
      setAvgInvoiceValue(avgValue);
      setPurchaseGrowth(pGrowth);
      setSalesGrowth(sGrowth);
    } catch (error) {
      console.error('Error fetching overview data:', error);
      toast.error('Error fetching overview data');
    } finally {
      setIsLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{`Date: ${new Date(label || '').toLocaleDateString('en-IN')}`}</p>
          <p className="text-blue-600">
            {`Purchases: ₹${data.purchases?.toLocaleString('en-IN') || 0}`}
          </p>
          <p className="text-green-600">
            {`Sales: ₹${data.sales?.toLocaleString('en-IN') || 0}`}
          </p>
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: PieTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = 'purchases' in data ? totalPurchases : totalSales; // Differentiate between company and buyer data
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-blue-600">
            {`Purchases: ₹${data.purchases.toLocaleString('en-IN')}`}
          </p>
          <p className="text-gray-500 text-sm">
            {`${((data.purchases / total) * 100).toFixed(1)}% of total ${'purchases' in data ? 'purchases' : 'sales'}`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Business Overview
          </h1>
          <p className="text-gray-600 mt-2">Comprehensive analysis of purchases and sales performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-6 rounded-2xl border border-teal-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Total Purchases</h2>
            <p className="text-2xl font-bold text-teal-600">₹{totalPurchases.toLocaleString('en-IN')}</p>
            {purchaseGrowth !== null && (
              <p className={`text-sm mt-1 ${purchaseGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {purchaseGrowth >= 0 ? '+' : ''}{purchaseGrowth.toFixed(1)}% growth
              </p>
            )}
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Total Sales</h2>
            <p className="text-2xl font-bold text-green-600">₹{totalSales.toLocaleString('en-IN')}</p>
            {salesGrowth !== null && (
              <p className={`text-sm mt-1 ${salesGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {salesGrowth >= 0 ? '+' : ''}{salesGrowth.toFixed(1)}% growth
              </p>
            )}
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Net Margin</h2>
            <p className="text-2xl font-bold text-blue-600">₹{(totalSales - totalPurchases).toLocaleString('en-IN')}</p>
            <p className="text-sm text-gray-600 mt-1">
              {totalPurchases > 0 ? `${(((totalSales - totalPurchases) / totalPurchases) * 100).toFixed(1)}% ROI` : 'N/A'}
            </p>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Avg Invoice</h2>
            <p className="text-2xl font-bold text-purple-600">₹{Math.round(avgInvoiceValue).toLocaleString('en-IN')}</p>
            <p className="text-sm text-gray-600 mt-1">{totalInvoices} invoices</p>
          </div>
        </div>

        {/* Main Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Purchase vs Sales Trend</h2>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              <span className="ml-2 text-gray-600">Loading data...</span>
            </div>
          ) : combinedData.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-500">No data available yet.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={combinedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  stackId="1"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.6}
                  name="Purchases (₹)"
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stackId="2"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.6}
                  name="Sales (₹)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Charts Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 lg:gap-8 mt-8">
          {/* Purchase Distribution by Company */}
          <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b-2 border-teal-200 pb-2">
              Purchase Distribution by Company
            </h2>
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-teal-600"></div>
                <span className="ml-3 text-lg text-gray-600">Loading company data...</span>
              </div>
            ) : companyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-16 w-16 text-gray-400 mb-4"
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
                <p className="text-gray-500 text-center">No company data available yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={companyData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="purchases"
                  >
                    {companyData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Purchase Distribution by Buyer */}
          <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b-2 border-teal-200 pb-2">
              Purchase Distribution by Buyer
            </h2>
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-teal-600"></div>
                <span className="ml-3 text-lg text-gray-600">Loading buyer data...</span>
              </div>
            ) : buyerData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-16 w-16 text-gray-400 mb-4"
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
                <p className="text-gray-500 text-center">No buyer data available yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={buyerData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="purchases"
                  >
                    {buyerData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Company and Buyer Rankings Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 mt-8">
          {companyData.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Top Suppliers by Purchase Volume</h2>
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-teal-600 to-blue-600 text-white">
                      <th className="px-6 py-4 text-left font-semibold">Rank</th>
                      <th className="px-6 py-4 text-left font-semibold">Company Name</th>
                      <th className="px-6 py-4 text-right font-semibold">Total Purchases</th>
                      <th className="px-6 py-4 text-right font-semibold">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {companyData.map((company, index) => (
                      <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">#{index + 1}</td>
                        <td className="px-6 py-4 text-gray-900 font-medium">{company.name}</td>
                        <td className="px-6 py-4 text-right font-semibold text-teal-600">
                          ₹{company.purchases.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {((company.purchases / totalPurchases) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {buyerData.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Top Buyers by Purchase Volume</h2>
              <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-teal-600 to-blue-600 text-white">
                      <th className="px-6 py-4 text-left font-semibold">Rank</th>
                      <th className="px-6 py-4 text-left font-semibold">Buyer Name</th>
                      <th className="px-6 py-4 text-right font-semibold">Total Purchases</th>
                      <th className="px-6 py-4 text-right font-semibold">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {buyerData.map((buyer, index) => (
                      <tr key={buyer.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">#{index + 1}</td>
                        <td className="px-6 py-4 text-gray-900 font-medium">{buyer.name}</td>
                        <td className="px-6 py-4 text-right font-semibold text-teal-600">
                          ₹{buyer.purchases.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {((buyer.purchases / totalSales) * 100).toFixed(1)}%
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
    </div>
  );
}