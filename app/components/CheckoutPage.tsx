import React, { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { ChevronLeft, Loader2, ShieldCheck } from "lucide-react";
import type { Booking } from "../types";

type Props = {
  bookingDraft: Booking;
  amountCents: number;
  onBack: () => void;
  onPaid: (paidBooking: Booking) => void;
};

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export const CheckoutPage: React.FC<Props> = ({
  bookingDraft,
  amountCents,
  onBack,
  onPaid,
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const dollars = useMemo(() => (amountCents / 100).toFixed(2), [amountCents]);

  useEffect(() => {
    let mounted = true;

    async function createIntent() {
      try {
        setLoading(true);
        setErr(null);

        const resp = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amountCents,
            currency: "usd",
            metadata: {
              booking_id: bookingDraft.id,
              carrier: bookingDraft.carrier,
              customer_id: bookingDraft.customer_id,
            },
          }),
        });

        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Failed to create payment");

        if (mounted) setClientSecret(json.clientSecret);
      } catch (e: any) {
        if (mounted) setErr(e?.message || "Payment setup failed");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    createIntent();
    return () => {
      mounted = false;
    };
  }, [amountCents, bookingDraft]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-inter">
      <div className="p-6 flex items-center justify-between border-b border-slate-900/50 sticky top-0 z-40 backdrop-blur">
        <button
          onClick={onBack}
          className="p-2 text-slate-500 hover:text-white transition-colors"
        >
          <ChevronLeft />
        </button>
        <div className="text-center">
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic">
            Secure Checkout
          </p>
          <p className="text-white font-black uppercase italic tracking-tighter">
            ${dollars}
          </p>
        </div>
        <div className="w-10" />
      </div>

      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="bg-slate-900 border border-lime-400/20 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="text-lime-400" size={18} />
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic">
              Booking Summary
            </p>
          </div>
          <p className="text-white font-black italic uppercase tracking-tighter">
            {bookingDraft.carrier} • {bookingDraft.dropoff_name}
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic mt-1">
            Pickup: {bookingDraft.pickup_address}
          </p>
        </div>

        {loading && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-10 flex items-center justify-center gap-3">
            <Loader2 className="animate-spin text-lime-400" />
            <span className="text-slate-400 font-bold">Preparing payment…</span>
          </div>
        )}

        {err && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-5">
            <p className="text-red-400 font-black uppercase text-[10px] tracking-widest italic">
              Payment error
            </p>
            <p className="text-red-200 text-sm mt-2">{err}</p>
          </div>
        )}

        {clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: { theme: "night" },
            }}
          >
            <CheckoutForm
              amountLabel={dollars}
              bookingDraft={bookingDraft}
              onPaid={onPaid}
            />
          </Elements>
        )}
      </div>
    </div>
  );
};

const CheckoutForm: React.FC<{
  amountLabel: string;
  bookingDraft: Booking;
  onPaid: (paidBooking: Booking) => void;
}> = ({ amountLabel, bookingDraft, onPaid }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function pay() {
    try {
      setSubmitting(true);
      setMessage(null);

      if (!stripe || !elements) return;

      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (result.error) {
        setMessage(result.error.message || "Payment failed");
        return;
      }

      if (result.paymentIntent?.status === "succeeded") {
        onPaid({
          ...bookingDraft,
          paid: true as any, // harmless if your Booking type doesn't include it
          updated_at: new Date().toISOString(),
        });
        return;
      }

      setMessage(`Payment status: ${result.paymentIntent?.status || "unknown"}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
      <PaymentElement />

      {message && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4">
          <p className="text-orange-200 text-sm">{message}</p>
        </div>
      )}

      <button
        onClick={pay}
        disabled={!stripe || !elements || submitting}
        className="w-full bg-lime-400 text-slate-950 font-black py-5 rounded-2xl uppercase italic tracking-tighter disabled:opacity-30 active:scale-95 transition-all"
      >
        {submitting ? "Processing…" : `Pay $${amountLabel}`}
      </button>

      <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest italic text-center">
        Live card form • encrypted by Stripe
      </p>
    </div>
  );
};
