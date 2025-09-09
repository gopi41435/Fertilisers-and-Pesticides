'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Select, { SingleValue } from 'react-select';
import toast from 'react-hot-toast';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  quantity_unit?: string;
}

interface SaleItem {
  productId: string;
  quantity: number;
  discount: number;
}

interface SaleRecord {
  id: string;
  customer_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  discount_price: number;
  purchase_date: string;
  products: Product;
  customers: Customer;
}

interface SalesByDate {
  [date: string]: {
    items: SaleRecord[];
    total: number;
  };
}

interface JSPDFWithAutoTable extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

interface SelectOption {
  value: string;
  label: string;
}

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<'customers' | 'sales' | 'reports'>('sales');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Separate customer selection states
  const [selectedSaleCustomer, setSelectedSaleCustomer] = useState<string>('');
  const [selectedReportCustomer, setSelectedReportCustomer] = useState<string>('');

  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([{ productId: '', quantity: 1, discount: 0 }]);
  const [totalPrice, setTotalPrice] = useState<number>(0);

  // Form states for adding customers
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from('customers').select('*').order('name', { ascending: true });
      if (error) throw error;
      setCustomers(data || []);
    } catch (error: unknown) {
      toast.error(`Error fetching customers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, quantity, quantity_unit')
        .order('name', { ascending: true });
      if (error) throw error;
      setProducts(data || []);
    } catch (error: unknown) {
      toast.error(`Error fetching products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const fetchSalesHistory = useCallback(async (customerId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          products (id, name, price, quantity, quantity_unit),
          customers (id, name, email, phone, address)
        `)
        .eq('customer_id', customerId)
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      setSalesHistory(data || []);
    } catch (error: unknown) {
      toast.error(`Error fetching sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load initial data when component mounts
  useEffect(() => {
    fetchCustomers();
    fetchProducts();
  }, [fetchCustomers, fetchProducts]);

  const calculateTotalPrice = useCallback(() => {
    let total = 0;
    saleItems.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product && item.productId) {
        total += product.price * item.quantity - item.discount;
      }
    });
    setTotalPrice(total);
  }, [saleItems, products]);

  useEffect(() => {
    calculateTotalPrice();
  }, [calculateTotalPrice]);

  const addCustomer = async () => {
    if (!customerName.trim()) {
      toast.error('Please enter customer name');
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .insert([
          {
            name: customerName,
            email: customerEmail || null,
            phone: customerPhone || null,
            address: customerAddress || null,
          },
        ])
        .select();
      if (error) throw error;
      setCustomers([...customers, data[0]]);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerAddress('');
      toast.success('Customer added successfully!');
    } catch (error: unknown) {
      toast.error(`Error adding customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addSaleItem = () => {
    setSaleItems([...saleItems, { productId: '', quantity: 1, discount: 0 }]);
  };

  const updateSaleItem = (index: number, field: keyof SaleItem, value: string | number) => {
    const updatedItems = [...saleItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setSaleItems(updatedItems);
  };

  const removeSaleItem = (index: number) => {
    if (saleItems.length > 1) {
      const updatedItems = [...saleItems];
      updatedItems.splice(index, 1);
      setSaleItems(updatedItems);
    }
  };

  const recordSale = async () => {
    if (!selectedSaleCustomer) {
      toast.error('Please select a customer');
      return;
    }

    const validItems = saleItems.filter((item) => item.productId);
    if (validItems.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    try {
      setIsLoading(true);

      // Check stock availability for all items
      for (const item of validItems) {
        const product = products.find((p) => p.id === item.productId);
        if (product && item.quantity > product.quantity) {
          toast.error(`Not enough stock for ${product.name}. Available: ${product.quantity}`);
          return;
        }
      }

      const saleData = validItems.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        const totalPrice = product ? product.price * item.quantity - item.discount : 0;

        return {
          customer_id: selectedSaleCustomer,
          product_id: item.productId,
          quantity: item.quantity,
          total_price: totalPrice,
          discount_price: item.discount || null,
          purchase_date: saleDate,
        };
      });

      // Update product quantities
      for (const item of validItems) {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          const { error } = await supabase
            .from('products')
            .update({ quantity: product.quantity - item.quantity })
            .eq('id', product.id);

          if (error) throw error;
        }
      }

      const { error } = await supabase.from('sales').insert(saleData);
      if (error) throw error;

      // Refresh products to get updated quantities
      await fetchProducts();

      toast.success('Sale recorded successfully!');
      setSaleItems([{ productId: '', quantity: 1, discount: 0 }]);
      setSelectedSaleCustomer('');
    } catch (error: unknown) {
      toast.error(`Error recording sale: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSaleReceiptPDF = () => {
    if (!selectedSaleCustomer) {
      toast.error('Please select a customer to generate a receipt');
      return;
    }

    const validItems = saleItems.filter((item) => item.productId);
    if (validItems.length === 0) {
      toast.error('Please select at least one product to generate PDF');
      return;
    }

    const customer = customers.find((c) => c.id === selectedSaleCustomer);
    if (!customer) return;

    const doc = new jsPDF() as JSPDFWithAutoTable;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 118, 110);
    doc.text('LAKSHMI PRIYA FERTILISERS', 105, 20, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('SALE RECEIPT', 105, 30, { align: 'center' });

    // Sale Date
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(saleDate).toLocaleDateString('en-IN')}`, 14, 45);

    // Customer Info
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Details:', 14, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${customer.name}`, 14, 62);
    doc.text(`Email: ${customer.email || 'N/A'}`, 14, 69);
    doc.text(`Phone: ${customer.phone || 'N/A'}`, 14, 76);
    doc.text(`Address: ${customer.address || 'N/A'}`, 14, 83);

    // Products table
    const headers = [['#', 'Product', 'Qty', 'Price', 'Discount', 'Total']];
    const rows = validItems.map((item, i) => {
      const product = products.find((p) => p.id === item.productId);
      const price = product ? product.price : 0;
      const itemTotal = price * item.quantity - item.discount;

      return [
        (i + 1).toString(),
        product ? product.name : '',
        item.quantity.toString(),
        `₹${price.toFixed(2)}`,
        `₹${item.discount.toFixed(2)}`,
        `₹${itemTotal.toFixed(2)}`,
      ];
    });

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 90,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 118, 110],
        textColor: 255,
        fontStyle: 'bold',
      },
      styles: {
        font: 'helvetica',
        fontSize: 11,
        cellPadding: 3,
      },
      margin: { top: 90 },
      foot: [
        [
          { content: '', colSpan: 4, styles: { halign: 'right' } },
          { content: 'Total Amount', styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `₹${totalPrice.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } },
        ],
      ],
    });

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for your business!', 105, doc.internal.pageSize.height - 20, { align: 'center' });

    doc.save(`${customer.name}_receipt_${saleDate}.pdf`);
  };

  const generateCustomerReportPDF = async () => {
    if (!selectedReportCustomer) {
      toast.error('Please select a customer to generate a report');
      return;
    }

    const customer = customers.find((c) => c.id === selectedReportCustomer);
    if (!customer) return;

    try {
      setIsLoading(true);
      await fetchSalesHistory(selectedReportCustomer);

      const doc = new jsPDF() as JSPDFWithAutoTable;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(15, 118, 110);
      doc.text('LAKSHMI PRIYA FERTILISERS', 105, 20, { align: 'center' });

      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('CUSTOMER PURCHASE REPORT', 105, 30, { align: 'center' });

      // Report Date
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Report Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 45);

      // Customer Info
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Details:', 14, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${customer.name}`, 14, 62);
      doc.text(`Email: ${customer.email || 'N/A'}`, 14, 69);
      doc.text(`Phone: ${customer.phone || 'N/A'}`, 14, 76);
      doc.text(`Address: ${customer.address || 'N/A'}`, 14, 83);

      if (salesHistory.length > 0) {
        // Group sales by date and calculate totals
        const salesByDate: SalesByDate = {};

        salesHistory.forEach((sale) => {
          if (!salesByDate[sale.purchase_date]) {
            salesByDate[sale.purchase_date] = { items: [], total: 0 };
          }
          salesByDate[sale.purchase_date].items.push(sale);
          salesByDate[sale.purchase_date].total += sale.total_price;
        });

        let currentY = 95;

        // Create a summary table with SNO, DATE, Number Of Items, Total Sales
        const summaryHeaders = [['SNO', 'DATE', 'NUMBER OF ITEMS', 'TOTAL SALES']];
        const summaryRows = Object.entries(salesByDate).map(([date], index) => [
          (index + 1).toString(),
          new Date(date).toLocaleDateString('en-IN'),
          salesByDate[date].items.length.toString(),
          `₹${salesByDate[date].total.toFixed(2)}`,
        ]);

        doc.setFont('helvetica', 'bold');
        doc.text('SALES SUMMARY', 14, currentY);
        currentY += 8;

        autoTable(doc, {
          head: summaryHeaders,
          body: summaryRows,
          startY: currentY,
          theme: 'grid',
          headStyles: {
            fillColor: [15, 118, 110],
            textColor: 255,
            fontStyle: 'bold',
          },
          styles: {
            font: 'helvetica',
            fontSize: 11,
            cellPadding: 3,
          },
        });

        currentY = doc.lastAutoTable.finalY + 20;

        // Grand total
        const grandTotal = salesHistory.reduce((total, sale) => total + sale.total_price, 0);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 118, 110);
        doc.text(`GRAND TOTAL: ₹${grandTotal.toFixed(2)}`, 14, currentY);
        currentY += 15;

        // Detailed sales for each date
        Object.entries(salesByDate).forEach(([date, data]) => {
          if (currentY > 200) {
            doc.addPage();
            currentY = 20;
          }

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text(`DETAILED SALES FOR ${new Date(date).toLocaleDateString('en-IN')}`, 14, currentY);
          currentY += 10;

          const detailHeaders = [['PRODUCT', 'QUANTITY', 'PRICE', 'DISCOUNT', 'TOTAL']];
          const detailRows = data.items.map((sale) => [
            sale.products?.name || 'Unknown Product',
            sale.quantity.toString(),
            `₹${sale.products?.price?.toFixed(2) || '0.00'}`,
            `₹${(sale.discount_price || 0).toFixed(2)}`, // Handle null discount_price
            `₹${sale.total_price.toFixed(2)}`,
          ]);

          autoTable(doc, {
            head: detailHeaders,
            body: detailRows,
            startY: currentY,
            theme: 'grid',
            headStyles: {
              fillColor: [59, 130, 246],
              textColor: 255,
              fontStyle: 'bold',
            },
            styles: {
              font: 'helvetica',
              fontSize: 10,
              cellPadding: 2,
            },
          });

          currentY = doc.lastAutoTable.finalY + 15;

          if (currentY < doc.internal.pageSize.height - 50) {
            doc.setDrawColor(200, 200, 200);
            doc.line(14, currentY, doc.internal.pageSize.width - 14, currentY);
            currentY += 10;
          }
        });
      } else {
        doc.text('No sales records found for this customer.', 14, 95);
      }

      doc.save(`${customer.name}_sales_report.pdf`);
    } catch (error: unknown) {
      toast.error(`Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fixed onChange handlers for Select components
  const handleSaleCustomerChange = (selected: SingleValue<SelectOption>) => {
    setSelectedSaleCustomer(selected ? selected.value : '');
  };

  const handleReportCustomerChange = (selected: SingleValue<SelectOption>) => {
    setSelectedReportCustomer(selected ? selected.value : '');
    if (selected) {
      fetchSalesHistory(selected.value);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 p-2 sm:p-4 md:p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-2xl p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Sales Management System
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-1 bg-gray-100 p-1 rounded-xl mb-4 sm:mb-6 md:mb-8">
          {(['customers', 'sales', 'reports'] as const).map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl transition-all duration-200 ${activeTab === tab ? 'bg-white text-teal-600 shadow-md' : 'text-gray-500 hover:text-gray-700'
                }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'customers' && 'Customers'}
              {tab === 'sales' && 'Record Sale'}
              {tab === 'reports' && 'Reports'}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-2xl flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-teal-600"></div>
              <span className="text-sm sm:text-base text-gray-700">Processing...</span>
            </div>
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === 'customers' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-4 sm:p-6 rounded-xl sm:rounded-2xl">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Add New Customer</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                <div>
                  <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-xs sm:text-sm"
                    placeholder="Enter customer name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-xs sm:text-sm"
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Phone</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-xs sm:text-sm"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-xs sm:text-sm"
                    placeholder="Enter address"
                  />
                </div>
              </div>
              <button
                onClick={addCustomer}
                disabled={isLoading}
                className="w-full sm:w-auto bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md"
              >
                {isLoading ? 'Adding...' : 'Add Customer'}
              </button>
            </div>

            {/* Customer List */}
            <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Customer List</h2>
              {customers.length === 0 ? (
                <div className="text-center py-6 sm:py-8 md:py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 mx-auto text-gray-400 mb-3 sm:mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-sm sm:text-base md:text-lg text-gray-500">No customers found. Add a customer above.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-teal-600 to-blue-600 text-white">
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Name</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Email</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Phone</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">{customer.name}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{customer.email || '-'}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{customer.phone || '-'}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{customer.address || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Record Sale Tab */}
        {activeTab === 'sales' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-4 sm:p-6 rounded-xl sm:rounded-2xl">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Record New Sale</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                <div>
                  <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Select Customer *</label>
                  <Select
                    value={
                      customers.find((c) => c.id === selectedSaleCustomer)
                        ? { value: selectedSaleCustomer, label: customers.find((c) => c.id === selectedSaleCustomer)?.name || '' }
                        : null
                    }
                    onChange={handleSaleCustomerChange}
                    options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
                    isSearchable
                    placeholder="Search and select a customer..."
                    classNamePrefix="react-select"
                    className="w-full text-xs sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Sale Date *</label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-xs sm:text-sm"
                    required
                  />
                </div>
              </div>

              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 sm:mb-6">Products</h3>

              {saleItems.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 mb-2 sm:mb-4 p-2 sm:p-4 bg-white rounded-lg sm:rounded-xl border border-gray-200">
                  <div className="md:col-span-5">
                    <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Product</label>
                    <Select
                      value={
                        products.find((p) => p.id === item.productId)
                          ? {
                            value: item.productId,
                            label: `${products.find((p) => p.id === item.productId)?.name || ''} - ${products.find((p) => p.id === item.productId)?.quantity_unit || 'unit'} - ₹${products.find((p) => p.id === item.productId)?.price.toFixed(2) || '0.00'} (Stock: ${products.find((p) => p.id === item.productId)?.quantity || 0}${products.find((p) => p.id === item.productId)?.quantity === 0 ? ' - OUT OF STOCK' : (products.find((p) => p.id === item.productId)?.quantity || 0) <= 5 ? ' - LOW STOCK' : ''})`,
                          }
                          : null
                      }
                      onChange={(selected: SingleValue<SelectOption>) =>
                        updateSaleItem(index, 'productId', selected ? selected.value : '')
                      }
                      options={products.map((product) => ({
                        value: product.id,
                        label: `${product.name} - ${product.quantity_unit || 'unit'} - ₹${product.price.toFixed(2)} (Stock: ${product.quantity}${product.quantity === 0 ? ' - OUT OF STOCK' : product.quantity <= 5 ? ' - LOW STOCK' : ''})`,
                      }))}
                      isOptionDisabled={(option) => {
                        const product = products.find((p) => p.id === option.value);
                        return product ? product.quantity === 0 : false;
                      }}
                      isSearchable
                      placeholder="Search and select a product..."
                      classNamePrefix="react-select"
                      className="w-full text-xs sm:text-sm"
                      isClearable
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateSaleItem(index, 'quantity', Number(e.target.value))}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-xs sm:text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Discount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.discount}
                      onChange={(e) => updateSaleItem(index, 'discount', Number(e.target.value))}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-xs sm:text-sm"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <div className="w-full p-2 sm:p-3 bg-gray-50 rounded-lg sm:rounded-xl">
                      <p className="text-xs sm:text-sm font-semibold text-gray-700">Item Total</p>
                      <p className="text-base sm:text-lg font-bold text-teal-600">
                        ₹{((products.find((p) => p.id === item.productId)?.price || 0) * item.quantity - item.discount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="md:col-span-1 flex items-end justify-center">
                    {saleItems.length > 1 && (
                      <button
                        onClick={() => removeSaleItem(index)}
                        className="p-1 sm:p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg sm:rounded-xl transition-colors"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={addSaleItem}
                className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 mb-4 sm:mb-6"
              >
                <span>➕</span>
                <span>Add Another Product</span>
              </button>

              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 mb-4 sm:mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-xl sm:text-2xl font-bold text-gray-800">Total Price:</span>
                  <span className="text-2xl sm:text-3xl font-bold text-teal-600">₹{totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={recordSale}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md text-xs sm:text-sm"
                >
                  {isLoading ? '🔄 Processing...' : '💾 Record Sale'}
                </button>
                <button
                  onClick={generateSaleReceiptPDF}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md text-xs sm:text-sm"
                >
                  📄 Generate Receipt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-4 sm:p-6 rounded-xl sm:rounded-2xl">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Generate Customer Reports</h2>

              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Select Customer</label>
                <Select
                  value={
                    customers.find((c) => c.id === selectedReportCustomer)
                      ? { value: selectedReportCustomer, label: customers.find((c) => c.id === selectedReportCustomer)?.name || '' }
                      : null
                  }
                  onChange={handleReportCustomerChange}
                  options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
                  isSearchable
                  placeholder="Search and select a customer..."
                  classNamePrefix="react-select"
                  className="w-full text-xs sm:text-sm"
                />
              </div>

              <button
                onClick={generateCustomerReportPDF}
                disabled={isLoading || !selectedReportCustomer}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md text-xs sm:text-sm"
              >
                {isLoading ? '📊 Generating Report...' : '📊 Generate Sales Report'}
              </button>
            </div>

            {salesHistory.length > 0 && (
              <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Sales History</h3>
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-teal-600 to-blue-600 text-white">
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Date</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Product</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Qty</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Price</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {salesHistory.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">
                            {new Date(sale.purchase_date).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{sale.products?.name}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{sale.quantity}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">₹{sale.products?.price.toFixed(2)}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-teal-600">₹{sale.total_price.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
