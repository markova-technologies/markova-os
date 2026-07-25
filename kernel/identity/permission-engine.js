class PermissionEngine {
  static can(context, permission, resourceOwnerId = null) {
    // Super admin or API key can do anything
    if (context.role === 'super_admin' || context.role === 'api') return true;
    
    // Check if permission is in list
    if (context.permissions.includes(permission) || context.permissions.includes('*')) {
      return true;
    }

    // Role-based fallbacks if permissions array isn't populated
    if (context.role === 'admin') {
      if (permission.startsWith('billing:delete') || permission.startsWith('company:delete')) {
        return false;
      }
      return true;
    }

    if (context.role === 'member') {
      // Member can read most things, write only their own
      if (permission.endsWith(':read')) return true;
      if (resourceOwnerId && resourceOwnerId === context.userId) return true;
      return false;
    }

    return false;
  }

  static assertCan(context, permission, resourceOwnerId = null) {
    if (!this.can(context, permission, resourceOwnerId)) {
      throw new Error(`Forbidden: Missing permission ${permission}`);
    }
  }
}

module.exports = PermissionEngine;
