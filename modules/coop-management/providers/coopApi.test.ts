import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listItems } from "./coopApi";

describe("coopApi", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it("listItems calls internal api with collection param", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ ok: 1 }], meta: { total: 1 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const res = await listItems<{ ok: number }>("user", { limit: "1" });
    expect(res.data).toHaveLength(1);

    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain("/api/coop?");
    expect(calledUrl).toContain("collection=user");
    expect(calledUrl).toContain("limit=1");
  });

  it("listItems returns empty array when data is not array", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const res = await listItems("user", { limit: "1" });
    expect(res.data).toEqual([]);
  });
});
