import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import { useToast } from './use-toast';
import type { CartItem } from '@/types';

export function useCart() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Fetch cart items
  const { data: cartItems = [], isLoading } = useQuery<CartItem[]>({
    queryKey: ['/api/cart'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity = 1 }: { productId: number; quantity?: number }) => {
      await apiRequest('POST', '/api/cart', { productId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      toast({
        title: 'Added to cart',
        description: 'Product has been added to your cart.',
      });
      // Auto-open cart after adding item
      setIsCartOpen(true);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'Please sign in to add items to cart.',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to add item to cart.',
        variant: 'destructive',
      });
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
          description: 'Please sign in to update cart.',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/login';
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
        description: 'Item has been removed from your cart.',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'Please sign in to modify cart.',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to remove item.',
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
          description: 'Please sign in to clear cart.',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/login';
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
  const cartTotal = cartItems.reduce((total, item) => {
    return total + parseFloat(item.product.price) * item.quantity;
  }, 0);

  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  // Cart actions
  const addToCart = (productId: number, quantity = 1) => {
    if (!isAuthenticated) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to add items to cart.',
        variant: 'destructive',
      });
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
      return;
    }
    addToCartMutation.mutate({ productId, quantity });
  };

  const removeFromCart = (cartItemId: number) => {
    removeFromCartMutation.mutate(cartItemId);
  };

  const updateQuantity = (cartItemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    updateQuantityMutation.mutate({ cartItemId, quantity });
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

  return {
    cartItems,
    isCartOpen,
    cartTotal,
    cartCount,
    isLoading,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    toggleCart,
    openCart,
    closeCart,
    isAddingToCart: addToCartMutation.isPending,
    isUpdatingQuantity: updateQuantityMutation.isPending,
    isRemovingFromCart: removeFromCartMutation.isPending,
    isClearingCart: clearCartMutation.isPending,
  };
}
