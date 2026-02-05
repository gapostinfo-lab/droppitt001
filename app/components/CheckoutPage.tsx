// app/components/CheckoutPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { ArrowLeft, Shield, Loader2, CheckCircle2 } from "lucide-react";

// OPTIONAL: if your project has these types, keep them.
// If it doesn't, you can safely remove this import and the Booking type usage below.
import type { Booking } from "../types";

/**
 * ✅ This component is designed to work even if your "bookingDraft" + "amountCents"
 * are passed in different ways.
 *
 * It tries, in order:
 *  1) props.bookingDraft / props.amountCents
 *  2) sessionStorage keys:
 *       - "droppit_checkout_booking"
 *       - "droppit_checkout_amount_cents"
 *
 * So you do NOT need to change other files if you already store it in sessionStorage.
 */

type CheckoutPageProps = {
  bookingDraft?: Booking | any;
  amountCents?: number;
  onBack?: () => void;
  onSuccess?: (result: { paymentIntentId: string; bookingId?: string }) => void;
};

// ✅ Safari + Vercel safe API base builder
const getApiBase = () => {
  const raw = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;

  const fallback =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://droppit.vercel.app";

  if (!raw || !raw.trim()) return fallback;

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

const publishableKey =
  ((import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ||
  ((import.meta as any).env?.VITE_STRIPE_PUBLIC_KEY as string | undefined) ||
  "";

const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function formatMoney(amountCents: number) {
  const dollars = amountCents / 100;
  return dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function safeReadSession<T>(key: string): T | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveSession(key: string, value: any) {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

const CheckoutInner: React.FC<{
  bookingDraft: any;
  amountCents: number;
  onBack?: () => void;
  onSuccess?: (result: { paymentIntentId: string; bookingId?: string }) => void;
  clientSecret: string;
}> = ({ bookingDraft, amountCents, onBack, onSuccess, clientSecret }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const bookingTitle = useMemo(() => {
    const carrier = bookingDraft?.carrier || "Carrier";
    const dropName = bookingDraft?.dropoff_name || bookingDraft?.dropoffName || "Drop-off";
    const pickup = bookingDraft?.pickup_address || bookingDraft?.pickupAddress || "";
    return {
      line1: `${carrier} • ${String(dropName).toUpperCase()}`,
      line2: pickup ? `Pickup: ${pickup}` : "",
    };
  }, [bookingDraft]);

  const handlePay = async () => {
    setMessage(null);

    if (!stripe || !elements) {
      setMessage("Stripe is still loading. Try again in a moment.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit element validation (required)
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setMessage(submitError.message || "Please check your payment details.");
        setIsSubmitting(false);
        return;
      }

      /**
       * ✅ IMPORTANT:
       * - If you're using LIVE Stripe keys, you must use a REAL card.
       * - Test cards (4242...) will fail with “A processing error occurred.”
       */
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          // You can add a return_url if you want redirect flows:
          // return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        setMessage(error.message || "Payment failed. Please try again.");
        setIsSubmitting(false);
        return;
      }

      if (!paymentIntent) {
        setMessage("Payment did not complete. Please try again.");
        setIsSubmitting(false);
        return;
      }

      if (paymentIntent.status === "succeeded") {
        setSuccess(true);
        setIsSubmitting(false);

        // Optional callback for your app
        onSuccess?.({
          paymentIntentId: paymentIntent.id,
          bookingId: bookingDraft?.id,
        });
        return;
      }

      // handle other statuses
      if (paymentIntent.status === "processing") {
        setMessage("Payment is processing. Refresh in a moment to confirm.");
      } else if (paymentIntent.status === "requires_payment_method") {
        setMessage("Payment was not accepted. Try another card.");
      } else {
        setMessage(`Payment status: ${paymentIntent.status}`);
      }

      setIsSubmitting(false);
    } catch (e: any) {
      setMessage(e?.message || "Unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-inter">
      <div className="p-8 flex items-center justify-between border-b border-slate-900/50 sticky top-0 z-50 backdrop-blur-md">
        <button
          onClick={onBack}
          className="p-2 text-slate-500 hover:text-white transition-colors"
          aria-label="Back"
        >
          <ArrowLeft />
        </button>

        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
            Secure Checkout
          </div>
          <div className="text-xl font-black italic tracking-tighter">
            {formatMoney(amountCents)}
          </div>
        </div>

        <div className="w-8" />
      </div>

      <div className="max-w-lg mx-auto px-6 py-10 space-y-6">
        <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900/30 p-7 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
              <Shield className="text-lime-400" size={18} />
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              Booking Summary
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-black italic uppercase tracking-tighter text-white">
              {bookingTitle.line1}
            </div>
            {bookingTitle.line2 ? (
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {bookingTitle.line2}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900/30 p-7 shadow-2xl">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <CheckCircle2 className="text-lime-400" size={44} />
              <div className="text-center">
                <div className="text-2xl font-black italic tracking-tighter">Paid</div>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500 mt-1">
                  Payment confirmed
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                  Card Details
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 shadow-inner">
                <PaymentElement
                  options={{
                    layout: "tabs",
                  }}
                />
              </div>

              {message ? (
                <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300 mb-1">
                    Payment Error
                  </div>
                  <div className="text-red-100">{message}</div>
                </div>
              ) : null}

              <button
                onClick={handlePay}
                disabled={isSubmitting || !stripe || !elements}
                className="mt-6 w-full bg-lime-400 text-slate-950 font-black py-6 rounded-[2.5rem] uppercase italic tracking-tighter text-lg active:scale-[0.99] shadow-2xl shadow-lime-400/20 disabled:opacity-40 transition-all"
              >
                <div className="flex items-center justify-center gap-3">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Processing…</span>
                    </>
                  ) : (
                    <span>Pay {formatMoney(amountCents)}</span>
                  )}
                </div>
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 opacity-50">
                <Shield size={10} className="text-lime-400" />
                <p className="text-[7px] text-slate-500 font-black uppercase tracking-[0.4em] italic">
                  Encrypted Secure Transaction
                </p>
              </div>

              <div className="mt-3 text-[10px] text-slate-500 leading-relaxed">
                <span className="font-bold text-slate-300">Live vs Test:</span>{" "}
                If you’re using <span className="font-bold">LIVE</span> Stripe keys,
                <span className="font-bold"> test cards (4242…)</span> will fail with
                “A processing error occurred.” Use a real card.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const CheckoutPage: React.FC<CheckoutPageProps> = (props) => {
  const [clientSecret, setClientSecret] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);

  // ✅ Booking + Amount fallbacks (props -> sessionStorage)
  const bookingDraft = useMemo(() => {
    return (
      props.bookingDraft ??
      safeReadSession<any>("droppit_checkout_booking") ??
      null
    );
  }, [props.bookingDraft]);

  const amountCents = useMemo(() => {
    const fromProps = props.amountCents;
    const fromSession = safeReadSession<number>("droppit_checkout_amount_cents");
    return (typeof fromProps === "number" ? fromProps : fromSession) ?? null;
  }, [props.amountCents]);

  // Save props into session (so refresh won't lose it)
  useEffect(() => {
    if (bookingDraft) saveSession("droppit_checkout_booking", bookingDraft);
    if (typeof amountCents === "number")
      saveSession("droppit_checkout_amount_cents", amountCents);
  }, [bookingDraft, amountCents]);

  useEffect(() => {
    const run = async () => {
      try {
        setFatal(null);

        if (!stripePromise) {
          setFatal(
            "Missing Stripe publishable key. Set VITE_STRIPE_PUBLISHABLE_KEY in Vercel Environment Variables."
          );
          setLoading(false);
          return;
        }

        if (!bookingDraft || typeof amountCents !== "number") {
          setFatal(
            "Missing checkout data (bookingDraft / amount). Go back and click “Continue to Payment” again."
          );
          setLoading(false);
          return;
        }

        setLoading(true);

        const res = await fetch(paymentIntentUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents,
            currency: "usd",
            bookingDraft,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `PaymentIntent API failed (${res.status}). ${text || ""}`.trim()
          );
        }

        const data = await res.json();

        if (!data?.clientSecret) {
          throw new Error("API did not return clientSecret.");
        }

        setClientSecret(data.clientSecret);
        setLoading(false);
      } catch (e: any) {
        setFatal(e?.message || "Failed to start checkout.");
        setLoading(false);
      }
    };

    run();
  }, [amountCents, bookingDraft]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-10">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-lime-400 animate-spin" />
          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">
            Preparing checkout…
          </div>
        </div>
      </div>
    );
  }

  if (fatal) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-10">
        <div className="max-w-md w-full rounded-[2.5rem] border border-red-500/30 bg-red-500/10 p-7">
          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-red-300 mb-2">
            Checkout Error
          </div>
          <div className="text-red-100 mb-5">{fatal}</div>

          <button
            onClick={props.onBack}
            className="w-full bg-slate-900 border border-slate-800 text-white font-black py-4 rounded-2xl uppercase italic tracking-tighter"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Stripe Elements options
  const options = {
    clientSecret,
    appearance: {
      theme: "night" as const,
      variables: {
        colorPrimary: "#a3e635",
        colorBackground: "#020617",
        colorText: "#f8fafc",
        colorDanger: "#ef4444",
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      },
    },
  };

  return (
    <Elements stripe={stripePromise!} options={options}>
      <CheckoutInner
        bookingDraft={bookingDraft}
        amountCents={amountCents as number}
        onBack={props.onBack}
        onSuccess={props.onSuccess}
        clientSecret={clientSecret}
      />
    </Elements>
  );
};

export default CheckoutPage;
