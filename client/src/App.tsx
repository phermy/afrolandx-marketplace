import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/contexts/CartContext";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Products from "@/pages/products";
import Profile from "@/pages/profile";
import MyOrders from "@/pages/my-orders";
import OrderSuccess from "@/pages/order-success";
import VendorDashboard from "@/pages/vendor-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import Checkout from "@/pages/checkout";
import Measurements from "@/pages/measurements";
import Messages from "@/pages/messages";
import Lookbook from "@/pages/lookbook";
import Loyalty from "@/pages/loyalty";
import CollabDrops from "@/pages/collab-drops";
import VendorWorkshop from "@/pages/vendor-workshop";
import EventPlanner from "@/pages/event-planner";
import Quiz from "@/pages/quiz";
import DiscoverNigeria from "@/pages/discover-nigeria";
import ShoppingCart from "@/components/shopping-cart";
import { Chatbot } from "@/components/chatbot";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner-nigerian"></div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/products" component={Products} />
          <Route path="/collab-drops" component={CollabDrops} />
          <Route path="/events" component={EventPlanner} />
          <Route path="/discover" component={DiscoverNigeria} />
          <Route path="/admin">
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          </Route>
        </>
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/products" component={Products} />
          <Route path="/profile" component={Profile} />
          <Route path="/my-orders" component={MyOrders} />
          <Route path="/measurements" component={Measurements} />
          <Route path="/messages" component={Messages} />
          <Route path="/lookbook" component={Lookbook} />
          <Route path="/loyalty" component={Loyalty} />
          <Route path="/collab-drops" component={CollabDrops} />
          <Route path="/events" component={EventPlanner} />
          <Route path="/discover" component={DiscoverNigeria} />
          <Route path="/quizzes/:id" component={Quiz} />
          <Route path="/vendor/workshop" component={VendorWorkshop} />
          <Route path="/order-success" component={OrderSuccess} />
          <Route path="/vendor" component={VendorDashboard} />
          <Route path="/admin">
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          </Route>
          <Route path="/checkout" component={Checkout} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          <ShoppingCart />
          <Chatbot />
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}

export default App;
