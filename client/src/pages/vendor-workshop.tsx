import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Scissors, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Loader2,
  Plus,
  Ruler,
  Eye
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const productionStages = [
  "fabric_cutting",
  "sewing",
  "embroidery",
  "finishing",
  "quality_check",
  "packaging",
  "ready_for_shipping",
];

const stageLabels: Record<string, string> = {
  fabric_cutting: "Fabric Cutting",
  sewing: "Sewing",
  embroidery: "Embroidery/Beading",
  finishing: "Finishing Touches",
  quality_check: "Quality Check",
  packaging: "Packaging",
  ready_for_shipping: "Ready for Shipping",
};

export default function VendorWorkshopPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [newStage, setNewStage] = useState("");
  const [stageNotes, setStageNotes] = useState("");

  const [newResource, setNewResource] = useState({
    materialType: "",
    materialName: "",
    quantity: "",
    unit: "meters",
    lowStockThreshold: "5",
  });

  const { data: workshopData, isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["/api/vendor/workshop/orders"],
    enabled: !!user,
  });

  const { data: resourceData } = useQuery<{
    resources: any[];
    lowStockAlerts: any[];
  }>({
    queryKey: ["/api/vendor/resources"],
    enabled: !!user,
  });

  const { data: measurementAlerts = [] } = useQuery<any[]>({
    queryKey: ["/api/vendor/measurement-alerts"],
    enabled: !!user,
  });

  const addStageMutation = useMutation({
    mutationFn: async ({ orderId, stage, notes }: { orderId: number; stage: string; notes?: string }) => {
      const response = await apiRequest("POST", `/api/vendor/workshop/orders/${orderId}/steps`, {
        stage,
        notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/workshop/orders"] });
      toast({
        title: "Production Step Added",
        description: "The production step has been recorded.",
      });
      setNewStage("");
      setStageNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add production step.",
        variant: "destructive",
      });
    },
  });

  const completeStepMutation = useMutation({
    mutationFn: async ({ stepId, notes }: { stepId: number; notes?: string }) => {
      const response = await apiRequest("PATCH", `/api/vendor/workshop/steps/${stepId}/complete`, { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/workshop/orders"] });
      toast({
        title: "Step Completed",
        description: "The production step has been marked as complete.",
      });
    },
  });

  const addResourceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/vendor/resources", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/resources"] });
      toast({
        title: "Resource Added",
        description: "The material has been added to your inventory.",
      });
      setNewResource({
        materialType: "",
        materialName: "",
        quantity: "",
        unit: "meters",
        lowStockThreshold: "5",
      });
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: number) => {
      const response = await apiRequest("POST", `/api/vendor/measurement-alerts/${alertId}/acknowledge`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/measurement-alerts"] });
      toast({
        title: "Alert Acknowledged",
        description: "The measurement alert has been acknowledged.",
      });
    },
  });

  if (!user) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Vendor Access Required</h1>
        <p className="text-muted-foreground">Sign in as a vendor to access the workshop dashboard.</p>
      </div>
    );
  }

  const orders = workshopData || [];
  const resources = resourceData?.resources || [];
  const lowStockAlerts = resourceData?.lowStockAlerts || [];

  const getOrderProgress = (order: any) => {
    const steps = order.productionSteps || [];
    const completedSteps = steps.filter((s: any) => s.completedAt).length;
    return steps.length > 0 ? (completedSteps / productionStages.length) * 100 : 0;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Scissors className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Vendor Workshop Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Orders</CardDescription>
              <CardTitle className="text-2xl">{orders.filter((o: any) => o.status !== "completed").length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Production</CardDescription>
              <CardTitle className="text-2xl">{orders.filter((o: any) => o.productionSteps?.length > 0 && o.status !== "completed").length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={lowStockAlerts.length > 0 ? "border-orange-500" : ""}>
            <CardHeader className="pb-2">
              <CardDescription>Low Stock Alerts</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                {lowStockAlerts.length}
                {lowStockAlerts.length > 0 && <AlertTriangle className="h-5 w-5 text-orange-500" />}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={measurementAlerts.length > 0 ? "border-yellow-500" : ""}>
            <CardHeader className="pb-2">
              <CardDescription>Measurement Alerts</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                {measurementAlerts.filter((a: any) => a.status !== "acknowledged").length}
                {measurementAlerts.filter((a: any) => a.status !== "acknowledged").length > 0 && <Ruler className="h-5 w-5 text-yellow-500" />}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="orders" data-testid="tab-orders">
              <Package className="h-4 w-4 mr-2" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="inventory" data-testid="tab-inventory">
              <Scissors className="h-4 w-4 mr-2" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts
              {measurementAlerts.filter((a: any) => a.status !== "acknowledged").length > 0 && (
                <Badge variant="destructive" className="ml-2">{measurementAlerts.filter((a: any) => a.status !== "acknowledged").length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            {ordersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No orders to process yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {orders.map((order: any) => (
                  <Card key={order.id} data-testid={`order-card-${order.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">Order #{order.id}</CardTitle>
                          <CardDescription>
                            {new Date(order.createdAt).toLocaleDateString()} - 
                            ₦{parseFloat(order.totalAmount).toLocaleString()}
                          </CardDescription>
                        </div>
                        <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                          {order.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Production Progress</span>
                          <span>{Math.round(getOrderProgress(order))}%</span>
                        </div>
                        <Progress value={getOrderProgress(order)} />
                      </div>

                      {order.items && order.items.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-medium mb-2">Order Items</h4>
                          <div className="grid gap-2">
                            {order.items.map((item: any) => (
                              <div key={item.id} className="flex items-center gap-3 p-2 bg-muted rounded">
                                {item.product?.imageUrl && (
                                  <img src={item.product.imageUrl} alt="" className="w-12 h-12 rounded object-cover" />
                                )}
                                <div className="flex-1">
                                  <p className="font-medium">{item.product?.name}</p>
                                  <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <h4 className="font-medium">Production Timeline</h4>
                        <div className="space-y-2">
                          {productionStages.map((stage) => {
                            const step = order.productionSteps?.find((s: any) => s.stage === stage);
                            const isComplete = step?.completedAt;
                            const isStarted = !!step;

                            return (
                              <div key={stage} className="flex items-center gap-3 text-sm">
                                {isComplete ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : isStarted ? (
                                  <Clock className="h-4 w-4 text-yellow-500" />
                                ) : (
                                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                                )}
                                <span className={isComplete ? "text-green-600" : isStarted ? "text-yellow-600" : "text-muted-foreground"}>
                                  {stageLabels[stage]}
                                </span>
                                {isComplete && (
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {new Date(step.completedAt).toLocaleDateString()}
                                  </span>
                                )}
                                {isStarted && !isComplete && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="ml-auto"
                                    onClick={() => completeStepMutation.mutate({ stepId: step.id })}
                                    disabled={completeStepMutation.isPending}
                                    data-testid={`button-complete-step-${step.id}`}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Complete
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <div className="flex gap-2">
                          <Select value={newStage} onValueChange={setNewStage}>
                            <SelectTrigger className="w-[200px]" data-testid={`select-stage-${order.id}`}>
                              <SelectValue placeholder="Add stage..." />
                            </SelectTrigger>
                            <SelectContent>
                              {productionStages
                                .filter(s => !order.productionSteps?.some((ps: any) => ps.stage === s))
                                .map(stage => (
                                  <SelectItem key={stage} value={stage}>
                                    {stageLabels[stage]}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => addStageMutation.mutate({ orderId: order.id, stage: newStage })}
                            disabled={!newStage || addStageMutation.isPending}
                            data-testid={`button-add-stage-${order.id}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Start Stage
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="inventory">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Add Material
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Material Type</Label>
                      <Select 
                        value={newResource.materialType} 
                        onValueChange={(v) => setNewResource({...newResource, materialType: v})}
                      >
                        <SelectTrigger data-testid="select-material-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fabric">Fabric</SelectItem>
                          <SelectItem value="thread">Thread</SelectItem>
                          <SelectItem value="beads">Beads/Accessories</SelectItem>
                          <SelectItem value="buttons">Buttons</SelectItem>
                          <SelectItem value="zippers">Zippers</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Material Name</Label>
                      <Input
                        placeholder="e.g., Ankara Blue Print"
                        value={newResource.materialName}
                        onChange={(e) => setNewResource({...newResource, materialName: e.target.value})}
                        data-testid="input-material-name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={newResource.quantity}
                        onChange={(e) => setNewResource({...newResource, quantity: e.target.value})}
                        data-testid="input-quantity"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Select 
                        value={newResource.unit} 
                        onValueChange={(v) => setNewResource({...newResource, unit: v})}
                      >
                        <SelectTrigger data-testid="select-unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meters">Meters</SelectItem>
                          <SelectItem value="yards">Yards</SelectItem>
                          <SelectItem value="pieces">Pieces</SelectItem>
                          <SelectItem value="spools">Spools</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Low Stock Alert</Label>
                      <Input
                        type="number"
                        value={newResource.lowStockThreshold}
                        onChange={(e) => setNewResource({...newResource, lowStockThreshold: e.target.value})}
                        data-testid="input-low-stock"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => addResourceMutation.mutate({
                      ...newResource,
                      quantity: parseFloat(newResource.quantity),
                      lowStockThreshold: parseFloat(newResource.lowStockThreshold),
                    })}
                    disabled={!newResource.materialType || !newResource.materialName || !newResource.quantity || addResourceMutation.isPending}
                    className="w-full"
                    data-testid="button-add-material"
                  >
                    {addResourceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Add to Inventory
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Current Inventory</CardTitle>
                  <CardDescription>{resources.length} materials tracked</CardDescription>
                </CardHeader>
                <CardContent>
                  {resources.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No materials added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {resources.map((resource: any) => (
                        <div 
                          key={resource.id} 
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            lowStockAlerts.some((a: any) => a.id === resource.id) 
                              ? "bg-orange-50 border border-orange-200" 
                              : "bg-muted"
                          }`}
                          data-testid={`resource-item-${resource.id}`}
                        >
                          <div>
                            <p className="font-medium">{resource.materialName}</p>
                            <p className="text-sm text-muted-foreground capitalize">{resource.materialType}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {resource.quantity} {resource.unit}
                            </p>
                            {lowStockAlerts.some((a: any) => a.id === resource.id) && (
                              <Badge variant="outline" className="text-orange-600 border-orange-400">
                                Low Stock
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ruler className="h-5 w-5" />
                  Measurement Change Alerts
                </CardTitle>
                <CardDescription>
                  Get notified when customer measurements change significantly between orders
                </CardDescription>
              </CardHeader>
              <CardContent>
                {measurementAlerts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No measurement alerts. You'll see notifications here when customers update their measurements.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {measurementAlerts.map((alert: any) => (
                      <div 
                        key={alert.id} 
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          alert.status === "acknowledged" ? "bg-muted" : "bg-yellow-50 border border-yellow-200"
                        }`}
                        data-testid={`alert-item-${alert.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                            alert.status === "acknowledged" ? "text-muted-foreground" : "text-yellow-500"
                          }`} />
                          <div>
                            <p className="font-medium capitalize">
                              {alert.alertType.replace(/_/g, " ")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(alert.createdAt).toLocaleDateString()}
                            </p>
                            {alert.deltaSummary && (
                              <div className="mt-2 text-sm">
                                <p>Changes detected:</p>
                                <ul className="list-disc list-inside text-muted-foreground">
                                  {Object.entries(alert.deltaSummary as Record<string, number>).map(([key, value]) => (
                                    <li key={key}>{key}: {value > 0 ? "+" : ""}{value} cm</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {alert.status === "acknowledged" ? (
                            <Badge variant="secondary">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Acknowledged
                            </Badge>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-view-measurement-${alert.id}`}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                                disabled={acknowledgeAlertMutation.isPending}
                                data-testid={`button-acknowledge-${alert.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Acknowledge
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
