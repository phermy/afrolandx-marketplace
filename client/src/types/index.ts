// Type definitions for the Nigerian Fashion E-commerce Platform

export interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: number;
  userId: string;
  businessName: string;
  description?: string;
  status: 'pending' | 'approved' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
}

export interface Product {
  id: number;
  vendorId: number;
  categoryId: number;
  name: string;
  description: string;
  price: string;
  quantity: number;
  weight?: string;
  images: string[];
  status: 'pending' | 'approved' | 'rejected';
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductWithDetails extends Product {
  vendor: Vendor;
  category: Category;
}

export interface CartItem {
  id: number;
  userId: string;
  productId: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  product: Product;
}

export interface Order {
  id: number;
  userId: string;
  totalAmount: string;
  shippingAmount: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  orderStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: ShippingAddress;
  paymentReference?: string;
  shippingMethod?: 'ups' | 'fedex' | 'dhl';
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  priceAtTime: string;
  createdAt: string;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface ShippingQuote {
  carrier: 'UPS' | 'FedEx' | 'DHL';
  service: string;
  price: number;
  duration: string;
}

export interface AdminStats {
  totalVendors: number;
  totalProducts: number;
  pendingApprovals: number;
  approvedVendors: number;
}

// Form types
export interface VendorRegistrationForm {
  businessName: string;
  description: string;
}

export interface ProductForm {
  name: string;
  description: string;
  price: string;
  quantity: number;
  categoryId: number;
  weight?: number;
  images?: File[];
}

export interface CheckoutForm {
  shippingAddress: ShippingAddress;
  shippingMethod: string;
  paymentMethod: string;
}

// API Response types
export interface ApiError {
  message: string;
  errors?: any[];
}

export interface PaystackResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

// Cart context types
export interface CartContextType {
  cartItems: CartItem[];
  isCartOpen: boolean;
  cartTotal: number;
  cartCount: number;
  addToCart: (productId: number, quantity?: number) => void;
  removeFromCart: (cartItemId: number) => void;
  updateQuantity: (cartItemId: number, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

// Search and filter types
export interface ProductFilters {
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  status?: string;
  featured?: boolean;
  vendorId?: number;
  search?: string;
}

export interface SortOption {
  value: string;
  label: string;
}

// Nigerian-specific types
export interface NigerianState {
  name: string;
  code: string;
}

export interface NaijaFashionConfig {
  currency: 'NGN';
  currencySymbol: '₦';
  supportedCountries: string[];
  defaultShippingMethods: ShippingQuote[];
  paymentMethods: {
    paystack: boolean;
    bankTransfer: boolean;
    mobileMoney: boolean;
  };
}
