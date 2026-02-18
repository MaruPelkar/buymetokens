'use client';

import { useEffect, useRef, useState } from 'react';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface PublicProfile {
  slug: string;
  display_name: string;
  donation_message: string | null;
  minimum_donation: number;
  suggested_amounts: number[];
}

interface DonateWidgetProps {
  profile: PublicProfile;
}

type Step = 'amount' | 'details' | 'payment' | 'success' | 'error';

export function DonateWidget({ profile }: DonateWidgetProps) {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState<number>(profile.suggested_amounts?.[0] ?? 5);
  const [customAmount, setCustomAmount] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const cardMountRef = useRef<HTMLDivElement | null>(null);

  const suggested = profile.suggested_amounts?.length
    ? profile.suggested_amounts
    : [3, 5, 10, 25];

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  // Mount Stripe card element when entering payment step
  useEffect(() => {
    if (step !== 'payment') return;

    let mounted = true;
    (async () => {
      if (!stripeRef.current) {
        stripeRef.current = await loadStripe(
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
        );
      }
      if (!stripeRef.current || !cardMountRef.current || !mounted) return;

      const elements = stripeRef.current.elements();
      elementsRef.current = elements;
      const card = elements.create('card', {
        style: {
          base: { fontSize: '16px', color: '#111827', fontFamily: 'inherit' },
        },
      });
      card.mount(cardMountRef.current);
    })();

    return () => {
      mounted = false;
    };
  }, [step]);

  async function handlePay() {
    if (!stripeRef.current || !elementsRef.current) return;
    setLoading(true);
    setErrorMsg('');

    try {
      // Create PaymentIntent
      const res = await fetch('/api/payments/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(finalAmount * 100), // cents
          recipientSlug: profile.slug,
          donorEmail: donorEmail || undefined,
          donorName: donorName || undefined,
          message: message || undefined,
          isAnonymous,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create payment');
      }

      const { clientSecret } = await res.json();
      const cardElement = elementsRef.current.getElement('card');
      if (!cardElement) throw new Error('Card element not found');

      const { error, paymentIntent } = await stripeRef.current.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: donorEmail ? { email: donorEmail } : undefined,
          },
        }
      );

      if (error) throw new Error(error.message);
      if (paymentIntent?.status === 'succeeded') {
        setStep('success');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Payment failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'success') {
    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h3>
        <p className="text-gray-600">
          You funded{' '}
          <span className="font-semibold">${finalAmount.toFixed(2)}</span> in AI
          tokens for <span className="font-semibold">{profile.display_name}</span>.
        </p>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-4">😕</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h3>
        <p className="text-red-600 text-sm mb-6">{errorMsg}</p>
        <Button onClick={() => { setStep('payment'); setErrorMsg(''); }}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step: Amount */}
      {step === 'amount' && (
        <>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Choose amount</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {suggested.map((s) => (
                <button
                  key={s}
                  onClick={() => { setAmount(s); setCustomAmount(''); }}
                  className={`py-2 rounded-lg border-2 font-medium text-sm transition-colors ${
                    !customAmount && amount === s
                      ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  ${s}
                </button>
              ))}
            </div>
            <Input
              placeholder="Custom amount"
              type="number"
              min={profile.minimum_donation ?? 1}
              step="0.01"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
            {profile.minimum_donation > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Minimum: ${profile.minimum_donation.toFixed(2)}
              </p>
            )}
          </div>
          <Button
            fullWidth
            onClick={() => setStep('details')}
            disabled={finalAmount < (profile.minimum_donation ?? 1)}
          >
            Continue — ${finalAmount.toFixed(2)}
          </Button>
        </>
      )}

      {/* Step: Details */}
      {step === 'details' && (
        <>
          <div className="space-y-4">
            <Input
              label="Your name (optional)"
              placeholder="Anonymous"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
            />
            <Input
              label="Email for receipt (optional)"
              type="email"
              placeholder="you@example.com"
              value={donorEmail}
              onChange={(e) => setDonorEmail(e.target.value)}
            />
            <Input
              label="Message (optional)"
              placeholder="Keep building!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded"
              />
              Make this donation anonymous
            </label>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('amount')}>
              Back
            </Button>
            <Button fullWidth onClick={() => setStep('payment')}>
              Pay ${finalAmount.toFixed(2)}
            </Button>
          </div>
        </>
      )}

      {/* Step: Payment */}
      {step === 'payment' && (
        <>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Card details</p>
            <div
              ref={cardMountRef}
              className="border border-gray-300 rounded-lg px-4 py-3 min-h-[48px]"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('details')}>
              Back
            </Button>
            <Button fullWidth onClick={handlePay} disabled={loading}>
              {loading ? 'Processing…' : `Pay $${finalAmount.toFixed(2)}`}
            </Button>
          </div>
          <p className="text-xs text-center text-gray-400">
            Secured by Stripe
          </p>
        </>
      )}
    </div>
  );
}
