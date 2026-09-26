import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import Navbar from '@/components/navbar';
import { ArrowDownWideNarrow, ArrowUpRight, Check, ChevronDown, MessageCircle, PackageCheck, RotateCw, ShieldCheck, Star } from 'lucide-react';

type Review = {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  product: { id: number; name: string; imageUrl: string | null };
  vendor: { id: number; name: string };
  reviewer: string;
  verifiedPurchase: true;
};

type ReviewsResponse = {
  summary: {
    count: number;
    average: number;
    counts: Record<1 | 2 | 3 | 4 | 5, number>;
  };
  reviews: Review[];
  hasMore: boolean;
};

type SortOption = 'recent' | 'oldest' | 'highest';
const PAGE_SIZE = 12;

function Stars({ rating, large = false }: { rating: number; large?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${large ? 'text-base' : 'text-sm'}`} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`${large ? 'h-4 w-4' : 'h-3.5 w-3.5'} ${star <= rating ? 'fill-[#c99445] text-[#c99445]' : 'fill-transparent text-[#d8d0c1]'}`}
        />
      ))}
    </span>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default function Reviews() {
  const [rating, setRating] = useState<number | null>(null);
  const [sort, setSort] = useState<SortOption>('recent');
  const productId = new URLSearchParams(window.location.search).get('productId');

  const query = useInfiniteQuery<ReviewsResponse>({
    queryKey: ['/api/reviews', productId, rating, sort],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ sort, limit: String(PAGE_SIZE), offset: String(pageParam) });
      if (rating !== null) params.set('rating', String(rating));
      if (productId !== null) params.set('productId', productId);
      const response = await fetch(`/api/reviews?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Could not load reviews');
      return response.json() as Promise<ReviewsResponse>;
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.reduce((total, page) => total + page.reviews.length, 0) : undefined,
  });

  const firstPage = query.data?.pages[0];
  const reviews = query.data?.pages.flatMap((page) => page.reviews) ?? [];
  const summary = firstPage?.summary;
  const average = summary && summary.count > 0 ? summary.average.toFixed(1) : '—';

  const chooseRating = (value: number | null) => {
    if (value === rating) setRating(null);
    else setRating(value);
  };

  return (
    <div className="min-h-screen bg-[#f5f0e6] text-[#183c34]">
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-[#d9cfbb] bg-[#ede5d5]">
          <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden="true">
            <div className="absolute -right-20 -top-28 h-96 w-96 rounded-full border border-[#bfa67a]" />
            <div className="absolute -right-7 -top-16 h-72 w-72 rounded-full border border-[#bfa67a]" />
            <div className="absolute right-14 top-0 h-52 w-52 rounded-full border border-[#bfa67a]" />
            <div className="absolute bottom-0 right-0 h-2 w-2/5 bg-[repeating-linear-gradient(135deg,#b96c4a_0_7px,transparent_7px_14px)] opacity-30" />
          </div>
          <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_22rem] lg:items-end lg:gap-16 lg:px-10 lg:py-20">
            <div className="max-w-3xl">
              <p className="mb-5 flex items-center gap-2 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.19em] text-[#a2573e]">
                <span className="h-px w-8 bg-[#a2573e]" /> {productId ? 'Product experiences' : 'The Afrolandx record'}
              </p>
              <h1 className="max-w-3xl font-['Space_Grotesk'] text-[clamp(2.7rem,7vw,6.3rem)] font-semibold leading-[0.94] tracking-[-0.065em] text-[#183c34]">
                Made by hand.<br />
                <span className="text-[#a2573e]">Known by experience.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#52685f] sm:text-lg">
                Honest notes from people who have bought from independent African makers. Every review here is tied to a verified purchase.
              </p>
              {productId && <a href="/reviews" className="mt-4 inline-block text-sm font-semibold text-[#a2573e] underline underline-offset-4">See all marketplace reviews</a>}
            </div>

            <div className="relative flex items-end gap-5 border-t border-[#cfc2aa] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <div className="min-w-0">
                <p className="mb-2 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.17em] text-[#a2573e]">Community rating</p>
                <div className="flex items-center gap-3">
                  <span className="font-['Space_Grotesk'] text-6xl font-semibold leading-none tracking-[-0.07em]">{average}</span>
                  {summary && summary.count > 0 && <Stars rating={Math.round(summary.average)} large />}
                </div>
                <p className="mt-2 text-sm text-[#65766d]">
                  {summary ? `${summary.count.toLocaleString()} verified ${summary.count === 1 ? 'experience' : 'experiences'}` : 'Reviews from across the marketplace'}
                </p>
              </div>
              <div className="mb-1 ml-auto hidden h-16 w-16 items-center justify-center rounded-full border border-[#c4ad83] text-[#a2573e] sm:flex">
                <ShieldCheck className="h-7 w-7" strokeWidth={1.35} />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12 lg:px-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="border-t-2 border-[#183c34] pt-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-['Space_Grotesk'] text-lg font-semibold tracking-[-0.035em]">Browse by rating</h2>
                  {rating !== null && (
                    <button
                      type="button"
                      onClick={() => setRating(null)}
                      className="text-xs font-semibold text-[#a2573e] underline decoration-[#c8a489] underline-offset-4 hover:text-[#7d402e]"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-[#718077]">Find the kind of detail you need.</p>
                <div className="mt-5 space-y-1">
                  <button
                    type="button"
                    onClick={() => chooseRating(null)}
                    aria-pressed={rating === null}
                    className={`group flex w-full items-center justify-between border-b border-[#ded5c5] py-3 text-left transition-colors ${rating === null ? 'text-[#183c34]' : 'text-[#6d7a72] hover:text-[#183c34]'}`}
                  >
                    <span className="text-sm font-semibold">All experiences</span>
                    <span className="font-mono text-xs text-[#9a9a83]">{summary ? summary.count.toLocaleString() : '—'}</span>
                  </button>
                  {[5, 4, 3, 2, 1].map((value) => {
                    const count = summary?.counts[value as 1 | 2 | 3 | 4 | 5];
                    const selected = rating === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => chooseRating(value)}
                        aria-pressed={selected}
                        className={`flex w-full items-center justify-between border-b border-[#ded5c5] py-3 transition-colors ${selected ? 'text-[#183c34]' : 'text-[#6d7a72] hover:text-[#183c34]'}`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="font-mono text-xs">{value}</span>
                          <Stars rating={value} />
                        </span>
                        <span className="font-mono text-xs text-[#9a9a83]">{count === undefined ? '—' : count.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 flex gap-3 border border-[#d6c8ac] bg-[#f0e9da] p-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#a2573e]" />
                  <p className="text-xs leading-5 text-[#63746a]">Verified means the reviewer completed a purchase on Afrolandx.</p>
                </div>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="mb-5 flex flex-col gap-4 border-b border-[#d7cdbb] pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.17em] text-[#a2573e]">Buyer voices</p>
                  <h2 className="mt-1 font-['Space_Grotesk'] text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">
                    {rating === null ? (productId ? `Reviews for ${firstPage?.reviews[0]?.product.name || 'this product'}` : 'All experiences') : `${rating}-star experiences`}
                  </h2>
                  {!query.isLoading && !query.isError && (
                    <p className="mt-1 text-sm text-[#718077]">
                      {summary ? `${summary.count.toLocaleString()} total` : 'Independent makers, real orders'}
                    </p>
                  )}
                </div>
                <label className="relative flex w-full items-center gap-2 border border-[#cfc4b2] bg-[#faf7ef] px-3 sm:w-auto">
                  <ArrowDownWideNarrow className="h-4 w-4 shrink-0 text-[#a2573e]" />
                  <span className="sr-only">Sort reviews</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortOption)}
                    className="h-11 w-full appearance-none bg-transparent pr-7 text-sm font-semibold text-[#294a40] outline-none sm:w-40"
                  >
                    <option value="recent">Most recent</option>
                    <option value="oldest">Oldest first</option>
                    <option value="highest">Highest rated</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[#738177]" />
                </label>
              </div>

              {query.isLoading ? (
                <div className="space-y-4" aria-label="Loading reviews">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="animate-pulse border border-[#dfd5c4] bg-[#faf7ef] p-5 sm:p-7">
                      <div className="h-3 w-28 bg-[#e6dece]" />
                      <div className="mt-5 h-5 w-2/3 bg-[#e6dece]" />
                      <div className="mt-3 h-3 w-full bg-[#e6dece]" />
                      <div className="mt-2 h-3 w-4/5 bg-[#e6dece]" />
                    </div>
                  ))}
                </div>
              ) : query.isError ? (
                <div className="border border-[#d8c8b5] bg-[#f8f2e8] px-6 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#d4bda4] text-[#a2573e]">
                    <RotateCw className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-['Space_Grotesk'] text-xl font-semibold">The reviews haven’t come through.</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6d7a72]">There was a problem reaching the community record. Give it another try.</p>
                  <button
                    type="button"
                    onClick={() => void query.refetch()}
                    className="mt-5 inline-flex items-center gap-2 bg-[#183c34] px-5 py-3 text-sm font-semibold text-[#f7f0df] transition-colors hover:bg-[#28594c]"
                  >
                    <RotateCw className="h-4 w-4" /> Try again
                  </button>
                </div>
              ) : reviews.length === 0 ? (
                <div className="relative overflow-hidden border border-[#d8cdbb] bg-[#f8f4eb] px-6 py-14 text-center">
                  <div className="absolute left-0 top-0 h-full w-1 bg-[#c99445]" />
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d7c9af] text-[#a2573e]">
                    <MessageCircle className="h-6 w-6" strokeWidth={1.4} />
                  </div>
                  <p className="mt-5 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.16em] text-[#a2573e]">A quiet page, for now</p>
                  <h3 className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold tracking-[-0.04em]">No reviews in this corner yet.</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718077]">
                    {rating === null ? 'As more buyers share their experience, their words will appear here.' : `There are no ${rating}-star reviews to show right now. Try another rating to hear from more buyers.`}
                  </p>
                  {rating !== null && (
                    <button type="button" onClick={() => setRating(null)} className="mt-5 text-sm font-semibold text-[#a2573e] underline decoration-[#c8a489] underline-offset-4">
                      See all experiences
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review, index) => (
                    <article
                      key={review.id}
                      className="group border border-[#ddd3c2] bg-[#faf7ef] p-5 transition-colors hover:border-[#c2ad8b] sm:p-7"
                    >
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <Stars rating={review.rating} />
                            <span className="text-xs text-[#829087]">{formatDate(review.createdAt)}</span>
                            <span className="inline-flex items-center gap-1.5 border border-[#c7d4c7] bg-[#edf2e9] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.09em] text-[#355f4d]">
                              <Check className="h-3 w-3" strokeWidth={2.5} /> Verified purchase
                            </span>
                          </div>
                          <p className="mt-4 font-['Space_Grotesk'] text-lg font-semibold tracking-[-0.025em] text-[#29483f]">{review.reviewer}</p>
                          {review.comment ? (
                            <p className="reading-copy mt-2 max-w-3xl whitespace-pre-line text-[15px] leading-7 text-[#52665d]">{review.comment}</p>
                          ) : (
                            <p className="mt-3 flex items-center gap-2 text-sm italic text-[#8a958b]">
                              <MessageCircle className="h-4 w-4" /> Shared a rating without a written note.
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3 border-t border-[#e5dccd] pt-4 sm:w-56 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                          {review.product.imageUrl ? (
                            <img
                              src={review.product.imageUrl}
                              alt={review.product.name}
                              loading="lazy"
                              className="h-14 w-14 shrink-0 border border-[#e0d6c7] bg-[#eee8dc] object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-[#e0d6c7] bg-[#eee8dc] text-[#a2573e]" aria-hidden="true">
                              <PackageCheck className="h-5 w-5" strokeWidth={1.4} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#a2573e]">Purchased from</p>
                            <Link
                              href={`/vendors/${review.vendor.id}`}
                              className="mt-1 block truncate text-sm font-semibold text-[#304b41] transition-colors hover:text-[#a2573e] hover:underline"
                            >
                              {review.vendor.name}
                            </Link>
                            <Link
                              href={`/products/${review.product.id}`}
                              className="mt-1 inline-flex max-w-full items-center gap-1 text-sm text-[#6d7a72] transition-colors hover:text-[#a2573e]"
                            >
                              <span className="truncate">{review.product.name}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                            </Link>
                          </div>
                        </div>
                      </div>
                      <span className="sr-only">Review {index + 1} of this page</span>
                    </article>
                  ))}
                </div>
              )}

              {reviews.length > 0 && (
                <div className="mt-7 flex flex-col items-center justify-between gap-4 border-t border-[#d7cdbb] pt-5 sm:flex-row">
                  <p className="text-xs tracking-wide text-[#7b8980]">
                    Showing <span className="font-semibold text-[#304b41]">{reviews.length}</span>
                    {summary ? <> of <span className="font-semibold text-[#304b41]">{summary.count.toLocaleString()}</span></> : null} experiences
                  </p>
                  {query.hasNextPage && (
                    <button
                      type="button"
                      onClick={() => void query.fetchNextPage()}
                      disabled={query.isFetchingNextPage}
                      className="inline-flex min-w-48 items-center justify-center gap-2 border border-[#183c34] px-5 py-3 text-sm font-semibold text-[#183c34] transition-colors hover:bg-[#183c34] hover:text-[#f7f0df] disabled:cursor-wait disabled:opacity-60"
                    >
                      {query.isFetchingNextPage ? 'Loading more…' : 'Load more experiences'}
                      {!query.isFetchingNextPage && <ChevronDown className="h-4 w-4" />}
                    </button>
                  )}
                  {query.isFetchingNextPage && <span className="sr-only" role="status">Loading more reviews</span>}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}