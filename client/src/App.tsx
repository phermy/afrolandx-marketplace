import { Component, Suspense, useEffect, type ErrorInfo, type ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CartProvider } from "@/contexts/CartContext";
import { hasFullManagementAccess } from "@shared/admin-access";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import DeferredGlobalTools from "@/components/deferred-global-tools";
import PageHead from "@/components/page-head";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import { isVendor } from "@/lib/roleUtils";
import SessionTimeout from "@/components/session-timeout";

const NotFound = lazyWithRetry(() => import("@/pages/not-found"));
const Landing = lazyWithRetry(() => import("@/pages/landing"));
const Policies = lazyWithRetry(() => import("@/pages/policies"));
const PolicyDetail = lazyWithRetry(() => import("@/pages/policy-detail"));
const Home = lazyWithRetry(() => import("@/pages/home"));
const Products = lazyWithRetry(() => import("@/pages/products"));
const Reviews = lazyWithRetry(() => import("@/pages/reviews"));
const Profile = lazyWithRetry(() => import("@/pages/profile"));
const MyOrders = lazyWithRetry(() => import("@/pages/my-orders"));
const OrderSuccess = lazyWithRetry(() => import("@/pages/order-success"));
const VendorDashboard = lazyWithRetry(() => import("@/pages/vendor-dashboard"));
const VendorApply = lazyWithRetry(() => import("@/pages/vendor-apply"));
const AdminDashboard = lazyWithRetry(() => import("@/pages/admin-dashboard"));
const AdminProductReview = lazyWithRetry(() => import("@/pages/admin-product-review"));
const AdminFinance = lazyWithRetry(() => import("@/pages/admin-finance"));
const VendorFinance = lazyWithRetry(() => import("@/pages/vendor-finance"));
const Shipping = lazyWithRetry(() => import("@/pages/shipping"));
const Checkout = lazyWithRetry(() => import("@/pages/checkout"));
const Measurements = lazyWithRetry(() => import("@/pages/measurements"));
const Messages = lazyWithRetry(() => import("@/pages/messages"));
const Lookbook = lazyWithRetry(() => import("@/pages/lookbook"));
const Loyalty = lazyWithRetry(() => import("@/pages/loyalty"));
const CollabDrops = lazyWithRetry(() => import("@/pages/collab-drops"));
const CollabDropDetail = lazyWithRetry(() => import("@/pages/collab-drop-detail"));
const VendorWorkshop = lazyWithRetry(() => import("@/pages/vendor-workshop"));
const EventPlanner = lazyWithRetry(() => import("@/pages/event-planner"));
const Quiz = lazyWithRetry(() => import("@/pages/quiz"));
const DiscoverAfrica = lazyWithRetry(() => import("@/pages/discover-africa"));
const ProductDetail = lazyWithRetry(() => import("@/pages/product-detail"));
const PublicVendor = lazyWithRetry(() => import("@/pages/public-vendor"));
const Login = lazyWithRetry(() => import("@/pages/login"));
const Register = lazyWithRetry(() => import("@/pages/register"));
const ForgotPassword = lazyWithRetry(() => import("@/pages/forgot-password"));
const ContactPage = lazyWithRetry(() => import("@/pages/support-pages").then(module => ({ default: module.ContactPage })));
const FaqPage = lazyWithRetry(() => import("@/pages/support-pages").then(module => ({ default: module.FaqPage })));
const SizeGuidePage = lazyWithRetry(() => import("@/pages/support-pages").then(module => ({ default: module.SizeGuidePage })));
const ShippingInformationPage = lazyWithRetry(() => import("@/pages/support-pages").then(module => ({ default: module.ShippingInformationPage })));
const ReturnsPage = lazyWithRetry(() => import("@/pages/support-pages").then(module => ({ default: module.ReturnsPage })));
const AccessibilityPage = lazyWithRetry(() => import("@/pages/support-pages").then(module => ({ default: module.AccessibilityPage })));

class RouteChunkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route failed to load", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-4 text-center" role="alert">
          <h1 className="text-xl font-semibold">This page could not be loaded</h1>
          <p className="max-w-md text-sm text-muted-foreground">A network interruption may have stopped part of Afrolandx from loading. Reload the page to try again.</p>
          <button type="button" onClick={() => window.location.reload()} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            Reload page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

function RouteLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading page</span>
      <div className="spinner-nigerian" aria-hidden="true" />
    </div>
  );
}

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
    <RouteChunkErrorBoundary>
    <Suspense fallback={<RouteLoading />}>
    <Switch>
      {/* Auth pages — always accessible, redirect home if already logged in */}
      <Route path="/login">
        {isAuthenticated ? <AuthRedirect to={user?.signupIntent === "vendor" ? "/vendor/apply" : "/"} /> : <Login />}
      </Route>
      <Route path="/register">
        {isAuthenticated ? <AuthRedirect to={new URLSearchParams(window.location.search).get("as") === "vendor" || user?.signupIntent === "vendor" ? "/vendor/apply" : "/"} /> : <Register />}
      </Route>
      <Route path="/forgot-password">
        <ForgotPassword />
      </Route>

      {/* Public pages */}
      <Route path="/contact" component={ContactPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/size-guide" component={SizeGuidePage} />
      <Route path="/shipping-information" component={ShippingInformationPage} />
      <Route path="/returns" component={ReturnsPage} />
      <Route path="/accessibility" component={AccessibilityPage} />
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
        {hasFullManagementAccess(user) ? <AdminProtectedRoute>
          <AdminFinance />
        </AdminProtectedRoute> : <AuthRedirect to={isAuthenticated ? "/admin" : "/login"} />}
      </Route>
      <Route path="/admin/products/:id">
        <AdminProtectedRoute>
          <AdminProductReview />
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
      <Route path="/vendor/apply" component={VendorApply} />
      <Route path="/checkout">
        <Checkout />
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

      <Route path="/profile">
        {isAuthenticated ? <Profile /> : <AuthRedirect to="/login" />}
      </Route>
      <Route path="/my-orders">
        {isAuthenticated ? <MyOrders /> : <AuthRedirect to="/login" />}
      </Route>
      <Route path="/order-success">
        <OrderSuccess />
      </Route>

      {/* Authenticated-only pages */}
      {isAuthenticated ? (
        <>
          <Route path="/measurements" component={Measurements} />
          <Route path="/messages" component={Messages} />
          <Route path="/loyalty" component={Loyalty} />
        </>
      ) : null}

      <Route component={NotFound} />
    </Switch>
    </Suspense>
    </RouteChunkErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <PageHead />
          <a href="#main-content" onClick={(event) => {
            event.preventDefault();
            const root = document.getElementById("main-content");
            const content = root?.querySelector<HTMLElement>("main, h1") || root;
            if (content) { content.tabIndex = -1; content.focus(); content.scrollIntoView({ block: "start" }); }
          }} className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:text-black focus:p-3 focus:rounded">
            Skip to main content
          </a>
          <div id="main-content" tabIndex={-1}>
            <Router />
          </div>
          <DeferredGlobalTools />
          <SessionTimeout />
          <SessionKickoutGuard />
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}

export default App;
