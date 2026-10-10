import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Package, RotateCw } from 'lucide-react';
import { Link } from 'wouter';
import Navbar from '@/components/navbar';

type PublicVendorResponse = {
  vendor: {
    id: number;
    businessName: string;
    description: string | null;
  };
  products: Array<{
    id: number;
    name: string;
    imageUrl: string | null;
    price: number;
    originCountry: string | null;
  }>;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(price);
}

export default function PublicVendor() {
  const [, params] = useRoute('/vendors/:id');
  const vendorId = params?.id;
  const query = useQuery<PublicVendorResponse>({
    queryKey: ['/api/public/vendors', vendorId],
    queryFn: async () => {
      const response = await fetch(`/api/public/vendors/${encodeURIComponent(vendorId ?? '')}`);
      if (!response.ok) {
        throw new Error(response.status === 404 ? 'This seller storefront is not available.' : 'Unable to load this seller storefront.');
      }
      return response.json();
    },
    enabled: !!vendorId,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-[#f7f3e9] text-[#29483f]">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href="/reviews"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#6d7a72] transition-colors hover:text-[#a2573e]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to reviews
        </Link>

        {query.isLoading ? (
          <section className="mt-8 border border-[#ddd3c2] bg-[#faf7ef] p-6 sm:p-10" role="status">
            <p className="font-['Space_Grotesk'] text-lg font-semibold">Loading seller storefront…</p>
            <div className="mt-6 h-3 max-w-sm animate-pulse bg-[#e6dece]" />
            <div className="mt-3 h-3 max-w-2xl animate-pulse bg-[#e6dece]" />
          </section>
        ) : query.isError ? (
          <section className="mt-8 border border-[#d8c8b5] bg-[#f8f2e8] px-6 py-12 text-center" role="alert">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#d4bda4] text-[#a2573e]">
              <RotateCw className="h-5 w-5" />
            </div>
            <h1 className="mt-4 font-['Space_Grotesk'] text-2xl font-semibold">Storefront unavailable</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6d7a72]">
              {query.error instanceof Error ? query.error.message : 'There was a problem loading this seller.'}
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-5 inline-flex items-center gap-2 bg-[#183c34] px-5 py-3 text-sm font-semibold text-[#f7f0df] transition-colors hover:bg-[#28594c]"
            >
              <RotateCw className="h-4 w-4" /> Try again
            </button>
          </section>
        ) : query.data ? (
          <>
            <header className="relative mt-7 overflow-hidden border border-[#d8cdbb] bg-[#faf7ef] px-6 py-9 sm:px-10 sm:py-12">
              <div className="absolute left-0 top-0 h-full w-1 bg-[#c99445]" />
              <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.16em] text-[#a2573e]">Seller storefront</p>
              <h1 className="mt-3 break-words font-['Space_Grotesk'] text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                {query.data.vendor.businessName}
              </h1>
              {query.data.vendor.description && (
                <p className="reading-copy mt-4 max-w-3xl whitespace-pre-line text-base leading-7 text-[#52665d]">
                  {query.data.vendor.description}
                </p>
              )}
            </header>

            <section className="mt-10" aria-labelledby="seller-products-title">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#d7cdbb] pb-4">
                <div>
                  <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.15em] text-[#a2573e]">Available collection</p>
                  <h2 id="seller-products-title" className="mt-1 font-['Space_Grotesk'] text-2xl font-semibold tracking-[-0.03em]">Products</h2>
                </div>
                <span className="text-sm text-[#718077]">
                  {query.data.products.length} {query.data.products.length === 1 ? 'item' : 'items'} shown · up to 60 approved products
                </span>
              </div>
              {query.data.products.length === 0 ? (
                <div className="border border-[#d8cdbb] bg-[#faf7ef] px-6 py-14 text-center">
                  <Package className="mx-auto h-8 w-8 text-[#a2573e]" strokeWidth={1.4} />
                  <h3 className="mt-4 font-['Space_Grotesk'] text-xl font-semibold">No approved products to show yet.</h3>
                  <p className="mt-2 text-sm leading-6 text-[#718077]">This seller’s public collection is currently empty.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {query.data.products.map(product => (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      className="group overflow-hidden border border-[#ddd3c2] bg-[#faf7ef] transition-colors hover:border-[#c2ad8b]"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-[#eee8dc]">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[#a2573e]" aria-hidden="true">
                            <Package className="h-8 w-8" strokeWidth={1.4} />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="line-clamp-2 font-['Space_Grotesk'] text-base font-semibold">{product.name}</h3>
                        <p className="mt-2 font-semibold text-[#a2573e]">{formatPrice(product.price)}</p>
                        {product.originCountry && (
                          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#718077]">
                            <MapPin className="h-3.5 w-3.5" /> {product.originCountry}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}