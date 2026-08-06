import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { LandingPage } from './components/LandingPage';
import { AuthScreen } from './components/AuthScreen';
import './App.css';

import { FlowyBackground } from './components/FlowyBackground';

// Code-split heavy routes to optimize initial bundle size & load speed
const PricingScreen = lazy(() => import('./components/PricingScreen').then(m => ({ default: m.PricingScreen })));
const Checkout = lazy(() => import('./components/Checkout').then(m => ({ default: m.Checkout })));
const OnboardingWizard = lazy(() => import('./components/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));
const BrandDashboard = lazy(() => import('./pages/BrandDashboard').then(m => ({ default: m.BrandDashboard })));
const CreatorPortal = lazy(() => import('./components/CreatorPortal').then(m => ({ default: m.CreatorPortal })));
const Security = lazy(() => import('./pages/Security').then(m => ({ default: m.Security })));
const AboutUs = lazy(() => import('./pages/AboutUs').then(m => ({ default: m.AboutUs })));
const FeaturePage = lazy(() => import('./pages/FeaturePage').then(m => ({ default: m.FeaturePage })));

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Auto-redirect if already logged in ───────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return; // not logged in, stay wherever they are

    try {
      const payloadBase64 = token.split('.')[1];
      const decoded = JSON.parse(atob(payloadBase64));
      const role = decoded.role;

      // Only auto-redirect when user lands on home / or login page
      if (location.pathname === '/' || location.pathname === '/login') {
        if (role === 'creator') {
          navigate('/creator-dashboard', { replace: true });
        } else if (role === 'brand') {
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (e) {
      // Malformed token — clear it
      localStorage.removeItem('token');
    }
  }, []);

  const handleLoginComplete = (hasWorkspace: boolean, isCreator?: boolean) => {
    if (isCreator) {
      navigate('/creator-dashboard');
    } else if (hasWorkspace) {
      navigate('/dashboard');
    } else {
      navigate('/pricing');
    }
  };

  const handleOnboardingComplete = (data: any) => {
    // BrandDashboard will refetch and register the workspace if not yet created.
    navigate('/dashboard');
  };

  return (
    <>
      <FlowyBackground />
      <Suspense fallback={
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#030306', color: '#7C75FF', gap: '16px' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid rgba(124,117,255,0.2)', borderTopColor: '#7C75FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em' }}>LOADING RAFTRA PLATFORM...</span>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      }>
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
