import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeftRight, Check, Download, ImagePlus, LoaderCircle, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type TryOnProduct = {
  id: number;
  name: string;
  images: string[];
};

type VirtualTryOnSheetProps = {
  product: TryOnProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: () => void;
};

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function VirtualTryOnSheet({
  product,
  open,
  onOpenChange,
  onAddToCart,
}: VirtualTryOnSheetProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);

  const releaseUrl = (url: string | null) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    urlsRef.current = urlsRef.current.filter((activeUrl) => activeUrl !== url);
  };

  const makeUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.push(url);
    return url;
  };

  const reset = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
    setPhoto(null);
    setPhotoUrl(null);
    setResultUrl(null);
    setConsent(false);
    setBusy(false);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  useEffect(() => {
    if (!open) reset();
    return () => {
      requestRef.current?.abort();
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = [];
    };
  }, [open]);

  const choosePhoto = (file?: File) => {
    if (!file) return;
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(false);
    setError("");
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("That image is over 8 MB. Choose a smaller file.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    releaseUrl(photoUrl);
    releaseUrl(resultUrl);
    setPhoto(file);
    setPhotoUrl(makeUrl(file));
    setResultUrl(null);
    setConsent(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const generatePreview = async () => {
    if (!photo || !consent || busy) return;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const formData = new FormData();
      formData.append("photo", photo);
      formData.append("consent", "true");
      const response = await fetch(`/api/products/${product.id}/try-on`, {
        method: "POST",
        body: formData,
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok) {
        let message = "We couldn't create your preview. Please try again.";
        try {
          const payload = (await response.json()) as { message?: string };
          if (payload.message) message = payload.message;
        } catch {
          // Keep the friendly fallback for non-JSON errors.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        throw new Error("The preview response wasn't an image. Please try again.");
      }
      setResultUrl(makeUrl(blob));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  };

  const downloadPreview = () => {
    if (!resultUrl) return;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `afrolandx-try-on-${product.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const productImage = product.images.find(Boolean);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby="try-on-description"
        className="flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden border-l border-emerald-950/10 bg-[#f7f5ef] p-0 text-[#19342b] sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b border-emerald-950/10 px-5 pb-4 pt-6 text-left sm:px-8">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AfrolandX Virtual Try-On
          </div>
          <SheetTitle className="font-nigerian text-2xl font-bold leading-tight text-[#19342b] sm:text-3xl">
            See the look on you.
          </SheetTitle>
          <SheetDescription id="try-on-description" className="max-w-md text-sm leading-relaxed text-[#64756d]">
            Create a visual preview with your photo. This is not live AR, and it is not a fit or size guarantee.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          {resultUrl ? (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#19342b]">
                <ArrowLeftRight className="h-4 w-4 text-emerald-800" aria-hidden="true" />
                Your visual preview
              </div>
              <div className="grid grid-cols-2 gap-3">
                <figure className="min-w-0">
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#ebe9e1]">
                    {photoUrl && <img src={photoUrl} alt="Your original uploaded photo" className="h-full w-full object-cover" />}
                  </div>
                  <figcaption className="mt-2 text-xs font-medium text-[#64756d]">Your photo</figcaption>
                </figure>
                <figure className="min-w-0">
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#ebe9e1]">
                    <img src={resultUrl} alt={`AI-generated visual try-on preview of ${product.name}`} className="h-full w-full object-cover" />
                  </div>
                  <figcaption className="mt-2 text-xs font-medium text-[#64756d]">Preview · visual only</figcaption>
                </figure>
              </div>
              <div className="rounded-xl border border-emerald-900/10 bg-white/70 px-4 py-3 text-xs leading-relaxed text-[#64756d]">
                This generated image is an approximation—not a live camera view, fit recommendation, or size guarantee.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={downloadPreview} className="h-11 border-emerald-900/20 bg-transparent text-[#19342b] hover:bg-white">
                  <Download aria-hidden="true" /> Download preview
                </Button>
                <Button variant="outline" onClick={() => inputRef.current?.click()} className="h-11 border-emerald-900/20 bg-transparent text-[#19342b] hover:bg-white">
                  <ImagePlus aria-hidden="true" /> Try another photo
                </Button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Choose another photo"
                onChange={(event) => choosePhoto(event.currentTarget.files?.[0])}
              />
            </div>
          ) : (
            <div className="space-y-5">
              <section aria-label="Product and photo preview" className="grid grid-cols-[0.78fr_1.22fr] gap-3 sm:gap-4">
                <figure className="min-w-0">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#ebe9e1]">
                    {productImage ? (
                      <img src={productImage} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-[#64756d]">No product image available</div>
                    )}
                    <span className="absolute bottom-2 left-2 rounded-full bg-[#19342b]/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">The piece</span>
                  </div>
                  <figcaption className="mt-2 line-clamp-1 text-xs font-medium text-[#64756d]">{product.name}</figcaption>
                </figure>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="group relative flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-emerald-900/25 bg-[#eeece5] text-center transition-colors hover:border-emerald-800 hover:bg-[#e9eee7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2"
                    aria-label={photo ? "Replace your photo" : "Upload a photo"}
                  >
                    {photoUrl ? (
                      <>
                        <img src={photoUrl} alt="Your selected photo" className="absolute inset-0 h-full w-full object-cover" />
                        <span className="absolute bottom-2 left-2 rounded-full bg-[#19342b]/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">You</span>
                        <span className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-emerald-900 shadow-sm"><ImagePlus className="h-4 w-4" aria-hidden="true" /></span>
                      </>
                    ) : (
                      <span className="flex flex-col items-center px-4">
                        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-900 shadow-sm transition-transform group-hover:-translate-y-0.5">
                          <Upload className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="text-sm font-semibold text-[#19342b]">Add your photo</span>
                        <span className="mt-1 text-xs text-[#64756d]">JPG, PNG or WebP · up to 8 MB</span>
                      </span>
                    )}
                  </button>
                  <p className="mt-2 text-xs font-medium text-[#64756d]">Your photo</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label="Choose a photo for your preview"
                    onChange={(event) => choosePhoto(event.currentTarget.files?.[0])}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-emerald-950/10 bg-white/65 p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-[#19342b]">A good photo makes a better preview</h3>
                <ul className="mt-3 grid gap-2 text-xs leading-relaxed text-[#64756d] sm:grid-cols-2">
                  <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-800" aria-hidden="true" /> Face the camera in even, natural light</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-800" aria-hidden="true" /> Show your full upper body and outfit</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-800" aria-hidden="true" /> Keep one person in frame, without filters</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-800" aria-hidden="true" /> Avoid cropped, blurry, or backlit photos</li>
                </ul>
              </section>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-950/10 bg-white/60 p-3.5 text-xs leading-relaxed text-[#586d63]">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(checked === true)}
                  className="mt-0.5 border-emerald-900/40 data-[state=checked]:bg-emerald-800 data-[state=checked]:text-white"
                />
                <span>
                  I agree to send my photo through Replit's connector to Replicate to create this preview. AfrolandX does not save it on its app server. Replicate says its API inputs and outputs are removed after one hour by default.
                </span>
              </label>
              <div className="flex items-start gap-2 text-[11px] leading-relaxed text-[#75847c]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" aria-hidden="true" />
                <p>Your image is used only to create this request. Preview remains in this browser session; download it if you want to keep a copy.</p>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-900/15 bg-rose-50 px-3.5 py-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-emerald-950/10 bg-[#f7f5ef] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-8">
          {resultUrl ? (
            <Button onClick={() => { onAddToCart(); onOpenChange(false); }} className="h-12 w-full bg-[#19342b] text-white hover:bg-[#25483b]">
              Add to Cart
            </Button>
          ) : (
            <Button
              onClick={generatePreview}
              disabled={!photo || !consent || busy}
              className="h-12 w-full bg-[#19342b] text-white hover:bg-[#25483b]"
            >
              {busy ? <><LoaderCircle className="animate-spin" aria-hidden="true" /> Creating your preview…</> : <><Sparkles aria-hidden="true" /> Generate visual preview</>}
            </Button>
          )}
          <p className="mt-2 text-center text-[10px] text-[#849087]">Not live AR · Not a fit or size guarantee</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}