import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedByRobots } from "./robots";

test("robots rules use longest match and allow wins a tie", () => {
  const robots = `User-agent: *
Disallow: /private/
Allow: /private/public
Disallow: /files/*.pdf$
`;
  assert.equal(isAllowedByRobots(robots, "PramanaBot/1.0", "/private/public/notice"), true);
  assert.equal(isAllowedByRobots(robots, "PramanaBot/1.0", "/private/account"), false);
  assert.equal(isAllowedByRobots(robots, "PramanaBot/1.0", "/files/archive.pdf"), false);
  assert.equal(isAllowedByRobots(robots, "PramanaBot/1.0", "/files/archive.pdf/extra"), true);
});
