import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import './Input.css';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, label, error, fullWidth, icon, value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
      if (value === 0 && displayValue === '') return;
      if (value === 0 && document.activeElement !== document.getElementById(props.id)) {
        setDisplayValue('');
        return;
      }
      
      const formatted = new Intl.NumberFormat('es-CL').format(value);
      setDisplayValue(value > 0 ? formatted : '');
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Remove all non-numeric characters
      const rawValue = e.target.value.replace(/\D/g, '');
      const numValue = parseInt(rawValue, 10);
      
      if (isNaN(numValue)) {
        setDisplayValue('');
        onChange(0);
      } else {
        const formatted = new Intl.NumberFormat('es-CL').format(numValue);
        setDisplayValue(formatted);
        onChange(numValue);
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (value === 0) setDisplayValue('');
    };

    return (
      <div className={clsx('input-group', fullWidth && 'w-full', className)}>
        {label && <label className="input-label">{label}</label>}
        <div className="input-wrapper relative">
          <span className="absolute left-3 text-muted" style={{ zIndex: 1, left: '12px' }}>$</span>
          {icon && <span className="input-icon" style={{ left: '28px' }}>{icon}</span>}
          <input
            ref={ref}
            type="text"
            className={clsx('input-field pl-8', icon && 'has-icon-extra', error && 'has-error')}
            style={{ paddingLeft: icon ? '2.5rem' : '1.5rem' }}
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            placeholder="0"
            {...props}
          />
        </div>
        {error && <span className="input-error">{error}</span>}
      </div>
    );
  }
);
CurrencyInput.displayName = 'CurrencyInput';
