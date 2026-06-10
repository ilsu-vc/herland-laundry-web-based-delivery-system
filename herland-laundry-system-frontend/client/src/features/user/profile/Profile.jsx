import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../../lib/supabase";

const API_BASE = `${import.meta.env.VITE_API_URL}/api/v1/customer`;

const Colors = {
  blue: "#3878C2",
  blueMuted: "#5f7f9f",
  secondary: "#63bce6",
  green: "#4bad40",
  skyBd: "#d8ecf8",
  skyFaintSm: "#f3faff",
  white: "#ffffff",
};

const typography = {
  h1: {
    fontSize: "2rem",
    fontWeight: 800,
    color: Colors.blue,
    letterSpacing: "-0.03em",
    margin: 0,
  },
  body: {
    fontSize: "1rem",
    color: Colors.blueMuted,
    margin: 0,
  },
};

const Field = ({
  label,
  value,
  onChange,
  onBlur,
  onFocus,
  readOnly = false,
  type = "text",
  placeholder = "",
  extra,
  isEditing,
  inputMode,
  maxLength,
}) => {
  const disabled = readOnly || !isEditing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: Colors.blueMuted,
        }}
      >
        {label}
      </label>

      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          readOnly={disabled}
          placeholder={disabled ? "" : placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          style={{
            width: "100%",
            padding: "10px 14px",
            paddingRight: extra ? 58 : 14,
            borderRadius: "0.75rem",
            border: `1.5px solid ${disabled ? Colors.skyBd : Colors.blue}`,
            background: readOnly
              ? Colors.skyFaintSm
              : disabled
              ? Colors.skyFaintSm
              : "#fff",
            color: disabled ? Colors.blueMuted : Colors.blue,
            fontSize: "0.9375rem",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
            cursor: disabled ? "default" : "text",
            transition: "border-color 0.15s",
          }}
        />

        {extra}
      </div>
    </div>
  );
};

export default function MyProfile() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [touched, setTouched] = useState({});

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    email: "",
    newPassword: "",
    avatar_url: "",
    role: "Customer",
  });

  const [saved, setSaved] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    email: "",
    newPassword: "",
    avatar_url: "",
    role: "Customer",
  });

  const passwordConditions = {
    length: /.{8,}/,
    lowercase: /[a-z]/,
    uppercase: /[A-Z]/,
    number: /\d/,
    specialChar: /[^A-Za-z0-9]/,
  };

  const checkPasswordConditions = (password) => ({
    length: passwordConditions.length.test(password),
    lowercase: passwordConditions.lowercase.test(password),
    uppercase: passwordConditions.uppercase.test(password),
    number: passwordConditions.number.test(password),
    specialChar: passwordConditions.specialChar.test(password),
  });

  const passwordStatus = checkPasswordConditions(form.newPassword);

  const renderPasswordCondition = (condition, text) => {
    let color = "#b4b4b4";
    let icon = "○";

    if (condition) {
      color = Colors.green;
      icon = "✓";
    } else if (touched.newPassword && !passwordFocused) {
      color = "#ff0000";
      icon = "✗";
    }

    return (
      <li
        style={{
          color,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.8125rem",
          fontWeight: 600,
        }}
      >
        <span style={{ width: 16 }}>{icon}</span>
        <span>{text}</span>
      </li>
    );
  };

  const splitFullName = (fullName = "") => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return {
        firstName: "",
        lastName: "",
      };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
    };
  };

  const fullName = `${saved.firstName} ${saved.lastName}`.trim() || "User";

  const initials =
    [saved.firstName?.[0], saved.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "U";

  const set = (k) => (e) => {
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
  };

  const handleNewPasswordChange = (e) => {
    setForm((prev) => ({
      ...prev,
      newPassword: e.target.value,
    }));

    if (feedback === "New password does not meet the password requirements.") {
      setFeedback("");
    }
  };

  const handleNewPasswordFocus = () => {
    setPasswordFocused(true);
  };

  const handleNewPasswordBlur = () => {
    setTouched((prev) => ({
      ...prev,
      newPassword: true,
    }));
    setPasswordFocused(false);
  };

  const handlePhoneChange = (e) => {
    const numbersOnly = e.target.value.replace(/\D/g, "").slice(0, 11);

    setForm((prev) => ({
      ...prev,
      phone: numbersOnly,
    }));

    if (feedback === "Phone number must start with 09." || feedback === "Phone number must be 11 digits.") {
      setFeedback("");
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      setFeedback("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      const response = await fetch(`${API_BASE}/profile`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load profile.");
      }

      const data = await response.json();

      const nameParts = splitFullName(data.full_name || data.name || "");

      const nextForm = {
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        phone: data.phone_number || data.profile_phone || data.phone || "",
        address: data.address || "",
        email: data.email || session.user?.email || "",
        newPassword: "",
        avatar_url: data.avatar_url || "",
        role: data.role || "Customer",
      };

      setForm(nextForm);
      setSaved(nextForm);
      setAvatarSrc(data.avatar_url || null);
    } catch (error) {
      console.error(error);
      setFeedback(error.message || "Something went wrong while loading profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleEdit = () => {
    setFeedback("");
    setTouched({});
    setPasswordFocused(false);
    setIsEditing(true);
  };

  const handleRemoveAvatar = () => {
    setAvatarSrc(null);

    setForm((prev) => ({
      ...prev,
      avatar_url: "",
    }));

    setFeedback("Profile photo will be removed after you save changes.");
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setFeedback("");

      if (form.phone && !form.phone.startsWith("09")) {
        setFeedback("Phone number must start with 09.");
        return;
      }

      if (form.phone && form.phone.length !== 11) {
        setFeedback("Phone number must be 11 digits.");
        return;
      }

      if (form.newPassword.trim() && !Object.values(passwordStatus).every(Boolean)) {
        setTouched((prev) => ({
          ...prev,
          newPassword: true,
        }));
        setPasswordFocused(false);
        setFeedback("New password does not meet the password requirements.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      const payload = {
        name: `${form.firstName} ${form.lastName}`.trim(),
        phone: form.phone,
        address: form.address,
        avatar_url: form.avatar_url || null,
      };

      if (form.newPassword.trim()) {
        payload.password = form.newPassword.trim();
      }

      const response = await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile.");
      }

      const updatedForm = {
        ...form,
        newPassword: "",
      };

      setSaved(updatedForm);
      setForm(updatedForm);
      setAvatarSrc(updatedForm.avatar_url || null);
      setIsEditing(false);
      setShowPassword(false);
      setTouched({});
      setPasswordFocused(false);
      setFeedback("Profile updated successfully.");

      window.dispatchEvent(new Event("profileUpdated"));
    } catch (error) {
      console.error(error);
      setFeedback(error.message || "Something went wrong while saving profile.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancel = () => {
    setForm({
      ...saved,
      newPassword: "",
    });
    setAvatarSrc(saved.avatar_url || null);
    setShowPassword(false);
    setTouched({});
    setPasswordFocused(false);
    setFeedback("");
    setIsEditing(false);
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      setUploading(true);
      setFeedback("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const response = await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          avatar_url: publicUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile picture.");
      }

      setAvatarSrc(publicUrl);

      setForm((prev) => ({
        ...prev,
        avatar_url: publicUrl,
      }));

      setSaved((prev) => ({
        ...prev,
        avatar_url: publicUrl,
      }));

      setFeedback("Profile picture updated successfully.");

      window.dispatchEvent(new Event("profileUpdated"));
    } catch (error) {
      console.error(error);
      setFeedback(error.message || "Something went wrong while uploading avatar.");
    } finally {
      setUploading(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  if (loading) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", padding: "0 3rem" }}>
          <div className="mb-8">
            <h1 style={typography.h1}>My Profile</h1>
            <p style={{ ...typography.body, marginTop: "0.5rem" }}>
              Loading your account information...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
      }}
    >
      <div style={{ width: "100%", padding: "0 3rem", boxSizing: "border-box" }}>
        <div className="mb-8">
          <h1 style={typography.h1}>My Profile</h1>
          <p style={{ ...typography.body, marginTop: "0.5rem" }}>
            View and manage your account information.
          </p>
        </div>

        <div
          style={{
            width: "100%",
            background: Colors.white,
          }}
        >
          <div
            style={{
              padding: "2rem 0 1.5rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              borderBottom: `1px solid ${Colors.skyBd}`,
            }}
          >
            <div
              style={{
                position: "relative",
                marginBottom: 14,
                opacity: uploading ? 0.75 : 1,
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  border: `3px solid ${Colors.secondary}`,
                  overflow: "hidden",
                  background: Colors.skyFaintSm,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="Profile"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      color: Colors.blue,
                    }}
                  >
                    {initials}
                  </span>
                )}

                {uploading && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        border: "3px solid rgba(255,255,255,0.45)",
                        borderBottomColor: "#fff",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                  </div>
                )}
              </div>

              <label
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  height: 34,
                  width: 34,
                  borderRadius: "50%",
                  background: Colors.blue,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: uploading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px rgba(56,120,194,0.28)",
                  opacity: uploading ? 0.6 : 1,
                }}
                title="Change Profile Picture"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleAvatar}
                  disabled={uploading}
                />

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  style={{ width: 18, height: 18 }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                  />
                </svg>
              </label>
            </div>

            <p
              style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                color: Colors.blue,
                letterSpacing: "-0.01em",
              }}
            >
              {fullName}
            </p>

            <p
              style={{
                fontSize: "0.875rem",
                color: Colors.blueMuted,
                marginTop: 2,
              }}
            >
              {saved.role || "Customer"}
            </p>
          </div>

          {feedback && (
            <div
              style={{
                margin: "1.25rem 0 0",
                padding: "10px 14px",
                borderRadius: "0.75rem",
                background: Colors.skyFaintSm,
                border: `1px solid ${Colors.skyBd}`,
                color: Colors.blue,
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              {feedback}
            </div>
          )}

          <div
            style={{
              padding: "1.75rem 0",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <Field
                label="First Name"
                value={form.firstName}
                onChange={set("firstName")}
                placeholder="First name"
                isEditing={isEditing}
              />

              <Field
                label="Last Name"
                value={form.lastName}
                onChange={set("lastName")}
                placeholder="Last name"
                isEditing={isEditing}
              />
            </div>

            <Field
              label="Phone Number"
              value={form.phone}
              onChange={handlePhoneChange}
              placeholder="e.g. 09XXXXXXXXX"
              isEditing={isEditing}
              inputMode="numeric"
              maxLength={11}
            />

            <Field
              label="Address"
              value={form.address}
              onChange={set("address")}
              placeholder="Street, Barangay, City"
              isEditing={isEditing}
            />

            <Field
              label="Email (Read-only)"
              value={form.email}
              readOnly
              type="email"
              isEditing={isEditing}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Field
                label="New Password"
                value={form.newPassword}
                onChange={handleNewPasswordChange}
                onFocus={handleNewPasswordFocus}
                onBlur={handleNewPasswordBlur}
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                isEditing={isEditing}
                extra={
                  isEditing ? (
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: Colors.blueMuted,
                        display: "flex",
                        alignItems: "center",
                        padding: 0,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                      }}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  ) : null
                }
              />

              {isEditing && form.newPassword.length > 0 && (
                <ul
                  style={{
                    margin: 0,
                    padding: "12px 14px",
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    borderRadius: "0.75rem",
                    background: Colors.skyFaintSm,
                    border: `1px solid ${Colors.skyBd}`,
                  }}
                >
                  {renderPasswordCondition(passwordStatus.length, "Must have at least 8 characters")}
                  {renderPasswordCondition(passwordStatus.lowercase, "Must contain a lowercase letter")}
                  {renderPasswordCondition(passwordStatus.uppercase, "Must contain an uppercase letter")}
                  {renderPasswordCondition(passwordStatus.number, "Must contain a number")}
                  {renderPasswordCondition(passwordStatus.specialChar, "Must contain a special character")}
                </ul>
              )}
            </div>
          </div>

          <div
            style={{
              padding: "1.25rem 0 1.75rem",
              borderTop: `1px solid ${Colors.skyBd}`,
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saveLoading || uploading}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "0.75rem",
                    border: `1.5px solid ${Colors.skyBd}`,
                    background: "#fff",
                    color: Colors.blueMuted,
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    cursor: saveLoading || uploading ? "not-allowed" : "pointer",
                    opacity: saveLoading || uploading ? 0.7 : 1,
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleRemoveAvatar}
                  disabled={saveLoading || uploading || !avatarSrc}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "0.75rem",
                    border: `1.5px solid ${Colors.skyBd}`,
                    background: "#fff",
                    color: Colors.blue,
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    cursor:
                      saveLoading || uploading || !avatarSrc
                        ? "not-allowed"
                        : "pointer",
                    opacity: saveLoading || uploading || !avatarSrc ? 0.55 : 1,
                  }}
                >
                  Remove Photo
                </button>

                <button
                  onClick={handleSave}
                  disabled={saveLoading || uploading}
                  style={{
                    padding: "10px 28px",
                    borderRadius: "0.75rem",
                    border: "none",
                    background: Colors.green,
                    color: "#fff",
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    cursor: saveLoading || uploading ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(75,173,64,0.28)",
                    opacity: saveLoading || uploading ? 0.7 : 1,
                  }}
                >
                  {saveLoading ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : (
              <button
                onClick={handleEdit}
                style={{
                  padding: "10px 28px",
                  borderRadius: "0.75rem",
                  border: "none",
                  background: Colors.blue,
                  color: "#fff",
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(56,120,194,0.22)",
                }}
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}