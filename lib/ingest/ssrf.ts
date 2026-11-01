import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UrlSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlSecurityError";
  }
}

function ipv4Number(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts.reduce((value, part) => value * 256 + part, 0);
}

function inIpv4Range(value: number, base: string, bits: number) {
  const start = ipv4Number(base);
  if (start === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (start & mask);
}

function isPublicIpv4(address: string) {
  const value = ipv4Number(address);
  if (value === null) return false;
  const reserved = [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
    ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
    ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
  ] as const;
  return !reserved.some(([base, bits]) => inIpv4Range(value, base, bits));
}

function ipv6Words(address: string): number[] | null {
  let value = address.toLowerCase().split("%")[0];
  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    const ipv4 = ipv4Number(value.slice(lastColon + 1));
    if (ipv4 === null) return null;
    const high = ((ipv4 >>> 16) & 0xffff).toString(16);
    const low = (ipv4 & 0xffff).toString(16);
    value = `${value.slice(0, lastColon)}:${high}:${low}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right].map((part) => Number.parseInt(part || "0", 16));
  return groups.length === 8 && groups.every((part) => Number.isInteger(part) && part >= 0 && part <= 0xffff) ? groups : null;
}

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;
  const words = ipv6Words(address);
  if (!words) return false;
  const integer = words.reduce((value, word) => (value << BigInt(16)) | BigInt(word), BigInt(0));
  const globalUnicast = (integer >> BigInt(125)) === BigInt(1);
  const documentation = words[0] === 0x2001 && words[1] === 0x0db8;
  const teredo = words[0] === 0x2001 && words[1] === 0;
  const sixToFour = words[0] === 0x2002;
  const reservedDocumentation = words[0] === 0x3fff;
  return globalUnicast && !documentation && !teredo && !sixToFour && !reservedDocumentation;
}

export function assertAllowedUrl(input: string | URL) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UrlSecurityError("The source URL is invalid.");
  }
  const portAllowed = url.protocol === "http:" ? !url.port || url.port === "80" : url.protocol === "https:" ? !url.port || url.port === "443" : false;
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!portAllowed || url.username || url.password) {
    throw new UrlSecurityError("Only public HTTP or HTTPS URLs on their standard ports are allowed.");
  }
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new UrlSecurityError("Private or local network sources are not allowed.");
  }
  if (isIP(hostname) && !isPublicAddress(hostname)) {
    throw new UrlSecurityError("Private or local network sources are not allowed.");
  }
  return url;
}

export async function resolvePublicHost(urlInput: string | URL) {
  const url = assertAllowedUrl(urlInput);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const literalFamily = isIP(hostname);
  let addresses: Array<{ address: string; family: number }>;
  if (literalFamily) {
    addresses = [{ address: hostname, family: literalFamily }];
  } else {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      addresses = await Promise.race([
        lookup(hostname, { all: true, verbatim: true }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new UrlSecurityError("The source host took too long to resolve.")), 8_000);
        }),
      ]);
    } catch (error) {
      if (error instanceof UrlSecurityError) throw error;
      throw new UrlSecurityError("The source host could not be resolved safely.");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new UrlSecurityError("The source host resolves to a private or reserved network address.");
  }
  return { url, address: addresses[0].address, family: addresses[0].family };
}
