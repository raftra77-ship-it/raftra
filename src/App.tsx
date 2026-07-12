import { Routes, Route, useNavigate } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { AuthScreen } from './components/AuthScreen';
import { PricingScreen } from './components/PricingScreen';
import { Checkout } from './components/Checkout';
import { OnboardingWizard } from './components/OnboardingWizard';
import { BrandDashboard } from './pages/BrandDashboard';
import { CreatorPortal } from './components/CreatorPortal';
import { Security } from './pages/Security';
import { AboutUs } from './pages/AboutUs';
import { FeaturePage } from './pages/FeaturePage';
import './App.css';

export default function App() {
  const navigate = useNavigate();

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
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
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
  );
}
