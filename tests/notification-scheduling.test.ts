import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/types";

const mocks = vi.hoisted(() => ({
  native: true,
  meals: [] as Meal[],
  failLookup: false,
  pending: [] as { id: number; title?: string }[],
  schedule: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mocks.native },
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    getPending: async () => ({ notifications: mocks.pending }),
    schedule: mocks.schedule,
    cancel: mocks.cancel,
  },
}));
vi.mock("@/db/app-db", () => ({
  db: {
    meals: {
      where: (index: string) => ({
        equals: (value: string | string[]) => ({
          first: async () => {
            if (mocks.failLookup) throw new Error("Database unavailable");
            const fields = index.startsWith("[") ? index.slice(1, -1).split("+") : [index];
            const values = Array.isArray(value) ? value : [value];
            return mocks.meals.find((meal) => fields.every((field, i) => meal[field as keyof Meal] === values[i]));
          },
          filter: (predicate: (meal: Meal) => boolean) => ({
            toArray: async () => mocks.meals.filter((meal) => meal.schoolCode === value && predicate(meal)),
          }),
        }),
      }),
      toArray: async () => mocks.meals,
    },
    reviews: { where: () => ({ equals: () => ({ last: async () => undefined }) }) },
  },
}));

import { scheduleDailyMealNotification, scheduleKeywordMealNotifications } from "@/services/notifications";

const context = { schoolCode: "school-a", mealKind: "lunch" as const };
function meal(date: string, overrides: Partial<Meal> = {}): Meal {
  return {
    id: `school-a-${date}-lunch`, officeCode: "B10", schoolCode: "school-a",
    schoolName: "테스트학교", date, kind: "lunch", kindName: "중식",
    menu: ["쌀밥", "돈까스"], rawMenu: "쌀밥\n돈까스", updatedAt: 0,
    ...overrides,
  };
}
function scheduled() {
  return mocks.schedule.mock.calls.flatMap(([options]) => options.notifications);
}

describe("daily meal notification eligibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 7, 6));
    vi.clearAllMocks();
    mocks.native = true;
    mocks.meals = [];
    mocks.pending = [];
    mocks.failLookup = false;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not reserve notifications when no meals exist", async () => {
    await scheduleDailyMealNotification("07:30", undefined, undefined, context);
    expect(scheduled()).toEqual([]);
  });

  it("uses only the exact date instead of copying a nearby meal into days without meals", async () => {
    mocks.meals = [meal("20261008")];
    await scheduleDailyMealNotification("07:30", undefined, undefined, context);
    expect(scheduled().map((n) => n.id)).toEqual([20261008]);
  });

  it.each([{ menu: [] }, { menu: ["", "   "] }])("does not reserve empty menus: %j", async ({ menu }) => {
    mocks.meals = [meal("20261007", { menu })];
    await scheduleDailyMealNotification("07:30", mocks.meals[0], undefined, context);
    expect(scheduled()).toEqual([]);
  });

  it("ignores stale supplied meals and selects the current date's meal", async () => {
    mocks.meals = [meal("20261007", { menu: ["오늘의 메뉴"] })];
    await scheduleDailyMealNotification("07:30", meal("20261006"), undefined, context);
    expect(scheduled()).toHaveLength(1);
    expect(scheduled()[0].body).toBe("오늘의 메뉴");
  });

  it("does not use another school's meal or another meal kind", async () => {
    mocks.meals = [meal("20261007", { schoolCode: "school-b" }), meal("20261007", { kind: "dinner" })];
    await scheduleDailyMealNotification("07:30", mocks.meals[0], undefined, context);
    expect(scheduled()).toEqual([]);
  });

  it("does not reserve meals on holidays or weekends, but keeps a regular school day", async () => {
    mocks.meals = [meal("20261009"), meal("20261010"), meal("20261011"), meal("20261012")];
    await scheduleDailyMealNotification("07:30", undefined, undefined, context);
    expect(scheduled().map((n) => n.id)).toEqual([20261012]);
  });

  it("removes existing reservations even when every upcoming day has no meal", async () => {
    mocks.pending = [{ id: 20261007 }, { id: 1001 }];
    await scheduleDailyMealNotification("07:30", undefined, undefined, context);
    expect(mocks.cancel).toHaveBeenCalledWith({ notifications: mocks.pending });
    expect(scheduled()).toEqual([]);
  });

  it("skips elapsed times and still reserves a future school day", async () => {
    vi.setSystemTime(new Date(2026, 9, 7, 8));
    mocks.meals = [meal("20261007"), meal("20261008")];
    await scheduleDailyMealNotification("07:30", undefined, undefined, context);
    expect(scheduled().map((n) => n.id)).toEqual([20261008]);
  });

  it("does not invent meals when cache lookup fails", async () => {
    mocks.failLookup = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await scheduleDailyMealNotification("07:30", undefined, undefined, context);
    expect(scheduled()).toEqual([]);
    vi.restoreAllMocks();
  });

  it("does not schedule meals without a selected school", async () => {
    mocks.meals = [meal("20261007")];
    await scheduleDailyMealNotification("07:30");
    expect(scheduled()).toEqual([]);
  });

  it.each(["missing", "empty", "stale", "holiday", "weekend"])("suppresses automatic web notifications for %s meals", async (scenario) => {
    mocks.native = false;
    const Notification = vi.fn();
    Object.assign(Notification, { permission: "granted" });
    vi.stubGlobal("window", { Notification });
    vi.stubGlobal("Notification", Notification);
    vi.stubGlobal("navigator", { serviceWorker: {} });
    if (scenario === "holiday") vi.setSystemTime(new Date(2026, 9, 9, 6));
    if (scenario === "weekend") vi.setSystemTime(new Date(2026, 9, 10, 6));
    const supplied = scenario === "missing" ? undefined : meal(
      scenario === "holiday" ? "20261009" : scenario === "weekend" ? "20261010" : scenario === "stale" ? "20261006" : "20261007",
      scenario === "empty" ? { menu: [] } : {},
    );
    await scheduleDailyMealNotification("07:30", supplied, undefined, context);
    expect(Notification).not.toHaveBeenCalled();
  });

  it("still sends an automatic web notification for today's valid meal", async () => {
    mocks.native = false;
    const Notification = vi.fn();
    Object.assign(Notification, { permission: "granted" });
    vi.stubGlobal("window", { Notification });
    vi.stubGlobal("Notification", Notification);
    vi.stubGlobal("navigator", { serviceWorker: {} });
    await scheduleDailyMealNotification("07:30", meal("20261007"), undefined, context);
    expect(Notification).toHaveBeenCalledWith("오늘의 중식", expect.objectContaining({ body: "쌀밥, 돈까스" }));
  });

  it("does not send a D-1 keyword reminder on a day with no meal", async () => {
    mocks.meals = [meal("20261008")];
    await scheduleKeywordMealNotifications("07:30", ["돈까스"], "school-a");
    expect(scheduled()).toHaveLength(1);
    expect(scheduled()[0].title).toContain("[D-DAY]");
  });

  it("does not send keyword reminders on holidays or weekends", async () => {
    mocks.meals = [meal("20261009"), meal("20261010"), meal("20261011"), meal("20261012")];
    await scheduleKeywordMealNotifications("07:30", ["돈까스"], "school-a");
    expect(scheduled()).toHaveLength(1);
    expect(scheduled()[0].title).toContain("[D-DAY]");
    expect(scheduled()[0].schedule.at.getDate()).toBe(12);
  });

  it("keeps D-1 and D-DAY reminders when both are on days with meals", async () => {
    mocks.meals = [meal("20261007", { menu: ["쌀밥"] }), meal("20261008")];
    await scheduleKeywordMealNotifications("07:30", ["돈까스"], "school-a");
    expect(scheduled()).toHaveLength(2);
    expect(scheduled().map((n) => n.title)).toEqual([
      expect.stringContaining("[D-1]"), expect.stringContaining("[D-DAY]"),
    ]);
  });

  it("does not schedule keyword notifications for empty menus", async () => {
    mocks.meals = [meal("20261007", { menu: [] })];
    await scheduleKeywordMealNotifications("07:30", ["돈까스"], "school-a");
    expect(scheduled()).toEqual([]);
  });

  it("daily and keyword notifications do not overwrite one another's IDs", async () => {
    mocks.meals = [meal("20261007")];
    await scheduleDailyMealNotification("07:30", undefined, undefined, context);
    await scheduleKeywordMealNotifications("07:30", ["돈까스"], "school-a");
    const ids = scheduled().map((n) => n.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("keyword refresh cancels legacy keyword reservations without cancelling daily meals", async () => {
    mocks.pending = [
      { id: 20261008, title: "오늘의 중식" },
      { id: 10261008, title: "📢 [D-1] 내일 최애 메뉴" },
      { id: 20261012, title: "🎉 [D-DAY] 오늘 최애 메뉴" },
    ];
    await scheduleKeywordMealNotifications("07:30", ["돈까스"], "school-a");
    expect(mocks.cancel).toHaveBeenCalledWith({ notifications: [{ id: 10261008 }, { id: 20261012 }] });
  });

  it("daily refresh preserves keyword reservations", async () => {
    mocks.pending = [{ id: 20261008, title: "오늘의 중식" }, { id: 100261008, title: "📢 [D-1] 내일 최애 메뉴" }];
    await scheduleDailyMealNotification("07:30", undefined, undefined, context);
    expect(mocks.cancel).toHaveBeenCalledWith({ notifications: [{ id: 20261008 }] });
  });

  it("clears keyword reservations when the last keyword is removed", async () => {
    mocks.pending = [{ id: 100261008, title: "📢 [D-1] 내일 최애 메뉴" }];
    await scheduleKeywordMealNotifications("07:30", [], "school-a");
    expect(mocks.cancel).toHaveBeenCalledWith({ notifications: [{ id: 100261008 }] });
    expect(scheduled()).toEqual([]);
  });

  it("a newer no-meal refresh removes an older reservation even while scheduling is in flight", async () => {
    let releaseSchedule!: () => void;
    const scheduling = new Promise<void>((resolve) => { releaseSchedule = resolve; });
    mocks.schedule.mockImplementationOnce(async ({ notifications }) => {
      await scheduling;
      mocks.pending = notifications.map((n: { id: number; title: string }) => ({ id: n.id, title: n.title }));
    });
    mocks.cancel.mockImplementationOnce(async ({ notifications }) => {
      const cancelled = new Set(notifications.map((n: { id: number }) => n.id));
      mocks.pending = mocks.pending.filter((n) => !cancelled.has(n.id));
    });
    const older = scheduleDailyMealNotification("07:30", meal("20261007"), undefined, context);
    await vi.waitFor(() => expect(mocks.schedule).toHaveBeenCalledTimes(1));
    const newer = scheduleDailyMealNotification("07:30", undefined, undefined, context);
    await vi.advanceTimersByTimeAsync(10);
    releaseSchedule();
    await Promise.all([older, newer]);
    expect(mocks.pending).toEqual([]);
  });
});
