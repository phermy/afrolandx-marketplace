import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/roleUtils";
import { ShoppingCart } from "lucide-react";
import type { Product } from "@/types";

export default function Landing() {
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

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
    window.location.href = "/api/login";
  };

  const handleAdminPortalClick = () => {
    // Redirect to login with admin intent
    window.location.href = '/api/login?redirect=/admin';
  };

  const handleAddToCart = (productId: number) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add items to your cart",
        variant: "default",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
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
            <div className="flex items-center">
              <div className="text-2xl font-bold text-nigerian-green font-nigerian">
                <span className="text-nigerian-gold">👑</span> Afrolandx
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-6">
              <a href="#features" className="text-gray-700 hover:text-nigerian-green transition-colors">Features</a>
              <a href="#about" className="text-gray-700 hover:text-nigerian-green transition-colors">About</a>
              <a href="#contact" className="text-gray-700 hover:text-nigerian-green transition-colors">Contact</a>
            </div>

            <div className="flex items-center space-x-4">
              <Button onClick={handleLogin} className="btn-nigerian">
                Sign In / Sign Up
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-green-900 to-emerald-800"></div>
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D4AF37' fill-opacity='0.08'%3E%3Cpath d='M30 30c0-16.569 13.431-30 30-30v30H30zM0 30c0-16.569 13.431-30 30-30v30H0z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }}></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="text-center">
            <h1 className="text-6xl md:text-7xl font-bold font-nigerian mb-8 text-white">
              <span className="block bg-gradient-to-r from-white via-yellow-200 to-amber-300 bg-clip-text text-transparent">
                Discover Authentic
              </span>
              <span className="block text-amber-300 mt-2">
                Nigerian Fashion
              </span>
            </h1>
            <p className="text-xl md:text-2xl mb-12 max-w-4xl mx-auto text-gray-100 leading-relaxed">
              From traditional Aso Oke to contemporary native wear, find the finest Nigerian fashion pieces 
              crafted by local artisans. Celebrate our rich cultural heritage with authentic designs.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Button 
                onClick={handleLogin} 
                size="lg" 
                className="bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-black font-bold text-lg px-8 py-4 rounded-full shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                Start Shopping
              </Button>
              <Button 
                size="lg" 
                className="bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 font-semibold border-2 border-white/30 hover:border-white/50 text-lg px-8 py-4 rounded-full shadow-xl transform hover:scale-105 transition-all duration-200"
                onClick={() => setIsVendorModalOpen(true)}
              >
                Become a Vendor
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-20 bg-white" id="products">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-nigerian mb-6 text-gray-900">
              Featured <span className="text-nigerian-green">Collections</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover authentic Nigerian fashion pieces crafted by local artisans. 
              Each piece tells a story of our rich cultural heritage.
            </p>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {products.slice(0, 8).map((product) => (
                <Card key={product.id} className="group hover:shadow-xl transition-shadow duration-300">
                  <div className="relative overflow-hidden rounded-t-lg">
                    <img
                      src={product.imageUrl || (product.images && product.images.length > 0 ? product.images[0] : '/api/placeholder/300/400')}
                      alt={product.name}
                      className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {product.featured && (
                      <Badge className="absolute top-3 left-3 bg-nigerian-gold text-white">
                        Featured
                      </Badge>
                    )}
                    {product.stock <= 5 && product.stock > 0 && (
                      <Badge className="absolute top-3 right-3 bg-orange-500 text-white">
                        Low Stock
                      </Badge>
                    )}
                    {product.stock === 0 && (
                      <Badge className="absolute top-3 right-3 bg-red-500 text-white">
                        Out of Stock
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-2 text-gray-900 group-hover:text-nigerian-green transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-bold text-nigerian-green">
                        ₦{product.price.toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {product.stock} left
                      </span>
                    </div>
                    <Button 
                      onClick={() => handleAddToCart(product.id)}
                      className="w-full btn-nigerian"
                      disabled={product.stock === 0}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                New products coming soon! Check back later for amazing Nigerian fashion pieces.
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
      <section id="features" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 font-nigerian mb-4">
              Why Choose Afrolandx?
            </h2>
            <p className="text-gray-600 text-lg">
              Your trusted marketplace for authentic Nigerian fashion
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center card-hover">
              <CardContent className="p-8">
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
              <CardContent className="p-8">
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
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-coral rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Support Artisans</h3>
                <p className="text-gray-600">
                  Direct connection with Nigerian artisans and designers, supporting local communities.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Product Categories Preview */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 font-nigerian mb-4">
              Explore Our Categories
            </h2>
            <p className="text-gray-600 text-lg">
              Discover the beauty of Nigerian traditional fashion
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { name: "Traditional Wear", description: "Authentic Nigerian clothing", emoji: "👘" },
              { name: "Aso Oke", description: "Handwoven fabrics", emoji: "🧵" },
              { name: "Beads & Jewelry", description: "Traditional accessories", emoji: "📿" },
              { name: "Modern Fusion", description: "Contemporary designs", emoji: "✨" },
            ].map((category, index) => (
              <Card key={index} className="text-center card-hover">
                <CardContent className="p-6">
                  <div className="text-4xl mb-4">{category.emoji}</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{category.name}</h3>
                  <p className="text-gray-600 text-sm">{category.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Payment & Shipping */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 font-nigerian mb-4">
              Secure Payment & Fast Delivery
            </h2>
            <p className="text-gray-600 text-lg">
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
      <section id="about" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 font-nigerian mb-6" style={{ lineHeight: '1.3', paddingBottom: '0.3em' }}>
                Celebrating Nigerian Heritage
              </h2>
              <p className="text-gray-600 text-lg mb-6">
                Afrolandx is more than just an e-commerce platform. We're a cultural bridge 
                connecting Nigerian artisans with fashion enthusiasts worldwide. Our mission is 
                to preserve and promote the rich heritage of Nigerian traditional fashion while 
                supporting local communities.
              </p>
              <p className="text-gray-600 text-lg mb-6">
                Every purchase you make helps support Nigerian artisans, preserves traditional 
                crafting techniques, and celebrates the vibrant culture of Nigeria.
              </p>
              <Button onClick={handleLogin} className="btn-nigerian">
                Join Our Community
              </Button>
            </div>
            <div className="relative">
              <div className="w-full h-96 bg-white rounded-xl shadow-2xl overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
                  alt="Beautiful Nigerian woman in traditional dress"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6">
                  <h3 className="text-white font-bold text-xl mb-2 drop-shadow-lg">Nigerian Heritage</h3>
                  <p className="text-white/90 text-sm drop-shadow-md">Celebrating traditional beauty and craftsmanship</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-nigerian-green text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Explore Nigerian Fashion?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands of fashion enthusiasts who trust NaijaFashion for authentic Nigerian clothing and accessories.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={handleLogin} size="lg" className="bg-nigerian-gold hover:bg-yellow-600 text-white font-semibold">
              Start Shopping Now
            </Button>
            <Button 
              size="lg" 
              className="bg-white text-nigerian-green hover:bg-gray-100 font-semibold border-2 border-white"
              onClick={() => setIsVendorModalOpen(true)}
            >
              Become a Vendor
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="text-2xl font-bold font-nigerian mb-4">
                <span className="text-nigerian-gold">👑</span> NaijaFashion
              </div>
              <p className="text-gray-400 mb-4">
                Connecting the world to authentic Nigerian fashion and culture.
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
            <p>&copy; 2025 Afrolandx. Proudly celebrating Nigerian heritage worldwide. 🇳🇬</p>
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
                Join our community of Nigerian artisans and designers. Share your authentic 
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
