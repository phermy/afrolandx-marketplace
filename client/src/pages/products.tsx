import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import Navbar from '@/components/navbar';
import ProductCard from '@/components/product-card';
import CatalogCategoryStrip from '@/components/catalog-category-strip';
import ShoppingCart from '@/components/shopping-cart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AFRICAN_COUNTRIES } from '@shared/africanFashion';
import { findSubcategory, subcategoriesFor } from '@shared/product-subcategories';
import type { Product, Category } from '@/types';
import { trackEvent } from '@/lib/analytics';
import { ArrowDownUp, ArrowRight, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import '@/components/catalog-styles.css';

type GenderTab = 'all' | 'women' | 'men' | 'kids';

export default function Products() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState('newest');
  const [genderTab, setGenderTab] = useState<GenderTab>('all');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ['/api/categories'] });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const search = urlParams.get('search');
    const category = urlParams.get('category');
    if (search) setSearchQuery(search);
    const subcategory = urlParams.get('subcategory') || '';
    const match = findSubcategory(subcategory);
    setSelectedSubcategory(match?.slug || '');
    if (match) setSelectedCategory(categories.find(item => item.slug === match.parentSlug)?.id ?? null);
    else if (category) setSelectedCategory(parseInt(category));
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

  const sortedProducts = [...allProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low': return parseFloat(a.price) - parseFloat(b.price);
      case 'price-high': return parseFloat(b.price) - parseFloat(a.price);
      default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
  const hasActiveFilters = Boolean(searchQuery || selectedCategory || selectedSubcategory || priceRange.min || priceRange.max || genderTab !== 'all' || selectedCountry);
  const genderTabs: { value: GenderTab; label: string }[] = [
    { value: 'all', label: 'Everything' }, { value: 'women', label: 'Women' }, { value: 'men', label: 'Men' }, { value: 'kids', label: 'Kids' },
  ];
  const currentCategorySlug = categories.find(item => item.id === selectedCategory)?.slug || '';

  return (
    <div className="catalog-page min-h-screen">
      <Navbar />
      <main className="catalog-shell">
        <CatalogCategoryStrip
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={(id) => {
            setSelectedCategory(id);
            setSelectedSubcategory('');
            document.getElementById('catalog-results')?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
              block: 'start',
            });
          }}
        />

        <section className="catalog-hero">
          <div className="catalog-hero-copy">
            <p className="catalog-eyebrow"><span className="catalog-eyebrow-rule" />Afrolandx marketplace</p>
            <h1>Made by hand.<br /><em>Rooted in place.</em></h1>
            <p className="catalog-hero-lede">Wear the story. Find expressive fashion, considered objects and living craft from African makers.</p>
            <button className="catalog-hero-jump" onClick={() => document.getElementById('catalog-results')?.scrollIntoView({ behavior: 'smooth' })}>
              Explore the collection <ArrowRight size={16} />
            </button>
          </div>
          <div className="catalog-hero-art" aria-label="Decorative woven pattern" role="img">
            <div className="catalog-hero-art-inner">
              <span className="catalog-hero-orbit catalog-hero-orbit--one" />
              <span className="catalog-hero-orbit catalog-hero-orbit--two" />
              <span className="catalog-hero-disc" />
              <span className="catalog-hero-art-label">A continent<br />of many hands</span>
              <span className="catalog-hero-art-number">AF / 01</span>
            </div>
            <span className="catalog-hero-caption">Textile studies — Afrolandx</span>
          </div>
          <span className="catalog-hero-index">AF / 01</span>
        </section>

        <section className="catalog-shopping" id="catalog-results">
          <div className="catalog-shopping-heading">
            <div>
              <p className="catalog-eyebrow">The collection</p>
              <h2>Find something <em>made to matter.</em></h2>
            </div>
            <p className="catalog-shopping-aside">Distinct materials, regional techniques, and makers’ own points of view.</p>
          </div>

          <div className="catalog-gender-tabs" role="tablist" aria-label="Shop by collection">
            {genderTabs.map(tab => (
              <button key={tab.value} type="button" role="tab" aria-selected={genderTab === tab.value} onClick={() => setGenderTab(tab.value)} className={genderTab === tab.value ? 'is-active' : ''}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="catalog-toolbar">
            <div className="catalog-search-wrap">
              <Search size={17} aria-hidden="true" />
              <Input aria-label="Search products" placeholder="Search pieces, materials, makers…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              {searchQuery && <button type="button" aria-label="Clear search" onClick={() => setSearchQuery('')}><X size={15} /></button>}
            </div>
            <div className="catalog-toolbar-actions">
              <Button variant="outline" className="catalog-filter-toggle" onClick={() => setShowFilters(!showFilters)}>
                <SlidersHorizontal size={15} /> Filters {hasActiveFilters && <span className="catalog-filter-dot" />}
              </Button>
              <div className="catalog-sort-control">
                <ArrowDownUp size={15} aria-hidden="true" />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger aria-label="Sort products"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-low">Lowest price</SelectItem>
                    <SelectItem value="price-high">Highest price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="catalog-content-layout">
            <aside className={`catalog-filters ${showFilters ? 'is-open' : ''}`} aria-label="Product filters">
              <div className="catalog-filters-top">
                <div><span className="catalog-eyebrow">Refine</span><h3>Your search</h3></div>
                {hasActiveFilters && <button type="button" onClick={clearFilters} className="catalog-clear">Clear all</button>}
                <button type="button" className="catalog-filter-close" aria-label="Close filters" onClick={() => setShowFilters(false)}><X size={17} /></button>
              </div>
              <div className="catalog-filter-group">
                <label htmlFor="catalog-category">Category</label>
                <Select value={selectedCategory?.toString() || 'all'} onValueChange={value => { setSelectedSubcategory(''); setSelectedCategory(value === 'all' ? null : parseInt(value)); }}>
                  <SelectTrigger id="catalog-category"><SelectValue placeholder="All categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map(category => <SelectItem key={category.id} value={category.id.toString()}>{category.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedCategory !== null && subcategoriesFor(currentCategorySlug).length > 0 && (
                <div className="catalog-filter-group">
                  <label htmlFor="subcategory-filter">Within category</label>
                  <select id="subcategory-filter" value={selectedSubcategory} onChange={event => setSelectedSubcategory(event.target.value)}>
                    <option value="">All in this category</option>
                    {subcategoriesFor(currentCategorySlug).map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
                  </select>
                </div>
              )}
              <div className="catalog-filter-group">
                <label>Price range <span>(₦)</span></label>
                <div className="catalog-price-range">
                  <Input type="number" min="0" placeholder="From" value={priceRange.min} onChange={e => setPriceRange(prev => ({ ...prev, min: e.target.value }))} aria-label="Minimum price" />
                  <span aria-hidden="true">—</span>
                  <Input type="number" min="0" placeholder="To" value={priceRange.max} onChange={e => setPriceRange(prev => ({ ...prev, max: e.target.value }))} aria-label="Maximum price" />
                </div>
              </div>
              <div className="catalog-filter-group">
                <label htmlFor="origin-country">Made in</label>
                <div className="catalog-select-wrap">
                  <select id="origin-country" value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}>
                    <option value="">Any African country</option>
                    {['West', 'East', 'North', 'Central', 'Southern'].map(region => (
                      <optgroup key={region} label={`${region} Africa`}>
                        {AFRICAN_COUNTRIES.filter(country => country.region === region).map(country => <option key={country.name} value={country.name}>{country.name}</option>)}
                      </optgroup>
                    ))}
                  </select><ChevronDown size={15} aria-hidden="true" />
                </div>
                {selectedCountry && <button type="button" className="catalog-inline-clear" onClick={() => setSelectedCountry('')}>Clear country</button>}
              </div>
              <div className="catalog-filter-group">
                <label>Quick browse</label>
                <div className="catalog-quick-filters">
                  {['Traditional Wear', 'Aso Oke', 'Beads & Jewelry'].map((label, index) => (
                    <button type="button" key={label} className={selectedCategory === index + 1 ? 'is-active' : ''} onClick={() => { setSelectedSubcategory(''); setSelectedCategory(selectedCategory === index + 1 ? null : index + 1); }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <div className="catalog-results">
              <div className="catalog-results-head">
                <div>
                  <p className="catalog-eyebrow">{searchQuery ? 'Search results' : 'Curated from across the continent'}</p>
                  <h3>{searchQuery ? `“${searchQuery}”` : genderTab !== 'all' ? `${genderTabs.find(tab => tab.value === genderTab)?.label}'s collection` : selectedCategory ? categories.find(item => item.id === selectedCategory)?.name : 'All pieces'}</h3>
                </div>
                <span className="catalog-result-count">{isLoading ? 'Gathering pieces…' : `${sortedProducts.length} ${sortedProducts.length === 1 ? 'piece' : 'pieces'}`}</span>
              </div>

              {hasActiveFilters && (
                <div className="catalog-active-filters">
                  {genderTab !== 'all' && <button type="button" onClick={() => setGenderTab('all')}>{genderTabs.find(tab => tab.value === genderTab)?.label}<X size={12} /></button>}
                  {searchQuery && <button type="button" onClick={() => setSearchQuery('')}>Search: {searchQuery}<X size={12} /></button>}
                  {selectedCountry && <button type="button" onClick={() => setSelectedCountry('')}>{selectedCountry}<X size={12} /></button>}
                  {selectedCategory && <button type="button" onClick={() => { setSelectedCategory(null); setSelectedSubcategory(''); }}>{categories.find(item => item.id === selectedCategory)?.name}<X size={12} /></button>}
                  {selectedSubcategory && <button type="button" onClick={() => setSelectedSubcategory('')}>{findSubcategory(selectedSubcategory)?.name}<X size={12} /></button>}
                  {(priceRange.min || priceRange.max) && <button type="button" onClick={() => setPriceRange({ min: '', max: '' })}>₦{priceRange.min || '0'} – ₦{priceRange.max || '∞'}<X size={12} /></button>}
                </div>
              )}

              {isLoading ? (
                <div className="catalog-product-grid" aria-label="Loading products">
                  {Array.from({ length: 6 }, (_, index) => <div className="catalog-skeleton" key={index}><div /><span /><span /></div>)}
                </div>
              ) : isError ? (
                <div className="catalog-empty-state catalog-error-state">
                  <span className="catalog-empty-mark">!</span>
                  <p className="catalog-eyebrow">A brief pause</p>
                  <h3>The collection didn’t load.</h3>
                  <p>Check your connection, then try again.</p>
                  <Button onClick={() => refetch()}>Try again</Button>
                </div>
              ) : sortedProducts.length === 0 ? (
                <div className="catalog-empty-state">
                  <div className="catalog-empty-weave" aria-hidden="true"><span /><span /><span /><span /><span /></div>
                  <p className="catalog-eyebrow">{hasActiveFilters ? 'No pieces found' : 'The shelf is being set'}</p>
                  <h3>{selectedCategory && !searchQuery && !selectedSubcategory && !priceRange.min && !priceRange.max && genderTab === 'all' && !selectedCountry
                    ? `No ${categories.find(item => item.id === selectedCategory)?.name ?? 'category'} pieces yet.`
                    : hasActiveFilters ? 'Nothing in this edit just yet.' : 'The collection is taking shape.'}</h3>
                  <p>{hasActiveFilters ? 'There are no approved pieces matching this selection right now. Try another category or clear your filters.' : 'There are no approved pieces to browse right now. Check back as makers add their work.'}</p>
                  {hasActiveFilters && <Button onClick={clearFilters}>Show all pieces</Button>}
                </div>
              ) : (
                <div className="catalog-product-grid">
                  {sortedProducts.map(product => <ProductCard key={product.id} product={product} />)}
                </div>
              )}
              {!isLoading && !isError && sortedProducts.length > 0 && <p className="catalog-endnote">Showing all {sortedProducts.length} available {sortedProducts.length === 1 ? 'piece' : 'pieces'} in this view</p>}
            </div>
          </div>
        </section>
      </main>
      <ShoppingCart />
    </div>
  );
}