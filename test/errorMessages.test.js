import { describe, expect, it } from "vitest";
import { friendlyErrorMessage } from "../src/lib/errorMessages";

const server = (message, status = 400) => ({
  response: { status, data: { message } },
});

describe("friendlyErrorMessage", () => {
  it("translates raw coordinate field paths into plain language", () => {
    expect(
      friendlyErrorMessage(server("Validation failed: coords.lat must be a number between -90 and 90.")),
    ).toBe("Please enter the station's latitude as a number between -90 and 90.");
    expect(
      friendlyErrorMessage(server("Validation failed: coords.lng must be a number between -180 and 180.")),
    ).toBe("Please enter the station's longitude as a number between -180 and 180.");
  });

  it("never shows the 'Validation failed:' wrapper", () => {
    const out = friendlyErrorMessage(server("Validation failed: name is required and must be a non-empty string."));
    expect(out).not.toContain("Validation failed");
    expect(out).toBe("Please enter a station name.");
  });

  it("translates unit and station identifier errors", () => {
    expect(
      friendlyErrorMessage(server('Validation failed: Unit "AMB-1" already exists in station MED_BASE.')),
    ).toBe('This Unit ID "AMB-1" is already in use. Please enter a different ID.');
    expect(
      friendlyErrorMessage(server("Unit id is required and must be a non-empty string.")),
    ).toBe("Please enter a Unit ID (3–64 characters, without . # $ [ ] /).");
    expect(friendlyErrorMessage(server("Station MED_BASE already exists.", 409))).toBe(
      'A station with the ID "MED_BASE" already exists. Please use a different Station ID.',
    );
    expect(
      friendlyErrorMessage(server("Validation failed: at least one assigned unit is required.")),
    ).toBe("Please add at least one assigned unit before creating the station.");
  });

  it("translates admin-password and account errors", () => {
    expect(friendlyErrorMessage(server("Administrator password is required."))).toBe(
      "Please enter your administrator password to continue.",
    );
    expect(friendlyErrorMessage(server("Administrator password is incorrect."))).toBe(
      "That password is incorrect. Please enter your current administrator password and try again.",
    );
    expect(friendlyErrorMessage(server("A valid email is required."))).toBe(
      "Please enter a valid email address.",
    );
    expect(friendlyErrorMessage(server("password is required."))).toBe(
      "Please enter a password for the new account.",
    );
    expect(friendlyErrorMessage(server("That email is already registered."))).toBe(
      "That email is already registered. Please use a different email address.",
    );
  });

  it("translates missing-coordinates and missing-turnout creation failures", () => {
    expect(
      friendlyErrorMessage(server("Validation failed: coords is required ({ lat, lng }).")),
    ).toBe("Please enter the station's latitude and longitude.");
    expect(
      friendlyErrorMessage(server("Validation failed: estimatedTurnout is required and must be a non-empty string.")),
    ).toBe("Please enter the estimated turnout time.");
  });

  it("translates HTTP statuses without leaking Axios codes", () => {
    expect(friendlyErrorMessage({ response: { status: 401, data: {} } })).toBe(
      "Your session may have expired. Please sign in again.",
    );
    expect(friendlyErrorMessage({ response: { status: 403, data: {} } })).toBe(
      "You don't have permission to perform this action.",
    );
    expect(friendlyErrorMessage({ response: { status: 500, data: {} } })).toBe(
      "Something went wrong on our end. Please try again in a moment.",
    );
    for (const out of [
      friendlyErrorMessage({ response: { status: 400, data: {} } }, "Fallback."),
      friendlyErrorMessage({ response: { status: 400, data: {} } }),
    ]) {
      expect(out).not.toMatch(/status code/i);
    }
    expect(friendlyErrorMessage({ response: { status: 400, data: {} } })).toBe(
      "We couldn't save your changes. Please review the information and try again.",
    );
  });

  it("translates network failures", () => {
    expect(friendlyErrorMessage({ code: "ERR_NETWORK", message: "Network Error" })).toBe(
      "We couldn't reach the server. Please check your connection and try again.",
    );
  });

  it("passes through already-friendly server text and custom fallbacks", () => {
    expect(friendlyErrorMessage(server("User disabled."))).toBe("User disabled.");
    expect(friendlyErrorMessage(null, "Custom fallback.")).toBe("Custom fallback.");
    expect(friendlyErrorMessage(null)).toBe(
      "We couldn't save your changes. Please review the information and try again.",
    );
  });

  it("never surfaces non-string payloads", () => {
    expect(
      friendlyErrorMessage({ response: { status: 400, data: { message: { stack: "x" } } } }),
    ).toBe("We couldn't save your changes. Please review the information and try again.");
  });
});
