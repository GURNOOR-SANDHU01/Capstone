import React, { useState } from 'react';
import { Users, Search, ShieldAlert, Loader2 } from 'lucide-react';
import { PageHeader, EmptyState, LoadState } from '../ui';
import { PageTransition } from '../animations';
import { useAsyncData } from '../../hooks/useAsyncData';
import { describeError } from '../../services/apiClient';
import { adminUsersLive, listAllUsers, changeUserRole, setUserActive } from '../../services/adminUsersApi';

const ROLE_OPTIONS = ['patient', 'doctor', 'admin'];

/**
 * Admin: every account with its role and status. Role changes and (de)activation are applied
 * by the server (custom claims + Firebase Auth), revoke the user's sessions, and are audit-logged.
 */
export default function AdminUserMgmtView({ currentUser, onNotification }) {
  const users = useAsyncData(() => (adminUsersLive() ? listAllUsers() : Promise.resolve([])), [], []);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [pending, setPending] = useState(null); // { uid, kind: 'role'|'status', value, label }

  const list = (users.data || []).filter((u) => {
    const q = query.trim().toLowerCase();
    const matches = !q || (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    return matches && (roleFilter === 'all' || u.role === roleFilter);
  });

  const apply = async () => {
    const p = pending;
    setPending(null);
    setBusyId(p.uid);
    try {
      if (p.kind === 'role') await changeUserRole(p.uid, p.value);
      else await setUserActive(p.uid, p.value);
      users.setData((prev) =>
        (prev || []).map((u) =>
          u.id === p.uid
            ? p.kind === 'role'
              ? { ...u, role: p.value }
              : { ...u, account_status: p.value ? 'active' : 'deactivated' }
            : u
        )
      );
      onNotification?.('User Updated', p.kind === 'role' ? 'Role changed. The user must sign in again.' : p.value ? 'Account reactivated.' : 'Account deactivated and signed out everywhere.');
    } catch (err) {
      onNotification?.('Update Failed', describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PageHeader
          title="User & Role Management"
          icon={Users}
          description="Assign roles and activate or deactivate accounts. Every change is enforced server-side, ends the user's sessions and is written to the audit log."
        />

        {!adminUsersLive() ? (
          <EmptyState icon={Users} title="Not available in Sandbox mode" description="User management needs the live backend." />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div className="input-group" style={{ flex: 1, minWidth: 220 }}>
                <span className="input-icon-left"><Search size={16} /></span>
                <input className="input-field" placeholder="Search by name or email..." value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <select className="input-field" style={{ width: 160 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
                <option value="all">All roles</option>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {pending && (
              <div className="card" role="alertdialog" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFF8EC', flexWrap: 'wrap' }}>
                <ShieldAlert size={18} color="#B9770E" />
                <span style={{ flex: 1, fontSize: 13 }}>{pending.label}</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setPending(null)}>Cancel</button>
                <button type="button" className={`btn btn-sm ${pending.kind === 'status' && !pending.value ? 'btn-danger' : 'btn-primary'}`} onClick={apply}>Confirm</button>
              </div>
            )}

            <LoadState loading={users.loading} error={users.error} onRetry={users.reload} label="Loading users..." />

            {!users.loading && !users.error && (
              <div className="card" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                      {['Name', 'Email', 'Role', 'Status', ''].map((h) => (
                        <th key={h} style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((u) => {
                      const isSelf = u.id === currentUser?.uid;
                      const active = u.account_status !== 'deactivated';
                      return (
                        <tr key={u.id} style={{ opacity: active ? 1 : 0.6 }}>
                          <td style={{ padding: '8px' }}>{u.full_name || '-'}{isSelf && <span className="badge badge-muted" style={{ marginLeft: 6, fontSize: 10 }}>you</span>}</td>
                          <td style={{ padding: '8px' }}>{u.email || '-'}</td>
                          <td style={{ padding: '8px' }}>
                            <select
                              className="input-field"
                              style={{ padding: '4px 8px', height: 'auto' }}
                              value={u.role}
                              disabled={isSelf || busyId === u.id}
                              aria-label={`Role for ${u.email || u.id}`}
                              onChange={(e) => setPending({ uid: u.id, kind: 'role', value: e.target.value, label: `Change ${u.email || u.full_name} from ${u.role} to ${e.target.value}? They will be signed out.` })}
                            >
                              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span className={`badge ${active ? 'badge-primary' : 'badge-muted'}`}>{active ? 'Active' : 'Deactivated'}</span>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>
                            {busyId === u.id ? (
                              <Loader2 size={16} className="spin-anim" />
                            ) : (
                              !isSelf && (
                                <button
                                  type="button"
                                  className={`btn btn-sm ${active ? 'btn-outline' : 'btn-primary'}`}
                                  onClick={() => setPending({ uid: u.id, kind: 'status', value: !active, label: active ? `Deactivate ${u.email || u.full_name}? They will be signed out everywhere and cannot sign in.` : `Reactivate ${u.email || u.full_name}?` })}
                                >
                                  {active ? 'Deactivate' : 'Activate'}
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {list.length === 0 && <p style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-muted)', fontSize: 13 }}>No users match.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
