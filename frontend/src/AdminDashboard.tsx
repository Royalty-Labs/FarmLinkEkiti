import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./api/client";
import type { FarmerProfile } from "./types";

type AdminProfile = FarmerProfile & {
  user: {
    id: string;
    full_name: string;
    email: string;
  };
};

type ReviewStatus = "pending" | "approved" | "rejected";
type FilterStatus = "all" | ReviewStatus;

type AdminDashboardProps = {
  onMessage: (message: string) => void;
  onError: (message: string) => void;
};

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function AdminDashboard({
  onMessage,
  onError,
}: AdminDashboardProps) {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("pending");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);

    try {
      const result = await apiRequest<AdminProfile[]>(
        "/admin/farmer-profiles",
      );
      setProfiles(result);
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Could not load farmer applications.",
      );
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  async function reviewProfile(
    profile: AdminProfile,
    verificationStatus: "approved" | "rejected",
  ) {
    const reason = (reasons[profile.id] ?? "").trim();

    if (verificationStatus === "rejected" && !reason) {
      onError("Enter a reason before rejecting this application.");
      return;
    }

    setBusyId(profile.id);

    try {
      const updated = await apiRequest<AdminProfile>(
        `/admin/farmer-profiles/${profile.id}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({
            verification_status: verificationStatus,
            rejection_reason:
              verificationStatus === "rejected" ? reason : null,
          }),
        },
      );

      setProfiles((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setRejectingId(null);
      setReasons((current) => {
        const next = { ...current };
        delete next[profile.id];
        return next;
      });
      onMessage(
        verificationStatus === "approved"
          ? `${profile.farm_name} has been approved.`
          : `${profile.farm_name} has been rejected.`,
      );
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Could not review this farmer.",
      );
      await loadProfiles();
    } finally {
      setBusyId(null);
    }
  }

  const counts = {
    all: profiles.length,
    pending: profiles.filter(
      (profile) => profile.verification_status === "pending",
    ).length,
    approved: profiles.filter(
      (profile) => profile.verification_status === "approved",
    ).length,
    rejected: profiles.filter(
      (profile) => profile.verification_status === "rejected",
    ).length,
  };

  const visibleProfiles =
    filter === "all"
      ? profiles
      : profiles.filter((profile) => profile.verification_status === filter);

  return (
    <section className="dashboard-section admin-dashboard">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">FARMLINK EKITI · ADMINISTRATION</span>
          <h1>Admin dashboard</h1>
          <p>Review farmer applications and manage verification decisions.</p>
        </div>
        <button
          className="button button-outline"
          onClick={() => void loadProfiles()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      <div className="admin-stats">
        <article className="admin-stat">
          <span>Total applications</span>
          <strong>{counts.all}</strong>
        </article>
        <article className="admin-stat">
          <span>Awaiting review</span>
          <strong>{counts.pending}</strong>
        </article>
        <article className="admin-stat">
          <span>Approved</span>
          <strong>{counts.approved}</strong>
        </article>
        <article className="admin-stat">
          <span>Rejected</span>
          <strong>{counts.rejected}</strong>
        </article>
      </div>

      <section className="panel admin-review-panel">
        <div className="panel-heading admin-review-heading">
          <div>
            <h2>Farmer applications</h2>
            <p>Check the submitted details before making a decision.</p>
          </div>
          <label className="admin-filter">
            <span>Show</span>
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as FilterStatus)
              }
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All applications</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className="muted-copy">Loading farmer applications…</p>
        ) : visibleProfiles.length === 0 ? (
          <div className="admin-empty-state">
            <h3>No applications here yet</h3>
            <p>
              {filter === "pending"
                ? "New farmer applications awaiting review will appear here."
                : `No ${filter === "all" ? "" : filter + " "}applications found.`}
            </p>
          </div>
        ) : (
          <div className="admin-applications">
            {visibleProfiles.map((profile) => (
              <article className="admin-application" key={profile.id}>
                <div className="admin-application-top">
                  <div>
                    <span className="eyebrow">
                      Submitted {dateLabel(profile.created_at)}
                    </span>
                    <h3>{profile.farm_name}</h3>
                    <p className="admin-applicant-name">
                      {profile.user.full_name}
                    </p>
                  </div>
                  <span
                    className={`status status-${profile.verification_status}`}
                  >
                    {profile.verification_status}
                  </span>
                </div>

                <div className="admin-details-grid">
                  <div>
                    <span>Applicant email</span>
                    <strong>{profile.user.email}</strong>
                  </div>
                  <div>
                    <span>Phone number</span>
                    <strong>{profile.phone}</strong>
                  </div>
                  <div>
                    <span>Town / city</span>
                    <strong>{profile.town}</strong>
                  </div>
                  <div>
                    <span>State</span>
                    <strong>{profile.state}</strong>
                  </div>
                  <div className="admin-address">
                    <span>Farm address</span>
                    <strong>{profile.address || "Not provided"}</strong>
                  </div>
                </div>

                {profile.rejection_reason && (
                  <p className="admin-rejection-note">
                    <strong>Previous rejection reason:</strong>{" "}
                    {profile.rejection_reason}
                  </p>
                )}

                {profile.verification_status === "pending" && (
                  <div className="admin-review-actions">
                    {rejectingId === profile.id ? (
                      <div className="admin-rejection-form">
                        <label>
                          Reason for rejection
                          <textarea
                            rows={3}
                            maxLength={1000}
                            value={reasons[profile.id] ?? ""}
                            onChange={(event) =>
                              setReasons((current) => ({
                                ...current,
                                [profile.id]: event.target.value,
                              }))
                            }
                            placeholder="Explain what needs to be corrected..."
                          />
                        </label>
                        <div className="admin-action-buttons">
                          <button
                            className="button button-danger"
                            disabled={busyId === profile.id}
                            onClick={() =>
                              void reviewProfile(profile, "rejected")
                            }
                          >
                            {busyId === profile.id
                              ? "Submitting…"
                              : "Confirm rejection"}
                          </button>
                          <button
                            className="button button-outline"
                            disabled={busyId === profile.id}
                            onClick={() => setRejectingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="admin-action-buttons">
                        <button
                          className="button button-primary"
                          disabled={busyId === profile.id}
                          onClick={() =>
                            void reviewProfile(profile, "approved")
                          }
                        >
                          {busyId === profile.id
                            ? "Saving…"
                            : "Approve farmer"}
                        </button>
                        <button
                          className="button button-outline"
                          disabled={busyId === profile.id}
                          onClick={() => setRejectingId(profile.id)}
                        >
                          Reject application
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
