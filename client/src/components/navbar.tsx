import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Palette,
  Ruler,
  Search,
  Settings,
  ShoppingCart,
  Star,
  Truck,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { hasFullManagementAccess, hasShippingOperationsAccess } from "@shared/admin-access";
import { useCart } from "@/contexts/CartContext";
import MegaMenu from "@/components/mega-menu";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { isAdmin, isVendor, getUserRoleDisplay } from "@/lib/roleUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import logoImage from "@assets/Group 1000002646_1749631956471.png";

export default function Navbar() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { cartCount, toggleCart } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const fullManagement = hasFullManagementAccess(user);
  const canAccessShipping = !!(
    isAuthenticated &&
    user &&
    (hasShippingOperationsAccess(user) || isVendor(user) || user.isShippingPartner)
  );

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = searchQuery.trim();
    if (term) window.location.href = `/products?search=${encodeURIComponent(term)}`;
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || "U";
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const navLinkClass = (path: string) =>
    `rounded-sm px-2.5 py-2 text-[0.84rem] font-semibold transition-colors ${
      location === path
        ? "text-[#17533f]"
        : "text-[#4c5d53] hover:text-[#17533f]"
    }`;
  const mobileNavLinkClass = (path: string) =>
    `flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors ${
      location === path
        ? "bg-[#e9eee5] text-[#174c3b]"
        : "text-[#334840] hover:bg-[#f2f0e8]"
    }`;

  const accountName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email;

  return (
    <nav className="sticky top-0 z-40 border-b border-[#ded9cd] bg-[#fbf8f0]">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[68px] items-center gap-3 sm:gap-5">
          <Link href="/" aria-label="Afrolandx home" className="flex shrink-0 items-center gap-2">
            <img src={logoImage} alt="" className="h-9 w-9 object-contain" />
            <span
              className="text-[1.18rem] font-bold tracking-[-0.045em] text-[#174c3b] sm:text-[1.35rem]"
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}
            >
              Afrolandx
            </span>
          </Link>

          <div className="hidden shrink-0 items-center gap-0.5 lg:flex">
            <Link href="/products" className={navLinkClass("/products")}>Shop</Link>
            <Link href="/events" className={navLinkClass("/events")}>Events</Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 gap-1 rounded-sm px-2.5 text-[0.84rem] font-semibold text-[#4c5d53] hover:bg-[#f0ece1] hover:text-[#17533f]"
                  aria-label="Open more links"
                >
                  More <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 border-[#e2ddd1] bg-[#fbf8f0]">
                <DropdownMenuItem asChild><Link href="/reviews">Reviews</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/collab-drops">Collab Drops</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/policies">Policies</Link></DropdownMenuItem>
                {isAuthenticated && <DropdownMenuItem asChild><Link href="/lookbook">Lookbook</Link></DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/vendor/apply">Sell with Afrolandx</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <form onSubmit={handleSearch} role="search" className="hidden min-w-0 flex-1 lg:block">
            <label htmlFor="desktop-site-search" className="sr-only">Search the marketplace</label>
            <div className="relative mx-auto max-w-[430px]">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8278]" />
              <Input
                id="desktop-site-search"
                type="search"
                placeholder="Search clothing, cloth, jewellery..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-10 rounded-md border-[#d9d3c5] bg-[#f5f1e7] pl-10 pr-4 text-sm text-[#243a31] placeholder:text-[#7b8278] focus-visible:ring-[#93683b]"
              />
            </div>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCart}
                aria-label={`Open shopping cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
                aria-haspopup="dialog"
                data-testid="button-open-cart"
                className="relative h-10 w-10 rounded-full text-[#365449] hover:bg-[#ecefe7]"
              >
                <ShoppingCart className="h-[1.15rem] w-[1.15rem]" />
                {cartCount > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#a84932] px-1 text-[10px] text-white">
                    {cartCount}
                  </Badge>
                )}
              </Button>
            )}

            {isAuthenticated && user ? (
              <div className="hidden lg:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      aria-label="Open account menu"
                      className="h-10 gap-2 rounded-full pl-1.5 pr-2.5 text-[#315345] hover:bg-[#ecefe7]"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImageUrl} alt={user.firstName || "Account"} />
                        <AvatarFallback className="bg-[#174c3b] text-xs font-semibold text-[#fbf5e7]">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden max-w-24 truncate text-sm font-semibold xl:block">
                        {user.firstName || "Account"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-60 border-[#e2ddd1] bg-[#fbf8f0]" align="end" forceMount>
                    <div className="space-y-1 px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-[#233a31]">{accountName}</p>
                      <p className="truncate text-xs text-[#778077]">{user.email}</p>
                      <Badge variant="secondary" className="mt-1 w-fit bg-[#e9eee5] text-xs text-[#315345]">
                        {getUserRoleDisplay(user)}
                      </Badge>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link href="/my-orders">My Orders</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/messages" className="flex items-center justify-between">
                        Messages
                        {unreadData && unreadData.count > 0 && <Badge className="ml-2 bg-[#a84932] text-white">{unreadData.count}</Badge>}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/measurements">Measurements</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/lookbook">My Lookbook</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/loyalty">Loyalty and Rewards</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/profile">Profile Settings</Link></DropdownMenuItem>
                    {isVendor(user) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild><Link href="/products">Shop as buyer</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link href="/vendor">Vendor Dashboard</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link href="/vendor/workshop">Workshop</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link href="/vendor/finance">Finance and Statements</Link></DropdownMenuItem>
                      </>
                    )}
                    {canAccessShipping && <DropdownMenuItem asChild><Link href="/shipping">Shipping operations</Link></DropdownMenuItem>}
                    {isAdmin(user) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild><Link href="/admin">Admin Panel</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link href="/discover">Discover</Link></DropdownMenuItem>
                        {fullManagement && <DropdownMenuItem asChild><Link href="/admin/finance">Finance Administration</Link></DropdownMenuItem>}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <Link href="/vendor/apply" className="rounded-sm px-2 py-2 text-sm font-semibold text-[#315345] hover:text-[#174c3b]">
                  Sell with us
                </Link>
                <Button
                  onClick={() => { window.location.href = "/login"; }}
                  className="h-10 rounded-md bg-[#174c3b] px-4 font-semibold text-[#fff8e9] hover:bg-[#103e30]"
                >
                  Sign In
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-[#315345] hover:bg-[#ecefe7] lg:hidden"
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation-menu"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      <MegaMenu />

      {isMobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto border-t border-[#e3ded2] bg-[#fbf8f0] lg:hidden"
        >
          <div className="mx-auto max-w-xl px-4 pb-10 pt-4">
            <form onSubmit={handleSearch} role="search" className="mb-5">
              <label htmlFor="mobile-site-search" className="sr-only">Search the marketplace</label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8278]" />
                <Input
                  id="mobile-site-search"
                  type="search"
                  placeholder="Search clothing, cloth, jewellery..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-11 rounded-md border-[#d9d3c5] bg-white pl-10 text-sm"
                />
              </div>
            </form>

            <p className="mb-2 px-4 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#8c7860]">Explore</p>
            <div className="space-y-0.5">
              <Link href="/" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/")}><Home className="h-4 w-4" />Home</span></Link>
              <Link href="/products" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/products")}><Package className="h-4 w-4" />Shop all</span></Link>
              <Link href="/reviews" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/reviews")}><Star className="h-4 w-4" />Reviews</span></Link>
              <Link href="/events" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/events")}><Calendar className="h-4 w-4" />Events</span></Link>
              <Link href="/collab-drops" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/collab-drops")}><Zap className="h-4 w-4" />Collab Drops</span></Link>
              <Link href="/policies" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/policies")}><FileText className="h-4 w-4" />Policies</span></Link>
              {isAuthenticated && <Link href="/lookbook" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/lookbook")}><BookOpen className="h-4 w-4" />Lookbook</span></Link>}
              {isAuthenticated && isAdmin(user) && <Link href="/discover" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/discover")}>Discover</span></Link>}
              <Link href="/vendor/apply" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/vendor/apply")}><Star className="h-4 w-4" />Sell with Afrolandx</span></Link>
            </div>

            {isAuthenticated && user && (
              <>
                <p className="mb-2 mt-6 px-4 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#8c7860]">Your account</p>
                <div className="space-y-0.5">
                  <Link href="/my-orders" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/my-orders")}><ClipboardList className="h-4 w-4" />My Orders</span></Link>
                  <Link href="/messages" onClick={closeMobileMenu}>
                    <span className={mobileNavLinkClass("/messages")}>
                      <MessageSquare className="h-4 w-4" />Messages
                      {unreadData && unreadData.count > 0 && <Badge className="ml-auto bg-[#a84932] text-white">{unreadData.count}</Badge>}
                    </span>
                  </Link>
                  <Link href="/measurements" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/measurements")}><Ruler className="h-4 w-4" />Measurements</span></Link>
                  <Link href="/loyalty" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/loyalty")}><Gift className="h-4 w-4" />Loyalty and Rewards</span></Link>
                  <Link href="/profile" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/profile")}><Settings className="h-4 w-4" />Profile Settings</span></Link>
                </div>
              </>
            )}

            {isAuthenticated && user && isVendor(user) && (
              <>
                <p className="mb-2 mt-6 px-4 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#8c7860]">Maker studio</p>
                <div className="space-y-0.5">
                  <Link href="/vendor" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/vendor")}><Star className="h-4 w-4" />Vendor Dashboard</span></Link>
                  <Link href="/vendor/workshop" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/vendor/workshop")}><Palette className="h-4 w-4" />Workshop</span></Link>
                  <Link href="/vendor/finance" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/vendor/finance")}><CreditCard className="h-4 w-4" />Finance and Statements</span></Link>
                  <Link href="/products" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/products")}><ShoppingCart className="h-4 w-4" />Shop as buyer</span></Link>
                </div>
              </>
            )}

            {isAuthenticated && canAccessShipping && (
              <>
                <p className="mb-2 mt-6 px-4 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#8c7860]">Operations</p>
                <Link href="/shipping" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/shipping")}><Truck className="h-4 w-4" />Shipping operations</span></Link>
              </>
            )}

            {isAuthenticated && isAdmin(user) && (
              <>
                <p className="mb-2 mt-6 px-4 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#8c7860]">Staff access</p>
                <div className="space-y-0.5">
                  <Link href="/admin" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/admin")}>Admin Panel</span></Link>
                  {fullManagement && <Link href="/admin/finance" onClick={closeMobileMenu}><span className={mobileNavLinkClass("/admin/finance")}><CreditCard className="h-4 w-4" />Finance Administration</span></Link>}
                </div>
              </>
            )}

            <div className="mt-6 border-t border-[#e3ded2] pt-4">
              {isAuthenticated && user ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3 px-2">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.profileImageUrl} alt={user.firstName || "Account"} />
                      <AvatarFallback className="bg-[#174c3b] text-sm text-white">{getUserInitials()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#233a31]">{accountName}</p>
                      <Badge variant="secondary" className="mt-0.5 bg-[#e9eee5] text-xs text-[#315345]">{getUserRoleDisplay(user)}</Badge>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => { void handleLogout(); closeMobileMenu(); }} className="shrink-0 border-[#cfc7b7] text-[#315345]">
                    <LogOut className="mr-2 h-4 w-4" />Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Link href="/vendor/apply" onClick={closeMobileMenu} className="flex flex-1 items-center justify-center rounded-md border border-[#cfc7b7] px-4 py-3 text-sm font-semibold text-[#315345]">
                    Sell with us
                  </Link>
                  <Button onClick={() => { window.location.href = "/login"; closeMobileMenu(); }} className="flex-1 bg-[#174c3b] text-[#fff8e9] hover:bg-[#103e30]">
                    Sign In
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
