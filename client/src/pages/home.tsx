import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/navbar";
import SiteFooter from "@/components/site-footer";
import ProductCard from "@/components/product-card";
import ShoppingCart from "@/components/shopping-cart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { getUserRoleDisplay, isAdmin } from "@/lib/roleUtils";
import type { Product, Category } from "@/types";
import logoImage from '@assets/Group 1000002646_1749631956471.png';
import useEmblaCarousel from 'embla-carousel-react';
import maasaiImg from '@assets/stock_images/maasai_warriors_kenya.png';
import mandelaImg from '@assets/stock_images/african_leader_mandela_tribute.png';
import ethiopianImg from '@assets/stock_images/ethiopian_traditional_timkat.png';
import ashantImg from '@assets/stock_images/ghanaian_ashanti_chief.png';
import moroccanImg from '@assets/stock_images/moroccan_berber_culture.png';
import ndebeImg from '@assets/stock_images/ndebele_south_africa.png';
import panAfricanImg from '@assets/stock_images/pan_african_diversity.png';
import rwandanImg from '@assets/stock_images/rwandan_intore_dancer.png';
import fabricImg from '@assets/stock_images/african_kente_cloth__8cfc9c20.jpg';

const culturalSlides = [
  { image: panAfricanImg,  country: "Pan-Africa",       label: "Unity in Diversity",         flag: "AF" },
  { image: maasaiImg,      country: "Kenya · Tanzania", label: "Maasai Warriors",            flag: "KE" },
  { image: mandelaImg,     country: "South Africa",     label: "Spirit of African Heroes",   flag: "ZA" },
  { image: ethiopianImg,   country: "Ethiopia",         label: "Timkat Festival",            flag: "ET" },
  { image: ashantImg,      country: "Ghana",            label: "Ashanti Royal Heritage",     flag: "GH" },
  { image: moroccanImg,    country: "Morocco",          label: "Berber Tradition",           flag: "MA" },
  { image: ndebeImg,       country: "South Africa",     label: "Ndebele Cultural Art",       flag: "ZA" },
  { image: rwandanImg,     country: "Rwanda",           label: "Intore Ceremony",            flag: "RW" },
  { image: fabricImg,      country: "West Africa",      label: "Kente Cloth",                flag: "AF" },
];

export default function Home() {
  const { user } = useAuth();
  const { cartItems, isCartOpen, toggleCart } = useCart();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  useEffect(() => {
    if (!emblaApi) return;

    const autoplay = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000);

    return () => clearInterval(autoplay);
  }, [emblaApi]);

  const scrollToProducts = () => {
    const productsSection = document.getElementById('products-section');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleBecomeVendor = () => {
    setLocation('/vendor');
  };

  const handleCategorySelect = (categoryId: number | null) => {
    setSelectedCategory(categoryId);
    setTimeout(() => scrollToProducts(), 100);
  };

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: featuredProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", "featured"],
    queryFn: () => fetch("/api/products?featured=true").then(res => res.json()),
  });

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredProducts = allProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Admin Quick-Access Banner */}
      {isAdmin(user) && (
        <div className="bg-gradient-to-r from-red-700 to-red-600 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm sm:text-base">
                Admin Mode — Welcome back, {user?.firstName || user?.email}
              </span>
            </div>
            <Button
              size="sm"
              className="bg-white text-red-700 hover:bg-red-50 font-bold shrink-0"
              onClick={() => window.location.href = '/admin'}
            >
              Open Admin Panel →
            </Button>
          </div>
        </div>
      )}

      {/* Hero Section with Cultural Carousel */}
      <section className="relative overflow-hidden h-[calc(100vh-64px)]">
        {/* Cultural Images Carousel */}
        <div className="absolute inset-0" ref={emblaRef}>
          <div className="flex h-full">
            {culturalSlides.map((slide, index) => (
              <div key={index} className="flex-[0_0_100%] min-w-0 relative">
                <img
                  src={slide.image}
                  alt={`${slide.label} — ${slide.country}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-green-900/75 to-emerald-800/80"></div>
                {/* Slide culture badge */}
                <div className="absolute bottom-16 left-4 sm:bottom-20 sm:left-6 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 sm:px-4 sm:py-2 border border-white/20">
                  <span className="text-base sm:text-xl">{slide.flag}</span>
                  <div>
                    <p className="text-white/90 font-semibold text-xs sm:text-sm leading-none">{slide.label}</p>
                    <p className="text-amber-300 text-xs mt-0.5">{slide.country}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pattern Overlay */}
        <div className="absolute inset-0 z-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D4AF37' fill-opacity='0.06'%3E%3Cpath d='M30 30c0-16.569 13.431-30 30-30v30H30zM0 30c0-16.569 13.431-30 30-30v30H0z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }}></div>

        {/* Hero Content */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
          <div className="text-center w-full">
            <h1 className="text-2xl sm:text-5xl md:text-7xl font-bold font-nigerian mb-3 sm:mb-6 md:mb-8 text-white">
              <span className="block bg-gradient-to-r from-white via-yellow-200 to-amber-300 bg-clip-text text-transparent">
                Celebrate Cultural
              </span>
              <span className="block text-amber-300 mt-1 sm:mt-2">
                Heritage
              </span>
            </h1>
            <p className="hidden sm:block text-base sm:text-xl md:text-2xl mb-6 sm:mb-8 md:mb-12 max-w-4xl mx-auto text-gray-100 leading-relaxed px-4">
              From Nigerian Aso Oke to Ghanaian Kente, Ethiopian habesha to Maasai beadwork — 
              authentic fashion from all 54 African nations.
            </p>
            <p className="block sm:hidden text-sm mb-6 max-w-xs mx-auto text-gray-200 leading-relaxed px-4">
              Authentic fashion from all 54 African nations.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              <Button
                size="lg"
                className="btn-gold w-full sm:w-auto max-w-xs sm:max-w-none"
                onClick={scrollToProducts}
                data-testid="button-shop-traditional-wear"
              >
                Shop Traditional Wear
              </Button>
              <Button
                size="lg"
                className="bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 font-semibold border border-white/30 hover:border-white/50 w-full sm:w-auto max-w-xs sm:max-w-none"
                onClick={handleBecomeVendor}
                data-testid="button-become-vendor"
              >
                Become a Vendor
              </Button>
            </div>
          </div>
        </div>

        {/* Carousel Indicators */}
        <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center gap-2">
          {culturalSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => emblaApi?.scrollTo(index)}
              className="w-2 h-2 rounded-full bg-white/50 hover:bg-white/80 transition-all duration-300"
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Search and Filters */}
      <section className="py-8 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <Input
                type="text"
                placeholder="Search for traditional wear, Aso Oke, beads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-nigerian"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => handleCategorySelect(null)}
                className={selectedCategory === null ? "btn-nigerian" : ""}
              >
                All Categories
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => handleCategorySelect(category.id)}
                  className={selectedCategory === category.id ? "btn-nigerian" : ""}
                >
                  {category.name}
                </Button>
              ))}
              {!categories.some((c: any) => c.name.toLowerCase() === 'others') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const otherscat = categories.find((c: any) => c.name.toLowerCase() === 'others');
                    handleCategorySelect(otherscat ? otherscat.id : null);
                  }}
                >
                  Others
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories - Only show for non-authenticated users */}
      {!user && (
        <section className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 font-nigerian mb-3 md:mb-4">Featured Categories</h2>
              <p className="text-sm sm:text-base md:text-lg text-gray-600">Explore our curated collection of authentic African fashion</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-8">
              {categories.slice(0, 3).map((category, index) => {
                const categoryIcons = ["01", "02", "03", "04"];
                return (
                  <Card key={category.id} className="text-center card-hover bg-white">
                    <CardContent className="p-4 md:p-8">
                  <div className="text-xl md:text-2xl font-semibold text-nigerian-green mb-3 md:mb-6">{categoryIcons[index] || "00"}</div>
                      <h3 className="text-sm md:text-xl font-semibold text-gray-900 mb-1 md:mb-3">{category.name}</h3>
                      <p className="hidden sm:block text-gray-600 text-xs md:text-base">{category.description || "Discover our authentic collection"}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="py-10 md:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6 md:mb-12">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-gray-900 font-nigerian mb-1 md:mb-4">Featured Products</h2>
              <p className="text-xs sm:text-sm md:text-lg text-gray-600">Handpicked by our cultural fashion experts</p>
            </div>
            <Button variant="outline" className="text-nigerian-green border-nigerian-green hover:bg-nigerian-green hover:text-white text-xs sm:text-sm px-2 sm:px-4 shrink-0">
              <span className="hidden sm:inline">View All Products </span>→
            </Button>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No featured products available at the moment.</p>
            </div>
          ) : (
            <div className="product-grid">
              {featuredProducts.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* All Products */}
      {(searchQuery || selectedCategory !== null) && (
        <section id="products-section" className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6 md:mb-12">
              <div>
                <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-gray-900 font-nigerian mb-1 md:mb-4">
                  {searchQuery ? `Results: "${searchQuery}"` : 
                   selectedCategory ? `${categories.find(c => c.id === selectedCategory)?.name || 'Category'}` : 
                   "All Products"}
                </h2>
                <p className="text-xs sm:text-sm md:text-lg text-gray-600">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  {searchQuery ? `No products found for "${searchQuery}"` : 
                   selectedCategory ? `No products found in ${categories.find(c => c.id === selectedCategory)?.name || 'this category'}` :
                   'No products found'}
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory(null);
                  }}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Show all products when no filters are active */}
      {!searchQuery && selectedCategory === null && (
        <section id="products-section" className="py-10 md:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6 md:mb-12">
              <div>
                <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-gray-900 font-nigerian mb-1 md:mb-4">All Products</h2>
                <p className="text-xs sm:text-sm md:text-lg text-gray-600">Discover our complete collection</p>
              </div>
            </div>

            {allProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No products available at the moment.</p>
              </div>
            ) : (
              <div className="product-grid">
                {allProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-10 md:py-16 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 font-nigerian mb-3 md:mb-4">Why Choose Afrolandx</h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600">Your trusted marketplace for authentic African fashion</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <Card className="text-center hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-5 md:p-6">
                <div className="w-16 h-16 bg-nigerian-green rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Authentic Products</h3>
                <p className="text-gray-600">Every product is verified by our cultural experts to ensure authenticity and quality.</p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-5 md:p-6">
                <div className="w-16 h-16 bg-nigerian-gold rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    <path d="M3 4a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1V5a1 1 0 00-1-1H3zM3 10a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 00-1-1H3zM3 16a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 00-1-1H3zM7 4a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zM7 10a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zM7 16a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Global Shipping</h3>
                <p className="text-gray-600">Fast and secure delivery worldwide via UPS, FedEx, and DHL partnerships.</p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-5 md:p-6">
                <div className="w-16 h-16 bg-coral rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Support Artisans</h3>
                <p className="text-gray-600">Direct connection with African artisans and designers, supporting local communities.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />

      <ShoppingCart />
    </div>
  );
}
