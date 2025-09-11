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

interface Company {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  date: string;
  total_amount: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  quantity_unit?: string;
}

interface ReturnItem {
  productId: string;
  quantity: number;
  discount: number;
}

interface ReturnRecord {
  id: string;
  company_id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  discount_price: number;
  return_date: string;
  products: Product;
  companies: Company;
}

interface ReturnsByDate {
  [date: string]: {
    items: ReturnRecord[];
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

export default function ReturnsPage() {
  const [activeTab, setActiveTab] = useState<'returns' | 'reports'>('returns');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [returnsHistory, setReturnsHistory] = useState<ReturnRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Separate company selection states
  const [selectedReturnCompany, setSelectedReturnCompany] = useState<string>('');
  const [selectedReportCompany, setSelectedReportCompany] = useState<string>('');

  const [selectedInvoice, setSelectedInvoice] = useState<string>('');
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([{ productId: '', quantity: 1, discount: 0 }]);
  const [totalPrice, setTotalPrice] = useState<number>(0);

  const fetchCompanies = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from('companies').select('*').order('name', { ascending: true });
      if (error) throw error;
      setCompanies(data || []);
    } catch (error: unknown) {
      toast.error(`Error fetching companies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchInvoicesForCompany = useCallback(async (companyId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .order('date', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (error: unknown) {
      toast.error(`Error fetching invoices: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const fetchReturnsHistory = useCallback(async (companyId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          products (id, name, price, quantity, quantity_unit),
          companies (id, name)
        `)
        .eq('company_id', companyId)
        .order('return_date', { ascending: false });
      if (error) throw error;
      setReturnsHistory(data || []);
    } catch (error: unknown) {
      toast.error(`Error fetching returns: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load initial data when component mounts
  useEffect(() => {
    fetchCompanies();
    fetchProducts();
  }, [fetchCompanies, fetchProducts]);

  const calculateTotalPrice = useCallback(() => {
    let total = 0;
    returnItems.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product && item.productId) {
        total += product.price * item.quantity - item.discount;
      }
    });
    setTotalPrice(total);
  }, [returnItems, products]);

  useEffect(() => {
    calculateTotalPrice();
  }, [calculateTotalPrice]);

  const addReturnItem = () => {
    setReturnItems([...returnItems, { productId: '', quantity: 1, discount: 0 }]);
  };

  const updateReturnItem = (index: number, field: keyof ReturnItem, value: string | number) => {
    const updatedItems = [...returnItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setReturnItems(updatedItems);
  };

  const removeReturnItem = (index: number) => {
    if (returnItems.length > 1) {
      const updatedItems = [...returnItems];
      updatedItems.splice(index, 1);
      setReturnItems(updatedItems);
    }
  };

  const recordReturn = async () => {
    if (!selectedReturnCompany) {
      toast.error('Please select a company');
      return;
    }
    if (!selectedInvoice) {
      toast.error('Please select an invoice');
      return;
    }

    const validItems = returnItems.filter((item) => item.productId);
    if (validItems.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    try {
      setIsLoading(true);

      // Check stock availability for all items (since returning, quantity <= current stock)
      for (const item of validItems) {
        const product = products.find((p) => p.id === item.productId);
        if (product && item.quantity > product.quantity) {
          toast.error(`Not enough stock to return for ${product.name}. Available: ${product.quantity}`);
          return;
        }
      }

      const returnData = validItems.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        const totalPrice = product ? product.price * item.quantity - item.discount : 0;

        return {
          company_id: selectedReturnCompany,
          invoice_id: selectedInvoice,
          product_id: item.productId,
          quantity: item.quantity,
          total_price: totalPrice,
          discount_price: item.discount || null,
          return_date: returnDate,
        };
      });

      // Update product quantities (decrease since returning to supplier)
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

      const { error } = await supabase.from('returns').insert(returnData);
      if (error) throw error;

      // Refresh products to get updated quantities
      await fetchProducts();

      toast.success('Return recorded successfully!');
      setReturnItems([{ productId: '', quantity: 1, discount: 0 }]);
      setSelectedReturnCompany('');
      setSelectedInvoice('');
    } catch (error: unknown) {
      toast.error(`Error recording return: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const generateReturnReceiptPDF = () => {
    if (!selectedReturnCompany) {
      toast.error('Please select a company to generate a receipt');
      return;
    }

    const validItems = returnItems.filter((item) => item.productId);
    if (validItems.length === 0) {
      toast.error('Please select at least one product to generate PDF');
      return;
    }

    const company = companies.find((c) => c.id === selectedReturnCompany);
    if (!company) return;

    const doc = new jsPDF() as JSPDFWithAutoTable;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 118, 110);
    doc.text('LAKSHMI PRIYA FERTILISERS', 105, 20, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('RETURN RECEIPT', 105, 30, { align: 'center' });

    // Return Date
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(returnDate).toLocaleDateString('en-IN')}`, 14, 45);

    // Company Info
    doc.setFont('helvetica', 'bold');
    doc.text('Company Details:', 14, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${company.name}`, 14, 62);

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

    doc.save(`${company.name}_return_${returnDate}.pdf`);
  };

  const generateCompanyReportPDF = async () => {
    if (!selectedReportCompany) {
      toast.error('Please select a company to generate a report');
      return;
    }

    const company = companies.find((c) => c.id === selectedReportCompany);
    if (!company) return;

    try {
      setIsLoading(true);
      await fetchReturnsHistory(selectedReportCompany);

      const doc = new jsPDF() as JSPDFWithAutoTable;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(15, 118, 110);
      doc.text('LAKSHMI PRIYA FERTILISERS', 105, 20, { align: 'center' });

      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('COMPANY RETURN REPORT', 105, 30, { align: 'center' });

      // Report Date
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Report Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 45);

      // Company Info
      doc.setFont('helvetica', 'bold');
      doc.text('Company Details:', 14, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${company.name}`, 14, 62);

      if (returnsHistory.length > 0) {
        // Group returns by date and calculate totals
        const returnsByDate: ReturnsByDate = {};

        returnsHistory.forEach((ret) => {
          if (!returnsByDate[ret.return_date]) {
            returnsByDate[ret.return_date] = { items: [], total: 0 };
          }
          returnsByDate[ret.return_date].items.push(ret);
          returnsByDate[ret.return_date].total += ret.total_price;
        });

        let currentY = 95;

        // Create a summary table with SNO, DATE, Number Of Items, Total Returns
        const summaryHeaders = [['SNO', 'DATE', 'NUMBER OF ITEMS', 'TOTAL RETURNS']];
        const summaryRows = Object.entries(returnsByDate).map(([date], index) => [
          (index + 1).toString(),
          new Date(date).toLocaleDateString('en-IN'),
          returnsByDate[date].items.length.toString(),
          `₹${returnsByDate[date].total.toFixed(2)}`,
        ]);

        doc.setFont('helvetica', 'bold');
        doc.text('RETURNS SUMMARY', 14, currentY);
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
        const grandTotal = returnsHistory.reduce((total, ret) => total + ret.total_price, 0);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 118, 110);
        doc.text(`GRAND TOTAL: ₹${grandTotal.toFixed(2)}`, 14, currentY);
        currentY += 15;

        // Detailed returns for each date
        Object.entries(returnsByDate).forEach(([date, data]) => {
          if (currentY > 200) {
            doc.addPage();
            currentY = 20;
          }

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text(`DETAILED RETURNS FOR ${new Date(date).toLocaleDateString('en-IN')}`, 14, currentY);
          currentY += 10;

          const detailHeaders = [['PRODUCT', 'QUANTITY', 'PRICE', 'DISCOUNT', 'TOTAL']];
          const detailRows = data.items.map((ret) => [
            ret.products?.name || 'Unknown Product',
            ret.quantity.toString(),
            `₹${ret.products?.price?.toFixed(2) || '0.00'}`,
            `₹${(ret.discount_price || 0).toFixed(2)}`,
            `₹${ret.total_price.toFixed(2)}`,
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
        doc.text('No returns records found for this company.', 14, 95);
      }

      doc.save(`${company.name}_returns_report.pdf`);
    } catch (error: unknown) {
      toast.error(`Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fixed onChange handlers for Select components
  const handleReturnCompanyChange = (selected: SingleValue<SelectOption>) => {
    const companyId = selected ? selected.value : '';
    setSelectedReturnCompany(companyId);
    setSelectedInvoice('');
    if (companyId) {
      fetchInvoicesForCompany(companyId);
    } else {
      setInvoices([]);
    }
  };

  const handleReportCompanyChange = (selected: SingleValue<SelectOption>) => {
    const companyId = selected ? selected.value : '';
    setSelectedReportCompany(companyId);
    if (companyId) {
      fetchReturnsHistory(companyId);
    }
  };

  const handleInvoiceChange = (selected: SingleValue<SelectOption>) => {
    setSelectedInvoice(selected ? selected.value : '');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 p-2 sm:p-4 md:p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-2xl p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Returns Management System
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-1 bg-gray-100 p-1 rounded-xl mb-4 sm:mb-6 md:mb-8">
          {(['returns', 'reports'] as const).map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl transition-all duration-200 ${
                activeTab === tab ? 'bg-white text-teal-600 shadow-md' : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'returns' && 'Record Return'}
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

        {/* Record Return Tab */}
        {activeTab === 'returns' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-4 sm:p-6 rounded-xl sm:rounded-2xl">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Record New Return</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
                <div>
                  <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Select Company *</label>
                  <Select
                    value={
                      companies.find((c) => c.id === selectedReturnCompany)
                        ? { value: selectedReturnCompany, label: companies.find((c) => c.id === selectedReturnCompany)?.name || '' }
                        : null
                    }
                    onChange={handleReturnCompanyChange}
                    options={companies.map((company) => ({ value: company.id, label: company.name }))}
                    isSearchable
                    placeholder="Search and select a company..."
                    classNamePrefix="react-select"
                    className="w-full text-xs sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Select Invoice *</label>
                  <Select
                    value={
                      invoices.find((i) => i.id === selectedInvoice)
                        ? { value: selectedInvoice, label: invoices.find((i) => i.id === selectedInvoice)?.invoice_number || '' }
                        : null
                    }
                    onChange={handleInvoiceChange}
                    options={invoices.map((invoice) => ({ value: invoice.id, label: `${invoice.invoice_number} (${new Date(invoice.date).toLocaleDateString()})` }))}
                    isSearchable
                    placeholder="Search and select an invoice..."
                    classNamePrefix="react-select"
                    className="w-full text-xs sm:text-sm"
                    isDisabled={!selectedReturnCompany}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Return Date *</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-xs sm:text-sm"
                    required
                  />
                </div>
              </div>

              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 sm:mb-6">Products</h3>

              {returnItems.map((item, index) => (
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
                        updateReturnItem(index, 'productId', selected ? selected.value : '')
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
                      onChange={(e) => updateReturnItem(index, 'quantity', Number(e.target.value))}
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
                      onChange={(e) => updateReturnItem(index, 'discount', Number(e.target.value))}
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
                    {returnItems.length > 1 && (
                      <button
                        onClick={() => removeReturnItem(index)}
                        className="p-1 sm:p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg sm:rounded-xl transition-colors"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={addReturnItem}
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
                  onClick={recordReturn}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md text-xs sm:text-sm"
                >
                  {isLoading ? '🔄 Processing...' : '💾 Record Return'}
                </button>
                <button
                  onClick={generateReturnReceiptPDF}
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
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Generate Company Reports</h2>

              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Select Company</label>
                <Select
                  value={
                    companies.find((c) => c.id === selectedReportCompany)
                      ? { value: selectedReportCompany, label: companies.find((c) => c.id === selectedReportCompany)?.name || '' }
                      : null
                  }
                  onChange={handleReportCompanyChange}
                  options={companies.map((company) => ({ value: company.id, label: company.name }))}
                  isSearchable
                  placeholder="Search and select a company..."
                  classNamePrefix="react-select"
                  className="w-full text-xs sm:text-sm"
                />
              </div>

              <button
                onClick={generateCompanyReportPDF}
                disabled={isLoading || !selectedReportCompany}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md text-xs sm:text-sm"
              >
                {isLoading ? '📊 Generating Report...' : '📊 Generate Returns Report'}
              </button>
            </div>

            {returnsHistory.length > 0 && (
              <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Returns History</h3>
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
                      {returnsHistory.map((ret) => (
                        <tr key={ret.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">
                            {new Date(ret.return_date).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{ret.products?.name}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{ret.quantity}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">₹{ret.products?.price.toFixed(2)}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-teal-600">₹{ret.total_price.toFixed(2)}</td>
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
