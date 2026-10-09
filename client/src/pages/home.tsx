import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Navbar from "@/components/navbar";
import HomeHero from "@/components/home-hero";
import SiteFooter from "@/components/site-footer";
import ProductCard from "@/components/product-card";
import ShoppingCart from "@/components/shopping-cart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import type { Product, Category } from "@/types";
import HeritageEditorial from "@/components/heritage-editorial";

export default function Home() {
  const { user } = useAuth();
  const { cartItems, isCartOpen, toggleCart } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const scrollToProducts = () => {
    const productsSection = document.getElementById('products-section');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    <div className="min-h-[100dvh] bg-[#f6f1e7]">
      <Navbar />

      <HomeHero variant="shopper" />

      {/* Search and Filters */}
      <HeritageEditorial />
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
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 font-nigerian mb-3 md:mb-4">Why Choose Afrolandx?</h2>
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
