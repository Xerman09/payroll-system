import { describe, it, expect } from "vitest";
import { buildExternalUrlFromUrl } from "./_routeHelpers";

describe("coop route helpers", () => {
  it("buildExternalUrlFromUrl builds items url with forwarded params", () => {
    const reqUrl =
      "http://localhost:3000/api/coop?collection=user&limit=10&filter[user_id][_in]=1,2,3";
    const out = buildExternalUrlFromUrl(reqUrl, "http://example.com/");
    expect(out).toBe(
      "http://example.com/items/user?limit=10&filter%5Buser_id%5D%5B_in%5D=1%2C2%2C3"
    );
  });

  it("includes /id when id param provided", () => {
    const reqUrl = "http://localhost:3000/api/coop?collection=employee_loan&id=5";
    const out = buildExternalUrlFromUrl(reqUrl, "http://api.local");
    expect(out).toBe("http://api.local/items/employee_loan/5");
  });

  it("rejects non-whitelisted collection", () => {
    const reqUrl = "http://localhost:3000/api/coop?collection=not_allowed";
    expect(() => buildExternalUrlFromUrl(reqUrl, "http://api.local")).toThrow(
      /Invalid or missing collection parameter/
    );
  });

  it("preserves legacy behavior when base is undefined", () => {
    const reqUrl = "http://localhost:3000/api/coop?collection=user&limit=1";
    const out = buildExternalUrlFromUrl(reqUrl, undefined);
    expect(out.startsWith("undefined/items/user")).toBe(true);
  });
});
