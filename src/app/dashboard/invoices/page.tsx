'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import Select from 'react-select';

interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  date: string;
  total_amount: number;
  companies?: {
    name: string;
  };
}

interface Company {
  id: string;
  name: string;
}

interface JSPDFWithAutoTable extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({
    company_id: '',
    invoice_number: '',
    date: '',
    total_amount: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');

  const fetchInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('invoices')
        .select(`
          *,
          companies (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (selectedCompany) {
        query = query.eq('company_id', selectedCompany);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error fetching invoices: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompany]);

  const fetchCompanies = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error fetching companies: ${message}`);
    }
  }, []);

  const getNextInvoiceNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_number')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data.length === 0) return '001';

      const lastNumber = parseInt(data[0].invoice_number, 10);
      return (lastNumber + 1).toString().padStart(3, '0');
    } catch (error) {
      toast.error('Error generating invoice number');
      return '001';
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await fetchCompanies();
      await fetchInvoices();
      const nextNumber = await getNextInvoiceNumber();
      setFormData(prev => ({ ...prev, invoice_number: nextNumber }));
    };
    initialize();
  }, [fetchInvoices, fetchCompanies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.company_id || !formData.invoice_number || !formData.date || !formData.total_amount) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('invoices')
        .insert([{
          ...formData,
          total_amount: parseFloat(formData.total_amount),
        }]);

      if (error) throw error;

      toast.success('Invoice added successfully');
      fetchInvoices();
      const nextNumber = await getNextInvoiceNumber();
      setFormData({
        company_id: '',
        invoice_number: nextNumber,
        date: '',
        total_amount: ''
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error adding invoice: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateInvoicePDF = (invoice: Invoice) => {
    const doc = new jsPDF() as JSPDFWithAutoTable;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 118, 110);
    doc.text("LAKSHMI PRIYA FERTILISERS", 105, 20, { align: "center" });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("INVOICE", 105, 30, { align: "center" });

    // Invoice details
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice Number: ${invoice.invoice_number}`, 20, 50);
    doc.text(`Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}`, 20, 60);
    doc.text(`Company: ${invoice.companies?.name || 'Unknown'}`, 20, 70);
    doc.text(`Total Amount: ₹${invoice.total_amount.toFixed(2)}`, 20, 80);

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Thank you for your business!", 105, 280, { align: "center" });

    doc.save(`invoice-${invoice.invoice_number}.pdf`);
  };

  const generateCompanyReportPDF = async (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;

    setIsLoading(true);
    try {
      const { data: companyInvoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .order('date', { ascending: false });

      if (error) throw error;

      const doc = new jsPDF() as JSPDFWithAutoTable;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(15, 118, 110);
      doc.text("LAKSHMI PRIYA FERTILISERS", 105, 20, { align: "center" });

      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("COMPANY INVOICE REPORT", 105, 30, { align: "center" });

      // Company Info
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Company: ${company.name}`, 20, 50);
      doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN')}`, 20, 60);
      doc.text(`Total Invoices: ${companyInvoices?.length || 0}`, 20, 70);

      if (companyInvoices && companyInvoices.length > 0) {
        // Summary table
        const totalAmount = companyInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);

        doc.setFont("helvetica", "bold");
        doc.text("SUMMARY", 20, 90);

        autoTable(doc, {
          startY: 95,
          head: [['Total Invoices', 'Total Amount']],
          body: [[companyInvoices.length, `₹${totalAmount.toFixed(2)}`]],
          theme: 'grid',
          headStyles: {
            fillColor: [15, 118, 110],
            textColor: 255,
            fontStyle: 'bold'
          },
        });

        // Detailed invoices table
        if (doc.lastAutoTable.finalY + 50 < doc.internal.pageSize.height) {
          doc.setFont("helvetica", "bold");
          doc.text("INVOICE DETAILS", 20, doc.lastAutoTable.finalY + 15);
        } else {
          doc.addPage();
          doc.setFont("helvetica", "bold");
          doc.text("INVOICE DETAILS", 20, 20);
        }

        const invoiceHeaders = [['Invoice #', 'Date', 'Amount']];
        const invoiceRows = companyInvoices.map(inv => [
          inv.invoice_number,
          new Date(inv.date).toLocaleDateString('en-IN'),
          `₹${inv.total_amount.toFixed(2)}`
        ]);

        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 5,
          head: invoiceHeaders,
          body: invoiceRows,
          theme: 'grid',
          headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontStyle: 'bold'
          },
        });
      } else {
        doc.text("No invoices found for this company.", 20, 90);
      }

      doc.save(`${company.name}-invoice-report.pdf`);
    } catch (error) {
      toast.error('Error generating report');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 p-2 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-2xl p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Invoice Management
          </h1>
        </div>

        {/* Add Invoice Form */}
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-4 sm:mb-6 md:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Create New Invoice</h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div>
              <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Company *</label>
              <Select
                value={companies.find(c => c.id === formData.company_id) ? { value: formData.company_id, label: companies.find(c => c.id === formData.company_id)?.name } : null}
                onChange={(selected) => setFormData({ ...formData, company_id: selected ? selected.value : '' })}
                options={companies.map(comp => ({ value: comp.id, label: comp.name }))}
                isSearchable
                placeholder="Search and select a company..."
                classNamePrefix="react-select"
                className="w-full text-xs sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Invoice Number (Auto-generated)</label>
              <input
                type="text"
                value={formData.invoice_number}
                readOnly
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl bg-gray-100 cursor-not-allowed text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-xs sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Total Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-xs sm:text-sm"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105 shadow-md disabled:opacity-50 text-xs sm:text-sm"
              >
                {isSubmitting ? "Submitting..." : "💾 Create Invoice"}
              </button>
            </div>
          </form>
        </div>

        {/* Filter Section */}
        <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 mb-4 sm:mb-6 md:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">Filter Invoices</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm md:text-sm font-semibold text-gray-700 mb-2">Filter by Company</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-xs sm:text-sm"
              >
                <option value="">All Companies</option>
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => fetchInvoices()}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105 shadow-lg text-xs sm:text-sm"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">All Invoices</h2>
            <span className="text-xs sm:text-sm md:text-sm text-gray-500 bg-gray-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full mt-2 sm:mt-0">
              {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-6 sm:py-8 md:py-12">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 border-b-2 border-teal-600"></div>
              <span className="ml-2 text-sm sm:text-base md:text-lg text-gray-600">Loading invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-6 sm:py-8 md:py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 mx-auto text-gray-400 mb-3 sm:mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm sm:text-base md:text-lg text-gray-500">No invoices found. {selectedCompany ? 'Try changing the filter or' : ''} create your first invoice above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gradient-to-r from-teal-600 to-blue-600 text-white">
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Invoice #</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Company</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Date</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Amount</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">#{invoice.invoice_number}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{invoice.companies?.name || 'Unknown'}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                        {new Date(invoice.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-teal-600 whitespace-nowrap">₹{invoice.total_amount.toFixed(2)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                          <button
                            onClick={() => generateInvoicePDF(invoice)}
                            className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors w-full sm:w-auto text-xs sm:text-sm"
                          >
                            📄 PDF
                          </button>
                          <button
                            onClick={() => generateCompanyReportPDF(invoice.company_id)}
                            className="bg-green-100 text-green-600 hover:bg-green-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors w-full sm:w-auto text-xs sm:text-sm"
                          >
                            📊 Report
                          </button>
                        </div>
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
