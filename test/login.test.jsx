import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Login from "../src/components/Login";
import App from "../src/App";

// ---- Module mocks (hoisted above imports by vitest) ------------------------

const { authState } = vi.hoisted(() => ({
  authState: { payload: null, callback: null },
}));

vi.mock("../src/lib/auth", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  // Mirrors Firebase's onAuthChange: invoke immediately, then let the test
  // push a new auth value to simulate sign-in / sign-out.
  onAuthChange: (callback) => {
    authState.callback = callback;
    callback(authState.payload);
    return () => {};
  },
  getStoredAuth: () => authState.payload,
}));

vi.mock("../src/hooks/useIncidentPolling", () => ({
  useIncidentPolling: () => ({
    incidents: [],
    refresh: vi.fn(),
    newIncidentIds: [],
  }),
}));

vi.mock("../src/components/ControlRoom", () => ({
  default: () => <div data-testid="control-room" />,
}));

vi.mock("../src/lib/api", () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  setUserEnabled: vi.fn(),
  changeOwnPassword: vi.fn(),
}));

// TriageModal/DispatchTracker import map modules at load time; they never
// render here, but the import must not touch real mapbox-gl.
vi.mock("mapbox-gl", () => ({ default: { accessToken: "" } }));

import { login, logout } from "../src/lib/auth";

const dispatcherUser = {
  uid: "uid-fire",
  email: "fire@marikina.gov.ph",
  agency: "FIRE",
  role: "dispatcher",
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.payload = null;
  authState.callback = null;
});

describe("Login screen", () => {
  it("presents the Saklolo 161 identity with the app mark and one page heading", () => {
    const { container } = render(<Login onSuccess={() => {}} />);

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute("src")).toMatch(/\.png$/);
    // Decorative: the wordmark sits right beside it, so a spoken duplicate
    // would only add noise.
    expect(images[0].getAttribute("alt")).toBe("");

    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("SAKLOLO 161");

    expect(screen.getByRole("heading", { name: "Dispatcher Login" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();

    // Entrance animation lives on the root so the swap into the dashboard
    // reads as a hand-off rather than a cut.
    expect(container.firstElementChild.className).toContain("animate-screen-in");
  });

  it("signs in through the existing login() contract", async () => {
    login.mockResolvedValue({ token: "t", user: dispatcherUser });
    render(<Login onSuccess={() => {}} />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "fire@marikina.gov.ph" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "s3cret-pass" },
    });
    fireEvent.click(screen.getByText("Sign In"));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith("fire@marikina.gov.ph", "s3cret-pass"),
    );
  });

  it("shows a disabled loading state while the attempt is in flight", () => {
    login.mockReturnValue(new Promise(() => {}));
    render(<Login onSuccess={() => {}} />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "fire@marikina.gov.ph" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "s3cret-pass" },
    });
    fireEvent.click(screen.getByText("Sign In"));

    const button = screen.getByText("Signing in…").closest("button");
    expect(button.disabled).toBe(true);
  });

  it("surfaces the API-provided failure message as an alert", async () => {
    login.mockRejectedValue({
      response: { data: { message: "Invalid email or password." } },
    });
    render(<Login onSuccess={() => {}} />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "fire@marikina.gov.ph" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-pass" },
    });
    fireEvent.click(screen.getByText("Sign In"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Invalid email or password.");
    expect(screen.getByText("Sign In")).toBeTruthy();
  });

  it("falls back to the connection message when the failure carries no payload", async () => {
    login.mockRejectedValue(new Error("network down"));
    render(<Login onSuccess={() => {}} />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "fire@marikina.gov.ph" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "s3cret-pass" },
    });
    fireEvent.click(screen.getByText("Sign In"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });
});

describe("Login — password visibility toggle", () => {
  it("starts hidden, round-trips to visible and back, and preserves the value", () => {
    render(<Login onSuccess={() => {}} />);

    const input = screen.getByLabelText("Password");
    expect(input.type).toBe("password");

    const show = screen.getByRole("button", { name: "Show password" });
    expect(show.getAttribute("type")).toBe("button");
    expect(show.getAttribute("aria-pressed")).toBe("false");

    fireEvent.change(input, { target: { value: "s3cret-pass" } });
    fireEvent.click(show);

    expect(input.type).toBe("text");
    expect(input.value).toBe("s3cret-pass");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(hide);
    expect(input.type).toBe("password");
    expect(input.value).toBe("s3cret-pass");
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
  });

  it("never submits the sign-in form when clicked", () => {
    render(<Login onSuccess={() => {}} />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "fire@marikina.gov.ph" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "s3cret-pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(login).not.toHaveBeenCalled();
    expect(screen.getByText("Sign In")).toBeTruthy();
    expect(screen.getByLabelText("Password").value).toBe("s3cret-pass");
  });
});

describe("App — auth screen transitions", () => {
  it("shows Login until auth resolves, then the control room", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Dispatcher Login" })).toBeTruthy();
    expect(screen.queryByTestId("control-room")).toBeNull();

    act(() => {
      authState.callback({ token: "test-token", user: dispatcherUser });
    });

    expect(screen.queryByRole("heading", { name: "Dispatcher Login" })).toBeNull();
    expect(screen.getByTestId("control-room")).toBeTruthy();
    // The incoming screen carries the fade-in; auth itself was never delayed.
    expect(document.querySelector(".animate-screen-in")).toBeTruthy();
  });

  it("returns to Login when auth goes null (the logout path)", () => {
    authState.payload = { token: "test-token", user: dispatcherUser };
    render(<App />);

    expect(screen.getByTestId("control-room")).toBeTruthy();

    act(() => {
      authState.callback(null);
    });

    expect(screen.queryByTestId("control-room")).toBeNull();
    expect(screen.getByRole("heading", { name: "Dispatcher Login" })).toBeTruthy();
  });

  it("only calls logout() after the confirmation is accepted", () => {
    authState.payload = { token: "test-token", user: dispatcherUser };
    render(<App />);

    fireEvent.click(screen.getByText("Logout"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(logout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Log Out"));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
