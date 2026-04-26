import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LocalPrice from '@/components/LocalPrice';
import type { Product } from '@/types';

/** Returns the best URL to display for a product image */
const resolveImageUrl = (imagePath: string): string => {
  if (!imagePath) return '';
  // Already an absolute URL (S3, Unsplash, etc.)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  // Local upload — strip any stale query params and return clean path
  if (imagePath.startsWith('/uploads/')) {
    return imagePath.split('?')[0];
  }
  return imagePath;
};

const FALLBACK_URL =
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&h=400&q=75';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, isAddingToCart, openCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [isAddedToCart, setIsAddedToCart] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }
    addToCart(product.id, 1);
    setIsAddedToCart(true);
    setTimeout(() => {
      openCart();
      setIsAddedToCart(false);
    }, 1500);
  };

  const formatPrice = (price: string) => `$${parseFloat(price).toLocaleString()}`;

  const getStatusBadge = () => {
    if (product.status === 'approved') return null;
    const styles: Record<string, string> = {
      pending: 'badge-pending',
      rejected: 'badge-rejected',
    };
    return (
      <Badge className={`absolute top-2 left-2 z-10 ${styles[product.status] ?? ''}`}>
        {product.status}
      </Badge>
    );
  };

  const isOutOfStock = product.stock <= 0;
  const isAvailable = product.status === 'approved' && !isOutOfStock;

  const rawSrc =
    product.images && product.images.length > 0
      ? resolveImageUrl(product.images[0])
      : null;

  const displaySrc = imgError || !rawSrc ? FALLBACK_URL : rawSrc;

  return (
    <Card className="group cursor-pointer card-hover overflow-hidden flex flex-col">
      <CardContent className="p-0 flex flex-col flex-1">

        {/* ── Image container ─────────────────────────────────────────
            Uses the padding-bottom trick: height = 0, paddingBottom = 100%
            gives a perfect 1:1 aspect ratio that works in ALL browsers,
            including Safari iOS < 15 which doesn't fully support aspect-ratio.
        ─────────────────────────────────────────────────────────── */}
        <div
          className="relative w-full overflow-hidden bg-gray-100"
          style={{ height: 0, paddingBottom: '100%' }}
        >
          <img
            src={displaySrc}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            /* eager so images load immediately — avoids lazy-load timing
               issues inside iframes and mobile embedded browsers */
            loading="eager"
            decoding="async"
            onError={() => setImgError(true)}
          />

          {/* Subtle bottom gradient for badge legibility */}
          <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-10" />

          {/* Status badge */}
          {getStatusBadge()}

          {/* Featured badge */}
          {product.featured && (
            <Badge className="absolute top-2 right-2 z-10 bg-nigerian-gold text-white text-[10px] sm:text-xs px-1.5 py-0.5">
              ⭐ Featured
            </Badge>
          )}

          {/* Out-of-stock overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center">
              <Badge variant="destructive" className="text-sm font-semibold">
                Out of Stock
              </Badge>
            </div>
          )}
        </div>

        {/* ── Product details ──────────────────────────────────────── */}
        <div className="p-2.5 sm:p-4 flex flex-col flex-1">
          <h3 className="font-semibold text-xs sm:text-sm md:text-base text-gray-900 mb-1 line-clamp-2 group-hover:text-nigerian-green transition-colors leading-tight">
            {product.name}
          </h3>

          <p className="text-gray-500 text-xs mb-1.5 line-clamp-2 hidden sm:block">
            {product.description}
          </p>

          {/* Price row */}
          <div className="flex items-start justify-between mb-1.5 sm:mb-2 gap-1">
            <div className="flex flex-col min-w-0">
              <span className="text-sm sm:text-lg font-bold text-nigerian-green leading-none">
                {formatPrice(product.price)}
              </span>
              <span className="mt-0.5 text-[10px] sm:text-xs">
                <LocalPrice usdAmount={parseFloat(product.price)} />
              </span>
            </div>
            <div className="flex items-center text-yellow-500 flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="ml-0.5 text-gray-500 text-[10px]">4.8</span>
            </div>
          </div>

          {/* Stock */}
          <p className="text-[10px] sm:text-xs text-gray-400 mb-2 truncate">
            {isOutOfStock ? 'Out of Stock' : `${product.stock} in stock`}
            {product.weight && !isOutOfStock && (
              <span className="hidden sm:inline"> · {parseFloat(product.weight)}kg</span>
            )}
          </p>

          {/* Buttons — always at bottom */}
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
                  <div className="spinner-nigerian w-3 h-3" />
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
              onClick={() =>
                alert(
                  `Product Details:\n\nName: ${product.name}\nDescription: ${product.description}\nPrice: $${parseFloat(product.price).toLocaleString()}\nStock: ${product.stock}\nWeight: ${product.weight ? parseFloat(product.weight) + 'kg' : 'Not specified'}\nStatus: ${product.status}`
                )
              }
            >
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
