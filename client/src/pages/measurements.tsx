import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Measurement, type Vendor } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MeasurementForm } from "@/components/measurement-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Navbar from "@/components/navbar";
import { Ruler, Trash2, Plus, Loader2, CheckCircle, Clock, Mail, User, Layers } from "lucide-react";
import { format } from "date-fns";

const MEASUREMENT_FIELDS = [
  { key: "chest",        label: "Chest",          emoji: "📏" },
  { key: "waist",        label: "Waist",           emoji: "📐" },
  { key: "hips",         label: "Hips",            emoji: "📏" },
  { key: "height",       label: "Height",          emoji: "📐" },
  { key: "shoulderWidth",label: "Shoulders",       emoji: "📏" },
  { key: "sleeveLength", label: "Sleeve Length",   emoji: "📐" },
  { key: "armLength",    label: "Arm Length",      emoji: "📏" },
  { key: "inseam",       label: "Inseam",          emoji: "📐" },
  { key: "outseam",      label: "Outseam",         emoji: "📏" },
  { key: "neck",         label: "Neck",            emoji: "📐" },
] as const;

function StatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "acknowledged":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
          <CheckCircle className="w-3.5 h-3.5" /> Acknowledged
        </span>
      );
    case "received":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
          <Mail className="w-3.5 h-3.5" /> Received
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
          <Clock className="w-3.5 h-3.5" /> Pending
        </span>
      );
  }
}

export default function MeasurementsPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const { data: measurements, isLoading } = useQuery<Measurement[]>({
    queryKey: ["/api/measurements"],
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors/approved"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/measurements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/measurements"] });
      toast({ title: "Deleted", description: "Measurement removed successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete measurement.", variant: "destructive" });
    },
  });

  const getVendorName = (vendorId: number | null) => {
    if (!vendorId || !vendors) return null;
    return vendors.find((v) => v.id === vendorId)?.businessName || null;
  };

  const hasMeasurements = (m: Measurement) =>
    MEASUREMENT_FIELDS.some((f) => (m as any)[f.key] != null);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-nigerian-green/10 flex items-center justify-center shrink-0">
                <Ruler className="w-7 h-7 text-nigerian-green" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Measurements</h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  Your body measurements for perfectly fitted Nigerian fashion
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowForm(true)}
              className="btn-nigerian h-11 px-6 gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Measurements
            </Button>
          </div>

          {/* Quick tip banner */}
          <div className="mt-6 p-4 rounded-xl bg-nigerian-green/5 border border-nigerian-green/20 flex gap-3 items-start">
            <span className="text-2xl shrink-0">💡</span>
            <p className="text-sm text-gray-700">
              <strong className="text-nigerian-green">Why measurements matter:</strong> Sharing your exact body measurements helps our vendors craft clothing that fits you perfectly, with no returns or alterations needed.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {[1, 2].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-5 bg-gray-200 rounded w-1/2 mb-4" />
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(6)].map((_, j) => (
                      <div key={j} className="h-10 bg-gray-100 rounded-lg" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : measurements && measurements.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {measurements.map((measurement, idx) => {
              const vendorName = getVendorName(measurement.vendorId);
              const filledFields = MEASUREMENT_FIELDS.filter(f => (measurement as any)[f.key] != null);

              return (
                <Card key={measurement.id} className="overflow-hidden border-0 shadow-sm ring-1 ring-gray-200 hover:shadow-md transition-shadow" data-testid={`measurement-${measurement.id}`}>
                  {/* Card top strip */}
                  <div className="h-1.5 bg-gradient-to-r from-nigerian-green to-emerald-400" />

                  <CardContent className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
                          <Layers className="w-4 h-4 text-nigerian-green" />
                          Measurement Set {idx + 1}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {measurement.createdAt
                            ? format(new Date(measurement.createdAt), "MMM d, yyyy 'at' h:mm a")
                            : "Unknown date"}
                        </p>
                      </div>
                      <StatusBadge status={measurement.status} />
                    </div>

                    {/* Meta chips */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-600 font-medium">
                        <Ruler className="w-3 h-3" /> {measurement.unit === "cm" ? "Centimeters" : "Inches"}
                      </span>
                      {vendorName && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-nigerian-green/10 text-nigerian-green font-medium">
                          <User className="w-3 h-3" /> {vendorName}
                        </span>
                      )}
                    </div>

                    {/* Measurements grid */}
                    {filledFields.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {filledFields.map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-xs text-gray-500">{label}</span>
                            <span className="text-sm font-semibold text-gray-900" data-testid={`${key}-${measurement.id}`}>
                              {(measurement as any)[key]}
                              <span className="text-xs font-normal text-gray-400 ml-0.5">{measurement.unit}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic text-center py-3">No measurements recorded</p>
                    )}

                    {/* Notes */}
                    {measurement.notes && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
                        <p className="text-sm text-amber-800">{measurement.notes}</p>
                      </div>
                    )}

                    {/* Delete */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 gap-2"
                            data-testid={`button-delete-${measurement.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove this set
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete measurement set?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove Measurement Set {idx + 1}. Vendors who already have this data won't be affected, but you'll no longer see it here.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-delete">Keep it</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(measurement.id)}
                              className="bg-red-500 hover:bg-red-600"
                              data-testid="button-confirm-delete"
                            >
                              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-nigerian-green/10 flex items-center justify-center">
              <Ruler className="w-10 h-10 text-nigerian-green" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No measurements yet</h2>
            <p className="text-gray-500 max-w-sm mx-auto mb-8 text-sm leading-relaxed">
              Add your body measurements so vendors can tailor clothing that fits you perfectly, from Agbada to Ankara dresses.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => setShowForm(true)}
                className="btn-nigerian gap-2"
                data-testid="button-add-first"
              >
                <Plus className="w-4 h-4" /> Add My First Measurements
              </Button>
            </div>

            {/* How it works */}
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto text-left">
              {[
                { step: "1", icon: "📐", title: "Enter your sizes", desc: "Fill in chest, waist, hips and other measurements in cm or inches." },
                { step: "2", icon: "📤", title: "Send to vendor", desc: "Choose a vendor and submit. They'll receive your measurements instantly." },
                { step: "3", icon: "👗", title: "Get a perfect fit", desc: "Your order is tailored to your exact body, with no alterations needed." },
              ].map(item => (
                <div key={item.step} className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-nigerian-green text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <div className="text-xl mb-1">{item.icon}</div>
                    <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Measurements Sheet */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl flex items-center gap-2">
              <Ruler className="w-5 h-5 text-nigerian-green" /> Add Your Measurements
            </SheetTitle>
            <SheetDescription>
              Fill in as many measurements as you can. The more you provide, the better your fit.
            </SheetDescription>
          </SheetHeader>
          <MeasurementForm onSuccess={() => setShowForm(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
