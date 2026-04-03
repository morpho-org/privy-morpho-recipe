'use client';

import { cn } from '@/lib/cn';

interface ValueTransitionProps {
  label: string;
  currentValue: string;
  projectedValue?: string | null;
  currentColor?: string;
  projectedColor?: string;
  suffix?: string;
}

export function ValueTransition({
  label,
  currentValue,
  projectedValue,
  currentColor = 'text-foreground',
  projectedColor,
  suffix = '',
}: ValueTransitionProps) {
  const showTransition = projectedValue != null && projectedValue !== currentValue;

  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">
        <span className={cn('font-medium', currentColor)}>
          {currentValue}{suffix}
        </span>
        {showTransition && (
          <>
            <span className="text-muted-foreground mx-1">&rarr;</span>
            <span className={cn('font-bold', projectedColor ?? currentColor)}>
              {projectedValue}{suffix}
            </span>
          </>
        )}
      </span>
    </div>
  );
}
