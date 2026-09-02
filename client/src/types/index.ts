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
  contactName?: string;
  businessName: string;
  phone?: string;
  cacNumber?: string;
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
  shortDescription?: string | null;
  description: string;
  price: string;
  compareAtPrice?: string | null;
  sku?: string | null;
  stock: number;
  weight?: string;
  dimensions?: string | null;
  shippingClass?: string | null;
  processingTime?: string | null;
  careInstructions?: string | null;
  returnPolicy?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  requiresMeasurements?: boolean | null;
  tags?: string[];
  variants?: Array<{
    size?: string;
    color?: string;
    pattern?: string;
    sku?: string;
    stock: number;
  }>;
  imageUrl?: string;
  images: string[];
  sizes?: string[]; // available sizes e.g. ["XS","S","M","L","XL"]
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  featured: boolean;
  gender?: string | null;
  originCountry?: string | null;
  traditionalName?: string | null;
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
  selectedSize?: string | null;
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
  localPrice?: number;
  localCurrency?: string;
  localSymbol?: string;
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
  currency: 'USD';
  currencySymbol: '$';
  supportedCountries: string[];
  defaultShippingMethods: ShippingQuote[];
  paymentMethods: {
    paystack: boolean;
    bankTransfer: boolean;
    mobileMoney: boolean;
  };
}
