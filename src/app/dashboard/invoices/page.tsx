'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

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

  useEffect(() => {
    fetchInvoices();
    fetchCompanies();
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
      setFormData({ 
        company_id: '', 
        invoice_number: '', 
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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl p-6 md:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Lakshmi Priya Fertilizers
          </h1>
          <p className="text-gray-600 mt-2">Invoice Management</p>
        </div>

        {/* Add Invoice Form */}
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-6 rounded-2xl mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Invoice</h2>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Company *</label>
              <select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all bg-white"
                required
              >
                <option value="">Choose a company...</option>
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Number *</label>
              <input
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="Enter invoice number"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Total Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                required
              />
            </div>
            
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 w-full"
              >
                {isSubmitting ? "Submitting..." : "💾 Create Invoice"}
              </button>
            </div>
          </form>
        </div>

        {/* Filter Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Filter Invoices</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Company</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
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
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">All Invoices</h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              <span className="ml-2 text-gray-600">Loading invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500">No invoices found. {selectedCompany ? 'Try changing the filter or' : ''} create your first invoice above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-teal-600 to-blue-600 text-white">
                    <th className="px-6 py-4 text-left font-semibold">Invoice #</th>
                    <th className="px-6 py-4 text-left font-semibold">Company</th>
                    <th className="px-6 py-4 text-left font-semibold">Date</th>
                    <th className="px-6 py-4 text-left font-semibold">Amount</th>
                    <th className="px-6 py-4 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">#{invoice.invoice_number}</td>
                      <td className="px-6 py-4 text-gray-600">{invoice.companies?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(invoice.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 font-semibold text-teal-600">₹{invoice.total_amount.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => generateInvoicePDF(invoice)}
                            className="bg-blue-100 text-blue-600 hover:bg-blue-200 px-3 py-1 rounded-lg transition-colors"
                          >
                            📄 PDF
                          </button>
                          <button
                            onClick={() => generateCompanyReportPDF(invoice.company_id)}
                            className="bg-green-100 text-green-600 hover:bg-green-200 px-3 py-1 rounded-lg transition-colors"
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
