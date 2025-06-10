import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import Navbar from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { Order } from '@/types';

export default function MyOrders() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/orders/my-orders'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Handle payment success redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const orderId = urlParams.get('orderId');
    const reference = urlParams.get('reference');

    if (paymentStatus === 'success' && orderId) {
      toast({
        title: "Payment Successful! 🎉",
        description: `Your order #${orderId} has been confirmed and payment processed successfully.`,
        variant: "default",
      });
      
      // Clean up URL parameters
      window.history.replaceState({}, '', '/my-orders');
    }
  }, [toast]);

  const formatPrice = (price: string) => {
    return `₦${parseFloat(price).toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      returned: 'bg-gray-100 text-gray-800',
    };

    return (
      <Badge className={statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusStyles = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800',
    };

    return (
      <Badge className={statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="spinner-nigerian"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 font-nigerian mb-2">My Orders</h1>
          <p className="text-gray-600">Track and manage your orders</p>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders yet</h3>
              <p className="text-gray-600 mb-4">You haven't placed any orders yet. Start shopping to see your orders here.</p>
              <Button onClick={() => window.location.href = '/'} className="btn-nigerian">
                Start Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">Order #{order.id}</CardTitle>
                      <p className="text-sm text-gray-600">
                        Placed on {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right space-y-2">
                      {getStatusBadge(order.orderStatus)}
                      {getPaymentStatusBadge(order.paymentStatus)}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    {/* Order Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Total Amount:</span>
                        <p className="text-lg font-bold text-nigerian-green">{formatPrice(order.totalAmount)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Shipping Method:</span>
                        <p className="capitalize">{order.shippingMethod}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Payment Reference:</span>
                        <p className="font-mono text-xs">{order.paymentReference}</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Order Actions */}
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      
                      {order.orderStatus === 'delivered' && (
                        <>
                          <Button variant="outline" size="sm" className="text-orange-600 border-orange-200 hover:bg-orange-50">
                            Request Return
                          </Button>
                          <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                            Leave Review
                          </Button>
                        </>
                      )}
                      
                      {(order.orderStatus === 'pending' || order.orderStatus === 'processing') && order.paymentStatus === 'paid' && (
                        <Button variant="destructive" size="sm">
                          Cancel Order
                        </Button>
                      )}
                      
                      {order.paymentStatus === 'failed' && (
                        <Button size="sm" className="bg-nigerian-green hover:bg-green-700">
                          Retry Payment
                        </Button>
                      )}
                    </div>

                    {/* Shipping Information */}
                    {order.orderStatus === 'shipped' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4m-6 4v10a1 1 0 001 1h4a1 1 0 001-1V11m-6 0h6" />
                          </svg>
                          <div>
                            <h4 className="font-medium text-blue-900">Your order is on the way!</h4>
                            <p className="text-sm text-blue-700 mt-1">
                              Expected delivery: 3-5 business days
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}