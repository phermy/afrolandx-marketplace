import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from 'wouter';

export default function ShoppingCart() {
  const { 
    cartItems, 
    isCartOpen, 
    cartTotal, 
    cartCount, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    closeCart,
    isRemovingFromCart,
    isUpdatingQuantity,
    isClearingCart 
  } = useCart();
  const { isAuthenticated } = useAuth();

  console.log('Cart component render - isAuthenticated:', isAuthenticated, 'isCartOpen:', isCartOpen);
  
  if (!isAuthenticated || !isCartOpen) {
    return null;
  }

  const formatPrice = (price: string) => {
    return `₦${parseFloat(price).toLocaleString()}`;
  };

  const handleQuantityChange = (cartItemId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
    } else {
      updateQuantity(cartItemId, newQuantity);
    }
  };

  const shipping = 5000; // ₦5,000 base shipping
  const finalTotal = cartTotal + shipping;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={closeCart}
      />
      
      {/* Cart Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Shopping Cart
              {cartCount > 0 && (
                <Badge className="ml-2 bg-nigerian-green text-white">
                  {cartCount} {cartCount === 1 ? 'item' : 'items'}
                </Badge>
              )}
            </h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={closeCart}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Cart Content */}
        {cartItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5M7 13v6a2 2 0 002 2h6a2 2 0 002-2v-6m-8 0V9a2 2 0 012-2h4a2 2 0 012 2v4.01" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Your cart is empty</h3>
              <p className="text-gray-600 mb-4">Add some beautiful Nigerian fashion items to get started!</p>
              <Button onClick={closeCart} className="btn-nigerian">
                Continue Shopping
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                    {/* Product Image */}
                    <div className="w-16 h-16 flex-shrink-0">
                      {item.product.images && item.product.images.length > 0 ? (
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="w-full h-full object-cover rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.style.background = 'linear-gradient(135deg, var(--nigerian-green), var(--nigerian-gold))';
                              parent.classList.add('flex', 'items-center', 'justify-center');
                              parent.innerHTML = '<span class="text-white text-xs">No Image</span>';
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-nigerian-green to-nigerian-gold rounded flex items-center justify-center">
                          <span className="text-white text-xs">No Image</span>
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{item.product.name}</h4>
                      <p className="text-sm text-gray-600 truncate">{item.product.description}</p>
                      <p className="text-lg font-bold text-nigerian-green mt-1">
                        {formatPrice(item.product.price)}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex flex-col items-center space-y-2">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          disabled={isUpdatingQuantity}
                          className="w-8 h-8 p-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </Button>
                        <span className="w-8 text-center font-semibold">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          disabled={isUpdatingQuantity || item.quantity >= item.product.quantity}
                          className="w-8 h-8 p-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.id)}
                        disabled={isRemovingFromCart}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Clear Cart Button */}
              {cartItems.length > 0 && (
                <div className="mt-6">
                  <Button
                    variant="outline"
                    onClick={clearCart}
                    disabled={isClearingCart}
                    className="w-full text-red-500 border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    {isClearingCart ? 'Clearing...' : 'Clear Cart'}
                  </Button>
                </div>
              )}
            </div>

            {/* Cart Summary */}
            <div className="border-t bg-gray-50 p-6">
              <div className="space-y-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-nigerian-green">{formatPrice(cartTotal.toString())}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Shipping cost will be calculated at checkout
                </p>
              </div>

              {/* Checkout Button */}
              <div className="mt-6 space-y-3">
                <Link href="/checkout">
                  <Button className="w-full btn-nigerian" onClick={closeCart}>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Proceed to Checkout
                  </Button>
                </Link>
                
                <div className="text-center text-sm text-gray-500">
                  Secure checkout powered by{' '}
                  <span className="font-semibold text-nigerian-green">Paystack</span>
                </div>

                {/* Shipping Info */}
                <div className="mt-4 p-4 bg-white rounded-lg border">
                  <h4 className="font-semibold text-gray-900 mb-3">Shipping Options</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center">
                        <span className="text-blue-600 mr-2">🚚</span>
                        UPS Express
                      </span>
                      <span className="text-gray-600">5-7 days</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center">
                        <span className="text-purple-600 mr-2">✈️</span>
                        FedEx International
                      </span>
                      <span className="text-gray-600">3-5 days</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center">
                        <span className="text-yellow-600 mr-2">📦</span>
                        DHL Express
                      </span>
                      <span className="text-gray-600">2-4 days</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
