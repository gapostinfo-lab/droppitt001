import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';

type CheckoutPageProps = {
  bookingDraft: any | null;
  amountCents: number;
  onBack: () => void;
  onPaymentSuccess: (paidBooking: any) => void;
  disabled?: boolean;
};

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

async function createPaymentIntent(amountCents: number, metadata?: Record<string, string>) {
  const res = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents, metadata }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || 'Failed to create payment intent');
  }

  return res.json() as Promise<{ clientSecret: string }>;
}

const CheckoutInner: React.FC<{
  bookingDraft: any;
  amountCents: number;
  onBack: () => void;
  onPaymentSuccess: (paidBooking: any) => void;
}> = ({ bookingDraft, amountCents, onBack, onPaymentSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePay = async () => {
    setErrorMsg(null);
    if (!stripe || !elements) return;

    setSubmitting(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // We are not redirecting; we’ll stay on-page.
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMsg(error.message || 'Payment failed.');
        setSubmitting(false);
        return;
      }

      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        setErrorMsg('Payment did not succeed. Please try again.');
        setSubmitting(false);
        return;
      }

      // Build the final booking we will store
      const paidBooking = {
        ...bookingDraft,
        paid: true,
        paid_at: new Date().toISOString(),
        payment_intent_id: paymentIntent.id,
        price_total: (amountCents / 100),
        status: bookingDraft.status || 'booked',
        updated_at: new Date().toISOString(),
      };

      onPaymentSuccess(paidBooking);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Payment error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-slate-100 p-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-black uppercase italic tracking-tighter">
          Checkout
        </h1>
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-lime-400 font-bold"
        >
          Back
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black italic">
            Total
          </span>
          <span className="text-white font-black italic">
            ${(amountCents / 100).toFixed(2)}
          </span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <PaymentElement />
        </div>

        {errorMsg && (
          <div className="text-red-400 text-xs font-bold">{errorMsg}</div>
        )}

        <button
          disabled={!stripe || !elements || submitting}
          onClick={handlePay}
          className="w-full bg-lime-400 text-slate-950 font-black py-4 rounded-2xl uppercase italic tracking-tighter disabled:opacity-30 active:scale-95 transition-all"
        >
          {submitting ? 'Processing…' : 'Pay Now'}
        </button>

        <p className="text-[10px] text-slate-500 leading-snug">
          Your card is processed securely by Stripe.
        </p>
      </div>
    </div>
  );
};

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  bookingDraft,
  amountCents,
  onBack,
  onPaymentSuccess,
  disabled,
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canLoad = useMemo(() => {
    return !disabled && !!bookingDraft && amountCents > 0;
  }, [disabled, bookingDraft, amountCents]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setErrorMsg(null);
        setClientSecret(null);

        if (!canLoad) return;

        const metadata: Record<string, string> = {
          booking_id: bookingDraft?.id || '',
          customer_id: bookingDraft?.customer_id || '',
        };

        const data = await createPaymentIntent(amountCents, metadata);
        if (!mounted) return;

        setClientSecret(data.clientSecret);
      } catch (e: any) {
        if (!mounted) return;
        setErrorMsg(e?.message || 'Unable to start checkout.');
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [canLoad, amountCents, bookingDraft]);

  if (!canLoad) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <p className="text-slate-400 text-sm">
            Checkout is not ready. Go back and try again.
          </p>
          <button
            onClick={onBack}
            className="mt-4 w-full bg-slate-800 text-white font-black py-3 rounded-2xl uppercase italic"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <p className="text-red-400 text-sm font-bold">{errorMsg}</p>
          <button
            onClick={onBack}
            className="mt-4 w-full bg-slate-800 text-white font-black py-3 rounded-2xl uppercase italic"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-lime-400"></div>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: 'night' },
      }}
    >
      <CheckoutInner
        bookingDraft={bookingDraft}
        amountCents={amountCents}
        onBack={onBack}
        onPaymentSuccess={onPaymentSuccess}
      />
    </Elements>
  );
};

export default CheckoutPage;
