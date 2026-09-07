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
import { X, Package, Truck, CheckCircle, Clock, Bell, Trash2, Pencil, Save, RefreshCw, ImageIcon, Plus, Upload, Link as LinkIcon, AlertCircle, Images, Sparkles } from "lucide-react";
import { AFRICAN_COUNTRIES, getFashionItemsByCountry } from "@shared/africanFashion";
import Navbar from "@/components/navbar";
import type { Vendor, Product, Category } from "@/types";
import type { Notification } from "@shared/schema";
import { trackEvent } from "@/lib/analytics";

type VariantDraft = {
  size: string;
  color: string;
  pattern: string;
  sku: string;
  stock: string;
};

export default function VendorDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasVendorRole = isVendor(user);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customCategoryName, setCustomCategoryName] = useState<string>('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ contactName: '', businessName: '', phone: '', cacNumber: '', description: '' });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', price: '', stock: '', imageUrl: '' });
  const [editCurrentImages, setEditCurrentImages] = useState<string[]>([]);
  const [editRemovedImages, setEditRemovedImages] = useState<string[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<File[]>([]);
  const [editNewPreviews, setEditNewPreviews] = useState<string[]>([]);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [editGender, setEditGender] = useState<string>('');
  const [selectedOriginCountry, setSelectedOriginCountry] = useState<string>('');
  const [selectedTraditionalName, setSelectedTraditionalName] = useState<string>('');
  const [editOriginCountry, setEditOriginCountry] = useState<string>('');
  const [editTraditionalName, setEditTraditionalName] = useState<string>('');
  const [addForm, setAddForm] = useState({
    name: '', shortDescription: '', description: '', tags: '', sku: '', price: '',
    compareAtPrice: '', stock: '', weight: '', dimensions: '', shippingClass: '',
    processingTime: '', careInstructions: '', returnPolicy: '', metaTitle: '', metaDescription: '', imageUrl: '',
    requiresMeasurements: false,
  });
  const [addFiles, setAddFiles] = useState<File[]>([]);
  const [addPreviews, setAddPreviews] = useState<string[]>([]);
  const [addImageMode, setAddImageMode] = useState<'upload' | 'url'>('upload');
  const [selectedSizeSystem, setSelectedSizeSystem] = useState<string>('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [variantRows, setVariantRows] = useState<VariantDraft[]>([]);

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
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: (query) => query.state.data?.status === "pending" ? 10000 : false,
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
    mutationFn: async (vendorData: { contactName: string; businessName: string; phone: string; cacNumber: string; description: string }) => {
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
    onSuccess: (_vendor, variables) => {
      trackEvent("vendor_application_submitted", {
        application_status: "pending",
        has_business_name: Boolean(variables.businessName.trim()),
        has_cac_number: Boolean(variables.cacNumber.trim()),
      });
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

  const submitForReviewMutation = useMutation({
    mutationFn: async (productId: number) => {
      const response = await apiRequest("POST", `/api/products/${productId}/submit`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Product submitted", description: "Your product is now waiting for admin approval." });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/me/products"] });
    },
    onError: () => {
      toast({ title: "Could not submit product", description: "Please review the product details and try again.", variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { contactName: string; businessName: string; phone: string; cacNumber: string; description: string }) => {
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
    setEditGender('');
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

  const aiRetouchMutation = useMutation({
    mutationFn: async ({ file }: { file: File; index: number }) => {
      if (!editingProduct) throw new Error('Open a product before enhancing an image');
      const formData = new FormData();
      formData.append('image', file);
      const response = await apiRequest('POST', `/api/products/${editingProduct.id}/images/ai-retouch`, formData);
      return response.json();
    },
    onSuccess: (data, variables) => {
      setEditNewFiles(current => current.filter((_, index) => index !== variables.index));
      setEditNewPreviews(current => current.filter((_, index) => index !== variables.index));
      setEditCurrentImages((data.product?.images as string[]) || []);
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/me/products"] });
      toast({ title: 'AI retouch complete', description: data.message });
    },
    onError: (error: any) => toast({
      title: 'Could not enhance image',
      description: error?.message || 'The original product was not changed.',
      variant: 'destructive',
    }),
  });

  const resetAddForm = () => {
    setAddForm({
      name: '', shortDescription: '', description: '', tags: '', sku: '', price: '',
      compareAtPrice: '', stock: '', weight: '', dimensions: '', shippingClass: '',
      processingTime: '', careInstructions: '', returnPolicy: '', metaTitle: '', metaDescription: '', imageUrl: '',
      requiresMeasurements: false,
    });
    setAddFiles([]);
    setAddPreviews([]);
    setSelectedCategory('');
    setSelectedGender('');
    setCustomCategoryName('');
    setAddImageMode('upload');
    setSelectedSizeSystem('');
    setSelectedSizes([]);
    setVariantRows([]);
  };

  const handleAddFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const availableSlots = Math.max(0, 5 - addFiles.length);
    const accepted = files.slice(0, availableSlots);
    if (accepted.length < files.length) {
      toast({ title: "Photo limit reached", description: "You can upload up to 5 product photos.", variant: "destructive" });
    }
    setAddFiles(prev => [...prev, ...accepted]);
    accepted.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setAddPreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeAddFile = (i: number) => {
    setAddFiles(prev => prev.filter((_, idx) => idx !== i));
    setAddPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const addProductMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      await apiRequest("POST", "/api/products", formData);
    },
    onSuccess: (_data, formData) => {
      const wasDraft = formData.get('status') === 'draft';
      toast({
        title: wasDraft ? "Draft saved" : "Product submitted!",
        description: wasDraft ? "You can continue editing it from your product list." : "It will appear in the shop once an admin approves it.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/me/products"] });
      resetAddForm();
      setIsAddSheetOpen(false);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/login"; }, 500);
        return;
      }
      const msg = (error?.message || '').replace(/^\d+:\s*/, '');
      let description = msg || "Something went wrong. Please try again.";
      if (msg.includes('403') || msg.includes('vendor')) description = "Your vendor account must be approved before adding products.";
      else if (msg.includes('400') || msg.includes('Missing')) description = "Please fill in all required fields (name, description, price, stock, category).";
      toast({ title: "Could not add product", description, variant: "destructive" });
    },
  });

  const handleVendorRegistration = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    registerVendorMutation.mutate({
      contactName: formData.get("contactName") as string,
      businessName: formData.get("businessName") as string,
      phone: formData.get("phone") as string,
      cacNumber: formData.get("cacNumber") as string,
      description: formData.get("description") as string,
    });
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const submissionStatus = submitter?.value === 'draft' ? 'draft' : 'pending';

    // Resolve category
    let catId = selectedCategory;
    if (catId === 'others') {
      const othersCat = categories.find((c: any) => c.name.toLowerCase() === 'others');
      catId = othersCat ? String(othersCat.id) : '';
    }

    // Client-side validation
    if (!addForm.name.trim()) {
      toast({ title: "Product name required", description: "Please enter a product name.", variant: "destructive" });
      return;
    }
    if (!catId) {
      toast({ title: "Category required", description: "Please choose a product category.", variant: "destructive" });
      return;
    }
    if (!addForm.shortDescription.trim()) {
      toast({ title: "Short description required", description: "Add a concise summary buyers can scan quickly.", variant: "destructive" });
      return;
    }
    if (!addForm.description.trim()) {
      toast({ title: "Full description required", description: "Please describe your product in detail.", variant: "destructive" });
      return;
    }
    if (!addForm.price || parseFloat(addForm.price) <= 0) {
      toast({ title: "Valid price required", description: "Please enter a price greater than 0.", variant: "destructive" });
      return;
    }
    if (!addForm.stock || parseInt(addForm.stock) < 0) {
      toast({ title: "Stock quantity required", description: "Please enter a stock quantity (0 or more).", variant: "destructive" });
      return;
    }
    const isOthersCategory = categories.find((c: any) => c.id === parseInt(catId))?.name?.toLowerCase() === 'others';
    if (isOthersCategory && !customCategoryName.trim()) {
      toast({ title: "Product type required", description: "Please describe what type of product this is.", variant: "destructive" });
      return;
    }
    const tags = addForm.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    if (tags.length > 30) {
      toast({ title: "Too many tags", description: "Use no more than 30 keywords.", variant: "destructive" });
      return;
    }
    const variants = variantRows
      .filter(row => row.size.trim() || row.color.trim() || row.pattern.trim() || row.sku.trim())
      .map(row => ({
        size: row.size.trim() || undefined,
        color: row.color.trim() || undefined,
        pattern: row.pattern.trim() || undefined,
        sku: row.sku.trim() || undefined,
        stock: Number(row.stock) || 0,
      }));

    const fd = new FormData();
    fd.set('name', addForm.name.trim());
    fd.set('shortDescription', addForm.shortDescription.trim());
    fd.set('categoryId', catId);
    fd.set('description', isOthersCategory && customCategoryName.trim()
      ? `[Product type: ${customCategoryName.trim()}]\n\n${addForm.description.trim()}`
      : addForm.description.trim());
    fd.set('price', addForm.price);
    if (addForm.compareAtPrice.trim()) fd.set('compareAtPrice', addForm.compareAtPrice.trim());
    if (addForm.sku.trim()) fd.set('sku', addForm.sku.trim());
    fd.set('stock', addForm.stock);
    if (addForm.weight.trim()) fd.set('weight', addForm.weight.trim());
    if (addForm.dimensions.trim()) fd.set('dimensions', addForm.dimensions.trim());
    if (addForm.shippingClass) fd.set('shippingClass', addForm.shippingClass);
    if (addForm.processingTime.trim()) fd.set('processingTime', addForm.processingTime.trim());
    if (addForm.careInstructions.trim()) fd.set('careInstructions', addForm.careInstructions.trim());
    if (addForm.returnPolicy.trim()) fd.set('returnPolicy', addForm.returnPolicy.trim());
    if (addForm.metaTitle.trim()) fd.set('metaTitle', addForm.metaTitle.trim());
    if (addForm.metaDescription.trim()) fd.set('metaDescription', addForm.metaDescription.trim());
    fd.set('requiresMeasurements', String(addForm.requiresMeasurements));
    fd.set('tags', JSON.stringify(tags));
    fd.set('variants', JSON.stringify(variants));
    fd.set('status', submissionStatus);
    if (selectedGender) fd.set('gender', selectedGender);
    if (selectedOriginCountry) fd.set('originCountry', selectedOriginCountry);
    if (selectedTraditionalName) fd.set('traditionalName', selectedTraditionalName);
    fd.set('sizes', JSON.stringify(selectedSizes));
    if (addImageMode === 'url' && addForm.imageUrl.trim()) {
      fd.set('imageUrl', addForm.imageUrl.trim());
    }
    addFiles.forEach(f => fd.append('images', f));

    addProductMutation.mutate(fd);
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
              {hasVendorRole && !vendor && (
                <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-center">
                  <p className="text-amber-800 font-medium mb-1">Your vendor profile needs to be completed.</p>
                  <p className="text-amber-700 text-sm mb-3">
                    Your account has vendor access, but its vendor application details are missing. Complete this form to restore your vendor profile.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] })}>
                    Refresh status
                  </Button>
                </div>
              )}

              <form onSubmit={handleVendorRegistration} className="space-y-6">
                <div>
                  <Label htmlFor="contactName">Vendor Name</Label>
                  <Input
                    id="contactName"
                    name="contactName"
                    placeholder="Your full name"
                    defaultValue={[user?.firstName, user?.lastName].filter(Boolean).join(' ')}
                    required
                    className="input-nigerian"
                  />
                </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+234 800 000 0000"
                      required
                      className="input-nigerian"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cacNumber">Business registration / CAC number <span className="text-gray-500 font-normal">(Optional)</span></Label>
                    <Input
                      id="cacNumber"
                      name="cacNumber"
                      placeholder="CAC registration number"
                      className="input-nigerian"
                    />
                  </div>
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
                   disabled={registerVendorMutation.isPending || !!vendor}
                >
                  {registerVendorMutation.isPending
                    ? "Submitting…"
                    : vendor
                    ? "Already Registered"
                    : "Register as Vendor"}
                </Button>
                {vendor && (
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
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-nigerian">
              Welcome back, {vendor?.businessName}!
            </h1>
            <p className="text-gray-600">Manage your products and track your sales</p>
          </div>
          <Button
            className="btn-nigerian gap-2 text-base px-5 py-2.5 h-auto shadow-md"
            onClick={() => setIsAddSheetOpen(true)}
          >
            <Plus className="w-5 h-5" />
            Add New Product
          </Button>
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
                      const statusColor = product.status === 'approved'
                        ? 'text-green-700 bg-green-50 border-green-200'
                        : product.status === 'pending'
                        ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                        : product.status === 'draft'
                        ? 'text-gray-700 bg-gray-50 border-gray-200'
                        : 'text-red-700 bg-red-50 border-red-200';
                      const statusLabel = product.status === 'approved' ? 'Live' : product.status === 'pending' ? 'Under Review' : product.status === 'draft' ? 'Draft' : 'Rejected';
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
                            {product.status === 'draft' && (
                              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <Pencil className="w-3 h-3" /> Draft — edit it before submitting for admin review
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
                            {(product.status === 'draft' || product.status === 'rejected') && (
                              <Button
                                size="sm"
                                className="gap-1 text-xs h-8 btn-nigerian"
                                onClick={() => submitForReviewMutation.mutate(product.id)}
                                disabled={submitForReviewMutation.isPending}
                              >
                                <CheckCircle className="w-3 h-3" /> Submit
                              </Button>
                            )}
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
                                setEditGender(product.gender || '');
                                setEditOriginCountry((product as any).originCountry || '');
                                setEditTraditionalName((product as any).traditionalName || '');
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
                              order.orderStatus === 'pending' ? 'badge-approved' :
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
                              <p>Payment Status: <span className={order.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'}>
                                {order.paymentStatus}
                              </span></p>
                            </div>
                            
                            {/* Order Status Management */}
                            {order.paymentStatus === 'paid' && (
                              <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-gray-700 mb-2">Update Order Status:</p>
                                <div className="flex gap-2 flex-wrap">
                                  {order.orderStatus === 'pending' && (
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
                          contactName: vendor?.contactName || '',
                          businessName: vendor?.businessName || '',
                          phone: vendor?.phone || '',
                          cacNumber: vendor?.cacNumber || '',
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="editContactName">Vendor Name</Label>
                        <Input
                          id="editContactName"
                          value={profileForm.contactName}
                          onChange={(e) => setProfileForm(f => ({ ...f, contactName: e.target.value }))}
                          className="input-nigerian"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="editPhone">Phone Number</Label>
                        <Input
                          id="editPhone"
                          type="tel"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                          className="input-nigerian"
                          required
                        />
                      </div>
                    </div>
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
                      <Label htmlFor="editCacNumber">Business registration / CAC number <span className="text-gray-500 font-normal">(Optional)</span></Label>
                      <Input
                        id="editCacNumber"
                        value={profileForm.cacNumber}
                        onChange={(e) => setProfileForm(f => ({ ...f, cacNumber: e.target.value }))}
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
                      <Label>Vendor Name</Label>
                      <Input value={vendor?.contactName || ""} disabled className="input-nigerian" />
                    </div>
                    <div>
                      <Label>Business Name</Label>
                      <Input value={vendor?.businessName || ""} disabled className="input-nigerian" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea value={vendor?.description || ""} disabled className="input-nigerian" rows={4} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Phone Number</Label>
                        <Input value={vendor?.phone || ""} disabled className="input-nigerian" />
                      </div>
                      <div>
                        <Label>CAC Registration Number</Label>
                        <Input value={vendor?.cacNumber || ""} disabled className="input-nigerian" />
                      </div>
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
      <Sheet open={isAddSheetOpen} onOpenChange={(open) => { if (!open) resetAddForm(); setIsAddSheetOpen(open); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle className="text-xl flex items-center gap-2">
              <Plus className="w-5 h-5 text-nigerian-green" /> Add New Product
            </SheetTitle>
            <SheetDescription>
              Fill in the details below. Your product goes live after admin approval — usually within 24 hours.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleAddProduct} className="space-y-5">

            {/* Product Name */}
            <div className="space-y-1.5">
              <Label className="font-semibold">Product Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Premium Ankara Dress"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="input-nigerian"
              />
            </div>

             {/* Short description */}
             <div className="space-y-1.5">
               <Label className="font-semibold">Short Description <span className="text-red-500">*</span></Label>
               <Input
                 placeholder="A quick summary buyers can scan"
                 value={addForm.shortDescription}
                 maxLength={240}
                 onChange={e => setAddForm(f => ({ ...f, shortDescription: e.target.value }))}
                 className="input-nigerian"
               />
             </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="font-semibold">Category <span className="text-red-500">*</span></Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="input-nigerian">
                  <SelectValue placeholder="What type of product is this?" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                  {!categories.some(c => c.name.toLowerCase() === 'others') && (
                    <SelectItem value="others">Others</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {categories.find(c => c.id === parseInt(selectedCategory))?.name?.toLowerCase() === 'others' && (
                <Input
                  placeholder="Describe your product type, e.g. Beaded Crown, Raffia Bag…"
                  value={customCategoryName}
                  onChange={e => setCustomCategoryName(e.target.value)}
                  className="input-nigerian mt-1.5"
                />
              )}
            </div>

            {/* Gender / Audience */}
            <div className="space-y-1.5">
              <Label className="font-semibold">Who is this for?</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: '',       label: 'All / Unisex' },
                  { value: 'women',  label: '👩 Women' },
                  { value: 'men',    label: '👨 Men' },
                  { value: 'kids',   label: '🧒 Kids' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedGender(opt.value)}
                    className={`py-2 px-1 rounded-lg border text-xs font-medium transition-all ${
                      selectedGender === opt.value
                        ? 'bg-nigerian-green text-white border-nigerian-green'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-nigerian-green'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cultural Origin */}
            <div className="space-y-1.5">
              <Label className="font-semibold">Country of Origin <span className="text-gray-400 font-normal">(optional)</span></Label>
              <p className="text-xs text-gray-400">Which African country is this fashion from?</p>
              <select
                value={selectedOriginCountry}
                onChange={e => {
                  setSelectedOriginCountry(e.target.value);
                  setSelectedTraditionalName('');
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-nigerian-green"
              >
                <option value="">🌍 Select a country…</option>
                {AFRICAN_COUNTRIES.map(c => (
                  <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
                ))}
              </select>
              {selectedOriginCountry && getFashionItemsByCountry(selectedOriginCountry).length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Traditional garment name</Label>
                  <select
                    value={selectedTraditionalName}
                    onChange={e => setSelectedTraditionalName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-nigerian-green"
                  >
                    <option value="">Select garment name…</option>
                    {getFashionItemsByCountry(selectedOriginCountry).map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                    <option value="__custom">Other (type below)</option>
                  </select>
                  {selectedTraditionalName === '__custom' && (
                    <input
                      type="text"
                      placeholder="Type the traditional name…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nigerian-green"
                      onChange={e => setSelectedTraditionalName(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Size Options */}
            <div className="space-y-2">
              <Label className="font-semibold">Available Sizes <span className="text-gray-400 font-normal">(optional)</span></Label>
              <p className="text-xs text-gray-400">Pick a sizing system then toggle the sizes your product comes in.</p>
              <select
                value={selectedSizeSystem}
                onChange={e => { setSelectedSizeSystem(e.target.value); setSelectedSizes([]); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-nigerian-green"
              >
                <option value="">— No sizes (one size fits all) —</option>
                <option value="International">International (XS – XXXL)</option>
                <option value="UK Numeric">UK Numeric (6 – 24)</option>
                <option value="US Numeric">US Numeric (0 – 18)</option>
                <option value="EU Numeric">EU Numeric (32 – 52)</option>
                <option value="Kids by Age">Kids by Age</option>
                <option value="Shoes EU">Shoes — EU (35 – 47)</option>
                <option value="Shoes UK">Shoes — UK (2 – 13)</option>
                <option value="One Size">One Size</option>
              </select>
              {selectedSizeSystem && selectedSizeSystem !== '' && (() => {
                const sizeMap: Record<string, string[]> = {
                  'International': ['XS','S','M','L','XL','XXL','XXXL'],
                  'UK Numeric': ['6','8','10','12','14','16','18','20','22','24'],
                  'US Numeric': ['0','2','4','6','8','10','12','14','16','18'],
                  'EU Numeric': ['32','34','36','38','40','42','44','46','48','50','52'],
                  'Kids by Age': ['0-3M','3-6M','6-12M','1Y','2Y','3Y','4Y','5Y','6Y','7Y','8Y','10Y','12Y','14Y'],
                  'Shoes EU': ['35','36','37','38','39','40','41','42','43','44','45','46','47'],
                  'Shoes UK': ['2','3','4','5','6','7','8','9','10','11','12','13'],
                  'One Size': ['One Size'],
                };
                const options = sizeMap[selectedSizeSystem] || [];
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 font-medium">Toggle the sizes you offer:</p>
                      <button
                        type="button"
                        onClick={() => setSelectedSizes(selectedSizes.length === options.length ? [] : options)}
                        className="text-xs text-nigerian-green underline underline-offset-2"
                      >
                        {selectedSizes.length === options.length ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {options.map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSizes(prev =>
                            prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
                          )}
                          className={`min-w-[2.8rem] px-2.5 py-1.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                            selectedSizes.includes(size)
                              ? 'border-nigerian-green bg-nigerian-green text-white'
                              : 'border-gray-200 text-gray-600 hover:border-nigerian-green hover:text-nigerian-green bg-white'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    {selectedSizes.length > 0 && (
                      <p className="text-xs text-green-600 font-medium">
                        ✓ {selectedSizes.length} size{selectedSizes.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
               <Label className="font-semibold">Full Description <span className="text-red-500">*</span></Label>
               <p className="text-xs text-gray-400">Include fabric, origin, fit, care, and the occasion it suits.</p>
              <Textarea
                 placeholder="Describe the fabric, craftsmanship, fit, origin, sizing, occasion, and care instructions…"
                 rows={5}
                value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                className="input-nigerian"
              />
            </div>

             {/* Tags and SKU */}
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-1.5">
                 <Label className="font-semibold">Tags / Keywords</Label>
                 <Input
                   placeholder="wax print, bridal, men's"
                   value={addForm.tags}
                   onChange={e => setAddForm(f => ({ ...f, tags: e.target.value }))}
                   className="input-nigerian"
                 />
                 <p className="text-xs text-gray-400">Separate keywords with commas.</p>
               </div>
               <div className="space-y-1.5">
                 <Label className="font-semibold">SKU / Item Code</Label>
                 <Input
                   placeholder="e.g. ADU-ANK-001"
                   value={addForm.sku}
                   onChange={e => setAddForm(f => ({ ...f, sku: e.target.value }))}
                   className="input-nigerian"
                 />
               </div>
             </div>

             {/* Price, sale price, and stock */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-semibold">Price (₦) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 45000"
                  value={addForm.price}
                  onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}
                  className="input-nigerian"
                />
              </div>
               <div className="space-y-1.5">
                 <Label className="font-semibold">Compare-at Price (₦)</Label>
                 <Input
                   type="number"
                   min="0"
                   placeholder="Optional original price"
                   value={addForm.compareAtPrice}
                   onChange={e => setAddForm(f => ({ ...f, compareAtPrice: e.target.value }))}
                   className="input-nigerian"
                 />
               </div>
             </div>
             <div className="space-y-1.5">
               <Label className="font-semibold">Total Stock Qty <span className="text-red-500">*</span></Label>
               <Input
                 type="number"
                 min="0"
                 placeholder="e.g. 10"
                 value={addForm.stock}
                 onChange={e => setAddForm(f => ({ ...f, stock: e.target.value }))}
                 className="input-nigerian"
               />
             </div>

             {/* Variant combinations */}
             <div className="space-y-2 rounded-xl border border-gray-200 p-3">
               <div className="flex items-start justify-between gap-3">
                 <div>
                   <Label className="font-semibold">Variants</Label>
                   <p className="text-xs text-gray-400 mt-1">Add size, color, or pattern combinations with their own SKU and stock.</p>
                 </div>
                 <Button
                   type="button"
                   variant="outline"
                   size="sm"
                   onClick={() => setVariantRows(rows => [...rows, { size: '', color: '', pattern: '', sku: '', stock: '' }])}
                 >
                   <Plus className="w-3 h-3 mr-1" /> Add variant
                 </Button>
               </div>
               {variantRows.length > 0 && (
                 <div className="space-y-3">
                   {variantRows.map((variant, index) => (
                     <div key={index} className="rounded-lg bg-gray-50 p-2.5 space-y-2">
                       <div className="flex items-center justify-between">
                         <span className="text-xs font-semibold text-gray-600">Variant {index + 1}</span>
                         <button
                           type="button"
                           className="text-xs text-red-500 hover:text-red-700"
                           onClick={() => setVariantRows(rows => rows.filter((_, i) => i !== index))}
                         >
                           Remove
                         </button>
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                         {(['size', 'color', 'pattern', 'sku'] as const).map(field => (
                           <Input
                             key={field}
                             placeholder={field[0].toUpperCase() + field.slice(1)}
                             value={variant[field]}
                             onChange={e => setVariantRows(rows => rows.map((row, i) => i === index ? { ...row, [field]: e.target.value } : row))}
                             className="bg-white text-xs"
                           />
                         ))}
                       </div>
                       <Input
                         type="number"
                         min="0"
                         placeholder="Variant stock"
                         value={variant.stock}
                         onChange={e => setVariantRows(rows => rows.map((row, i) => i === index ? { ...row, stock: e.target.value } : row))}
                         className="bg-white text-xs"
                       />
                     </div>
                   ))}
                 </div>
               )}
             </div>

             {/* Tailoring, shipping, and fulfillment */}
             <div className="space-y-3 rounded-xl border border-gray-200 p-3">
               <Label className="font-semibold">Tailoring & Fulfillment</Label>
               <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                 <input
                   type="checkbox"
                   checked={addForm.requiresMeasurements}
                   onChange={e => setAddForm(f => ({ ...f, requiresMeasurements: e.target.checked }))}
                   className="mt-1 accent-green-700"
                 />
                 <span>
                   <span className="font-medium">Requires customer measurements</span>
                   <span className="block text-xs text-gray-400">Customers will be directed to submit measurements before fulfillment.</span>
                 </span>
               </label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                   <Label className="text-sm">Processing / Lead Time</Label>
                   <Input
                     placeholder="e.g. 7–14 days made to order"
                     value={addForm.processingTime}
                     onChange={e => setAddForm(f => ({ ...f, processingTime: e.target.value }))}
                     className="input-nigerian"
                   />
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-sm">Shipping Class</Label>
                   <select
                     value={addForm.shippingClass}
                     onChange={e => setAddForm(f => ({ ...f, shippingClass: e.target.value }))}
                     className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-nigerian-green"
                   >
                     <option value="">Choose shipping class</option>
                     <option value="standard">Standard</option>
                     <option value="fragile">Fragile / Handle with care</option>
                     <option value="oversized">Oversized</option>
                   </select>
                 </div>
               </div>
               <div className="space-y-1.5">
                 <Label className="text-sm">Weight (kg) and Dimensions</Label>
                 <div className="grid grid-cols-2 gap-3">
                   <Input
                     type="number"
                     min="0"
                     step="0.01"
                     placeholder="Weight in kg"
                     value={addForm.weight}
                     onChange={e => setAddForm(f => ({ ...f, weight: e.target.value }))}
                     className="input-nigerian"
                   />
                   <Input
                     placeholder="L × W × H cm"
                     value={addForm.dimensions}
                     onChange={e => setAddForm(f => ({ ...f, dimensions: e.target.value }))}
                     className="input-nigerian"
                   />
                 </div>
               </div>
               <div className="space-y-1.5">
                 <Label className="text-sm">Care Instructions</Label>
                 <Textarea
                   placeholder="e.g. Hand wash cold. Do not bleach. Hang dry."
                   rows={2}
                   value={addForm.careInstructions}
                   onChange={e => setAddForm(f => ({ ...f, careInstructions: e.target.value }))}
                   className="input-nigerian"
                 />
               </div>
               <div className="space-y-1.5">
                 <Label className="text-sm">Return Policy</Label>
                 <Textarea
                   placeholder="State your return or exchange terms."
                   rows={2}
                   value={addForm.returnPolicy}
                   onChange={e => setAddForm(f => ({ ...f, returnPolicy: e.target.value }))}
                   className="input-nigerian"
                 />
               </div>
             </div>

             {/* SEO */}
             <div className="space-y-3 rounded-xl border border-gray-200 p-3">
               <div>
                 <Label className="font-semibold">Search Preview</Label>
                 <p className="text-xs text-gray-400 mt-1">Optional title and description for search engines and shared links.</p>
               </div>
               <Input
                 placeholder="SEO title (defaults to product name)"
                 maxLength={180}
                 value={addForm.metaTitle}
                 onChange={e => setAddForm(f => ({ ...f, metaTitle: e.target.value }))}
                 className="input-nigerian"
               />
               <Textarea
                 placeholder="SEO description (defaults to short description)"
                 rows={2}
                 value={addForm.metaDescription}
                 onChange={e => setAddForm(f => ({ ...f, metaDescription: e.target.value }))}
                 className="input-nigerian"
               />
             </div>

            {/* Photos */}
            <div className="space-y-2">
              <Label className="font-semibold flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Product Photos <span className="text-gray-400 font-normal text-xs">(optional but recommended)</span>
              </Label>

              {/* Toggle upload / URL */}
              <div className="flex rounded-lg border border-gray-200 p-1 gap-1 bg-gray-50">
                <button type="button"
                  onClick={() => { setAddImageMode('upload'); setAddForm(f => ({ ...f, imageUrl: '' })); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-colors ${addImageMode === 'upload' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Upload className="w-4 h-4" /> Upload Photo
                </button>
                <button type="button"
                  onClick={() => { setAddImageMode('url'); setAddFiles([]); setAddPreviews([]); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-colors ${addImageMode === 'url' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <LinkIcon className="w-4 h-4" /> Paste URL
                </button>
              </div>

              {addImageMode === 'upload' ? (
                <div className="space-y-2">
                  {/* Preview thumbnails */}
                  {addPreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {addPreviews.map((src, i) => (
                        <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-nigerian-green bg-green-50">
                          <img src={src} alt={`Photo ${i+1}`} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeAddFile(i)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                            <X className="w-3 h-3" />
                          </button>
                          <div className="absolute bottom-1 left-1 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">✓</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload zone */}
                  <label
                    htmlFor="add-product-images"
                    className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-nigerian-green hover:bg-green-50 transition-colors"
                  >
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-sm font-medium text-gray-600">
                      {addFiles.length > 0 ? `${addFiles.length} photo${addFiles.length > 1 ? 's' : ''} selected — click to add more` : 'Click here to choose photos'}
                    </span>
                    <span className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP — up to 15 MB each</span>
                  </label>
                  <input
                    id="add-product-images"
                    type="file"
                    multiple
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif"
                    className="hidden"
                    onChange={handleAddFileChange}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    type="url"
                    placeholder="https://example.com/photo.jpg"
                    className="input-nigerian"
                    value={addForm.imageUrl}
                    onChange={e => setAddForm(f => ({ ...f, imageUrl: e.target.value }))}
                  />
                  {addForm.imageUrl && (
                    <div className="w-full h-36 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img src={addForm.imageUrl} alt="Preview" className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Review notice */}
            <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <Clock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
              <span>Products are reviewed by an admin before going live in the shop — usually within 24 hours.</span>
            </div>

            {/* Save or submit */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button type="submit" name="submissionStatus" value="draft" variant="outline" className="h-11" disabled={addProductMutation.isPending}>
                <Save className="w-4 h-4 mr-1" /> Save Draft
              </Button>
              <Button type="submit" name="submissionStatus" value="pending" className="btn-nigerian h-11 text-base" disabled={addProductMutation.isPending}>
                {addProductMutation.isPending
                  ? <><span className="animate-spin mr-2">⏳</span> Submitting…</>
                  : <><Plus className="w-4 h-4 mr-1" /> Submit for Review</>}
              </Button>
            </div>
            <div className="pb-4">
              <Button type="button" variant="ghost" className="w-full"
                onClick={() => { resetAddForm(); setIsAddSheetOpen(false); }}
                disabled={addProductMutation.isPending}>
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

            {/* Gender / Audience */}
            <div>
              <Label className="font-medium">Who is this for?</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {[
                  { value: '',       label: 'All / Unisex' },
                  { value: 'women',  label: '👩 Women' },
                  { value: 'men',    label: '👨 Men' },
                  { value: 'kids',   label: '🧒 Kids' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditGender(opt.value)}
                    className={`py-2 px-1 rounded-lg border text-xs font-medium transition-all ${
                      editGender === opt.value
                        ? 'bg-nigerian-green text-white border-nigerian-green'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-nigerian-green'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cultural Origin */}
            <div>
              <Label className="font-medium">Country of Origin <span className="text-gray-400 font-normal">(optional)</span></Label>
              <p className="text-xs text-gray-400 mb-1">Which African country is this fashion from?</p>
              <select
                value={editOriginCountry}
                onChange={e => {
                  setEditOriginCountry(e.target.value);
                  setEditTraditionalName('');
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-nigerian-green mb-2"
              >
                <option value="">🌍 Select a country…</option>
                {AFRICAN_COUNTRIES.map(c => (
                  <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
                ))}
              </select>
              {editOriginCountry && getFashionItemsByCountry(editOriginCountry).length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Traditional garment name</Label>
                  <select
                    value={editTraditionalName}
                    onChange={e => setEditTraditionalName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-nigerian-green"
                  >
                    <option value="">Select garment name…</option>
                    {getFashionItemsByCountry(editOriginCountry).map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                    <option value="__custom">Other (type below)</option>
                  </select>
                  {editTraditionalName === '__custom' && (
                    <input
                      type="text"
                      placeholder="Type the traditional name…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nigerian-green mt-1"
                      onChange={e => setEditTraditionalName(e.target.value)}
                    />
                  )}
                </div>
              )}
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
                        <button
                          type="button"
                          onClick={() => aiRetouchMutation.mutate({ file: editNewFiles[i], index: i })}
                          disabled={aiRetouchMutation.isPending}
                          className="absolute bottom-1 right-1 rounded-full bg-purple-700 px-2 py-1 text-[10px] font-medium text-white shadow disabled:opacity-50"
                          title="Add both the original and an AI-retouched version"
                        >
                          <Sparkles className="mr-1 inline h-3 w-3" />AI enhance
                        </button>
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
              <p className="text-xs text-gray-500">
                Every upload receives safe automatic lighting, orientation, sharpness, size, and compression improvements. AI enhancement is optional and always keeps an original copy for comparison.
              </p>

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
                      gender: editGender || null,
                      originCountry: editOriginCountry || null,
                      traditionalName: editTraditionalName || null,
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
