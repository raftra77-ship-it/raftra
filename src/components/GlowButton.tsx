import React from 'react';

interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glow';
  children: React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
}

export const GlowButton: React.FC<GlowButtonProps> = ({
  variant = 'primary',
  children,
  icon,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const getButtonClass = () => {
    switch (variant) {
      case 'secondary':
        return 'btn btn-secondary';
      case 'glow':
        return 'btn btn-glow';
      case 'primary':
      default:
        return 'btn btn-primary';
    }
  };

  return (
    <button
      className={`${getButtonClass()} ${className}`}
      disabled={disabled || loading}
      style={{ position: 'relative' }}
      {...props}
    >
      {variant === 'glow' && <div className="btn-glow-shadow" />}
      {loading ? (
        <span className="shimmer-loading" style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%' }} />
      ) : (
        icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
