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
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-50 to-transparent"></div>
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
              <div className="w-full h-96 rounded-xl shadow-2xl overflow-hidden">
                <svg
                  className="w-full h-full object-cover"
                  viewBox="0 0 400 400"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Background gradient */}
                  <defs>
                    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#008751" />
                      <stop offset="50%" stopColor="#D4AF37" />
                      <stop offset="100%" stopColor="#FF6B35" />
                    </linearGradient>
                    <pattern id="pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                      <circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)" />
                    </pattern>
                  </defs>
                  
                  <rect width="400" height="400" fill="url(#bgGradient)" />
                  <rect width="400" height="400" fill="url(#pattern)" />
                  
                  {/* Nigerian woman in traditional dress */}
                  <g transform="translate(200, 50)">
                    {/* Head */}
                    <circle cx="0" cy="40" r="25" fill="#8B4513" stroke="#654321" strokeWidth="2" />
                    
                    {/* Hair/Head wrap (Gele) */}
                    <path d="M -30 25 Q -35 10 -20 15 Q 0 5 20 15 Q 35 10 30 25 Q 25 35 15 40 Q 0 45 -15 40 Q -25 35 -30 25 Z" 
                          fill="#D4AF37" stroke="#B8860B" strokeWidth="2" />
                    
                    {/* Face features */}
                    <circle cx="-8" cy="35" r="2" fill="#2F1B14" />
                    <circle cx="8" cy="35" r="2" fill="#2F1B14" />
                    <path d="M -5 45 Q 0 50 5 45" stroke="#2F1B14" strokeWidth="2" fill="none" />
                    
                    {/* Traditional dress body */}
                    <rect x="-40" y="65" width="80" height="120" rx="10" 
                          fill="#008751" stroke="#006B3F" strokeWidth="2" />
                    
                    {/* Dress patterns */}
                    <rect x="-35" y="75" width="15" height="15" fill="#D4AF37" />
                    <rect x="-10" y="75" width="15" height="15" fill="#D4AF37" />
                    <rect x="15" y="75" width="15" height="15" fill="#D4AF37" />
                    <rect x="-35" y="105" width="15" height="15" fill="#D4AF37" />
                    <rect x="-10" y="105" width="15" height="15" fill="#D4AF37" />
                    <rect x="15" y="105" width="15" height="15" fill="#D4AF37" />
                    
                    {/* Arms */}
                    <rect x="-55" y="75" width="15" height="60" rx="7" fill="#8B4513" />
                    <rect x="40" y="75" width="15" height="60" rx="7" fill="#8B4513" />
                    
                    {/* Traditional jewelry (beads) */}
                    <circle cx="0" cy="65" r="15" fill="none" stroke="#FF6B35" strokeWidth="4" />
                    <circle cx="0" cy="65" r="12" fill="none" stroke="#D4AF37" strokeWidth="3" />
                    
                    {/* Wrapper (bottom traditional skirt) */}
                    <rect x="-45" y="185" width="90" height="100" rx="15" 
                          fill="#FF6B35" stroke="#E55527" strokeWidth="2" />
                    
                    {/* Wrapper patterns */}
                    <path d="M -40 200 L 40 200 M -40 220 L 40 220 M -40 240 L 40 240" 
                          stroke="#D4AF37" strokeWidth="3" />
                  </g>
                  
                  {/* Decorative elements */}
                  <g fill="#D4AF37" opacity="0.6">
                    <circle cx="50" cy="100" r="3" />
                    <circle cx="350" cy="150" r="4" />
                    <circle cx="80" cy="300" r="2" />
                    <circle cx="320" cy="320" r="3" />
                  </g>
                  
                  {/* Text overlay */}
                  <text x="200" y="360" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
                    Authentic Nigerian Beauty
                  </text>
                </svg>
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
