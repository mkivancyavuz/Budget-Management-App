"use client";

import React, { useEffect, useRef, useState } from "react";
import { LogOut, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { AVATAR_COLORS, avatarInfo, displayIdentity } from "@/lib/profile";
import { Card, Button, ErrorBanner } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { PasswordField } from "@/components/PasswordField";

const inputCls =
  "w-full rounded-xl border border-app-border bg-glass text-app-text px-3 py-2.5 text-sm placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent/50 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4 last:mb-0">
      <span className="block text-sm font-medium text-app-text-secondary mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export default function ProfilePage() {
  const { user, signOut, refresh } = useAuth();
  const { t, lang } = useLanguage();

  const memberSince = user?.created_at
    ? new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-US", { dateStyle: "long" }).format(
        new Date(user.created_at)
      )
    : null;

  const currentAvatar = avatarInfo(user);

  // Edit profile (username + fallback-avatar color/initials, saved together)
  const [username, setUsername] = useState((user?.user_metadata?.username as string) ?? "");
  const [avatarColor, setAvatarColor] = useState(currentAvatar.color);
  const [avatarInitials, setAvatarInitials] = useState(
    (user?.user_metadata?.avatar_initials as string) ?? ""
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // user loads asynchronously (see lib/auth.tsx) — sync the fields once it
  // arrives instead of leaving them stuck on the empty initial state.
  useEffect(() => {
    if (!user) return;
    setUsername((user.user_metadata?.username as string) ?? "");
    setAvatarColor(avatarInfo(user).color);
    setAvatarInitials((user.user_metadata?.avatar_initials as string) ?? "");
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    if (!username.trim()) {
      setProfileError(t("err_username_required"));
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/account/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          avatarColor,
          avatarInitials: avatarInitials.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        setProfileError(body.error ?? "Something went wrong.");
      } else {
        setProfileSuccess(true);
        await refresh();
      }
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setProfileSaving(false);
    }
  }

  // Profile photo upload / removal
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  function avatarErrorMessage(code: string | undefined, fallback: string) {
    if (code === "invalid_type") return t("err_avatar_invalid_type");
    if (code === "too_large") return t("err_avatar_too_large");
    return t("err_avatar_failed", { error: code ?? fallback });
  }

  async function handleUploadAvatar(file: File) {
    setAvatarError(null);
    setAvatarBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/account/avatar", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        setAvatarError(avatarErrorMessage(body.error, res.statusText));
      } else {
        await refresh();
      }
    } catch (e) {
      setAvatarError(avatarErrorMessage(undefined, e instanceof Error ? e.message : String(e)));
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setAvatarError(null);
    setAvatarBusy(true);
    try {
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        setAvatarError(avatarErrorMessage(body.error, res.statusText));
      } else {
        await refresh();
      }
    } catch (e) {
      setAvatarError(avatarErrorMessage(undefined, e instanceof Error ? e.message : String(e)));
    } finally {
      setAvatarBusy(false);
    }
  }

  // Change password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError(t("err_password_short"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("err_password_mismatch"));
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/account/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        setPasswordError(body.error ?? "Something went wrong.");
      } else {
        setPasswordSuccess(true);
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPasswordSaving(false);
    }
  }

  // Delete account — requires the account password, entered twice.
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordConfirm, setDeletePasswordConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canDelete = deletePassword.length > 0 && deletePasswordConfirm.length > 0;

  function closeDeleteModal() {
    setDeleteModalOpen(false);
    setDeletePassword("");
    setDeletePasswordConfirm("");
    setDeleteError(null);
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    if (deletePassword !== deletePasswordConfirm) {
      setDeleteError(t("err_password_mismatch"));
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(
          body.error === "invalid_password"
            ? t("err_delete_wrong_password")
            : t("err_delete_failed", { error: body.error ?? res.statusText })
        );
        setDeleting(false);
        return;
      }
      await signOut();
    } catch (e) {
      setDeleteError(t("err_delete_failed", { error: e instanceof Error ? e.message : String(e) }));
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-app-text">{t("profile_title")}</h1>
        <p className="text-sm text-app-text-secondary mt-1">{t("profile_subtitle")}</p>
      </div>

      {/* Account header spans the full width; the editing sections below sit
          in a responsive grid so wide monitors show two or three side by side
          instead of one narrow column hugging the left edge. */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex items-center gap-5 min-w-0 flex-1">
            <Avatar user={user} size={88} textClassName="text-3xl" />
            <div className="min-w-0">
              <p className="text-xl font-semibold text-app-text truncate" title={displayIdentity(user)}>
                {displayIdentity(user)}
              </p>
              {user?.user_metadata?.username ? (
                <p className="text-sm text-app-text-secondary truncate">{user.email}</p>
              ) : null}
              {memberSince && (
                <p className="text-xs text-app-text-muted mt-1">{t("profile_member_since", { date: memberSince })}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:w-44 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadAvatar(file);
              }}
            />
            <Button
              variant="secondary"
              disabled={avatarBusy}
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload size={14} />
              {avatarBusy ? t("avatar_uploading") : t("avatar_upload")}
            </Button>
            {currentAvatar.url && (
              <Button variant="ghost" disabled={avatarBusy} onClick={() => void handleRemoveAvatar()} className="w-full">
                {t("avatar_remove")}
              </Button>
            )}
            <p className="text-[11px] leading-snug text-app-text-muted">{t("avatar_hint")}</p>
          </div>
        </div>

        {avatarError && (
          <div className="mt-4">
            <ErrorBanner message={avatarError} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 items-start">
        <Card>
          <h2 className="text-sm font-semibold text-app-text mb-4">{t("profile_edit_title")}</h2>
          <form onSubmit={handleSaveProfile}>
            {profileError && (
              <div className="mb-4">
                <ErrorBanner message={profileError} />
              </div>
            )}
            {profileSuccess && <p className="text-sm text-app-success mb-4">{t("profile_saved")}</p>}
            <Field label={t("username")}>
              <input
                className={inputCls}
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setProfileSuccess(false);
                }}
                placeholder={t("username_placeholder")}
                autoComplete="username"
              />
            </Field>

            <div className="pt-4 mt-1 border-t border-app-border">
              <p className="text-xs text-app-text-muted mb-4">{t("avatar_no_photo_hint")}</p>
              <Field label={t("avatar_color")}>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={color}
                      onClick={() => {
                        setAvatarColor(color);
                        setProfileSuccess(false);
                      }}
                      style={{ backgroundColor: color }}
                      className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${
                        avatarColor === color ? "ring-2 ring-offset-2 ring-offset-app-bg ring-app-text" : ""
                      }`}
                    />
                  ))}
                </div>
              </Field>
              <Field label={t("avatar_initials")}>
                <input
                  className={inputCls}
                  type="text"
                  maxLength={2}
                  value={avatarInitials}
                  onChange={(e) => {
                    setAvatarInitials(e.target.value);
                    setProfileSuccess(false);
                  }}
                  placeholder={t("avatar_initials_placeholder")}
                />
              </Field>
            </div>

            <Button type="submit" className="w-full mt-4" disabled={profileSaving}>
              {profileSaving ? "…" : t("save_changes")}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-app-text mb-4">{t("password_section_title")}</h2>
          <form onSubmit={handleChangePassword}>
            {passwordError && (
              <div className="mb-4">
                <ErrorBanner message={passwordError} />
              </div>
            )}
            {passwordSuccess && <p className="text-sm text-app-success mb-4">{t("password_saved")}</p>}
            <PasswordField
              label={t("new_password")}
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <PasswordField
              label={t("confirm_password")}
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            <Button type="submit" className="w-full mt-4" disabled={passwordSaving}>
              {passwordSaving ? "…" : t("save_changes")}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-app-text mb-2">{t("sign_out_section_title")}</h2>
            <p className="text-sm text-app-text-secondary mb-4">{t("sign_out_desc")}</p>
            <Button variant="secondary" onClick={() => void signOut()} className="w-full">
              <LogOut size={14} />
              {t("sign_out")}
            </Button>
          </Card>

          <Card className="border-app-danger/30">
            <h2 className="text-sm font-semibold text-app-danger mb-2">{t("danger_zone_title")}</h2>
            <p className="text-sm text-app-text-secondary mb-4">{t("delete_account_desc")}</p>
            <Button variant="danger" onClick={() => setDeleteModalOpen(true)} className="w-full">
              <Trash2 size={14} />
              {t("delete_account")}
            </Button>
          </Card>
        </div>
      </div>

      {deleteModalOpen && (
        <Modal title={t("delete_account_confirm_title")} onClose={closeDeleteModal}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleDeleteAccount();
            }}
          >
            {deleteError && (
              <div className="mb-4">
                <ErrorBanner message={deleteError} />
              </div>
            )}
            <p className="text-sm text-app-text-secondary mb-4">{t("delete_account_confirm_password_body")}</p>
            <PasswordField
              label={t("auth_password")}
              value={deletePassword}
              onChange={setDeletePassword}
              required
            />
            <PasswordField
              label={t("delete_account_confirm_password_again")}
              value={deletePasswordConfirm}
              onChange={setDeletePasswordConfirm}
              required
            />
            <Button type="submit" variant="danger" className="w-full mt-1" disabled={!canDelete || deleting}>
              <Trash2 size={14} />
              {deleting ? t("deleting") : t("delete_account_button")}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
