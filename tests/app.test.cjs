const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const root = join(__dirname, "..");
const source = readFileSync(join(root, "app.js"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function createContext({ dark = false, saved = null, blocked = false } = {}) {
  const elements = new Map();
  const document = {
    documentElement: { dataset: {} },
    querySelector(selector) {
      if (!elements.has(selector)) {
        elements.set(selector, {
          style: {},
          setAttribute() {},
          addEventListener() {},
          replaceChildren() {},
        });
      }
      return elements.get(selector);
    },
    addEventListener() {},
  };
  const context = vm.createContext({
    document,
    window: {
      matchMedia: () => ({ matches: dark, addEventListener() {} }),
      addEventListener() {},
    },
    localStorage: {
      getItem(key) {
        if (blocked) throw new Error("Storage blocked");
        return key === "day-by-day.theme.v1" ? saved : null;
      },
    },
    console: { error() {} },
    setInterval() {},
  });
  vm.runInContext(bootstrap, context);
  vm.runInContext(source, context);
  return context;
}

test("local calendar dates, weekly ranges, and streak boundaries", () => {
  const previousZone = process.env.TZ;
  try {
    for (const zone of [
      "America/New_York", "Europe/Berlin", "Asia/Kolkata", "Pacific/Auckland",
    ]) {
      process.env.TZ = zone;
      const context = createContext();
      assert.equal(vm.runInContext("localDateKey(new Date(2026, 0, 3, 0, 1))", context), "2026-01-03");
      assert.equal(vm.runInContext("localDateKey(new Date(2026, 0, 3, 23, 59))", context), "2026-01-03");
      for (const [parts, expected] of [
        [[2026, 0, 3], ["2025-12-28", "2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03"]],
        [[2024, 2, 2], ["2024-02-25", "2024-02-26", "2024-02-27", "2024-02-28", "2024-02-29", "2024-03-01", "2024-03-02"]],
        [[2026, 2, 10], ["2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"]],
        [[2026, 10, 3], ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]],
      ]) {
        context.parts = parts;
        const actual = vm.runInContext("lastSevenDays(new Date(...parts)).map(localDateKey)", context);
        assert.deepEqual(Array.from(actual), expected, zone);
        context.completions = expected;
        assert.equal(vm.runInContext("currentStreak(completions, new Date(...parts))", context), 7, zone);
        context.completions = [expected[0], expected[6]];
        assert.equal(vm.runInContext("currentStreak(completions, new Date(...parts))", context), 1, zone);
        context.completions = expected.slice(0, -1);
        assert.equal(vm.runInContext("currentStreak(completions, new Date(...parts))", context), 0, zone);
      }
      assert.equal(vm.runInContext("isValidDateKey('2024-02-29')", context), true);
      assert.equal(vm.runInContext("isValidDateKey('2026-02-29')", context), false);
    }
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});

test("theme initialization respects system, explicit choices, and storage errors", () => {
  for (const dark of [false, true]) {
    for (const saved of [null, "light", "dark", "invalid"]) {
      for (const blocked of [false, true]) {
        const context = createContext({ dark, saved, blocked });
        const invalid = blocked || saved === "invalid";
        const expected = invalid || saved === null ? (dark ? "dark" : "light") : saved;
        assert.equal(context.document.documentElement.dataset.theme, expected);
        assert.equal(Boolean(context.window.habitTheme.error), invalid);
        assert.equal(context.document.querySelector('meta[name="theme-color"]').content,
          expected === "dark" ? "#18211c" : "#f5f6f0");
      }
    }
  }
});
