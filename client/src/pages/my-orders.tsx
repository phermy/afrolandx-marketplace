import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import Navbar from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Package, Truck, CheckCircle2, XCircle, Clock, RefreshCw,
  ShoppingBag, MapPin, CreditCard, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { Order } from '@/types';

// Order lifecycle stages
const STAGES = [
  { key: 'pending',    label: 'Order Placed',  icon: ShoppingBag, desc: 'We received your order' },
  { key: 'processing', label: 'Processing',    icon: Package,     desc: 'Vendor is preparing your items' },
  { key: 'shipped',    label: 'Shipped',       icon: Truck,       desc: 'Order is on the way' },
  { key: 'delivered',  label: 'Delivered',     icon: CheckCircle2, desc: 'Arrived at your door' },
] as const;

const STAGE_ORDER = ['pending', 'processing', 'shipped', 'delivered'];

function getStageIndex(status: string): number {
  if (status === 'cancelled') return -1;
  return STAGE_ORDER.indexOf(status);
}

function getEstimatedDelivery(method?: string, createdAt?: string): string {
  if (!createdAt) return 'N/A';
  const days: Record<string, number> = { ups: 6, fedex: 4, dhl: 3 };
  const d = days[method || 'ups'] ?? 5;
  const date = new Date(createdAt);
  date.setDate(date.getDate() + d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function OrderTimeline({ status }: { status: string }) {
  const cancelled = status === 'cancelled';
  const activeIdx = getStageIndex(status);

  if (cancelled) {
    return (
      <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
        <XCircle className="w-6 h-6 text-red-500 shrink-0" />
        <div>
          <p className="font-semibold text-red-700">Order Cancelled</p>
          <p className="text-xs text-red-500">This order has been cancelled and will not be shipped.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-start justify-between relative">
        {/* Connecting line */}
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200 z-0" />
        <div
          className="absolute top-5 left-5 h-0.5 bg-green-500 z-0 transition-all duration-700"
          style={{ width: activeIdx <= 0 ? '0%' : `${(activeIdx / (STAGES.length - 1)) * (100)}%` }}
        />

        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <div key={stage.key} className="flex flex-col items-center z-10 flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                ${done ? 'bg-green-500 border-green-500' : active ? 'bg-white border-green-500 ring-4 ring-green-100' : 'bg-white border-gray-200'}`}>
                <Icon className={`w-4 h-4 ${done ? 'text-white' : active ? 'text-green-600' : 'text-gray-300'}`} />
              </div>
              <p className={`text-xs font-semibold mt-2 text-center ${active ? 'text-green-700' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                {stage.label}
              </p>
              <p className="text-xs text-gray-400 text-center hidden sm:block">{stage.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({ order, onCancel, cancelling }: { order: any; onCancel: (id: number) => void; cancelling: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isCancelled = order.orderStatus === 'cancelled';
  const isDelivered = order.orderStatus === 'delivered';
  const canCancel = ['pending', 'processing'].includes(order.orderStatus) && order.paymentStatus === 'paid';

  const paymentColor = order.paymentStatus === 'paid' || order.paymentStatus === 'completed'
    ? 'bg-green-100 text-green-700'
    : order.paymentStatus === 'failed'
    ? 'bg-red-100 text-red-700'
    : 'bg-yellow-100 text-yellow-700';

  return (
    <Card className={`overflow-hidden transition-shadow hover:shadow-md ${isCancelled ? 'border-red-200 opacity-80' : isDelivered ? 'border-green-200' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">Order #{order.id}</CardTitle>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize
                ${isCancelled ? 'bg-red-100 text-red-700' : isDelivered ? 'bg-green-100 text-green-700' :
                  order.orderStatus === 'shipped' ? 'bg-purple-100 text-purple-700' :
                  order.orderStatus === 'processing' ? 'bg-blue-100 text-blue-700' :
                  'bg-yellow-100 text-yellow-700'}`}>
                {order.orderStatus}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${paymentColor}`}>
                {order.paymentStatus}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Placed {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              {order.shippingMethod && ` · ${order.shippingMethod.toUpperCase()}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-green-700">${parseFloat(order.totalAmount).toFixed(2)}</p>
            {!isCancelled && (
              <p className="text-xs text-gray-400">Est. delivery: {getEstimatedDelivery(order.shippingMethod, order.createdAt)}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Timeline */}
        <OrderTimeline status={order.orderStatus} />

        {/* Shipped info banner */}
        {order.orderStatus === 'shipped' && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex gap-3">
            <Truck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-purple-800 text-sm">Your order is on its way!</p>
              <p className="text-xs text-purple-600">Expected delivery by {getEstimatedDelivery(order.shippingMethod, order.createdAt)}</p>
              {order.trackingNumber && <p className="text-xs font-mono text-purple-600 mt-1">Tracking: {order.trackingNumber}</p>}
            </div>
          </div>
        )}

        {/* Delivered banner */}
        {isDelivered && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-800 text-sm">Order delivered successfully! 🎉</p>
              <p className="text-xs text-green-600">Thank you for shopping with AfrolandX.</p>
            </div>
          </div>
        )}

        {/* Items toggle */}
        {order.items && order.items.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? 'Hide' : 'View'} {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </button>

            {expanded && (
              <div className="mt-3 space-y-2">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    {item.productImage ? (
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="w-14 h-14 object-cover rounded-md shrink-0 border"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gradient-to-br from-nigerian-green to-nigerian-gold rounded-md shrink-0 flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500">by {item.vendorName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-700">${parseFloat(item.priceAtTime).toFixed(2)}</p>
                      <p className="text-xs text-gray-400">×{item.quantity}</p>
                    </div>
                  </div>
                ))}

                {/* Shipping address */}
                {order.shippingAddress && (
                  <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <span>
                      {order.shippingAddress.address1}, {order.shippingAddress.city}, {order.shippingAddress.state}, {order.shippingAddress.country}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {canCancel && (
            <Button
              size="sm"
              variant="destructive"
              disabled={cancelling}
              onClick={() => onCancel(order.id)}
            >
              <XCircle className="w-3 h-3 mr-1" />
              {cancelling ? 'Cancelling…' : 'Cancel Order'}
            </Button>
          )}
          {isDelivered && (
            <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => window.location.href = '/products'}>
              Leave a Review
            </Button>
          )}
          {order.paymentStatus === 'failed' && (
            <Button size="sm" className="bg-nigerian-green hover:bg-green-700 text-white"
              onClick={() => window.location.href = '/checkout'}>
              <CreditCard className="w-3 h-3 mr-1" />Retry Payment
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyOrders() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const prevStatusRef = useRef<Record<number, string>>({});

  const { data: orders = [], isLoading, isFetching, dataUpdatedAt } = useQuery<any[]>({
    queryKey: ['/api/orders/my-orders'],
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 30000, // poll every 30 seconds for real-time updates
    staleTime: 0,
  });

  // Handle payment success redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success' && urlParams.get('orderId')) {
      toast({
        title: '🎉 Payment Successful!',
        description: `Your order #${urlParams.get('orderId')} has been confirmed.`,
      });
      window.history.replaceState({}, '', '/my-orders');
    }
  }, [toast]);

  // Detect status changes on live poll → notify customer
  useEffect(() => {
    if (!orders.length) return;
    const prev = prevStatusRef.current;
    for (const order of orders) {
      const old = prev[order.id];
      if (old && old !== order.orderStatus) {
        const messages: Record<string, string> = {
          processing: `Order #${order.id} is now being processed! 🔄`,
          shipped: `Order #${order.id} has shipped! 🚚`,
          delivered: `Order #${order.id} has been delivered! ✅`,
          cancelled: `Order #${order.id} was cancelled. ❌`,
        };
        if (messages[order.orderStatus]) {
          toast({ title: 'Order Update', description: messages[order.orderStatus] });
        }
      }
    }
    const next: Record<number, string> = {};
    for (const o of orders) next[o.id] = o.orderStatus;
    prevStatusRef.current = next;
  }, [orders, toast]);

  const cancelMutation = useMutation({
    mutationFn: async (orderId: number) => {
      setCancellingId(orderId);
      await apiRequest('PATCH', `/api/orders/${orderId}/cancel`);
    },
    onSuccess: () => {
      toast({ title: 'Order Cancelled', description: 'Your order has been cancelled successfully.' });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/my-orders'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Could not cancel the order at this stage.', variant: 'destructive' });
    },
    onSettled: () => setCancellingId(null),
  });

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]"><div className="spinner-nigerian" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-nigerian">My Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Live tracking — auto-refreshes every 30 seconds
              {isFetching && <RefreshCw className="inline w-3 h-3 ml-1 animate-spin text-green-500" />}
            </p>
          </div>
          <div className="text-right text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />Last updated: {lastUpdated}
          </div>
        </div>

        {/* Summary pills */}
        {orders.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { label: 'All', filter: null },
              { label: 'Active', filter: (o: any) => ['pending','processing','shipped'].includes(o.orderStatus) },
              { label: 'Delivered', filter: (o: any) => o.orderStatus === 'delivered' },
              { label: 'Cancelled', filter: (o: any) => o.orderStatus === 'cancelled' },
            ].map(({ label, filter }) => {
              const count = filter ? orders.filter(filter).length : orders.length;
              return (
                <span key={label} className="bg-white border rounded-full px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                  {label} <span className="font-bold text-gray-900">{count}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Order list */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16">
              <ShoppingBag className="w-16 h-16 mx-auto text-gray-200 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No orders yet</h3>
              <p className="text-gray-500 mb-6 text-sm">You haven't placed any orders yet. Explore our African fashion collection!</p>
              <Button onClick={() => window.location.href = '/products'} className="btn-nigerian">
                Start Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {orders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                onCancel={(id) => cancelMutation.mutate(id)}
                cancelling={cancellingId === order.id}
              />
            ))}
          </div>
        )}

        {/* Help note */}
        <div className="mt-8 text-center text-xs text-gray-400">
          <AlertCircle className="inline w-3 h-3 mr-1" />
          Need help with an order? Contact our support team via the chat button.
        </div>
      </div>
    </div>
  );
}
