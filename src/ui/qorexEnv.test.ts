import { describe, expect, it } from "vitest";
import { NO_WINDOW_HELP, explainEvmError } from "./qorexEnv";

describe("explainEvmError", () => {
  it("adds the window help to a wallet's generic error", () => {
    expect(explainEvmError("An unknown RPC error occurred.")).toBe(`An unknown RPC error occurred. ${NO_WINDOW_HELP}`);
  });
  it("does not repeat the help when the message already is it", () => {
    expect(explainEvmError(NO_WINDOW_HELP)).toBe(NO_WINDOW_HELP);
  });
  it("leaves other errors alone", () => {
    expect(explainEvmError("User rejected the request.")).toBe("User rejected the request.");
  });
});
