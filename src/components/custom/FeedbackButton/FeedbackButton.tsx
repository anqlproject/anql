import './FeedbackButton.css';

import { Check, LucideIcon, Save, X } from 'lucide-react';
import { useState } from 'react';


interface FeedbackButtonProps {
  /** Async action to execute on click. Return false to cancel feedback. */
  onSave: () => Promise<void | boolean>;
  disabled?: boolean;
  /** How long (ms) to show the success/failed state before reverting */
  duration?: number;
  /** Label shown in idle state */
  label?: string;
  /** Icon shown in idle state (Lucide component) */
  icon?: LucideIcon;
  /** Text shown on success */
  successText?: string;
  /** Text shown on failure */
  failedText?: string;
  /** Visual style variant */
  variant?: 'primary' | 'ghost' | 'outline';
  className?: string;
}

type Status = 'idle' | 'success' | 'failed';

export default function FeedbackButton({
  onSave,
  disabled = false,
  duration = 1000,
  label = 'Enregistrer',
  icon: Icon = Save,
  successText = 'Success',
  failedText = 'Failed',
  variant = 'primary',
  className = '',
}: FeedbackButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleClick = async () => {
    if (disabled || status !== 'idle') return;
    
    let shouldShowFeedback = true;
    
    try {
      const result = await onSave();
      if (result === false) {
        shouldShowFeedback = false;
      } else {
        setStatus('success');
      }
    } catch {
      setStatus('failed');
    }
    
    if (shouldShowFeedback) {
      setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          setStatus('idle');
          setIsFadingOut(false);
        }, 300);
      }, Math.max(duration - 300, 300));
    }
  };

  const variantClass = `feedback-btn--${variant}`;

  if (status === 'idle') {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`feedback-btn ${variantClass} ${disabled ? 'feedback-btn--disabled' : ''} ${className}`.trim()}
      >
        <Icon className="feedback-btn__icon" />
        {label}
      </button>
    );
  }

  const isSuccess = status === 'success';

  return (
    <div
      className={`feedback-status ${isSuccess ? 'feedback-status--success' : 'feedback-status--failed'} ${isFadingOut ? 'fade-out' : ''}`}
    >
      {isSuccess ? (
        <Check className="feedback-btn__icon" />
      ) : (
        <X className="feedback-btn__icon" />
      )}
      {isSuccess ? successText : failedText}
    </div>
  );
}
