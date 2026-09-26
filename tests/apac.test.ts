import { describe, expect, it } from "vitest";
import { apacEligibility } from "../src/lib/apac";

describe("apacEligibility", () => {
  const cases: [string, ReturnType<typeof apacEligibility>][] = [
    // Worldwide / remote wording
    ["Remote", "worldwide"],
    ["Remote job", "worldwide"],
    ["Anywhere in the World", "worldwide"],
    ["Poste à distance", "worldwide"],
    ["", "worldwide"],
    // APAC locations — countries, cities and mixed strings
    ["Singapore", "apac"],
    ["Melbourne", "apac"],
    ["Seoul", "apac"],
    ["Jakarta", "apac"],
    ["Bangalore", "apac"],
    ["Remote, Bangalore", "apac"],
    ["Tokyo, Japan", "apac"],
    ["Sydney, Australia", "apac"],
    ["Auckland", "apac"],
    ["Home Based - APAC", "apac"],
    // Non-APAC restrictions
    ["Germany", "restricted"],
    ["San Francisco", "restricted"],
    ["Cincinnati", "restricted"],
    ["Remote - US only", "restricted"],
    ["USA", "restricted"],
    ["Indianapolis", "restricted"],
    ["EMEA, LATAM, Canada, USA", "restricted"],
    ["Europe, France", "restricted"],
    ["Remote - Europe", "restricted"],
    ["Grafschaft", "restricted"],
    // Word-boundary traps: substrings must not match
    ["Indiana", "restricted"],
    ["Gonzalez", "restricted"],
  ];

  it.each(cases)("classifies %j as %s", (location, expected) => {
    expect(apacEligibility(location)).toBe(expected);
  });
});
