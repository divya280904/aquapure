
/**
 * AquaPure API Configuration
 * Supports environment overrides via EXPO_PUBLIC_API_URL or defaults to deployed Render backend.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "https://aquapure-payment-api.onrender.com";
