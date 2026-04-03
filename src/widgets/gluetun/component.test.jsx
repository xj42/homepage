// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { expectBlockValue } from "test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/gluetun/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });
  });

  it("defaults fields and filters to 3 blocks while loading (no port_forwarded)", () => {
    const service = { widget: { type: "gluetun", url: "http://x" } };
    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(service.widget.fields).toEqual(["public_ip", "region", "country"]);
    expect(container.querySelectorAll(".service-block")).toHaveLength(3);
    expect(screen.getByText("gluetun.public_ip")).toBeInTheDocument();
    expect(screen.getByText("gluetun.region")).toBeInTheDocument();
    expect(screen.getByText("gluetun.country")).toBeInTheDocument();
    expect(screen.queryByText("gluetun.port_forwarded")).toBeNull();
    expect(screen.queryByText("gluetun.dns_status")).toBeNull();
    expect(screen.queryByText("gluetun.vpn_status")).toBeNull();
  });

  it("renders error UI when widget API errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "nope" } });

    renderWithProviders(<Component service={{ widget: { type: "gluetun", url: "http://x" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getAllByText(/widget\.api_error/i).length).toBeGreaterThan(0);
    expect(screen.getByText("nope")).toBeInTheDocument();
  });

  it("includes port_forwarded and uses the v2 endpoint when widget.version > 1", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { public_ip: "1.2.3.4", region: "CA", country: "US" }, error: undefined })
      .mockReturnValueOnce({ data: { port: 12345 }, error: undefined });

    const service = {
      widget: {
        type: "gluetun",
        url: "http://x",
        version: 2,
        fields: ["public_ip", "region", "country", "port_forwarded"],
      },
    };

    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(useWidgetAPI.mock.calls[0][1]).toBe("ip");
    expect(useWidgetAPI.mock.calls[1][1]).toBe("port_forwarded_v2");

    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expectBlockValue(container, "gluetun.public_ip", "1.2.3.4");
    expectBlockValue(container, "gluetun.region", "CA");
    expectBlockValue(container, "gluetun.country", "US");
    expectBlockValue(container, "gluetun.port_forwarded", 12345);
  });

  it("includes DNS and VPN status when fields are configured", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { public_ip: "1.2.3.4", region: "CA", country: "US" }, error: undefined })
      .mockReturnValueOnce({ data: undefined, error: undefined })
      .mockReturnValueOnce({ data: { status: "running" }, error: undefined })
      .mockReturnValueOnce({ data: { status: "stopped" }, error: undefined });

    const service = {
      widget: {
        type: "gluetun",
        url: "http://x",
        fields: ["public_ip", "region", "country", "dns_status", "vpn_status"],
      },
    };

    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(useWidgetAPI.mock.calls[0][1]).toBe("ip");
    expect(useWidgetAPI.mock.calls[1][1]).toBe("");
    expect(useWidgetAPI.mock.calls[2][1]).toBe("dns_status");
    expect(useWidgetAPI.mock.calls[3][1]).toBe("vpn_status");

    expect(container.querySelectorAll(".service-block")).toHaveLength(5);
    expectBlockValue(container, "gluetun.dns_status", "running");
    expectBlockValue(container, "gluetun.vpn_status", "stopped");
  });

  it("handles missing data fields gracefully", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { public_ip: "1.2.3.4" }, error: undefined }) // missing region and country
      .mockReturnValueOnce({ data: undefined, error: undefined })
      .mockReturnValueOnce({ data: {}, error: undefined }) // missing status
      .mockReturnValueOnce({ data: {}, error: undefined }); // missing status

    const service = {
      widget: {
        type: "gluetun",
        url: "http://x",
        fields: ["public_ip", "region", "country", "dns_status", "vpn_status"],
      },
    };

    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(container.querySelectorAll(".service-block")).toHaveLength(5);
    expectBlockValue(container, "gluetun.public_ip", "1.2.3.4");
    expectBlockValue(container, "gluetun.region", "-");
    expectBlockValue(container, "gluetun.country", "-");
    expectBlockValue(container, "gluetun.dns_status", "-");
    expectBlockValue(container, "gluetun.vpn_status", "-");
  });

  it("uses v1 port_forwarded endpoint when version is not > 1", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { public_ip: "1.2.3.4", region: "CA", country: "US" }, error: undefined })
      .mockReturnValueOnce({ data: { port: 54321 }, error: undefined });

    const service = {
      widget: {
        type: "gluetun",
        url: "http://x",
        version: 1,
        fields: ["public_ip", "region", "country", "port_forwarded"],
      },
    };

    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(useWidgetAPI.mock.calls[0][1]).toBe("ip");
    expect(useWidgetAPI.mock.calls[1][1]).toBe("port_forwarded");
  });

  it("handles port_forwarded data without port field", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { public_ip: "1.2.3.4", region: "CA", country: "US" }, error: undefined })
      .mockReturnValueOnce({ data: {}, error: undefined }); // no port field

    const service = {
      widget: {
        type: "gluetun",
        url: "http://x",
        fields: ["public_ip", "region", "country", "port_forwarded"],
      },
    };

    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expectBlockValue(container, "gluetun.port_forwarded", "-");
  });

  it("filters out invalid fields from the fields array", () => {
    const service = {
      widget: {
        type: "gluetun",
        url: "http://x",
        fields: ["public_ip", "invalid_field", "region", "another_invalid", "country"],
      },
    };

    useWidgetAPI
      .mockReturnValueOnce({ data: { public_ip: "1.2.3.4", region: "CA", country: "US" }, error: undefined })
      .mockReturnValueOnce({ data: undefined, error: undefined })
      .mockReturnValueOnce({ data: undefined, error: undefined })
      .mockReturnValueOnce({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(container.querySelectorAll(".service-block")).toHaveLength(3);
    expectBlockValue(container, "gluetun.public_ip", "1.2.3.4");
    expectBlockValue(container, "gluetun.region", "CA");
    expectBlockValue(container, "gluetun.country", "US");
  });
});
