import credentialedProxyHandler from "utils/proxy/handlers/credentialed";

const widget = {
  api: "{url}/v1/{endpoint}",
  proxyHandler: credentialedProxyHandler,

  mappings: {
    ip: {
      endpoint: "publicip/ip",
      validate: ["public_ip", "country"],
    },
    port_forwarded: {
      endpoint: "openvpn/portforwarded",
      validate: ["port"],
    },
    port_forwarded_v2: {
      endpoint: "portforward",
      validate: ["port"],
    },
    dns_status: {
      endpoint: "dns/status",
      validate: ["status"],
    },
    vpn_status: {
      endpoint: "vpn/status",
      validate: ["status"],
    },
  },
};

export default widget;
