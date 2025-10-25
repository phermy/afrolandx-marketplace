import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Measurement, type Vendor } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MeasurementForm } from "@/components/measurement-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Ruler, Trash2, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";

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
      toast({
        title: "Success",
        description: "Measurement deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete measurement.",
        variant: "destructive",
      });
    },
  });

  const getVendorName = (vendorId: number | null) => {
    if (!vendorId || !vendors) return "N/A";
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor?.businessName || "Unknown Vendor";
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "acknowledged":
        return "bg-green-500";
      case "received":
        return "bg-blue-500";
      case "pending":
      default:
        return "bg-yellow-500";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">My Measurements</h1>
          <p className="text-muted-foreground">
            Manage your body measurements for custom tailoring
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          data-testid="button-toggle-form"
        >
          {showForm ? (
            <>Hide Form</>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add Measurements
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <div className="mb-8">
          <MeasurementForm
            onSuccess={() => setShowForm(false)}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : measurements && measurements.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {measurements.map((measurement) => (
            <Card key={measurement.id} data-testid={`measurement-${measurement.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Ruler className="h-5 w-5" />
                    <CardTitle>Measurement #{measurement.id}</CardTitle>
                  </div>
                  <Badge className={getStatusColor(measurement.status)}>
                    {measurement.status || "pending"}
                  </Badge>
                </div>
                <CardDescription>
                  Submitted on {measurement.createdAt ? format(new Date(measurement.createdAt), "MMM d, yyyy") : "Unknown date"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vendor:</span>
                    <span className="font-medium" data-testid={`vendor-name-${measurement.id}`}>
                      {getVendorName(measurement.vendorId)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Unit:</span>
                    <span className="font-medium">{measurement.unit}</span>
                  </div>
                  
                  <div className="mt-4 space-y-1">
                    <p className="text-sm font-semibold">Measurements:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {measurement.chest && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Chest:</span>
                          <span data-testid={`chest-${measurement.id}`}>{measurement.chest}</span>
                        </div>
                      )}
                      {measurement.waist && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Waist:</span>
                          <span data-testid={`waist-${measurement.id}`}>{measurement.waist}</span>
                        </div>
                      )}
                      {measurement.hips && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Hips:</span>
                          <span data-testid={`hips-${measurement.id}`}>{measurement.hips}</span>
                        </div>
                      )}
                      {measurement.height && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Height:</span>
                          <span data-testid={`height-${measurement.id}`}>{measurement.height}</span>
                        </div>
                      )}
                      {measurement.shoulderWidth && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Shoulder:</span>
                          <span>{measurement.shoulderWidth}</span>
                        </div>
                      )}
                      {measurement.sleeveLength && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sleeve:</span>
                          <span>{measurement.sleeveLength}</span>
                        </div>
                      )}
                      {measurement.inseam && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Inseam:</span>
                          <span>{measurement.inseam}</span>
                        </div>
                      )}
                      {measurement.neck && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Neck:</span>
                          <span>{measurement.neck}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {measurement.notes && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold">Notes:</p>
                      <p className="text-sm text-muted-foreground">{measurement.notes}</p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          data-testid={`button-delete-${measurement.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this measurement. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(measurement.id)}
                            data-testid="button-confirm-delete"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Ruler className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No measurements yet</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Submit your body measurements to help vendors create perfectly fitted clothing for you.
            </p>
            <Button onClick={() => setShowForm(true)} data-testid="button-add-first">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Measurement
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
