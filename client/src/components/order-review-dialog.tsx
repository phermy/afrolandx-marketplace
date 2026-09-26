import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function OrderReviewDialog({
  orderId,
  productId,
  productName,
  onClose,
}: {
  orderId: number;
  productId: number;
  productName: string;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const submit = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/orders/${orderId}/feedback`, {
        productId,
        rating,
        comment: comment.trim(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders/my-orders'] });
      toast({ title: 'Review sent', description: 'Thank you. Your review will appear after an administrator checks it.' });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Could not send review', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open onOpenChange={open => { if (!open && !submit.isPending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Review {productName}</DialogTitle>
          <DialogDescription>
            Only completed purchases can be reviewed. Your rating and comments will be checked before they appear publicly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium">Your rating</p>
            <div className="flex gap-2" role="group" aria-label="Rate this product from one to five stars">
              {[1, 2, 3, 4, 5].map(value => (
                <button type="button" key={value} aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                  className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700">
                  <Star className={`h-8 w-8 ${value <= rating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm font-medium">
            Tell other shoppers about your experience <span className="font-normal text-gray-500">(optional)</span>
            <textarea value={comment} maxLength={2000} rows={4}
              onChange={event => setComment(event.target.value)}
              placeholder="What did you think of the item?"
              className="mt-2 w-full rounded-md border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-700" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={submit.isPending} onClick={onClose}>Cancel</Button>
            <Button type="button" disabled={rating === 0 || submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? 'Sending…' : 'Submit review'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}