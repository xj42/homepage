// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

vi.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key, opts) => (key === "common.bytes" ? `${opts?.value} bytes` : key),
  }),
}));

import Folder from "./folder";

describe("widgets/syncthing/folder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWidgetAPI.mockReturnValue({ data: undefined, error: undefined });
  });

  it("renders loading state", () => {
    render(<Folder widget={{}} id="test-folder" name="Test Folder" />);

    expect(screen.getByText("Test Folder")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    // Should have yellow status indicator for loading
    const statusIndicator = document.querySelector(".bg-yellow-500");
    expect(statusIndicator).toBeInTheDocument();
  });

  it("renders error state", () => {
    useWidgetAPI.mockReturnValue({ data: undefined, error: { message: "sync error" } });

    render(<Folder widget={{}} id="test-folder" name="Test Folder" />);

    expect(screen.getByText("Test Folder")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    // Should have red status indicator for error
    const statusIndicator = document.querySelector(".bg-red-500");
    expect(statusIndicator).toBeInTheDocument();
  });

  it("renders completion data correctly", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        completion: 75.5,
        globalBytes: 1000000, // 1 MB
        needBytes: 250000     // 250 KB needed
      },
      error: undefined
    });

    render(<Folder widget={{}} id="test-folder" name="Test Folder" />);

    expect(screen.getByText("Test Folder")).toBeInTheDocument();
    expect(screen.getByText("750000 bytes / 1000000 bytes")).toBeInTheDocument();
    expect(screen.getByText("(76%)")).toBeInTheDocument();
    // Should have yellow status indicator for incomplete sync
    const statusIndicator = document.querySelector(".bg-yellow-500");
    expect(statusIndicator).toBeInTheDocument();
  });

  it("renders 100% completion with green indicator", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        completion: 100,
        globalBytes: 500000,
        needBytes: 0
      },
      error: undefined
    });

    render(<Folder widget={{}} id="test-folder" name="Test Folder" />);

    expect(screen.getByText("Test Folder")).toBeInTheDocument();
    expect(screen.getByText("500000 bytes / 500000 bytes")).toBeInTheDocument();
    expect(screen.getByText("(100%)")).toBeInTheDocument();
    // Should have green status indicator for complete sync
    const statusIndicator = document.querySelector(".bg-green-500");
    expect(statusIndicator).toBeInTheDocument();
  });

  it("handles invalid completion values", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        completion: -10, // Invalid negative
        globalBytes: 1000,
        needBytes: 200
      },
      error: undefined
    });

    render(<Folder widget={{}} id="test-folder" name="Test Folder" />);

    // Completion should be clamped to 0
    expect(screen.getByText("(0%)")).toBeInTheDocument();
  });

  it("handles completion over 100", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        completion: 150, // Over 100
        globalBytes: 1000,
        needBytes: 0
      },
      error: undefined
    });

    render(<Folder widget={{}} id="test-folder" name="Test Folder" />);

    // Completion should be clamped to 100
    expect(screen.getByText("(100%)")).toBeInTheDocument();
  });

  it("calculates synced bytes correctly", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        completion: 50,
        globalBytes: 1000,
        needBytes: 500
      },
      error: undefined
    });

    render(<Folder widget={{}} id="test-folder" name="Test Folder" />);

    // syncedBytes = globalBytes - needBytes = 1000 - 500 = 500
    expect(screen.getByText("500 bytes / 1000 bytes")).toBeInTheDocument();
  });

  it("handles missing data fields", () => {
    useWidgetAPI.mockReturnValue({
      data: {
        completion: undefined,
        globalBytes: undefined,
        needBytes: undefined
      },
      error: undefined
    });

    render(<Folder widget={{}} id="test-folder" name="Test Folder" />);

    expect(screen.getByText("0 bytes / 0 bytes")).toBeInTheDocument();
    expect(screen.getByText("(0%)")).toBeInTheDocument();
  });
});