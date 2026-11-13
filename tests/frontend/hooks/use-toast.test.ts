/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reducer } from "../../../client/src/hooks/use-toast";

const TOAST_REMOVE_DELAY = 1_000_000;

/** Loads a fresh copy of the toast module so each test starts with empty toast state. */
async function loadToastModule() {
  vi.resetModules();
  return import("../../../client/src/hooks/use-toast");
}

describe("reducer", () => {
  it("adds a toast to an empty state", () => {
    const next = reducer({ toasts: [] }, { type: "ADD_TOAST", toast: { id: "1", title: "Hi" } });

    expect(next.toasts).toHaveLength(1);
    expect(next.toasts.map((toast) => toast.id)).toEqual(["1"]);
  });

  it("keeps only the newest toast", () => {
    const next = reducer(
      { toasts: [{ id: "1", title: "First" }] },
      { type: "ADD_TOAST", toast: { id: "2", title: "Second" } }
    );

    expect(next.toasts.map((toast) => toast.id)).toEqual(["2"]);
  });

  it("updates the matching toast and leaves the others alone", () => {
    const next = reducer(
      {
        toasts: [
          { id: "1", title: "First" },
          { id: "2", title: "Second" },
        ],
      },
      { type: "UPDATE_TOAST", toast: { id: "2", title: "Updated" } }
    );

    expect(next.toasts).toEqual([
      { id: "1", title: "First" },
      { id: "2", title: "Updated" },
    ]);
  });

  it("leaves the state alone when the updated toast is missing", () => {
    const state = { toasts: [{ id: "1", title: "First" }] };

    const next = reducer(state, { type: "UPDATE_TOAST", toast: { id: "9", title: "Nope" } });

    expect(next.toasts).toEqual(state.toasts);
  });

  it("dismisses only the named toast", () => {
    const next = reducer(
      {
        toasts: [
          { id: "1", open: true },
          { id: "2", open: true },
        ],
      },
      { type: "DISMISS_TOAST", toastId: "1" }
    );

    expect(next.toasts.map((toast) => toast.open)).toEqual([false, true]);
  });

  it("dismisses every toast when no id is given", () => {
    const next = reducer(
      {
        toasts: [
          { id: "1", open: true },
          { id: "2", open: true },
        ],
      },
      { type: "DISMISS_TOAST" }
    );

    expect(next.toasts.map((toast) => toast.open)).toEqual([false, false]);
  });

  it("removes only the named toast", () => {
    const next = reducer(
      { toasts: [{ id: "1" }, { id: "2" }] },
      { type: "REMOVE_TOAST", toastId: "1" }
    );

    expect(next.toasts.map((toast) => toast.id)).toEqual(["2"]);
  });

  it("removes every toast when no id is given", () => {
    const next = reducer({ toasts: [{ id: "1" }, { id: "2" }] }, { type: "REMOVE_TOAST" });

    expect(next.toasts).toEqual([]);
  });
});

describe("toast and useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a toast with a generated id and open state", async () => {
    const { toast, useToast } = await loadToastModule();
    const { result } = renderHook(() => useToast());

    let createdId = "";
    act(() => {
      createdId = toast({ title: "Hello" }).id;
    });

    expect(createdId).toBe("1");
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({ id: "1", title: "Hello", open: true });
  });

  it("keeps only the newest toast", async () => {
    const { toast, useToast } = await loadToastModule();
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: "First" });
      toast({ title: "Second" });
    });

    expect(result.current.toasts.map((toast) => toast.title)).toEqual(["Second"]);
  });

  it("updates a toast through its update handle", async () => {
    const { toast, useToast } = await loadToastModule();
    const { result } = renderHook(() => useToast());

    let update: ReturnType<typeof toast>["update"] | undefined;
    let createdId = "";
    act(() => {
      const created = toast({ title: "Before" });
      createdId = created.id;
      update = created.update;
    });
    act(() => {
      update?.({ id: createdId, title: "After" });
    });

    expect(result.current.toasts.map((toast) => toast.title)).toEqual(["After"]);
  });

  it("dismisses a toast through its dismiss handle", async () => {
    const { toast, useToast } = await loadToastModule();
    const { result } = renderHook(() => useToast());

    let dismissToast = () => {};
    act(() => {
      dismissToast = toast({ title: "Hello" }).dismiss;
    });
    act(() => {
      dismissToast();
    });

    expect(result.current.toasts.map((toast) => toast.open)).toEqual([false]);
  });

  it("dismisses when the toast closes through onOpenChange", async () => {
    const { toast, useToast } = await loadToastModule();
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: "Hello" });
    });
    act(() => {
      result.current.toasts[0]?.onOpenChange?.(false);
    });

    expect(result.current.toasts.map((toast) => toast.open)).toEqual([false]);
  });

  it("stays open when onOpenChange reports open", async () => {
    const { toast, useToast } = await loadToastModule();
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: "Hello" });
    });
    act(() => {
      result.current.toasts[0]?.onOpenChange?.(true);
    });

    expect(result.current.toasts.map((toast) => toast.open)).toEqual([true]);
  });

  it("removes a dismissed toast once the remove delay passes", async () => {
    const { toast, useToast } = await loadToastModule();
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: "Hello" });
    });
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(TOAST_REMOVE_DELAY);
    });

    expect(result.current.toasts).toEqual([]);
  });

  it("schedules only one removal per toast", async () => {
    const { toast, useToast } = await loadToastModule();
    const { result } = renderHook(() => useToast());

    let createdId = "";
    act(() => {
      createdId = toast({ title: "Hello" }).id;
    });
    act(() => {
      result.current.dismiss(createdId);
      result.current.dismiss(createdId);
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_REMOVE_DELAY);
    });

    expect(result.current.toasts).toEqual([]);
  });

  it("keeps working after a listener unmounts", async () => {
    const { toast, useToast } = await loadToastModule();
    const first = renderHook(() => useToast());
    first.unmount();

    act(() => {
      toast({ title: "Hello" });
    });

    const second = renderHook(() => useToast());
    expect(second.result.current.toasts.map((toast) => toast.title)).toEqual(["Hello"]);
  });
});
