import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertMeasurementSchema, type InsertMeasurement, type Vendor } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Ruler, Loader2, Scan, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MeasurementFormProps {
  vendorId?: number;
  productId?: number;
  orderId?: number;
  onSuccess?: () => void;
}

export function MeasurementForm({ vendorId, productId, orderId, onSuccess }: MeasurementFormProps) {
  const { toast } = useToast();
  const [selectedUnit, setSelectedUnit] = useState<"cm" | "inches">("cm");
  const [isScanningModalOpen, setIsScanningModalOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'initiating' | 'processing' | 'completed' | 'error'>('idle');
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [scanData, setScanData] = useState<any>(null);
  const [showGenderHeightPrompt, setShowGenderHeightPrompt] = useState(false);
  const [scanGender, setScanGender] = useState<'male' | 'female'>('female');
  const [scanHeight, setScanHeight] = useState<number>(170);

  const form = useForm<any>({
    resolver: zodResolver(insertMeasurementSchema.omit({ userId: true })),
    defaultValues: {
      unit: "cm",
      status: "pending",
      vendorId: vendorId || undefined,
      productId: productId || undefined,
      orderId: orderId || undefined,
      chest: undefined,
      waist: undefined,
      hips: undefined,
      height: undefined,
      shoulderWidth: undefined,
      sleeveLength: undefined,
      armLength: undefined,
      inseam: undefined,
      outseam: undefined,
      neck: undefined,
      notes: "",
    },
  });

  // Fetch vendors for dropdown if vendorId not provided
  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors/approved"],
    enabled: !vendorId,
  });

  const createMeasurementMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/measurements", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/measurements"] });
      toast({
        title: "Success",
        description: "Your measurements have been submitted successfully.",
      });
      form.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit measurements. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    // Include scan metadata if measurements came from scan
    const submitData = scanData ? {
      ...data,
      scanMethod: 'ai_scan',
      scanSessionId: scanSessionId,
      scanData: scanData,
    } : data;
    
    createMeasurementMutation.mutate(submitData);
  };

  const handleUnitChange = (newUnit: "cm" | "inches") => {
    setSelectedUnit(newUnit);
    form.setValue("unit", newUnit);
  };

  const handleStartScan = () => {
    setShowGenderHeightPrompt(true);
  };

  const handleConfirmScan = async () => {
    setShowGenderHeightPrompt(false);
    setIsScanningModalOpen(true);
    setScanStatus('initiating');
    
    try {
      // Initiate scan with user-provided gender and height
      const response = await apiRequest('POST', '/api/body-scan/initiate', {
        gender: scanGender,
        height: scanHeight,
      });
      
      setScanSessionId(response.sessionId);
      setIsDemoMode(response.demoMode);
      setScanData(response);
      setScanStatus('processing');
      
      // Poll for results
      pollScanResults(response.sessionId);
    } catch (error) {
      console.error('Error initiating scan:', error);
      setScanStatus('error');
      toast({
        title: "Error",
        description: "Failed to start body scan. Please try again.",
        variant: "destructive",
      });
    }
  };

  const pollScanResults = async (sessionId: string) => {
    const maxAttempts = 40; // 40 attempts * 2 seconds = 80 seconds max
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setScanStatus('error');
        toast({
          title: "Timeout",
          description: "Scan is taking longer than expected. Please try again.",
          variant: "destructive",
        });
        return;
      }

      try {
        const response = await apiRequest('GET', `/api/body-scan/results/${sessionId}`);
        
        if (response.status === 'completed' && response.measurements) {
          // Auto-fill form with measurements
          const measurements = response.measurements;
          form.setValue('chest', measurements.chest);
          form.setValue('waist', measurements.waist);
          form.setValue('hips', measurements.hips);
          form.setValue('height', measurements.height);
          form.setValue('shoulderWidth', measurements.shoulderWidth);
          form.setValue('sleeveLength', measurements.sleeveLength);
          form.setValue('armLength', measurements.armLength);
          form.setValue('inseam', measurements.inseam);
          form.setValue('outseam', measurements.outseam);
          form.setValue('neck', measurements.neck);
          form.setValue('unit', 'cm');
          setSelectedUnit('cm');

          // Store scan metadata for submission
          setScanData({
            scanMethod: 'ai_scan',
            scanSessionId: sessionId,
            scanData: response,
          });

          setScanStatus('completed');
          
          toast({
            title: "Scan Complete!",
            description: isDemoMode 
              ? "Demo measurements loaded. Review and submit when ready."
              : "Your body measurements have been loaded. Review and submit when ready.",
          });
          
          // Close modal after a delay
          setTimeout(() => {
            setIsScanningModalOpen(false);
          }, 2000);
        } else if (response.status === 'pending' || response.status === 'processing') {
          attempts++;
          setTimeout(poll, 2000); // Poll every 2 seconds
        } else if (response.status === 'failed' || response.status === 'error') {
          setScanStatus('error');
          toast({
            title: "Scan Failed",
            description: "Body scan failed. Please try manual entry.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error polling scan results:', error);
        setScanStatus('error');
        toast({
          title: "Error",
          description: "Failed to retrieve scan results. Please try manual entry.",
          variant: "destructive",
        });
      }
    };

    poll();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ruler className="h-5 w-5" />
          Submit Your Measurements
        </CardTitle>
        <CardDescription>
          Provide your body measurements for custom tailoring. All measurements are optional, but more details help ensure a perfect fit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Body Scan Option */}
        <div className="mb-6">
          <Alert className="bg-nigerian-green/10 border-nigerian-green">
            <Info className="h-4 w-4 text-nigerian-green" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">
                Skip manual entry! Use AI body scanning to get accurate measurements from your phone camera.
              </span>
              <Button
                type="button"
                onClick={handleStartScan}
                className="btn-nigerian ml-4"
                data-testid="button-scan-body"
              >
                <Scan className="h-4 w-4 mr-2" />
                Scan My Body
              </Button>
            </AlertDescription>
          </Alert>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Unit Selection */}
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Measurement Unit</FormLabel>
                  <Select
                    onValueChange={(value: "cm" | "inches") => {
                      field.onChange(value);
                      handleUnitChange(value);
                    }}
                    defaultValue={field.value}
                    data-testid="select-unit"
                  >
                    <FormControl>
                      <SelectTrigger data-testid="trigger-unit">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cm" data-testid="option-cm">Centimeters (cm)</SelectItem>
                      <SelectItem value="inches" data-testid="option-inches">Inches (in)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vendor Selection (if not pre-filled) */}
            {!vendorId && vendors && vendors.length > 0 && (
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Vendor</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                      data-testid="select-vendor"
                    >
                      <FormControl>
                        <SelectTrigger data-testid="trigger-vendor">
                          <SelectValue placeholder="Choose a vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id.toString()} data-testid={`vendor-${vendor.id}`}>
                            {vendor.businessName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the vendor who will receive your measurements
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Measurement Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="chest"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chest</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={`e.g., ${selectedUnit === "cm" ? "90" : "35"}`}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        data-testid="input-chest"
                      />
                    </FormControl>
                    <FormDescription>{selectedUnit}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="waist"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Waist</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={`e.g., ${selectedUnit === "cm" ? "75" : "30"}`}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        data-testid="input-waist"
                      />
                    </FormControl>
                    <FormDescription>{selectedUnit}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hips"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hips</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={`e.g., ${selectedUnit === "cm" ? "95" : "37"}`}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        data-testid="input-hips"
                      />
                    </FormControl>
                    <FormDescription>{selectedUnit}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={`e.g., ${selectedUnit === "cm" ? "170" : "67"}`}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        data-testid="input-height"
                      />
                    </FormControl>
                    <FormDescription>{selectedUnit}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shoulderWidth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shoulder Width</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={`e.g., ${selectedUnit === "cm" ? "45" : "18"}`}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        data-testid="input-shoulder"
                      />
                    </FormControl>
                    <FormDescription>{selectedUnit}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sleeveLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sleeve Length</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={`e.g., ${selectedUnit === "cm" ? "60" : "24"}`}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        data-testid="input-sleeve"
                      />
                    </FormControl>
                    <FormDescription>{selectedUnit}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="inseam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inseam</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={`e.g., ${selectedUnit === "cm" ? "80" : "31"}`}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        data-testid="input-inseam"
                      />
                    </FormControl>
                    <FormDescription>{selectedUnit}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="neck"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Neck</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={`e.g., ${selectedUnit === "cm" ? "40" : "16"}`}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        data-testid="input-neck"
                      />
                    </FormControl>
                    <FormDescription>{selectedUnit}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes Field */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any special requirements or details about your measurements..."
                      className="resize-none"
                      rows={4}
                      {...field}
                      value={field.value ?? ""}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormDescription>
                    Include any special fitting preferences or additional information
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={createMeasurementMutation.isPending}
              data-testid="button-submit-measurements"
            >
              {createMeasurementMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit Measurements
            </Button>
          </form>
        </Form>
      </CardContent>

      {/* Gender/Height Prompt Dialog */}
      <Dialog open={showGenderHeightPrompt} onOpenChange={setShowGenderHeightPrompt}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-scan-prompt">
          <DialogHeader>
            <DialogTitle>Body Scan Setup</DialogTitle>
            <DialogDescription>
              We need a few details to start your body scan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Gender</label>
              <Select
                value={scanGender}
                onValueChange={(value: 'male' | 'female') => setScanGender(value)}
                data-testid="select-scan-gender"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                This helps the AI provide more accurate measurements
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Approximate Height (cm)</label>
              <Input
                type="number"
                value={scanHeight}
                onChange={(e) => setScanHeight(parseInt(e.target.value) || 170)}
                placeholder="e.g., 170"
                data-testid="input-scan-height"
              />
              <p className="text-xs text-gray-500">
                Your approximate height in centimeters
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowGenderHeightPrompt(false)}
              data-testid="button-cancel-scan"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmScan}
              className="btn-nigerian"
              data-testid="button-confirm-scan"
            >
              <Scan className="h-4 w-4 mr-2" />
              Start Scan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scanning Modal */}
      <Dialog open={isScanningModalOpen} onOpenChange={setIsScanningModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-scanning">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5 text-nigerian-green" />
              {scanStatus === 'completed' ? 'Scan Complete!' : 'Body Scanning'}
            </DialogTitle>
            <DialogDescription>
              {isDemoMode && (
                <Alert className="mt-2 bg-yellow-50 border-yellow-300">
                  <Info className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Demo Mode:</strong> This is a simulation. In production, customers would use their phone camera for actual scanning.
                  </AlertDescription>
                </Alert>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {scanStatus === 'initiating' && (
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-nigerian-green" />
                <p className="text-sm text-gray-600">Initializing scanner...</p>
              </div>
            )}

            {scanStatus === 'processing' && (
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-nigerian-green" />
                <div className="space-y-2">
                  <p className="font-medium">Processing your scan...</p>
                  <p className="text-sm text-gray-600">
                    {isDemoMode 
                      ? "In demo mode, this simulates the 45-60 second AI processing time."
                      : "AI is analyzing your photos to extract measurements. This takes about 45-60 seconds."}
                  </p>
                  {isDemoMode && (
                    <p className="text-xs text-gray-500 mt-4">
                      In production, you would:<br />
                      1. Be redirected to your phone camera<br />
                      2. Follow voice-guided instructions to take 2 photos<br />
                      3. Wait for AI processing<br />
                      4. Measurements automatically loaded here
                    </p>
                  )}
                </div>
              </div>
            )}

            {scanStatus === 'completed' && (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <Scan className="h-6 w-6 text-green-600" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-green-600">Measurements loaded successfully!</p>
                  <p className="text-sm text-gray-600">
                    Your body measurements have been auto-filled in the form. Review and submit when ready.
                  </p>
                </div>
              </div>
            )}

            {scanStatus === 'error' && (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <Info className="h-6 w-6 text-red-600" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-red-600">Scan failed</p>
                  <p className="text-sm text-gray-600">
                    Please try again or use manual entry below.
                  </p>
                </div>
                <Button
                  onClick={() => setIsScanningModalOpen(false)}
                  variant="outline"
                  data-testid="button-close-scan-error"
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
