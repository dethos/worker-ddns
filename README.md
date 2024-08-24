# Worker DDNS

This repository provides two simple scripts that, together, will allow you to build a
simple and efficient DDNS system using Cloudflare Workers and DNS.

**Example use case:** You have a machine where the IP address is dynamically assigned and
changes frequently.

The `agent.py` will regularly contact the CF worker running the `worker.js` code,
that will in turn use the Cloudflare API to update the DNS record in question
with the new IP address.

## Why use Workers

Because we don't want to sign up for an extra external service, we want to apply
the principle of the least privilege, and the name should belong to a domain we
control.

Since Cloudflare API Token permissions aren't granular enough to limit the token
access to a single DNS record, we place a worker in front of it (this way the token
with extra privileges, never leaves Cloudflare's servers).

## Usage

Both scripts (`worker.js` and `agent.py`) don't require any extra dependencies
(they rely only on the existing "standard libraries"), so they can be copied, right
out of the repository to the destination without any extra steps.

Before starting, you need to create a new API Token on your Cloudflare's profile page with
permissions to edit the DNS records of one of your domains (Zone).

### Worker

The next step is to create a new worker and then set `worker.js` as its content.
This can be easily done using the "Quick Edit" button on the worker's detail page.

Add the following environment variables on the worker settings tab:

- `CF_API_TOKEN` - The token you just created. You just also click on the
  "encrypt" button.
- `SHARED_KEY` - Generate a long and random string and put it here. Click encrypt.
- `DNS_RECORD` - the DNS record that should be updated. Something like
  `<somename>.<your-domain>`.
- `ZONE` - The zone_id of your domain. You can find it on the sidebar of the domain
  overview page.

Then deploy the worker.

### Agent

Copy the `agent.py` file to the machine where you want your subdomain/domain
"pointed to".

Set the following environment variables:

- `SHARED_KEY` - The same long and random string you generated for the worker.
- `WORKER_URL` - The URL of your worker.

Then execute the script:

```bash
$ ./agent.py
```

In the most common scenario, you will want to run it periodically. So you will need to
use a scheduler like `cron` or a `systemd timer unit`.

Here's a simple example that can be inserted after running `crontab -e`:

```
SHARED_KEY=<your-generated-key>
WORKER_URL=<cf-worker-url>
*/5 * * * *  /path/to/agent.py
```

On the other hand, if you prefer to use `systemd`, the configuration would look like this:

```
# ddns.service

[Unit]
Description=Updates the DNS record with IP address
Wants=ddns.timer

[Service]
Environment="SHARED_KEY=<your-generated-key>"
Environment="WORKER_URL=<cf-worker-url>"
Type=oneshot
ExecStart=/path/to/agent.py

[Install]
WantedBy=multi-user.target
```

```
# ddns.timer

[Unit]
Description=Runs the DDNS agent periodically
Requires=ddns.service

[Timer]
Unit=ddns.service
OnBootSec=60
OnUnitActiveSec=5m

[Install]
WantedBy=timers.target
```
