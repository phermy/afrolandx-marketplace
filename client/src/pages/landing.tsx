import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/roleUtils";
import { ShoppingCart, Menu, X, Package, Calendar, Zap, MapPin, Info } from "lucide-react";
import type { Product } from "@/types";
import LocalPrice from "@/components/LocalPrice";
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
  { image: panAfricanImg,  country: "Pan-Africa",    label: "Unity in Diversity",            flag: "🌍" },
  { image: maasaiImg,      country: "Kenya · Tanzania", label: "Maasai Warriors",             flag: "🇰🇪" },
  { image: mandelaImg,     country: "South Africa",  label: "Spirit of African Heroes",       flag: "🇿🇦" },
  { image: ethiopianImg,   country: "Ethiopia",      label: "Timkat Festival",                flag: "🇪🇹" },
  { image: ashantImg,      country: "Ghana",         label: "Ashanti Royal Heritage",         flag: "🇬🇭" },
  { image: moroccanImg,    country: "Morocco",       label: "Berber Tradition",               flag: "🇲🇦" },
  { image: ndebeImg,       country: "South Africa",  label: "Ndebele Cultural Art",           flag: "🇿🇦" },
  { image: rwandanImg,     country: "Rwanda",        label: "Intore Ceremony",                flag: "🇷🇼" },
  { image: fabricImg,      country: "West Africa",   label: "Kente Cloth",                    flag: "🌍" },
];

export default function Landing() {
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  useEffect(() => {
    if (!emblaApi) return;

    const autoplay = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000);

    return () => clearInterval(autoplay);
  }, [emblaApi]);

  // Fetch only approved products for display on landing page
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    retry: false,
  });

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

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleAdminPortalClick = () => {
    // Redirect to login with admin intent
    window.location.href = '/login';
  };

  const handleAddToCart = (productId: number) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add items to your cart",
        variant: "default",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);
      return;
    }
    // This would normally trigger the add to cart functionality
    // But since user is not authenticated, we redirect to login
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex items-center text-xl font-bold text-nigerian-green font-nigerian">
                <img src={logoImage} alt="Afrolandx Logo" className="w-8 h-8 mr-2" />
                <span className="hidden sm:block">Afrolandx</span>
              </div>
            </div>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center space-x-6">
              <a href="/products" className="text-gray-700 hover:text-nigerian-green transition-colors font-medium" data-testid="nav-link-products">Products</a>
              <a href="/events" className="text-gray-700 hover:text-nigerian-green transition-colors font-medium" data-testid="nav-link-events">Events</a>
              <a href="/collab-drops" className="text-gray-700 hover:text-nigerian-green transition-colors font-medium" data-testid="nav-link-collab-drops">Collabs</a>
              <a href="/discover" className="text-gray-700 hover:text-nigerian-green transition-colors font-medium" data-testid="nav-link-discover">Discover</a>
              <a href="#about" className="text-gray-700 hover:text-nigerian-green transition-colors font-medium">About</a>
            </div>

            {/* Right actions */}
            <div className="flex items-center space-x-2">
              <Button onClick={handleLogin} variant="outline" className="text-sm px-3 py-2 sm:px-4 hidden sm:flex border-green-700 text-green-700 hover:bg-green-50">
                Sign In
              </Button>
              <Button onClick={() => window.location.href = "/register"} className="btn-nigerian text-sm px-3 py-2 sm:px-4">
                Sign Up
              </Button>
              {/* Mobile Hamburger */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 bg-white z-50 overflow-y-auto">
            <div className="px-4 py-4 space-y-1 pb-24">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-2 pb-1">Explore</p>
              <a href="/products" onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:text-nigerian-green" data-testid="nav-link-products">
                <Package className="w-5 h-5" /><span>Products</span>
              </a>
              <a href="/events" onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:text-nigerian-green" data-testid="nav-link-events">
                <Calendar className="w-5 h-5" /><span>Events</span>
              </a>
              <a href="/collab-drops" onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:text-nigerian-green" data-testid="nav-link-collab-drops">
                <Zap className="w-5 h-5" /><span>Collab Drops</span>
              </a>
              <a href="/discover" onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:text-nigerian-green" data-testid="nav-link-discover">
                <MapPin className="w-5 h-5" /><span>Discover Africa</span>
              </a>
              <a href="#about" onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:text-nigerian-green">
                <Info className="w-5 h-5" /><span>About</span>
              </a>
              <div className="pt-4 border-t border-gray-200 mt-4">
                <Button onClick={() => { setIsMobileMenuOpen(false); window.location.href = "/register"; }} className="w-full btn-nigerian">
                  Sign Up — Create Account
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section with Cultural Carousel */}
      <section className="relative overflow-hidden h-[520px] sm:h-[580px] md:h-[640px]">
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
                Discover Authentic
              </span>
              <span className="block text-amber-300 mt-1 sm:mt-2">
                African Fashion
              </span>
            </h1>
            {/* Full description — hidden on small screens to save space */}
            <p className="hidden sm:block text-base sm:text-xl md:text-2xl mb-6 sm:mb-8 md:mb-12 max-w-4xl mx-auto text-gray-100 leading-relaxed px-4">
              From Nigerian Aso Oke to Ghanaian Kente, Ethiopian habesha to Maasai beadwork — 
              celebrate the rich cultural heritage of all 54 African nations.
            </p>
            {/* Compact description — only on mobile */}
            <p className="block sm:hidden text-sm mb-6 max-w-xs mx-auto text-gray-200 leading-relaxed px-2">
              Authentic fashion from across all 54 African nations.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              <Button
                onClick={() => window.location.href = "/register"}
                size="lg"
                className="bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-black font-bold text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 rounded-full shadow-xl transform hover:scale-105 transition-all duration-200 w-full sm:w-auto max-w-xs sm:max-w-none"
              >
                Create Free Account
              </Button>
              <Button
                size="lg"
                className="bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 font-semibold border border-white/30 hover:border-white/50 text-base px-6 py-3 sm:py-4 rounded-full shadow-xl transform hover:scale-105 transition-all duration-200 w-full sm:w-auto max-w-xs sm:max-w-none"
                onClick={() => setIsVendorModalOpen(true)}
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

      {/* Featured Products Section */}
      <section className="py-12 md:py-20 bg-white" id="products">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold font-nigerian mb-3 md:mb-6 text-gray-900">
              Featured <span className="text-nigerian-green">Collections</span>
            </h2>
            <p className="text-sm sm:text-base md:text-xl text-gray-600 max-w-3xl mx-auto px-2">
              Discover authentic African fashion pieces crafted by local artisans.
            </p>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {products.slice(0, 8).map((product) => (
                <Card key={product.id} className="group hover:shadow-xl transition-shadow duration-300">
                  <div className="relative overflow-hidden rounded-t-lg">
                    <img
                      src={product.imageUrl || (product.images && product.images.length > 0 ? product.images[0] : '/api/placeholder/300/400')}
                      alt={product.name}
                      className="w-full h-36 sm:h-52 md:h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {product.featured && (
                      <Badge className="absolute top-2 left-2 bg-nigerian-gold text-white text-xs px-1.5 py-0.5">
                        Featured
                      </Badge>
                    )}
                    {product.stock <= 5 && product.stock > 0 && (
                      <Badge className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-1.5 py-0.5">
                        Low Stock
                      </Badge>
                    )}
                    {product.stock === 0 && (
                      <Badge className="absolute top-2 right-2 bg-red-500 text-white text-xs px-1.5 py-0.5">
                        Sold Out
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-3 sm:p-4 md:p-6">
                    <h3 className="font-semibold text-xs sm:text-sm md:text-base mb-1 md:mb-2 text-gray-900 group-hover:text-nigerian-green transition-colors line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="hidden sm:block text-gray-600 text-xs md:text-sm mb-2 md:mb-4 line-clamp-2">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between mb-2 md:mb-4">
                      <div className="flex flex-col">
                        <span className="text-sm sm:text-base md:text-xl font-bold text-nigerian-green">
                          ${product.price.toLocaleString()}
                        </span>
                        <LocalPrice usdAmount={product.price} />
                      </div>
                      <span className="hidden sm:block text-xs text-gray-500">
                        {product.stock} left
                      </span>
                    </div>
                    <Button
                      onClick={() => handleAddToCart(product.id)}
                      className="w-full btn-nigerian text-xs sm:text-sm py-1.5 sm:py-2 h-auto"
                      disabled={product.stock === 0}
                    >
                      <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">{product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}</span>
                      <span className="sm:hidden">{product.stock === 0 ? 'Sold Out' : 'Add'}</span>
                    </Button>
                  </CardContent>
                </Card>
              ))}
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
              <Button onClick={handleLogin} size="lg" className="btn-nigerian">
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
            <p className="text-sm sm:text-base md:text-lg text-gray-600">
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
                <p className="text-gray-600">
                  Every product is verified by our cultural experts to ensure authenticity and quality.
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
                <p className="text-gray-600">
                  Fast and secure delivery worldwide via UPS, FedEx, and DHL partnerships.
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
                <p className="text-gray-600">
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
            <p className="text-sm sm:text-base md:text-lg text-gray-600">
              Discover the beauty of African traditional fashion
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            {[
              { name: "Traditional Wear", description: "Authentic African clothing", emoji: "👘" },
              { name: "Aso Oke", description: "Handwoven fabrics", emoji: "🧵" },
              { name: "Beads & Jewelry", description: "Traditional accessories", emoji: "📿" },
              { name: "Modern Fusion", description: "Contemporary designs", emoji: "✨" },
            ].map((category, index) => (
              <Card key={index} className="text-center card-hover">
                <CardContent className="p-4 md:p-6">
                  <div className="text-3xl md:text-4xl mb-2 md:mb-4">{category.emoji}</div>
                  <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">{category.name}</h3>
                  <p className="hidden sm:block text-gray-600 text-xs md:text-sm">{category.description}</p>
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
            <p className="text-sm sm:text-base md:text-lg text-gray-600">
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
                <div className="text-3xl text-gray-400">💳</div>
                <div className="text-3xl text-gray-400">🏦</div>
                <div className="text-3xl text-gray-400">📱</div>
              </div>
              <p className="text-sm text-gray-600">
                Bank Transfer • Mobile Money • Card Payments • Bitcoin
              </p>
            </div>
            
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-6">Delivery Partners</h3>
              <div className="flex justify-center items-center space-x-8 mb-4">
                <Badge variant="outline" className="text-lg font-bold text-blue-600 px-3 py-2">UPS</Badge>
                <Badge variant="outline" className="text-lg font-bold text-purple-600 px-3 py-2">FedEx</Badge>
                <Badge variant="outline" className="text-lg font-bold text-yellow-600 px-3 py-2">DHL</Badge>
              </div>
              <p className="text-sm text-gray-600">
                Fast & Reliable Worldwide Delivery
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-10 md:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 font-nigerian mb-4 md:mb-6" style={{ lineHeight: '1.3' }}>
                Celebrating African Heritage
              </h2>
              <p className="text-gray-600 text-sm sm:text-base md:text-lg mb-4 md:mb-6">
                Afrolandx is more than just an e-commerce platform. We're a cultural bridge 
                connecting African artisans with fashion enthusiasts worldwide. Our mission is 
                to preserve and promote the rich heritage of African traditional fashion while 
                supporting local communities.
              </p>
              <p className="hidden sm:block text-gray-600 text-sm sm:text-base md:text-lg mb-4 md:mb-6">
                Every purchase you make helps support African artisans, preserves traditional 
                crafting techniques, and celebrates the vibrant culture of Africa.
              </p>
              <Button onClick={handleLogin} className="btn-nigerian w-full sm:w-auto">
                Join Our Community
              </Button>
            </div>
            <div className="relative">
              <div className="w-full h-56 sm:h-72 md:h-96 bg-white rounded-xl shadow-2xl overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
                  alt="Beautiful African woman in traditional dress"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6">
                  <h3 className="text-white font-bold text-xl mb-2 drop-shadow-lg">African Heritage</h3>
                  <p className="text-white/90 text-sm drop-shadow-md">Celebrating traditional beauty and craftsmanship</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 md:py-16 bg-nigerian-green text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-6">
            Ready to Explore African Fashion?
          </h2>
          <p className="text-sm sm:text-base md:text-xl mb-6 md:mb-8 opacity-90 max-w-2xl mx-auto px-2">
            Join thousands of fashion enthusiasts who trust Afrolandx for authentic African clothing and accessories.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <Button onClick={handleLogin} size="lg" className="bg-nigerian-gold hover:bg-yellow-600 text-white font-semibold w-full sm:w-auto max-w-xs sm:max-w-none">
              Start Shopping Now
            </Button>
            <Button
              size="lg"
              className="bg-white text-nigerian-green hover:bg-gray-100 font-semibold border-2 border-white w-full sm:w-auto max-w-xs sm:max-w-none"
              onClick={() => setIsVendorModalOpen(true)}
            >
              Become a Vendor
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div>
              <div className="flex items-center text-2xl font-bold font-nigerian mb-4">
                <img 
                  src={logoImage} 
                  alt="Afrolandx Logo" 
                  className="w-8 h-8 mr-2"
                />
                Afrolandx
              </div>
              <p className="text-gray-400 mb-4">
                Connecting the world to authentic African fashion and culture.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Our Story</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Press</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Shipping Info</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Returns</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg mb-4">Business</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" onClick={() => setIsVendorModalOpen(true)} className="hover:text-white transition-colors">Sell with Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Vendor Guidelines</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Partnership</a></li>
                {(!isAuthenticated || (isAuthenticated && isAdmin(user))) && (
                  <li>
                    <button 
                      onClick={handleAdminPortalClick} 
                      className="hover:text-white transition-colors text-left"
                    >
                      Admin Portal
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Afrolandx. Proudly celebrating African heritage worldwide. 🌍</p>
          </div>
        </div>
      </footer>

      {/* Vendor Modal */}
      {isVendorModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-bold">Become a Vendor</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsVendorModalOpen(false)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">
                Join our community of African artisans and designers. Share your authentic 
                fashion creations with customers worldwide.
              </p>
              <div className="space-y-4">
                <div className="flex items-center text-sm text-gray-600">
                  <span className="text-green-600 mr-2">✓</span>
                  Access to global customers
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <span className="text-green-600 mr-2">✓</span>
                  Secure payment processing
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <span className="text-green-600 mr-2">✓</span>
                  Marketing support
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <span className="text-green-600 mr-2">✓</span>
                  Product verification assistance
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <Button onClick={handleLogin} className="w-full btn-nigerian">
                  Get Started as Vendor
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setIsVendorModalOpen(false)}
                >
                  Learn More
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
