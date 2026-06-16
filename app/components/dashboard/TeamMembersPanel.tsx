'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { PageHeader } from '@/app/components/dashboard/ui';

type TeamMember = {
  id: string;
  email: string;
  created_at: string;
};

type TeamState = {
  canManage: boolean;
  isTeamMember: boolean;
  teamOwnerEmail: string | null;
  members: TeamMember[];
  maxMembers: number;
  reason: string | null;
};

export function TeamMembersPanel() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<TeamState>({
    canManage: false,
    isTeamMember: false,
    teamOwnerEmail: null,
    members: [],
    maxMembers: 0,
    reason: null,
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/team-members', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? t('team', 'loadError'));
        return;
      }
      setState({
        canManage: data.can_manage === true,
        isTeamMember: data.is_team_member === true,
        teamOwnerEmail:
          typeof data.team_owner_email === 'string' ? data.team_owner_email : null,
        members: Array.isArray(data.members) ? data.members : [],
        maxMembers: typeof data.max_members === 'number' ? data.max_members : 0,
        reason: typeof data.reason === 'string' ? data.reason : null,
      });
    } catch {
      setError(t('team', 'loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteEmail.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/team-members', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? t('team', 'inviteError'));
        return;
      }
      setInviteEmail('');
      setSuccess(t('team', 'inviteSuccess', { email: trimmed }));
      setState((prev) => ({
        ...prev,
        members: Array.isArray(data.members) ? data.members : prev.members,
        maxMembers:
          typeof data.max_members === 'number' ? data.max_members : prev.maxMembers,
      }));
    } catch {
      setError(t('team', 'inviteError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (memberEmail: string) => {
    if (!confirm(t('team', 'removeConfirm', { email: memberEmail }))) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/team-members?email=${encodeURIComponent(memberEmail)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? t('team', 'removeError'));
        return;
      }
      setState((prev) => ({
        ...prev,
        members: Array.isArray(data.members) ? data.members : prev.members,
      }));
      setSuccess(t('team', 'removeSuccess'));
    } catch {
      setError(t('team', 'removeError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="dash-card dash-card-lg dash-animate-in flex items-center justify-center py-16">
        <svg
          className="h-8 w-8 dash-spinner"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  if (state.isTeamMember) {
    return (
      <div className="dash-card dash-card-lg dash-animate-in">
        <PageHeader title={t('team', 'title')} description={t('team', 'memberSubtitle')} />
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950">
          {t('team', 'memberBadge')}{' '}
          <span className="font-medium">{state.teamOwnerEmail ?? '—'}</span>
        </div>
        <p className="dash-text-muted mt-4 text-sm">{t('team', 'memberHint')}</p>
      </div>
    );
  }

  if (!state.canManage) {
    return (
      <div className="dash-card dash-card-lg dash-animate-in">
        <PageHeader title={t('team', 'title')} description={t('team', 'unavailableSubtitle')} />
        <p className="dash-text-muted text-sm">
          {state.reason ?? t('team', 'unavailableHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="dash-card dash-card-lg dash-animate-in">
      <PageHeader
        title={t('team', 'title')}
        description={t('team', 'ownerSubtitle')}
      />

      <p className="dash-text-muted mb-6 text-sm">
        {t('team', 'seatsUsage', {
          used: state.members.length,
          max: state.maxMembers,
        })}
      </p>

      <form onSubmit={handleInvite} className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="team-invite-email" className="mb-1.5 block text-sm font-medium text-[var(--dash-fg)]">
            {t('team', 'emailLabel')}
          </label>
          <input
            id="team-invite-email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder={t('team', 'emailPlaceholder')}
            className="dash-input w-full"
            disabled={submitting || state.members.length >= state.maxMembers}
            autoComplete="email"
          />
        </div>
        <button
          type="submit"
          disabled={
            submitting || !inviteEmail.trim() || state.members.length >= state.maxMembers
          }
          className="dash-btn dash-btn-primary shrink-0 sm:mb-0.5"
        >
          {submitting ? t('team', 'inviting') : t('team', 'invite')}
        </button>
      </form>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}

      {state.members.length === 0 ? (
        <p className="dash-text-muted py-8 text-center text-sm">{t('team', 'empty')}</p>
      ) : (
        <ul className="divide-y divide-[var(--dash-border)] rounded-xl border border-[var(--dash-border)]">
          {state.members.map((member) => (
            <li
              key={member.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--dash-fg)]">{member.email}</p>
                <p className="dash-text-muted-sm">
                  {t('team', 'addedOn', {
                    date: new Date(member.created_at).toLocaleDateString(),
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleRemove(member.email)}
                disabled={submitting}
                className="dash-btn dash-btn-secondary shrink-0 text-sm"
              >
                {t('team', 'remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="dash-text-muted mt-6 text-xs leading-relaxed">{t('team', 'footnote')}</p>
    </div>
  );
}
