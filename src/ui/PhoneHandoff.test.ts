import { describe, expect, it } from "vitest";
import { qorexBrowseLink } from "./PhoneHandoff";

describe("qorexBrowseLink", () => {
  it("wraps the page in QoreX's universal link, fully encoded", () => {
    expect(qorexBrowseLink("https://unyoke.duckdns.org/app?address=qor1abc")).toBe(
      "https://link.qore.network/browse?url=https%3A%2F%2Funyoke.duckdns.org%2Fapp%3Faddress%3Dqor1abc",
    );
  });
});
