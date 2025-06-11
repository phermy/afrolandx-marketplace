import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/types';

// Image optimization utility
const getOptimizedImageUrl = (imagePath: string): string => {
  if (!imagePath) return '';
  
  // If it's already a full URL (cloud storage), return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // If it's a local path, construct the full URL
  if (imagePath.startsWith('/uploads/')) {
    return imagePath;
  }
  
  return imagePath;
};

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, isAddingToCart } = useCart();
  const [isAddedToCart, setIsAddedToCart] = useState(false);

  const handleAddToCart = () => {
    addToCart(product.id, 1);
    setIsAddedToCart(true);
    // Reset the state after 2 seconds
    setTimeout(() => setIsAddedToCart(false), 2000);
  };

  const formatPrice = (price: string) => {
    return `₦${parseFloat(price).toLocaleString()}`;
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

  return (
    <Card className="group cursor-pointer card-hover overflow-hidden">
      <CardContent className="p-0">
        {/* Product Image */}
        <div className="relative overflow-hidden">
          {product.images && product.images.length > 0 ? (
            <img
              src={getOptimizedImageUrl(product.images[0])}
              alt={product.name}
              className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                // Fallback to gradient background if image fails to load
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.style.background = 'linear-gradient(135deg, var(--nigerian-green), var(--nigerian-gold))';
                }
              }}
            />
          ) : (
            <div className="w-full h-64 bg-gradient-to-br from-nigerian-green to-nigerian-gold flex items-center justify-center">
              <div className="text-center text-white">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                <p className="text-sm opacity-80">No Image</p>
              </div>
            </div>
          )}
          
          {/* Status Badge */}
          {getStatusBadge()}
          
          {/* Featured Badge */}
          {product.featured && (
            <Badge className="absolute top-2 right-2 bg-nigerian-gold text-white">
              ⭐ Featured
            </Badge>
          )}

          {/* Out of Stock Overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <Badge variant="destructive" className="text-lg font-semibold">
                Out of Stock
              </Badge>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-nigerian-green transition-colors">
            {product.name}
          </h3>
          
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
            {product.description}
          </p>

          {/* Price and Rating */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-bold text-nigerian-green">
              {formatPrice(product.price)}
            </span>
            <div className="flex items-center text-yellow-500">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="ml-1 text-gray-600 text-sm">4.8</span>
            </div>
          </div>

          {/* Stock Info */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">
              {isOutOfStock ? 'Out of Stock' : `${product.stock} in stock`}
            </span>
            {product.weight && (
              <span className="text-sm text-gray-500">
                {parseFloat(product.weight)}kg
              </span>
            )}
          </div>

          {/* Add to Cart Button */}
          <Button
            onClick={handleAddToCart}
            disabled={!isAvailable || isAddingToCart || isAddedToCart}
            className={`w-full transition-all duration-200 ${
              isAddedToCart 
                ? 'bg-green-600 hover:bg-green-600' 
                : 'btn-nigerian'
            }`}
          >
            {isAddingToCart ? (
              <div className="flex items-center">
                <div className="spinner-nigerian w-4 h-4 mr-2"></div>
                Adding...
              </div>
            ) : isAddedToCart ? (
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Added!
              </div>
            ) : !isAvailable ? (
              isOutOfStock ? 'Out of Stock' : 'Unavailable'
            ) : (
              'Add to Cart'
            )}
          </Button>

          {/* Quick View / Details Link */}
          <Button
            variant="outline"
            className="w-full mt-2 border-nigerian-green text-nigerian-green hover:bg-nigerian-green hover:text-white"
            onClick={() => {
              // Show product details in an alert for now (can be enhanced with a modal later)
              alert(`Product Details:\n\nName: ${product.name}\nDescription: ${product.description}\nPrice: ₦${parseFloat(product.price).toLocaleString()}\nStock: ${product.stock}\nWeight: ${product.weight ? parseFloat(product.weight) + 'kg' : 'Not specified'}\nStatus: ${product.status}`);
            }}
          >
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
