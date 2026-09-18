import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  listTeamMembers,
  inviteMember,
  changeUserRole,
  assignUserDepartment,
  deactivateUser,
  revokeInvitation,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listDepartments,
  createDepartment,
  deleteDepartment,
  listSessions,
  revokeSession
} from '../api/client';
import {
  Users,
  UserPlus,
  Shield,
  Building,
  Laptop,
  Search,
  Copy,
  Check,
  MoreVertical,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Globe,
  Lock,
  Layers,
  ListFilter,
  CheckCircle2,
  X
} from 'lucide-react';
import './TeamManagement.css';

const TeamManagement = () => {
  const { user: currentUser, role: currentRole, can, isOwner, isAdmin } = useAuth();
  const { addToast } = useToast();

  // Active Tab: 'members' | 'invites' | 'roles' | 'departments' | 'sessions'
  const [activeTab, setActiveTab] = useState('members');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Data states
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [groupByDepartment, setGroupByDepartment] = useState(true); // User Decision 4
  const [collapsedDepts, setCollapsedDepts] = useState({});

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showCustomRoleModal, setShowCustomRoleModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);

  // Modal form states
  const [selectedUserForRole, setSelectedUserForRole] = useState(null);
  const [selectedUserForDept, setSelectedUserForDept] = useState(null);
  const [targetRoleId, setTargetRoleId] = useState('');

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('agent');
  const [inviteDept, setInviteDept] = useState('');
  const [createdInviteResult, setCreatedInviteResult] = useState(null);
  const [copiedInviteId, setCopiedInviteId] = useState(null);

  // New Department Form
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');

  // Custom Role Form
  const [editingRole, setEditingRole] = useState(null);
  const [customRoleName, setCustomRoleName] = useState('');
  const [customRoleDesc, setCustomRoleDesc] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  // 1. Initial Data Fetch
  const fetchData = async () => {
    setLoading(true);
    try {
      const [teamRes, rolesRes, deptsRes, sessionsRes] = await Promise.all([
        listTeamMembers().catch(() => ({ data: { users: [], invitations: [] } })),
        listRoles().catch(() => ({ data: { roles: [], allPermissions: [] } })),
        listDepartments().catch(() => ({ data: { departments: [] } })),
        listSessions().catch(() => ({ data: { sessions: [] } }))
      ]);

      if (teamRes.data?.users) setUsers(teamRes.data.users);
      if (teamRes.data?.invitations) setInvitations(teamRes.data.invitations);
      if (rolesRes.data?.roles) setRoles(rolesRes.data.roles);
      if (rolesRes.data?.allPermissions) setAllPermissions(rolesRes.data.allPermissions);
      if (deptsRes.data?.departments) setDepartments(deptsRes.data.departments);
      if (sessionsRes.data?.sessions) setSessions(sessionsRes.data.sessions);
    } catch (err) {
      console.error('Error loading team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Filtered Members List
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept =
        selectedDeptFilter === 'all' ||
        (selectedDeptFilter === 'none' && !u.department_id) ||
        u.department_id === selectedDeptFilter;

      return matchesSearch && matchesDept;
    });
  }, [users, searchQuery, selectedDeptFilter]);

  // Grouped by Department
  const usersByDepartment = useMemo(() => {
    const groups = {};

    // First, populate all configured departments
    departments.forEach(d => {
      groups[d.id] = {
        id: d.id,
        name: d.name,
        description: d.description,
        members: []
      };
    });

    // Add unassigned group
    groups['unassigned'] = {
      id: 'unassigned',
      name: 'General / Unassigned',
      description: 'Members not assigned to a specific department',
      members: []
    };

    filteredUsers.forEach(u => {
      if (u.department_id && groups[u.department_id]) {
        groups[u.department_id].members.push(u);
      } else {
        groups['unassigned'].members.push(u);
      }
    });

    return groups;
  }, [departments, filteredUsers]);

  // 3. Handlers
  const handleCopyLink = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedInviteId(id);
    addToast('Invite magic link copied to clipboard!', 'success');
    setTimeout(() => setCopiedInviteId(null), 3000);
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setActionLoading(true);
    try {
      const res = await inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
        departmentId: inviteDept || undefined
      });

      if (res.data?.success) {
        addToast(`Invitation created for ${inviteEmail}`, 'success');
        setCreatedInviteResult(res.data.invitation);
        setInviteEmail('');
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to send invitation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    if (!confirm('Are you sure you want to revoke this invitation? The magic link will stop working.')) return;
    try {
      await revokeInvitation(inviteId);
      addToast('Invitation revoked', 'info');
      setInvitations(prev => prev.filter(i => i.id !== inviteId));
    } catch (err) {
      addToast('Failed to revoke invitation', 'error');
    }
  };

  const handleChangeRoleSubmit = async () => {
    if (!selectedUserForRole || !targetRoleId) return;
    setActionLoading(true);
    try {
      await changeUserRole(selectedUserForRole.id, targetRoleId);
      addToast(`Role updated for ${selectedUserForRole.name}`, 'success');
      setShowRoleModal(false);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to update member role', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignDeptSubmit = async (deptId) => {
    if (!selectedUserForDept) return;
    setActionLoading(true);
    try {
      await assignUserDepartment(selectedUserForDept.id, deptId);
      addToast('Department updated', 'success');
      setSelectedUserForDept(null);
      fetchData();
    } catch (err) {
      addToast('Failed to update department', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async (targetUser) => {
    if (!confirm(`Are you sure you want to deactivate ${targetUser.name}? Their sessions will be immediately terminated.`)) return;
    try {
      await deactivateUser(targetUser.id);
      addToast(`${targetUser.name} deactivated`, 'info');
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to deactivate member', 'error');
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    try {
      const res = await createDepartment({ name: newDeptName.trim(), description: newDeptDesc });
      if (res.data?.success) {
        addToast(`Department "${newDeptName}" created`, 'success');
        setNewDeptName('');
        setNewDeptDesc('');
        setShowDeptModal(false);
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to create department', 'error');
    }
  };

  const handleDeleteDepartment = async (deptId) => {
    if (!confirm('Are you sure you want to delete this department? Members will become unassigned.')) return;
    try {
      await deleteDepartment(deptId);
      addToast('Department deleted', 'info');
      fetchData();
    } catch (err) {
      addToast('Failed to delete department', 'error');
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      await revokeSession(sessionId);
      addToast('Session terminated and revoked', 'info');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      addToast('Failed to revoke session', 'error');
    }
  };

  const handleSaveCustomRole = async (e) => {
    e.preventDefault();
    if (!customRoleName.trim()) return;

    setActionLoading(true);
    try {
      if (editingRole) {
        await updateRole(editingRole.id, {
          displayName: customRoleName,
          description: customRoleDesc,
          permissions: selectedPermissions
        });
        addToast(`Role "${customRoleName}" updated`, 'success');
      } else {
        await createRole({
          displayName: customRoleName,
          description: customRoleDesc,
          permissions: selectedPermissions
        });
        addToast(`Custom role "${customRoleName}" created`, 'success');
      }
      setShowCustomRoleModal(false);
      setEditingRole(null);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save role', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const togglePermission = (action) => {
    setSelectedPermissions(prev =>
      prev.includes(action) ? prev.filter(p => p !== action) : [...prev, action]
    );
  };

  // Group permissions by resource for the modal
  const permissionsByResource = useMemo(() => {
    const grouped = {};
    allPermissions.forEach(p => {
      if (!grouped[p.resource]) grouped[p.resource] = [];
      grouped[p.resource].push(p);
    });
    return grouped;
  }, [allPermissions]);

  return (
    <div className="team-container">
      {/* Header */}
      <div className="team-header">
        <div>
          <h1 className="team-header-title">Team & Organization</h1>
          <p className="team-header-subtitle">
            Manage organization members, role-based access control (RBAC), departments, and active sessions.
          </p>
        </div>

        <div className="team-header-actions">
          {can('users:invite') && (
            <button
              className="btn-primary"
              onClick={() => {
                setCreatedInviteResult(null);
                setShowInviteModal(true);
              }}
            >
              <UserPlus size={17} />
              <span>Invite Member</span>
            </button>
          )}

          {can('users:manage_roles') && (
            <button
              className="btn-secondary"
              onClick={() => setShowDeptModal(true)}
            >
              <Building size={16} />
              <span>Departments</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="team-tabs">
        <button
          className={`team-tab-btn ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          <Users size={17} />
          <span>Members</span>
          <span className="tab-badge">{users.length}</span>
        </button>

        <button
          className={`team-tab-btn ${activeTab === 'invites' ? 'active' : ''}`}
          onClick={() => setActiveTab('invites')}
        >
          <UserPlus size={17} />
          <span>Pending Invites</span>
          {invitations.length > 0 && <span className="tab-badge">{invitations.length}</span>}
        </button>

        <button
          className={`team-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          <Shield size={17} />
          <span>Roles & Permissions</span>
          <span className="tab-badge">{roles.length}</span>
        </button>

        <button
          className={`team-tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
          onClick={() => setActiveTab('departments')}
        >
          <Building size={17} />
          <span>Departments</span>
          <span className="tab-badge">{departments.length}</span>
        </button>

        <button
          className={`team-tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <Laptop size={17} />
          <span>Active Sessions</span>
          <span className="tab-badge">{sessions.length}</span>
        </button>
      </div>

      {/* Stat Cards */}
      <div className="team-stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
            <Users size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Members</span>
            <span className="stat-value">{users.length}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Clock size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Pending Invites</span>
            <span className="stat-value">{invitations.length}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc' }}>
            <Shield size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Configured Roles</span>
            <span className="stat-value">{roles.length}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <Building size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Departments</span>
            <span className="stat-value">{departments.length}</span>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: MEMBERS LIST (With Department Grouping & Flat List Toggle)   */}
      {/* =================================================================== */}
      {activeTab === 'members' && (
        <div>
          {/* Controls Bar */}
          <div className="team-controls-bar">
            <div className="search-input-wrapper">
              <Search size={16} className="search-input-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Department Dropdown Filter */}
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '9px',
                  color: '#e2e8f0',
                  padding: '0.55rem 0.85rem',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                <option value="all">All Departments</option>
                <option value="none">Unassigned</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              {/* View Mode Toggle (Department Grouping - User Decision 4) */}
              <div className="view-toggle-group">
                <button
                  type="button"
                  className={`view-toggle-btn ${groupByDepartment ? 'active' : ''}`}
                  onClick={() => setGroupByDepartment(true)}
                  title="Group members by department"
                >
                  <Layers size={14} />
                  <span>By Dept</span>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${!groupByDepartment ? 'active' : ''}`}
                  onClick={() => setGroupByDepartment(false)}
                  title="Show flat table of all members"
                >
                  <ListFilter size={14} />
                  <span>Flat List</span>
                </button>
              </div>
            </div>
          </div>

          {/* Department Grouped View */}
          {groupByDepartment ? (
            <div>
              {Object.values(usersByDepartment).map(group => {
                if (group.members.length === 0 && group.id === 'unassigned') return null;
                const isCollapsed = collapsedDepts[group.id];

                return (
                  <div key={group.id} className="department-group-card">
                    <div
                      className="department-group-header"
                      onClick={() => setCollapsedDepts(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                    >
                      <div className="department-group-title">
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        <Building size={16} style={{ color: '#60a5fa' }} />
                        <span>{group.name}</span>
                        <span className="dept-pill">{group.members.length} members</span>
                      </div>
                      {group.description && (
                        <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                          {group.description}
                        </span>
                      )}
                    </div>

                    {!isCollapsed && (
                      <div className="team-table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
                        {group.members.length === 0 ? (
                          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                            No members currently assigned to this department.
                          </div>
                        ) : (
                          <table className="team-table">
                            <thead>
                              <tr>
                                <th>Member</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Last Active</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.members.map(member => (
                                <tr key={member.id}>
                                  <td>
                                    <div className="member-cell">
                                      <div className="member-avatar">
                                        {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                                      </div>
                                      <div className="member-meta">
                                        <span className="member-name">{member.name}</span>
                                        <span className="member-email">{member.email}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span className={`role-badge ${member.role?.toLowerCase() || 'viewer'}`}>
                                      {member.role_display_name || member.role}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`status-dot ${member.status === 'active' ? 'active' : 'deactivated'}`} />
                                    <span style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{member.status}</span>
                                  </td>
                                  <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                    {member.last_active ? new Date(member.last_active).toLocaleString() : 'Never'}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                                      {can('users:manage_roles') && (
                                        <button
                                          className="icon-action-btn"
                                          title="Change Role"
                                          onClick={() => {
                                            setSelectedUserForRole(member);
                                            setTargetRoleId(member.role?.toLowerCase() || 'agent');
                                            setShowRoleModal(true);
                                          }}
                                        >
                                          <Shield size={16} />
                                        </button>
                                      )}

                                      {can('users:manage_roles') && (
                                        <button
                                          className="icon-action-btn"
                                          title="Assign Department"
                                          onClick={() => setSelectedUserForDept(member)}
                                        >
                                          <Building size={16} />
                                        </button>
                                      )}

                                      {can('users:deactivate') && member.role !== 'owner' && member.id !== currentUser?.id && (
                                        <button
                                          className="icon-action-btn danger"
                                          title="Deactivate Member"
                                          onClick={() => handleDeactivate(member)}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Flat Table View */
            <div className="team-table-wrapper">
              <table className="team-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Active</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        No members matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(member => (
                      <tr key={member.id}>
                        <td>
                          <div className="member-cell">
                            <div className="member-avatar">
                              {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="member-meta">
                              <span className="member-name">{member.name}</span>
                              <span className="member-email">{member.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                            {member.department_name || '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`role-badge ${member.role?.toLowerCase() || 'viewer'}`}>
                            {member.role_display_name || member.role}
                          </span>
                        </td>
                        <td>
                          <span className={`status-dot ${member.status === 'active' ? 'active' : 'deactivated'}`} />
                          <span style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{member.status}</span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                          {member.last_active ? new Date(member.last_active).toLocaleString() : 'Never'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                            {can('users:manage_roles') && (
                              <button
                                className="icon-action-btn"
                                title="Change Role"
                                onClick={() => {
                                  setSelectedUserForRole(member);
                                  setTargetRoleId(member.role?.toLowerCase() || 'agent');
                                  setShowRoleModal(true);
                                }}
                              >
                                <Shield size={16} />
                              </button>
                            )}

                            {can('users:manage_roles') && (
                              <button
                                className="icon-action-btn"
                                title="Assign Department"
                                onClick={() => setSelectedUserForDept(member)}
                              >
                                <Building size={16} />
                              </button>
                            )}

                            {can('users:deactivate') && member.role !== 'owner' && member.id !== currentUser?.id && (
                              <button
                                className="icon-action-btn danger"
                                title="Deactivate Member"
                                onClick={() => handleDeactivate(member)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: PENDING INVITATIONS & COPYABLE MAGIC LINKS (User Decision 1)  */}
      {/* =================================================================== */}
      {activeTab === 'invites' && (
        <div>
          <div className="team-controls-bar">
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              Invited members will receive an email via Resend and can also be sent the copyable magic link directly.
            </p>
            {can('users:invite') && (
              <button
                className="btn-primary"
                onClick={() => {
                  setCreatedInviteResult(null);
                  setShowInviteModal(true);
                }}
              >
                <UserPlus size={16} />
                <span>New Invitation</span>
              </button>
            )}
          </div>

          <div className="team-table-wrapper">
            <table className="team-table">
              <thead>
                <tr>
                  <th>Invited Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Invited By</th>
                  <th>Expires</th>
                  <th style={{ textAlign: 'right' }}>Magic Link / Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      No pending invitations. Click "New Invitation" to invite an employee.
                    </td>
                  </tr>
                ) : (
                  invitations.map(inv => (
                    <tr key={inv.id}>
                      <td>
                        <span style={{ fontWeight: 600, color: '#ffffff' }}>{inv.email}</span>
                      </td>
                      <td>
                        <span className={`role-badge ${inv.role_name?.toLowerCase() || 'viewer'}`}>
                          {inv.role_name}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                          {inv.department_name || '—'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                        {inv.invited_by_name || 'Administrator'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          {/* Copy Link Button (User Decision 1) */}
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                            onClick={() => handleCopyLink(inv.invite_url, inv.id)}
                            title="Copy magic link for WhatsApp/Slack/Telegram"
                          >
                            {copiedInviteId === inv.id ? (
                              <>
                                <Check size={14} style={{ color: '#10b981' }} />
                                <span style={{ color: '#10b981' }}>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>

                          {can('users:invite') && (
                            <button
                              className="icon-action-btn danger"
                              title="Revoke Invitation"
                              onClick={() => handleRevokeInvite(inv.id)}
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: ROLES & PERMISSIONS MATRIX                                   */}
      {/* =================================================================== */}
      {activeTab === 'roles' && (
        <div>
          <div className="team-controls-bar">
            <div>
              <h3 style={{ margin: '0 0 0.25rem', color: '#ffffff', fontSize: '1.15rem' }}>Role Definitions & Capabilities</h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                System roles are built-in. Custom roles can be tailored by administrators.
              </p>
            </div>

            {can('users:manage_roles') && (
              <button
                className="btn-primary"
                onClick={() => {
                  setEditingRole(null);
                  setCustomRoleName('');
                  setCustomRoleDesc('');
                  setSelectedPermissions([]);
                  setShowCustomRoleModal(true);
                }}
              >
                <Shield size={16} />
                <span>Create Custom Role</span>
              </button>
            )}
          </div>

          <div className="roles-grid">
            {roles.map(role => {
              const perms = Array.isArray(role.permissions) ? role.permissions : [];
              const isOwnerRole = role.name === 'owner';
              const isAdminRole = role.name === 'admin';

              return (
                <div key={role.id} className="role-card">
                  <div className="role-card-header">
                    <div>
                      <h4 className="role-card-name">{role.display_name || role.name}</h4>
                      <span className={`role-badge ${role.name?.toLowerCase()}`}>
                        {role.is_system ? 'Built-in System Role' : 'Custom Company Role'}
                      </span>
                    </div>

                    {/* Owner can edit Admin permissions as requested in User Decision 3 */}
                    {((isOwner && isAdminRole) || (!role.is_system && can('users:manage_roles'))) && (
                      <button
                        className="icon-action-btn"
                        title="Configure Permissions"
                        onClick={() => {
                          setEditingRole(role);
                          setCustomRoleName(role.display_name || role.name);
                          setCustomRoleDesc(role.description || '');
                          setSelectedPermissions(perms);
                          setShowCustomRoleModal(true);
                        }}
                      >
                        <Edit2 size={15} />
                      </button>
                    )}
                  </div>

                  <p className="role-card-desc">{role.description || 'No description provided.'}</p>

                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Granted Permissions ({isOwnerRole ? 'All' : perms.length})
                    </span>
                  </div>

                  <div className="permissions-chips-list">
                    {isOwnerRole ? (
                      <span className="perm-chip wildcard">* Full System Authority</span>
                    ) : perms.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>No permissions assigned</span>
                    ) : (
                      perms.map(p => (
                        <span key={p} className="perm-chip">
                          {p}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: DEPARTMENTS MANAGEMENT (User Decision 4)                     */}
      {/* =================================================================== */}
      {activeTab === 'departments' && (
        <div>
          <div className="team-controls-bar">
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              Group employees and AI agents by department (Sales, Customer Support, Billing, Operations).
            </p>
            {can('users:manage_roles') && (
              <button
                className="btn-primary"
                onClick={() => setShowDeptModal(true)}
              >
                <Building size={16} />
                <span>Add Department</span>
              </button>
            )}
          </div>

          <div className="team-table-wrapper">
            <table className="team-table">
              <thead>
                <tr>
                  <th>Department Name</th>
                  <th>Description</th>
                  <th>Assigned Members</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      No departments configured yet. Click "Add Department" to organize your team.
                    </td>
                  </tr>
                ) : (
                  departments.map(d => (
                    <tr key={d.id}>
                      <td>
                        <span style={{ fontWeight: 600, color: '#ffffff' }}>{d.name}</span>
                      </td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {d.description || '—'}
                      </td>
                      <td>
                        <span className="dept-pill">{d.member_count || 0} members</span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {can('users:manage_roles') && (
                          <button
                            className="icon-action-btn danger"
                            title="Delete Department"
                            onClick={() => handleDeleteDepartment(d.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: ACTIVE SESSIONS & SECURITY TRACKING                          */}
      {/* =================================================================== */}
      {activeTab === 'sessions' && (
        <div>
          <div className="team-controls-bar">
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              Live authenticated device sessions for the organization. Terminate unrecognized or stale sessions.
            </p>
          </div>

          <div className="team-table-wrapper">
            <table className="team-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Device / User Agent</th>
                  <th>IP Address</th>
                  <th>Last Active</th>
                  <th>Expires</th>
                  <th style={{ textAlign: 'right' }}>Revocation</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      No active sessions found.
                    </td>
                  </tr>
                ) : (
                  sessions.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div className="member-meta">
                          <span style={{ fontWeight: 600, color: '#ffffff' }}>{s.user_name || 'User'}</span>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{s.user_email}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#cbd5e1', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.device_info?.userAgent || 'Browser Session'}
                      </td>
                      <td style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                        {s.ip_address || '127.0.0.1'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                        {s.last_active ? new Date(s.last_active).toLocaleString() : 'Just now'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                        {new Date(s.expires_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          onClick={() => handleRevokeSession(s.id)}
                        >
                          Revoke Session
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: INVITE MEMBER (With Magic Link Copyable Feature)           */}
      {/* =================================================================== */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Invite Team Member</h3>
              <button className="modal-close-btn" onClick={() => setShowInviteModal(false)}>
                <X size={20} />
              </button>
            </div>

            {createdInviteResult ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem'
                  }}>
                    <CheckCircle2 size={28} />
                  </div>
                  <h4 style={{ color: '#ffffff', margin: '0 0 0.5rem', fontSize: '1.2rem' }}>Invitation Dispatched!</h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>
                    An invite email was queued for <strong>{createdInviteResult.email}</strong>.
                  </p>
                </div>

                {/* Prominent Magic Link Copy Box (User Decision 1) */}
                <div className="magic-link-banner" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Copyable Invitation Link:
                  </span>
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    wordBreak: 'break-all',
                    fontSize: '0.82rem',
                    color: '#e2e8f0',
                    fontFamily: 'monospace'
                  }}>
                    {createdInviteResult.inviteUrl}
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleCopyLink(createdInviteResult.inviteUrl, 'modal-copy')}
                    style={{ marginTop: '0.5rem', justifyContent: 'center' }}
                  >
                    {copiedInviteId === 'modal-copy' ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedInviteId === 'modal-copy' ? 'Copied to Clipboard!' : 'Copy Magic Link to Share (WhatsApp / Slack)'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
                  onClick={() => setShowInviteModal(false)}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="search-input"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Assigned Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '0.92rem',
                      outline: 'none'
                    }}
                  >
                    {roles
                      .filter(r => {
                        // User Decision 3 & Option A: Admin cannot invite Owner or roles with excess perms
                        if (!isOwner && r.name === 'owner') return false;
                        return true;
                      })
                      .map(r => (
                        <option key={r.id} value={r.name}>
                          {r.display_name || r.name} {r.is_system ? '(Built-in)' : '(Custom)'}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Department (Optional)
                  </label>
                  <select
                    value={inviteDept}
                    onChange={(e) => setInviteDept(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '0.92rem',
                      outline: 'none'
                    }}
                  >
                    <option value="">No department (Unassigned)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowInviteModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Creating invite...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: CHANGE MEMBER ROLE                                         */}
      {/* =================================================================== */}
      {showRoleModal && selectedUserForRole && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Change Member Role</h3>
              <button className="modal-close-btn" onClick={() => setShowRoleModal(false)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Assign a new role to <strong>{selectedUserForRole.name}</strong> ({selectedUserForRole.email}).
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Select Role</label>
              <select
                value={targetRoleId}
                onChange={(e) => setTargetRoleId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  outline: 'none'
                }}
              >
                {roles
                  .filter(r => isOwner || r.name !== 'owner')
                  .map(r => (
                    <option key={r.id} value={r.name}>
                      {r.display_name || r.name} {r.is_system ? '(System)' : '(Custom)'}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowRoleModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleChangeRoleSubmit}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : 'Update Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: ASSIGN DEPARTMENT QUICK MODAL                              */}
      {/* =================================================================== */}
      {selectedUserForDept && (
        <div className="modal-overlay" onClick={() => setSelectedUserForDept(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Assign Department</h3>
              <button className="modal-close-btn" onClick={() => setSelectedUserForDept(null)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Choose a department for <strong>{selectedUserForDept.name}</strong>:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button
                type="button"
                className={`btn-secondary ${!selectedUserForDept.department_id ? 'active' : ''}`}
                style={{ justifyContent: 'flex-start' }}
                onClick={() => handleAssignDeptSubmit(null)}
              >
                None (Unassigned)
              </button>
              {departments.map(d => (
                <button
                  key={d.id}
                  type="button"
                  className={`btn-secondary ${selectedUserForDept.department_id === d.id ? 'active' : ''}`}
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => handleAssignDeptSubmit(d.id)}
                >
                  <Building size={15} />
                  <span>{d.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: CREATE / EDIT CUSTOM ROLE & PERMISSIONS                   */}
      {/* =================================================================== */}
      {showCustomRoleModal && (
        <div className="modal-overlay" onClick={() => setShowCustomRoleModal(false)}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingRole ? `Configure Role: ${editingRole.display_name || editingRole.name}` : 'Create Custom Role'}
              </h3>
              <button className="modal-close-btn" onClick={() => setShowCustomRoleModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomRole}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>Role Name</label>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="e.g. Lead Dispatcher, QA Specialist"
                    value={customRoleName}
                    onChange={(e) => setCustomRoleName(e.target.value)}
                    required
                    disabled={editingRole?.is_system}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>Description</label>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Role responsibilities and access description"
                    value={customRoleDesc}
                    onChange={(e) => setCustomRoleDesc(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label className="form-label">Permissions Assignment ({selectedPermissions.length} selected)</label>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Check permissions to grant</span>
                </div>

                <div style={{
                  maxHeight: '280px',
                  overflowY: 'auto',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1rem'
                }}>
                  {Object.entries(permissionsByResource).map(([resource, perms]) => (
                    <div key={resource} style={{ marginBottom: '1rem' }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#60a5fa',
                        letterSpacing: '0.05em',
                        marginBottom: '0.5rem',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        paddingBottom: '3px'
                      }}>
                        {resource}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem' }}>
                        {perms.map(p => {
                          const isChecked = selectedPermissions.includes(p.action);
                          return (
                            <label
                              key={p.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.82rem',
                                color: isChecked ? '#ffffff' : '#94a3b8',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: isChecked ? 'rgba(37, 99, 235, 0.15)' : 'transparent'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(p.action)}
                              />
                              <span>{p.name || p.action}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCustomRoleModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving Role...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 5: ADD DEPARTMENT MODAL                                      */}
      {/* =================================================================== */}
      {showDeptModal && (
        <div className="modal-overlay" onClick={() => setShowDeptModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create Department</h3>
              <button className="modal-close-btn" onClick={() => setShowDeptModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateDepartment} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>Department Name</label>
                <input
                  type="text"
                  className="search-input"
                  placeholder="e.g. Sales, Customer Support, Billing"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>Description (Optional)</label>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Department scope and duties"
                  value={newDeptDesc}
                  onChange={(e) => setNewDeptDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDeptModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
