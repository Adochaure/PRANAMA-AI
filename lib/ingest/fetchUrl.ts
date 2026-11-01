import http from "node:http";
import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import type { LookupFunction } from "node:net";
import { resolvePublicHost, UrlSecurityError } from "./ssrf";

export const USER_AGENT = "PramanaBot/1.0 (hackathon prototype)";
export const MAX_FETCH_BYTES = 2 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 8_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type PublicFetchResult = { url: URL; status: number; headers: IncomingHttpHeaders; body: Buffer };

function requestOnce(url: URL, address: string, family: number, maxBytes: number): Promise<Omit<PublicFetchResult, "url">> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const lookupPinned: LookupFunction = (_hostname, options, callback) => {
      if (typeof options === "object" && options !== null && "all" in options && options.all) {
        callback(null, [{ address, family }]);
      } else {
        callback(null, address, family);
      }
    };
    const request = transport.request(url, {
      method: "GET",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/pdf,text/plain;q=0.9,*/*;q=0.1",
        "accept-encoding": "identity",
      },
      lookup: lookupPinned,
      servername: family === 6 && url.hostname.startsWith("[") ? undefined : url.hostname,
    }, (response) => {
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > maxBytes) {
          response.destroy(new Error("The source is larger than the 2 MB fetch limit."));
          return;
        }
        chunks.push(buffer);
      });
      response.on("error", fail);
      response.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) });
      });
    });
    request.setTimeout(FETCH_TIMEOUT_MS, () => request.destroy(new Error("The source took longer than 8 seconds to respond.")));
    request.on("error", fail);
    request.end();
  });
}

export async function fetchPublicUrl(input: string | URL, options: { maxBytes?: number; maxRedirects?: number } = {}): Promise<PublicFetchResult> {
  const maxBytes = options.maxBytes ?? MAX_FETCH_BYTES;
  const maxRedirects = options.maxRedirects ?? 3;
  let target = new URL(input);
  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    const resolved = await resolvePublicHost(target);
    const response = await requestOnce(resolved.url, resolved.address, resolved.family, maxBytes);
    const location = response.headers.location;
    if (!REDIRECT_STATUSES.has(response.status) || !location) return { ...response, url: resolved.url };
    if (redirect === maxRedirects) throw new Error("The source redirected too many times.");
    try {
      target = new URL(location, resolved.url);
    } catch {
      throw new Error("The source returned an invalid redirect.");
    }
  }
  throw new UrlSecurityError("The source redirect could not be followed safely.");
}
