import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertMeasurementSchema, type Vendor } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Scan, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface MeasurementFormProps {
  vendorId?: number;
  productId?: number;
  orderId?: number;
  onSuccess?: () => void;
}

type Unit = "cm" | "inches";
type ScanStatus = "pending" | "processing" | "completed" | "failed";

interface ScanMeasurements {
  chest?: number;
  waist?: number;
  hips?: number;
  height?: number;
  shoulderWidth?: number;
  sleeveLength?: number;
  armLength?: number;
  inseam?: number;
  outseam?: number;
  neck?: number;
}

interface ScanInitiateResponse {
  sessionId: string;
  status: ScanStatus;
  demoMode: boolean;
  scanUrl?: string;
  message?: string;
}

interface ScanResultsResponse {
  status: ScanStatus;
  demoMode: boolean;
  measurements?: ScanMeasurements;
  model3dUrl?: string;
  message?: string;
}

interface FieldConfig {
  name: string;
  label: string;
  placeholder: (unit: Unit) => string;
  hint: string;
}

const UPPER_BODY: FieldConfig[] = [
  { name: "chest",        label: "Chest",         placeholder: u => u === "cm" ? "e.g. 90" : "e.g. 35",  hint: "Measure around the fullest part of your chest" },
  { name: "waist",        label: "Waist",         placeholder: u => u === "cm" ? "e.g. 75" : "e.g. 30",  hint: "Measure around your natural waistline" },
  { name: "hips",         label: "Hips",          placeholder: u => u === "cm" ? "e.g. 95" : "e.g. 37",  hint: "Measure around the fullest part of your hips" },
  { name: "neck",         label: "Neck",          placeholder: u => u === "cm" ? "e.g. 38" : "e.g. 15",  hint: "Measure around the base of your neck" },
];

const HEIGHT_SHOULDER: FieldConfig[] = [
  { name: "height",       label: "Height",        placeholder: u => u === "cm" ? "e.g. 170" : "e.g. 67", hint: "Your total standing height" },
  { name: "shoulderWidth",label: "Shoulder Width",placeholder: u => u === "cm" ? "e.g. 45" : "e.g. 18",  hint: "Measure shoulder tip to shoulder tip" },
];

const ARMS: FieldConfig[] = [
  { name: "sleeveLength", label: "Sleeve Length", placeholder: u => u === "cm" ? "e.g. 60" : "e.g. 24",  hint: "From shoulder seam to wrist" },
  { name: "armLength",    label: "Arm Length",    placeholder: u => u === "cm" ? "e.g. 58" : "e.g. 23",  hint: "From armpit to wrist" },
];

const LEGS: FieldConfig[] = [
  { name: "inseam",       label: "Inseam",        placeholder: u => u === "cm" ? "e.g. 80" : "e.g. 31",  hint: "From crotch to ankle (inner leg)" },
  { name: "outseam",      label: "Outseam",       placeholder: u => u === "cm" ? "e.g. 105" : "e.g. 41", hint: "From waist to ankle (outer leg)" },
];

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-nigerian-green/10 flex items-center justify-center text-lg shrink-0">
        {emoji}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
}

function MeasurementInput({ field, config, unit }: { field: any; config: FieldConfig; unit: Unit }) {
  return (
    <FormItem>
      <FormLabel className="text-sm font-medium text-gray-700">{config.label}</FormLabel>
      <FormControl>
        <div className="relative">
          <Input
            type="number"
            step="0.1"
            min="0"
            placeholder={config.placeholder(unit)}
            {...field}
            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
            value={field.value ?? ""}
            className="pr-12 input-nigerian"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400 pointer-events-none">
            {unit}
          </span>
        </div>
      </FormControl>
      <p className="text-xs text-gray-400 mt-0.5">{config.hint}</p>
      <FormMessage />
    </FormItem>
  );
}

export function MeasurementForm({ vendorId, productId, orderId, onSuccess }: MeasurementFormProps) {
  const { toast } = useToast();
  const [unit, setUnit] = useState<Unit>("cm");
  const [showScanPrompt, setShowScanPrompt] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "initiating" | "processing" | "completed" | "error">("idle");
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [scanData, setScanData] = useState<any>(null);
  const [scanGender, setScanGender] = useState<"male" | "female">("female");
  const [scanHeight, setScanHeight] = useState<number>(170);
  const [showOptional, setShowOptional] = useState(false);

  const form = useForm<any>({
    resolver: zodResolver(insertMeasurementSchema.omit({ userId: true })),
    defaultValues: {
      unit: "cm",
      status: "pending",
      vendorId: vendorId || undefined,
      productId: productId || undefined,
      orderId: orderId || undefined,
      chest: undefined, waist: undefined, hips: undefined, height: undefined,
      shoulderWidth: undefined, sleeveLength: undefined, armLength: undefined,
      inseam: undefined, outseam: undefined, neck: undefined, notes: "",
    },
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors/approved"],
    enabled: !vendorId,
  });

  const createMeasurementMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/measurements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/measurements"] });
      toast({ title: "Measurements saved!", description: "Your vendor has been notified." });
      form.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save measurements.", variant: "destructive" });
    },
  });

  const onSubmit = (data: any) => {
    const submitData = scanData
      ? { ...data, scanMethod: "ai_scan", scanSessionId, scanData }
      : data;
    createMeasurementMutation.mutate(submitData);
  };

  const handleUnitChange = (newUnit: Unit) => {
    setUnit(newUnit);
    form.setValue("unit", newUnit);
  };

  const handleConfirmScan = async () => {
    setShowScanPrompt(false);
    setScanStatus("initiating");
    try {
      const apiResponse = await apiRequest("POST", "/api/body-scan/initiate", { gender: scanGender, height: scanHeight });
      const response = await apiResponse.json() as ScanInitiateResponse;
      setScanSessionId(response.sessionId);
      setIsDemoMode(response.demoMode);
      setScanData(response);
      setScanStatus("processing");
      pollScanResults(response.sessionId);
    } catch {
      setScanStatus("error");
      toast({ title: "Scan failed", description: "Could not start body scan. Please enter measurements manually.", variant: "destructive" });
    }
  };

  const pollScanResults = async (sessionId: string) => {
    let attempts = 0;
    const poll = async () => {
      if (attempts >= 40) {
        setScanStatus("error");
        return;
      }
      try {
        const apiResponse = await apiRequest("GET", `/api/body-scan/results/${sessionId}`);
        const response = await apiResponse.json() as ScanResultsResponse;
        if (response.status === "completed" && response.measurements) {
          const m = response.measurements;
          (["chest","waist","hips","height","shoulderWidth","sleeveLength","armLength","inseam","outseam","neck"] as const)
            .forEach(k => form.setValue(k as any, m[k]));
          form.setValue("unit", "cm");
          setUnit("cm");
          setScanData({ scanMethod: "ai_scan", scanSessionId: sessionId, scanData: response });
          setScanStatus("completed");
          toast({ title: "Scan complete!", description: isDemoMode ? "Demo measurements loaded. Review and submit." : "Measurements loaded. Review and submit." });
          setTimeout(() => setScanStatus("idle"), 3000);
        } else if (response.status === "pending" || response.status === "processing") {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          setScanStatus("error");
        }
      } catch {
        setScanStatus("error");
      }
    };
    poll();
  };

  const isScanLoading = scanStatus === "initiating" || scanStatus === "processing";

  return (
    <div className="space-y-6">
      {/* AI Scan CTA */}
      <div className="rounded-2xl border-2 border-dashed border-nigerian-green/30 bg-nigerian-green/5 p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-nigerian-green flex items-center justify-center shrink-0">
            <Scan className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm">AI Body Scan</h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Use your phone camera to get accurate measurements in 60 seconds. No tape measure needed.
            </p>
            {scanStatus === "completed" && (
              <p className="text-xs text-green-600 font-medium mt-1.5">✓ Measurements loaded! Review below and submit.</p>
            )}
            {scanStatus === "error" && (
              <p className="text-xs text-red-500 mt-1.5">Scan failed. Please enter measurements manually.</p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowScanPrompt(true)}
            className="btn-nigerian shrink-0"
            disabled={isScanLoading}
            data-testid="button-scan-body"
          >
            {isScanLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Scanning…</> : "Scan Now"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or enter manually</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Unit Toggle */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Measurement Unit</label>
            <div className="inline-flex rounded-xl border border-gray-200 p-1 bg-gray-50 gap-1">
              {(["cm", "inches"] as Unit[]).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => handleUnitChange(u)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    unit === u
                      ? "bg-nigerian-green text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  data-testid={`option-${u}`}
                >
                  {u === "cm" ? "Centimeters (cm)" : "Inches (in)"}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor Selection */}
          {!vendorId && vendors && vendors.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Send to Vendor <span className="text-gray-400 font-normal">(optional)</span></label>
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString()} data-testid="select-vendor">
                      <FormControl>
                        <SelectTrigger className="input-nigerian" data-testid="trigger-vendor">
                          <SelectValue placeholder="Choose a vendor to notify" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendors.map(v => (
                          <SelectItem key={v.id} value={v.id.toString()} data-testid={`vendor-${v.id}`}>
                            {v.businessName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Upper Body */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <SectionHeader emoji="👕" title="Upper Body" subtitle="Chest, waist, hips and neck" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {UPPER_BODY.map(config => (
                <FormField
                  key={config.name}
                  control={form.control}
                  name={config.name as any}
                  render={({ field }) => <MeasurementInput field={field} config={config} unit={unit} />}
                />
              ))}
            </div>
          </div>

          {/* Height & Shoulders */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <SectionHeader emoji="📏" title="Height & Shoulders" subtitle="Your overall frame" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {HEIGHT_SHOULDER.map(config => (
                <FormField
                  key={config.name}
                  control={form.control}
                  name={config.name as any}
                  render={({ field }) => <MeasurementInput field={field} config={config} unit={unit} />}
                />
              ))}
            </div>
          </div>

          {/* Optional: Arms & Legs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOptional(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-lg shrink-0">
                  🦾
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Arms & Legs <span className="text-gray-400 font-normal ml-1">(optional)</span></h3>
                  <p className="text-xs text-gray-400">Sleeve, arm, inseam and outseam lengths</p>
                </div>
              </div>
              {showOptional
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showOptional && (
              <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...ARMS, ...LEGS].map(config => (
                    <FormField
                      key={config.name}
                      control={form.control}
                      name={config.name as any}
                      render={({ field }) => <MeasurementInput field={field} config={config} unit={unit} />}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <SectionHeader emoji="📝" title="Notes" subtitle="Any special fitting preferences" />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="E.g. I prefer a loose fit around the shoulders, or my left arm is slightly shorter than my right…"
                      className="resize-none input-nigerian"
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full btn-nigerian h-12 text-base font-semibold gap-2"
            disabled={createMeasurementMutation.isPending}
            data-testid="button-submit-measurements"
          >
            {createMeasurementMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : "Save Measurements"}
          </Button>
        </form>
      </Form>

      {/* Scan Setup Dialog */}
      <Dialog open={showScanPrompt} onOpenChange={setShowScanPrompt}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-scan-prompt">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-nigerian-green" /> Body Scan Setup
            </DialogTitle>
            <DialogDescription>
              We need a couple of details so the AI can give you accurate measurements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Body type</label>
              <div className="grid grid-cols-2 gap-2">
                {(["female","male"] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setScanGender(g)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      scanGender === g
                        ? "bg-nigerian-green text-white border-nigerian-green"
                        : "bg-white text-gray-600 border-gray-200 hover:border-nigerian-green"
                    }`}
                    data-testid={`scan-gender-${g}`}
                  >
                    {g === "female" ? "👩 Female" : "👨 Male"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Your height (cm)</label>
              <Input
                type="number"
                value={scanHeight}
                onChange={e => setScanHeight(parseInt(e.target.value) || 170)}
                placeholder="e.g. 170"
                className="input-nigerian"
                data-testid="input-scan-height"
              />
              <p className="text-xs text-gray-400 mt-1">Used as a reference for scaling all other measurements</p>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowScanPrompt(false)}>
              Cancel
            </Button>
            <Button className="flex-1 btn-nigerian" onClick={handleConfirmScan} data-testid="button-confirm-scan">
              Start Scan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
