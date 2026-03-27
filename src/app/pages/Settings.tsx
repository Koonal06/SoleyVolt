import { useEffect, useState } from "react";
import { User, Lock, Globe, Shield, Bell } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import {
  getMyProfile,
  getMySettings,
  updateMyProfile,
  updateMySettings,
} from "../../lib/supabase-data";
import { getStoredLanguage, setStoredLanguage } from "../lib/language";

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
};

type NotificationForm = {
  email: boolean;
  push: boolean;
  transactions: boolean;
};

export function Settings() {
  const { user, userType } = useAuth();
  const [lang, setLang] = useState<"en" | "fr" | "cr">(() => getStoredLanguage());
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [notifications, setNotifications] = useState<NotificationForm>({
    email: true,
    push: false,
    transactions: true,
  });
  const [profile, setProfile] = useState<ProfileForm>({
    name: "",
    email: user?.email ?? "",
    phone: "",
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const [profileData, settingsData] = await Promise.all([getMyProfile(), getMySettings()]);

        if (!active) {
          return;
        }

        setProfile({
          name: profileData?.full_name ?? "",
          email: user?.email ?? "",
          phone: profileData?.phone ?? "",
        });
        setLang(profileData?.language ?? getStoredLanguage());
        setMfaEnabled(settingsData?.mfa_enabled ?? false);
        setNotifications({
          email: settingsData?.email_notifications ?? true,
          push: settingsData?.push_notifications ?? false,
          transactions: settingsData?.transaction_alerts ?? true,
        });
      } catch (err) {
        if (!active) {
          return;
        }

        setErrorMessage(err instanceof Error ? err.message : "Unable to load settings.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, [user?.email]);

  const clearMessages = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleProfileSave = async () => {
    try {
      setIsSavingProfile(true);
      clearMessages();

      await updateMyProfile({
        full_name: profile.name.trim() || null,
        phone: profile.phone.trim() || null,
      });

      if (profile.email !== (user?.email ?? "")) {
        const { error } = await supabase!.auth.updateUser({ email: profile.email.trim() });

        if (error) {
          throw error;
        }
      }

      setStatusMessage("Profile updated successfully.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to save profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePreferenceSave = async () => {
    try {
      setIsSavingPreferences(true);
      clearMessages();

      await Promise.all([
        updateMyProfile({ language: lang }),
        updateMySettings({
          email_notifications: notifications.email,
          push_notifications: notifications.push,
          transaction_alerts: notifications.transactions,
          mfa_enabled: mfaEnabled,
        }),
      ]);

      setStoredLanguage(lang);

      setStatusMessage("Preferences saved successfully.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to save preferences.");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!password) {
      setErrorMessage("Enter a new password.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("New password and confirmation do not match.");
      return;
    }

    try {
      setIsSavingPassword(true);
      clearMessages();

      const { error } = await supabase!.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setPassword("");
      setConfirmPassword("");
      setStatusMessage("Password updated successfully.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {statusMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <User className="h-6 w-6 text-amber-500" />
          <h3 className="text-blue-900">Profile Information</h3>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Current user type: <span className="font-medium capitalize">{userType ?? "prosumer"}</span>
          </div>
          <div>
            <label className="mb-2 block text-blue-900">Full Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="mb-2 block text-blue-900">Email</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="mb-2 block text-blue-900">Phone Number</label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleProfileSave}
            disabled={isLoading || isSavingProfile}
            className="rounded-lg bg-amber-500 px-6 py-2 text-blue-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isSavingProfile ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Lock className="h-6 w-6 text-amber-500" />
          <h3 className="text-blue-900">Security</h3>
        </div>
        <div className="space-y-6">
          <div>
            <h4 className="mb-4 text-blue-900">Change Password</h4>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-blue-900">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a new password"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-blue-900">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                onClick={handlePasswordUpdate}
                disabled={isSavingPassword}
                className="rounded-lg bg-blue-900 px-6 py-2 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSavingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-emerald-600" />
                <div>
                  <h4 className="text-blue-900">Two-Factor Authentication</h4>
                  <p className="text-sm text-gray-600">Store your MFA preference in the backend settings record</p>
                </div>
              </div>
              <button
                onClick={() => setMfaEnabled(!mfaEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  mfaEnabled ? "bg-emerald-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mfaEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Globe className="h-6 w-6 text-amber-500" />
          <h3 className="text-blue-900">Language Preferences</h3>
        </div>
        <div>
          <label className="mb-2 block text-blue-900">Select Language</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "en" | "fr" | "cr")}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="en">English</option>
            <option value="fr">Francais</option>
            <option value="cr">Kreol</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Bell className="h-6 w-6 text-amber-500" />
          <h3 className="text-blue-900">Notifications</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 py-3">
            <div>
              <h4 className="text-blue-900">Email Notifications</h4>
              <p className="text-sm text-gray-600">Receive updates via email</p>
            </div>
            <button
              onClick={() => setNotifications({ ...notifications, email: !notifications.email })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications.email ? "bg-emerald-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications.email ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-gray-100 py-3">
            <div>
              <h4 className="text-blue-900">Push Notifications</h4>
              <p className="text-sm text-gray-600">Receive push notifications on your device</p>
            </div>
            <button
              onClick={() => setNotifications({ ...notifications, push: !notifications.push })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications.push ? "bg-emerald-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications.push ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <h4 className="text-blue-900">Transaction Alerts</h4>
              <p className="text-sm text-gray-600">Get notified for all transactions</p>
            </div>
            <button
              onClick={() => setNotifications({ ...notifications, transactions: !notifications.transactions })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications.transactions ? "bg-emerald-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications.transactions ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <button
            onClick={handlePreferenceSave}
            disabled={isLoading || isSavingPreferences}
            className="rounded-lg bg-amber-500 px-6 py-2 text-blue-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            {isSavingPreferences ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
