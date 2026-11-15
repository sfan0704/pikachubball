import { describe, expect, it } from "vitest";
import {
  categoryParts,
  categoryTotal,
  categoryTotals,
  compareCategories,
  isPercentage,
  partsOfAll,
} from "../../../shared/domain";
import {
  buildStatTotals,
  CATEGORY,
  EIGHT_CATEGORIES,
  STAT,
  TEN_CATEGORIES,
} from "../../support/builders";

describe("categoryParts", () => {
  it("names the stats each kind of category is built from", () => {
    expect(categoryParts(CATEGORY.pts)).toEqual([STAT.pts]);
    expect(categoryParts(CATEGORY.fgPct)).toEqual([STAT.fgm, STAT.fga]);
    expect(categoryParts(CATEGORY.astTo)).toEqual([STAT.ast, STAT.to]);
    expect(categoryParts(CATEGORY.mpg)).toEqual([]);
  });

  it("lists each stat once across a league's categories", () => {
    expect(partsOfAll(EIGHT_CATEGORIES)).toEqual([
      "4",
      "3",
      "10",
      "12",
      "15",
      "16",
      "17",
      "18",
      "19",
    ]);
  });
});

describe("categoryTotal", () => {
  const totals = buildStatTotals({ ast: 130, to: 65, tpm: 40, tpa: 100 });

  it("sums counts and divides a ratio's summed parts", () => {
    expect(categoryTotal(totals, CATEGORY.pf)).toBe(90);
    expect(categoryTotal(totals, CATEGORY.astTo)).toBe(2);
    expect(categoryTotal(totals, CATEGORY.tpPct)).toBe(0.4);
  });

  it("is unknown for a part that is unknown or absent, nothing below a ratio, or a category the app can't build", () => {
    expect(categoryTotal(buildStatTotals({ pf: null }), CATEGORY.pf)).toBeNull();
    expect(categoryTotal({ [STAT.ast]: 5 }, CATEGORY.astTo)).toBeNull();
    expect(categoryTotal(buildStatTotals({ to: 0 }), CATEGORY.astTo)).toBeNull();
    expect(categoryTotal(totals, CATEGORY.mpg)).toBeNull();
  });

  it("gives every category of a league its value, so an unbuildable one never wins or loses", () => {
    const categories = [...TEN_CATEGORIES, CATEGORY.mpg];
    const mine = categoryTotals(buildStatTotals({ pts: 600 }), categories);
    const theirs = categoryTotals(buildStatTotals(), categories);
    expect(Object.keys(mine)).toHaveLength(11);
    const { categories: compared, score } = compareCategories(categories, mine, theirs);
    expect(compared.find((c) => c.category === CATEGORY.mpg)?.result).toBe("unavailable");
    expect(score).toMatchObject({ wins: 1, ties: 9, unavailable: 1, complete: false });
  });
});

describe("isPercentage", () => {
  it("is true for makes-over-attempts ratios only", () => {
    expect(isPercentage(CATEGORY.fgPct)).toBe(true);
    expect(isPercentage(CATEGORY.tpPct)).toBe(true);
    expect(isPercentage(CATEGORY.astTo)).toBe(false);
    expect(isPercentage(CATEGORY.pts)).toBe(false);
  });
});
