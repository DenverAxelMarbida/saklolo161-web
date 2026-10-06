// Single source of truth for staff password strength rules — the
// web mirror of saklolo161-backend's services/passwordPolicy.js
// (separate repos can't share modules, so the rule set is
// duplicated and kept identical). Used by the Change Password
// modal and the Add User form; the backend enforces the exact
// same rules server-side — this client-side copy only powers the
// live checklist and submit gating.

export const PASSWORD_REQUIREMENTS = [
  {
    id: "length",
    label: "At least 16 characters",
    message: "must be at least 16 characters",
    test: (password) => password.length >= 16,
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    message: "must contain at least 1 lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    message: "must contain at least 1 uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    message: "must contain at least 1 number",
    test: (password) => /[0-9]/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    message: "must contain at least 1 special character",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function passwordFailures(password) {
  if (typeof password !== "string") {
    return PASSWORD_REQUIREMENTS.map((requirement) => requirement.message);
  }
  return PASSWORD_REQUIREMENTS.filter(
    (requirement) => !requirement.test(password),
  ).map((requirement) => requirement.message);
}

export function isStrongPassword(password) {
  return passwordFailures(password).length === 0;
}
