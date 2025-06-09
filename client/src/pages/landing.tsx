import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Landing() {
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-nigerian-green font-nigerian">
                <span className="text-nigerian-gold">👑</span> NaijaFashion
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
      <section className="relative bg-gradient-to-r from-nigerian-green to-green-700 text-white pattern-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold font-nigerian mb-6 text-white drop-shadow-lg">
              Discover Authentic Nigerian Fashion
            </h1>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto text-white drop-shadow-md">
              From traditional Aso Oke to contemporary native wear, find the finest Nigerian fashion pieces 
              crafted by local artisans. Celebrate our rich cultural heritage.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={handleLogin} size="lg" className="bg-nigerian-gold hover:bg-yellow-600 text-white font-semibold">
                Start Shopping
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
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 font-nigerian mb-4">
              Why Choose NaijaFashion?
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
              <h2 className="text-4xl font-bold text-gray-900 font-nigerian mb-6">
                Celebrating Nigerian Heritage
              </h2>
              <p className="text-gray-600 text-lg mb-6">
                NaijaFashion is more than just an e-commerce platform. We're a cultural bridge 
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
              <div className="w-full h-96 bg-gradient-to-br from-nigerian-green via-nigerian-gold to-coral rounded-xl shadow-2xl flex items-center justify-center">
                <div className="text-center text-white p-8">
                  <div className="text-6xl mb-4">👑</div>
                  <h3 className="text-2xl font-bold mb-2">Authentic Nigerian Fashion</h3>
                  <p className="text-lg opacity-90">Traditional • Modern • Timeless</p>
                  <div className="flex justify-center space-x-4 mt-4 text-3xl">
                    <span>👘</span>
                    <span>🧵</span>
                    <span>📿</span>
                    <span>✨</span>
                  </div>
                </div>
              </div>
              <div className="absolute inset-0 cultural-overlay rounded-xl opacity-10"></div>
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
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 NaijaFashion. Proudly celebrating Nigerian heritage worldwide. 🇳🇬</p>
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
