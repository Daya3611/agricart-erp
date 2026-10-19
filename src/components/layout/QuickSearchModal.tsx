'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Users, FileText, MapPin, Building2, Calendar, ArrowRight } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { UserRole } from '@/types';

interface QuickSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: UserRole;
}

export function QuickSearchModal({ open, onOpenChange, role }: QuickSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ title: string; category: string; href: string; icon: any }>>([]);

  const searchIndex = [
    { title: 'Dashboard Overview', category: 'Pages', href: role === 'super_admin' || role === 'admin' ? '/admin/dashboard' : role === 'manager' ? '/manager/dashboard' : '/staff/dashboard', icon: FileText },
    { title: 'Daily Reports Directory', category: 'Reports', href: role === 'staff' ? '/staff/report-history' : role === 'manager' ? '/manager/reports' : '/admin/reports', icon: FileText },
    { title: 'Monthly Cumulative Report', category: 'Reports', href: role === 'staff' ? '/staff/reports/monthly' : '/admin/reports/monthly', icon: Calendar },
    { title: 'Staff Directory', category: 'Organization', href: role === 'manager' ? '/manager/staff' : '/admin/staff', icon: Users },
    { title: 'Departments & Hierarchy', category: 'Organization', href: '/admin/departments', icon: Building2 },
    { title: 'Procurement Centers', category: 'Organization', href: '/admin/centers', icon: MapPin },
    { title: 'Leave Management', category: 'Leaves', href: role === 'staff' ? '/staff/leaves' : role === 'manager' ? '/manager/leaves' : '/admin/leaves', icon: Calendar },
    { title: 'Pending Reviews Queue', category: 'Reviews', href: '/admin/pending-reviews', icon: FileText },
    { title: 'Missing Reports Overdue', category: 'Compliance', href: '/admin/missing-reports', icon: FileText },
    { title: 'Analytics & Trends', category: 'Analytics', href: role === 'manager' ? '/manager/analytics' : '/admin/analytics', icon: FileText },
    { title: 'System Settings', category: 'Administration', href: '/admin/settings', icon: Building2 },
  ];

  useEffect(() => {
    if (!query.trim()) {
      setResults(searchIndex.slice(0, 5));
    } else {
      const q = query.toLowerCase();
      setResults(searchIndex.filter((item) => item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)));
    }
  }, [query]);

  const handleSelect = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Navigation & Search"
      description="Find modules, pages, and operational shortcuts"
      maxWidth="max-w-md"
    >
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full border border-[#E7EAE5] bg-[#F4F5F2]/50 focus-within:border-[#CDE7D4] focus-within:ring-1 focus-within:ring-[#228B4E] transition-all">
          <Search className="h-4 w-4 text-[#858B83] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, modules, reports..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none font-medium"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1 divide-y divide-border">
          {results.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No matching modules or pages found.</div>
          ) : (
            results.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(item.href)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/60 text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted group-hover:bg-primary-light flex items-center justify-center text-primary transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground leading-tight">{item.title}</p>
                      <span className="text-[10px] text-muted-foreground font-medium">{item.category}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
}
