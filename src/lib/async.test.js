import { describe, it, expect, vi } from "vitest";
import { abortError, isAbortError, sleep, TimeoutError } from "./async.js";

describe("sleep", () => {
  it("resolves after the delay and cleans up its abort listener", async () => {
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, "addEventListener");
    const remove = vi.spyOn(controller.signal, "removeEventListener");

    await sleep(1, controller.signal);

    expect(add).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleep(10, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects when aborted while sleeping", async () => {
    const controller = new AbortController();
    const promise = sleep(1000, controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("abort helpers", () => {
  it("creates and identifies abort errors", () => {
    const error = abortError();
    expect(error.name).toBe("AbortError");
    expect(isAbortError(error)).toBe(true);
    expect(isAbortError(new Error("nope"))).toBe(false);
  });

  it("creates a named TimeoutError", () => {
    expect(new TimeoutError().name).toBe("TimeoutError");
  });
});
