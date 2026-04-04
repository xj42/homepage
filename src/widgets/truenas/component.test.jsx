// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({
  useWidgetAPI: vi.fn(),
}));

vi.mock("utils/proxy/use-widget-api", () => ({
  default: useWidgetAPI,
}));

// Pool is rendered outside of the main Container; stub it to a simple marker.
vi.mock("widgets/truenas/pool", () => ({
  default: ({ name, healthy, allocated, free }) => (
    <div
      data-testid="truenas-pool"
      data-name={name}
      data-healthy={String(healthy)}
      data-allocated={allocated}
      data-free={free}
    />
  ),
}));

import Component from "./component";

describe("widgets/truenas/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders placeholders while loading (no pools)", () => {
    useWidgetAPI.mockImplementation(() => ({ data: undefined, error: undefined }));

    const { container } = renderWithProviders(<Component service={{ widget: { type: "truenas" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelectorAll(".service-block")).toHaveLength(5);
    expect(screen.getByText("truenas.load")).toBeInTheDocument();
    expect(screen.getByText("truenas.uptime")).toBeInTheDocument();
    expect(screen.getByText("truenas.alerts")).toBeInTheDocument();
    expect(screen.getByText("truenas.speed")).toBeInTheDocument();
    expect(screen.getByText("truenas.usage")).toBeInTheDocument();
    expect(screen.queryByTestId("truenas-pool")).toBeNull();
  });

  it("renders values and pool list when enablePools is on and data is present", () => {
    useWidgetAPI.mockImplementation((widget, endpoint) => {
      if (endpoint === "alerts") return { data: { pending: 7 }, error: undefined };
      if (endpoint === "status") return { data: { loadavg: [1.23], uptime_seconds: 3600 }, error: undefined };
      if (endpoint === "network")
        return {
          data: [
            {
              state: {
                received_bytes: 1000,
                sent_bytes: 500,
                received_bytes_rate: 10,
                sent_bytes_rate: 5,
              },
            },
            {
              rx_bytes: 200,
              sent_bytes: 300,
              rx_bytes_rate: 2,
              tx_bytes_rate: 3,
            },
          ],
          error: undefined,
        };
      if (endpoint === "pools") return { data: [{ id: "1", name: "tank", healthy: true }], error: undefined };
      if (endpoint === "dataset")
        return {
          data: [{ pool: "tank", name: "tank", used: { parsed: 10 }, available: { parsed: 20 } }],
          error: undefined,
        };
      return { data: undefined, error: undefined };
    });

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "truenas", enablePools: true } }} />,
      {
        settings: { hideErrors: false },
      },
    );

    expect(container.querySelectorAll(".service-block")).toHaveLength(5);
    expect(screen.getByText("1.23")).toBeInTheDocument();
    expect(screen.getByText("3600")).toBeInTheDocument(); // common.duration mocked
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument(); // common.byterate mocked
    expect(screen.getByText("2000")).toBeInTheDocument(); // common.bytes mocked

    const pool = screen.getByTestId("truenas-pool");
    expect(pool.getAttribute("data-name")).toBe("tank");
    expect(pool.getAttribute("data-healthy")).toBe("true");
    expect(pool.getAttribute("data-allocated")).toBe("10");
    expect(pool.getAttribute("data-free")).toBe("20");
  });

  it("aggregates network totals from object responses with stats/statistics fields", () => {
    useWidgetAPI.mockImplementation((widget, endpoint) => {
      if (endpoint === "alerts") return { data: { pending: 1 }, error: undefined };
      if (endpoint === "status") return { data: { loadavg: [0.5], uptime_seconds: 42 }, error: undefined };
      if (endpoint === "network")
        return {
          data: {
            em0: { stats: { received_bytes: 100, sent_bytes: 200, received_bytes_rate: 2, sent_bytes_rate: 3 } },
            em1: { statistics: { rx_bytes: 400, tx_bytes: 300, rx_bytes_rate: 4, tx_bytes_rate: 5 } },
          },
          error: undefined,
        };
      return { data: undefined, error: undefined };
    });

    renderWithProviders(<Component service={{ widget: { type: "truenas" } }} />, { settings: { hideErrors: false } });

    expect(screen.getByText("900")).toBeInTheDocument(); // usage
    expect(screen.getByText("14")).toBeInTheDocument(); // speed
  });

  it("renders an error state when network endpoint fails", () => {
    useWidgetAPI.mockImplementation((widget, endpoint) => {
      if (endpoint === "alerts") return { data: { pending: 1 }, error: undefined };
      if (endpoint === "status") return { data: { loadavg: [0.5], uptime_seconds: 42 }, error: undefined };
      if (endpoint === "network") return { data: undefined, error: { message: "network failed" } };
      return { data: undefined, error: undefined };
    });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "truenas" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.querySelector(".service-container")).toBeNull();
    expect(screen.getAllByText("widget.api_error", { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText("network failed")).toBeInTheDocument();
  });
});
