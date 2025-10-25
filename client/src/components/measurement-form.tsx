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
import { Ruler, Loader2 } from "lucide-react";

interface MeasurementFormProps {
  vendorId?: number;
  productId?: number;
  orderId?: number;
  onSuccess?: () => void;
}

export function MeasurementForm({ vendorId, productId, orderId, onSuccess }: MeasurementFormProps) {
  const { toast } = useToast();
  const [selectedUnit, setSelectedUnit] = useState<"cm" | "inches">("cm");

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
    createMeasurementMutation.mutate(data);
  };

  const handleUnitChange = (newUnit: "cm" | "inches") => {
    setSelectedUnit(newUnit);
    form.setValue("unit", newUnit);
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
    </Card>
  );
}
