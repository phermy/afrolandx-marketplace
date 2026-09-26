import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import Navbar from '@/components/navbar';
import ProductCard from '@/components/product-card';
import ShoppingCart from '@/components/shopping-cart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AFRICAN_COUNTRIES, getCountryFlag } from '@shared/africanFashion';
import { findSubcategory, subcategoriesFor } from '@shared/product-subcategories';
import type { Product, Category } from '@/types';
import { trackEvent } from '@/lib/analytics';

type GenderTab = 'all' | 'women' | 'men' | 'kids';

const GENDER_KEYWORDS: Record<Exclude<GenderTab, 'all'>, string[]> = {
  women: ['women', 'female', 'lady', 'ladies', 'bridal', 'bride', 'gele', 'iro', 'wrapper', 'blouse', 'skirt', 'her', 'queen', 'princess'],
  men:   ['men', 'male', 'agbada', 'senator', 'kaftan', 'buba', 'dashiki', 'fila', 'groom', 'his', 'king', 'chief'],
  kids:  ['kids', 'kid', 'child', 'children', 'baby', 'junior', 'boy', 'girl', 'toddler', 'youth'],
};

function matchesGender(product: Product, tab: GenderTab): boolean {
  if (tab === 'all') return true;
  const text = `${product.name} ${product.description ?? ''}`.toLowerCase();
  return GENDER_KEYWORDS[tab].some(kw => text.includes(kw));
}

export default function Products() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState('newest');
  const [genderTab, setGenderTab] = useState<GenderTab>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const search = urlParams.get('search');
    const category = urlParams.get('category');
    if (search) setSearchQuery(search);
    const subcategory = urlParams.get('subcategory') || '';
    const match = findSubcategory(subcategory);
    setSelectedSubcategory(match?.slug || '');
    if (match) {
      setSelectedCategory(categories.find(item => item.slug === match.parentSlug)?.id ?? null);
    } else if (category) {
      setSelectedCategory(parseInt(category));
    }
  }, [location, categories]);

  const { data: allProducts = [], isLoading, isError, refetch } = useQuery<Product[]>({
    queryKey: ['/api/products', searchQuery, selectedCategory, selectedSubcategory, priceRange.min, priceRange.max, genderTab, selectedCountry],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('status', 'approved');
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedCategory) params.append('categoryId', selectedCategory.toString());
      if (selectedSubcategory) params.append('subcategory', selectedSubcategory);
      if (priceRange.min) params.append('minPrice', priceRange.min);
      if (priceRange.max) params.append('maxPrice', priceRange.max);
      if (genderTab !== 'all') params.append('gender', genderTab);
      if (selectedCountry) params.append('originCountry', selectedCountry);
      const response = await fetch(`/api/products?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  // Products already filtered by gender on the server; no client-side filtering needed
  const genderFiltered = allProducts;

  const sortedProducts = [...genderFiltered].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':  return parseFloat(a.price) - parseFloat(b.price);
      case 'price-high': return parseFloat(b.price) - parseFloat(a.price);
      case 'newest':
      default:           return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  useEffect(() => {
    if (isLoading || isError) return;
    trackEvent('product_list_viewed', {
      category_id: selectedCategory ?? 0,
      search_present: Boolean(searchQuery.trim()),
      sort: sortBy,
      result_count: sortedProducts.length,
      gender: genderTab,
      country_filter: Boolean(selectedCountry),
    });
  }, [genderTab, isError, isLoading, searchQuery, selectedCategory, selectedCountry, sortBy, sortedProducts.length]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedSubcategory('');
    setPriceRange({ min: '', max: '' });
    setSortBy('newest');
    setGenderTab('all');
    setSelectedCountry('');
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedSubcategory || priceRange.min || priceRange.max || genderTab !== 'all' || selectedCountry;

  const GENDER_TABS: { value: GenderTab; label: string }[] = [
    { value: 'all',   label: 'All' },
    { value: 'women', label: 'Women' },
    { value: 'men',   label: 'Men' },
    { value: 'kids',  label: 'Kids' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 font-nigerian mb-2">
            African Fashion Collection
          </h1>
          <p className="text-gray-600 text-lg">
            Discover authentic traditional wear, Aso Oke, and handcrafted jewelry
          </p>
        </div>

        {/* Gender Tabs */}
        <div className="flex gap-2 mb-8">
          {GENDER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setGenderTab(tab.value)}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all border ${
                genderTab === tab.value
                  ? 'bg-nigerian-green text-white border-nigerian-green shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-nigerian-green hover:text-nigerian-green'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mobile Filter Toggle */}
        <div className="md:hidden mb-6">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters &amp; Search
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className={`lg:col-span-1 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Filters</span>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-red-500 hover:text-red-700"
                    >
                      Clear All
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Products
                  </label>
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-nigerian"
                  />
                </div>

                <Separator />

                {/* Categories */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <Select
                    value={selectedCategory?.toString() || 'all'}
                    onValueChange={(value) => {
                      setSelectedSubcategory('');
                      if (value === 'all') { setSelectedCategory(null); return; }
                      setSelectedCategory(parseInt(value));
                    }}
                  >
                    <SelectTrigger className="input-nigerian">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category: any) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCategory !== null && subcategoriesFor(
                  categories.find(item => item.id === selectedCategory)?.slug || ''
                ).length > 0 && (
                  <div>
                    <label htmlFor="subcategory-filter" className="block text-sm font-medium text-gray-700 mb-2">Subcategory</label>
                    <select
                      id="subcategory-filter"
                      value={selectedSubcategory}
                      onChange={event => setSelectedSubcategory(event.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">All in this category</option>
                      {subcategoriesFor(categories.find(item => item.id === selectedCategory)?.slug || '')
                        .map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
                    </select>
                  </div>
                )}

                <Separator />

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Range (₦)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                      className="input-nigerian"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                      className="input-nigerian"
                    />
                  </div>
                </div>

                <Separator />

                {/* Country of Origin */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country of Origin 🌍
                  </label>
                  <select
                    value={selectedCountry}
                    onChange={e => setSelectedCountry(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-nigerian-green"
                  >
                    <option value="">All African countries</option>
                    {["West","East","North","Central","Southern"].map(region => (
                      <optgroup key={region} label={`${region} Africa`}>
                        {AFRICAN_COUNTRIES.filter(c => c.region === region).map(c => (
                          <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {selectedCountry && (
                    <button
                      onClick={() => setSelectedCountry('')}
                      className="mt-1.5 text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                    >
                      × Clear country filter
                    </button>
                  )}
                </div>

                <Separator />

                {/* Quick Filter Badges */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Filters
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={selectedCategory === 1 ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => { setSelectedSubcategory(''); setSelectedCategory(selectedCategory === 1 ? null : 1); }}
                    >
                      Traditional Wear
                    </Badge>
                    <Badge
                      variant={selectedCategory === 2 ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => { setSelectedSubcategory(''); setSelectedCategory(selectedCategory === 2 ? null : 2); }}
                    >
                      Aso Oke
                    </Badge>
                    <Badge
                      variant={selectedCategory === 3 ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => { setSelectedSubcategory(''); setSelectedCategory(selectedCategory === 3 ? null : 3); }}
                    >
                      Beads &amp; Jewelry
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-3">
            {/* Results Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {searchQuery
                    ? `Results for "${searchQuery}"`
                    : genderTab !== 'all'
                      ? `${GENDER_TABS.find(t => t.value === genderTab)?.label}'s Collection`
                      : 'All Products'}
                </h2>
                <p className="text-gray-600">
                  {sortedProducts.length} product{sortedProducts.length !== 1 ? 's' : ''} found
                </p>
              </div>

              {/* Sort Dropdown */}
              <div className="mt-4 sm:mt-0">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-48 input-nigerian">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-low">Lowest Price</SelectItem>
                    <SelectItem value="price-high">Highest Price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Filters */}
            {hasActiveFilters && (
              <div className="mb-6">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-gray-600">Active filters:</span>
                  {genderTab !== 'all' && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {GENDER_TABS.find(t => t.value === genderTab)?.label}
                      <button onClick={() => setGenderTab('all')} className="ml-1 hover:text-red-500">×</button>
                    </Badge>
                  )}
                  {searchQuery && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Search: {searchQuery}
                      <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-red-500">×</button>
                    </Badge>
                  )}
                  {selectedCountry && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {getCountryFlag(selectedCountry)} {selectedCountry}
                      <button onClick={() => setSelectedCountry('')} className="ml-1 hover:text-red-500">×</button>
                    </Badge>
                  )}
                  {selectedCategory && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {categories.find(c => c.id === selectedCategory)?.name}
                      <button onClick={() => { setSelectedCategory(null); setSelectedSubcategory(''); }} className="ml-1 hover:text-red-500">×</button>
                    </Badge>
                  )}
                  {selectedSubcategory && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {findSubcategory(selectedSubcategory)?.name}
                      <button onClick={() => setSelectedSubcategory('')} className="ml-1 hover:text-red-500" aria-label="Clear subcategory">×</button>
                    </Badge>
                  )}
                  {(priceRange.min || priceRange.max) && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      ₦{priceRange.min || '0'} – ₦{priceRange.max || '∞'}
                      <button onClick={() => setPriceRange({ min: '', max: '' })} className="ml-1 hover:text-red-500">×</button>
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="h-64 bg-gray-200"></div>
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded mb-3"></div>
                      <div className="h-6 bg-gray-200 rounded mb-4"></div>
                      <div className="h-10 bg-gray-200 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : isError ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">We couldn’t load the catalog</h3>
                <p className="text-gray-600 mb-4">Check your connection and try again.</p>
                <Button onClick={() => refetch()} className="btn-nigerian">Try Again</Button>
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m16 0l-2-2H6l-2 2" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600 mb-4">
                  {hasActiveFilters
                    ? 'Try adjusting your filters or search terms'
                    : 'No products are currently available'}
                </p>
                {hasActiveFilters && (
                  <Button onClick={clearFilters} className="btn-nigerian">
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="product-grid">
                {sortedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            {sortedProducts.length > 0 && (
              <div className="mt-12 text-center">
                <p className="text-gray-600">
                  Showing {sortedProducts.length} of {sortedProducts.length} products
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ShoppingCart />
    </div>
  );
}
