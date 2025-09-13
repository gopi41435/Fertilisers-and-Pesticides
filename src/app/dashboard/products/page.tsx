'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { Search, Filter, Package, Edit, Plus, X } from 'lucide-react';

interface Product {
  id: string;
  invoice_id: string;
  name: string;
  category: string;
  price: number;
  discount_price?: number;
  offer_scheme?: string;
  image_url?: string;
  quantity: number;
  quantity_unit?: string;
  expiry_date?: string;
  stock: number;
  invoices?: {
    invoice_number: string;
    companies?: {
      name: string;
    }[];
  };
}

interface Invoice {
  id: string;
  invoice_number: string;
  company_id: string;
  companies: { name: string }[] | null;
}

interface Company {
  id: string;
  name: string;
}

interface FormData {
  invoice_id: string;
  name: string;
  category: string;
  price: string;
  discount_price: string;
  offer_scheme: string;
  quantity: string;
  quantity_unit: string;
  expiry_date: string;
  image: File | null;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState<FormData>({
    invoice_id: '',
    name: '',
    category: 'Insecticide',
    price: '',
    discount_price: '',
    offer_scheme: '',
    quantity: '',
    quantity_unit: '',
    expiry_date: '',
    image: null,
  });
  const [filterCompany, setFilterCompany] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Handle responsive viewport
  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch data from Supabase
  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('products')
        .select('*, invoices!inner(invoice_number, companies(name))')
        .order('name', { ascending: true });

      if (filterCategory) query = query.eq('category', filterCategory);
      if (filterCompany) query = query.eq('invoices.company_id', filterCompany);

      const { data, error } = await query;
      if (error) throw error;

      // Calculate actual stock by considering sales for each product ID
      const productsWithActualStock = await Promise.all(
        (data || []).map(async (product: Product) => {
          const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select('quantity')
            .eq('product_id', product.id);

          if (salesError) throw salesError;

          const totalSold = salesData?.reduce((sum, sale) => sum + sale.quantity, 0) || 0;
          const actualStock = product.quantity - totalSold;

          return {
            ...product,
            stock: actualStock >= 0 ? actualStock : 0, // Ensure stock doesn't go negative
            originalQuantity: product.quantity // Keep original quantity for reference
          };
        })
      );

      // Use product ID as the unique key instead of name to avoid aggregation issues
      setProducts(productsWithActualStock);
    } catch (error) {
      toast.error(`Error fetching products: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [filterCategory, filterCompany]);

  const fetchInvoices = useCallback(async () => {
    try {
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, invoice_number, company_id')
        .order('created_at', { ascending: false });
      
      if (invoicesError) throw invoicesError;

      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name');
      
      if (companiesError) throw companiesError;

      const transformedData = (invoicesData || []).map((invoice) => {
        const company = companiesData?.find(comp => comp.id === invoice.company_id);
        return {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          company_id: invoice.company_id,
          companies: company ? [{ name: company.name }] : null,
        };
      });
      
      setInvoices(transformedData);
    } catch (error) {
      toast.error(`Error fetching invoices: ${(error as Error).message}`);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('companies').select('*');
      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      toast.error(`Error fetching companies: ${(error as Error).message}`);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchInvoices();
    fetchCompanies();
  }, [fetchProducts, fetchInvoices, fetchCompanies]);

  // Form management
  const resetForm = () => {
    setFormData({
      invoice_id: '',
      name: '',
      category: 'Insecticide',
      price: '',
      discount_price: '',
      offer_scheme: '',
      quantity: '',
      quantity_unit: '',
      expiry_date: '',
      image: null,
    });
    setIsEditMode(false);
    setEditingProduct(null);
    setSelectedInvoice(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);

      let imageUrl = editingProduct?.image_url || '';
      
      // Upload image if a new one is selected
      if (formData.image) {
        const fileName = `${Date.now()}-${formData.image.name}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, formData.image);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }

      if (isEditMode && editingProduct) {
        const { error } = await supabase
          .from('products')
          .update({
            invoice_id: formData.invoice_id,
            name: formData.name,
            category: formData.category,
            price: parseFloat(formData.price),
            discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null,
            offer_scheme: formData.offer_scheme || null,
            quantity: parseInt(formData.quantity),
            quantity_unit: formData.quantity_unit || null,
            expiry_date: formData.expiry_date || null,
            image_url: imageUrl || null,
          })
          .eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Product updated successfully');
      } else {
        const existingProduct = products.find(
          (p) => p.name.toLowerCase() === formData.name.toLowerCase() && p.quantity_unit === formData.quantity_unit
        );
        if (existingProduct) {
          const { error } = await supabase
            .from('products')
            .update({ quantity: existingProduct.quantity + parseInt(formData.quantity) })
            .eq('id', existingProduct.id);
          if (error) throw error;
          toast.success('Product stock updated successfully');
        } else {
          const { error } = await supabase.from('products').insert([{
            invoice_id: formData.invoice_id,
            name: formData.name,
            category: formData.category,
            price: parseFloat(formData.price),
            discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null,
            offer_scheme: formData.offer_scheme || null,
            quantity: parseInt(formData.quantity),
            quantity_unit: formData.quantity_unit || null,
            expiry_date: formData.expiry_date || null,
            image_url: imageUrl || null,
          }]);
          if (error) throw error;
          toast.success('Product added successfully');
        }
      }

      fetchProducts();
      resetForm();
    } catch (error) {
      toast.error(`Error saving product: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product: Product) => {
    setIsEditMode(true);
    setEditingProduct(product);
    setShowForm(true);
    setFormData({
      invoice_id: product.invoice_id || '',
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      discount_price: product.discount_price?.toString() || '',
      offer_scheme: product.offer_scheme || '',
      quantity: product.quantity.toString(),
      quantity_unit: product.quantity_unit || '',
      expiry_date: product.expiry_date || '',
      image: null,
    });
  };

  const handleInvoiceSelect = (invoiceId: string) => {
    setFormData({ ...formData, invoice_id: invoiceId });
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    setSelectedInvoice(invoice || null);
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.invoices?.companies?.[0]?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 p-2 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-2xl p-2 sm:p-4 lg:p-6 mb-4 sm:mb-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
              Product Management
            </h1>
            <div className="flex flex-wrap gap-2">
              {isMobileView && !showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              )}
              {isEditMode && (
                <button
                  onClick={resetForm}
                  className="text-xs sm:text-sm text-red-500 underline px-2 py-1"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>

          {/* Form Section */}
          {(!isMobileView || showForm) && (
            <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-2 sm:p-4 rounded-xl sm:rounded-2xl mb-4 sm:mb-6">
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">
                  {isEditMode ? 'Edit Product' : 'Add New Product'}
                </h2>
                {isMobileView && (
                  <button
                    onClick={() => setShowForm(false)}
                    className="p-1 sm:p-2 hover:bg-gray-200 rounded-lg"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
              </div>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                    Select Invoice
                  </label>
                  <select
                    value={formData.invoice_id}
                    onChange={(e) => handleInvoiceSelect(e.target.value)}
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                  >
                    <option value="">Search and select an invoice...</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_number} - {inv.companies && inv.companies.length > 0 ? inv.companies[0].name : 'Unknown'}
                      </option>
                    ))}
                  </select>
                  {selectedInvoice && (
                    <div className="mt-1 sm:mt-2 p-1 sm:p-2 bg-blue-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-blue-700">
                        Selected: {selectedInvoice.invoice_number} from {selectedInvoice.companies && selectedInvoice.companies.length > 0 ? selectedInvoice.companies[0].name : 'Unknown'}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                    required
                  >
                    <option value="Insecticide">Insecticide</option>
                    <option value="Herbicide">Herbicide</option>
                    <option value="Fungicide">Fungicide</option>
                    <option value="Growth Promoter">Growth Promoter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter product name"
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="Enter quantity"
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                    Quantity Unit
                  </label>
                  <select
                    value={formData.quantity_unit}
                    onChange={(e) => setFormData({ ...formData, quantity_unit: e.target.value })}
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                  >
                    <option value="">Select unit...</option>
                    <option value="8g">8 g</option>
                    <option value="100ml">100 ml</option>
                    <option value="200ml">200 ml</option>
                    <option value="250ml">250 ml</option>
                    <option value="300ml">300 ml</option>
                    <option value="500ml">500 ml</option>
                    <option value="1L">1 Litre</option>
                    <option value="2kg">2 kg</option>
                    <option value="2.5kg">2.5 kg</option>
                    <option value="5kg">5 kg</option>
                    <option value="100g">100 g</option>
                    <option value="500g">500 g</option>
                    <option value="1kg">1 kg</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                    Discount Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discount_price}
                    onChange={(e) => setFormData({ ...formData, discount_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                    Offer Scheme
                  </label>
                  <input
                    type="text"
                    value={formData.offer_scheme}
                    onChange={(e) => setFormData({ ...formData, offer_scheme: e.target.value })}
                    placeholder="Enter offer scheme"
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                    Expiry Date
                  </label>
                    <input
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                    />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                    Product Image
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setFormData({ ...formData, image: e.target.files?.[0] || null })}
                    className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                    accept="image/*"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md disabled:opacity-50 text-xs sm:text-sm"
                  >
                    {isSubmitting ? (isEditMode ? 'Updating...' : 'Adding...') : isEditMode ? 'Update Product' : 'Add Product'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Products List */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-2 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">All Products</h2>
              {isMobileView && (
                <button
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-2 bg-gray-100 rounded-lg text-xs sm:text-sm"
                >
                  <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Filters
                </button>
              )}
              <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-1 sm:px-2 py-1 rounded-full">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-4 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                />
              </div>

              <div className={`flex flex-col sm:flex-row gap-2 sm:gap-4 ${isMobileView && !showMobileFilters ? 'hidden' : ''}`}>
                <select
                  value={filterCompany}
                  onChange={(e) => setFilterCompany(e.target.value)}
                  className="px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                >
                  <option value="">All Companies</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>{comp.name}</option>
                  ))}
                </select>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                >
                  <option value="">All Categories</option>
                  <option value="Insecticide">Insecticide</option>
                  <option value="Herbicide">Herbicide</option>
                  <option value="Fungicide">Fungicide</option>
                  <option value="Growth Promoter">Growth Promoter</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-6 sm:py-12">
                <div className="animate-spin rounded-full w-6 h-6 sm:w-8 sm:h-8 border-2 border-teal-600"></div>
                <span className="ml-2 text-xs sm:text-sm text-gray-600">Loading products...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-6 sm:py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <Package className="w-8 sm:w-12 h-8 sm:h-12 mx-auto mb-2 sm:mb-4 text-gray-300" />
                <p className="text-xs sm:text-sm text-gray-500">No products found. Add your first product above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`bg-white border rounded-lg sm:rounded-xl p-2 sm:p-3 hover:shadow-lg transition-all ${product.stock === 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 hover:border-teal-300'
                      }`}
                  >
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        width={300}
                        height={200}
                        className="w-full h-110 sm:h-32 lg:h-40 object-cover mb-1 sm:mb-2 rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-24 sm:h-32 lg:h-40 bg-gray-200 flex items-center justify-center mb-1 sm:mb-2 rounded-lg">
                        <Package className="w-5 sm:w-6 h-5 sm:h-6 text-gray-400" />
                      </div>
                    )}
                    <h3 className="font-bold text-xs sm:text-sm lg:text-base text-gray-800 mb-1 sm:mb-2 line-clamp-2">
                      {product.name}
                    </h3>
                    <div className="space-y-1 text-xs sm:text-sm text-gray-600 mb-2">
                      <p><span className="font-semibold">Category:</span> {product.category}</p>
                      <p><span className="font-semibold">Price:</span> ₹{product.price.toFixed(2)}</p>
                      {product.discount_price && <p><span className="font-semibold">Discount:</span> ₹{product.discount_price.toFixed(2)}</p>}
                      {product.offer_scheme && <p className="truncate"><span className="font-semibold">Scheme:</span> {product.offer_scheme}</p>}
                      <p><span className="font-semibold">Unit:</span> {product.quantity_unit || 'N/A'}</p>
                      <p className={product.quantity === 0 ? 'text-red-600 font-bold' : product.quantity < 10 ? 'text-orange-600 font-bold' : 'text-green-600 font-bold'}>
                        <span className="font-semibold">Stock:</span> {product.quantity}  
                      </p>
                      {product.expiry_date && <p><span className="font-semibold">Expiry:</span> {new Date(product.expiry_date).toLocaleDateString('en-IN')}</p>}
                      {product.invoices?.companies?.[0]?.name && <p className="truncate"><span className="font-semibold">Supplier:</span> {product.invoices.companies[0].name}</p>}
                    </div>
                    <button
                      onClick={() => handleEdit(product)}
                      className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-1 sm:py-2 px-2 sm:px-3 rounded-lg transition-all duration-200 hover:scale-105 shadow-sm text-xs sm:text-sm flex items-center justify-center gap-1"
                    >
                      <Edit className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Form Overlay */}
        {isMobileView && showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-2 sm:p-4 flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                  {isEditMode ? 'Edit Product' : 'Add Product'}
                </h3>
                <button onClick={resetForm} className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
              <div className="p-2 sm:p-4">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-2 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Select Invoice
                    </label>
                    <select
                      value={formData.invoice_id}
                      onChange={(e) => handleInvoiceSelect(e.target.value)}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                    >
                      <option value="">Search and select an invoice...</option>
                      {invoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} - {inv.companies && inv.companies.length > 0 ? inv.companies[0].name : 'Unknown'}
                        </option>
                      ))}
                    </select>
                    {selectedInvoice && (
                      <div className="mt-1 sm:mt-2 p-1 sm:p-2 bg-blue-50 rounded-lg">
                        <p className="text-xs sm:text-sm text-blue-700">
                          Selected: {selectedInvoice.invoice_number} from {selectedInvoice.companies && selectedInvoice.companies.length > 0 ? selectedInvoice.companies[0].name : 'Unknown'}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                      required
                    >
                      <option value="Insecticide">Insecticide</option>
                      <option value="Herbicide">Herbicide</option>
                      <option value="Fungicide">Fungicide</option>
                      <option value="Growth Promoter">Growth Promoter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter product name"
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="Enter quantity"
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Quantity Unit
                    </label>
                    <select
                      value={formData.quantity_unit}
                      onChange={(e) => setFormData({ ...formData, quantity_unit: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                    >
                      <option value="">Select unit...</option>
                      <option value="8g">8 g</option>
                      <option value="100ml">100 ml</option>
                      <option value="200ml">200 ml</option>
                      <option value="250ml">250 ml</option>
                      <option value="300ml">300 ml</option>
                      <option value="500ml">500 ml</option>
                      <option value="1L">1 Litre</option>
                      <option value="2kg">2 kg</option>
                      <option value="2.5kg">2.5 kg</option>
                      <option value="5kg">5 kg</option>
                      <option value="100g">100 g</option>
                      <option value="500g">500 g</option>
                      <option value="1kg">1 kg</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Discount Price (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.discount_price}
                      onChange={(e) => setFormData({ ...formData, discount_price: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Offer Scheme
                    </label>
                    <input
                      type="text"
                      value={formData.offer_scheme}
                      onChange={(e) => setFormData({ ...formData, offer_scheme: e.target.value })}
                      placeholder="Enter offer scheme"
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                      Product Image
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setFormData({ ...formData, image: e.target.files?.[0] || null })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-xs sm:text-sm"
                      accept="image/*"
                    />
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105 shadow-md disabled:opacity-50 text-xs sm:text-sm"
                    >
                      {isSubmitting ? (isEditMode ? 'Updating...' : 'Adding...') : isEditMode ? 'Update Product' : 'Add Product'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
