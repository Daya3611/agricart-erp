'use client';

import React from 'react';
import { UserProfile } from '@/types';

interface VertixWelcomeHeaderProps {
  user: UserProfile | null;
  subtitle?: string;
  employeeId?: string;
  departmentName?: string;
  centerName?: string;
  submissionDeadline?: string;
}

export function VertixWelcomeHeader({
  user,
  subtitle,
  employeeId,
  departmentName,
  centerName,
  submissionDeadline,
}: VertixWelcomeHeaderProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = user?.fullName || 'Colleague';
  const empId = employeeId || user?.employeeId;
  const dept = departmentName || user?.departmentName;
  const center = centerName || (user?.assignedCenterNames && user.assignedCenterNames[0]);

  return (
    <div className="space-y-1.5 mb-2">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
        {getGreeting()}, <span className="text-primary underline">{displayName}</span>
      </h1>
      <p className="text-xs sm:text-sm font-medium text-muted-foreground">
        {subtitle || 'Stay on top of your tasks, monitor progress, and track status.'}
      </p>

      {(empId || dept || center || submissionDeadline) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {empId && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-card border border-border text-foreground font-semibold text-[11px] shadow-2xs">
              ID: {empId}
            </span>
          )}
          {dept && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-card border border-border text-foreground font-medium text-[11px] shadow-2xs">
              {dept}
            </span>
          )}
          {center && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-card border border-border text-foreground font-medium text-[11px] shadow-2xs">
              {center}
            </span>
          )}
          {submissionDeadline && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-light border border-[#CDE7D4] dark:border-[#1F3D2A] text-primary font-bold text-[11px] shadow-2xs">
              Due Today: {submissionDeadline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
