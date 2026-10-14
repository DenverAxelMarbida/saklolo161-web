// Shared user-friendly error-message mapping for everything the UI
// shows after a failed request or a client-side validation miss.
//
// Dispatchers and administrators are not programmers: they must never
// see raw API field paths ("coords.lat is required"), Axios internals
// ("Request failed with status code 400"), stack traces, or sensitive
// details (tokens, passwords). Backend validation stays authoritative
// — this only TRANSLATES known server messages into actionable text
// and falls back to a safe generic message for anything unknown.
//
// Contract: friendlyErrorMessage(err, fallback) -> string. `err` is
// either an Axios-style error ({ response: { status, data: { message
// } } }) or a plain client-side Error. Only string messages are ever
// surfaced; non-string payloads (objects, HTML) collapse to `fallback`.

const GENERIC_SAVE_FALLBACK =
  "We couldn't save your changes. Please review the information and try again.";

function asText(value) {
  return typeof value === "string" ? value : "";
}

// Rewrites a KNOWN backend validation message into plain language.
// Returns null when the message is not recognized (caller keeps the
// original server text for specific-but-friendly cases, or falls
// back) — unknown strings still never leak internals because the
// server only sends client-safe messages (userController maps every
// Firebase error; station errors are curated), and this rewriter only
// ADDS friendliness for patterns we know are technical.
function rewriteServerMessage(raw) {
  const text = raw.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  // --- Administrator reauthentication -------------------------------
  if (lower.includes("administrator password is required")) {
    return "Please enter your administrator password to continue.";
  }
  if (lower.includes("administrator password is incorrect")) {
    return "That password is incorrect. Please enter your current administrator password and try again.";
  }
  if (lower.includes("current password is incorrect")) {
    return "That password is incorrect. Please enter your current password and try again.";
  }
  if (lower.includes("current password is required")) {
    return "Please enter your current password to continue.";
  }

  // --- Station coordinates (never "coords.lat"/"coords.long") -------
  if (lower.includes("coords is required")) {
    return "Please enter the station's latitude and longitude.";
  }
  if (lower.includes("coords.lat")) {
    return "Please enter the station's latitude as a number between -90 and 90.";
  }
  if (lower.includes("coords.lng") || lower.includes("coords.long")) {
    return "Please enter the station's longitude as a number between -180 and 180.";
  }
  if (lower.includes("coords")) {
    return "Please check the station's latitude and longitude — both must be numbers, or leave both blank.";
  }

  // --- Unit validation ----------------------------------------------
  const unitExists = text.match(/unit "([^"]+)" already exists/i);
  if (unitExists) {
    return `This Unit ID "${unitExists[1]}" is already in use. Please enter a different ID.`;
  }
  if (lower.includes("at least one assigned unit")) {
    return "Please add at least one assigned unit before creating the station.";
  }
  if (lower.includes("unit id is required") || lower.includes("unit id must be")) {
    return "Please enter a Unit ID (3–64 characters, without . # $ [ ] /).";
  }
  if (lower.includes("duplicate unit id")) {
    return "Two units share the same ID. Please make every Unit ID unique within the station.";
  }
  if (lower.includes("unit name is required") || lower.includes("unit name must be")) {
    return "Please enter a name for every assigned unit.";
  }

  // --- Station fields -----------------------------------------------
  const stationExists = text.match(/station (\S+) already exists/i);
  if (stationExists) {
    return `A station with the ID "${stationExists[1]}" already exists. Please use a different Station ID.`;
  }
  if (lower.includes("name is required") || lower.includes("station.name")) {
    return "Please enter a station name.";
  }
  if (lower.includes("station id") || (lower.includes("id is required") && lower.includes("3-64"))) {
    return "Please enter a Station ID (3–64 characters: A–Z, 0–9, underscore).";
  }
  if (lower.includes("category must be one of")) {
    return "Please choose a valid station category.";
  }
  if (lower.includes("phone")) {
    return "Please enter a valid contact number (digits, spaces, +, -, and parentheses only).";
  }
  if (lower.includes("estimatedturnout is required") || lower.includes("estimatedturnout must be a non-empty")) {
    return "Please enter the estimated turnout time.";
  }
  if (lower.includes("estimatedturnout")) {
    return "Please keep the estimated turnout under 64 characters.";
  }
  if (lower.includes("isactive must be a boolean")) {
    return "We couldn't update that status. Please try again.";
  }

  // --- Account fields -----------------------------------------------
  if (lower.includes("a valid email is required") || lower.includes("enter a valid email")) {
    return "Please enter a valid email address.";
  }
  if (lower === "password is required." || lower.includes("new password is required")) {
    return "Please enter a password for the new account.";
  }
  if (lower.includes("passwords do not match")) {
    return "The two passwords don't match. Please re-enter them.";
  }
  if (lower.includes("agency must be one of")) {
    return "Please choose a valid agency.";
  }
  if (lower.includes("role must be one of")) {
    return "Please choose a valid role.";
  }
  if (lower.includes("email is already registered")) {
    return "That email is already registered. Please use a different email address.";
  }
  if (lower.includes("user not found")) {
    return "That account was not found. It may have been removed — please refresh the list.";
  }
  if (lower.includes("unexpected server error")) {
    return "Something went wrong on our end. Please try again in a moment.";
  }

  // --- Strippable wrapper -------------------------------------------
  // "Validation failed: <inner>" — translate the inner parts, not the
  // wrapper. Joined multi-error strings are rewritten piece by piece.
  const validationPrefix = text.match(/^validation failed:\s*/i);
  if (validationPrefix) {
    const inner = text.slice(validationPrefix[0].length);
    const rewritten = inner
      .split(/(?<=\.)\s+/)
      .map((part) => rewriteServerMessage(part) || part)
      .join(" ");
    // If nothing inside was recognized, still drop the technical
    // wrapper so users never see "Validation failed:".
    return rewritten || "Please review the highlighted information and try again.";
  }

  return null;
}

export function friendlyErrorMessage(err, fallback = GENERIC_SAVE_FALLBACK) {
  // Network failure / timeout: Axios errors carry no `response`.
  if (err && !err.response && (err.request || err.code || err.message)) {
    const axiosNote = asText(err.message).toLowerCase();
    if (
      err.code === "ERR_NETWORK" ||
      err.code === "ECONNABORTED" ||
      axiosNote.includes("network error") ||
      axiosNote.includes("timeout")
    ) {
      return "We couldn't reach the server. Please check your connection and try again.";
    }
  }

  const status = err?.response?.status;
  const serverMessage = asText(err?.response?.data?.message);

  if (serverMessage) {
    const rewritten = rewriteServerMessage(serverMessage);
    if (rewritten) return rewritten;
    // Recognizably friendly server text (backend already curates its
    // messages) — pass through, never the Axios wrapper.
    return serverMessage;
  }

  // HTTP status with no usable body — translate the code, never leak
  // "Request failed with status code N".
  if (status === 401 || status === 403) {
    return status === 401
      ? "Your session may have expired. Please sign in again."
      : "You don't have permission to perform this action.";
  }
  if (status === 404) {
    return "The requested record was not found. It may have been removed — please refresh.";
  }
  if (status === 409) {
    return "That record already exists. Please use different details.";
  }
  if (typeof status === "number" && status >= 500) {
    return "Something went wrong on our end. Please try again in a moment.";
  }
  if (typeof status === "number" && status >= 400) {
    return fallback;
  }

  // Anything without a server response or status is unexpected
  // (not an Axios HTTP error) — never surface its raw text, which may
  // be technical ("network down", stack fragments). The caller's
  // fallback already describes the failed action in plain language.
  return fallback;
}

// Backwards-compatible alias — both admin components previously
// defined a local `errorMessage(err, fallback)` helper with the old
// pass-through behavior; they now import this instead.
export const errorMessage = friendlyErrorMessage;
