import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { FeatureCreativeStudio } from './features/FeatureCreativeStudio';
import { FeatureCampaignManager } from './features/FeatureCampaignManager';
import { FeatureSEO } from './features/FeatureSEO';
import { FeatureAnalytics } from './features/FeatureAnalytics';
import { FeatureSocial } from './features/FeatureSocial';
import { FeatureInfluencer } from './features/FeatureInfluencer';
import { ArrowLeft } from 'lucide-react';

export const FeaturePage = () => {
  const { featureId } = useParams<{ featureId: string }>();
  const navigate = useNavigate();

  const renderFeatureContent = () => {
    switch (featureId) {
      case 'creative':
        return <FeatureCreativeStudio />;
      case 'campaign':
        return <FeatureCampaignManager />;
      case 'seo':
        return <FeatureSEO />;
      case 'review': // Maps to Analytics
        return <FeatureAnalytics />;
      case 'social-manager':
        return <FeatureSocial />;
      case 'influencer':
        return <FeatureInfluencer />;
      default:
        return (
          <div style={{ textAlign: 'center', padding: '100px' }}>
            <h2>Feature not found</h2>
            <button onClick={() => navigate('/')} style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer' }}>Go Home</button>
          </div>
        );
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', color: '#fff', paddingTop: '100px', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      
      {/* Background decorations */}
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'var(--primary)', filter: 'blur(250px)', opacity: 0.1, borderRadius: '50%', zIndex: 0 }}></div>
      
      <div style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '40px', position: 'relative', zIndex: 1, width: '100%' }}>
        <button 
          onClick={() => navigate('/')}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '32px' }}
        >
          <ArrowLeft size={16} /> Back to Home
        </button>

        {renderFeatureContent()}
      </div>
      
      <Footer />
    </div>
  );
};
