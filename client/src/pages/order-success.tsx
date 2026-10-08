import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '@/contexts/CartContext';
import Navbar from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { trackEvent, valueBand } from '@/lib/analytics';
import { fetchPaymentConfirmation, PaymentConfirmationError } from '@/lib/payment-confirmation';


export default function OrderSuccess() {
  const { clearCart } = useCart();
  const processedOrderRef = useRef<number | null>(null);
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order_id');
  const reference = params.get('reference') || params.get('trxref');
  const { data: order, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['/api/orders', orderId, reference],
    queryFn: async () => {
      return fetchPaymentConfirmation(orderId || '', reference || '');
    },
    enabled: Boolean(orderId && reference),
    retry: (count, error) => count < 12 && (error instanceof PaymentConfirmationError ? error.pending : true),
    retryDelay: 2000,
  });

  useEffect(() => {
    if (!order || ["payment_review", "cancelled", "expired"].includes(order.orderStatus)) return;
    if (processedOrderRef.current === order.id) return;
    processedOrderRef.current = order.id;
    sessionStorage.removeItem('checkout_request_id');
    clearCart();
    const eventKey = `analytics_payment_succeeded_${order.id}`;
    if (sessionStorage.getItem(eventKey)) return;
    sessionStorage.setItem(eventKey, '1');
    trackEvent('payment_succeeded', {
      order_id: order.id,
      amount_band: valueBand(Number(order.totalAmount ?? order.total ?? 0)),
      shipping_status: order.orderStatus === 'awaiting_shipping_quote' ? 'awaiting_quote' : 'confirmed',
      item_count: Array.isArray(order.items) ? order.items.length : 0,
      payment_provider: 'paystack',
    });
  }, [clearCart, order]);

  if (isLoading) return <div className="min-h-screen bg-gray-50"><Navbar /><div className="min-h-[60vh] flex flex-col gap-4 items-center justify-center" role="status"><div className="spinner-nigerian" /><p>Confirming your payment. Please do not pay again.</p></div></div>;
  if (isError || !order) return (
    <div className="min-h-screen bg-gray-50"><Navbar /><div className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-3">Payment confirmation unavailable</h1>
      <p className="text-gray-600 mb-6">We could not confirm a paid order from this link yet. Do not pay again. Check My Orders or contact payments@afrolandx.com with your payment reference.</p>
      <Button onClick={() => window.location.href = '/my-orders'}>View My Orders</Button>
      <Button className="ml-3" variant="outline" onClick={() => refetch()}>Check confirmation again</Button>
    </div></div>
  );

  if (["payment_review", "cancelled", "expired"].includes(order.orderStatus)) return (
    <div className="min-h-screen bg-gray-50"><Navbar /><div className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-3">Payment received for a closed checkout</h1>
      <p className="text-gray-600 mb-6">Afrolandx must review order #{order.id} before fulfillment. Do not pay again. No automatic refund has been made. Check My Orders or contact payments@afrolandx.com.</p>
      <Button onClick={() => { window.location.href = "/my-orders"; }}>View My Orders</Button>
    </div></div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <Navbar />
      
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-8">
          {/* Success Icon */}
          <div className="mx-auto w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-4xl font-bold text-gray-900 font-nigerian mb-4">
            🎉 Order Placed Successfully!
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Thank you for celebrating African heritage with us.
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h2 className="text-2xl font-bold text-green-800 mb-3">
                    Your Payment Was Successful! ✨
                  </h2>
                  <p className="text-green-700 leading-relaxed">
                    We've received your payment for your items.
                    {order.orderStatus === 'awaiting_shipping_quote'
                      ? ' Your estimated shipping deposit is included. Afrolandx is now confirming the final carrier rate and will collect only any remaining difference from My Orders.'
                      : ' Your shipping is confirmed and the order can now move to fulfillment.'}
                  </p>
                </div>

                {order && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Order Details</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Order ID:</span> #{order.id}</p>
                      <p><span className="font-medium">Payment Reference:</span> {order.paymentReference}</p>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-3">What Happens Next?</h3>
                  <div className="text-left space-y-3 text-blue-700">
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                      <p>{order.orderStatus === 'awaiting_shipping_quote' ? 'Afrolandx confirms the final rate with your selected shipping company.' : 'Our vendors have been notified and will begin preparing your items.'}</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                      <p>{order.orderStatus === 'awaiting_shipping_quote' ? 'You will receive a notification in the app when the final shipping price is ready.' : "You'll receive updates as your order progresses through each stage."}</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                      <p>{order.orderStatus === 'awaiting_shipping_quote' ? 'Pay any remaining shipping difference securely from My Orders.' : "Once shipped, you'll get tracking information and delivery updates."}</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
                      <p>Enjoy your beautiful African fashion pieces!</p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    <span className="font-semibold">Note:</span> The relevant vendors and our admin team have been notified automatically about your order. Processing is expected to begin within one to two business hours.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                <Button 
                  onClick={() => window.location.href = '/my-orders'}
                  className="btn-nigerian"
                >
                  Track My Orders
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                  className="border-nigerian-green text-nigerian-green hover:bg-nigerian-green hover:text-white"
                >
                  Continue Shopping
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-gray-600">
          <p className="mb-2">
            Questions about your order? Contact our support team.
          </p>
          <p className="text-sm">
            Thank you for supporting African artisans and celebrating our rich cultural heritage! 🌍
          </p>
        </div>
      </div>
    </div>
  );
}