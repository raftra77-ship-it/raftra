import { lazy, Suspense } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
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

// Deferred so the WebGL shader library never blocks first paint. It's a background at
// z-index -10, so arriving a moment after the content is not noticeable.
const FlowyBackground = lazy(() => import('./components/FlowyBackground').then(m => ({ default: m.FlowyBackground })));

// Shown only while a route chunk is in flight (usually imperceptible on a warm connection).
const RouteFallback = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
    Loading...
  </div>
);

export default function App() {
  const navigate = useNavigate();

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

  const handleOnboardingComplete = (data: any) => {
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
            <OnboardingWizard onComplete={handleOnboardingComplete} />
          } />

          <Route path="/dashboard/*" element={
            <BrandDashboard />
          } />

          <Route path="/creator-dashboard/*" element={
            <CreatorPortal onLogout={() => {
              localStorage.removeItem('token');
              navigate('/');
            }} />
          } />
          <Route path="*" element={<LandingPage onStartFree={() => navigate('/login')} onBookDemo={() => {}} />} />
        </Routes>
      </Suspense>
    </>
  );
}
