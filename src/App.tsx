import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import './App.css';

// Everything below is code-split: each page downloads only when its route is visited.
// This keeps the dashboard's heavy deps (recharts is ~9MB of source, used only by
// WorkspaceAnalytics) out of the bundle a landing-page visitor has to download.
const AuthScreen = lazy(() => import('./components/AuthScreen').then(m => ({ default: m.AuthScreen })));
const AuthCallback = lazy(() => import('./components/AuthCallback').then(m => ({ default: m.AuthCallback })));
const ForgotPassword = lazy(() => import('./components/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./components/ResetPassword').then(m => ({ default: m.ResetPassword })));
const PricingScreen = lazy(() => import('./components/PricingScreen').then(m => ({ default: m.PricingScreen })));
const Checkout = lazy(() => import('./components/Checkout').then(m => ({ default: m.Checkout })));
const OnboardingWizard = lazy(() => import('./components/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));
const BrandDashboard = lazy(() => import('./pages/BrandDashboard').then(m => ({ default: m.BrandDashboard })));
const CreatorPortal = lazy(() => import('./components/CreatorPortal').then(m => ({ default: m.CreatorPortal })));
const Security = lazy(() => import('./pages/Security').then(m => ({ default: m.Security })));
const AboutUs = lazy(() => import('./pages/AboutUs').then(m => ({ default: m.AboutUs })));
const FeaturePage = lazy(() => import('./pages/FeaturePage').then(m => ({ default: m.FeaturePage })));
const InfluencerMarketplacePage = lazy(() => import('./pages/InfluencerMarketplacePage').then(m => ({ default: m.InfluencerMarketplacePage })));
// Public legal pages. Meta/Google/Razorpay require these to be reachable before granting
// production API access, so they must stay outside the authenticated routes below.
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const Terms = lazy(() => import('./pages/Terms').then(m => ({ default: m.Terms })));
const DataDeletion = lazy(() => import('./pages/DataDeletion').then(m => ({ default: m.DataDeletion })));

// Deferred so the WebGL shader library never blocks first paint. It's a background at
// z-index -10, so arriving a moment after the content is not noticeable.
const FlowyBackground = lazy(() => import('./components/FlowyBackground').then(m => ({ default: m.FlowyBackground })));

// Shown only while a route chunk is in flight (usually imperceptible on a warm connection).
const RouteFallback = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
    Loading...
  </div>
);

// Reads the JWT payload without trusting it for anything but routing. The server still
// authorises every request; this only decides which screen to show.
function readToken(): { role?: string; exp?: number } | null {
  const raw = localStorage.getItem('token');
  // A failed restore can leave the literal string "undefined" here, which is not a token.
  if (!raw || raw === 'undefined' || raw === 'null') return null;
  try {
    const payload = JSON.parse(atob(raw.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;   // expired
    return payload;
  } catch {
    return null;
  }
}

// Gate for every screen that shows account data. Previously only /dashboard was protected
// (incidentally, inside a fetch effect) — /creator-dashboard and /onboarding rendered in
// full for anonymous visitors, leaking a complete creator profile.
function RequireAuth({ children, role }: { children: React.ReactElement; role?: 'brand' | 'creator' }) {
  const navigate = useNavigate();
  const payload = readToken();
  const ok = !!payload && (!role || payload.role === role);

  useEffect(() => {
    if (payload && role && payload.role !== role) {
      // Signed in, wrong side of the product — send them to their own dashboard rather
      // than to a login screen they don't need.
      navigate(payload.role === 'creator' ? '/creator-dashboard' : '/dashboard', { replace: true });
    } else if (!payload) {
      localStorage.removeItem('token');   // clears expired/corrupt values
      navigate('/login', { replace: true });
    }
  }, [ok]);

  return ok ? children : <RouteFallback />;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Someone already signed in who lands on /login has nothing to do there - send them
  // to their own dashboard by role. Scoped to /login only, so it never interferes with
  // the OAuth handoff at /auth/callback or the password-reset routes.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      if (location.pathname.toLowerCase() === '/login') {
        if (decoded.role === 'creator') {
          navigate('/creator-dashboard', { replace: true });
        } else if (decoded.role === 'brand') {
          navigate('/dashboard', { replace: true });
        }
      }
    } catch {
      // Malformed token - clear it rather than leaving the app in a half-authed state.
      localStorage.removeItem('token');
    }
  }, []);

  const handleLoginComplete = (hasWorkspace: boolean, isCreator?: boolean) => {
    if (isCreator) {
      navigate('/creator-dashboard');
    } else if (hasWorkspace) {
      navigate('/dashboard');
    } else {
      // No workspace yet — send them to onboarding to create one, not back to
      // the marketing page (which leaves them with no way into the product).
      navigate('/onboarding');
    }
  };

  const handleOnboardingComplete = () => {
    // BrandDashboard will refetch and register the workspace if not yet created.
    navigate('/dashboard');
  };

  return (
    <>
      <Suspense fallback={null}>
        <FlowyBackground />
      </Suspense>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={
            <LandingPage
              onStartFree={() => navigate('/login')}
              onBookDemo={() => alert('Demo booked! Aura integration specialist will contact you.')}
            />
          } />

          <Route path="/security" element={<Security />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/features/:featureId" element={<FeaturePage />} />

          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/data-deletion" element={<DataDeletion />} />

          <Route path="/login" element={
            <AuthScreen onLoginComplete={handleLoginComplete} />
          } />

          <Route path="/auth/callback" element={
            <AuthCallback onLoginComplete={handleLoginComplete} />
          } />

          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/pricing" element={
            <PricingScreen onComplete={() => navigate('/checkout')} />
          } />

          <Route path="/checkout" element={
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
              <Checkout onComplete={() => navigate('/onboarding')} />
            </div>
          } />

          <Route path="/onboarding" element={
            <RequireAuth>
              <OnboardingWizard onComplete={handleOnboardingComplete} />
            </RequireAuth>
          } />

          <Route path="/dashboard/*" element={
            <RequireAuth role="brand">
              <BrandDashboard />
            </RequireAuth>
          } />

          <Route path="/influencer-marketplace/*" element={
            <InfluencerMarketplacePage />
          } />

          <Route path="/marketplace/*" element={
            <InfluencerMarketplacePage />
          } />

          <Route path="/creator-dashboard/*" element={
            <RequireAuth role="creator">
              <CreatorPortal onLogout={() => {
                localStorage.removeItem('token');
                navigate('/');
              }} />
            </RequireAuth>
          } />
          <Route path="*" element={<LandingPage onStartFree={() => navigate('/login')} onBookDemo={() => {}} />} />
        </Routes>
      </Suspense>
    </>
  );
}
