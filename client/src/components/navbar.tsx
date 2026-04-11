import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/contexts/CartContext';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { isAdmin, isVendor, getUserRoleDisplay } from '@/lib/roleUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShoppingCart, Menu, X, Search, Home, Package, Calendar, Star, MapPin, BookOpen, Gift, MessageSquare, Ruler, ClipboardList, User, Settings, LogOut, Palette, Zap } from 'lucide-react';
import logoImage from '@assets/Group 1000002646_1749631956471.png';

export default function Navbar() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { cartCount, toggleCart } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/messages/unread-count'],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchQuery)}`;
    }
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleLogin = () => {
    window.location.href = '/login';
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const navLinkClass = (path: string) =>
    `px-3 py-2 font-medium transition-colors ${
      location === path
        ? 'text-nigerian-green border-b-2 border-nigerian-green'
        : 'text-gray-700 hover:text-nigerian-green'
    }`;

  const mobileNavLinkClass = (path: string) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
      location === path
        ? 'bg-green-50 text-nigerian-green'
        : 'text-gray-700 hover:bg-gray-50 hover:text-nigerian-green'
    }`;

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/">
              <div className="flex items-center text-xl font-bold text-nigerian-green font-nigerian cursor-pointer">
                <img src={logoImage} alt="Afrolandx Logo" className="w-8 h-8 mr-2" />
                <span className="hidden sm:block">Afrolandx</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:ml-8 md:flex md:space-x-2">
              <Link href="/" className={navLinkClass('/')}>Home</Link>
              <Link href="/products" className={navLinkClass('/products')}>Products</Link>
              <Link href="/events" className={navLinkClass('/events')}>Events</Link>
              <Link href="/collab-drops" className={navLinkClass('/collab-drops')}>Collabs</Link>
              <Link href="/discover" className={navLinkClass('/discover')}>Discover</Link>
              {isAuthenticated && isVendor(user) && (
                <Link href="/vendor" className={navLinkClass('/vendor')}>Vendor</Link>
              )}
              {isAuthenticated && isAdmin(user) && (
                <Link href="/admin" className={`px-3 py-2 font-medium transition-colors ${
                  location === '/admin' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-700 hover:text-red-600'
                }`}>Admin</Link>
              )}
            </div>
          </div>

          {/* Desktop Search Bar */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <form onSubmit={handleSearch} className="relative w-full">
              <Input
                type="text"
                placeholder="Search traditional wear, Aso Oke, beads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 input-nigerian h-10"
              />
            </form>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-2">
            {/* Shopping Cart */}
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCart}
                className="relative text-gray-700 hover:text-nigerian-green"
              >
                <ShoppingCart className="w-6 h-6" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-coral text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full">
                    {cartCount}
                  </Badge>
                )}
              </Button>
            )}

            {/* Desktop User Menu */}
            {isAuthenticated && user ? (
              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImageUrl} alt={user.firstName || 'User'} />
                        <AvatarFallback className="bg-nigerian-green text-white text-sm">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex flex-col space-y-1 p-2">
                      <p className="text-sm font-medium leading-none">
                        {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      <Badge variant="secondary" className="w-fit text-xs">{getUserRoleDisplay(user)}</Badge>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem><Link href="/my-orders"><span className="cursor-pointer">My Orders</span></Link></DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/messages">
                        <span className="cursor-pointer flex items-center justify-between">
                          Messages
                          {unreadData && unreadData.count > 0 && (
                            <Badge variant="default" className="ml-2">{unreadData.count}</Badge>
                          )}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem><Link href="/measurements"><span className="cursor-pointer">Measurements</span></Link></DropdownMenuItem>
                    <DropdownMenuItem><Link href="/lookbook"><span className="cursor-pointer">My Lookbook</span></Link></DropdownMenuItem>
                    <DropdownMenuItem><Link href="/loyalty"><span className="cursor-pointer">Loyalty & Rewards</span></Link></DropdownMenuItem>
                    <DropdownMenuItem><Link href="/profile"><span className="cursor-pointer">Profile Settings</span></Link></DropdownMenuItem>
                    {isVendor(user) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem><Link href="/vendor"><span className="cursor-pointer">Vendor Dashboard</span></Link></DropdownMenuItem>
                        <DropdownMenuItem><Link href="/vendor/workshop"><span className="cursor-pointer">Workshop</span></Link></DropdownMenuItem>
                      </>
                    )}
                    {isAdmin(user) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem><Link href="/admin"><span className="cursor-pointer">Admin Panel</span></Link></DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>Sign Out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Button onClick={handleLogin} className="btn-nigerian hidden md:flex">
                Sign In
              </Button>
            )}

            {/* Mobile Menu Button */}
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

      {/* Mobile Menu - Full Screen Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white z-50 overflow-y-auto">
          <div className="px-4 py-4 space-y-1 pb-24">
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-nigerian pl-10"
                />
              </div>
            </form>

            {/* Main Navigation */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-2 pb-1">Browse</p>
            <Link href="/" onClick={closeMobileMenu}>
              <div className={mobileNavLinkClass('/')}><Home className="w-5 h-5" /><span>Home</span></div>
            </Link>
            <Link href="/products" onClick={closeMobileMenu}>
              <div className={mobileNavLinkClass('/products')}><Package className="w-5 h-5" /><span>Products</span></div>
            </Link>
            <Link href="/events" onClick={closeMobileMenu}>
              <div className={mobileNavLinkClass('/events')}><Calendar className="w-5 h-5" /><span>Events</span></div>
            </Link>
            <Link href="/collab-drops" onClick={closeMobileMenu}>
              <div className={mobileNavLinkClass('/collab-drops')}><Zap className="w-5 h-5" /><span>Collab Drops</span></div>
            </Link>
            <Link href="/discover" onClick={closeMobileMenu}>
              <div className={mobileNavLinkClass('/discover')}><MapPin className="w-5 h-5" /><span>Discover Africa</span></div>
            </Link>
            <Link href="/lookbook" onClick={closeMobileMenu}>
              <div className={mobileNavLinkClass('/lookbook')}><BookOpen className="w-5 h-5" /><span>Lookbook Studio</span></div>
            </Link>

            {/* Account Section - only if logged in */}
            {isAuthenticated && user && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-4 pb-1">My Account</p>
                <Link href="/my-orders" onClick={closeMobileMenu}>
                  <div className={mobileNavLinkClass('/my-orders')}><ClipboardList className="w-5 h-5" /><span>My Orders</span></div>
                </Link>
                <Link href="/messages" onClick={closeMobileMenu}>
                  <div className={mobileNavLinkClass('/messages')}>
                    <MessageSquare className="w-5 h-5" />
                    <span>Messages</span>
                    {unreadData && unreadData.count > 0 && (
                      <Badge variant="default" className="ml-auto">{unreadData.count}</Badge>
                    )}
                  </div>
                </Link>
                <Link href="/measurements" onClick={closeMobileMenu}>
                  <div className={mobileNavLinkClass('/measurements')}><Ruler className="w-5 h-5" /><span>Measurements</span></div>
                </Link>
                <Link href="/loyalty" onClick={closeMobileMenu}>
                  <div className={mobileNavLinkClass('/loyalty')}><Gift className="w-5 h-5" /><span>Loyalty & Rewards</span></div>
                </Link>
                <Link href="/profile" onClick={closeMobileMenu}>
                  <div className={mobileNavLinkClass('/profile')}><Settings className="w-5 h-5" /><span>Profile Settings</span></div>
                </Link>
              </>
            )}

            {/* Vendor Section */}
            {isAuthenticated && isVendor(user) && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-4 pb-1">Vendor</p>
                <Link href="/vendor" onClick={closeMobileMenu}>
                  <div className={mobileNavLinkClass('/vendor')}><Star className="w-5 h-5" /><span>Vendor Dashboard</span></div>
                </Link>
                <Link href="/vendor/workshop" onClick={closeMobileMenu}>
                  <div className={mobileNavLinkClass('/vendor/workshop')}><Palette className="w-5 h-5" /><span>Workshop</span></div>
                </Link>
              </>
            )}

            {/* Admin Section */}
            {isAuthenticated && isAdmin(user) && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-4 pb-1">Admin</p>
                <Link href="/admin" onClick={closeMobileMenu}>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-red-600 hover:bg-red-50">
                    <User className="w-5 h-5" /><span>Admin Panel</span>
                  </div>
                </Link>
              </>
            )}

            {/* Auth Actions */}
            <div className="pt-4 border-t border-gray-200 mt-4">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-4 py-2">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user?.profileImageUrl} />
                      <AvatarFallback className="bg-nigerian-green text-white">{getUserInitials()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email}
                      </p>
                      <Badge variant="secondary" className="text-xs">{getUserRoleDisplay(user)}</Badge>
                    </div>
                  </div>
                  <Button
                    onClick={() => { handleLogout(); closeMobileMenu(); }}
                    variant="outline"
                    className="w-full flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </Button>
                </div>
              ) : (
                <Button onClick={() => { handleLogin(); closeMobileMenu(); }} className="w-full btn-nigerian">
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
