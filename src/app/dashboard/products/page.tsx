'use client';
import { useState, useEffect, useCallback } from 'react'; 
import Image from 'next/image';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { PostgrestError } from '@supabase/supabase-js';

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
    };
  };
}

interface Invoice {
  id: string;
  invoice_number: string;
  company_id: string;
  companies?: {
    name: string;
  };
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

  // For Editing
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('products')
        .select('*, invoices!inner(*, companies(*))')
        .order('name', { ascending: true });

      if (filterCategory) query = query.eq('category', filterCategory);
      if (filterCompany) query = query.eq('invoices.company_id', filterCompany);

      const { data, error } = await query;
      if (error) throw error;

      // Group products by name and calculate total stock
      const productMap = new Map();
      (data || []).forEach((product: Product) => {
        if (productMap.has(product.name)) {
          const existing = productMap.get(product.name);
          productMap.set(product.name, {
            ...existing,
            stock: existing.stock + product.quantity,
            price: Math.min(existing.price, product.price),
          });
        } else {
          productMap.set(product.name, {
            ...product,
            stock: product.quantity,
          });
        }
      });

      setProducts(Array.from(productMap.values()));
    } catch (error: unknown) {
      toast.error(`Error fetching products: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [filterCategory, filterCompany]);

  const fetchInvoices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, company_id, companies!inner(name)')
        .order('created_at', { ascending: false }) as {
        data: Invoice[] | null;
        error: PostgrestError | null;
      };
      if (error) throw error;
      setInvoices(data || []);
    } catch (error: unknown) {
      toast.error(`Error fetching invoices: ${(error as Error).message}`);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('companies').select('*');
      if (error) throw error;
      setCompanies(data || []);
    } catch (error: unknown) {
      toast.error(`Error fetching companies: ${(error as Error).message}`);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchInvoices();
    fetchCompanies();
  }, [fetchProducts, fetchInvoices, fetchCompanies]);

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);

      const existingProduct = products.find(
        (p) =>
          p.name.toLowerCase() === formData.name.toLowerCase() &&
          p.quantity_unit === formData.quantity_unit
      );

      let imageUrl = editingProduct?.image_url || '';

      if (formData.image) {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(`${Date.now()}-${formData.image.name}`, formData.image, {
            upsert: true,
          });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage
          .from('product-images')
          .getPublicUrl(uploadData.path).data.publicUrl;
      }

      if (isEditMode && editingProduct) {
        const { error } = await supabase
          .from('products')
          .update({
            invoice_id: formData.invoice_id,
            name: formData.name,
            category: formData.category,
            price: parseFloat(formData.price),
            discount_price: formData.discount_price
              ? parseFloat(formData.discount_price)
              : null,
            offer_scheme: formData.offer_scheme || null,
            quantity: parseInt(formData.quantity),
            quantity_unit: formData.quantity_unit || null,
            expiry_date: formData.expiry_date || null,
            image_url: imageUrl || null,
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('Product updated successfully');
      } else if (existingProduct && !isEditMode) {
        const { error } = await supabase
          .from('products')
          .update({
            quantity: existingProduct.quantity + parseInt(formData.quantity),
          })
          .eq('id', existingProduct.id);

        if (error) throw error;
        toast.success('Product stock updated successfully');
      } else {
        const { error } = await supabase.from('products').insert([
          {
            invoice_id: formData.invoice_id,
            name: formData.name,
            category: formData.category,
            price: parseFloat(formData.price),
            discount_price: formData.discount_price
              ? parseFloat(formData.discount_price)
              : null,
            offer_scheme: formData.offer_scheme || null,
            quantity: parseInt(formData.quantity),
            quantity_unit: formData.quantity_unit || null,
            expiry_date: formData.expiry_date || null,
            image_url: imageUrl || null,
          },
        ]);
        if (error) throw error;
        toast.success('Product added successfully');
      }

      fetchProducts();
      resetForm();
    } catch (error: unknown) {
      toast.error(`Error saving product: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product: Product) => {
    setIsEditMode(true);
    setEditingProduct(product);
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

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.invoices?.companies?.name || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl p-6 md:p-8">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Product Management
          </h1>
          {isEditMode && (
            <button
              onClick={resetForm}
              className="text-sm text-red-500 underline"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-6 rounded-2xl mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {isEditMode ? 'Edit Product' : 'Add New Product'}
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
          >
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Invoice
              </label>
              <select
                value={formData.invoice_id}
                onChange={(e) => handleInvoiceSelect(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all bg-white"
              >
                <option value="">Search and select an invoice...</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} - {inv.companies?.name || 'Unknown'}
                  </option>
                ))}
              </select>
              {selectedInvoice && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    Selected: {selectedInvoice.invoice_number} from{' '}
                    {selectedInvoice.companies?.name}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                required
              >
                <option value="Insecticide">Insecticide</option>
                <option value="Herbicide">Herbicide</option>
                <option value="Fungicide">Fungicide</option>
                <option value="Growth Promoter">Growth Promoter</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
                placeholder="Enter quantity"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Product Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter product name"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Price (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Quantity Unit
              </label>
              <select
                value={formData.quantity_unit}
                onChange={(e) =>
                  setFormData({ ...formData, quantity_unit: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Discount Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.discount_price}
                onChange={(e) =>
                  setFormData({ ...formData, discount_price: e.target.value })
                }
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Offer Scheme
              </label>
              <input
                type="text"
                value={formData.offer_scheme}
                onChange={(e) =>
                  setFormData({ ...formData, offer_scheme: e.target.value })
                }
                placeholder="Enter offer scheme"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Expiry Date
              </label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) =>
                  setFormData({ ...formData, expiry_date: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Product Image
              </label>
              <input
                type="file"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    image: e.target.files?.[0] || null,
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                accept="image/*"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 w-full"
              >
                {isSubmitting
                  ? isEditMode
                    ? 'Updating...'
                    : 'Adding...'
                  : isEditMode
                  ? '✏️ Update Product'
                  : '➕ Add Product'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-2xl font-bold text-gray-800">All Products</h2>

            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />

              <div className="flex gap-2">
                <select
                  value={filterCompany}
                  onChange={(e) => setFilterCompany(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">All Companies</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  <option value="Insecticide">Insecticide</option>
                  <option value="Herbicide">Herbicide</option>
                  <option value="Fungicide">Fungicide</option>
                  <option value="Growth Promoter">Growth Promoter</option>
                </select>
              </div>
            </div>

            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {filteredProducts.length}{' '}
              {filteredProducts.length === 1 ? 'product' : 'products'}
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              <span className="ml-2 text-gray-600">Loading products...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500">
                No products found. Add your first product above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={`bg-white border rounded-2xl p-4 hover:shadow-lg transition-shadow ${
                    product.stock === 0
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200'
                  }`}
                >
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      width={300}
                      height={200}
                      className="w-full h-48 object-cover mb-4 rounded-xl"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center mb-4 rounded-xl">
                      <span className="text-gray-500">No Image</span>
                    </div>
                  )}

                  <h3 className="font-bold text-lg text-gray-800 mb-2">
                    {product.name}
                  </h3>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="font-semibold">Category:</span>{' '}
                      {product.category}
                    </p>
                    <p>
                      <span className="font-semibold">Price:</span> ₹
                      {product.price.toFixed(2)}
                    </p>
                    {product.discount_price && (
                      <p>
                        <span className="font-semibold">Discount Price:</span> ₹
                        {product.discount_price.toFixed(2)}
                      </p>
                    )}
                    {product.offer_scheme && (
                      <p>
                        <span className="font-semibold">Scheme:</span>{' '}
                        {product.offer_scheme}
                      </p>
                    )}
                    <p>
                      <span className="font-semibold">Unit:</span>{' '}
                      {product.quantity_unit || 'N/A'}
                    </p>
                    <p
                      className={
                        product.stock === 0
                          ? 'text-red-600 font-bold'
                          : 'text-green-600 font-bold'
                      }
                    >
                      <span className="font-semibold">Stock:</span>{' '}
                      {product.stock} {product.quantity_unit || ''}
                    </p>
                    {product.expiry_date && (
                      <p>
                        <span className="font-semibold">Expiry:</span>{' '}
                        {new Date(product.expiry_date).toLocaleDateString(
                          'en-IN'
                        )}
                      </p>
                    )}
                    {product.invoices?.companies?.name && (
                      <p>
                        <span className="font-semibold">Supplier:</span>{' '}
                        {product.invoices.companies.name}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleEdit(product)}
                    className="mt-4 w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-xl transition-all"
                  >
                    ✏️ Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
