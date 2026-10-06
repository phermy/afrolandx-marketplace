import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CartProvider } from "@/contexts/CartContext";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Policies from "@/pages/policies";
import PolicyDetail from "@/pages/policy-detail";
import Home from "@/pages/home";
import Products from "@/pages/products";
import Reviews from "@/pages/reviews";
import Profile from "@/pages/profile";
import MyOrders from "@/pages/my-orders";
import OrderSuccess from "@/pages/order-success";
import VendorDashboard from "@/pages/vendor-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminFinance from "@/pages/admin-finance";
import VendorFinance from "@/pages/vendor-finance";
import Shipping from "@/pages/shipping";
import Checkout from "@/pages/checkout";
import Measurements from "@/pages/measurements";
import Messages from "@/pages/messages";
import Lookbook from "@/pages/lookbook";
import Loyalty from "@/pages/loyalty";
import CollabDrops from "@/pages/collab-drops";
import CollabDropDetail from "@/pages/collab-drop-detail";
import VendorWorkshop from "@/pages/vendor-workshop";
import EventPlanner from "@/pages/event-planner";
import Quiz from "@/pages/quiz";
import DiscoverAfrica from "@/pages/discover-africa";
import ProductDetail from "@/pages/product-detail";
import PublicVendor from "@/pages/public-vendor";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ShoppingCart from "@/components/shopping-cart";
import { Chatbot } from "@/components/chatbot";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import { isVendor } from "@/lib/roleUtils";
import SessionTimeout from "@/components/session-timeout";
import { useEffect } from "react";

function SessionKickoutGuard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handle = () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Signed out",
        description: "A new sign in on another device ended this session.",
        variant: "destructive",
        duration: 6000,
      });
      setLocation("/login");
    };
    window.addEventListener("session-superseded", handle);
    return () => window.removeEventListener("session-superseded", handle);
  }, [setLocation, toast]);

  return null;
}

function AuthRedirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, [setLocation, to]);
  return null;
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner-nigerian"></div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Auth pages — always accessible, redirect home if already logged in */}
      <Route path="/login">
        {isAuthenticated ? <AuthRedirect to={user?.signupIntent === "vendor" ? "/vendor" : "/"} /> : <Login />}
      </Route>
      <Route path="/register">
        {isAuthenticated ? <AuthRedirect to={new URLSearchParams(window.location.search).get("as") === "vendor" || user?.signupIntent === "vendor" ? "/vendor" : "/"} /> : <Register />}
      </Route>
      <Route path="/forgot-password">
        <ForgotPassword />
      </Route>

      {/* Public pages */}
      <Route path="/products/:id" component={ProductDetail} />
      <Route path="/products" component={Products} />
      <Route path="/vendors/:id" component={PublicVendor} />
      <Route path="/reviews" component={Reviews} />
      <Route path="/collab-drops" component={CollabDrops} />
      <Route path="/collab-drops/:id" component={CollabDropDetail} />
      <Route path="/events" component={EventPlanner} />
      <Route path="/discover">
        <AdminProtectedRoute>
          <div className="bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900" role="status">
            Internal preview only. Discover is hidden from customers, and new bookings and payments are disabled.
          </div>
          <DiscoverAfrica />
        </AdminProtectedRoute>
      </Route>
      <Route path="/lookbook" component={Lookbook} />
      <Route path="/policies/:slug" component={PolicyDetail} />
      <Route path="/policies" component={Policies} />
      <Route path="/quizzes/:id" component={Quiz} />

      {/* Home — landing for guests, dashboard for logged-in users */}
      <Route path="/">
        {isAuthenticated ? <Home /> : <Landing />}
      </Route>

      {/* Admin — available to both, protected internally */}
      <Route path="/admin/finance">
        <AdminProtectedRoute>
          <AdminFinance />
        </AdminProtectedRoute>
      </Route>
      <Route path="/admin">
        <AdminProtectedRoute>
          <AdminDashboard />
        </AdminProtectedRoute>
      </Route>
      <Route path="/vendor/finance">
        {!isAuthenticated ? <AuthRedirect to="/login" /> : isVendor(user) ? <VendorFinance /> : <AuthRedirect to="/vendor" />}
      </Route>
      <Route path="/checkout">
        {isAuthenticated ? <Checkout /> : <AuthRedirect to="/login" />}
      </Route>
      <Route path="/vendor/workshop">
        {!isAuthenticated ? <AuthRedirect to="/login" /> : isVendor(user) ? <VendorWorkshop /> : <AuthRedirect to="/vendor" />}
      </Route>
      <Route path="/vendor">
        {isAuthenticated ? <VendorDashboard /> : <AuthRedirect to="/register?as=vendor" />}
      </Route>
      <Route path="/shipping">
        {isAuthenticated ? <Shipping /> : <AuthRedirect to="/login" />}
      </Route>

      {/* Authenticated-only pages */}
      {isAuthenticated ? (
        <>
          <Route path="/profile" component={Profile} />
          <Route path="/my-orders" component={MyOrders} />
          <Route path="/measurements" component={Measurements} />
          <Route path="/messages" component={Messages} />
          <Route path="/loyalty" component={Loyalty} />
          <Route path="/order-success" component={OrderSuccess} />
        </>
      ) : null}

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
          <SessionTimeout />
          <SessionKickoutGuard />
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}

export default App;
