import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next";
import Pool from "widgets/truenas/pool";

import useWidgetAPI from "utils/proxy/use-widget-api";

function firstNumber(...values) {
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function hasNetworkCounters(value) {
  if (!value || typeof value !== "object") return false;
  return (
    "received_bytes" in value ||
    "sent_bytes" in value ||
    "rx_bytes" in value ||
    "tx_bytes" in value ||
    "received_bytes_rate" in value ||
    "sent_bytes_rate" in value ||
    "rx_bytes_rate" in value ||
    "tx_bytes_rate" in value
  );
}

function getInterfaces(networkData) {
  if (Array.isArray(networkData)) return networkData;
  if (!networkData || typeof networkData !== "object") return [];
  if (hasNetworkCounters(networkData) || networkData?.state) return [networkData];
  return Object.values(networkData).filter((entry) => entry && typeof entry === "object");
}

function getNetworkTotals(networkData) {
  const totals = getInterfaces(networkData).reduce(
    (totals, networkInterface) => {
      const state = networkInterface?.state ?? {};
      const stats = networkInterface?.stats ?? networkInterface?.statistics ?? {};

      const rxBytes = firstNumber(
        state.received_bytes,
        networkInterface.received_bytes,
        networkInterface.rx_bytes,
        stats.received_bytes,
        stats.rx_bytes,
      );
      const txBytes = firstNumber(
        state.sent_bytes,
        networkInterface.sent_bytes,
        networkInterface.tx_bytes,
        stats.sent_bytes,
        stats.tx_bytes,
      );
      const rxRate = firstNumber(
        state.received_bytes_rate,
        networkInterface.received_bytes_rate,
        networkInterface.rx_bytes_rate,
        stats.received_bytes_rate,
        stats.rx_bytes_rate,
      );
      const txRate = firstNumber(
        state.sent_bytes_rate,
        networkInterface.sent_bytes_rate,
        networkInterface.tx_bytes_rate,
        stats.sent_bytes_rate,
        stats.tx_bytes_rate,
      );

      return {
        usage: totals.usage + rxBytes + txBytes,
        speed: totals.speed + rxRate + txRate,
      };
    },
    { usage: 0, speed: 0 },
  );

  if (totals.usage === 0 && totals.speed > 0) {
    return { ...totals, usage: totals.speed };
  }

  return totals;
}

export default function Component({ service }) {
  const { t } = useTranslation();

  const { widget } = service;

  const { data: alertData, error: alertError } = useWidgetAPI(widget, "alerts");
  const { data: statusData, error: statusError } = useWidgetAPI(widget, "status");
  const { data: networkData, error: networkError } = useWidgetAPI(widget, "network");
  const { data: poolsData, error: poolsError } = useWidgetAPI(widget, widget?.enablePools ? "pools" : "");
  const { data: datasetData, error: datasetError } = useWidgetAPI(widget, widget?.enablePools ? "dataset" : "");

  if (alertError || statusError || networkError || poolsError) {
    const finalError = alertError ?? statusError ?? networkError ?? poolsError ?? datasetError;
    return <Container service={service} error={finalError} />;
  }

  if (!alertData || !statusData || !networkData || (widget?.enablePools && (!poolsData || !datasetData))) {
    return (
      <Container service={service}>
        <Block label="truenas.load" />
        <Block label="truenas.uptime" />
        <Block label="truenas.alerts" />
        <Block label="truenas.speed" />
        <Block label="truenas.usage" />
      </Container>
    );
  }

  let pools = [];
  const showPools =
    Array.isArray(poolsData) && poolsData.length > 0 && Array.isArray(datasetData) && datasetData.length > 0;

  if (showPools) {
    pools = poolsData.map((pool) => {
      const dataset = datasetData.find((d) => d.pool === pool.name && d.name === pool.name);
      return {
        id: pool.id,
        name: pool.name,
        healthy: pool.healthy,
        allocated: dataset?.used.parsed ?? 0,
        free: dataset?.available.parsed ?? 0,
      };
    });
  }

  const { speed, usage } = getNetworkTotals(networkData);

  return (
    <>
      <Container service={service}>
        <Block label="truenas.load" value={t("common.number", { value: statusData.loadavg[0] })} />
        <Block label="truenas.uptime" value={t("common.duration", { value: statusData.uptime_seconds })} />
        <Block label="truenas.alerts" value={t("common.number", { value: alertData.pending })} />
        <Block label="truenas.speed" value={t("common.byterate", { value: speed })} highlightValue={speed} />
        <Block label="truenas.usage" value={t("common.bytes", { value: usage })} highlightValue={usage} />
      </Container>
      {showPools &&
        pools
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((pool) => (
            <Pool key={pool.id} name={pool.name} healthy={pool.healthy} allocated={pool.allocated} free={pool.free} />
          ))}
    </>
  );
}
