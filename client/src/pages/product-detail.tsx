import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/navbar';
import VirtualTryOnSheet from '@/components/virtual-try-on-sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import LocalPrice from '@/components/LocalPrice';
import type { Product } from '@/types';
import { trackEvent, valueBand } from '@/lib/analytics';
import { RETURN_POLICY_OPTIONS } from '@shared/schema';
import { Sparkles } from 'lucide-react';

const FALLBACK_URL =
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=800&h=800&q=75';

export default function ProductDetail() {
  const [, params] = useRoute('/products/:id');
  const [, setLocation] = useLocation();
  const { addToCart, isAddingToCart, openCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const [tryOnOpen, setTryOnOpen] = useState(false);

  const productId = params?.id ? parseInt(params.id) : null;

  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ['/api/products', productId],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Product not found');
      return res.json();
    },
    enabled: !!productId,
  });
  const { data: tryOnAvailability } = useQuery<{ eligible: boolean }>({
    queryKey: ['/api/products', productId, 'try-on-eligibility'],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}/try-on-eligibility`);
      if (!response.ok) throw new Error('Virtual Try-On availability is unavailable');
      return response.json();
    },
    enabled: !!productId,
    retry: false,
  });
  const returnPolicy = RETURN_POLICY_OPTIONS.find(option => option.value === product?.returnPolicy)
    ?? RETURN_POLICY_OPTIONS[0];

  useEffect(() => {
    if (!product) return;
    trackEvent('product_viewed', {
      product_id: product.id,
      category_id: product.categoryId ?? 0,
      vendor_id: product.vendorId,
      price_band: valueBand(Number(product.price)),
      stock_available: product.stock > 0,
    });
  }, [product]);

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      setLocation('/login');
      return;
    }
    if (!product) return;

    // Require size selection if product has sizes defined
    const hasSizes = product.sizes && product.sizes.length > 0;
    if (hasSizes && !selectedSize) {
      setSizeError(true);
      return;
    }

    addToCart(product.id, 1, selectedSize ?? undefined);
    openCart();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-12 flex items-center justify-center">
          <div className="spinner-nigerian w-10 h-10" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-gray-500 mb-6">This product may no longer be available.</p>
          <Button onClick={() => setLocation('/products')} className="btn-nigerian">
            Browse All Products
          </Button>
        </div>
      </div>
    );
  }

  const images = product.images && product.images.length > 0 ? product.images : [];
  const displaySrc = imgError || images.length === 0
    ? FALLBACK_URL
    : images[selectedImage] || FALLBACK_URL;

  const isOutOfStock = product.stock <= 0;
  const isAvailable = product.status === 'approved' && !isOutOfStock;
  const hasSizes = product.sizes && product.sizes.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <button
          onClick={() => setLocation('/products')}
          className="flex items-center gap-2 text-nigerian-green hover:text-nigerian-green/80 mb-6 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Products
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">

          {/* ── Image panel ── */}
          <div className="space-y-3">
            <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-white shadow-md">
              <img
                src={displaySrc}
                alt={product.name}
                className="w-full h-full object-contain"
                onError={() => setImgError(true)}
              />
              {isOutOfStock && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Badge variant="destructive" className="text-base font-semibold px-4 py-1">
                    Out of Stock
                  </Badge>
                </div>
              )}
              {product.featured && (
                <Badge className="absolute top-3 right-3 bg-nigerian-gold text-white">
                  ⭐ Featured
                </Badge>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setSelectedImage(idx); setImgError(false); }}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage === idx ? 'border-nigerian-green' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {tryOnAvailability?.eligible && isAvailable && (
              <Button variant="outline" size="lg"
                className="w-full border-nigerian-green bg-white text-nigerian-green hover:bg-green-50"
                onClick={() => isAuthenticated ? setTryOnOpen(true) : setLocation('/login')}>
                <Sparkles className="mr-2 h-4 w-4" />
                Try it on
              </Button>
            )}
          </div>

          {/* ── Details panel ── */}
          <div className="flex flex-col">
            <div className="mb-1">
              {product.status !== 'approved' && (
                <Badge variant="outline" className="mb-2 capitalize">{product.status}</Badge>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-nigerian leading-tight">
                {product.name}
              </h1>
            </div>

            {/* Rating placeholder */}
            <div className="flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map(n => (
                <svg key={n} className={`w-4 h-4 ${n <= 4 ? 'text-yellow-400' : 'text-gray-300'} fill-current`} viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-sm text-gray-500 ml-1">4.8</span>
            </div>

            {/* Price */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl font-bold text-nigerian-green">
                    ₦{parseFloat(product.price).toLocaleString()}
                  </span>
                  <LocalPrice ngnAmount={parseFloat(product.price)} size="md" />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {isOutOfStock
                    ? <span className="text-red-500 font-medium">Out of stock</span>
                    : <span className="text-green-600">{product.stock} in stock</span>
                  }
                  {product.weight && (
                    <span className="ml-2 text-gray-400">· {parseFloat(product.weight)}kg</span>
                  )}
                </p>
              </CardContent>
            </Card>

            {/* ── Size Selector ── */}
            {hasSizes && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">
                    Select Size
                    <span className="text-red-500 ml-1">*</span>
                  </h3>
                  {selectedSize && (
                    <span className="text-sm text-nigerian-green font-medium">
                      Selected: <strong>{selectedSize}</strong>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes!.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => { setSelectedSize(size); setSizeError(false); }}
                      className={`
                        min-w-[3rem] px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all duration-150
                        ${selectedSize === size
                          ? 'border-nigerian-green bg-nigerian-green text-white shadow-sm'
                          : 'border-gray-200 text-gray-700 hover:border-nigerian-green hover:text-nigerian-green bg-white'
                        }
                      `}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {sizeError && (
                  <p className="mt-2 text-sm text-red-500 font-medium">
                    Please select a size before adding to cart.
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  Sizes follow international standards. Check the vendor's description for measurements.
                </p>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="reading-copy text-gray-600 leading-relaxed text-sm">{product.description}</p>
              </div>
            )}

            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
              <h3 className="font-semibold text-gray-900">Returns: {returnPolicy.label}</h3>
              <p className="reading-copy mt-1 text-sm leading-relaxed text-gray-600">{returnPolicy.description}</p>
              <a href="/policies/return-policy" className="mt-2 inline-block text-sm font-medium text-nigerian-green hover:underline">
                Read the standard AfrolandX return and refund policy
              </a>
            </div>

            {/* Add to cart */}
            <div className="space-y-3 mt-auto">
              <Button
                onClick={handleAddToCart}
                disabled={!isAvailable || isAddingToCart}
                size="lg"
                className={`w-full text-base transition-all duration-200 ${
                  'btn-nigerian'
                }`}
              >
                {isAddingToCart ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="spinner-nigerian w-4 h-4" />
                    Adding to Cart…
                  </span>
                ) : !isAvailable ? (
                  isOutOfStock ? 'Out of Stock' : 'Currently Unavailable'
                ) : !isAuthenticated ? (
                  'Sign In to Buy'
                ) : hasSizes && !selectedSize ? (
                  'Select a Size to Continue'
                ) : (
                  'Add to Cart'
                )}
              </Button>

              {!isAuthenticated && (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-nigerian-green text-nigerian-green hover:bg-nigerian-green hover:text-white"
                  onClick={() => setLocation('/login')}
                >
                  Sign In to Purchase
                </Button>
              )}
            </div>
          </div>
        </div>
        {tryOnAvailability?.eligible && (
          <VirtualTryOnSheet
            product={{ id: product.id, name: product.name, images }}
            open={tryOnOpen}
            onOpenChange={setTryOnOpen}
            onAddToCart={() => { setTryOnOpen(false); handleAddToCart(); }}
          />
        )}
      </div>
    </div>
  );
}
