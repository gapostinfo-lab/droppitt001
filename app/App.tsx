import React, { useMemo, useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { ProfilePage } from './components/ProfilePage';
import CheckoutPage from './components/CheckoutPage';
import { AuthProvider, useAuth } from './context/AuthContext';

type View = 'dashboard' | 'profile' | 'checkout';

const AppContent: React.FC = () => {
  const { user, loading, logout, updateUser } = useAuth();

  const [currentView, setCurrentView] = useState<View>('dashboard');

  // Holds the draft booking until payment succeeds
  const [pendingBooking, setPendingBooking] = useState<any | null>(null);
  const [checkoutAmountCents, setCheckoutAmountCents] = useState<number>(0);

  const isReadyForCheckout = useMemo(() => {
    return !!pendingBooking && checkoutAmountCents > 0;
  }, [pendingBooking, checkoutAmountCents]);

  const startCheckoutFromBooking = (bookingDraft: any, amountCents: number) => {
    setPendingBooking(bookingDraft);
    setCheckoutAmountCents(amountCents);
    setCurrentView('checkout');
  };

  const finalizeBookingAfterPayment = (paidBooking: any) => {
    // Save into the same “DB” your Dashboard reads
    const saved = localStorage.getItem('droppit_bookings_db');
    const existing = saved ? JSON.parse(saved) : [];

    localStorage.setItem('droppit_bookings_db', JSON.stringify([paidBooking, ...existing]));

    // Clear pending state
    setPendingBooking(null);
    setCheckoutAmountCents(0);

    // Go back to dashboard (your Dashboard already has a Tracking tab)
    setCurrentView('dashboard');
  };

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {currentView === 'checkout' ? (
        <CheckoutPage
          bookingDraft={pendingBooking}
          amountCents={checkoutAmountCents}
          onBack={() => setCurrentView('dashboard')}
          onPaymentSuccess={finalizeBookingAfterPayment}
          disabled={!isReadyForCheckout}
        />
      ) : currentView === 'dashboard' ? (
        <Dashboard
          user={user}
          onLogout={logout}
          onNavigateProfile={() => setCurrentView('profile')}
          onGoToCheckout={startCheckoutFromBooking}
        />
      ) : (
        <ProfilePage
          user={user}
          onBack={() => setCurrentView('dashboard')}
          onUpdate={updateUser}
          onLogout={logout}
        />
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
