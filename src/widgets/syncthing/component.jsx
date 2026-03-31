import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import useWidgetAPI from "utils/proxy/use-widget-api";

import Folder from "./folder";

function formatUptime(seconds = 0) {
  const total = Number(seconds) || 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function Component({ service }) {
  const { widget } = service;

  const { data: systemData, error: systemError } = useWidgetAPI(widget, "status");
  const { data: connectionsData, error: connectionsError } = useWidgetAPI(widget, "connections");
  const { data: foldersData, error: foldersError } = useWidgetAPI(widget, "folders");

  if (systemError || connectionsError || foldersError) {
    const finalError = systemError ?? connectionsError ?? foldersError;
    return <Container service={service} error={finalError} />;
  }

  if (!systemData || !connectionsData || !foldersData) {
    return (
      <Container service={service}>
        <Block label="CPU" />
        <Block label="RAM" />
        <Block label="Devices" />
        <Block label="Uptime" />
      </Container>
    );
  }

  const connectedDevices = Object.values(connectionsData.connections || {}).filter(
    (device) => device?.connected
  ).length;

  const cpu =
    typeof systemData.cpuPercent === "number"
      ? `${systemData.cpuPercent.toFixed(1)}%`
      : "—";

  const memory =
    typeof systemData.alloc === "number"
      ? `${(systemData.alloc / 1024 / 1024).toFixed(1)} MB`
      : "—";

  const uptime =
    typeof systemData.uptime === "number"
      ? formatUptime(systemData.uptime)
      : "—";

  const folders = Array.isArray(foldersData)
    ? [...foldersData].sort((a, b) =>
        (a.label || a.id || "").localeCompare(b.label || b.id || "")
      )
    : [];

  return (
    <>
      <Container service={service}>
        <Block label="CPU" value={cpu} />
        <Block label="RAM" value={memory} />
        <Block label="Devices" value={String(connectedDevices)} />
        <Block label="Uptime" value={uptime} />
      </Container>

      {folders.map((folder) => (
        <Folder
          key={folder.id}
          widget={widget}
          id={folder.id}
          name={folder.label || folder.id}
        />
      ))}
    </>
  );
}