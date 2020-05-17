#!/usr/bin/env python3
"""
Simple agent script that collects the public IP address of the machine it is
running on and then updates a Cloudflare Worker.

All requests are signed using a pre-shared key to ensure the integrity of the
message and authenticate the source.
"""
import os
import sys
import hmac
import json
import logging
import random
from datetime import datetime
from urllib import request, parse, error


logger = logging.getLogger(__name__)

IP_SOURCES = [
    "https://api.ipify.org/",
    "https://icanhazip.com/",
    "https://ifconfig.me/",
]

# For some reason the default urllib User-Agent is blocked
FAKE_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36"


def setup_logger() -> None:
    form = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    handler.setFormatter(form)

    logger.setLevel(logging.INFO)
    logger.addHandler(handler)


def get_ip_address() -> str:
    url = random.choice(IP_SOURCES)
    res = request.urlopen(url)
    return res.read().decode("utf8").strip()


def sign_message(message: bytes, key: bytes) -> str:
    message_hmac = hmac.new(key, message, digestmod="sha256")
    return message_hmac.hexdigest()


def update_dns_record(url: str, key: str):
    ip_addr = get_ip_address()
    timestamp = int(datetime.now().timestamp())
    payload = json.dumps({"addr": ip_addr, "timestamp": timestamp}).encode("utf8")
    signature = sign_message(payload, key.encode("utf8"))

    req = request.Request(f"https://{url}")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    req.add_header("User-Agent", FAKE_USER_AGENT)
    req.add_header("Authorization", signature)
    req.add_header("Content-Length", len(payload))
    request.urlopen(req, payload)
    logger.info("DNS Record updated successfully")


if __name__ == "__main__":
    setup_logger()
    key = os.environ.get("SHARED_KEY")
    url = os.environ.get("WORKER_URL")
    if key and url:
        try:
            update_dns_record(url, key)
        except (error.URLError, error.HTTPError) as err:
            logger.exception("Failed to update DNS record")
    else:
        logger.error("Cannot find configs. Aborting DNS update")
