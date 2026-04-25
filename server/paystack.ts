interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: any;
    fees: number;
    customer: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      customer_code: string;
      phone: string;
      metadata: any;
      risk_action: string;
    };
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
    };
    plan: any;
  };
}

export class PaystackService {
  private baseURL = 'https://api.paystack.co';
  
  constructor(private secretKey: string) {
    if (!secretKey) {
      throw new Error('Paystack secret key is required');
    }
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any) {
    const url = `${this.baseURL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (data && method === 'POST') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Paystack API error');
    }

    return result;
  }

  // Currencies Paystack can charge in natively
  static readonly SUPPORTED_CURRENCIES = new Set([
    'NGN', 'GHS', 'ZAR', 'KES', 'USD', 'GBP', 'EUR', 'EGP', 'XOF'
  ]);

  async initializeTransaction(
    email: string,
    amount: number,
    reference: string,
    metadata?: any,
    callbackUrl?: string,
    currency: string = 'USD'
  ): Promise<PaystackInitializeResponse> {
    const chargeCurrency = PaystackService.SUPPORTED_CURRENCIES.has(currency) ? currency : 'USD';

    const payload: any = {
      email,
      amount: Math.round(amount * 100), // smallest denomination (kobo/pesewa/cents etc.)
      reference,
      currency: chargeCurrency,
      metadata,
    };

    if (callbackUrl) {
      payload.callback_url = callbackUrl;
    }

    return await this.makeRequest('/transaction/initialize', 'POST', payload);
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    return await this.makeRequest(`/transaction/verify/${reference}`);
  }
}

// Export singleton instance (will be initialized when secret key is provided)
let paystackService: PaystackService | null = null;

export function initializePaystack(secretKey: string): void {
  paystackService = new PaystackService(secretKey);
}

export function getPaystackService(): PaystackService {
  if (!paystackService) {
    throw new Error('Paystack service not initialized. Please provide secret key.');
  }
  return paystackService;
}

export function isPaystackInitialized(): boolean {
  return paystackService !== null;
}