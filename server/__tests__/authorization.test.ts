import { describe, it, expect } from 'vitest';
import type { User } from '@shared/schema';

// Import actual production authorization functions from server/auth.ts
import {
  canAccessDaycare,
  hasRole,
  canViewPersonalData,
  canViewChildren,
  canCreateChildren,
  canAccessEntries,
  canCreateEntries,
  canReportAbsences,
  canManageUsers,
  canExportData,
  canManageDaycares,
  canViewAuditLogs,
  canManageForms,
  canSubmitForms,
  canCreateRole,
} from '../auth';

// Create mock users for testing
function createMockUser(role: string, daycareId: number | null = 1): User {
  return {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: 'hash',
    role,
    daycareId,
    passwordNeedsReset: false,
    passwordChangedAt: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
  };
}

describe('Daycare Access Control (Production Functions)', () => {
  it('should allow user to access their own daycare', () => {
    const user = createMockUser('staff', 1);
    expect(canAccessDaycare(user, 1)).toBe(true);
  });

  it('should deny user access to other daycares', () => {
    const user = createMockUser('staff', 1);
    expect(canAccessDaycare(user, 2)).toBe(false);
  });

  it('should deny access if user has no daycare (super_admin)', () => {
    const user = createMockUser('super_admin', null);
    expect(canAccessDaycare(user, 1)).toBe(false);
  });

  it('should deny admin access to other daycares', () => {
    const user = createMockUser('admin', 1);
    expect(canAccessDaycare(user, 2)).toBe(false);
  });

  it('should deny daycareleader access to other daycares', () => {
    const user = createMockUser('daycareleader', 1);
    expect(canAccessDaycare(user, 2)).toBe(false);
  });
});

describe('GDPR - Super Admin Personal Data Restrictions (Production)', () => {
  const superAdmin = createMockUser('super_admin', null);

  it('should DENY super_admin from viewing children (personal data)', () => {
    expect(canViewChildren(superAdmin)).toBe(false);
  });

  it('should DENY super_admin from accessing entries (personal data)', () => {
    expect(canAccessEntries(superAdmin)).toBe(false);
  });

  it('should DENY super_admin from viewing personal data', () => {
    expect(canViewPersonalData(superAdmin)).toBe(false);
  });

  it('should ALLOW super_admin to manage daycares (non-personal data)', () => {
    expect(canManageDaycares(superAdmin)).toBe(true);
  });

  it('should ALLOW super_admin to view audit logs (anonymized)', () => {
    expect(canViewAuditLogs(superAdmin)).toBe(true);
  });
});

describe('Role-Based Access: User Management (Production)', () => {
  it('should allow admin to manage users', () => {
    const user = createMockUser('admin', 1);
    expect(canManageUsers(user)).toBe(true);
  });

  it('should allow daycareleader to manage users', () => {
    const user = createMockUser('daycareleader', 1);
    expect(canManageUsers(user)).toBe(true);
  });

  it('should deny staff from managing users', () => {
    const user = createMockUser('staff', 1);
    expect(canManageUsers(user)).toBe(false);
  });

  it('should deny guardian from managing users', () => {
    const user = createMockUser('guardian', 1);
    expect(canManageUsers(user)).toBe(false);
  });

  it('should deny super_admin from managing daycare-level users', () => {
    const user = createMockUser('super_admin', null);
    expect(canManageUsers(user)).toBe(false);
  });
});

describe('Role-Based Access: Children Operations (Production)', () => {
  it('should allow daycareleader to create children', () => {
    const user = createMockUser('daycareleader', 1);
    expect(canCreateChildren(user)).toBe(true);
  });

  it('should deny admin from creating children', () => {
    const user = createMockUser('admin', 1);
    expect(canCreateChildren(user)).toBe(false);
  });

  it('should deny staff from creating children', () => {
    const user = createMockUser('staff', 1);
    expect(canCreateChildren(user)).toBe(false);
  });

  it('should allow all roles except super_admin to view children', () => {
    const roles = ['daycareleader', 'admin', 'staff', 'guardian'];
    for (const role of roles) {
      const user = createMockUser(role, 1);
      expect(canViewChildren(user)).toBe(true);
    }
  });
});

describe('Role-Based Access: Daily Entries (Production)', () => {
  it('should allow staff to create entries', () => {
    const user = createMockUser('staff', 1);
    expect(canCreateEntries(user)).toBe(true);
  });

  it('should allow daycareleader to create entries', () => {
    const user = createMockUser('daycareleader', 1);
    expect(canCreateEntries(user)).toBe(true);
  });

  it('should allow admin to create entries', () => {
    const user = createMockUser('admin', 1);
    expect(canCreateEntries(user)).toBe(true);
  });

  it('should deny guardian from creating entries', () => {
    const user = createMockUser('guardian', 1);
    expect(canCreateEntries(user)).toBe(false);
  });

  it('should deny super_admin from accessing entries', () => {
    const user = createMockUser('super_admin', null);
    expect(canAccessEntries(user)).toBe(false);
  });
});

describe('Role-Based Access: Absence Reporting (Production)', () => {
  it('should allow guardian to report absences', () => {
    const user = createMockUser('guardian', 1);
    expect(canReportAbsences(user)).toBe(true);
  });

  it('should deny staff from reporting absences', () => {
    const user = createMockUser('staff', 1);
    expect(canReportAbsences(user)).toBe(false);
  });

  it('should deny admin from reporting absences', () => {
    const user = createMockUser('admin', 1);
    expect(canReportAbsences(user)).toBe(false);
  });

  it('should deny daycareleader from reporting absences', () => {
    const user = createMockUser('daycareleader', 1);
    expect(canReportAbsences(user)).toBe(false);
  });
});

describe('Role-Based Access: CSV Export - GDPR (Production)', () => {
  it('should allow daycareleader to export data', () => {
    const user = createMockUser('daycareleader', 1);
    expect(canExportData(user)).toBe(true);
  });

  it('should deny admin from exporting data', () => {
    const user = createMockUser('admin', 1);
    expect(canExportData(user)).toBe(false);
  });

  it('should deny staff from exporting data', () => {
    const user = createMockUser('staff', 1);
    expect(canExportData(user)).toBe(false);
  });

  it('should deny guardian from exporting data', () => {
    const user = createMockUser('guardian', 1);
    expect(canExportData(user)).toBe(false);
  });

  it('should deny super_admin from exporting data', () => {
    const user = createMockUser('super_admin', null);
    expect(canExportData(user)).toBe(false);
  });
});

describe('Role-Based Access: Audit Logs (Production)', () => {
  it('should allow admin to view audit logs', () => {
    const user = createMockUser('admin', 1);
    expect(canViewAuditLogs(user)).toBe(true);
  });

  it('should allow daycareleader to view audit logs', () => {
    const user = createMockUser('daycareleader', 1);
    expect(canViewAuditLogs(user)).toBe(true);
  });

  it('should allow super_admin to view audit logs (anonymized)', () => {
    const user = createMockUser('super_admin', null);
    expect(canViewAuditLogs(user)).toBe(true);
  });

  it('should deny staff from viewing audit logs', () => {
    const user = createMockUser('staff', 1);
    expect(canViewAuditLogs(user)).toBe(false);
  });

  it('should deny guardian from viewing audit logs', () => {
    const user = createMockUser('guardian', 1);
    expect(canViewAuditLogs(user)).toBe(false);
  });
});

describe('Role-Based Access: Daycare Management (Production)', () => {
  it('should allow super_admin to manage daycares', () => {
    const user = createMockUser('super_admin', null);
    expect(canManageDaycares(user)).toBe(true);
  });

  it('should deny daycareleader from managing daycares', () => {
    const user = createMockUser('daycareleader', 1);
    expect(canManageDaycares(user)).toBe(false);
  });

  it('should deny admin from managing daycares', () => {
    const user = createMockUser('admin', 1);
    expect(canManageDaycares(user)).toBe(false);
  });

  it('should deny staff from managing daycares', () => {
    const user = createMockUser('staff', 1);
    expect(canManageDaycares(user)).toBe(false);
  });
});

describe('Role-Based Access: Forms (Production)', () => {
  it('should allow admin to manage forms', () => {
    const user = createMockUser('admin', 1);
    expect(canManageForms(user)).toBe(true);
  });

  it('should allow daycareleader to manage forms', () => {
    const user = createMockUser('daycareleader', 1);
    expect(canManageForms(user)).toBe(true);
  });

  it('should deny staff from managing forms', () => {
    const user = createMockUser('staff', 1);
    expect(canManageForms(user)).toBe(false);
  });

  it('should allow guardian to submit forms', () => {
    const user = createMockUser('guardian', 1);
    expect(canSubmitForms(user)).toBe(true);
  });

  it('should deny staff from submitting forms', () => {
    const user = createMockUser('staff', 1);
    expect(canSubmitForms(user)).toBe(false);
  });
});

describe('Multi-Tenant Isolation (Production)', () => {
  it('should isolate data between daycares', () => {
    const daycare1Staff = createMockUser('staff', 1);
    const daycare2Staff = createMockUser('staff', 2);
    
    expect(canAccessDaycare(daycare1Staff, 1)).toBe(true);
    expect(canAccessDaycare(daycare1Staff, 2)).toBe(false);
    expect(canAccessDaycare(daycare2Staff, 2)).toBe(true);
    expect(canAccessDaycare(daycare2Staff, 1)).toBe(false);
  });

  it('should prevent cross-daycare access even for admins', () => {
    const admin = createMockUser('admin', 1);
    
    expect(canAccessDaycare(admin, 1)).toBe(true);
    expect(canAccessDaycare(admin, 2)).toBe(false);
  });

  it('should prevent cross-daycare access even for daycareleaders', () => {
    const leader = createMockUser('daycareleader', 1);
    
    expect(canAccessDaycare(leader, 1)).toBe(true);
    expect(canAccessDaycare(leader, 2)).toBe(false);
    expect(canAccessDaycare(leader, 3)).toBe(false);
  });

  it('should ensure guardians only access their daycare', () => {
    const guardian = createMockUser('guardian', 1);
    
    expect(canAccessDaycare(guardian, 1)).toBe(true);
    expect(canAccessDaycare(guardian, 2)).toBe(false);
  });
});

describe('hasRole Helper Function (Production)', () => {
  it('should correctly identify single role', () => {
    const admin = createMockUser('admin', 1);
    expect(hasRole(admin, 'admin')).toBe(true);
    expect(hasRole(admin, 'staff')).toBe(false);
  });

  it('should correctly identify multiple roles', () => {
    const admin = createMockUser('admin', 1);
    expect(hasRole(admin, 'admin', 'daycareleader')).toBe(true);
    expect(hasRole(admin, 'staff', 'guardian')).toBe(false);
  });

  it('should work with all role types', () => {
    const roles = ['super_admin', 'daycareleader', 'admin', 'staff', 'guardian'];
    for (const role of roles) {
      const user = createMockUser(role, role === 'super_admin' ? null : 1);
      expect(hasRole(user, role as any)).toBe(true);
    }
  });
});

describe('Role Hierarchy Verification (Production)', () => {
  it('super_admin has system-wide view but no personal data access', () => {
    const superAdmin = createMockUser('super_admin', null);
    
    expect(canManageDaycares(superAdmin)).toBe(true);
    expect(canViewAuditLogs(superAdmin)).toBe(true);
    expect(canViewPersonalData(superAdmin)).toBe(false);
    expect(canViewChildren(superAdmin)).toBe(false);
    expect(canAccessEntries(superAdmin)).toBe(false);
  });

  it('daycareleader has full access to their daycare', () => {
    const leader = createMockUser('daycareleader', 1);
    
    expect(canAccessDaycare(leader, 1)).toBe(true);
    expect(canViewChildren(leader)).toBe(true);
    expect(canCreateChildren(leader)).toBe(true);
    expect(canAccessEntries(leader)).toBe(true);
    expect(canCreateEntries(leader)).toBe(true);
    expect(canManageUsers(leader)).toBe(true);
    expect(canExportData(leader)).toBe(true);
    expect(canViewAuditLogs(leader)).toBe(true);
    expect(canManageForms(leader)).toBe(true);
  });

  it('admin has management access but no data export', () => {
    const admin = createMockUser('admin', 1);
    
    expect(canAccessDaycare(admin, 1)).toBe(true);
    expect(canViewChildren(admin)).toBe(true);
    expect(canCreateChildren(admin)).toBe(false);
    expect(canAccessEntries(admin)).toBe(true);
    expect(canCreateEntries(admin)).toBe(true);
    expect(canManageUsers(admin)).toBe(true);
    expect(canExportData(admin)).toBe(false);
    expect(canViewAuditLogs(admin)).toBe(true);
    expect(canManageForms(admin)).toBe(true);
  });

  it('staff has operational access only', () => {
    const staff = createMockUser('staff', 1);
    
    expect(canAccessDaycare(staff, 1)).toBe(true);
    expect(canViewChildren(staff)).toBe(true);
    expect(canCreateChildren(staff)).toBe(false);
    expect(canAccessEntries(staff)).toBe(true);
    expect(canCreateEntries(staff)).toBe(true);
    expect(canManageUsers(staff)).toBe(false);
    expect(canExportData(staff)).toBe(false);
    expect(canViewAuditLogs(staff)).toBe(false);
    expect(canManageForms(staff)).toBe(false);
  });

  it('guardian has limited access for their children', () => {
    const guardian = createMockUser('guardian', 1);
    
    expect(canAccessDaycare(guardian, 1)).toBe(true);
    expect(canViewChildren(guardian)).toBe(true);
    expect(canCreateChildren(guardian)).toBe(false);
    expect(canAccessEntries(guardian)).toBe(true);
    expect(canCreateEntries(guardian)).toBe(false);
    expect(canReportAbsences(guardian)).toBe(true);
    expect(canManageUsers(guardian)).toBe(false);
    expect(canExportData(guardian)).toBe(false);
    expect(canViewAuditLogs(guardian)).toBe(false);
    expect(canSubmitForms(guardian)).toBe(true);
  });
});

/**
 * Which roles a user may hand out when creating another account.
 *
 * The account creation route let any caller who was allowed to create users at
 * all choose the new account's role freely, and staff were allowed to create
 * users. So a member of staff could create a daycareleader, pick its password,
 * and sign back in holding every permission staff is deliberately denied --
 * deleting children, exporting the whole roster, reading the audit log. The
 * daycare boundary held, but the role boundary inside it did not.
 */
describe('Role Escalation: which roles a caller may create', () => {
  it('does not let staff create a daycare leader', () => {
    const staff = createMockUser('staff', 1);
    expect(canCreateRole(staff, 'daycareleader')).toBe(false);
  });

  it('does not let staff create more staff', () => {
    const staff = createMockUser('staff', 1);
    expect(canCreateRole(staff, 'staff')).toBe(false);
  });

  it('lets staff create guardians, which is their daily work', () => {
    const staff = createMockUser('staff', 1);
    expect(canCreateRole(staff, 'guardian')).toBe(true);
  });

  it('lets a daycare leader create any role inside their daycare', () => {
    const leader = createMockUser('daycareleader', 1);
    expect(canCreateRole(leader, 'daycareleader')).toBe(true);
    expect(canCreateRole(leader, 'staff')).toBe(true);
    expect(canCreateRole(leader, 'guardian')).toBe(true);
  });

  it('never lets anyone create a super admin', () => {
    for (const role of ['daycareleader', 'staff', 'guardian', 'super_admin']) {
      expect(canCreateRole(createMockUser(role, 1), 'super_admin' as any)).toBe(false);
    }
  });

  it('does not let a guardian create accounts at all', () => {
    const guardian = createMockUser('guardian', 1);
    for (const role of ['daycareleader', 'staff', 'guardian'] as const) {
      expect(canCreateRole(guardian, role)).toBe(false);
    }
  });
});
