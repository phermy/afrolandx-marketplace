import { Suspense, useState, type ComponentType } from "react";
import { MessageCircle } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const ShoppingCart = lazyWithRetry(() => import("@/components/shopping-cart"));

type ChatbotProps = {
  initialOpen?: boolean;
  hideLauncher?: boolean;
  onClose?: () => void;
};

export default function DeferredGlobalTools() {
  const { isCartOpen } = useCart();
  const [chatbotComponent, setChatbotComponent] = useState<ComponentType<ChatbotProps> | null>(null);
  const [chatbotLoading, setChatbotLoading] = useState(false);
  const [chatbotError, setChatbotError] = useState(false);

  const openAssistant = () => {
    if (chatbotComponent || chatbotLoading) return;
    setChatbotError(false);
    setChatbotLoading(true);
    import("@/components/chatbot")
      .then(module => setChatbotComponent(() => module.Chatbot))
      .catch(() => setChatbotError(true))
      .finally(() => setChatbotLoading(false));
  };

  const closeAssistant = () => setChatbotComponent(null);
  const ChatbotComponent = chatbotComponent;

  return (
    <>
      {isCartOpen && (
        <Suspense fallback={<div className="fixed bottom-4 right-4 z-50 rounded-md bg-background px-3 py-2 text-sm shadow-md" role="status" aria-live="polite">Opening your cart…</div>}>
          <ShoppingCart />
        </Suspense>
      )}

      {ChatbotComponent ? (
        <ChatbotComponent
          initialOpen
          hideLauncher
          onClose={closeAssistant}
        />
      ) : (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          {chatbotLoading && (
            <span role="status" aria-live="polite" className="rounded-md bg-background px-3 py-2 text-sm shadow-md">
              Opening Afrolandx Assistant…
            </span>
          )}
          {chatbotError && (
            <span role="alert" className="rounded-md bg-background px-3 py-2 text-sm shadow-md">
              Assistant could not load. Select to retry.
            </span>
          )}
          <Button
            onClick={openAssistant}
            data-testid="button-open-chat"
            aria-label={chatbotError ? "Retry loading Afrolandx assistant" : "Open Afrolandx assistant"}
            aria-busy={chatbotLoading}
            className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
            size="icon"
          >
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
          </Button>
        </div>
      )}
    </>
  );
}
