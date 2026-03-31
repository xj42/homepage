import genericProxyHandler from "utils/proxy/handlers/generic";

export default {
  api: "{url}/rest/{endpoint}",
  proxyHandler: genericProxyHandler,
  mappings: {
    status: {
      endpoint: "system/status",
    },
    connections: {
      endpoint: "system/connections",
    },
    folders: {
      endpoint: "config/folders",
    },
    completion: {
      endpoint: "db/completion",
      params: ["folder"],
    },
  },
};