import React, { useMemo, useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { ProfilePage } from './components/ProfilePage';
import { CheckoutPage } from './components/CheckoutPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Booking } from './types';

const AppContent: React.FC = () => {
  const { user, loading, logout, updateUser } = useAuth();

  const [currentView, setCurrentView] = useState<'dashboard' | 'profile' | 'checkout'>('dashboard');

  const [checkoutDraft, setCheckoutDraft] = useState<Booking | null>(null);
  const [checkoutAmountCents, setCheckoutAmountCents] = useState<number>(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-lime-400/20 blur-xl rounded-full animate-pulse" />
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lime-400 relative z-10"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <LandingPage />
      </div>
    );
  }

  const startCheckout = (bookingDraft: Booking, amountCents: number) => {
    setCheckoutDraft(bookingDraft);
    setCheckoutAmountCents(amountCents);
    setCurrentView('checkout');
  };

  const onPaymentSuccess = () => {
    if (!checkoutDraft) return;

    // Move booking into your DB only after payment success
    const saved = localStorage.getItem('droppit_bookings_db');
    const prev: Booking[] = saved ? JSON.parse(saved) : [];
    localStorage.setItem('droppit_bookings_db', JSON.stringify([checkoutDraft, ...prev]));

    setCheckoutDraft(null);
    setCheckoutAmountCents(0);
    setCurrentView('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {currentView === 'dashboard' ? (
        <Dashboard
          user={user}
          onLogout={logout}
          onNavigateProfile={() => setCurrentView('profile')}
          onGoToCheckout={startCheckout}
        />
      ) : currentView === 'profile' ? (
        <ProfilePage
          user={user}
          onBack={() => setCurrentView('dashboard')}
          onUpdate={updateUser}
          onLogout={logout}
        />
      ) : (
        checkoutDraft && (
          <CheckoutPage
            bookingDraft={checkoutDraft}
            amountCents={checkoutAmountCents}
            onCancel={() => setCurrentView('dashboard')}
            onPaymentSuccess={onPaymentSuccess}
          />
        )
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
