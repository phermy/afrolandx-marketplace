import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import simdLoader from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import simdBinary from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import basicLoader from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import basicBinary from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";
import { AlertCircle, Camera, Check, LoaderCircle, ShieldCheck, Sparkles, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type LiveArSheetProps = {
  productName: string;
  assetUrl: string;
  anchor: "glasses" | "headwear" | "earrings";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: () => void;
};

type Landmark = { x: number; y: number; z?: number };
type VisionModule = typeof import("@mediapipe/tasks-vision");

const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

function errorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Camera access was blocked. Allow camera access in your browser settings, then try again.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera was found on this device.";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "Your camera is busy in another app. Close it there and try again.";
    }
  }
  return error instanceof Error ? error.message : "We couldn’t start the camera preview. Please try again.";
}

export default function LiveArSheet({
  productName,
  assetUrl,
  anchor,
  open,
  onOpenChange,
  onAddToCart,
}: LiveArSheetProps) {
  const [starting, setStarting] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [cameraSupported, setCameraSupported] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const startingRef = useRef(false);
  const activeRef = useRef(false);
  const runIdRef = useRef(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const imageTimeoutRef = useRef<number | null>(null);

  const releaseSession = useCallback(() => {
    runIdRef.current += 1;
    startingRef.current = false;
    activeRef.current = false;
    setStarting(false);
    setActive(false);
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    if (imageTimeoutRef.current !== null) {
      window.clearTimeout(imageTimeoutRef.current);
      imageTimeoutRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    if (imageRef.current) {
      imageRef.current.onload = null;
      imageRef.current.onerror = null;
      imageRef.current.src = "";
      imageRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      releaseSession();
      setError("");
    }
  }, [open, releaseSession]);

  useEffect(() => {
    setCameraSupported(
      typeof window !== "undefined" &&
        window.isSecureContext &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") releaseSession();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [open, releaseSession]);

  useEffect(() => () => releaseSession(), [releaseSession]);

  const startCamera = async () => {
    if (startingRef.current || activeRef.current) return;
    if (!cameraSupported) {
      setError("Live camera preview needs a supported browser and a secure connection (HTTPS).");
      return;
    }
    setError("");
    startingRef.current = true;
    setStarting(true);
    const runId = ++runIdRef.current;
    let module: VisionModule;
    let stream: MediaStream | null = null;
    let landmarker: FaceLandmarker | null = null;

    try {
      // Camera access is deliberately requested only after this explicit user action.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      if (runId !== runIdRef.current || !open) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("The camera preview could not be initialized.");
      video.srcObject = stream;
      await video.play();
      if (runId !== runIdRef.current || !open) return;

      module = await import("@mediapipe/tasks-vision");
      // Executable loader and WASM come from this app's own build, not a
      // third-party script origin with access to an active camera stream.
      const simd = await module.FilesetResolver.isSimdSupported();
      const fileset = {
        wasmLoaderPath: simd ? simdLoader : basicLoader,
        wasmBinaryPath: simd ? simdBinary : basicBinary,
      };
      landmarker = await module.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
      }).catch(() =>
        module.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.55,
          minFacePresenceConfidence: 0.55,
          minTrackingConfidence: 0.5,
        }),
      );
      if (runId !== runIdRef.current || !open) {
        landmarker.close();
        return;
      }
      landmarkerRef.current = landmarker;

      const image = new Image();
      // We never read pixels back from the canvas, so a curated remote asset
      // need not expose CORS headers just to be drawn over the video.
      image.onload = () => {
        if (runId !== runIdRef.current || !open) return;
        if (imageTimeoutRef.current !== null) window.clearTimeout(imageTimeoutRef.current);
        imageTimeoutRef.current = null;
        activeRef.current = true;
        startingRef.current = false;
        setStarting(false);
        setActive(true);
        const canvas = canvasRef.current;
        if (canvas && typeof ResizeObserver !== "undefined") {
          resizeObserverRef.current = new ResizeObserver(() => {
            const bounds = canvas.getBoundingClientRect();
            const dpr = Math.max(1, window.devicePixelRatio || 1);
            const width = Math.max(1, Math.round(bounds.width * dpr));
            const height = Math.max(1, Math.round(bounds.height * dpr));
            if (canvas.width !== width || canvas.height !== height) {
              canvas.width = width;
              canvas.height = height;
            }
          });
          resizeObserverRef.current.observe(canvas);
        }
        drawFrames(runId);
      };
      image.onerror = () => {
        if (runId !== runIdRef.current) return;
        setError("This accessory image couldn’t be loaded. Please try again later.");
        releaseSession();
      };
      imageRef.current = image;
      imageTimeoutRef.current = window.setTimeout(() => {
        if (runId !== runIdRef.current) return;
        setError("The accessory image took too long to load. Please try again later.");
        releaseSession();
      }, 15_000);
      image.src = assetUrl;
    } catch (cause) {
      if (runId !== runIdRef.current) return;
      landmarker?.close();
      if (stream && stream !== streamRef.current) stream.getTracks().forEach((track) => track.stop());
      setError(errorMessage(cause));
      releaseSession();
    }
  };

  const drawFrames = (runId: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    const image = imageRef.current;
    if (!video || !canvas || !landmarker || !image || !activeRef.current || runId !== runIdRef.current) return;

    const ctx = canvas.getContext("2d");
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        // Both camera and canvas share the same horizontal mirror for selfie alignment.
        const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
        const drawWidth = video.videoWidth * scale;
        const drawHeight = video.videoHeight * scale;
        const dx = (width - drawWidth) / 2;
        const dy = (height - drawHeight) / 2;
        ctx.save();
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
         ctx.drawImage(video, dx, dy, drawWidth, drawHeight);
        ctx.restore();

        try {
          const result = landmarker.detectForVideo(video, performance.now());
          const face = result.faceLandmarks[0] as Landmark[] | undefined;
          if (face) {
            const point = (index: number) => face[index];
            const imagePoint = (landmark: Landmark) => ({
              x: width - (dx + landmark.x * drawWidth),
              y: dy + landmark.y * drawHeight,
            });
            const forehead = point(10);
            const chin = point(152);
            const leftTemple = point(127);
            const rightTemple = point(356);
            const nose = point(1);
            if (forehead && chin && leftTemple && rightTemple && nose) {
              const top = imagePoint(forehead);
              const bottom = imagePoint(chin);
              const left = imagePoint(leftTemple);
              const right = imagePoint(rightTemple);
              const nosePoint = imagePoint(nose);
              const faceWidth = Math.hypot(right.x - left.x, right.y - left.y);
              const faceHeight = Math.hypot(bottom.x - top.x, bottom.y - top.y);
              const angle = Math.atan2(right.y - left.y, right.x - left.x);
              const roll = Math.abs(angle) > Math.PI / 2 ? angle - Math.sign(angle) * Math.PI : angle;
              const anchorPosition = {
                glasses: {
                  x: nosePoint.x,
                  y: nosePoint.y - faceHeight * 0.13,
                  width: faceWidth * 1.04,
                  height: faceWidth * (image.naturalHeight / image.naturalWidth),
                },
                headwear: {
                  x: (left.x + right.x) / 2,
                  y: top.y - faceHeight * 0.2,
                  width: faceWidth * 1.45,
                  height: faceWidth * 1.45 * (image.naturalHeight / image.naturalWidth),
                },
                earrings: {
                  x: (left.x + right.x) / 2,
                  y: (left.y + right.y) / 2 + faceHeight * 0.24,
                  width: faceWidth * 1.3,
                  height: faceWidth * 1.3 * (image.naturalHeight / image.naturalWidth),
                },
              }[anchor];
              ctx.save();
              ctx.translate(anchorPosition.x, anchorPosition.y);
              ctx.rotate(roll);
              ctx.drawImage(
                image,
                -anchorPosition.width / 2,
                -anchorPosition.height / 2,
                anchorPosition.width,
                anchorPosition.height,
              );
              ctx.restore();
            }
          }
        } catch {
          // Face tracking may briefly miss while moving; the camera remains local and active.
        }
      }
    }
    frameRef.current = requestAnimationFrame(() => drawFrames(runId));
  };

  const close = () => {
    releaseSession();
    onOpenChange(false);
  };

  const startDisabled = starting || !cameraSupported;

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) releaseSession();
      onOpenChange(nextOpen);
    }}>
      <SheetContent
        side="right"
        aria-describedby="live-ar-description"
        className="flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden border-l border-emerald-950/10 bg-[#f7f5ef] p-0 text-[#19342b] sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b border-emerald-950/10 px-5 pb-4 pt-6 text-left sm:px-8">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AfrolandX Live Accessory Preview
          </div>
          <SheetTitle className="font-nigerian text-2xl font-bold leading-tight text-[#19342b] sm:text-3xl">
            Try the detail in real time.
          </SheetTitle>
          <SheetDescription id="live-ar-description" className="max-w-md text-sm leading-relaxed text-[#64756d]">
            A live, visual-only overlay for {productName}. It does not show fit, material, or sizing.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          <section className="space-y-4" aria-label="Live accessory preview">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-emerald-950/10 bg-[#e5e8de]">
              <video
                ref={videoRef}
                muted
                playsInline
                aria-label="Mirrored live camera preview"
                className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
              />
              <canvas
                ref={canvasRef}
                aria-label={`Live visual preview with ${productName} accessory overlay`}
                className="absolute inset-0 h-full w-full"
              />
              {!active && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#e5e8de] px-7 text-center">
                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-900 shadow-sm">
                    <Camera className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <p className="text-base font-semibold text-[#19342b]">Camera stays off until you choose</p>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#64756d]">
                    Start the preview when you’re ready. Your camera frames are processed on this device and are never uploaded or saved.
                  </p>
                </div>
              )}
              {active && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-[#19342b]/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#c9dfb4]" aria-hidden="true" />
                  Live · on this device
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-emerald-950/10 bg-white/65 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-[#19342b]">Before you start</h3>
              <ul className="mt-3 grid gap-2 text-xs leading-relaxed text-[#64756d]">
                <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-800" aria-hidden="true" /> Camera access is requested only when you press Start camera.</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-800" aria-hidden="true" /> Face landmarks and this accessory image are processed in your browser; no camera image or video is uploaded or stored.</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-800" aria-hidden="true" /> Close this panel or switch away from the tab to stop the camera.</li>
              </ul>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-emerald-900/10 bg-white/55 px-3.5 py-3 text-xs leading-relaxed text-[#64756d]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" aria-hidden="true" />
              <p>Visual preview only. Landmark placement can shift with lighting, angle, or movement. This is not a 3D fitting, fit recommendation, or size guarantee.</p>
            </div>
          </section>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-900/15 bg-rose-50 px-3.5 py-3 text-sm text-rose-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-emerald-950/10 bg-[#f7f5ef] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-8">
          {active ? (
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={close} variant="outline" className="h-12 border-emerald-900/20 bg-transparent text-[#19342b] hover:bg-white">
                <VideoOff aria-hidden="true" /> Stop camera
              </Button>
              <Button
                onClick={() => { onAddToCart(); close(); }}
                className="h-12 bg-[#19342b] text-white hover:bg-[#25483b]"
              >
                Add to Cart
              </Button>
            </div>
          ) : (
            <Button
              onClick={startCamera}
              disabled={startDisabled}
              className="h-12 w-full bg-[#19342b] text-white hover:bg-[#25483b]"
            >
              {starting
                ? <><LoaderCircle className="animate-spin" aria-hidden="true" /> Preparing camera…</>
                : <><Camera aria-hidden="true" /> Start camera</>}
            </Button>
          )}
          <p className="mt-2 text-center text-[10px] text-[#849087]">Live visual overlay · No image capture or upload</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}