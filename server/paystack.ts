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

export class PaystackRequestError extends Error {
  constructor(message: string, public readonly ambiguous: boolean) {
    super(message);
    this.name = 'PaystackRequestError';
  }
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

    let response: Response;
    try {
      response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
    } catch (error) {
      throw new PaystackRequestError(
        error instanceof Error ? `Paystack request outcome is unknown: ${error.message}` : 'Paystack request outcome is unknown',
        true,
      );
    }
    const responseText = await response.text();
    let result: any;
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new PaystackRequestError(`Paystack returned an invalid response (${response.status})`, response.ok);
    }
    
    if (!response.ok) {
      const ambiguous = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new PaystackRequestError(typeof result.message === 'string' ? result.message : 'Paystack API error', ambiguous);
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
    currency: string = 'NGN'
  ): Promise<PaystackInitializeResponse> {
    const chargeCurrency = PaystackService.SUPPORTED_CURRENCIES.has(currency) ? currency : 'NGN';
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be positive');
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(reference)) throw new Error('Invalid payment reference');

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
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(reference)) throw new Error('Invalid payment reference');
    return await this.makeRequest(`/transaction/verify/${reference}`);
  }

  async createRefund(reference: string, amount: number, merchantNote: string): Promise<any> {
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(reference)) throw new Error('Invalid payment reference');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Refund amount must be positive');
    return await this.makeRequest('/refund', 'POST', {
      transaction: reference,
      amount: Math.round(amount * 100),
      currency: 'NGN',
      merchant_note: merchantNote,
    });
  }

  async findRefund(reference: string, amount: number, merchantReference?: string): Promise<any | undefined> {
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(reference)) throw new Error('Invalid payment reference');
    const result = await this.makeRequest(`/refund?transaction=${encodeURIComponent(reference)}`);
    const refunds = Array.isArray(result?.data) ? result.data : [];
    const expectedKobo = Math.round(amount * 100);
    return refunds.find((refund: any) =>
      Number(refund?.amount) === expectedKobo
      && (!refund?.currency || refund.currency === 'NGN')
      && (!merchantReference || String(refund?.merchant_note || refund?.merchantNote || '').includes(merchantReference))
    );
  }

  async listBanks(): Promise<any[]> {
    const result = await this.makeRequest('/bank?country=nigeria&currency=NGN&perPage=100');
    return Array.isArray(result?.data) ? result.data : [];
  }

  async resolveBankAccount(accountNumber: string, bankCode: string): Promise<{ account_name: string; account_number: string }> {
    if (!/^\d{10}$/.test(accountNumber)) throw new Error('Nigerian bank account number must contain 10 digits');
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(bankCode)) throw new Error('Invalid bank code');
    const result = await this.makeRequest(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
    if (!result?.status || !result?.data?.account_name) throw new Error('Paystack could not verify this bank account');
    return result.data;
  }

  async createTransferRecipient(name: string, accountNumber: string, bankCode: string): Promise<any> {
    const result = await this.makeRequest('/transferrecipient', 'POST', {
      type: 'nuban',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
    });
    if (!result?.status || !result?.data?.recipient_code) throw new Error('Paystack could not create a payout recipient');
    return result.data;
  }

  async initiateTransfer(amount: number, recipientCode: string, reference: string, reason: string): Promise<any> {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Transfer amount must be positive');
    const result = await this.makeRequest('/transfer', 'POST', {
      source: 'balance',
      amount: Math.round(amount * 100),
      recipient: recipientCode,
      reference,
      reason,
      currency: 'NGN',
    });
    if (!result?.status || !result?.data?.transfer_code) throw new Error(result?.message || 'Paystack could not initiate the transfer');
    return result.data;
  }

  async verifyTransfer(reference: string): Promise<any> {
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(reference)) throw new Error('Invalid transfer reference');
    const result = await this.makeRequest(`/transfer/verify/${encodeURIComponent(reference)}`);
    if (!result?.status || !result?.data) throw new Error('Paystack could not verify the transfer');
    return result.data;
  }

  async finalizeTransfer(transferCode: string, otp: string): Promise<any> {
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(transferCode)) throw new Error('Invalid transfer code');
    if (!/^\d{6}$/.test(otp)) throw new Error('Transfer OTP must contain 6 digits');
    const result = await this.makeRequest('/transfer/finalize_transfer', 'POST', {
      transfer_code: transferCode,
      otp,
    });
    if (!result?.status || !result?.data) throw new Error('Paystack could not finalize the transfer');
    return result.data;
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