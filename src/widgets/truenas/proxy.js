import WebSocket from "ws";

import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import { formatApiCall, sanitizeErrorURL } from "utils/proxy/api-helpers";
import credentialedProxyHandler from "utils/proxy/handlers/credentialed";
import validateWidgetData from "utils/proxy/validate-widget-data";
import widgets from "widgets/widgets";

const logger = createLogger("truenasProxyHandler");

function waitForEvent(ws, handler, { event = "message", parseJson = true, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("TrueNAS websocket wait timed out"));
    }, timeoutMs);

    const handleEvent = (payload) => {
      try {
        let parsed = payload;
        if (parseJson) {
          if (Buffer.isBuffer(payload)) {
            parsed = JSON.parse(payload.toString());
          } else if (typeof payload === "string") {
            parsed = JSON.parse(payload);
          }
        }
        const handlerResult = handler(parsed);
        if (handlerResult !== undefined) {
          cleanup();
          if (handlerResult instanceof Error) {
            reject(handlerResult);
          } else {
            resolve(handlerResult);
          }
        }
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    const handleError = (err) => {
      cleanup();
      logger.error("TrueNAS websocket error: %s", err?.message ?? err);
      reject(err);
    };

    const handleClose = () => {
      cleanup();
      logger.debug("TrueNAS websocket connection closed unexpectedly");
      reject(new Error("TrueNAS websocket closed the connection"));
    };

    function cleanup() {
      clearTimeout(timeout);
      ws.off(event, handleEvent);
      ws.off("error", handleError);
      ws.off("close", handleClose);
    }

    ws.on(event, handleEvent);
    ws.on("error", handleError);
    ws.on("close", handleClose);
  });
}

let nextId = 1;
async function sendMethod(ws, method, params = [], { protocol = "jsonrpc", timeoutMs = 10000 } = {}) {
  const id = nextId++;
  const payload =
    protocol === "legacy"
      ? { id, msg: "method", method, params }
      : { jsonrpc: "2.0", id, method, params };
  ws.send(JSON.stringify(payload));

  return waitForEvent(
    ws,
    (message) => {
      if (message?.id !== id) return undefined;

      if (protocol === "legacy") {
        if (message?.error) {
          return new Error(message.error?.reason || message.error?.message || JSON.stringify(message.error));
        }
        if (message?.msg && message.msg !== "result") return undefined;
        return message?.result ?? message;
      }

      if (message?.error) {
        return new Error(message.error?.message || JSON.stringify(message.error));
      }
      return message?.result ?? message;
    },
    { timeoutMs },
  );
}

async function ensureLegacyConnected(ws) {
  ws.send(JSON.stringify({ msg: "connect", version: "1", support: ["1"] }));
  return waitForEvent(
    ws,
    (message) => {
      if (!message?.msg) return undefined;
      if (message.msg === "connected") return true;
      if (message.msg === "failed") {
        return new Error(message.error || "TrueNAS websocket legacy handshake failed");
      }
      return undefined;
    },
    { timeoutMs: 3000 },
  );
}

async function sendMethodAuto(ws, method, params = []) {
  // Prefer JSON-RPC first; fallback to legacy middleware protocol for compatibility.
  try {
    return await sendMethod(ws, method, params, { protocol: "jsonrpc", timeoutMs: 2500 });
  } catch (_jsonRpcError) {
    await ensureLegacyConnected(ws);
    return sendMethod(ws, method, params, { protocol: "legacy" });
  }
}

async function openTrueNasSocket(widget, wsTemplate) {
  const wsUrl = new URL(formatApiCall(wsTemplate, { ...widget }));
  const useSecure = wsUrl.protocol === "https:" || Boolean(widget.key); // API key requires secure connection
  wsUrl.protocol = useSecure ? "wss:" : "ws:";
  const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });
  await waitForEvent(ws, () => true, { event: "open", parseJson: false, timeoutMs: 5000 });
  return ws;
}

async function connectWithFallback(widget) {
  const candidates = [widgets[widget.type].wsAPI, "{url}/websocket"].filter(Boolean);
  let lastError;

  for (let i = 0; i < candidates.length; i += 1) {
    const template = candidates[i];

    try {
      return await openTrueNasSocket(widget, template);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Unable to connect to TrueNAS websocket endpoint");
}

async function authenticate(ws, widget) {
  if (widget?.key) {
    try {
      const apiKeyResult = await sendMethodAuto(ws, "auth.login_with_api_key", [widget.key]);
      if (apiKeyResult === true) return;
      logger.warn("TrueNAS API key authentication failed, falling back to username/password when available.");
    } catch (err) {
      logger.error("TrueNAS API key authentication failed: %s", err?.message ?? err);
    }
  }

  if (widget?.username && widget?.password) {
    const loginResult = await sendMethodAuto(ws, "auth.login", [widget.username, widget.password]);
    if (loginResult === true) return;
    logger.warn("TrueNAS username/password authentication failed.");
  }

  throw new Error("TrueNAS authentication failed");
}

function latestSeriesRate(series) {
  if (!Array.isArray(series?.data) || series.data.length === 0) return null;

  for (let i = series.data.length - 1; i >= 0; i -= 1) {
    const point = series.data[i];
    if (Array.isArray(point) && point.length >= 3) {
      const values = point.slice(1).filter((value) => typeof value === "number" && Number.isFinite(value));
      if (values.length >= 2) return values;
    }
  }

  return null;
}

async function fetchNetworkReporting(ws) {
  const graphs = await sendMethodAuto(ws, "reporting.netdata_graphs");
  const interfaceGraph = Array.isArray(graphs) ? graphs.find((graph) => graph?.name === "interface") : null;
  const identifiers = Array.isArray(interfaceGraph?.identifiers)
    ? interfaceGraph.identifiers.filter((identifier) => typeof identifier === "string" && identifier.length > 0)
    : [];

  if (identifiers.length === 0) {
    return null;
  }

  const series = await sendMethodAuto(ws, "reporting.netdata_get_data", [
    identifiers.map((identifier) => ({ name: "interface", identifier })),
    { unit: "HOUR" },
  ]);

  if (!Array.isArray(series)) {
    return null;
  }

  return series
    .map((entry) => {
      const latest = latestSeriesRate(entry);
      if (!latest) return null;

      // TrueNAS reports interface traffic in kilobits/s; Homepage expects bytes/s.
      const [rxKilobitsPerSecond, txKilobitsPerSecond] = latest;
      return {
        name: entry.identifier ?? entry.name,
        rx_bytes_rate: (rxKilobitsPerSecond * 1000) / 8,
        tx_bytes_rate: (txKilobitsPerSecond * 1000) / 8,
      };
    })
    .filter(Boolean);
}

export default async function truenasProxyHandler(req, res, map) {
  const { group, service, endpoint, index } = req.query;
  if (!group || !service) {
    logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const widget = await getServiceWidget(group, service, index);

  if (!widget) {
    logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  if (!endpoint) {
    return res.status(204).end();
  }

  const version = Number(widget.version ?? 1);
  if (Number.isNaN(version) || version < 2) {
    // Use legacy REST proxy for version 1
    return credentialedProxyHandler(req, res, map);
  }

  const mappingEntry = Object.values(widgets[widget.type].mappings).find((mapping) => mapping.endpoint === endpoint);
  const wsMethod = mappingEntry?.wsMethod;

  if (!wsMethod) {
    logger.debug("Missing wsMethod mapping for TrueNAS endpoint %s", endpoint);
    return res.status(500).json({ error: "Missing wsMethod mapping." });
  }

  try {
    let data;
    const ws = await connectWithFallback(widget);
    try {
      await authenticate(ws, widget);
      if (mappingEntry?.endpoint === widgets[widget.type].mappings.network.endpoint) {
        data = (await fetchNetworkReporting(ws)) ?? (await sendMethodAuto(ws, wsMethod));
      } else {
        data = await sendMethodAuto(ws, wsMethod);
      }
    } finally {
      ws.close();
    }

    if (!validateWidgetData(widget, endpoint, data)) {
      return res.status(500).json({ error: { message: "Invalid data", url: sanitizeErrorURL(widget.url), data } });
    }

    if (map) data = map(data);

    return res.status(200).json(data);
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    logger.error("Websocket call for TrueNAS failed: %s", err?.message ?? err);
    return res.status(500).json({ error: err?.message ?? "TrueNAS websocket call failed" });
  }
}
