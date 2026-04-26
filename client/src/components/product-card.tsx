import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LocalPrice from '@/components/LocalPrice';
import type { Product } from '@/types';

// Image optimization utility with responsive sizing
const getOptimizedImageUrl = (imagePath: string, options: {
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
} = {}): string => {
  if (!imagePath) return '';
  
  // If it's already a full URL (cloud storage), return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // If it's a local path, add optimization parameters
  if (imagePath.startsWith('/uploads/')) {
    const { width = 400, height = 400, quality = 85, format = 'jpeg' } = options;
    const params = new URLSearchParams();
    params.set('w', width.toString());
    params.set('h', height.toString());
    params.set('q', quality.toString());
    params.set('f', format);
    
    return `${imagePath}?${params.toString()}`;
  }
  
  return imagePath;
};

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, isAddingToCart, openCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [isAddedToCart, setIsAddedToCart] = useState(false);

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
      return;
    }
    
    addToCart(product.id, 1);
    setIsAddedToCart(true);
    // Open cart drawer to show the added item
    setTimeout(() => {
      openCart();
      setIsAddedToCart(false);
    }, 1500);
  };

  const formatPrice = (price: string) => {
    return `$${parseFloat(price).toLocaleString()}`;
  };

  const getStatusBadge = () => {
    if (product.status === 'approved') {
      return null; // Don't show badge for approved products
    }
    
    const statusStyles = {
      pending: 'badge-pending',
      rejected: 'badge-rejected',
    };

    return (
      <Badge className={`absolute top-2 left-2 ${statusStyles[product.status as keyof typeof statusStyles]}`}>
        {product.status}
      </Badge>
    );
  };

  const isOutOfStock = product.stock <= 0;
  const isAvailable = product.status === 'approved' && !isOutOfStock;

  const imageSrc = product.images && product.images.length > 0
    ? getOptimizedImageUrl(product.images[0], { width: 400, height: 400, quality: 85 })
    : null;

  return (
    <Card className="group cursor-pointer card-hover overflow-hidden flex flex-col">
      <CardContent className="p-0 flex flex-col flex-1">
        {/* Product Image — fixed aspect-ratio container so it never collapses */}
        <div className="relative overflow-hidden w-full" style={{ aspectRatio: '1 / 1' }}>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.onerror = null;
                img.src = "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&h=400&q=75";
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-nigerian-green to-nigerian-gold flex items-center justify-center">
              <div className="text-center text-white">
                <svg className="w-10 h-10 mx-auto mb-1 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                <p className="text-xs opacity-80">No Image</p>
              </div>
            </div>
          )}

          {/* Dark gradient at bottom for readability */}
          <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

          {/* Status Badge */}
          {getStatusBadge()}

          {/* Featured Badge */}
          {product.featured && (
            <Badge className="absolute top-2 right-2 bg-nigerian-gold text-white text-[10px] sm:text-xs px-1.5 py-0.5">
              ⭐ Featured
            </Badge>
          )}

          {/* Out of Stock Overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="destructive" className="text-sm font-semibold">
                Out of Stock
              </Badge>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="p-2.5 sm:p-4 flex flex-col flex-1">
          <h3 className="font-semibold text-xs sm:text-sm md:text-base text-gray-900 mb-1 line-clamp-2 group-hover:text-nigerian-green transition-colors leading-tight">
            {product.name}
          </h3>

          <p className="text-gray-500 text-xs mb-1.5 line-clamp-2 hidden sm:block">
            {product.description}
          </p>

          {/* Price */}
          <div className="flex items-baseline justify-between mb-1.5 sm:mb-2">
            <div className="flex flex-col">
              <span className="text-sm sm:text-lg font-bold text-nigerian-green leading-none">
                {formatPrice(product.price)}
              </span>
              <span className="mt-0.5">
                <LocalPrice usdAmount={parseFloat(product.price)} />
              </span>
            </div>
            <div className="flex items-center text-yellow-500 flex-shrink-0">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="ml-0.5 text-gray-500 text-[10px] sm:text-xs">4.8</span>
            </div>
          </div>

          {/* Stock Info */}
          <p className="text-[10px] sm:text-xs text-gray-400 mb-2">
            {isOutOfStock ? 'Out of Stock' : `${product.stock} in stock`}
            {product.weight && !isOutOfStock && (
              <span className="hidden sm:inline"> · {parseFloat(product.weight)}kg</span>
            )}
          </p>

          {/* Buttons — pushed to bottom */}
          <div className="mt-auto space-y-1.5">
            <Button
              onClick={handleAddToCart}
              disabled={!isAvailable || isAddingToCart || isAddedToCart}
              size="sm"
              className={`w-full text-xs sm:text-sm transition-all duration-200 ${
                isAddedToCart ? 'bg-green-600 hover:bg-green-600' : 'btn-nigerian'
              }`}
              data-testid="button-add-to-cart"
            >
              {isAddingToCart ? (
                <span className="flex items-center justify-center gap-1">
                  <div className="spinner-nigerian w-3 h-3"></div>
                  Adding…
                </span>
              ) : isAddedToCart ? (
                <span className="flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Added!
                </span>
              ) : !isAvailable ? (
                isOutOfStock ? 'Out of Stock' : 'Unavailable'
              ) : !isAuthenticated ? (
                'Login to Buy'
              ) : (
                'Add to Cart'
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs sm:text-sm border-nigerian-green text-nigerian-green hover:bg-nigerian-green hover:text-white"
              onClick={() => {
                alert(`Product Details:\n\nName: ${product.name}\nDescription: ${product.description}\nPrice: $${parseFloat(product.price).toLocaleString()}\nStock: ${product.stock}\nWeight: ${product.weight ? parseFloat(product.weight) + 'kg' : 'Not specified'}\nStatus: ${product.status}`);
              }}
            >
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
