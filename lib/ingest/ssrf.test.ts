import assert from "node:assert/strict";
import test from "node:test";
import { assertAllowedUrl, isPublicAddress } from "./ssrf";

test("SSRF address checks reject private, loopback, and reserved destinations", () => {
  for (const address of ["127.0.0.1", "10.20.30.40", "169.254.169.254", "192.168.1.2", "::1", "fc00::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPublicAddress(address), false, `${address} should not be treated as public`);
  }
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("URL validation allows standard public HTTP ports only", () => {
  assert.equal(assertAllowedUrl("https://example.com/path").hostname, "example.com");
  assert.throws(() => assertAllowedUrl("http://127.0.0.1/"), /Private or local network/);
  assert.throws(() => assertAllowedUrl("https://example.com:8443/"), /standard ports/);
});
