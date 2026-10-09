import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProductPrice from '@/components/product-price';
import type { Product } from '@/types';
import { ArrowUpRight, ImageOff, MapPin, ShoppingBag } from 'lucide-react';

const resolveImageUrl = (imagePath: string): string => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('/uploads/')) return imagePath.split('?')[0];
  return imagePath;
};

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, isAddingToCart, openCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isAddedToCart, setIsAddedToCart] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleAddToCart = () => {
    addToCart(product.id, 1);
    setIsAddedToCart(true);
    window.setTimeout(() => {
      openCart();
      setIsAddedToCart(false);
    }, 1500);
  };

  const rawSrc = product.images?.length ? resolveImageUrl(product.images[0]) : product.imageUrl ? resolveImageUrl(product.imageUrl) : '';
  const isOutOfStock = product.stock <= 0;
  const isAvailable = product.status === 'approved' && !isOutOfStock;

  return (
    <article className="catalog-product-card group">
      <button
        type="button"
        className="catalog-product-image"
        onClick={() => setLocation(`/products/${product.id}`)}
        aria-label={`View ${product.name}`}
      >
        {rawSrc && !imgError ? (
          <img
            src={rawSrc}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="catalog-image-fallback">
            <ImageOff size={30} strokeWidth={1.4} aria-hidden="true" />
            <span>Photo unavailable</span>
          </span>
        )}
        <span className="catalog-image-vignette" aria-hidden="true" />
        {product.featured && <Badge className="catalog-featured-badge">Featured</Badge>}
        {product.originCountry && (
          <span className="catalog-origin-badge">
            <MapPin size={12} aria-hidden="true" />
            <span>{product.originCountry}</span>
          </span>
        )}
        {isOutOfStock && <span className="catalog-stock-overlay">Currently unavailable</span>}
        <span className="catalog-image-open" aria-hidden="true"><ArrowUpRight size={17} /></span>
      </button>

      <div className="catalog-product-info">
        {product.traditionalName && <p className="catalog-traditional-name">{product.traditionalName}</p>}
        <button type="button" className="catalog-product-title" onClick={() => setLocation(`/products/${product.id}`)}>
          {product.name}
        </button>
        {product.description && <p className="catalog-product-description">{product.description}</p>}
        <div className="catalog-product-bottom">
          <ProductPrice ngnAmount={parseFloat(product.price)} />
          <span className={`catalog-stock ${isOutOfStock ? 'is-out' : ''}`}>
            {isOutOfStock ? 'Out of stock' : `${product.stock} available`}
          </span>
        </div>
        <div className="catalog-product-actions">
          <Button
            onClick={handleAddToCart}
            disabled={!isAvailable || isAddingToCart || isAddedToCart}
            className={`catalog-add-button ${isAddedToCart ? 'is-added' : ''}`}
            data-testid="button-add-to-cart"
          >
            <ShoppingBag size={15} aria-hidden="true" />
            {isAddingToCart ? 'Adding…' : isAddedToCart ? 'Added to bag' : !isAvailable ? (isOutOfStock ? 'Out of stock' : 'Unavailable') : 'Add to bag'}
          </Button>
          <button type="button" className="catalog-details-link" onClick={() => setLocation(`/products/${product.id}`)}>
            Details <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}