import { PASSWORD_REQUIREMENTS } from "../lib/passwordPolicy";

// Live requirement checklist driven by the shared password policy —
// each <li> carries data-met="true|false" so tests (and assistive
// tooling) can read the state directly.
export default function PasswordRequirements({ password }) {
  const value = typeof password === "string" ? password : "";

  return (
    <ul className="mt-2 space-y-1" aria-label="Password requirements">
      {PASSWORD_REQUIREMENTS.map((requirement) => {
        const met = requirement.test(value);
        return (
          <li
            key={requirement.id}
            data-met={met ? "true" : "false"}
            className={`text-xs ${met ? "text-risk-low" : "text-ink-dim"}`}
          >
            {requirement.label}
          </li>
        );
      })}
    </ul>
  );
}
