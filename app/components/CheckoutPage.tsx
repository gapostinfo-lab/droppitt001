// ✅ Put this near the top of CheckoutPage.tsx (inside the component is fine)
const getApiBase = () => {
  const raw = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;

  // Always have a safe fallback (works on Vercel + local)
  const fallback = window.location.origin;

  if (!raw || !raw.trim()) {
    return fallback;
  }

  const trimmed = raw.trim();

  // If someone set "droppit.vercel.app" (no scheme), fix it
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }

  return trimmed;
};

const apiBase = getApiBase();

// ✅ Always build URLs like this (prevents Safari “pattern” error)
const paymentIntentUrl = new URL("/api/create-payment-intent", apiBase).toString();

// (Optional but recommended during testing)
// console.log("apiBase:", apiBase);
// console.log("paymentIntentUrl:", paymentIntentUrl);
