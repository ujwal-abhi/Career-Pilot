import { describe, expect, it } from "vitest";
import { asHttpUrl } from "../../src/utils/url";

describe("asHttpUrl", () => {
  it("accepts https and http links", () => {
    expect(asHttpUrl("https://zoom.us/j/12345")).toBe("https://zoom.us/j/12345");
    expect(asHttpUrl("http://example.com/room")).toBe("http://example.com/room");
  });

  it("trims surrounding spaces and normalises the address", () => {
    expect(asHttpUrl("  https://example.com  ")).toBe("https://example.com/");
  });

  it("keeps the query string", () => {
    expect(asHttpUrl("https://meet.example.com/join?room=a&pwd=b")).toBe("https://meet.example.com/join?room=a&pwd=b");
  });

  // A location is free text the user typed. Only web links may ever become clickable.
  it.each([
    ["javascript:alert(1)"],
    ["JaVaScRiPt:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["ftp://example.com/file"],
    ["file:///etc/passwd"],
    ["mailto:someone@example.com"],
    ["vbscript:msgbox(1)"],
  ])("refuses %s", (value) => {
    expect(asHttpUrl(value)).toBeNull();
  });

  it.each([[""], ["   "], ["Room 4B, second floor"], ["example.com"], ["http://"]])(
    "returns null for text that is not a link: %j",
    (value) => {
      expect(asHttpUrl(value)).toBeNull();
    }
  );
});