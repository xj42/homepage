// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { expectBlockValue } from "test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

vi.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

import Component from "./component";

describe("widgets/syncthing/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });
  });

  it("renders loading state with default blocks", () => {
    const service = { widget: { type: "syncthing", url: "http://x" } };
    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expect(screen.getByText("CPU")).toBeInTheDocument();
    expect(screen.getByText("RAM")).toBeInTheDocument();
    expect(screen.getByText("Devices")).toBeInTheDocument();
    expect(screen.getByText("Uptime")).toBeInTheDocument();
  });

  it("renders error UI when widget API errors", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "connection failed" } });

    renderWithProviders(<Component service={{ widget: { type: "syncthing", url: "http://x" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getAllByText(/widget\.api_error/i).length).toBeGreaterThan(0);
    expect(screen.getByText("connection failed")).toBeInTheDocument();
  });

  it("renders system data correctly", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { cpuPercent: 15.5, alloc: 104857600, uptime: 3661 }, error: undefined }) // status
      .mockReturnValueOnce({ data: { connections: { device1: { connected: true }, device2: { connected: false }, device3: { connected: true } } }, error: undefined }) // connections
      .mockReturnValueOnce({ data: [], error: undefined }); // folders

    const service = { widget: { type: "syncthing", url: "http://x" } };
    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expectBlockValue(container, "CPU", "15.5%");
    expectBlockValue(container, "RAM", "100.0 MB");
    expectBlockValue(container, "Devices", "2");
    expectBlockValue(container, "Uptime", "1h 1m");
  });

  it("handles missing or invalid data gracefully", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { cpuPercent: null, alloc: "invalid", uptime: null }, error: undefined })
      .mockReturnValueOnce({ data: { connections: null }, error: undefined })
      .mockReturnValueOnce({ data: [], error: undefined });

    const service = { widget: { type: "syncthing", url: "http://x" } };
    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expectBlockValue(container, "CPU", "—");
    expectBlockValue(container, "RAM", "—");
    expectBlockValue(container, "Devices", "0");
    expectBlockValue(container, "Uptime", "—");
  });

  it("renders folders sorted by name", () => {
    useWidgetAPI
      .mockReturnValueOnce({ data: { cpuPercent: 10, alloc: 0, uptime: 0 }, error: undefined })
      .mockReturnValueOnce({ data: { connections: {} }, error: undefined })
      .mockReturnValueOnce({ data: [
        { id: "z-folder", label: "Z Folder" },
        { id: "a-folder", label: "A Folder" },
        { id: "m-folder" }
      ], error: undefined });

    const service = { widget: { type: "syncthing", url: "http://x" } };
    renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    const folders = screen.getAllByText(/Folder|m-folder/);
    expect(folders).toHaveLength(3);
    // Folders should be sorted: A Folder, m-folder, Z Folder
    expect(folders[0]).toHaveTextContent("A Folder");
    expect(folders[1]).toHaveTextContent("m-folder");
    expect(folders[2]).toHaveTextContent("Z Folder");
  });
});