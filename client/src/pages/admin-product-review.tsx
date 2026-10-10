import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, ImageOff, Package, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error-message";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { hasSupportManagementAccess } from "@shared/admin-access";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ReviewProduct = {
  id: number;
  name: string;
  description: string;
  price: string;
  stock: number;
  status: string;
  categoryId: number | null;
  vendorId: number;
  images?: string[] | null;
  imageUrl?: string | null;
};
type ProductReviewResponse = {
  product: ReviewProduct;
  vendor: { id: number; businessName: string; status: string; verificationStatus: string } | null;
  category: { id: number; name: string } | null;
  approvalIssues: { code: string; message: string }[];
};

export default function AdminProductReview() {
  const [, params] = useRoute("/admin/products/:id");
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const productId = params?.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const canReview = hasSupportManagementAccess(user);
  const [selectedImage, setSelectedImage] = useState(0);
  const queryKey = ["/api/admin/products", productId, user?.id, user?.roles, user?.emailVerified, user?.closedAt];
  useEffect(() => setSelectedImage(0), [productId]);

  const { data, isLoading, isFetching, error, refetch } = useQuery<ProductReviewResponse>({
    queryKey,
    queryFn: async () => (await apiRequest("GET", `/api/admin/products/${productId}`)).json(),
    enabled: Boolean(productId && isAuthenticated && canReview),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const statusMutation = useMutation({
    mutationFn: async (status: "approved" | "rejected") => {
      const response = await apiRequest("PATCH", `/api/admin/products/${productId}/status`, { status });
      return response.json() as Promise<{ message: string; reason?: string }>;
    },
    onSuccess: async (result, status) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/products"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/products/with-details"] }),
      ]);
      await refetch();
      toast({ title: status === "approved" ? "Listing approved" : "Listing rejected", description: result?.message || "The listing status was updated." });
    },
    onError: (mutationError: Error) => {
      if (isUnauthorizedError(mutationError)) {
        setLocation("/login");
        return;
      }
      toast({ title: mutationError.message.startsWith("409") ? "Listing approval blocked" : "Decision could not be saved", description: getApiErrorMessage(mutationError, "The decision could not be saved. Please try again."), variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/login");
  }, [authLoading, isAuthenticated, setLocation]);
  if (authLoading) return <div className="min-h-[100dvh] bg-gray-50"><Navbar /><div className="mx-auto max-w-5xl animate-pulse px-4 py-10"><div className="h-8 w-56 rounded bg-gray-200" /><div className="mt-6 h-80 rounded-xl bg-gray-200" /></div></div>;
  if (!isAuthenticated) {
    return null;
  }
  if (!canReview) {
    return <div className="min-h-[100dvh] bg-gray-50"><Navbar /><main className="mx-auto max-w-3xl px-4 py-16 text-center"><h1 className="text-2xl font-semibold">Admin access required</h1><p className="mt-2 text-gray-600">This private product review is available to verified Admins.</p><Button className="mt-6" variant="outline" onClick={() => setLocation("/")}>Return home</Button></main></div>;
  }
  if (!productId) {
    return <div className="min-h-[100dvh] bg-gray-50"><Navbar /><main className="mx-auto max-w-3xl px-4 py-16 text-center"><h1 className="text-2xl font-semibold">Invalid product reference</h1><Link href="/admin" className="mt-5 inline-block underline">Return to Admin</Link></main></div>;
  }

  const photos = data ? [...(data.product.images || [])] : [];
  if (data?.product.imageUrl && !photos.includes(data.product.imageUrl)) photos.push(data.product.imageUrl);
  const pending = data?.product.status === "pending";
  const statusClasses: Record<string, string> = {
    pending: "border-amber-300 bg-amber-50 text-amber-900",
    approved: "border-emerald-300 bg-emerald-50 text-emerald-900",
    rejected: "border-red-300 bg-red-50 text-red-900",
  };
  const mutationError = statusMutation.error;
  const errorCode = mutationError instanceof Error ? mutationError.message.match(/^(\d{3}):/)?.[1] : undefined;

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/admin?tab=products" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-nigerian-green hover:underline">
          <ArrowLeft className="h-4 w-4" />Back to product queue
        </Link>
        {isLoading ? (
          <div className="grid animate-pulse gap-6 md:grid-cols-2" role="status" aria-label="Loading product review">
            <div className="aspect-square rounded-xl bg-gray-200" /><div className="space-y-4"><div className="h-8 w-2/3 rounded bg-gray-200" /><div className="h-40 rounded bg-gray-200" /></div>
          </div>
        ) : error || !data ? (
          <section className="rounded-xl border border-red-200 bg-white p-8 text-center" role="alert">
            <Package className="mx-auto h-10 w-10 text-red-400" />
            <h1 className="mt-3 text-xl font-semibold text-gray-900">{error instanceof Error && error.message.startsWith("404") ? "Listing unavailable" : "Product review could not be loaded"}</h1>
            <p className="mt-2 text-sm text-gray-600">{error instanceof Error && error.message.startsWith("404") ? getApiErrorMessage(error, "This listing may have been removed or is no longer accessible.") : getApiErrorMessage(error, "Please try loading the private listing again.")}</p>
            {!(error instanceof Error && error.message.startsWith("404")) && <Button className="mt-5" variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>}
          </section>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Private listing review · #{data.product.id}</p>
                <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">{data.product.name}</h1>
              </div>
              <Badge variant="outline" className={`capitalize ${statusClasses[data.product.status] || ""}`}>{data.product.status}</Badge>
            </div>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <section className="space-y-3">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-white">
                  {photos.length ? <img src={photos[selectedImage] || photos[0]} alt={`${data.product.name}, photo ${selectedImage + 1}`} className="h-full w-full object-contain" /> : <div className="flex flex-col items-center gap-2 text-gray-500"><ImageOff className="h-10 w-10" /><span>No product photos submitted</span></div>}
                </div>
                {photos.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Submitted product photos">
                  {photos.map((photo, index) => <button key={`${photo}-${index}`} type="button" aria-label={`View submitted photo ${index + 1}`} aria-pressed={selectedImage === index} onClick={() => setSelectedImage(index)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 ${selectedImage === index ? "border-nigerian-green" : "border-gray-200"}`}><img src={photo} alt="" className="h-full w-full object-cover" /></button>)}
                </div>}
              </section>
              <div className="space-y-5">
                <section className="rounded-xl border bg-white p-5">
                  <h2 className="font-semibold text-gray-900">Submitted listing</h2>
                  <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div><dt className="text-gray-500">Price</dt><dd className="mt-1 font-semibold">₦{Number(data.product.price).toLocaleString()}</dd></div>
                    <div><dt className="text-gray-500">Stock</dt><dd className="mt-1 font-semibold">{data.product.stock}</dd></div>
                    <div className="col-span-2"><dt className="text-gray-500">Category</dt><dd className="mt-1 font-medium">{data.category?.name || "Not assigned"}</dd></div>
                  </dl>
                  <div className="mt-5 border-t pt-4"><h3 className="text-sm font-semibold text-gray-700">Description</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{data.product.description || "No description submitted."}</p></div>
                </section>
                <section className="rounded-xl border bg-white p-5">
                  <h2 className="font-semibold text-gray-900">Vendor identity</h2>
                  {data.vendor ? <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
                    <div className="col-span-2"><dt className="text-gray-500">Business</dt><dd className="mt-1 font-medium">{data.vendor.businessName}</dd></div>
                    <div><dt className="text-gray-500">Vendor ID</dt><dd className="mt-1">{data.vendor.id}</dd></div>
                    <div><dt className="text-gray-500">Vendor status</dt><dd className="mt-1 capitalize">{data.vendor.status}</dd></div>
                    <div className="col-span-2"><dt className="text-gray-500">Verification</dt><dd className="mt-1 capitalize">{data.vendor.verificationStatus}</dd></div>
                  </dl> : <p className="mt-3 text-sm text-gray-600">Vendor record unavailable.</p>}
                </section>
                <section className="rounded-xl border bg-white p-5">
                  <h2 className="font-semibold text-gray-900">Approval checks</h2>
                  {data.approvalIssues.length ? <ul className="mt-3 space-y-2">{data.approvalIssues.map((issue, index) => <li key={`${issue.code}-${index}`} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{issue.message}</li>)}</ul> : <p className="mt-2 text-sm text-emerald-800">No approval issues reported.</p>}
                </section>
                {pending && <section className="rounded-xl border bg-white p-5">
                  <h2 className="font-semibold text-gray-900">Review decision</h2>
                  {mutationError && <div role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    <p className="font-semibold">{errorCode === "409" ? "Listing is not eligible for approval" : "Decision could not be saved"}</p>
                    <p className="mt-1">{getApiErrorMessage(mutationError, "The decision could not be saved. Please try again.")}</p>
                  </div>}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button className="bg-green-700 text-white hover:bg-green-800" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("approved")}>
                      <CheckCircle className="mr-2 h-4 w-4" />{statusMutation.isPending && statusMutation.variables === "approved" ? "Approving…" : "Approve listing"}
                    </Button>
                    <Button variant="destructive" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate("rejected")}>
                      <XCircle className="mr-2 h-4 w-4" />{statusMutation.isPending && statusMutation.variables === "rejected" ? "Rejecting…" : "Reject listing"}
                    </Button>
                  </div>
                  {isFetching && <p className="mt-3 text-xs text-gray-500">Refreshing listing status…</p>}
                </section>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
