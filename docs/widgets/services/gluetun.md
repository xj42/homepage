---
title: Gluetun
description: Gluetun Widget Configuration
---

Learn more about [Gluetun](https://github.com/qdm12/gluetun).

!!! note

    Requires [HTTP control server options](https://github.com/qdm12/gluetun-wiki/blob/main/setup/advanced/control-server.md) to be enabled. By default this runs on port `8000`.

Allowed fields: `["public_ip", "region", "country", "port_forwarded", "dns_status", "vpn_status"]`.
Default fields: `["public_ip", "region", "country"]`.

To setup authentication, follow [the official Gluetun documentation](https://github.com/qdm12/gluetun-wiki/blob/main/setup/advanced/control-server.md#authentication). Note that to use the api key method, you must add the route `GET /v1/publicip/ip` to the `routes` array in your Gluetun config.toml. Similarly, for optional fields, add:
- `port_forwarded`: `GET /v1/openvpn/portforwarded` (or `/v1/portforward` for widget version 2)
- `dns_status`: `GET /v1/dns/status`
- `vpn_status`: `GET /v1/vpn/status`

| Gluetun Version | Homepage Widget Version |
| --------------- | ----------------------- |
| < 3.40.1        | 1 (default)             |
| >= 3.40.1       | 2                       |

```yaml
widget:
  type: gluetun
  url: http://gluetun.host.or.ip:port
  key: gluetunkey # Not required if /v1/publicip/ip endpoint is configured with `auth = none`
  version: 2 # optional, default is 1
```
