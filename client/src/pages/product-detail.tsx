import { useEffect, useState } from 'react';
import { publicNumericId } from '@shared/page-metadata';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/navbar';
import VirtualTryOnSheet from '@/components/virtual-try-on-sheet';
import LiveArSheet from '@/components/live-ar-sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import ProductPrice from '@/components/product-price';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { Product } from '@/types';
import { trackEvent, valueBand } from '@/lib/analytics';
import { RETURN_POLICY_OPTIONS } from '@shared/schema';
import { Expand, ImageOff, Sparkles, Star } from 'lucide-react';

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
  const [liveArOpen, setLiveArOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const productId = publicNumericId(params?.id);

  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ['/api/products', productId],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Product not found');
      return res.json();
    },
    enabled: !!productId,
  });
  const { data: reviewSummary, isError: reviewSummaryError } = useQuery<{ count: number; average: number }>({
    queryKey: ['/api/products', productId, 'review-summary'],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}/review-summary`);
      if (!response.ok) throw new Error('Product reviews unavailable');
      return response.json();
    },
    enabled: !!productId,
    retry: false,
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
  const { data: liveArAvailability } = useQuery<{
    eligible: boolean;
    asset?: { url: string; anchor: 'glasses' | 'headwear' | 'earrings' };
  }>({
    queryKey: ['/api/products', productId, 'live-ar-eligibility'],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}/live-ar-eligibility`);
      if (!response.ok) throw new Error('Live camera availability is unavailable');
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
  const displaySrc = !imgError ? images[selectedImage] : undefined;

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
              {displaySrc ? (
                <img
                  src={displaySrc}
                  alt={product.name}
                  className="w-full h-full object-contain"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 bg-stone-50 text-stone-500">
                  <ImageOff className="h-12 w-12" aria-hidden="true" />
                  <span>Product photo unavailable</span>
                </div>
              )}
              {displaySrc && (
                <button
                  type="button"
                  onClick={() => setPhotoOpen(true)}
                  className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-nigerian-green"
                  aria-label={`View larger photo of ${product.name}`}
                >
                  <Expand className="h-4 w-4" aria-hidden="true" />
                  View larger
                </button>
              )}
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
            {liveArAvailability?.eligible && liveArAvailability.asset && isAvailable && (
              <Button variant="outline" size="lg"
                className="w-full border-nigerian-green bg-white text-nigerian-green hover:bg-green-50"
                onClick={() => isAuthenticated ? setLiveArOpen(true) : setLocation('/login')}>
                <Sparkles className="mr-2 h-4 w-4" />
                Try live camera preview
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

            <div className="mb-4 flex items-center gap-2 text-sm">
              {reviewSummaryError ? <span className="text-gray-500">Ratings unavailable</span> :
                reviewSummary?.count ? (
                  <>
                    <Star aria-hidden="true" className="h-4 w-4 fill-amber-500 text-amber-500" />
                    <span className="font-semibold text-gray-900">{reviewSummary.average.toFixed(1)}</span>
                    <a href={`/reviews?productId=${product.id}`} className="text-gray-600 underline underline-offset-2 hover:text-green-800">
                      {reviewSummary.count} verified {reviewSummary.count === 1 ? 'review' : 'reviews'}
                    </a>
                  </>
                ) : <span className="text-gray-500">{reviewSummary ? 'No verified reviews yet' : 'Loading ratings…'}</span>}
            </div>

            {/* Price */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <ProductPrice ngnAmount={parseFloat(product.price)} large />
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
        <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
          <DialogContent className="flex max-h-[95vh] max-w-5xl flex-col overflow-hidden bg-white p-4 sm:p-6">
            <DialogTitle className="pr-8 text-base">{product.name} — photo {selectedImage + 1}</DialogTitle>
            {displaySrc && (
              <img
                src={displaySrc}
                alt={`${product.name}, larger view ${selectedImage + 1}`}
                className="max-h-[78vh] w-full object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
        {tryOnAvailability?.eligible && (
          <VirtualTryOnSheet
            product={{ id: product.id, name: product.name, images }}
            open={tryOnOpen}
            onOpenChange={setTryOnOpen}
            onAddToCart={() => { setTryOnOpen(false); handleAddToCart(); }}
          />
        )}
        {liveArAvailability?.eligible && liveArAvailability.asset && (
          <LiveArSheet
            productName={product.name}
            assetUrl={liveArAvailability.asset.url}
            anchor={liveArAvailability.asset.anchor}
            open={liveArOpen}
            onOpenChange={setLiveArOpen}
            onAddToCart={() => { setLiveArOpen(false); handleAddToCart(); }}
          />
        )}
      </div>
    </div>
  );
}
