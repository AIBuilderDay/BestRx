import { describe, expect, it } from 'vitest';
import { users } from '../data/db';
import { can, DEMO_ACCOUNT_IDS, findUserByEmail, permissionsFor } from './auth';

describe('auth', () => {
  it('gives every user a unique login email', () => {
    const emails = users().map((u) => u.email.toLowerCase());
    expect(new Set(emails).size).toBe(users().length);
  });

  it('finds users() by email, case-insensitively, and rejects unknowns', () => {
    expect(findUserByEmail('  Dana@Hospice-A.example ')?.id).toBe('USR-001');
    expect(findUserByEmail('nobody@hospice-a.example')).toBeUndefined();
    expect(findUserByEmail('')).toBeUndefined();
  });

  it('grants permissions by role: every hospice user can act, vendors cannot log in', () => {
    for (const user of users()) {
      if (user.orgType === 'hospice') {
        expect(can(user, 'storefront:purchase'), user.id).toBe(true);
      } else {
        expect(permissionsFor(user), user.id).toEqual([]);
      }
    }
  });

  it('scopes management permissions to senior roles only', () => {
    for (const user of users()) {
      const senior = user.role === 'hospice_admin' || user.role === 'director_of_nursing';
      expect(can(user, 'reporting'), user.id).toBe(senior);
      expect(can(user, 'vendors:manage'), user.id).toBe(user.role === 'hospice_admin');
    }
  });

  it('offers four Sample Hospice A demo accounts on the login page', () => {
    const demo = DEMO_ACCOUNT_IDS.map((id) => users().find((u) => u.id === id));
    expect(demo).toHaveLength(4);
    for (const user of demo) {
      expect(user?.orgId).toBe('HSP-001');
    }
  });
});
