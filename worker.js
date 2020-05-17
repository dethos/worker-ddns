/**
 * This handled a request to update a given DNS record.
 * The request should have the following format:
 *
 * { "addr": "<ipv4_addr>", "timestamp": <unix_timestamp> }
 *
 * The request must be made by the machine that the record will be pointed to
 * and contain the HMAC (of the request body) in the "Authorization" header
 */
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

/**
 * Handles the request and validates if changes should be made or not
 * @param {Request} request
 */
async function handleRequest(request) {
  if (request.method === "POST") {
    let valid_request = await is_valid(request);
    if (valid_request) {
      const addr = request.headers.get("cf-connecting-ip");
      await updateRecord(addr);
      return new Response("Não há gente como a gente", { status: 200 });
    }
  }
  return new Response("Por cima", { status: 401 });
}

/**
 * Checks if it is a valid and authentic request
 * @param {Request} request
 */
async function is_valid(request) {
  const window = 300; // 5 minutes in seconds
  const rawBody = await request.text();
  let bodyContent = {};
  try {
    bodyContent = JSON.parse(rawBody);
  } catch (e) {
    return false;
  }

  const sourceAddr = request.headers.get("cf-connecting-ip");
  const signature = request.headers.get("authorization");
  if (!signature || !bodyContent.addr || sourceAddr != bodyContent.addr) {
    return false;
  }

  const valid_hmac = await verifyHMAC(signature, rawBody);
  if (!valid_hmac) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - bodyContent.timestamp > window) {
    return false;
  }
  return true;
}

/**
 * Verifies the provided HMAC matches the message
 * @param {String} signature
 * @param {String} message
 */
async function verifyHMAC(signature, message) {
  let encoder = new TextEncoder();
  let key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SHARED_KEY),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["verify"]
  );

  result = await crypto.subtle.verify(
    "HMAC",
    key,
    hexToArrayBuffer(signature),
    encoder.encode(message)
  );
  return result;
}

/**
 * Updates the DNS record with the provided IP
 * @param {String} addr
 */
async function updateRecord(addr) {
  const base = "https://api.cloudflare.com/client/v4/zones";
  const init = { headers: { Authorization: `Bearer ${CF_API_TOKEN}` } };
  let record;

  let record_res = await fetch(
    `${base}/${ZONE}/dns_records?name=${DNS_RECORD}`,
    init
  );
  if (record_res.ok) {
    record = (await record_res.json()).result[0];
  } else {
    console.log("Get record failed");
    return;
  }

  if (record.content != addr) {
    init.method = "PATCH";
    init.body = JSON.stringify({ content: addr });
    await fetch(`${base}/${ZONE}/dns_records/${record.id}`, init);
    console.log("Updated record");
  } else {
    console.log("Record content is the same, skipping update");
  }
}

/**
 * Transforms an HEX string into an ArrayBuffer
 * Original work of: https://github.com/LinusU/hex-to-array-buffer
 * @param {String} hex
 */
function hexToArrayBuffer(hex) {
  if (typeof hex !== "string") {
    throw new TypeError("Expected input to be a string");
  }

  if (hex.length % 2 !== 0) {
    throw new RangeError("Expected string to be an even number of characters");
  }

  var view = new Uint8Array(hex.length / 2);

  for (var i = 0; i < hex.length; i += 2) {
    view[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }

  return view.buffer;
}
