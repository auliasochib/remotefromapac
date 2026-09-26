import { describe, expect, it } from "vitest";
import {
  extractSkills,
  extractYearsExperience,
  scoreJobMatch,
} from "../src/lib/skills";
import { normalizeTags } from "../src/lib/providers";

describe("extractSkills", () => {
  it("detects common skills with variants", () => {
    const skills = extractSkills(
      "Built apps with React, Next.js and TypeScript. Node.js backend, deployed on AWS with Docker."
    );
    expect(skills).toContain("React");
    expect(skills).toContain("Next.js");
    expect(skills).toContain("TypeScript");
    expect(skills).toContain("Node.js");
    expect(skills).toContain("AWS");
    expect(skills).toContain("Docker");
  });

  it("does not match substrings (Indiana != india)", () => {
    const skills = extractSkills("Lived in Indiana for 5 years");
    expect(skills).not.toContain("India");
  });
});

describe("extractYearsExperience", () => {
  it("takes the highest plausible claim", () => {
    expect(extractYearsExperience("2 years at X. 7+ years overall.")).toBe(7);
  });

  it("returns null when unstated", () => {
    expect(extractYearsExperience("Passionate developer.")).toBeNull();
  });

  it("ignores implausible numbers", () => {
    expect(extractYearsExperience("100 years of industry change.")).toBeNull();
  });
});

describe("scoreJobMatch", () => {
  const resumeSkills = ["React", "Next.js", "TypeScript", "Node.js"];

  it("scores a fully covered job above a zero-match job", () => {
    const covered = scoreJobMatch(
      "Senior Frontend Engineer. React, Next.js, TypeScript required.",
      "senior",
      resumeSkills,
      5
    );
    const zero = scoreJobMatch(
      "Accountant. Excel, payroll.",
      "senior",
      resumeSkills,
      5
    );
    expect(covered.score).toBeGreaterThanOrEqual(70);
    expect(covered.score).toBeGreaterThan(zero.score);
    expect(covered.strengths).toContain("React");
    expect(covered.missing).toHaveLength(0);
  });

  it("does not invent a JavaScript requirement from Next.js", () => {
    const skills = extractSkills("Frontend Engineer. React, Next.js, TypeScript.");
    expect(skills).toContain("Next.js");
    expect(skills).not.toContain("JavaScript");
  });

  it("caps the score on thin evidence", () => {
    // Only one requirement detected → perfect coverage alone must not
    // produce a near-perfect score.
    const match = scoreJobMatch("Engineer. React required.", "mid", resumeSkills, 5);
    expect(match.score).toBeLessThan(60);
  });

  it("penalises seniority mismatch", () => {
    const full = "Frontend Engineer. React, Next.js, TypeScript.";
    // Same job: a junior resume (1y) fits worse than a mid resume (3y).
    const juniorResume = scoreJobMatch(full, "mid", resumeSkills, 1);
    const alignedResume = scoreJobMatch(full, "mid", resumeSkills, 3);
    expect(juniorResume.score).toBeLessThan(alignedResume.score);
  });

  it("lists missing requirements", () => {
    const match = scoreJobMatch(
      "Backend Engineer. AWS, Docker, Kubernetes required.",
      "mid",
      resumeSkills,
      4
    );
    expect(match.strengths).toHaveLength(0);
    expect(match.missing).toContain("AWS");
    expect(match.missing).toContain("Docker");
  });
});

describe("normalizeTags", () => {
  it("trims, dedupes case-insensitively and drops empties", () => {
    expect(
      normalizeTags([" React ", "react", "TypeScript", "", null, "React"])
    ).toEqual(["React", "TypeScript"]);
  });

  it("caps the number of tags", () => {
    const many = Array.from({ length: 30 }, (_, i) => `skill-${i}`);
    expect(normalizeTags(many)).toHaveLength(12);
  });

  it("accepts arrays containing undefined entries", () => {
    expect(normalizeTags(["A", undefined], [null, "B"])).toEqual(["A", "B"]);
  });
});
