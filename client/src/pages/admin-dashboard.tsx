import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Vendor, ProductWithDetails, AdminStats } from '@/types';

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      toast({
        title: "Admin Access Required",
        description: "You need admin privileges to access this page.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, user, toast]);

  // Fetch admin stats
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    enabled: isAuthenticated && user?.role === 'admin',
    retry: false,
  });

  // Fetch all vendors
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
    enabled: isAuthenticated && user?.role === 'admin',
    retry: false,
  });

  // Fetch products with details for approval
  const { data: allProducts = [] } = useQuery<ProductWithDetails[]>({
    queryKey: ['/api/products/with-details'],
    enabled: isAuthenticated && user?.role === 'admin',
    retry: false,
  });

  // Update vendor status mutation
  const updateVendorStatusMutation = useMutation({
    mutationFn: async ({ vendorId, status }: { vendorId: number; status: string }) => {
      await apiRequest('PATCH', `/api/vendors/${vendorId}/status`, { status });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Vendor status updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Admin session expired. Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to update vendor status.',
        variant: 'destructive',
      });
    },
  });

  // Update product status mutation
  const updateProductStatusMutation = useMutation({
    mutationFn: async ({ productId, status }: { productId: number; status: string }) => {
      await apiRequest('PATCH', `/api/products/${productId}/status`, { status });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Product status updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products/with-details'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Admin session expired. Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to update product status.',
        variant: 'destructive',
      });
    },
  });

  // Initialize categories mutation
  const initCategoriesMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/categories/init');
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Categories initialized successfully.',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Admin session expired. Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to initialize categories.',
        variant: 'destructive',
      });
    },
  });

  const formatPrice = (price: string) => {
    return `₦${parseFloat(price).toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      pending: 'badge-pending',
      approved: 'badge-approved',
      rejected: 'badge-rejected',
      suspended: 'badge-rejected',
    };

    return (
      <Badge className={statusStyles[status as keyof typeof statusStyles] || 'badge-pending'}>
        {status}
      </Badge>
    );
  };

  const pendingProducts = allProducts.filter(p => p.status === 'pending');
  const pendingVendors = vendors.filter(v => v.status === 'pending');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner-nigerian"></div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-red-600 font-nigerian">
                🛡️ Admin Dashboard
              </h1>
              <p className="text-gray-600">Manage vendors, products, and platform oversight</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="destructive" className="text-sm">
                Admin Access
              </Badge>
              <Button
                onClick={() => initCategoriesMutation.mutate()}
                disabled={initCategoriesMutation.isPending}
                variant="outline"
                size="sm"
              >
                {initCategoriesMutation.isPending ? 'Initializing...' : 'Initialize Categories'}
              </Button>
            </div>
          </div>
        </div>

        {/* Admin Warning */}
        <div className="mb-8">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800 font-medium">
                  You are accessing the admin panel. All actions are logged and audited.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-gray-600 text-sm">Total Vendors</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalVendors || vendors.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-gray-600 text-sm">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalProducts || allProducts.length}</p>
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
                  <p className="text-gray-600 text-sm">Pending Approvals</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.pendingApprovals || pendingProducts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-gray-600 text-sm">Vendor Requests</p>
                  <p className="text-2xl font-bold text-gray-900">{pendingVendors.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">Product Approvals</TabsTrigger>
            <TabsTrigger value="vendors">Vendor Management</TabsTrigger>
            <TabsTrigger value="overview">System Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Product Approval Queue</span>
                  <Badge variant="secondary">{pendingProducts.length} pending</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">All caught up!</h3>
                    <p className="text-gray-600">No products pending approval at the moment.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingProducts.map((product) => (
                      <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <div className="w-20 h-20 flex-shrink-0">
                              {product.images && product.images.length > 0 ? (
                                <img
                                  src={product.images[0]}
                                  alt={product.name}
                                  className="w-full h-full object-cover rounded"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-nigerian-green to-nigerian-gold rounded flex items-center justify-center">
                                  <span className="text-white text-xs">No Image</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                              <p className="text-gray-600 text-sm mb-2">{product.description}</p>
                              <div className="flex items-center space-x-4 text-sm">
                                <span className="text-nigerian-green font-semibold">
                                  {formatPrice(product.price)}
                                </span>
                                <span className="text-gray-500">Qty: {product.quantity}</span>
                                <span className="text-gray-500">by {product.vendor.businessName}</span>
                                <span className="text-gray-500">in {product.category.name}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              size="sm"
                              onClick={() => updateProductStatusMutation.mutate({ productId: product.id, status: 'approved' })}
                              disabled={updateProductStatusMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              ✓ Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateProductStatusMutation.mutate({ productId: product.id, status: 'rejected' })}
                              disabled={updateProductStatusMutation.isPending}
                            >
                              ✗ Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors">
            <Card>
              <CardHeader>
                <CardTitle>Vendor Management</CardTitle>
              </CardHeader>
              <CardContent>
                {vendors.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No vendors yet</h3>
                    <p className="text-gray-600">Vendor applications will appear here for review.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vendors.map((vendor) => (
                      <div key={vendor.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <Avatar className="w-12 h-12">
                              <AvatarFallback className="bg-nigerian-green text-white">
                                {vendor.businessName[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 mb-1">{vendor.businessName}</h3>
                              <p className="text-gray-600 text-sm mb-2">{vendor.description}</p>
                              <div className="flex items-center space-x-4 text-sm">
                                <span className="text-gray-500">
                                  Applied: {new Date(vendor.createdAt).toLocaleDateString()}
                                </span>
                                {getStatusBadge(vendor.status)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            {vendor.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => updateVendorStatusMutation.mutate({ vendorId: vendor.id, status: 'approved' })}
                                  disabled={updateVendorStatusMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  ✓ Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateVendorStatusMutation.mutate({ vendorId: vendor.id, status: 'suspended' })}
                                  disabled={updateVendorStatusMutation.isPending}
                                >
                                  ✗ Reject
                                </Button>
                              </>
                            )}
                            {vendor.status === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateVendorStatusMutation.mutate({ vendorId: vendor.id, status: 'suspended' })}
                                disabled={updateVendorStatusMutation.isPending}
                              >
                                Suspend
                              </Button>
                            )}
                            {vendor.status === 'suspended' && (
                              <Button
                                size="sm"
                                onClick={() => updateVendorStatusMutation.mutate({ vendorId: vendor.id, status: 'approved' })}
                                disabled={updateVendorStatusMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                Reactivate
                              </Button>
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

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Active Vendors</span>
                      <span className="font-semibold text-green-600">
                        {vendors.filter(v => v.status === 'approved').length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Approved Products</span>
                      <span className="font-semibold text-green-600">
                        {allProducts.filter(p => p.status === 'approved').length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Pending Reviews</span>
                      <span className="font-semibold text-yellow-600">
                        {pendingProducts.length + pendingVendors.length}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Platform Value</span>
                      <span className="font-semibold text-nigerian-green">
                        {formatPrice(allProducts.filter(p => p.status === 'approved').reduce((sum, p) => sum + parseFloat(p.price), 0).toString())}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      if (pendingProducts.length > 0) {
                        document.querySelector('[value="products"]')?.click();
                      } else {
                        toast({
                          title: 'No pending products',
                          description: 'All products have been reviewed.',
                        });
                      }
                    }}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                    Review Pending Products ({pendingProducts.length})
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      if (pendingVendors.length > 0) {
                        document.querySelector('[value="vendors"]')?.click();
                      } else {
                        toast({
                          title: 'No pending vendors',
                          description: 'All vendor applications have been reviewed.',
                        });
                      }
                    }}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                    </svg>
                    Review Vendor Applications ({pendingVendors.length})
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => initCategoriesMutation.mutate()}
                    disabled={initCategoriesMutation.isPending}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {initCategoriesMutation.isPending ? 'Initializing...' : 'Initialize Categories'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
