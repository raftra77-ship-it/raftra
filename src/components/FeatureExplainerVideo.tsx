import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, PlayCircle } from 'lucide-react';
import { GlowButton } from './GlowButton';

interface ExplainerMetric {
  label: string;
  value: string;
  color: string;
}

interface ExplainerStep {
  title: string;
  agent: string;
  description: string;
  badge: string;
  visualType: string;
  metrics: ExplainerMetric[];
}

interface FeatureExplainerVideoProps {
  title: string;
  subtitle: string;
  badgeText: string;
  steps: ExplainerStep[];
  ctaText: string;
}

// A lightweight "motion demo" section: a step list a visitor can click through, each step
// showing which agent runs it and the metrics it produces. Not a real video - a stand-in
// visual that communicates the same story (what happens, in what order, with what result).
export const FeatureExplainerVideo: React.FC<FeatureExplainerVideoProps> = ({
  title,
  subtitle,
  badgeText,
  steps,
  ctaText,
}) => {
  const [active, setActive] = useState(0);
  const step = steps[active];

  return (
    <div style={{ marginTop: '64px', marginBottom: '64px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', background: 'rgba(90,82,255,0.1)', borderRadius: '100px', border: '1px solid rgba(90,82,255,0.2)', marginBottom: '18px' }}>
          <PlayCircle size={14} color="#8B85FF" />
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', color: '#8B85FF' }}>{badgeText}</span>
        </div>
        <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>{title}</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto' }}>{subtitle}</p>
      </div>

      <div style={{ background: '#0a0a0a', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: '100px',
                border: `1px solid ${i === active ? 'rgba(90,82,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                background: i === active ? 'rgba(90,82,255,0.15)' : 'transparent',
                color: i === active ? '#8B85FF' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            style={{ padding: '28px 32px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Bot size={15} color="#00E676" />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#00E676' }}>{step.agent}</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, letterSpacing: '0.4px', color: '#fff', background: 'rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 8px' }}>
                {step.badge}
              </span>
            </div>
            <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>{step.title}</h4>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>{step.description}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {step.metrics.map((m, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{m.label}</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ textAlign: 'center', marginTop: '28px' }}>
        <GlowButton variant="primary">{ctaText}</GlowButton>
      </div>
    </div>
  );
};
