import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string
);

type CheckoutPageProps = {
  amountCents: number;
  onSuccess?: () => void;
};

function CheckoutForm({ amountCents, onSuccess }: CheckoutPageProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountCents }),
    })
      .then(res => res.json())
      .then(data => setClientSecret(data.clientSecret))
      .catch(() => setError('Failed to initialize payment'));
  }, [amountCents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
      redirect: 'if_required',
    });

    if (error) {
      setError(error.message || 'Payment failed');
    } else {
      onSuccess?.();
    }

    setLoading(false);
  };

  if (!clientSecret) {
    return <p className="text-center text-slate-400">Loading payment…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        disabled={loading}
        className="w-full bg-lime-400 text-slate-950 font-bold py-3 rounded-xl disabled:opacity-50"
      >
        {loading ? 'Processing…' : 'Pay Now'}
      </button>
    </form>
  );
}

export default function CheckoutPage(props: CheckoutPageProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{ appearance: { theme: 'night' } }}
    >
      <CheckoutForm {...props} />
    </Elements>
  );
}
