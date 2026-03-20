'use client';

import * as React from 'react';
import { cn } from '../../utils/cn';

export function Progress({
  value = 0,
  className,
}: {
  value?: number;
  className?: string;
}) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-white/10', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
        style={{ width: `${Math.max(6, Math.min(100, value))}%` }}
      />
    </div>
  );
}
