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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { X, Package, Truck, CheckCircle, Clock, Bell, Trash2, Pencil, Save, RefreshCw, ImageIcon, Plus, Upload, Link as LinkIcon, AlertCircle, Images } from "lucide-react";
import Navbar from "@/components/navbar";
import type { Vendor, Product, Category } from "@/types";
import type { Notification } from "@shared/schema";

export default function VendorDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customCategoryName, setCustomCategoryName] = useState<string>('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ businessName: '', description: '' });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', price: '', stock: '', imageUrl: '' });
  const [editCurrentImages, setEditCurrentImages] = useState<string[]>([]);
  const [editRemovedImages, setEditRemovedImages] = useState<string[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);
  const [editNewPreviews, setEditNewPreviews] = useState<string[]>([]);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [addPreviewUrl, setAddPreviewUrl] = useState('');
  const [addImageMode, setAddImageMode] = useState<'upload' | 'url'>('upload');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
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

  // Fetch vendor's own products (all statuses)
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/vendors/me/products"],
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
      const res = await apiRequest("POST", "/api/vendors", vendorData);
      if (!res.ok) {
        const body = await res.json();
        if (res.status === 409) {
          throw Object.assign(new Error(body.message), { alreadyRegistered: true, vendor: body.vendor });
        }
        throw new Error(body.message || "Failed to register as vendor");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Application submitted!",
        description: "Your vendor application is under review. We'll notify you once approved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] });
      setIsRegistering(false);
    },
    onError: (error: any) => {
      if (error.alreadyRegistered) {
        // Refetch vendor data — they're already in the system
        queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] });
        toast({
          title: "Already registered",
          description: "You already have a vendor account. Redirecting to your dashboard.",
        });
        return;
      }
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/login"; }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to register as vendor. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Add product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      await apiRequest("DELETE", `/api/products/${productId}`);
    },
    onSuccess: () => {
      toast({ title: "Product deleted", description: "The product has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/me/products"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        setTimeout(() => { window.location.href = "/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete product.", variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { businessName: string; description: string }) => {
      const res = await apiRequest("PATCH", "/api/vendors/me", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your vendor profile has been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] });
      setIsEditingProfile(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/products/${id}`, data);
      return res.json();
    },
    onSuccess: async (updatedProduct) => {
      // If there are new image files to upload, do that next
      if (editNewFiles.length > 0) {
        const formData = new FormData();
        editNewFiles.forEach(f => formData.append('images', f));
        await apiRequest("POST", `/api/products/${updatedProduct.id}/images`, formData);
      }
      toast({ title: "Product updated", description: "Changes saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/me/products"] });
      closeEditDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update product.", variant: "destructive" });
    },
  });

  const closeEditDialog = () => {
    setEditingProduct(null);
    setEditCurrentImages([]);
    setEditRemovedImages([]);
    setEditNewFiles([]);
    setEditNewPreviews([]);
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setEditNewFiles(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEditNewPreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeEditNewFile = (index: number) => {
    setEditNewFiles(prev => prev.filter((_, i) => i !== index));
    setEditNewPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeEditCurrentImage = (url: string) => {
    setEditCurrentImages(prev => prev.filter(u => u !== url));
    setEditRemovedImages(prev => [...prev, url]);
  };

  const addProductMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      await apiRequest("POST", "/api/products", formData);
    },
    onSuccess: () => {
      toast({
        title: "Product submitted!",
        description: "It will appear in your list once an admin approves it.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/me/products"] });
      setSelectedCategory('');
      setCustomCategoryName('');
      setAddPreviewUrl('');
      setAddImageMode('upload');
      setIsAddSheetOpen(false);
      setTimeout(() => {
        const productForm = document.querySelector('form[data-form="add-product"]') as HTMLFormElement;
        if (productForm) {
          productForm.reset();
          const fileInputs = productForm.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>;
          fileInputs.forEach(input => { input.value = ''; });
        }
      }, 100);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/login"; }, 500);
        return;
      }
      // Parse the real server error message
      const msg = error?.message || '';
      let description = "Something went wrong. Please try again.";
      if (msg.includes('403') || msg.includes('Approved vendor')) {
        description = "Your vendor account needs to be approved by an admin before you can add products.";
      } else if (msg.includes('400') || msg.includes('Missing required')) {
        description = "Please fill in all required fields: name, description, price, stock, and category.";
      } else if (msg.includes('Validation')) {
        description = "Some fields have invalid values. Check price and stock are valid numbers.";
      } else if (msg.length > 0) {
        description = msg.replace(/^\d+:\s*/, '');
      }
      toast({ title: "Could not add product", description, variant: "destructive" });
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

    // Resolve category
    let catId = selectedCategory;
    if (catId === 'others') {
      const othersCat = categories.find((c: any) => c.name.toLowerCase() === 'others');
      catId = othersCat ? String(othersCat.id) : '';
    }

    // Client-side validation
    if (!catId) {
      toast({ title: "Select a category", description: "Please choose a product category before submitting.", variant: "destructive" });
      return;
    }
    const isOthersCategory = categories.find((c: any) => c.id === parseInt(catId))?.name?.toLowerCase() === 'others';
    if (isOthersCategory && !customCategoryName.trim()) {
      toast({ title: "Describe your product type", description: "Please describe what type of product this is.", variant: "destructive" });
      return;
    }

    formData.set('categoryId', catId);

    // Prepend custom type to description for "Others" category
    if (isOthersCategory && customCategoryName.trim()) {
      const existingDesc = (formData.get('description') as string) || '';
      formData.set('description', `[Product type: ${customCategoryName.trim()}]\n\n${existingDesc}`);
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
              {/* Already-registered notice */}
              {isVendor(user) && (
                <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-center">
                  <p className="text-amber-800 font-medium mb-1">You already have a vendor account.</p>
                  <p className="text-amber-700 text-sm mb-3">
                    Your account may still be under review. You can add products once you're approved.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] })}>
                    Refresh status
                  </Button>
                </div>
              )}

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
                  disabled={registerVendorMutation.isPending || isVendor(user)}
                >
                  {registerVendorMutation.isPending
                    ? "Submitting…"
                    : isVendor(user)
                    ? "Already Registered"
                    : "Register as Vendor"}
                </Button>
                {isVendor(user) && (
                  <p className="text-center text-sm text-gray-500">
                    You're already a vendor — registration is not needed again.
                  </p>
                )}
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
              <Badge variant="secondary" className="badge-pending mb-6 block w-fit mx-auto">
                Status: Pending Approval
              </Badge>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] })}
              >
                <RefreshCw className="w-4 h-4" />
                Check Approval Status
              </Button>
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
            <TabsTrigger value="products">My Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="measurements">Measurements</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Products</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {products.length === 0 ? 'No products yet' : `${products.length} product${products.length !== 1 ? 's' : ''} — ${products.filter(p => p.status === 'approved').length} live in shop`}
                    </p>
                  </div>
                  <Button className="btn-nigerian gap-2" onClick={() => setIsAddSheetOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-16 space-y-4">
                    <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-gray-700 font-semibold text-lg">You haven't added any products yet</p>
                      <p className="text-gray-400 text-sm mt-1">Products are reviewed by admin before going live in the shop.</p>
                    </div>
                    <Button className="btn-nigerian gap-2 mt-2" onClick={() => setIsAddSheetOpen(true)}>
                      <Plus className="w-4 h-4" />
                      Add Your First Product
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {products.map((product) => {
                      const imgSrc = product.imageUrl || (Array.isArray((product as any).images) && (product as any).images[0]) || null;
                      const statusColor = product.status === 'approved' ? 'text-green-700 bg-green-50 border-green-200' : product.status === 'pending' ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-red-700 bg-red-50 border-red-200';
                      const statusLabel = product.status === 'approved' ? 'Live' : product.status === 'pending' ? 'Under Review' : 'Rejected';
                      return (
                        <div key={product.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:shadow-sm transition-all bg-white">
                          {/* Thumbnail */}
                          <div className="w-20 h-20 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                            {imgSrc ? (
                              <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-1">
                                <ImageIcon className="w-6 h-6" />
                                <span className="text-xs">No image</span>
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-gray-900 leading-tight">{product.name}</h3>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${statusColor}`}>{statusLabel}</span>
                            </div>
                            <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{product.description}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-nigerian-green font-bold">₦{parseFloat(product.price).toLocaleString()}</span>
                              <span className="text-gray-500 text-sm">{product.stock} in stock</span>
                            </div>
                            {product.status === 'pending' && (
                              <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Waiting for admin approval — usually within 24 hrs
                              </p>
                            )}
                            {product.status === 'rejected' && (
                              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Rejected — edit and resubmit
                              </p>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex flex-col gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs h-8"
                              title="Edit product"
                              onClick={() => {
                                setEditingProduct(product);
                                setEditForm({
                                  name: product.name,
                                  description: product.description || '',
                                  price: product.price,
                                  stock: String(product.stock),
                                  imageUrl: product.imageUrl || '',
                                });
                                const imgs: string[] = [];
                                if (product.imageUrl) imgs.push(product.imageUrl);
                                const extra = Array.isArray((product as any).images) ? (product as any).images as string[] : [];
                                extra.forEach((u: string) => { if (u && !imgs.includes(u)) imgs.push(u); });
                                setEditCurrentImages(imgs);
                                setEditRemovedImages([]);
                                setEditNewFiles([]);
                                setEditNewPreviews([]);
                              }}
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Delete product"
                              onClick={() => {
                                if (confirm(`Delete "${product.name}"? This cannot be undone.`)) {
                                  deleteProductMutation.mutate(product.id);
                                }
                              }}
                              disabled={deleteProductMutation.isPending}
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </Button>
                          </div>
                        </div>
                      );
                    })}
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


          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Vendor Profile</CardTitle>
                  {!isEditingProfile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setProfileForm({
                          businessName: vendor?.businessName || '',
                          description: vendor?.description || '',
                        });
                        setIsEditingProfile(true);
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditingProfile ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="editBusinessName">Business Name</Label>
                      <Input
                        id="editBusinessName"
                        value={profileForm.businessName}
                        onChange={(e) => setProfileForm(f => ({ ...f, businessName: e.target.value }))}
                        className="input-nigerian"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="editDescription">Description</Label>
                      <Textarea
                        id="editDescription"
                        value={profileForm.description}
                        onChange={(e) => setProfileForm(f => ({ ...f, description: e.target.value }))}
                        className="input-nigerian"
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => updateProfileMutation.mutate(profileForm)}
                        disabled={updateProfileMutation.isPending || !profileForm.businessName.trim()}
                        className="btn-nigerian"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {updateProfileMutation.isPending ? "Saving…" : "Save Changes"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingProfile(false)}
                        disabled={updateProfileMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
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
                      <div className="mt-1">
                        <Badge className={vendor?.status === 'approved' ? 'badge-approved' : 'badge-pending'}>
                          {vendor?.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Product Sheet */}
      <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl">Add New Product</SheetTitle>
            <SheetDescription>
              Fill in the details below. Your product will be reviewed by our team before going live — usually within 24 hours.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleAddProduct} className="space-y-5" data-form="add-product">
            {/* Product Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="font-medium">Product Name <span className="text-red-500">*</span></Label>
              <Input id="name" name="name" placeholder="e.g., Premium Ankara Dress" required className="input-nigerian" />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="categoryId" className="font-medium">Category <span className="text-red-500">*</span></Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                <SelectTrigger className="input-nigerian">
                  <SelectValue placeholder="What type of product is this?" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>{category.name}</SelectItem>
                  ))}
                  {!categories.some((c) => c.name.toLowerCase() === 'others') && (
                    <SelectItem value="others">Others</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {(() => {
                const selectedCat = categories.find((c: any) => c.id === parseInt(selectedCategory) || (selectedCategory === 'others' && c.name.toLowerCase() === 'others'));
                return selectedCat?.name?.toLowerCase() === 'others';
              })() && (
                <div className="mt-2">
                  <Input
                    id="customCategoryName"
                    placeholder="Describe your product type, e.g. Beaded Crown, Raffia Bag…"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    className="input-nigerian"
                    required
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="font-medium">Description <span className="text-red-500">*</span></Label>
              <Textarea id="description" name="description" placeholder="Tell buyers what makes this product special — fabric, craftsmanship, size, occasion…" rows={4} required className="input-nigerian" />
            </div>

            {/* Price & Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="price" className="font-medium">Price (₦) <span className="text-red-500">*</span></Label>
                <Input id="price" name="price" type="number" min="0" placeholder="e.g. 45000" required className="input-nigerian" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock" className="font-medium">Stock Qty <span className="text-red-500">*</span></Label>
                <Input id="stock" name="stock" type="number" min="0" placeholder="e.g. 10" required className="input-nigerian" />
              </div>
            </div>

            {/* Weight */}
            <div className="space-y-1.5">
              <Label htmlFor="weight" className="font-medium">Weight (kg) <span className="text-gray-400 font-normal">— optional, helps with shipping</span></Label>
              <Input id="weight" name="weight" type="number" step="0.1" min="0" placeholder="e.g. 0.5" className="input-nigerian" />
            </div>

            {/* Image section */}
            <div className="space-y-2">
              <Label className="font-medium">Product Image</Label>
              {/* Toggle */}
              <div className="flex rounded-lg border border-gray-200 p-1 gap-1 bg-gray-50">
                <button
                  type="button"
                  onClick={() => { setAddImageMode('upload'); setAddPreviewUrl(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-colors ${addImageMode === 'upload' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Upload className="w-4 h-4" /> Upload file
                </button>
                <button
                  type="button"
                  onClick={() => setAddImageMode('url')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-colors ${addImageMode === 'url' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <LinkIcon className="w-4 h-4" /> Paste URL
                </button>
              </div>

              {addImageMode === 'upload' ? (
                <div>
                  <label htmlFor="images" className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-nigerian-green hover:bg-green-50 transition-colors">
                    <ImageIcon className="w-7 h-7 text-gray-400 mb-1" />
                    <span className="text-sm text-gray-500">Click to upload photos</span>
                    <span className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP — up to 15 MB each</span>
                  </label>
                  <Input id="images" name="images" type="file" multiple accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif" className="hidden" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    name="imageUrl"
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    className="input-nigerian"
                    value={addPreviewUrl}
                    onChange={(e) => setAddPreviewUrl(e.target.value)}
                  />
                  {addPreviewUrl && (
                    <div className="w-full h-36 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img
                        src={addPreviewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notice */}
            <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <Clock className="w-4 h-4 mt-0.5 shrink-0 text-yellow-600" />
              <span>Products are reviewed by an admin before appearing in the shop. This usually takes less than 24 hours.</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="btn-nigerian flex-1" disabled={addProductMutation.isPending}>
                {addProductMutation.isPending ? "Submitting…" : "Submit Product"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAddSheetOpen(false)} disabled={addProductMutation.isPending}>
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Edit Product
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">

            {/* Name */}
            <div>
              <Label htmlFor="edit-name" className="font-medium">Product Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="input-nigerian mt-1"
                required
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="edit-description" className="font-medium">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                className="input-nigerian mt-1"
                rows={3}
              />
            </div>

            {/* Price + Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-price" className="font-medium">Price (₦)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  value={editForm.price}
                  onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                  className="input-nigerian mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-stock" className="font-medium">Stock Quantity</Label>
                <Input
                  id="edit-stock"
                  type="number"
                  value={editForm.stock}
                  onChange={e => setEditForm(f => ({ ...f, stock: e.target.value }))}
                  className="input-nigerian mt-1"
                />
              </div>
            </div>

            {/* Photos section */}
            <div className="space-y-3">
              <Label className="font-medium flex items-center gap-2">
                <Images className="w-4 h-4" /> Product Photos
              </Label>

              {/* Existing images grid */}
              {editCurrentImages.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Current photos — click × to remove</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {editCurrentImages.map((url, i) => (
                      <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = ''; }} />
                        <button
                          type="button"
                          onClick={() => removeEditCurrentImage(url)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                          title="Remove photo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New files to upload preview */}
              {editNewPreviews.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">New photos to add (not saved yet)</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {editNewPreviews.map((src, i) => (
                      <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-dashed border-nigerian-green bg-green-50">
                        <img src={src} alt={`New ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeEditNewFile(i)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">New</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload area */}
              <label
                htmlFor="edit-images-upload"
                className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-nigerian-green hover:bg-green-50 transition-colors"
              >
                <Upload className="w-5 h-5 text-gray-400 mb-1" />
                <span className="text-sm text-gray-500 font-medium">Click to add more photos</span>
                <span className="text-xs text-gray-400">JPG, PNG, WEBP — up to 15 MB each</span>
              </label>
              <input
                id="edit-images-upload"
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleEditFileChange}
              />

              {editRemovedImages.length > 0 && (
                <p className="text-xs text-orange-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {editRemovedImages.length} photo{editRemovedImages.length > 1 ? 's' : ''} will be removed when you save
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                className="btn-nigerian flex-1"
                disabled={!editForm.name.trim() || updateProductMutation.isPending}
                onClick={() => {
                  if (!editingProduct) return;
                  updateProductMutation.mutate({
                    id: editingProduct.id,
                    data: {
                      name: editForm.name,
                      description: editForm.description,
                      price: editForm.price,
                      stock: parseInt(editForm.stock) || 0,
                      imageUrl: editForm.imageUrl || '',
                      removeImages: editRemovedImages,
                    },
                  });
                }}
              >
                <Save className="w-4 h-4 mr-1" />
                {updateProductMutation.isPending ? "Saving…" : `Save Changes${editNewFiles.length > 0 ? ` + Upload ${editNewFiles.length} photo${editNewFiles.length > 1 ? 's' : ''}` : ''}`}
              </Button>
              <Button variant="outline" onClick={closeEditDialog} disabled={updateProductMutation.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
