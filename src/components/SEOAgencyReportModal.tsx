import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Activity, Search, Shield, Zap, Box, Link as LinkIcon, Database, CheckCircle, AlertTriangle } from 'lucide-react';
import { GlowButton } from './GlowButton';
import type { ReviewItem } from './ReviewDrawer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: ReviewItem | null;
  onApprove: (id: string, updatedData: any) => void;
}

const parseMarkdownReport = (text: string) => {
  const sections = text.split('##').filter(s => s.trim().length > 0);
  const headerSection = sections.shift()?.split('\n').filter(l => l.trim()) || [];
  const title = headerSection[0]?.replace('# ', '') || '';
  const subtitle = headerSection[1] || '';

  const parsedSections = sections.map(section => {
    const lines = section.split('\n').filter(l => l.trim());
    const heading = lines.shift()?.trim() || '';
    const points = lines.filter(l => l.startsWith('- ')).map(l => {
      // bold parsing
      const parts = l.replace('- ', '').split('**');
      return parts.map((p, i) => i % 2 === 1 ? <strong key={i} style={{ color: 'var(--text-primary)' }}>{p}</strong> : p);
    });
    const subpoints = lines.filter(l => l.startsWith('  - ')).map(l => l.replace('  - ', ''));
    
    return { heading, points, subpoints };
  });

  return { title, subtitle, parsedSections };
};

export const SEOAgencyReportModal: React.FC<Props> = ({ isOpen, onClose, item, onApprove }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedText, setEditedText] = React.useState(item?.data.bodyText || '');

  React.useEffect(() => {
    if (item?.data.bodyText) {
      setEditedText(item.data.bodyText);
    }
  }, [item]);

  if (!item) return null;

  const handleDeploy = () => {
    onApprove(item.id, { ...item.data, bodyText: editedText });
  };

  const { title, subtitle, parsedSections } = parseMarkdownReport(editedText);

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="review-drawer-overlay" 
          onClick={onClose}
          style={{
            backdropFilter: 'blur(12px)',
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              width: '100%',
              maxWidth: '1200px',
              height: '90vh',
              background: '#09090b',
              border: '1px solid var(--border-color)',
              borderRadius: '24px',
              display: 'flex',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Left Sidebar - Agent Profile */}
            <div style={{
              width: '320px',
              background: 'linear-gradient(180deg, rgba(66, 133, 244, 0.05) 0%, rgba(0,0,0,0) 100%)',
              borderRight: '1px solid var(--border-color)',
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
              overflowY: 'auto'
            }}>
              <div>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #4285F4, #0F52BA)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '16px', color: 'white'
                }}>
                  <Search size={24} />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Marketing SEO Specialist</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Expert search engine optimization strategist specializing in technical SEO, content optimization, and organic growth.
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px' }}>Active Models</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10a37f' }}></div>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Google Gemini 1.5 Pro</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97757' }}></div>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Claude 3.5 Sonnet</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px' }}>Connectors</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Database size={12} /> Search Console
                  </span>
                  <span style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={12} /> Web Crawler
                  </span>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px' }}>Activated Skills</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {['Cannibalization Audit', 'Schema Generator', 'Entity Optimization', 'Technical Auditing'].map((skill, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={14} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{skill}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Main Panel - The Report */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-color)',
            }}>
              {/* Header */}
              <div style={{ padding: '32px 40px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="hero-pill-badge" style={{ background: 'var(--warning-glow)', color: 'var(--warning)', marginBottom: '12px', display: 'inline-block' }}>
                    AWAITING HUMAN APPROVAL
                  </span>
                  <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>{title || item.title}</h1>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{subtitle || 'Review the generated strategy below before deploying.'}</p>
                </div>
                <button
                  onClick={onClose}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '50%' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column' }}>
                
                {isEditing ? (
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    style={{
                      flex: 1,
                      width: '100%',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '24px',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      resize: 'none',
                      minHeight: '400px'
                    }}
                  />
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      
                      {parsedSections.map((section, idx) => (
                        <div key={idx} style={{ 
                          background: 'rgba(255,255,255,0.02)', 
                          border: '1px solid rgba(255,255,255,0.05)', 
                          borderRadius: '16px', 
                          padding: '24px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '16px'
                        }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {idx === 0 ? <Shield style={{ color: '#4285F4' }} /> : 
                         idx === 1 ? <Search style={{ color: '#0F52BA' }} /> : 
                         idx === 2 ? <Box style={{ color: '#10a37f' }} /> : 
                         <LinkIcon style={{ color: '#d97757' }} />}
                        <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'white' }}>{section.heading}</h3>
                      </div>
                      
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {section.points.map((pt, i) => (
                          <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '24px', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 0, top: '8px', width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                            {pt}
                          </li>
                        ))}
                      </ul>

                      {section.subpoints.length > 0 && (
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '12px', 
                          background: 'rgba(255, 174, 0, 0.05)', 
                          border: '1px solid rgba(255, 174, 0, 0.1)', 
                          borderRadius: '8px' 
                        }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                            <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
                            <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 600 }}>Action Required</span>
                          </div>
                          {section.subpoints.map((spt, i) => (
                            <p key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: i !== section.subpoints.length - 1 ? '8px' : 0 }}>
                              {spt}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                </div>

                <div style={{
                  marginTop: '32px',
                  background: 'rgba(66, 133, 244, 0.05)',
                  border: '1px solid rgba(66, 133, 244, 0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <Zap size={24} style={{ color: '#4285F4' }} />
                  <div>
                    <h4 style={{ fontSize: '14px', color: 'white', marginBottom: '4px' }}>Ready for Deployment</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Approving this strategy will instruct the Publishing Agent to immediately execute redirects, schema injections, and meta updates via API.
                    </p>
                  </div>
                </div>
                  </>
                )}
              </div>

              {/* Footer Actions */}
              <div style={{ padding: '24px 40px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '16px', background: 'rgba(0,0,0,0.2)' }}>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  style={{
                    marginRight: 'auto',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'white',
                    padding: '0 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  {isEditing ? 'View Preview' : 'Edit Source'}
                </button>
                <button 
                  onClick={onClose}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'white',
                    padding: '0 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <GlowButton
                  variant="primary"
                  icon={<Check size={18} />}
                  onClick={handleDeploy}
                  style={{ padding: '12px 32px' }}
                >
                  Deploy to Production
                </GlowButton>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
