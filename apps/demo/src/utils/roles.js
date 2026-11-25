import { UserRole } from '../app/config/enums';

export const isSuperadmin = (user) => user?.role === UserRole.SUPERADMIN;

export const homePathFor = (user) => (isSuperadmin(user) ? '/admin' : '/app');
