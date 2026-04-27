import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import { useToast } from '@/hooks/use-toast';
import { isAdmin, hasRole } from '@/lib/roleUtils';
import Navbar from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  X, Eye, ChevronDown, ChevronUp, CheckCircle, XCircle, ShieldCheck, Package,
  Mail, Calendar, User as UserIcon, TrendingUp, TrendingDown, AlertTriangle,
  Star, BarChart3, RefreshCw, Download, Search, Filter, Truck, ArrowUpRight,
  Globe, DollarSign, ShoppingBag, Users, Award, Zap,
} from 'lucide-react';
import type { Vendor, ProductWithDetails, AdminStats, User } from '@/types';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const MAX_FEATURED = 8;
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};
const PIE_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444'];

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [reviewVendor, setReviewVendor] = useState<any | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [analyticsRefresh, setAnalyticsRefresh] = useState(0);
  const [activityLog, setActivityLog] = useState<Array<{ id: number; orderId: number; status: string; amount: string; time: Date }>>([]);
  const prevOrderStatusRef = useRef<Record<number, string>>({});

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin(user))) {
      toast({ title: 'Admin Access Required', description: 'You need admin privileges.', variant: 'destructive' });
      setTimeout(() => { window.location.href = '/login'; }, 500);
    }
  }, [isAuthenticated, isLoading, user, toast]);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: stats } = useQuery<AdminStats>({ queryKey: ['/api/admin/stats'], enabled: isAuthenticated && isAdmin(user), retry: false });
  const { data: vendors = [] } = useQuery<Vendor[]>({ queryKey: ['/api/vendors'], enabled: isAuthenticated && isAdmin(user), retry: false });
  const { data: allProducts = [] } = useQuery<ProductWithDetails[]>({ queryKey: ['/api/products/with-details'], enabled: isAuthenticated && isAdmin(user), retry: false });
  const { data: adminOrders = [], isFetching: ordersFetching, dataUpdatedAt: ordersUpdatedAt } = useQuery({
    queryKey: ['/api/admin/orders'], enabled: isAuthenticated && isAdmin(user), retry: false, refetchInterval: 30000, staleTime: 0,
  });
  const { data: allUsers = [] } = useQuery<User[]>({ queryKey: ['/api/admin/users'], enabled: isAuthenticated && isAdmin(user), retry: false });
  const { data: adminNotifications = [] } = useQuery({ queryKey: ['/api/notifications'], enabled: isAuthenticated && isAdmin(user), retry: false, refetchInterval: 15000 });
  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ['/api/admin/analytics', analyticsRefresh],
    enabled: isAuthenticated && isAdmin(user),
    retry: false,
    refetchInterval: 60000,
  });

  // ── Real-time order change detection ────────────────────────────────────
  useEffect(() => {
    const orders = Array.isArray(adminOrders) ? adminOrders as any[] : [];
    if (!orders.length) return;
    const prev = prevOrderStatusRef.current;
    const newActivity: typeof activityLog = [];
    for (const o of orders) {
      const oldStatus = prev[o.id];
      if (oldStatus && oldStatus !== o.orderStatus) {
        if (['delivered', 'cancelled'].includes(o.orderStatus)) {
          newActivity.push({ id: Date.now() + o.id, orderId: o.id, status: o.orderStatus, amount: o.totalAmount, time: new Date() });
          toast({
            title: o.orderStatus === 'delivered' ? `✅ Order #${o.id} Delivered` : `❌ Order #${o.id} Cancelled`,
            description: `$${parseFloat(o.totalAmount || 0).toFixed(2)} order has been ${o.orderStatus}.`,
          });
        }
      }
    }
    if (newActivity.length) {
      setActivityLog(prev => [...newActivity, ...prev].slice(0, 20));
    }
    const next: Record<number, string> = {};
    for (const o of orders) next[o.id] = o.orderStatus;
    prevOrderStatusRef.current = next;
  }, [adminOrders, toast]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const dismissNotificationMutation = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  const updateVendorStatusMutation = useMutation({
    mutationFn: async ({ vendorId, status }: { vendorId: number; status: string }) => {
      await apiRequest('PATCH', `/api/vendors/${vendorId}/status`, { status });
    },
    onSuccess: () => {
      toast({ title: 'Done', description: 'Vendor status updated.' });
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) { window.location.href = '/login'; return; }
      toast({ title: 'Error', description: 'Failed to update vendor.', variant: 'destructive' });
    },
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ productId, featured }: { productId: number; featured: boolean }) => {
      await apiRequest('PATCH', `/api/products/${productId}/featured`, { featured });
    },
    onSuccess: () => {
      toast({ title: 'Featured updated', description: 'Homepage will reflect the change.' });
      queryClient.invalidateQueries({ queryKey: ['/api/products/with-details'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
  });

  const updateProductStatusMutation = useMutation({
    mutationFn: async ({ productId, status }: { productId: number; status: string }) => {
      await apiRequest('PATCH', `/api/products/${productId}/status`, { status });
    },
    onSuccess: () => {
      toast({ title: 'Product status updated.' });
      queryClient.invalidateQueries({ queryKey: ['/api/products/with-details'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      await apiRequest('PATCH', `/api/admin/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      toast({ title: 'Order updated', description: 'Fulfillment status saved.' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics'] });
    },
  });

  const initCategoriesMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest('POST', '/api/categories/init'); return res.json(); },
    onSuccess: (data: any) => { queryClient.invalidateQueries({ queryKey: ['/api/categories'] }); toast({ title: data?.message ?? 'Categories initialised.' }); },
  });

  const toggleUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role, hasRole: has }: { userId: string; role: string; hasRole: boolean }) => {
      if (has) await apiRequest('DELETE', `/api/admin/users/${userId}/roles/${role}`);
      else await apiRequest('POST', `/api/admin/users/${userId}/roles/${role}`);
    },
    onSuccess: () => { toast({ title: 'Role updated.' }); queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] }); },
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const pendingProducts = allProducts.filter(p => p.status === 'pending');
  const approvedProducts = allProducts.filter(p => p.status === 'approved');
  const featuredProducts = approvedProducts.filter(p => p.featured);
  const pendingVendors = (vendors as any[]).filter(v => v.status === 'pending');

  const filteredOrders = useMemo(() => {
    let list = Array.isArray(adminOrders) ? adminOrders as any[] : [];
    if (orderStatusFilter !== 'all') list = list.filter((o: any) => o.orderStatus === orderStatusFilter);
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      list = list.filter((o: any) =>
        String(o.id).includes(q) ||
        o.customer?.email?.toLowerCase().includes(q) ||
        `${o.customer?.firstName} ${o.customer?.lastName}`.toLowerCase().includes(q)
      );
    }
    return list;
  }, [adminOrders, orderStatusFilter, orderSearch]);

  const orderRevenueSummary = useMemo(() => {
    const orders = Array.isArray(adminOrders) ? adminOrders as any[] : [];
    const total = orders.reduce((s: number, o: any) => s + parseFloat(o.totalAmount || '0'), 0);
    const paid = orders.filter((o: any) => o.paymentStatus === 'paid' || o.paymentStatus === 'completed');
    return { total, paid: paid.length, pending: orders.filter((o: any) => o.orderStatus === 'pending').length };
  }, [adminOrders]);

  // Recommended products to feature (not featured, approved, best stock/rating)
  const recommendedToFeature = useMemo(() => {
    return approvedProducts
      .filter(p => !p.featured)
      .sort((a, b) => {
        const scoreA = parseFloat(a.price) * 0.3 + (a.stock || 0) * 0.7;
        const scoreB = parseFloat(b.price) * 0.3 + (b.stock || 0) * 0.7;
        return scoreB - scoreA;
      })
      .slice(0, 6);
  }, [approvedProducts]);

  const lowStockProducts = useMemo(() =>
    approvedProducts.filter(p => p.stock <= 5).slice(0, 10), [approvedProducts]);

  const formatPrice = (p: string | number) => `$${parseFloat(String(p)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtCurrency = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected', suspended: 'badge-rejected',
    };
    return <Badge className={styles[status] || 'badge-pending'}>{status}</Badge>;
  };

  const exportOrdersCSV = () => {
    const orders = Array.isArray(adminOrders) ? adminOrders as any[] : [];
    const rows = [
      ['Order ID', 'Customer', 'Email', 'Total', 'Payment', 'Status', 'Date'],
      ...orders.map((o: any) => [
        o.id, `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim(),
        o.customer?.email || '', `$${parseFloat(o.totalAmount || 0).toFixed(2)}`,
        o.paymentStatus, o.orderStatus, new Date(o.createdAt).toLocaleDateString('en-GB'),
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'afrolandx-orders.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="spinner-nigerian"></div></div>;
  if (!isAuthenticated || !isAdmin(user)) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-red-600 font-nigerian">🛡️ Admin Dashboard</h1>
            <p className="text-gray-600 text-sm">AfrolandX Platform Control Centre</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="destructive">Admin Access</Badge>
            {lowStockProducts.length > 0 && (
              <Badge variant="outline" className="border-orange-400 text-orange-600 gap-1">
                <AlertTriangle className="w-3 h-3" />{lowStockProducts.length} Low Stock
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => initCategoriesMutation.mutate()} disabled={initCategoriesMutation.isPending}>
              {initCategoriesMutation.isPending ? 'Initialising…' : 'Init Categories'}
            </Button>
          </div>
        </div>

        {/* Admin warning */}
        <Card className="border-red-200 bg-red-50 mb-6">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="text-red-800 text-sm font-medium">All admin actions are logged and audited for compliance.</span>
          </CardContent>
        </Card>

        {/* Notifications */}
        {Array.isArray(adminNotifications) && adminNotifications.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-2"><CardTitle className="text-base text-red-600">Notifications</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(adminNotifications as any[]).slice(0, 4).map((n: any) => (
                  <div key={n.id} className="flex items-start justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{n.type === 'order' ? '📦' : '📢'}</span>
                      <div>
                        <p className="font-semibold text-red-800 text-sm">{n.title}</p>
                        <p className="text-red-700 text-xs">{n.message}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => dismissNotificationMutation.mutate(n.id)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Revenue', value: analytics ? fmtCurrency(analytics.totalRevenue) : '—', icon: DollarSign, color: 'bg-green-500', sub: analytics ? `${analytics.paidOrders} paid orders` : '' },
            { label: 'Total Orders', value: Array.isArray(adminOrders) ? String((adminOrders as any[]).length) : '0', icon: ShoppingBag, color: 'bg-blue-500', sub: `${orderRevenueSummary.pending} pending` },
            { label: 'Active Vendors', value: String((vendors as any[]).filter((v: any) => v.status === 'approved').length), icon: Users, color: 'bg-purple-500', sub: `${pendingVendors.length} pending approval` },
            { label: 'Fulfilment Rate', value: analytics ? `${analytics.fulfillmentRate}%` : '—', icon: TrendingUp, color: 'bg-orange-500', sub: `${analytics?.totalApprovedProducts || approvedProducts.length} live products` },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">{label}</p>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
                  </div>
                  <div className={`p-2 ${color} rounded-lg`}><Icon className="w-5 h-5 text-white" /></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="analytics" className="gap-1"><BarChart3 className="w-3 h-3" />Analytics</TabsTrigger>
            <TabsTrigger value="products">Product Approvals {pendingProducts.length > 0 && <Badge className="ml-1 h-4 px-1 text-xs">{pendingProducts.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="featured">Featured Products</TabsTrigger>
            <TabsTrigger value="vendors">Vendors {pendingVendors.length > 0 && <Badge className="ml-1 h-4 px-1 text-xs">{pendingVendors.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="overview">System Overview</TabsTrigger>
          </TabsList>

          {/* ═══ ANALYTICS TAB ═══════════════════════════════════════════════ */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Real-Time Platform Analytics</h2>
                <Button variant="outline" size="sm" onClick={() => setAnalyticsRefresh(r => r + 1)} disabled={analyticsLoading}>
                  <RefreshCw className={`w-3 h-3 mr-1 ${analyticsLoading ? 'animate-spin' : ''}`} />Refresh
                </Button>
              </div>

              {analyticsLoading ? (
                <div className="flex justify-center py-16"><div className="spinner-nigerian"></div></div>
              ) : analytics ? (
                <>
                  {/* Revenue Trend */}
                  <Card>
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" />Revenue Trend — Last 30 Days</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={analytics.revenueTrend}>
                          <defs>
                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                          <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']} labelFormatter={l => `Date: ${l}`} />
                          <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#revGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Orders by Status */}
                    <Card>
                      <CardHeader><CardTitle className="text-base">Orders by Status</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={analytics.ordersByStatus.filter((d: any) => d.count > 0)} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} label={({ status, count }) => `${status} (${count})`} labelLine={false}>
                              {analytics.ordersByStatus.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {analytics.ordersByStatus.map((d: any, i: number) => (
                            <div key={d.status} className="flex items-center gap-1 text-xs">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="capitalize">{d.status}: {d.count}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Geographic Distribution */}
                    <Card>
                      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" />Orders by Country</CardTitle></CardHeader>
                      <CardContent>
                        {analytics.geoDistribution.length > 0 ? (
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={analytics.geoDistribution} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis type="number" tick={{ fontSize: 10 }} />
                              <YAxis dataKey="country" type="category" tick={{ fontSize: 10 }} width={90} />
                              <Tooltip />
                              <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-gray-400 text-sm text-center py-8">No geographic data yet. Orders will populate this chart.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Vendor Performance */}
                    <Card>
                      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="w-4 h-4 text-yellow-500" />Vendor Rankings by Inventory Value</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analytics.vendorPerformance.slice(0, 6).map((v: any, i: number) => (
                            <div key={v.id}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                                  <span className="text-sm font-medium truncate max-w-[140px]">{v.businessName}</span>
                                  {i === 0 && <span className="text-xs">🏆</span>}
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-semibold text-green-700">{fmtCurrency(v.totalInventoryValue)}</span>
                                  <span className="text-xs text-gray-400 ml-2">{v.productCount} products</span>
                                </div>
                              </div>
                              <Progress value={Math.min((v.totalInventoryValue / (analytics.vendorPerformance[0]?.totalInventoryValue || 1)) * 100, 100)} className="h-1.5" />
                            </div>
                          ))}
                          {analytics.vendorPerformance.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No approved vendors yet.</p>}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Customer Metrics */}
                    <Card>
                      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" />Customer Insights</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { label: 'Total Customers', value: analytics.totalCustomers, icon: '👤' },
                            { label: 'New This Month', value: analytics.newCustomersThisMonth, icon: '✨' },
                            { label: 'Avg Order Value', value: fmtCurrency(analytics.avgOrderValue), icon: '💰' },
                            { label: 'Inventory Value', value: fmtCurrency(analytics.totalInventoryValue), icon: '📦' },
                          ].map(({ label, value, icon }) => (
                            <div key={label} className="bg-gray-50 rounded-lg p-3">
                              <p className="text-lg mb-0.5">{icon}</p>
                              <p className="text-xl font-bold text-gray-900">{value}</p>
                              <p className="text-xs text-gray-500">{label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Low stock alert */}
                        {analytics.lowStockProducts.length > 0 && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <p className="text-sm font-semibold text-orange-700 flex items-center gap-1 mb-2">
                              <AlertTriangle className="w-3.5 h-3.5" />Low Stock Alerts ({analytics.lowStockProducts.length})
                            </p>
                            <div className="space-y-1">
                              {analytics.lowStockProducts.slice(0, 4).map((p: any) => (
                                <div key={p.id} className="flex justify-between text-xs">
                                  <span className="truncate max-w-[160px] text-orange-800">{p.name}</span>
                                  <span className={`font-bold ${p.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>{p.stock === 0 ? 'OUT' : `${p.stock} left`}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card><CardContent className="py-12 text-center text-gray-400">Analytics data unavailable. Try refreshing.</CardContent></Card>
              )}
            </div>
          </TabsContent>

          {/* ═══ PRODUCT APPROVALS TAB ══════════════════════════════════════ */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Product Approval Queue</span>
                  <Badge variant="secondary">{pendingProducts.length} pending</Badge>
                </CardTitle>
                <CardDescription>Review each product against quality standards before approving for the storefront.</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-3" />
                    <h3 className="font-semibold text-gray-700">All caught up!</h3>
                    <p className="text-gray-500 text-sm">No products awaiting approval.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingProducts.map((product) => (
                      <div key={product.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="w-20 h-20 flex-shrink-0">
                                {product.images?.[0] ? (
                                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover rounded" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-nigerian-green to-nigerian-gold rounded flex items-center justify-center">
                                    <Package className="w-6 h-6 text-white" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <h3 className="font-semibold mb-1">{product.name}</h3>
                                <p className="text-gray-500 text-sm line-clamp-2 mb-2">{product.description}</p>
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <span className="text-green-700 font-semibold">{formatPrice(product.price)}</span>
                                  <span className="text-gray-500">Stock: {product.stock}</span>
                                  <span className="text-gray-500">by <strong>{product.vendor.businessName}</strong></span>
                                  <Badge variant="outline" className="text-xs">{product.category.name}</Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button size="sm" variant="outline" onClick={() => setExpandedProductId(expandedProductId === product.id ? null : product.id)}>
                                <Eye className="w-3 h-3 mr-1" />{expandedProductId === product.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </Button>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={updateProductStatusMutation.isPending} onClick={() => updateProductStatusMutation.mutate({ productId: product.id, status: 'approved' })}>
                                <CheckCircle className="w-3 h-3 mr-1" />Approve
                              </Button>
                              <Button size="sm" variant="destructive" disabled={updateProductStatusMutation.isPending} onClick={() => updateProductStatusMutation.mutate({ productId: product.id, status: 'rejected' })}>
                                <XCircle className="w-3 h-3 mr-1" />Reject
                              </Button>
                            </div>
                          </div>
                        </div>

                        {expandedProductId === product.id && (
                          <div className="border-t bg-gray-50 p-4 space-y-4">
                            {product.images && product.images.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-2">All Images ({product.images.length})</p>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                  {product.images.map((img, i) => (
                                    <img key={i} src={img} alt={`img ${i+1}`} className="w-28 h-28 object-cover rounded-lg flex-shrink-0 border" onError={(e) => { e.currentTarget.style.display='none'; }} />
                                  ))}
                                </div>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">Full Description</p>
                              <p className="text-sm text-gray-700 leading-relaxed">{product.description}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Quality Standards</p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {[
                                  { label: 'Has product images', pass: product.images && product.images.length > 0 },
                                  { label: 'Description (20+ chars)', pass: product.description?.length > 20 },
                                  { label: 'Price set (> $0)', pass: parseFloat(product.price) > 0 },
                                  { label: 'In stock (> 0)', pass: product.stock > 0 },
                                  { label: 'Category assigned', pass: !!product.category?.name },
                                  { label: 'Vendor approved', pass: product.vendor?.status === 'approved' },
                                ].map(({ label, pass }) => (
                                  <div key={label} className={`flex items-center gap-1.5 p-2 rounded text-xs ${pass ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {pass ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}{label}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2 border-t">
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={updateProductStatusMutation.isPending}
                                onClick={() => { updateProductStatusMutation.mutate({ productId: product.id, status: 'approved' }); setExpandedProductId(null); }}>
                                <CheckCircle className="w-3 h-3 mr-1" />Approve Product
                              </Button>
                              <Button size="sm" variant="destructive" disabled={updateProductStatusMutation.isPending}
                                onClick={() => { updateProductStatusMutation.mutate({ productId: product.id, status: 'rejected' }); setExpandedProductId(null); }}>
                                <XCircle className="w-3 h-3 mr-1" />Reject Product
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ ORDER MANAGEMENT TAB ═══════════════════════════════════════ */}
          <TabsContent value="orders">
            <div className="space-y-4">
              {/* Real-time header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${ordersFetching ? 'bg-green-400 animate-pulse' : 'bg-green-500'}`} />
                    <span className="text-xs text-gray-500">
                      Live tracking · auto-refreshes every 30s
                      {ordersUpdatedAt ? ` · last: ${new Date(ordersUpdatedAt).toLocaleTimeString()}` : ''}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/orders'] })} disabled={ordersFetching} className="gap-1">
                  <RefreshCw className={`w-3 h-3 ${ordersFetching ? 'animate-spin' : ''}`} />Refresh Now
                </Button>
              </div>

              {/* Activity feed — delivered/cancelled */}
              {activityLog.length > 0 && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-800 flex items-center gap-2">
                      <Zap className="w-4 h-4" />Live Activity Feed
                      <Badge className="ml-1 bg-green-600 text-white text-xs">{activityLog.length} events</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {activityLog.slice(0, 8).map(ev => (
                        <div key={ev.id} className="flex items-center justify-between text-xs bg-white border rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            {ev.status === 'delivered'
                              ? <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                              : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                            <span className="font-semibold capitalize">Order #{ev.orderId} {ev.status}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-400">
                            <span className="font-semibold text-gray-700">${parseFloat(ev.amount || '0').toFixed(2)}</span>
                            <span>{ev.time.toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Summary row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Revenue', value: fmtCurrency(orderRevenueSummary.total), color: 'text-green-700', icon: DollarSign },
                  { label: 'Paid Orders', value: String(orderRevenueSummary.paid), color: 'text-blue-700', icon: CheckCircle },
                  { label: 'Pending', value: String(orderRevenueSummary.pending), color: 'text-orange-700', icon: AlertTriangle },
                  { label: 'Total Orders', value: String(Array.isArray(adminOrders) ? (adminOrders as any[]).length : 0), color: 'text-gray-700', icon: ShoppingBag },
                ].map(({ label, value, color, icon: Icon }) => (
                  <Card key={label}><CardContent className="p-4 flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${color}`} />
                    <div>
                      <p className={`text-xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  </CardContent></Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <CardTitle>All Orders</CardTitle>
                    <Button variant="outline" size="sm" onClick={exportOrdersCSV} className="gap-1">
                      <Download className="w-3 h-3" />Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    <div className="relative flex-1 min-w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input placeholder="Search by order ID or customer…" className="pl-9 h-8 text-sm" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => {
                        const count = s === 'all'
                          ? (Array.isArray(adminOrders) ? (adminOrders as any[]).length : 0)
                          : (Array.isArray(adminOrders) ? (adminOrders as any[]).filter((o: any) => o.orderStatus === s).length : 0);
                        return (
                          <Button key={s} size="sm" variant={orderStatusFilter === s ? 'default' : 'outline'} className="capitalize h-8 px-2 text-xs gap-1" onClick={() => setOrderStatusFilter(s)}>
                            {s}
                            {count > 0 && <span className={`px-1 rounded-full text-xs ${orderStatusFilter === s ? 'bg-white text-gray-800' : 'bg-gray-100'}`}>{count}</span>}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No orders match your filters.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredOrders.map((order: any) => (
                        <div key={order.id} className={`border rounded-lg p-4 transition-all ${order.orderStatus === 'delivered' ? 'border-green-200 bg-green-50/30' : order.orderStatus === 'cancelled' ? 'border-red-200 bg-red-50/30' : ''}`}>
                          <div className="flex items-start justify-between flex-wrap gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-semibold">Order #{order.id}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[order.orderStatus] || 'bg-gray-100 text-gray-700'}`}>{order.orderStatus}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${order.paymentStatus === 'paid' || order.paymentStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{order.paymentStatus}</span>
                              </div>
                              <p className="text-sm text-gray-600">
                                {order.customer?.firstName} {order.customer?.lastName} · <span className="text-gray-400">{order.customer?.email}</span>
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {order.shippingMethod && ` · ${order.shippingMethod.toUpperCase()}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-green-700 text-lg">${parseFloat(order.totalAmount || 0).toFixed(2)}</span>
                              <Select
                                value={order.orderStatus}
                                onValueChange={(status) => updateOrderStatusMutation.mutate({ orderId: order.id, status })}
                                disabled={order.orderStatus === 'delivered' || order.orderStatus === 'cancelled'}
                              >
                                <SelectTrigger className="w-38 h-8 text-xs">
                                  <Truck className="w-3 h-3 mr-1" /><SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => (
                                    <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {order.items && order.items.length > 0 && (
                            <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                              {order.items.map((item: any) => (
                                <div key={item.id} className="bg-gray-50 rounded px-2 py-1 text-xs flex items-center gap-1.5">
                                  {item.productImage && (
                                    <img src={item.productImage} alt={item.productName} className="w-5 h-5 object-cover rounded" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                  )}
                                  <span className="font-medium">{item.productName}</span>
                                  <span className="text-gray-500">×{item.quantity}</span>
                                  <span className="text-gray-400">· {item.vendorName}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══ FEATURED PRODUCTS TAB ══════════════════════════════════════ */}
          <TabsContent value="featured">
            <div className="space-y-6">
              {/* Slot usage indicator */}
              <Card className={featuredProducts.length >= MAX_FEATURED ? 'border-orange-300 bg-orange-50' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      Featured Slots Used
                    </span>
                    <span className={`text-sm font-bold ${featuredProducts.length >= MAX_FEATURED ? 'text-orange-600' : 'text-green-600'}`}>
                      {featuredProducts.length} / {MAX_FEATURED}
                    </span>
                  </div>
                  <Progress value={(featuredProducts.length / MAX_FEATURED) * 100} className="h-2" />
                  {featuredProducts.length >= MAX_FEATURED && (
                    <p className="text-orange-600 text-xs mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />Maximum slots reached. Remove a product before featuring another.
                    </p>
                  )}
                  {featuredProducts.length === 0 && (
                    <p className="text-gray-400 text-xs mt-2">Feature approved products to showcase them on the homepage.</p>
                  )}
                </CardContent>
              </Card>

              {/* Currently Featured */}
              {featuredProducts.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Currently Featured ({featuredProducts.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {featuredProducts.map(p => (
                        <div key={p.id} className="border rounded-lg p-3 bg-yellow-50 border-yellow-200">
                          <div className="flex gap-3">
                            <div className="w-14 h-14 shrink-0">
                              {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover rounded" onError={(e) => { e.currentTarget.style.display='none'; }} />
                                : <div className="w-full h-full bg-gradient-to-br from-nigerian-green to-nigerian-gold rounded" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{p.name}</p>
                              <p className="text-xs text-gray-500 truncate">by {p.vendor.businessName}</p>
                              <p className="text-xs font-semibold text-green-700">{formatPrice(p.price)}</p>
                              {p.stock <= 5 && <Badge variant="outline" className="text-xs border-orange-400 text-orange-600 mt-1">Low Stock: {p.stock}</Badge>}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="w-full mt-2 text-xs h-7" onClick={() => toggleFeaturedMutation.mutate({ productId: p.id, featured: false })} disabled={toggleFeaturedMutation.isPending}>
                            Remove from Featured
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI-Recommended to Feature */}
              {recommendedToFeature.length > 0 && featuredProducts.length < MAX_FEATURED && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-500" />Recommended to Feature
                    </CardTitle>
                    <CardDescription>Top non-featured products ranked by inventory value and availability.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {recommendedToFeature.map((p, i) => (
                        <div key={p.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                          <span className="text-xs text-gray-400 font-bold w-4">#{i + 1}</span>
                          <div className="w-12 h-12 shrink-0">
                            {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover rounded" onError={(e) => { e.currentTarget.style.display='none'; }} />
                              : <div className="w-full h-full bg-muted rounded" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{p.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{formatPrice(p.price)}</span>
                              <span>·</span>
                              <span>{p.stock} in stock</span>
                              <span>·</span>
                              <span>{p.vendor.businessName}</span>
                            </div>
                          </div>
                          <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white shrink-0"
                            onClick={() => toggleFeaturedMutation.mutate({ productId: p.id, featured: true })}
                            disabled={toggleFeaturedMutation.isPending || featuredProducts.length >= MAX_FEATURED}>
                            <Star className="w-3 h-3 mr-1" />Feature
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Low Stock Warning for Featured */}
              {featuredProducts.some(p => p.stock <= 5) && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader><CardTitle className="text-base text-orange-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Featured Products — Low Stock Warning</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {featuredProducts.filter(p => p.stock <= 5).map(p => (
                        <div key={p.id} className="flex justify-between items-center text-sm">
                          <span className="text-orange-800">{p.name}</span>
                          <span className={`font-bold ${p.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                            {p.stock === 0 ? 'OUT OF STOCK' : `${p.stock} remaining`}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-orange-600 text-xs mt-3">Consider replacing these with products that have adequate stock.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ═══ VENDOR MANAGEMENT TAB ══════════════════════════════════════ */}
          <TabsContent value="vendors">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Vendor Management
                  <Badge variant="secondary">{(vendors as any[]).length} total</Badge>
                </CardTitle>
                <CardDescription>Review applications and manage active vendor accounts.</CardDescription>
              </CardHeader>
              <CardContent>
                {(vendors as any[]).length === 0 ? (
                  <div className="text-center py-12 text-gray-400">No vendor applications yet.</div>
                ) : (
                  <div className="space-y-4">
                    {(vendors as any[]).map((vendor: any) => (
                      <div key={vendor.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={vendor.user?.profileImageUrl} />
                              <AvatarFallback className="bg-nigerian-green text-white">{vendor.businessName[0].toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-semibold mb-0.5">{vendor.businessName}</h3>
                              {vendor.user && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                                  <UserIcon className="w-3 h-3" />
                                  {vendor.user.firstName} {vendor.user.lastName} — {vendor.user.email}
                                  {vendor.user.emailVerified && <ShieldCheck className="w-3 h-3 text-green-500" />}
                                </p>
                              )}
                              <p className="text-gray-500 text-sm line-clamp-2 mb-2">{vendor.description || 'No description provided.'}</p>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-gray-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(vendor.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                {getStatusBadge(vendor.status)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            <Button size="sm" variant="outline" onClick={() => setReviewVendor(vendor)}>
                              <Eye className="w-3 h-3 mr-1" />Review
                            </Button>
                            {vendor.status === 'pending' && (
                              <>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={updateVendorStatusMutation.isPending} onClick={() => updateVendorStatusMutation.mutate({ vendorId: vendor.id, status: 'approved' })}>
                                  <CheckCircle className="w-3 h-3 mr-1" />Approve
                                </Button>
                                <Button size="sm" variant="destructive" disabled={updateVendorStatusMutation.isPending} onClick={() => updateVendorStatusMutation.mutate({ vendorId: vendor.id, status: 'suspended' })}>
                                  <XCircle className="w-3 h-3 mr-1" />Reject
                                </Button>
                              </>
                            )}
                            {vendor.status === 'approved' && (
                              <Button size="sm" variant="outline" disabled={updateVendorStatusMutation.isPending} onClick={() => updateVendorStatusMutation.mutate({ vendorId: vendor.id, status: 'suspended' })}>Suspend</Button>
                            )}
                            {vendor.status === 'suspended' && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={updateVendorStatusMutation.isPending} onClick={() => updateVendorStatusMutation.mutate({ vendorId: vendor.id, status: 'approved' })}>
                                <CheckCircle className="w-3 h-3 mr-1" />Reactivate
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

          {/* ═══ USER MANAGEMENT TAB ════════════════════════════════════════ */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  User Management
                  <Badge variant="outline">{allUsers.length} users</Badge>
                </CardTitle>
                <CardDescription>Assign and revoke platform roles.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={u.profileImageUrl} />
                          <AvatarFallback className="bg-nigerian-green text-white">
                            {u.firstName?.[0]}{u.lastName?.[0] || u.email?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-sm">{u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                          <div className="flex gap-1 mt-1">
                            {(u.roles as string[] || []).map(r => (
                              <Badge key={r} variant={r === 'admin' ? 'destructive' : r === 'vendor' ? 'default' : 'secondary'} className="text-xs">{r}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {['customer', 'vendor', 'admin'].map(role => {
                          const uHasRole = hasRole(u, role);
                          const isSelf = u.id === user?.id && role === 'admin' && uHasRole;
                          return (
                            <div key={role} className="flex items-center gap-1.5">
                              <Checkbox id={`${u.id}-${role}`} checked={uHasRole} disabled={isSelf}
                                onCheckedChange={() => {
                                  if (isSelf) { toast({ title: 'Cannot remove your own admin role.', variant: 'destructive' }); return; }
                                  toggleUserRoleMutation.mutate({ userId: u.id, role, hasRole: uHasRole });
                                }} />
                              <label htmlFor={`${u.id}-${role}`} className="text-xs capitalize cursor-pointer">{role}</label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ SYSTEM OVERVIEW TAB ════════════════════════════════════════ */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Platform Health */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-4 h-4" />Platform Health</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'Active Vendors', value: (vendors as any[]).filter(v => v.status === 'approved').length, total: (vendors as any[]).length, color: 'bg-green-500' },
                    { label: 'Approved Products', value: approvedProducts.length, total: allProducts.length, color: 'bg-blue-500' },
                    { label: 'Featured Slots Used', value: featuredProducts.length, total: MAX_FEATURED, color: 'bg-yellow-500' },
                    { label: 'Verified Users', value: allUsers.filter(u => (u as any).emailVerified).length, total: allUsers.length, color: 'bg-purple-500' },
                  ].map(({ label, value, total, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{label}</span>
                        <span className="font-semibold">{value} / {total}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Total Inventory Value</span>
                    <span className="font-bold text-green-700">
                      {formatPrice(approvedProducts.reduce((s, p) => s + parseFloat(p.price) * p.stock, 0).toString())}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Top Products */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" />Top Products by Value</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[...approvedProducts].sort((a, b) => parseFloat(b.price) * b.stock - parseFloat(a.price) * a.stock).slice(0, 8).map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-bold w-4">#{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium truncate max-w-[180px]">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.vendor.businessName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-green-700">{formatPrice((parseFloat(p.price) * p.stock).toString())}</p>
                          <p className="text-xs text-gray-400">{p.stock} units @ {formatPrice(p.price)}</p>
                        </div>
                      </div>
                    ))}
                    {approvedProducts.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No approved products yet.</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Low Stock Alerts */}
              {lowStockProducts.length > 0 && (
                <Card className="border-orange-200">
                  <CardHeader><CardTitle className="text-base text-orange-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Low Stock Alerts</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {lowStockProducts.map(p => (
                        <div key={p.id} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                          <div>
                            <p className="font-medium truncate max-w-[200px]">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.vendor.businessName}</p>
                          </div>
                          <Badge variant="outline" className={p.stock === 0 ? 'border-red-400 text-red-600' : 'border-orange-400 text-orange-600'}>
                            {p.stock === 0 ? 'Out of Stock' : `${p.stock} left`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions */}
              <Card>
                <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: `Review Pending Products (${pendingProducts.length})`, tab: 'products', icon: Package },
                    { label: `Review Vendor Applications (${pendingVendors.length})`, tab: 'vendors', icon: Users },
                    { label: 'View Analytics Dashboard', tab: 'analytics', icon: BarChart3 },
                    { label: 'Manage Featured Products', tab: 'featured', icon: Star },
                  ].map(({ label, tab, icon: Icon }) => (
                    <Button key={tab} variant="outline" className="w-full justify-start gap-2 text-sm"
                      onClick={() => document.querySelector<HTMLButtonElement>(`[value="${tab}"]`)?.click()}>
                      <Icon className="w-4 h-4" />{label}
                    </Button>
                  ))}
                  <Separator />
                  <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => initCategoriesMutation.mutate()} disabled={initCategoriesMutation.isPending}>
                    <RefreshCw className="w-4 h-4" />{initCategoriesMutation.isPending ? 'Initialising…' : 'Initialise Categories'}
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={exportOrdersCSV}>
                    <Download className="w-4 h-4" />Export All Orders (CSV)
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Vendor Review Modal */}
      <Dialog open={!!reviewVendor} onOpenChange={(open) => !open && setReviewVendor(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={reviewVendor?.user?.profileImageUrl} />
                <AvatarFallback className="bg-nigerian-green text-white text-sm">{reviewVendor?.businessName?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              Vendor Profile Review
            </DialogTitle>
            <DialogDescription>Full details for <strong>{reviewVendor?.businessName}</strong></DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {reviewVendor && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">{getStatusBadge(reviewVendor.status)}<span className="text-sm text-gray-500">Current status</span></div>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Package className="w-4 h-4" />Business Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-xs text-gray-400 block">Business Name</span><span className="font-medium">{reviewVendor.businessName}</span></div>
                    <div><span className="text-xs text-gray-400 block">Applied</span><span className="font-medium">{new Date(reviewVendor.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                  </div>
                  <div className="mt-3">
                    <span className="text-xs text-gray-400 block mb-1">Business Description</span>
                    {reviewVendor.description
                      ? <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{reviewVendor.description}</p>
                      : <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">No description provided.</p>}
                  </div>
                </div>
                <Separator />
                {reviewVendor.user && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2"><UserIcon className="w-4 h-4" />Account Owner</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><span className="text-xs text-gray-400 block">Full Name</span><span className="font-medium">{reviewVendor.user.firstName || '-'} {reviewVendor.user.lastName || ''}</span></div>
                      <div><span className="text-xs text-gray-400 block">Email</span><span className="font-medium text-sm">{reviewVendor.user.email || 'N/A'}</span></div>
                      <div><span className="text-xs text-gray-400 block">Email Verified</span>
                        <span className={`font-medium flex items-center gap-1 text-sm ${reviewVendor.user.emailVerified ? 'text-green-600' : 'text-red-500'}`}>
                          {reviewVendor.user.emailVerified ? <><ShieldCheck className="w-3 h-3" />Verified</> : <><XCircle className="w-3 h-3" />Not verified</>}
                        </span>
                      </div>
                      <div><span className="text-xs text-gray-400 block">Account Created</span><span className="font-medium text-sm">{reviewVendor.user.createdAt ? new Date(reviewVendor.user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}</span></div>
                    </div>
                  </div>
                )}
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Compliance Checklist</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Business name provided', pass: !!reviewVendor.businessName },
                      { label: 'Business description (10+ chars)', pass: reviewVendor.description?.length > 10 },
                      { label: 'Owner name on file', pass: !!(reviewVendor.user?.firstName && reviewVendor.user?.lastName) },
                      { label: 'Valid email address', pass: !!reviewVendor.user?.email },
                      { label: 'Email address verified', pass: !!reviewVendor.user?.emailVerified },
                    ].map(({ label, pass }) => (
                      <div key={label} className={`flex items-center gap-2 p-2 rounded text-sm ${pass ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                        {pass ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}{label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setReviewVendor(null)}>Close</Button>
            {reviewVendor?.status === 'pending' && (
              <>
                <Button variant="destructive" disabled={updateVendorStatusMutation.isPending}
                  onClick={() => { updateVendorStatusMutation.mutate({ vendorId: reviewVendor.id, status: 'suspended' }); setReviewVendor(null); }}>
                  <XCircle className="w-4 h-4 mr-2" />Reject
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={updateVendorStatusMutation.isPending}
                  onClick={() => { updateVendorStatusMutation.mutate({ vendorId: reviewVendor.id, status: 'approved' }); setReviewVendor(null); }}>
                  <CheckCircle className="w-4 h-4 mr-2" />Approve Vendor
                </Button>
              </>
            )}
            {reviewVendor?.status === 'approved' && (
              <Button variant="outline" disabled={updateVendorStatusMutation.isPending}
                onClick={() => { updateVendorStatusMutation.mutate({ vendorId: reviewVendor.id, status: 'suspended' }); setReviewVendor(null); }}>
                Suspend Vendor
              </Button>
            )}
            {reviewVendor?.status === 'suspended' && (
              <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={updateVendorStatusMutation.isPending}
                onClick={() => { updateVendorStatusMutation.mutate({ vendorId: reviewVendor.id, status: 'approved' }); setReviewVendor(null); }}>
                <CheckCircle className="w-4 h-4 mr-2" />Reactivate Vendor
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
