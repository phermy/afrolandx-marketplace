import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { isVendor } from "@/lib/roleUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Package, Truck, CheckCircle, Clock, Bell } from "lucide-react";
import Navbar from "@/components/navbar";
import type { Vendor, Product, Category } from "@/types";
import type { Notification } from "@shared/schema";

export default function VendorDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch vendor info
  const { data: vendor, isLoading: vendorLoading } = useQuery<Vendor>({
    queryKey: ["/api/vendors/me"],
    retry: false,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch vendor's products
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", { vendorId: vendor?.id }],
    enabled: !!vendor?.id,
  });

  // Fetch vendor's orders
  const { data: vendorOrders = [] } = useQuery({
    queryKey: ["/api/vendors/orders"],
    enabled: !!vendor?.id && vendor?.status === 'approved',
    retry: false,
  });

  // Fetch vendor's measurements
  const { data: vendorMeasurements = [] } = useQuery<any[]>({
    queryKey: ["/api/vendors/measurements"],
    enabled: !!vendor?.id && vendor?.status === 'approved',
    retry: false,
  });

  // Fetch vendor notifications
  const { data: vendorNotifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: isAuthenticated && isVendor(user),
    retry: false,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Notification dismiss mutation
  const dismissNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return await apiRequest("DELETE", `/api/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  // Order status update mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      return await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/orders"] });
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
    }
  });

  // Measurement status update mutation
  const updateMeasurementStatusMutation = useMutation({
    mutationFn: async ({ measurementId, status }: { measurementId: number; status: string }) => {
      return await apiRequest("PATCH", `/api/vendors/measurements/${measurementId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/measurements"] });
      toast({
        title: "Success",
        description: "Measurement status updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update measurement status",
        variant: "destructive",
      });
    }
  });

  // Vendor registration mutation
  const registerVendorMutation = useMutation({
    mutationFn: async (vendorData: { businessName: string; description: string }) => {
      await apiRequest("POST", "/api/vendors", vendorData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Vendor registration submitted! Please wait for admin approval.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] });
      setIsRegistering(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to register as vendor. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Add product mutation
  const addProductMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      await apiRequest("POST", "/api/products", formData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product submitted for approval!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      // Reset form and category selection
      setSelectedCategory('');
      // Use setTimeout to ensure form reset happens after state update
      setTimeout(() => {
        const productForm = document.querySelector('form[data-form="add-product"]') as HTMLFormElement;
        if (productForm) {
          productForm.reset();
          // Also clear file inputs specifically
          const fileInputs = productForm.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>;
          fileInputs.forEach(input => {
            input.value = '';
          });
        }
      }, 100);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add product. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVendorRegistration = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    registerVendorMutation.mutate({
      businessName: formData.get("businessName") as string,
      description: formData.get("description") as string,
    });
  };

  const handleAddProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Manually add the selected category since Select component doesn't auto-populate FormData
    if (selectedCategory) {
      formData.set('categoryId', selectedCategory);
    }
    
    addProductMutation.mutate(formData);
  };

  if (isLoading || vendorLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner-nigerian"></div>
      </div>
    );
  }

  if (!vendor && !isRegistering) {
    // Show vendor registration form
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">Become a Vendor</CardTitle>
              <p className="text-gray-600 text-center">
                Join our community of African artisans and designers
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVendorRegistration} className="space-y-6">
                <div>
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    name="businessName"
                    placeholder="e.g., Adunni Textiles"
                    required
                    className="input-nigerian"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Business Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Tell us about your business, your products, and your story..."
                    rows={4}
                    required
                    className="input-nigerian"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full btn-nigerian"
                  disabled={registerVendorMutation.isPending}
                >
                  {registerVendorMutation.isPending ? "Submitting..." : "Register as Vendor"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (vendor?.status === "pending") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-6xl mb-4">⏳</div>
              <h2 className="text-2xl font-bold mb-4">Application Under Review</h2>
              <p className="text-gray-600 mb-6">
                Thank you for your vendor application! Our admin team is reviewing your submission. 
                You'll receive an email notification once your application is approved.
              </p>
              <Badge variant="secondary" className="badge-pending">
                Status: Pending Approval
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (vendor?.status === "suspended") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold mb-4">Account Suspended</h2>
              <p className="text-gray-600 mb-6">
                Your vendor account has been suspended. Please contact our support team for more information.
              </p>
              <Badge variant="destructive" className="badge-rejected">
                Status: Suspended
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Approved vendor dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Vendor Notifications */}
        {Array.isArray(vendorNotifications) && vendorNotifications.length > 0 && (
          <div className="mb-6 space-y-3">
            {vendorNotifications.map((notification) => (
              <Card key={notification.id} className="border-nigerian-green bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="w-4 h-4 text-nigerian-green" />
                        <h4 className="font-semibold text-nigerian-green">{notification.title}</h4>
                        {!notification.isRead && (
                          <Badge className="bg-nigerian-green text-white text-xs">New</Badge>
                        )}
                      </div>
                      <p className="text-gray-700 mb-2">{notification.message}</p>
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        {notification.createdAt ? new Date(String(notification.createdAt)).toLocaleString() : 'Unknown time'}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissNotificationMutation.mutate(notification.id)}
                      className="h-8 w-8 p-0 hover:bg-red-100"
                      disabled={dismissNotificationMutation.isPending}
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 font-nigerian">
            Welcome back, {vendor?.businessName}!
          </h1>
          <p className="text-gray-600">Manage your products and track your sales</p>
        </div>

        {/* Notifications */}
        {Array.isArray(vendorNotifications) && vendorNotifications.length > 0 && (
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-nigerian-green">Recent Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vendorNotifications.slice(0, 5).map((notification: any) => (
                    <div key={notification.id} className="flex items-start justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <div className="text-green-600 text-lg">
                          {notification.type === 'order' ? '🎉' : '📢'}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-800">{notification.title}</h4>
                          <p className="text-green-700 text-sm">{notification.message}</p>
                          <p className="text-green-600 text-xs mt-1">
                            {new Date(notification.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissNotificationMutation.mutate(notification.id)}
                        className="h-8 w-8 p-0 hover:bg-green-200"
                        disabled={dismissNotificationMutation.isPending}
                      >
                        <X className="w-4 h-4 text-green-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-nigerian-green rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-gray-600 text-sm">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{products.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-nigerian-gold rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-gray-600 text-sm">Approved</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {products.filter(p => p.status === 'approved').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-gray-600 text-sm">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {products.filter(p => p.status === 'pending').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-coral rounded-lg">
                  <span className="text-white font-bold text-lg">₦</span>
                </div>
                <div className="ml-4">
                  <p className="text-gray-600 text-sm">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₦{products.reduce((sum, p) => sum + parseFloat(p.price), 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="measurements">Measurements</TabsTrigger>
            <TabsTrigger value="add-product">Add Product</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Your Products</CardTitle>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No products yet. Add your first product!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {products.map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{product.name}</h3>
                          <p className="text-gray-600 text-sm">{product.description}</p>
                          <div className="flex items-center space-x-4 mt-2">
                            <span className="text-nigerian-green font-semibold">₦{parseFloat(product.price).toLocaleString()}</span>
                            <span className="text-gray-500 text-sm">Stock: {product.stock}</span>
                            <Badge 
                              className={
                                product.status === 'approved' ? 'badge-approved' :
                                product.status === 'pending' ? 'badge-pending' :
                                'badge-rejected'
                              }
                            >
                              {product.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Your Orders</CardTitle>
                <p className="text-gray-600">Track orders containing your products</p>
              </CardHeader>
              <CardContent>
                {Array.isArray(vendorOrders) && vendorOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No orders yet. Start selling to see orders here!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(vendorOrders) && vendorOrders.map((order: any) => (
                      <div key={order.id} className="border border-gray-200 rounded-lg p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">Order #{order.id}</h3>
                            <p className="text-gray-600 text-sm">
                              Customer: {order.customer?.firstName} {order.customer?.lastName}
                            </p>
                            <p className="text-gray-600 text-sm">
                              Email: {order.customer?.email}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={
                              order.orderStatus === 'confirmed' ? 'badge-approved' :
                              order.orderStatus === 'pending' ? 'badge-pending' :
                              'badge-rejected'
                            }>
                              {order.orderStatus}
                            </Badge>
                            <p className="text-nigerian-green font-bold text-lg mt-2">
                              ₦{order.vendorTotal?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="border-t pt-4">
                          <h4 className="font-medium mb-2">Your Items in this Order:</h4>
                          <div className="space-y-2">
                            {order.items?.map((item: any) => (
                              <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                                <div>
                                  <span className="font-medium">{item.productName}</span>
                                  <span className="text-gray-600 ml-2">x{item.quantity}</span>
                                </div>
                                <span className="font-semibold">
                                  ₦{(parseFloat(item.priceAtTime) * item.quantity).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="border-t pt-4 mt-4">
                          <div className="flex justify-between items-start">
                            <div className="text-sm text-gray-600">
                              <p>Order Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                              <p>Payment Status: <span className={order.paymentStatus === 'completed' ? 'text-green-600' : 'text-yellow-600'}>
                                {order.paymentStatus}
                              </span></p>
                            </div>
                            
                            {/* Order Status Management */}
                            {order.paymentStatus === 'completed' && (
                              <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-gray-700 mb-2">Update Order Status:</p>
                                <div className="flex gap-2 flex-wrap">
                                  {order.orderStatus === 'confirmed' && (
                                    <Button
                                      size="sm"
                                      onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'processing' })}
                                      disabled={updateOrderStatusMutation.isPending}
                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                      <Package className="w-3 h-3 mr-1" />
                                      Mark Processing
                                    </Button>
                                  )}
                                  
                                  {order.orderStatus === 'processing' && (
                                    <Button
                                      size="sm"
                                      onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'shipped' })}
                                      disabled={updateOrderStatusMutation.isPending}
                                      className="bg-purple-600 hover:bg-purple-700 text-white"
                                    >
                                      <Truck className="w-3 h-3 mr-1" />
                                      Mark Shipped
                                    </Button>
                                  )}
                                  
                                  {order.orderStatus === 'shipped' && (
                                    <Button
                                      size="sm"
                                      onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'delivered' })}
                                      disabled={updateOrderStatusMutation.isPending}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Mark Delivered
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="measurements">
            <Card>
              <CardHeader>
                <CardTitle>Customer Measurements</CardTitle>
                <p className="text-gray-600">View and acknowledge measurements submitted by customers</p>
              </CardHeader>
              <CardContent>
                {Array.isArray(vendorMeasurements) && vendorMeasurements.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No measurements submitted yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(vendorMeasurements) && vendorMeasurements.map((measurement: any) => (
                      <div key={measurement.id} className="border border-gray-200 rounded-lg p-6" data-testid={`vendor-measurement-${measurement.id}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">Measurement #{measurement.id}</h3>
                            <p className="text-gray-600 text-sm">
                              Customer: {measurement.customer?.firstName} {measurement.customer?.lastName}
                            </p>
                            <p className="text-gray-600 text-sm">
                              Email: {measurement.customer?.email}
                            </p>
                            <p className="text-gray-600 text-sm">
                              Unit: {measurement.unit}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={
                              measurement.status === 'acknowledged' ? 'bg-green-500' :
                              measurement.status === 'received' ? 'bg-blue-500' :
                              'bg-yellow-500'
                            }>
                              {measurement.status || 'pending'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="border-t pt-4">
                          <h4 className="font-medium mb-3">Body Measurements ({measurement.unit}):</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            {measurement.chest && (
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-gray-600">Chest: </span>
                                <span className="font-semibold">{measurement.chest}</span>
                              </div>
                            )}
                            {measurement.waist && (
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-gray-600">Waist: </span>
                                <span className="font-semibold">{measurement.waist}</span>
                              </div>
                            )}
                            {measurement.hips && (
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-gray-600">Hips: </span>
                                <span className="font-semibold">{measurement.hips}</span>
                              </div>
                            )}
                            {measurement.height && (
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-gray-600">Height: </span>
                                <span className="font-semibold">{measurement.height}</span>
                              </div>
                            )}
                            {measurement.shoulderWidth && (
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-gray-600">Shoulder: </span>
                                <span className="font-semibold">{measurement.shoulderWidth}</span>
                              </div>
                            )}
                            {measurement.sleeveLength && (
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-gray-600">Sleeve: </span>
                                <span className="font-semibold">{measurement.sleeveLength}</span>
                              </div>
                            )}
                            {measurement.inseam && (
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-gray-600">Inseam: </span>
                                <span className="font-semibold">{measurement.inseam}</span>
                              </div>
                            )}
                            {measurement.neck && (
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-gray-600">Neck: </span>
                                <span className="font-semibold">{measurement.neck}</span>
                              </div>
                            )}
                          </div>
                          
                          {measurement.notes && (
                            <div className="mt-4 bg-blue-50 p-3 rounded">
                              <p className="text-sm font-medium text-gray-700">Customer Notes:</p>
                              <p className="text-sm text-gray-600 mt-1">{measurement.notes}</p>
                            </div>
                          )}
                        </div>
                        
                        {measurement.status !== 'acknowledged' && (
                          <div className="border-t pt-4 mt-4">
                            <Button
                              size="sm"
                              onClick={() => updateMeasurementStatusMutation.mutate({ 
                                measurementId: measurement.id, 
                                status: 'acknowledged' 
                              })}
                              disabled={updateMeasurementStatusMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              data-testid={`button-acknowledge-${measurement.id}`}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Acknowledge Measurements
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="add-product">
            <Card>
              <CardHeader>
                <CardTitle>Add New Product</CardTitle>
                <p className="text-gray-600">Add a new product for admin approval</p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddProduct} className="space-y-6" data-form="add-product">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="name">Product Name</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="e.g., Premium Ankara Dress"
                        required
                        className="input-nigerian"
                      />
                    </div>
                    <div>
                      <Label htmlFor="categoryId">Category</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                        <SelectTrigger className="input-nigerian">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Describe your product..."
                      rows={4}
                      required
                      className="input-nigerian"
                    />
                  </div>

                  <div>
                    <Label htmlFor="imageUrl">Product Image URL</Label>
                    <Input
                      id="imageUrl"
                      name="imageUrl"
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      className="input-nigerian"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label htmlFor="price">Price (₦)</Label>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        placeholder="45000"
                        required
                        className="input-nigerian"
                      />
                    </div>
                    <div>
                      <Label htmlFor="stock">Stock Quantity</Label>
                      <Input
                        id="stock"
                        name="stock"
                        type="number"
                        placeholder="10"
                        required
                        className="input-nigerian"
                      />
                    </div>
                    <div>
                      <Label htmlFor="weight">Weight (kg)</Label>
                      <Input
                        id="weight"
                        name="weight"
                        type="number"
                        step="0.1"
                        placeholder="0.5"
                        className="input-nigerian"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="images">Product Images</Label>
                    <Input
                      id="images"
                      name="images"
                      type="file"
                      multiple
                      accept="image/*"
                      className="input-nigerian"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Upload up to 5 images. Supported formats: JPG, PNG, WEBP
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full btn-nigerian"
                    disabled={addProductMutation.isPending}
                  >
                    {addProductMutation.isPending ? "Adding Product..." : "Add Product"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Vendor Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Business Name</Label>
                    <Input value={vendor?.businessName || ""} disabled className="input-nigerian" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={vendor?.description || ""} disabled className="input-nigerian" rows={4} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Badge className={vendor?.status === 'approved' ? 'badge-approved' : 'badge-pending'}>
                      {vendor?.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
