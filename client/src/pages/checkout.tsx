import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/contexts/CartContext';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import Navbar from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ShippingQuote, ShippingAddress } from '@/types';

// Currencies Paystack can natively charge in
const PAYSTACK_SUPPORTED = new Set(['NGN', 'GHS', 'ZAR', 'KES', 'USD', 'GBP', 'EUR', 'EGP', 'XOF']);

// States / provinces per country
const STATES_BY_COUNTRY: Record<string, string[]> = {
  Nigeria: [
    'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
    'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT – Abuja','Gombe',
    'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
    'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
    'Taraba','Yobe','Zamfara',
  ],
  Ghana: [
    'Ahafo','Ashanti','Bono','Bono East','Central','Eastern','Greater Accra',
    'North East','Northern','Oti','Savannah','Upper East','Upper West',
    'Volta','Western','Western North',
  ],
  Kenya: [
    'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa',
    'Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi',
    'Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos',
    'Makueni','Mandera','Marsabit','Meru','Migori','Mombasa','Muranga',
    'Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri',
    'Samburu','Siaya','Taita-Taveta','Tana River','Tharaka-Nithi',
    'Trans Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
  ],
  'South Africa': [
    'Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo',
    'Mpumalanga','North West','Northern Cape','Western Cape',
  ],
  Egypt: [
    'Alexandria','Aswan','Asyut','Beheira','Beni Suef','Cairo','Dakahlia',
    'Damietta','Faiyum','Gharbia','Giza','Ismailia','Kafr el-Sheikh',
    'Luxor','Matruh','Minya','Monufia','New Valley','North Sinai',
    'Port Said','Qalyubia','Qena','Red Sea','Sharqia','Sohag','South Sinai',
    'Suez',
  ],
  Senegal: [
    'Dakar','Diourbel','Fatick','Kaffrine','Kaolack','Kédougou','Kolda',
    'Louga','Matam','Saint-Louis','Sédhiou','Tambacounda','Thiès','Ziguinchor',
  ],
  'Ivory Coast': [
    'Abidjan','Bas-Sassandra','Comoé','Denguélé','Gôh-Djiboua','Lacs','Lagunes',
    'Montagnes','Sassandra-Marahoué','Savanes','Vallée du Bandama',
    'Woroba','Yamoussoukro','Zanzan',
  ],
  Tanzania: [
    'Arusha','Dar es Salaam','Dodoma','Geita','Iringa','Kagera','Katavi',
    'Kigoma','Kilimanjaro','Lindi','Manyara','Mara','Mbeya','Morogoro',
    'Mtwara','Mwanza','Njombe','Pemba North','Pemba South','Pwani','Rukwa',
    'Ruvuma','Shinyanga','Simiyu','Singida','Songwe','Tabora','Tanga',
    'Zanzibar North','Zanzibar South','Zanzibar West',
  ],
  Ethiopia: [
    'Addis Ababa','Afar','Amhara','Benishangul-Gumuz','Dire Dawa','Gambela',
    'Harari','Oromia','Sidama','Somali','South Ethiopia','Southwest Ethiopia',
    'Tigray',
  ],
  Uganda: [
    'Central','Eastern','Northern','Western',
  ],
  Rwanda: [
    'Eastern','Kigali','Northern','Southern','Western',
  ],
  Cameroon: [
    'Adamawa','Centre','East','Far North','Littoral','North',
    'North West','South','South West','West',
  ],
  'United States': [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
    'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
    'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
    'Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
    'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
    'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma',
    'Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
    'Tennessee','Texas','Utah','Vermont','Virginia','Washington',
    'West Virginia','Wisconsin','Wyoming','District of Columbia',
  ],
  Canada: [
    'Alberta','British Columbia','Manitoba','New Brunswick',
    'Newfoundland and Labrador','Northwest Territories','Nova Scotia',
    'Nunavut','Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon',
  ],
  'United Kingdom': [
    'England','Scotland','Wales','Northern Ireland',
  ],
  Australia: [
    'Australian Capital Territory','New South Wales','Northern Territory',
    'Queensland','South Australia','Tasmania','Victoria','Western Australia',
  ],
  'New Zealand': [
    'Auckland','Bay of Plenty','Canterbury','Gisborne','Hawke\'s Bay',
    'Manawatu-Whanganui','Marlborough','Nelson','Northland','Otago',
    'Southland','Taranaki','Tasman','Waikato','Wellington','West Coast',
  ],
  India: [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
    'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
    'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
    'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
    'Uttar Pradesh','Uttarakhand','West Bengal',
    'Delhi','Jammu & Kashmir','Ladakh',
  ],
  Brazil: [
    'Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal',
    'Espírito Santo','Goiás','Maranhão','Mato Grosso','Mato Grosso do Sul',
    'Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí',
    'Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia',
    'Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins',
  ],
  'United Arab Emirates': [
    'Abu Dhabi','Ajman','Dubai','Fujairah','Ras Al Khaimah','Sharjah','Umm Al Quwain',
  ],
  'Saudi Arabia': [
    'Al Bahah','Al Jawf','Al Madinah','Al Qassim','Asir','Eastern Province',
    'Hail','Jizan','Makkah','Najran','Riyadh','Tabuk',
  ],
  Qatar: ['Ad Dawhah','Al Khor','Al Rayyan','Al Wakrah','Ash Shamal','Az Za\'ayin','Umm Salal'],
};

// All country names used in the dropdown, so we can match against geo detection
const DROPDOWN_COUNTRIES = [
  'Nigeria','Ghana','Kenya','South Africa','Egypt','Senegal','Ivory Coast',
  'Tanzania','Ethiopia','Uganda','Rwanda','Cameroon',
  'United States','United Kingdom','Canada','Australia','New Zealand',
  'Germany','France','Netherlands','Sweden','Norway','Denmark','Ireland',
  'Spain','Italy','Portugal','Belgium','Switzerland','Austria',
  'United Arab Emirates','Saudi Arabia','Qatar',
  'Brazil','Jamaica','Trinidad and Tobago','Barbados',
  'India','China','Japan','Singapore',
];

// Map ipapi.co country_name variants → our dropdown value
const COUNTRY_NAME_MAP: Record<string, string> = {
  'United States of America': 'United States',
  'USA': 'United States',
  'UK': 'United Kingdom',
  'Great Britain': 'United Kingdom',
  "Côte d'Ivoire": 'Ivory Coast',
  'Cote d\'Ivoire': 'Ivory Coast',
  'South Korea': 'South Korea',
  'UAE': 'United Arab Emirates',
};

function detectCountryFromGeo(): string {
  try {
    const raw = localStorage.getItem('afrolandx_geo_v2');
    if (!raw) return 'Nigeria';
    const { data } = JSON.parse(raw);
    const name: string = data?.country_name || '';
    if (!name) return 'Nigeria';
    const mapped = COUNTRY_NAME_MAP[name] || name;
    return DROPDOWN_COUNTRIES.includes(mapped) ? mapped : 'Nigeria';
  } catch {
    return 'Nigeria';
  }
}

export default function Checkout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { cartItems, cartTotal, clearCart } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currencyInfo, formatLocal } = useCurrency();

  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: detectCountryFromGeo(),
  });

  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [paymentMethod] = useState('paystack'); // Only Paystack for now
  const [countryTouched, setCountryTouched] = useState(false);

  // If geo cache was empty on mount, fetch it now and update country
  useEffect(() => {
    if (countryTouched) return;
    const raw = localStorage.getItem('afrolandx_geo_v2');
    if (raw) return; // already have cache, detectCountryFromGeo() handled it
    fetch('/api/geo', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || data.local || data.error) return;
        // Cache it for useCurrency too
        try { localStorage.setItem('afrolandx_geo_v2', JSON.stringify({ data, ts: Date.now() })); } catch {}
        const name: string = data.country_name || '';
        const mapped = COUNTRY_NAME_MAP[name] || name;
        const country = DROPDOWN_COUNTRIES.includes(mapped) ? mapped : null;
        if (country) setShippingAddress(prev => ({ ...prev, country, state: '' }));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show error/cancelled message if Paystack redirected back with an error
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const cancelled = params.get('cancelled');
    if (cancelled) {
      toast({
        title: 'Payment Cancelled',
        description: 'Your payment was cancelled. Your cart is still saved — complete your order when ready.',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      toast({
        title: 'Payment Failed',
        description: decodeURIComponent(error) || 'Something went wrong with your payment. Please try again.',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Fetch shipping quotes — pass buyer's local currency so the API returns localPrice
  const { data: shippingQuotes = [], isLoading: isLoadingShipping } = useQuery<ShippingQuote[]>({
    queryKey: ['/api/shipping/quote', currencyInfo?.code, currencyInfo?.rate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currencyInfo) {
        params.set('currency', currencyInfo.code);
        params.set('rate', String(currencyInfo.rate));
        params.set('symbol', currencyInfo.symbol);
      }
      const res = await fetch(`/api/shipping/quote?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch shipping quotes');
      return res.json();
    },
    enabled: !!cartItems.length,
    retry: false,
  });

  // Auto-select the cheapest (first) shipping option when quotes load
  useEffect(() => {
    if (shippingQuotes.length > 0 && !selectedShipping) {
      setSelectedShipping(shippingQuotes[0].carrier);
    }
  }, [shippingQuotes, selectedShipping]);

  // Create order mutation with Paystack integration
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      try {
        const response = await apiRequest('POST', '/api/orders/initialize-payment', orderData);
        return response.json();
      } catch (error: any) {
        // Only fall back to direct order creation if Paystack is not configured (503)
        // For all other errors (500 = payment failure), surface the error to the user
        if (error?.message?.startsWith('503')) {
          const response = await apiRequest('POST', '/api/orders', orderData);
          return response.json();
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.paymentUrl) {
        toast({
          title: 'Redirecting to Payment',
          description: 'You will be redirected to Paystack to complete your payment...',
        });
        localStorage.setItem('pending_payment_reference', result.reference);
        window.location.href = result.paymentUrl;
      } else {
        // Paystack not configured — direct order creation
        toast({
          title: 'Order Placed!',
          description: `Order #${result.id} has been created. Our team will contact you to arrange payment.`,
        });
        clearCart();
        setTimeout(() => { window.location.href = '/my-orders'; }, 1500);
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
      const msg = (error as any)?.message || '';
      toast({
        title: 'Payment Failed',
        description: msg.includes('500')
          ? 'We could not process your payment. Please try again or contact support.'
          : 'Something went wrong. Please try again.',
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

    const usdTotal = cartTotal + selectedQuote.price;
    const currency = currencyInfo?.code || 'USD';
    const localTotal = currencyInfo ? usdTotal * currencyInfo.rate : null;

    const orderData = {
      totalAmount: usdTotal.toString(),
      shippingAmount: selectedQuote.price.toString(),
      shippingAddress,
      shippingMethod: selectedShipping.toLowerCase(),
      paymentMethod,
      currency,
      localAmount: localTotal !== null ? localTotal.toFixed(2) : undefined,
    };

    createOrderMutation.mutate(orderData);
  };

  // Format price in local currency (primary) with USD fallback
  const formatPrice = (usdAmount: number) => {
    if (currencyInfo) {
      const local = usdAmount * currencyInfo.rate;
      const formatted = local >= 1000
        ? local.toLocaleString(undefined, { maximumFractionDigits: 0 })
        : local.toLocaleString(undefined, { maximumFractionDigits: 2 });
      return `${currencyInfo.symbol}${formatted}`;
    }
    return `$${usdAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Show USD as small secondary label
  const formatUsdSub = (usdAmount: number) => `≈ $${usdAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const selectedShippingQuote = shippingQuotes.find(q => q.carrier === selectedShipping);
  const totalAmount = cartTotal + (selectedShippingQuote?.price || 0);
  const isNativeCurrency = currencyInfo && PAYSTACK_SUPPORTED.has(currencyInfo.code);

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
                      <Label htmlFor="state">
                        {shippingAddress.country === 'Canada' ? 'Province / Territory'
                          : shippingAddress.country === 'United Kingdom' ? 'Country / Region'
                          : shippingAddress.country === 'Australia' ? 'State / Territory'
                          : 'State / Region'}
                      </Label>
                      {STATES_BY_COUNTRY[shippingAddress.country] ? (
                        <Select
                          value={shippingAddress.state}
                          onValueChange={(value) => setShippingAddress(prev => ({ ...prev, state: value }))}
                          required
                        >
                          <SelectTrigger className="input-nigerian">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {STATES_BY_COUNTRY[shippingAddress.country].map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="state"
                          value={shippingAddress.state}
                          onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                          placeholder="State / Region"
                          className="input-nigerian"
                        />
                      )}
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
                      onValueChange={(value) => { setCountryTouched(true); setShippingAddress(prev => ({ ...prev, country: value, state: '' })); }}
                    >
                      <SelectTrigger className="input-nigerian">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="Nigeria">🇳🇬 Nigeria</SelectItem>
                        <SelectItem value="Ghana">🇬🇭 Ghana</SelectItem>
                        <SelectItem value="Kenya">🇰🇪 Kenya</SelectItem>
                        <SelectItem value="South Africa">🇿🇦 South Africa</SelectItem>
                        <SelectItem value="Egypt">🇪🇬 Egypt</SelectItem>
                        <SelectItem value="Senegal">🇸🇳 Senegal</SelectItem>
                        <SelectItem value="Ivory Coast">🇨🇮 Ivory Coast</SelectItem>
                        <SelectItem value="Tanzania">🇹🇿 Tanzania</SelectItem>
                        <SelectItem value="Ethiopia">🇪🇹 Ethiopia</SelectItem>
                        <SelectItem value="Uganda">🇺🇬 Uganda</SelectItem>
                        <SelectItem value="Rwanda">🇷🇼 Rwanda</SelectItem>
                        <SelectItem value="Cameroon">🇨🇲 Cameroon</SelectItem>
                        <SelectItem value="United States">🇺🇸 United States</SelectItem>
                        <SelectItem value="United Kingdom">🇬🇧 United Kingdom</SelectItem>
                        <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                        <SelectItem value="Australia">🇦🇺 Australia</SelectItem>
                        <SelectItem value="New Zealand">🇳🇿 New Zealand</SelectItem>
                        <SelectItem value="Germany">🇩🇪 Germany</SelectItem>
                        <SelectItem value="France">🇫🇷 France</SelectItem>
                        <SelectItem value="Netherlands">🇳🇱 Netherlands</SelectItem>
                        <SelectItem value="Sweden">🇸🇪 Sweden</SelectItem>
                        <SelectItem value="Norway">🇳🇴 Norway</SelectItem>
                        <SelectItem value="Denmark">🇩🇰 Denmark</SelectItem>
                        <SelectItem value="Ireland">🇮🇪 Ireland</SelectItem>
                        <SelectItem value="Spain">🇪🇸 Spain</SelectItem>
                        <SelectItem value="Italy">🇮🇹 Italy</SelectItem>
                        <SelectItem value="Portugal">🇵🇹 Portugal</SelectItem>
                        <SelectItem value="Belgium">🇧🇪 Belgium</SelectItem>
                        <SelectItem value="Switzerland">🇨🇭 Switzerland</SelectItem>
                        <SelectItem value="Austria">🇦🇹 Austria</SelectItem>
                        <SelectItem value="United Arab Emirates">🇦🇪 United Arab Emirates</SelectItem>
                        <SelectItem value="Saudi Arabia">🇸🇦 Saudi Arabia</SelectItem>
                        <SelectItem value="Qatar">🇶🇦 Qatar</SelectItem>
                        <SelectItem value="Brazil">🇧🇷 Brazil</SelectItem>
                        <SelectItem value="Jamaica">🇯🇲 Jamaica</SelectItem>
                        <SelectItem value="Trinidad and Tobago">🇹🇹 Trinidad and Tobago</SelectItem>
                        <SelectItem value="Barbados">🇧🇧 Barbados</SelectItem>
                        <SelectItem value="India">🇮🇳 India</SelectItem>
                        <SelectItem value="China">🇨🇳 China</SelectItem>
                        <SelectItem value="Japan">🇯🇵 Japan</SelectItem>
                        <SelectItem value="Singapore">🇸🇬 Singapore</SelectItem>
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
                                <div className="text-right">
                                  {quote.localPrice && quote.localSymbol ? (
                                    <>
                                      <span className="font-bold text-nigerian-green">
                                        {quote.localSymbol}{quote.localPrice.toLocaleString()}
                                      </span>
                                      <span className="block text-xs text-gray-400">≈ ${quote.price.toFixed(2)}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-bold text-nigerian-green">{formatPrice(quote.price)}</span>
                                      {currencyInfo && <span className="block text-xs text-gray-400">{formatUsdSub(quote.price)}</span>}
                                    </>
                                  )}
                                </div>
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
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=100&h=100&q=75'; }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-nigerian-green to-nigerian-gold rounded"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{item.product.name}</p>
                          <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-sm">{formatPrice(parseFloat(item.product.price) * item.quantity)}</span>
                          {currencyInfo && <span className="block text-xs text-gray-400">{formatUsdSub(parseFloat(item.product.price) * item.quantity)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Currency indicator */}
                  {currencyInfo && (
                    <div className={`text-xs px-3 py-2 rounded-md flex items-center gap-2 ${isNativeCurrency ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      <span>{isNativeCurrency ? '✓' : 'ℹ'}</span>
                      <span>
                        {isNativeCurrency
                          ? `Charging in ${currencyInfo.code} (${currencyInfo.country})`
                          : `${currencyInfo.code} not supported by Paystack — charging in USD`}
                      </span>
                    </div>
                  )}

                  {/* Pricing Breakdown */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <div className="text-right">
                        <span className="font-medium">{formatPrice(cartTotal)}</span>
                        {currencyInfo && <span className="block text-xs text-gray-400">{formatUsdSub(cartTotal)}</span>}
                      </div>
                    </div>
                    
                    {selectedShippingQuote && (
                      <div className="flex justify-between text-sm">
                        <span>Shipping ({selectedShippingQuote.carrier})</span>
                        <div className="text-right">
                          {selectedShippingQuote.localPrice && selectedShippingQuote.localSymbol ? (
                            <>
                              <span className="font-medium">{selectedShippingQuote.localSymbol}{selectedShippingQuote.localPrice.toLocaleString()}</span>
                              <span className="block text-xs text-gray-400">≈ ${selectedShippingQuote.price.toFixed(2)}</span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium">{formatPrice(selectedShippingQuote.price)}</span>
                              {currencyInfo && <span className="block text-xs text-gray-400">{formatUsdSub(selectedShippingQuote.price)}</span>}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <Separator />
                    
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <div className="text-right">
                        <span className="text-nigerian-green">{formatPrice(totalAmount)}</span>
                        {currencyInfo && <span className="block text-xs text-gray-400 font-normal">{formatUsdSub(totalAmount)}</span>}
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
                        Pay {formatPrice(totalAmount)}
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
