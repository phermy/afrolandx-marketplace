import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
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

export default function Navbar() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { cartCount, toggleCart } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  const handleLogin = () => {
    window.location.href = '/api/login';
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

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/">
              <div className="text-2xl font-bold text-nigerian-green font-nigerian cursor-pointer">
                <span className="text-nigerian-gold">👑</span> NaijaFashion
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:ml-8 md:flex md:space-x-8">
              <Link href="/">
                <a className={`px-3 py-2 font-medium transition-colors ${
                  location === '/' 
                    ? 'text-nigerian-green border-b-2 border-nigerian-green' 
                    : 'text-gray-700 hover:text-nigerian-green'
                }`}>
                  Home
                </a>
              </Link>
              <Link href="/products">
                <a className={`px-3 py-2 font-medium transition-colors ${
                  location === '/products' 
                    ? 'text-nigerian-green border-b-2 border-nigerian-green' 
                    : 'text-gray-700 hover:text-nigerian-green'
                }`}>
                  Products
                </a>
              </Link>
              {isAuthenticated && user?.role === 'vendor' && (
                <Link href="/vendor">
                  <a className={`px-3 py-2 font-medium transition-colors ${
                    location === '/vendor' 
                      ? 'text-nigerian-green border-b-2 border-nigerian-green' 
                      : 'text-gray-700 hover:text-nigerian-green'
                  }`}>
                    Vendor Portal
                  </a>
                </Link>
              )}
              {isAuthenticated && user?.role === 'admin' && (
                <Link href="/admin">
                  <a className={`px-3 py-2 font-medium transition-colors ${
                    location === '/admin' 
                      ? 'text-red-600 border-b-2 border-red-600' 
                      : 'text-gray-700 hover:text-red-600'
                  }`}>
                    Admin Panel
                  </a>
                </Link>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <form onSubmit={handleSearch} className="relative w-full">
              <Input
                type="text"
                placeholder="Search for traditional wear, Aso Oke, beads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 input-nigerian"
              />
              <svg
                className="absolute left-3 top-3 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </form>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Shopping Cart */}
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCart}
                className="relative text-gray-700 hover:text-nigerian-green"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5M7 13v6a2 2 0 002 2h6a2 2 0 002-2v-6m-8 0V9a2 2 0 012-2h4a2 2 0 012 2v4.01"
                  />
                </svg>
                {cartCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-coral text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full">
                    {cartCount}
                  </Badge>
                )}
              </Button>
            )}

            {/* User Menu or Login */}
            {isAuthenticated && user ? (
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
                      {user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : user.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                    <Badge variant="secondary" className="w-fit text-xs">
                      {user.role}
                    </Badge>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link href="/orders">
                      <span className="cursor-pointer">My Orders</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/profile">
                      <span className="cursor-pointer">Profile Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  {user.role === 'vendor' && (
                    <DropdownMenuItem>
                      <Link href="/vendor">
                        <span className="cursor-pointer">Vendor Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {user.role === 'admin' && (
                    <DropdownMenuItem>
                      <Link href="/admin">
                        <span className="cursor-pointer">Admin Panel</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={handleLogin} className="btn-nigerian">
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
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="mb-4">
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-nigerian"
              />
            </form>

            {/* Mobile Navigation Links */}
            <div className="space-y-2">
              <Link href="/">
                <a className="block px-3 py-2 text-gray-700 hover:text-nigerian-green font-medium">
                  Home
                </a>
              </Link>
              <Link href="/products">
                <a className="block px-3 py-2 text-gray-700 hover:text-nigerian-green font-medium">
                  Products
                </a>
              </Link>
              {isAuthenticated && user?.role === 'vendor' && (
                <Link href="/vendor">
                  <a className="block px-3 py-2 text-gray-700 hover:text-nigerian-green font-medium">
                    Vendor Portal
                  </a>
                </Link>
              )}
              {isAuthenticated && user?.role === 'admin' && (
                <Link href="/admin">
                  <a className="block px-3 py-2 text-gray-700 hover:text-red-600 font-medium">
                    Admin Panel
                  </a>
                </Link>
              )}
            </div>

            {/* Mobile Auth Actions */}
            {!isAuthenticated && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Button onClick={handleLogin} className="w-full btn-nigerian">
                  Sign In
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
