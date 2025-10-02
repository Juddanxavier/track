/** @format */

import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';

const statements = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statements);

export const roles = {
  admin: ac.newRole({
    user: [
      'create',
      'list',
      'set-role',
      'ban',
      'impersonate',
      'delete',
      'set-password',
      'get',
      'update',
    ],
  }),
  customer: ac.newRole({
    user: [
      // Allow typical self-service actions only
      'set-password',
      'get',
      'update',
    ],
  }),
};
