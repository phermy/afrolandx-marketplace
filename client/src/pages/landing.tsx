import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/navbar";
import HomeHero from "@/components/home-hero";
import SiteFooter from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types";
import HeritageEditorial from "@/components/heritage-editorial";
import HeritageCarousel from "@/components/heritage-carousel";

type PublicMarketplaceStats = {
  verifiedVendors: number;
  verifiedCustomers: number;
  dailyInteractions: number;
  countriesServed: number;
  interactionWindow: '24h';
};

export default function Landing() {
  const { toast } = useToast();

  // Fetch only approved products for display on landing page
  const { data: products = [], isPending: productsLoading, isError: productsError } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    retry: false,
  });

  const { data: marketplaceStats, isPending: statsLoading, isError: statsError } = useQuery<PublicMarketplaceStats>({
    queryKey: ["/api/public/stats"],
    retry: false,
  });

  const publicStats = [
    { value: marketplaceStats?.verifiedVendors ?? 0, label: "Verified vendors" },
    { value: marketplaceStats?.verifiedCustomers ?? 0, label: "Verified customers" },
    { value: marketplaceStats?.dailyInteractions ?? 0, label: "Daily interactions" },
    { value: marketplaceStats?.countriesServed ?? 0, label: "Countries served" },
  ];

  useEffect(() => {
    // Check for authentication errors in URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error === 'admin_access_denied') {
      toast({
        title: 'Access Denied',
        description: 'You do not have admin privileges to access the admin panel.',
        variant: 'destructive',
      });
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error === 'auth_error') {
      toast({
        title: 'Authentication Error',
        description: 'An error occurred during authentication. Please try again.',
        variant: 'destructive',
      });
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  return (
    <div className="landing-page min-h-screen bg-gray-50 text-left">
      <Navbar />
      <HomeHero variant="guest" />

      {/* Live marketplace proof points */}
      <section id="marketplace-stats" className="border-b-[6px] border-emerald-500 bg-white" aria-label="Afrolandx marketplace statistics">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-gray-100 px-4 py-7 sm:px-6 md:grid-cols-4 md:divide-y-0 md:py-9 lg:px-8">
          {publicStats.map((stat) => (
            <div key={stat.label} className="px-3 py-4 text-center md:px-6 md:py-2">
              <p className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl" aria-busy={statsLoading}>
                {statsLoading || statsError ? "—" : <>{stat.value.toLocaleString()}{stat.value > 0 ? "+" : ""}</>}
              </p>
              <p className="mt-1 text-sm font-medium text-gray-700">{stat.label}</p>
            </div>
          ))}
        </div>
        {statsError && <p role="status" className="px-4 pb-4 text-center text-sm text-gray-700">Marketplace numbers are temporarily unavailable.</p>}
      </section>

      {/* Featured Products Section */}
      <HeritageEditorial />
      <section className="py-12 md:py-20 bg-white" id="products">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold font-nigerian mb-3 md:mb-6 text-gray-900">
              Explore the <span className="text-nigerian-green">Marketplace</span>
            </h2>
            <p className="text-base md:text-xl text-gray-700 max-w-3xl mx-auto px-2">
              Discover authentic African fashion pieces crafted by local artisans.
            </p>
          </div>

          {productsLoading ? (
            <p role="status" className="py-12 text-center text-base text-gray-700">Loading products…</p>
          ) : productsError ? (
            <div role="alert" className="py-12 text-center text-base text-gray-700">
              Products could not be loaded right now. <Link href="/products" className="font-semibold text-green-800 underline underline-offset-4">Try browsing products</Link>.
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {products.slice(0, 8).map((product) => {
                // images[] is the authoritative source; imageUrl is a legacy fallback
                const rawSrc =
                  (product.images && product.images.length > 0
                    ? product.images[0]
                    : product.imageUrl) || '';
                return (
                <Card key={product.id} className="group hover:shadow-xl transition-shadow duration-300">
                  <div className="relative w-full aspect-square overflow-hidden rounded-t-lg bg-white">
                    <img
                      src={rawSrc || 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=400&h=400&q=75'}
                      alt={product.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      loading="eager"
                      decoding="async"
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.onerror = null;
                        img.src = 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=400&h=400&q=75';
                      }}
                    />
                    {product.featured && (
                      <Badge className="absolute top-2 left-2 z-10 bg-nigerian-gold text-[#183b35] text-xs px-1.5 py-0.5">
                        Featured
                      </Badge>
                    )}
                    {product.stock <= 5 && product.stock > 0 && (
                      <Badge className="absolute top-2 right-2 z-10 bg-orange-400 text-[#183b35] text-xs px-1.5 py-0.5">
                        Low Stock
                      </Badge>
                    )}
                    {product.stock === 0 && (
                      <Badge className="absolute top-2 right-2 z-10 bg-red-700 text-white text-xs px-1.5 py-0.5">
                        Sold Out
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3 sm:p-4 md:p-6">
                    <h3 className="font-semibold text-sm md:text-base mb-1 md:mb-2 text-gray-900 group-hover:text-nigerian-green transition-colors line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-gray-700 text-sm mb-2 md:mb-4 line-clamp-2">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between mb-2 md:mb-4">
                      <div className="flex flex-col">
                        <span className="text-sm sm:text-base md:text-xl font-bold text-nigerian-green">
                          ₦{parseFloat(product.price).toLocaleString()}
                        </span>
                      </div>
                      <span className="hidden sm:block text-sm text-gray-700">
                        {product.stock} left
                      </span>
                    </div>
                    <Button asChild className="w-full btn-nigerian text-sm py-2 h-auto">
                      <Link href={`/products/${product.id}`}>View product</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                New products coming soon! Check back later for amazing African fashion pieces.
              </p>
            </div>
          )}

          {products.length > 8 && (
            <div className="text-center mt-12">
              <Button onClick={() => window.location.href = "/products"} size="lg" className="btn-nigerian">
                View All Products
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-10 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 font-nigerian mb-3 md:mb-4">
              Why Choose Afrolandx?
            </h2>
            <p className="text-base md:text-lg text-gray-700">
              Your trusted marketplace for authentic African fashion
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <Card className="text-center card-hover">
              <CardContent className="p-5 md:p-8">
                <div className="w-16 h-16 bg-nigerian-green rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Authentic Products</h3>
                <p className="text-gray-700">
                  Product listings are reviewed before they appear in the marketplace.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center card-hover">
              <CardContent className="p-5 md:p-8">
                <div className="w-16 h-16 bg-nigerian-gold rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    <path d="M3 4a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1V5a1 1 0 00-1-1H3zM3 10a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 00-1-1H3zM3 16a1 1 0 00-1 1v1a1 1 0 001 1h1a1 1 0 001-1v-1a1 1 0 00-1-1H3zM7 4a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zM7 10a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zM7 16a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Global Shipping</h3>
                <p className="text-gray-700">
                  International delivery options and costs are confirmed with a shipping quote.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center card-hover">
              <CardContent className="p-5 md:p-8">
                <div className="w-16 h-16 bg-coral rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Support Artisans</h3>
                <p className="text-gray-700">
                  Direct connection with African artisans and designers, supporting local communities.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Product Categories Preview */}
      <section className="py-10 md:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 font-nigerian mb-3 md:mb-4">
              Explore Our Categories
            </h2>
            <p className="text-base md:text-lg text-gray-700">
              Discover the beauty of African traditional fashion
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            {[
              { name: "Traditional Wear", description: "Authentic African clothing", mark: "01" },
              { name: "Aso Oke", description: "Handwoven fabrics", mark: "02" },
              { name: "Beads & Jewelry", description: "Traditional accessories", mark: "03" },
              { name: "Modern Fusion", description: "Contemporary designs", mark: "04" },
            ].map((category, index) => (
              <Card key={index} className="text-center card-hover">
                <CardContent className="p-4 md:p-6">
                  <div className="text-xl md:text-2xl font-semibold text-nigerian-green mb-2 md:mb-4">{category.mark}</div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">{category.name}</h3>
                  <p className="text-gray-700 text-sm">{category.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Payment & Shipping */}
      <section className="py-10 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 font-nigerian mb-3 md:mb-4">
              Secure Payment & Fast Delivery
            </h2>
            <p className="text-base md:text-lg text-gray-700">
              We accept multiple payment methods and deliver worldwide
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-6">Payment Methods</h3>
              <div className="flex justify-center items-center space-x-6 mb-4">
                <Badge variant="secondary" className="text-lg font-bold text-nigerian-green bg-green-100 px-4 py-2">
                  PAYSTACK
                </Badge>
              </div>
              <p className="text-base text-gray-700">
                Secure checkout with Paystack
              </p>
            </div>
            
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-6">International Carriers</h3>
              <div className="flex justify-center items-center space-x-8 mb-4">
                <Badge variant="outline" className="text-lg font-bold text-blue-600 px-3 py-2">UPS</Badge>
                <Badge variant="outline" className="text-lg font-bold text-purple-600 px-3 py-2">FedEx</Badge>
                <Badge variant="outline" className="text-lg font-bold text-yellow-800 px-3 py-2">DHL</Badge>
              </div>
              <p className="text-base text-gray-700">
                Availability and shipping cost are confirmed for your destination.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="scroll-mt-20 py-10 md:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 font-nigerian mb-4 md:mb-6" style={{ lineHeight: '1.3' }}>
                Celebrating African Heritage
              </h2>
              <p className="reading-copy text-gray-700 text-base md:text-lg mb-4 md:mb-6">
                Afrolandx is more than just an online marketplace. We're a cultural bridge
                connecting African artisans with fashion enthusiasts worldwide. Our mission is 
                to preserve and promote the rich heritage of African traditional fashion while 
                supporting local communities.
              </p>
              <p className="reading-copy text-gray-700 text-base md:text-lg mb-4 md:mb-6">
                Every purchase you make helps support African artisans, preserves traditional 
                crafting techniques, and celebrates the vibrant culture of Africa.
              </p>
              <Button onClick={() => window.location.href = "/register"} className="btn-nigerian w-full sm:w-auto">
                Join Our Community
              </Button>
            </div>
            <HeritageCarousel />
          </div>
          {/* Team profiles are intentionally withheld from the public landing page for now. */}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 md:py-16 bg-nigerian-green text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-6">
            Ready to Explore African Fashion?
          </h2>
          <p className="text-base md:text-xl mb-6 md:mb-8 max-w-2xl mx-auto px-2">
            Explore African clothing and accessories and connect with the makers behind them.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <Button onClick={() => window.location.href = "/products"} size="lg" className="bg-nigerian-gold hover:bg-yellow-600 text-[#183b35] font-semibold w-full sm:w-auto max-w-xs sm:max-w-none">
              Start Shopping Now
            </Button>
            <Button
              asChild
              size="lg"
              className="bg-white text-nigerian-green hover:bg-gray-100 font-semibold border-2 border-white w-full sm:w-auto max-w-xs sm:max-w-none"
            >
              <Link href="/vendor/apply">Sell your work</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />

    </div>
  );
}
