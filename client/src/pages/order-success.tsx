import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/contexts/CartContext';
import Navbar from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';


export default function OrderSuccess() {
  const { user } = useAuth();
  const { clearCart } = useCart();
  const [orderDetails, setOrderDetails] = useState<any>(null);

  useEffect(() => {
    // Clear cart after successful payment
    clearCart();

    // Get order details from URL params or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    const reference = urlParams.get('reference');
    
    if (orderId && reference) {
      setOrderDetails({ orderId, reference });
    }
  }, [clearCart]);

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
            Thank you for celebrating African heritage with us
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
                    We've received your payment and your order is now being processed. Our skilled artisans and vendors 
                    are already preparing your authentic African fashion pieces with the utmost care and attention to detail.
                  </p>
                </div>

                {orderDetails && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Order Details</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Order ID:</span> #{orderDetails.orderId}</p>
                      <p><span className="font-medium">Payment Reference:</span> {orderDetails.reference}</p>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-3">What Happens Next?</h3>
                  <div className="text-left space-y-3 text-blue-700">
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
                      <p>Our vendors have been notified and will begin preparing your items</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
                      <p>You'll receive email updates as your order progresses through each stage</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                      <p>Once shipped, you'll get tracking information and delivery updates</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
                      <p>Enjoy your beautiful African fashion pieces!</p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    <span className="font-semibold">Note:</span> Both vendors and our admin team have been automatically 
                    notified about your order. Expect processing to begin within 1-2 business hours.
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