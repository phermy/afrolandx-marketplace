export const shippingProviderPriority = ["shipbubble", "terminal_africa"] as const;
export type ShippingProviderId = typeof shippingProviderPriority[number];
export type ShippingProviderStatus =
  | "connected" | "missing_key" | "test_mode" | "unauthorized"
  | "unavailable" | "timeout" | "invalid_response" | "no_carriers";

export type ShippingCourierConnection = {
  name: string;
  domestic: boolean;
  international: boolean;
};

export type ShippingProviderConnection = {
  id: ShippingProviderId;
  name: string;
  role: "primary" | "backup";
  status: ShippingProviderStatus;
  message: string;
  checkedAt: string;
  couriers: ShippingCourierConnection[];
};

export type ShippingProviderConnections = {
  primary: "shipbubble";
  backup: "terminal_africa";
  activeProvider: ShippingProviderId | null;
  usingBackup: boolean;
  manualRequired: boolean;
  automaticBookings: false;
  scope: "carrier_connections";
  providers: ShippingProviderConnection[];
};
