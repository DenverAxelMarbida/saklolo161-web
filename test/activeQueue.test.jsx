import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ActiveQueue from "../src/components/ActiveQueue";

function makeIncident(overrides = {}) {
  return {
    id: "INC-TEST-0001",
    category: "FLOOD",
    status: "PENDING",
    priority: "MEDIUM",
    location: "Marikina City",
    coords: { lat: 14.65, lng: 121.1 },
    elapsedMinutes: 10,
    callerNotes: "Water rising near the bridge.",
    evidence: [],
    evidenceUploading: false,
    evidenceExpectedCount: 0,
    evidenceFailedCount: 0,
    evidenceAttempt: 0,
    evidenceAttemptsTotal: 0,
    station: null,
    dispatch: null,
    resolvedAt: null,
    ...overrides,
  };
}

function renderQueue(incidents, newIncidentIds = []) {
  return render(
    <ActiveQueue
      incidents={incidents}
      onSelectIncident={() => {}}
      activeFilter="ALL"
      onFilterChange={() => {}}
      newIncidentIds={newIncidentIds}
    />,
  );
}

describe("ActiveQueue", () => {
  it("shows nothing evidence-related on a plain report", () => {
    renderQueue([makeIncident()]);

    expect(screen.queryByText(/attaching evidence/)).toBeNull();
    expect(screen.queryByText(/failed/)).toBeNull();
  });

  it("badges a report whose attachments are still uploading", () => {
    renderQueue([
      makeIncident({
        evidence: [{ fileId: "ev-1", url: "" }],
        evidenceUploading: true,
        evidenceExpectedCount: 3,
      }),
    ]);

    expect(screen.getByText(/⏳ attaching evidence 1\/3/)).toBeTruthy();
  });

  it("shows an honest retry chip when an automatic attempt is in flight", () => {
    renderQueue([
      makeIncident({
        evidence: [{ fileId: "ev-1", url: "" }],
        evidenceUploading: true,
        evidenceExpectedCount: 3,
        evidenceAttempt: 2,
        evidenceAttemptsTotal: 3,
      }),
    ]);

    expect(screen.getByTestId("queue-evidence-chip").textContent).toBe("↻ retrying 2/3");
    expect(screen.queryByText(/%/)).toBeNull();
  });
  it("flags a report with failed attachments once the loop finishes", () => {
    renderQueue([
      makeIncident({
        evidenceUploading: false,
        evidenceExpectedCount: 2,
        evidenceFailedCount: 1,
      }),
    ]);

    expect(screen.getByText(/⚠ 1 failed/)).toBeTruthy();
  });
});

describe("ActiveQueue — new incident highlight", () => {
  it("badges and animates a row whose id is flagged as new", () => {
    const { container } = renderQueue(
      [makeIncident({ id: "INC-NEW-1" }), makeIncident({ id: "INC-OLD-2" })],
      ["INC-NEW-1"],
    );

    expect(screen.getByText("New Incident")).toBeTruthy();

    const rows = container.querySelectorAll("button.w-full");
    expect(rows).toHaveLength(2);
    expect(rows[0].className).toContain("animate-pop-in");
    expect(rows[1].className).not.toContain("animate-pop-in");
    expect(screen.getAllByText("New Incident")).toHaveLength(1);
  });

  it("shows no badge or highlight when nothing is new", () => {
    const { container } = renderQueue([makeIncident()]);

    expect(screen.queryByText("New Incident")).toBeNull();
    const row = container.querySelector("button.w-full");
    expect(row.className).not.toContain("animate-pop-in");
  });

  it("keeps evidence badges intact alongside the new badge", () => {
    renderQueue(
      [
        makeIncident({
          id: "INC-EV-1",
          evidenceUploading: true,
          evidence: [{ fileId: "ev-1", url: "" }],
          evidenceExpectedCount: 3,
        }),
      ],
      ["INC-EV-1"],
    );

    expect(screen.getByText("New Incident")).toBeTruthy();
    expect(screen.getByText(/⏳ attaching evidence 1\/3/)).toBeTruthy();
  });
});

describe("ActiveQueue — empty state", () => {
  it("renders the contained empty-state message when the queue is empty", () => {
    renderQueue([]);
    expect(screen.getByText("No incidents in queue.")).toBeTruthy();
  });

  it("keeps the empty-state message filter-aware", () => {
    render(
      <ActiveQueue
        incidents={[]}
        onSelectIncident={() => {}}
        activeFilter="FLOOD"
        onFilterChange={() => {}}
      />,
    );
    expect(screen.getByText("No flood incidents in queue.")).toBeTruthy();
  });
});
describe("ActiveQueue — loading and error states", () => {
  it("shows skeleton rows instead of the empty message while the first fetch is loading", () => {
    render(
      <ActiveQueue
        incidents={[]}
        onSelectIncident={() => {}}
        activeFilter="ALL"
        onFilterChange={() => {}}
        loading
      />,
    );

    expect(screen.queryByText("No incidents in queue.")).toBeNull();
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("Loading incidents");
    expect(status.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("does not show a misleading pending count while loading", () => {
    render(
      <ActiveQueue
        incidents={[]}
        onSelectIncident={() => {}}
        activeFilter="ALL"
        onFilterChange={() => {}}
        loading
      />,
    );

    expect(screen.queryByText("0 Pending")).toBeNull();
    expect(screen.getByText("— Pending")).toBeTruthy();
  });

  it("shows an error message instead of the empty state when the load failed", () => {
    render(
      <ActiveQueue
        incidents={[]}
        onSelectIncident={() => {}}
        activeFilter="ALL"
        onFilterChange={() => {}}
        error={new Error("network down")}
      />,
    );

    expect(screen.queryByText("No incidents in queue.")).toBeNull();
    expect(screen.getByText(/couldn't load incidents/i)).toBeTruthy();
  });

  it("keeps the genuine empty message once loading finishes without error", () => {
    renderQueue([]);
    expect(screen.getByText("No incidents in queue.")).toBeTruthy();
  });
});

describe("ActiveQueue — filter chips", () => {
  it("marks the selected chip with aria-pressed", () => {
    renderQueue([makeIncident()]);

    expect(screen.getByRole("button", { name: "ALL" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "FLOOD" }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("ActiveQueue — long values", () => {
  it("renders a long location in full with no clipping or nowrap classes", () => {
    const LONG_LOCATION =
      "780 Quezon Boulevard Barangay 391, Manila, Philippines";
    renderQueue([makeIncident({ location: LONG_LOCATION })]);

    const location = screen.getByText(LONG_LOCATION);
    expect(location.className).not.toMatch(
      /truncate|whitespace-nowrap|line-clamp/,
    );
  });

  it("keeps category and status rendering unchanged alongside long values", () => {
    renderQueue([
      makeIncident({
        location: "780 Quezon Boulevard Barangay 391, Manila, Philippines",
        category: "CRIME",
        status: "DISPATCHED",
      }),
    ]);

    expect(screen.getByText("CRIME")).toBeTruthy();
    expect(screen.getByText("DISPATCHED")).toBeTruthy();
  });
});

describe("ActiveQueue — newest-first ordering", () => {
  const cardIds = (container) =>
    [...container.querySelectorAll("button.w-full")].map(
      (button) => button.querySelector("span.font-mono")?.textContent,
    );

  function renderFullQueue(incidents, extra = {}) {
    return render(
      <ActiveQueue
        incidents={incidents}
        onSelectIncident={() => {}}
        activeFilter="ALL"
        onFilterChange={() => {}}
        {...extra}
      />,
    );
  }

  it("lists newest incidents first by elapsed minutes", () => {
    const { container } = renderFullQueue([
      makeIncident({ id: "OLD", elapsedMinutes: 30 }),
      makeIncident({ id: "NEW", elapsedMinutes: 2 }),
      makeIncident({ id: "MID", elapsedMinutes: 14 }),
    ]);

    expect(cardIds(container)).toEqual(["#NEW", "#MID", "#OLD"]);
  });

  it("sinks unknown or invalid ages below timed incidents", () => {
    const { container } = renderFullQueue([
      makeIncident({ id: "NO-AGE", elapsedMinutes: undefined }),
      makeIncident({ id: "TIMED", elapsedMinutes: 5 }),
      makeIncident({ id: "NAN-AGE", elapsedMinutes: NaN }),
    ]);

    expect(cardIds(container)).toEqual(["#TIMED", "#NO-AGE", "#NAN-AGE"]);
  });

  it("never mutates the parent's incidents array", () => {
    const incidents = Object.freeze([
      makeIncident({ id: "OLD", elapsedMinutes: 30 }),
      makeIncident({ id: "NEW", elapsedMinutes: 2 }),
    ]);

    const { container } = renderFullQueue(incidents);

    expect(cardIds(container)).toEqual(["#NEW", "#OLD"]);
    expect(incidents[0].id).toBe("OLD");
  });

  it("a newly polled incident appears at the top without remounting", () => {
    const oldList = [
      makeIncident({ id: "OLD", elapsedMinutes: 30 }),
      makeIncident({ id: "MID", elapsedMinutes: 14 }),
    ];
    const { container, rerender } = renderFullQueue(oldList);
    expect(cardIds(container)).toEqual(["#MID", "#OLD"]);

    // Next poll: a fresh report arrives (and ages recompute).
    rerender(
      <ActiveQueue
        incidents={[
          makeIncident({ id: "FRESH", elapsedMinutes: 0 }),
          ...oldList,
        ]}
        onSelectIncident={() => {}}
        activeFilter="ALL"
        onFilterChange={() => {}}
      />,
    );

    expect(cardIds(container)).toEqual(["#FRESH", "#MID", "#OLD"]);
  });

  it("keeps filtering, resolved-exclusion, and pending counts correct with sorting", () => {
    const { container } = render(
      <ActiveQueue
        incidents={[
          makeIncident({ id: "F-OLD", category: "FLOOD", elapsedMinutes: 40 }),
          makeIncident({ id: "C-NEW", category: "CRIME", elapsedMinutes: 1 }),
          makeIncident({ id: "DONE", status: "RESOLVED", elapsedMinutes: 0 }),
        ]}
        onSelectIncident={() => {}}
        activeFilter="FLOOD"
        onFilterChange={() => {}}
      />,
    );

    // Resolved never renders; filter narrows; count covers all pending.
    expect(cardIds(container)).toEqual(["#F-OLD"]);
    expect(screen.getByText("2 Pending")).toBeTruthy();
    expect(screen.queryByText("#DONE")).toBeNull();
  });
});

describe("ActiveQueue — scroll chain and selection stability", () => {
  const queueList = (container) =>
    container.querySelector(".overflow-y-auto:not(.overflow-x-auto)");

  it("gives the queue a shrinkable flex chain and a vertical-only scroll region", () => {
    const { container } = render(
      <ActiveQueue
        incidents={[makeIncident()]}
        onSelectIncident={() => {}}
        activeFilter="ALL"
        onFilterChange={() => {}}
      />,
    );

    // The flex-column root must shrink below content height or the
    // rail's overflow-hidden hard-clips the tail with no scrollbar.
    const root = container.firstChild;
    expect(root.className).toMatch(/min-h-0/);

    // The list itself scrolls vertically only, with bottom clearance
    // so the final card never rests flush against the panel edge.
    const list = queueList(container);
    expect(list.className).toMatch(/overflow-y-auto/);
    expect(list.className).not.toMatch(/overflow-x-auto|overflow-x-scroll/);
    expect(list.className).toMatch(/pb-2/);
  });

  it("selecting the last card neither scrolls ancestors nor resets the queue", () => {
    const onSelectIncident = vi.fn();
    const { container } = render(
      <ActiveQueue
        incidents={[
          makeIncident({ id: "FIRST", elapsedMinutes: 1 }),
          makeIncident({ id: "LAST", elapsedMinutes: 60 }),
        ]}
        onSelectIncident={onSelectIncident}
        activeFilter="ALL"
        onFilterChange={() => {}}
        selectedIncidentId="LAST"
      />,
    );

    const list = queueList(container);
    list.scrollTop = 123;
    const pageTop = document.documentElement.scrollTop;

    const lastCard = screen.getByText("#LAST").closest("button");
    fireEvent.click(lastCard);
    expect(onSelectIncident).toHaveBeenCalledWith(
      expect.objectContaining({ id: "LAST" }),
    );

    // No programmatic scrolling: the queue, page, and map positions
    // are untouched by selection…
    expect(list.scrollTop).toBe(123);
    expect(document.documentElement.scrollTop).toBe(pageTop);

    // …and repeated selection keeps everything stable with the
    // highlight intact.
    fireEvent.click(lastCard);
    expect(list.scrollTop).toBe(123);
    expect(lastCard.getAttribute("data-selected")).toBe("true");
    expect(lastCard.className).toMatch(/ring-1/);
  });
});
