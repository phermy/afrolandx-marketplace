import type { User } from '@/types';

// Helper functions for role checking in multi-role system
export const hasRole = (user: User | undefined, role: string): boolean => {
  if (!user || !user.roles) return false;
  return Array.isArray(user.roles) && user.roles.includes(role);
};

export const hasAnyRole = (user: User | undefined, roles: string[]): boolean => {
  if (!user || !user.roles) return false;
  return Array.isArray(user.roles) && roles.some(role => user.roles.includes(role));
};

export const isAdmin = (user: User | undefined): boolean => {
  return hasRole(user, 'admin');
};

export const isVendor = (user: User | undefined): boolean => {
  return hasRole(user, 'vendor');
};

export const isCustomer = (user: User | undefined): boolean => {
  return hasRole(user, 'customer');
};

export const getUserRoleDisplay = (user: User | undefined): string => {
  if (!user || !user.roles) return 'Customer';
  
  const roles = user.roles as string[];
  const roleLabels: { [key: string]: string } = {
    admin: 'Admin',
    vendor: 'Vendor',
    customer: 'Customer'
  };
  
  return roles
    .map(role => roleLabels[role] || role)
    .join(', ');
};

export const toggleUserRole = (currentRoles: string[], role: string): string[] => {
  const roles = [...currentRoles];
  const index = roles.indexOf(role);
  
  if (index > -1) {
    // Remove role, but always keep at least customer
    roles.splice(index, 1);
    if (roles.length === 0) {
      roles.push('customer');
    }
  } else {
    // Add role
    roles.push(role);
  }
  
  return roles;
};