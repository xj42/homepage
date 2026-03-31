import Block from "components/services/widget/block";
import Container from "components/services/widget/container";

import useWidgetAPI from "utils/proxy/use-widget-api";

export default function Component({ service }) {
  const { widget } = service;

  if (!widget.fields) {
    widget.fields = ["public_ip", "region", "country"];
  }

  const { data: gluetunData, error: gluetunError } = useWidgetAPI(widget, "ip");

  const includePF = widget.fields.includes("port_forwarded");
  const pfEndpoint = widget.version > 1 ? "port_forwarded_v2" : "port_forwarded";
  const { data: portForwardedData, error: portForwardedError } = useWidgetAPI(widget, includePF ? pfEndpoint : "");

  const includeDNSStatus = widget.fields.includes("dns_status");
  const { data: dnsStatusData, error: dnsStatusError } = useWidgetAPI(widget, includeDNSStatus ? "dns_status" : "");

  const includeVPNStatus = widget.fields.includes("vpn_status");
  const { data: vpnStatusData, error: vpnStatusError } = useWidgetAPI(widget, includeVPNStatus ? "vpn_status" : "");

  if (gluetunError || (includePF && portForwardedError) || (includeDNSStatus && dnsStatusError) || (includeVPNStatus && vpnStatusError)) {
    return <Container service={service} error={gluetunError || portForwardedError || dnsStatusError || vpnStatusError} />;
  }

  if (
    !gluetunData ||
    (includePF && !portForwardedData) ||
    (includeDNSStatus && !dnsStatusData) ||
    (includeVPNStatus && !vpnStatusData)
  ) {
    return (
      <Container service={service}>
        <Block label="gluetun.public_ip" />
        <Block label="gluetun.region" />
        <Block label="gluetun.country" />
        {includePF && <Block label="gluetun.port_forwarded" />}
        {includeDNSStatus && <Block label="gluetun.dns_status" />}
        {includeVPNStatus && <Block label="gluetun.vpn_status" />}
      </Container>
    );
  }

  return (
    <Container service={service}>
      <Block label="gluetun.public_ip" value={gluetunData.public_ip} />
      <Block label="gluetun.region" value={gluetunData.region} />
      <Block label="gluetun.country" value={gluetunData.country} />
      {includePF && <Block label="gluetun.port_forwarded" value={portForwardedData?.port} />}
      {includeDNSStatus && <Block label="gluetun.dns_status" value={dnsStatusData?.status} />}
      {includeVPNStatus && <Block label="gluetun.vpn_status" value={vpnStatusData?.status} />}
    </Container>
  );
}
