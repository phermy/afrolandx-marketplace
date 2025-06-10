import { createContext, useContext, useState, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import type { CartItem, Product } from '@/types';

interface CartContextType {
  cartItems: (CartItem & { product: Product })[];
  isCartOpen: boolean;
  cartTotal: number;
  cartCount: number;
  isAddingToCart: boolean;
  isUpdatingQuantity: boolean;
  isRemovingFromCart: boolean;
  isClearingCart: boolean;
  addToCart: (productId: number, quantity?: number) => void;
  removeFromCart: (cartItemId: number) => void;
  updateQuantity: (cartItemId: number, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { toast } = useToast();

  // Fetch cart items
  const { data: cartItems = [] } = useQuery<(CartItem & { product: Product })[]>({
    queryKey: ['/api/cart'],
    retry: false,
  });

  // Add to cart mutation with optimistic updates
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity = 1 }: { productId: number; quantity?: number }) => {
      const response = await apiRequest('POST', '/api/cart', { productId, quantity });
      return response;
    },
    onMutate: async ({ productId, quantity = 1 }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/cart'] });
      
      // Snapshot the previous value
      const previousCart = queryClient.getQueryData(['/api/cart']);
      
      return { previousCart };
    },
    onSuccess: (data) => {
      // Invalidate and refetch cart data
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      
      toast({
        title: 'Added to cart',
        description: 'Product has been added to your cart.',
      });
    },
    onError: (error, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['/api/cart'], context.previousCart);
      }
      
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to add product to cart.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      // Ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
  });

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ cartItemId, quantity }: { cartItemId: number; quantity: number }) => {
      await apiRequest('PATCH', `/api/cart/${cartItemId}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to update quantity.',
        variant: 'destructive',
      });
    },
  });

  // Remove from cart mutation
  const removeFromCartMutation = useMutation({
    mutationFn: async (cartItemId: number) => {
      await apiRequest('DELETE', `/api/cart/${cartItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      toast({
        title: 'Removed from cart',
        description: 'Product has been removed from your cart.',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to remove product from cart.',
        variant: 'destructive',
      });
    },
  });

  // Clear cart mutation
  const clearCartMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', '/api/cart');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      toast({
        title: 'Cart cleared',
        description: 'All items have been removed from your cart.',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to clear cart.',
        variant: 'destructive',
      });
    },
  });

  // Calculate cart totals
  const cartTotal = cartItems.reduce((total: number, item: any) => {
    return total + parseFloat(item.product.price) * item.quantity;
  }, 0);

  const cartCount = cartItems.reduce((count: number, item: any) => count + item.quantity, 0);

  // Cart actions
  const addToCart = (productId: number, quantity = 1) => {
    addToCartMutation.mutate({ productId, quantity });
  };

  const updateQuantity = (cartItemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    updateQuantityMutation.mutate({ cartItemId, quantity });
  };

  const removeFromCart = (cartItemId: number) => {
    removeFromCartMutation.mutate(cartItemId);
  };

  const clearCart = () => {
    clearCartMutation.mutate();
  };

  const toggleCart = () => {
    console.log('Toggling cart, current state:', isCartOpen);
    setIsCartOpen(!isCartOpen);
  };

  const openCart = () => {
    console.log('Opening cart');
    setIsCartOpen(true);
  };

  const closeCart = () => {
    console.log('Closing cart');
    setIsCartOpen(false);
  };

  const value: CartContextType = {
    cartItems,
    isCartOpen,
    cartTotal,
    cartCount,
    isAddingToCart: addToCartMutation.isPending,
    isUpdatingQuantity: updateQuantityMutation.isPending,
    isRemovingFromCart: removeFromCartMutation.isPending,
    isClearingCart: clearCartMutation.isPending,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    toggleCart,
    openCart,
    closeCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}