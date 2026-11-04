import {
  LayoutDashboard,
  Users,
  Building2,
  MapPin,
  FileText,
  Clock,
  AlertTriangle,
  BarChart3,
  Mail,
  ShieldCheck,
  Settings,
  PlusCircle,
  History,
  AlertCircle,
  User,
  CalendarOff,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react';
import { UserRole } from '@/types';

export interface NavItemConfig {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  superAdminOnly?: boolean;
  exactMatch?: boolean;
}

export interface NavGroupConfig {
  id: string;
  label: string;
  items: NavItemConfig[];
}

export function getNavigationForRole(role: UserRole): NavGroupConfig[] {
  if (role === 'super_admin' || role === 'admin') {
    const isSuperAdmin = role === 'super_admin';

    return [
      {
        id: 'overview',
        label: 'Overview',
        items: [
          {
            id: 'admin-dashboard',
            label: 'Dashboard',
            href: '/admin/dashboard',
            icon: LayoutDashboard,
            exactMatch: true,
          },
        ],
      },
      {
        id: 'organization',
        label: 'Organization',
        items: [
          {
            id: 'admin-staff',
            label: 'Employees',
            href: '/admin/staff',
            icon: Users,
          },
          {
            id: 'admin-departments',
            label: 'Departments',
            href: '/admin/departments',
            icon: Building2,
          },
          {
            id: 'admin-centers',
            label: 'Centers',
            href: '/admin/centers',
            icon: MapPin,
          },
          {
            id: 'admin-leaves',
            label: 'Leave Management',
            href: '/admin/leaves',
            icon: CalendarOff,
          },
        ],
      },
      {
        id: 'reports',
        label: 'Reports',
        items: [
          {
            id: 'admin-reports',
            label: 'Field Activity Reports',
            href: '/admin/reports',
            icon: FileText,
            exactMatch: true,
          },
          {
            id: 'admin-monthly-reports',
            label: 'Admin Monthly Reports',
            href: '/admin/reports/monthly',
            icon: CalendarDays,
          },
          {
            id: 'admin-pending-reviews',
            label: 'Pending Reviews',
            href: '/admin/pending-reviews',
            icon: Clock,
          },
          {
            id: 'admin-missing-reports',
            label: 'Missing Reports',
            href: '/admin/missing-reports',
            icon: AlertTriangle,
          },
          {
            id: 'admin-analytics',
            label: 'Report Analytics',
            href: '/admin/analytics',
            icon: BarChart3,
          },
        ],
      },
      {
        id: 'communication',
        label: 'Communication',
        items: [
          {
            id: 'admin-email-logs',
            label: 'Email Logs',
            href: '/admin/email-logs',
            icon: Mail,
          },
        ],
      },
      {
        id: 'administration',
        label: 'Administration',
        items: [
          {
            id: 'admin-audit-logs',
            label: 'Audit Logs',
            href: '/admin/audit-logs',
            icon: ShieldCheck,
          },
          ...(isSuperAdmin
            ? [
                {
                  id: 'admin-settings',
                  label: 'System Settings',
                  href: '/admin/settings',
                  icon: Settings,
                  superAdminOnly: true,
                },
              ]
            : []),
        ],
      },
    ];
  }

  if (role === 'manager') {
    return [
      {
        id: 'overview',
        label: 'Overview',
        items: [
          {
            id: 'manager-dashboard',
            label: 'Dashboard',
            href: '/manager/dashboard',
            icon: LayoutDashboard,
            exactMatch: true,
          },
        ],
      },
      {
        id: 'team-reports',
        label: 'Team & Reports',
        items: [
          {
            id: 'manager-reports',
            label: 'Team Reports & Reviews',
            href: '/manager/reports',
            icon: FileText,
            exactMatch: true,
          },
          {
            id: 'manager-staff',
            label: 'Assigned Staff',
            href: '/manager/staff',
            icon: Users,
          },
          {
            id: 'manager-leaves',
            label: 'Team Leaves',
            href: '/manager/leaves',
            icon: CalendarOff,
          },
          {
            id: 'manager-monthly-reports',
            label: 'Monthly Report',
            href: '/admin/reports/monthly',
            icon: CalendarDays,
          },
          {
            id: 'manager-analytics',
            label: 'Department Analytics',
            href: '/manager/analytics',
            icon: BarChart3,
          },
        ],
      },
    ];
  }

  // Staff navigation
  return [
    {
      id: 'workspace',
      label: 'Workspace',
      items: [
        {
          id: 'staff-dashboard',
          label: 'My Dashboard',
          href: '/staff/dashboard',
          icon: LayoutDashboard,
          exactMatch: true,
        },
        {
          id: 'staff-daily-report',
          label: 'Field Activity Reporting',
          href: '/staff/daily-report',
          icon: PlusCircle,
        },
        {
          id: 'staff-report-history',
          label: 'My Field Activities',
          href: '/staff/report-history',
          icon: History,
        },
        {
          id: 'staff-leaves',
          label: 'My Leaves',
          href: '/staff/leaves',
          icon: CalendarOff,
        },
        {
          id: 'staff-monthly-report',
          label: 'Monthly Report',
          href: '/staff/reports/monthly',
          icon: CalendarDays,
        },
        {
          id: 'staff-corrections',
          label: 'Corrections',
          href: '/staff/corrections',
          icon: AlertCircle,
        },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [
        {
          id: 'staff-profile',
          label: 'My Profile',
          href: '/staff/profile',
          icon: User,
        },
      ],
    },
  ];
}
