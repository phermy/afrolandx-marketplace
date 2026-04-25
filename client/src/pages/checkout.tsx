import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/contexts/CartContext';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/navbar';
import LocalPrice from '@/components/LocalPrice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ShippingQuote, ShippingAddress } from '@/types';

export default function Checkout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { cartItems, cartTotal, clearCart } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Nigeria',
  });

  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [paymentMethod] = useState('paystack'); // Only Paystack for now

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: 'Unauthorized',
        description: 'Please sign in to checkout.',
        variant: 'destructive',
      });
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Redirect if cart is empty
  useEffect(() => {
    if (cartItems.length === 0 && !isLoading) {
      toast({
        title: 'Empty Cart',
        description: 'Your cart is empty. Add some items first!',
        variant: 'destructive',
      });
      window.location.href = '/products';
    }
  }, [cartItems, isLoading, toast]);

  // Pre-fill user data
  useEffect(() => {
    if (user) {
      setShippingAddress(prev => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
      }));
    }
  }, [user]);

  // Fetch shipping quotes
  const { data: shippingQuotes = [], isLoading: isLoadingShipping } = useQuery<ShippingQuote[]>({
    queryKey: ['/api/shipping/quote'],
    enabled: !!cartItems.length,
    retry: false,
  });

  // Create order mutation with Paystack integration
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      // Try Paystack integration first
      try {
        const response = await apiRequest('POST', '/api/orders/initialize-payment', orderData);
        return response.json();
      } catch (error) {
        // Fall back to direct order creation if Paystack not configured
        const response = await apiRequest('POST', '/api/orders', orderData);
        return response.json();
      }
    },
    onSuccess: (result) => {
      if (result.paymentUrl) {
        // Redirect to Paystack payment page
        toast({
          title: 'Redirecting to Payment',
          description: 'You will be redirected to complete your payment...',
        });
        
        // Store order reference for verification
        localStorage.setItem('pending_payment_reference', result.reference);
        
        // Redirect to Paystack
        window.location.href = result.paymentUrl;
      } else {
        // Direct order creation (fallback)
        toast({
          title: 'Order Created',
          description: 'Simulating payment completion...',
        });
        
        setTimeout(() => {
          toast({
            title: 'Order Placed Successfully!',
            description: `Order #${result.id} has been created. You will receive a confirmation email shortly.`,
          });
          clearCart();
          window.location.href = '/';
        }, 2000);
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'Please sign in to place order.',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to create order. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedShipping) {
      toast({
        title: 'Missing Information',
        description: 'Please select a shipping method.',
        variant: 'destructive',
      });
      return;
    }

    const selectedQuote = shippingQuotes.find(q => q.carrier === selectedShipping);
    if (!selectedQuote) {
      toast({
        title: 'Error',
        description: 'Invalid shipping method selected.',
        variant: 'destructive',
      });
      return;
    }

    const orderData = {
      totalAmount: (cartTotal + selectedQuote.price).toString(),
      shippingAmount: selectedQuote.price.toString(),
      shippingAddress,
      shippingMethod: selectedShipping.toLowerCase(),
      paymentMethod,
    };

    createOrderMutation.mutate(orderData);
  };

  const formatPrice = (price: number) => {
    return `$${price.toLocaleString()}`;
  };

  const selectedShippingQuote = shippingQuotes.find(q => q.carrier === selectedShipping);
  const totalAmount = cartTotal + (selectedShippingQuote?.price || 0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner-nigerian"></div>
      </div>
    );
  }

  if (!isAuthenticated || cartItems.length === 0) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 font-nigerian">Checkout</h1>
          <p className="text-gray-600">Complete your purchase of authentic African fashion</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Shipping Information */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={shippingAddress.firstName}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, firstName: e.target.value }))}
                        required
                        className="input-nigerian"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={shippingAddress.lastName}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, lastName: e.target.value }))}
                        required
                        className="input-nigerian"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address1">Address Line 1</Label>
                    <Input
                      id="address1"
                      value={shippingAddress.address1}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, address1: e.target.value }))}
                      required
                      className="input-nigerian"
                    />
                  </div>

                  <div>
                    <Label htmlFor="address2">Address Line 2 (Optional)</Label>
                    <Input
                      id="address2"
                      value={shippingAddress.address2}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, address2: e.target.value }))}
                      className="input-nigerian"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={shippingAddress.city}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                        required
                        className="input-nigerian"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                        required
                        className="input-nigerian"
                      />
                    </div>
                    <div>
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        value={shippingAddress.postalCode}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                        required
                        className="input-nigerian"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={shippingAddress.country}
                      onValueChange={(value) => setShippingAddress(prev => ({ ...prev, country: value }))}
                    >
                      <SelectTrigger className="input-nigerian">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nigeria">Nigeria</SelectItem>
                        <SelectItem value="United States">United States</SelectItem>
                        <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="Germany">Germany</SelectItem>
                        <SelectItem value="France">France</SelectItem>
                        <SelectItem value="Ghana">Ghana</SelectItem>
                        <SelectItem value="South Africa">South Africa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Method */}
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Method</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingShipping ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="spinner-nigerian"></div>
                      <span className="ml-2">Loading shipping options...</span>
                    </div>
                  ) : (
                    <RadioGroup value={selectedShipping} onValueChange={setSelectedShipping}>
                      <div className="space-y-3">
                        {shippingQuotes.map((quote) => (
                          <div key={quote.carrier} className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                            <RadioGroupItem value={quote.carrier} id={quote.carrier} />
                            <Label htmlFor={quote.carrier} className="flex-1 cursor-pointer">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-semibold">{quote.service}</p>
                                  <p className="text-sm text-gray-600">{quote.duration}</p>
                                </div>
                                <span className="font-bold text-nigerian-green">
                                  {formatPrice(quote.price)}
                                </span>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-8 bg-green-600 rounded flex items-center justify-center">
                        <span className="text-white font-bold text-sm">PAY</span>
                      </div>
                      <div>
                        <p className="font-semibold">Paystack</p>
                        <p className="text-sm text-gray-600">Secure payment with cards, bank transfer, or mobile money</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Cart Items */}
                  <div className="space-y-3">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center space-x-3">
                        <div className="w-12 h-12 flex-shrink-0">
                          {item.product.images && item.product.images.length > 0 ? (
                            <img
                              src={item.product.images[0]}
                              alt={item.product.name}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-nigerian-green to-nigerian-gold rounded"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{item.product.name}</p>
                          <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                        </div>
                        <span className="font-semibold text-sm">
                          {formatPrice(parseFloat(item.product.price) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Pricing Breakdown */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatPrice(cartTotal)}</span>
                    </div>
                    
                    {selectedShippingQuote && (
                      <div className="flex justify-between text-sm">
                        <span>Shipping ({selectedShippingQuote.carrier})</span>
                        <span>{formatPrice(selectedShippingQuote.price)}</span>
                      </div>
                    )}
                    
                    <Separator />
                    
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <div className="text-right">
                        <span className="text-nigerian-green">{formatPrice(totalAmount)}</span>
                        <LocalPrice usdAmount={totalAmount} className="block" size="md" />
                      </div>
                    </div>
                  </div>

                  {/* Place Order Button */}
                  <Button
                    type="submit"
                    disabled={!selectedShipping || createOrderMutation.isPending}
                    className="w-full btn-nigerian"
                  >
                    {createOrderMutation.isPending ? (
                      <div className="flex items-center">
                        <div className="spinner-nigerian w-4 h-4 mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Place Order - {formatPrice(totalAmount)}
                      </>
                    )}
                  </Button>

                  {/* Security Info */}
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Secure checkout powered by Paystack</span>
                    </div>
                  </div>

                  {/* Trust Badges */}
                  <div className="text-center pt-4">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <Badge variant="outline" className="flex items-center justify-center py-2">
                        <span className="mr-1">🔒</span>
                        SSL Secure
                      </Badge>
                      <Badge variant="outline" className="flex items-center justify-center py-2">
                        <span className="mr-1">📦</span>
                        Tracking
                      </Badge>
                      <Badge variant="outline" className="flex items-center justify-center py-2">
                        <span className="mr-1">↩️</span>
                        Returns
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
