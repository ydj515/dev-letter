export function encodeAdminCredentials(username: string, password: string) {
  const raw = `${username}:${password}`;

  if (typeof Buffer !== "undefined") {
    return Buffer.from(raw, "utf-8").toString("base64");
  }

  if (typeof btoa === "function") {
    return btoa(raw);
  }

  return base64Encode(raw);
}

export function constantTimeEquals(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

function base64Encode(value: string) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  let i = 0;

  while (i < value.length) {
    const c1 = value.charCodeAt(i++);
    const c2 = value.charCodeAt(i++);
    const c3 = value.charCodeAt(i++);

    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (c2 >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (c3 >> 6);
    const e4 = isNaN(c2) || isNaN(c3) ? 64 : c3 & 63;

    output += chars.charAt(e1);
    output += chars.charAt(e2);
    output += e3 === 64 ? "=" : chars.charAt(e3);
    output += e4 === 64 ? "=" : chars.charAt(e4);
  }

  return output;
}
