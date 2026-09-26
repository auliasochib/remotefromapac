/**
 * Skill extraction and resume-to-job matching.
 *
 * The matching runs entirely on structured data (no AI call), so it works with
 * zero configuration. When an AI key is configured, the review and cover
 * letter endpoints upgrade to generated output — see lib/ai.ts.
 */

/** Canonical skill names mapped to regex fragments that match variants. */
const SKILL_DICTIONARY: { name: string; pattern: string }[] = [
  // Frontend
  { name: "React", pattern: "react(?:\\.js)?|reactjs" },
  { name: "Next.js", pattern: "next\\.?js|nextjs" },
  { name: "Vue.js", pattern: "vue(?:\\.js)?|vuejs|nuxt" },
  { name: "Angular", pattern: "angular(?:js)?" },
  { name: "TypeScript", pattern: "typescript|ts\\b" },
  { name: "JavaScript", pattern: "javascript|js\\b|es6" },
  { name: "HTML/CSS", pattern: "\\bhtml5?\\b|\\bcss3?\\b|sass|scss|tailwind" },
  { name: "Redux", pattern: "redux|zustand|mobx" },
  { name: "Svelte", pattern: "svelte" },

  // Backend
  { name: "Node.js", pattern: "node(?:\\.js)?|nodejs" },
  { name: "Python", pattern: "python|django|flask|fastapi" },
  { name: "Java", pattern: "\\bjava\\b|spring boot|springboot" },
  { name: "Go", pattern: "\\bgolang\\b|\\bgo lang\\b" },
  { name: "Rust", pattern: "\\brust\\b|tokio" },
  { name: "PHP", pattern: "\\bphp\\b|laravel|symfony" },
  { name: "Ruby", pattern: "\\bruby\\b|rails|sinatra" },
  { name: "C#", pattern: "c#|\\.net|dotnet|asp\\.net" },
  { name: "C++", pattern: "c\\+\\+" },
  { name: "GraphQL", pattern: "graphql|apollo" },
  { name: "REST API", pattern: "rest(?:ful)?(?: api)?|\\bapi(?: s)?\\b" },
  { name: "Microservices", pattern: "microservices?|service mesh" },
  { name: "WebSockets", pattern: "websocket|socket\\.io|real[- ]time" },

  // Data & AI
  { name: "SQL", pattern: "\\bsql\\b|mysql|postgres|postgresql|sqlite" },
  { name: "NoSQL", pattern: "mongodb|dynamodb|cassandra|redis|nosql" },
  { name: "Machine Learning", pattern: "machine learning|\\bml\\b|scikit|sklearn|xgboost" },
  { name: "Deep Learning", pattern: "deep learning|neural network|pytorch|tensorflow|keras" },
  { name: "LLM / GenAI", pattern: "\\bllm\\b|large language|openai|gemini|gpt|rag\\b| LangChain|langchain" },
  { name: "Data Engineering", pattern: "etl|airflow|dbt|spark|kafka|snowflake|bigquery" },
  { name: "Data Analysis", pattern: "data analysis|pandas|numpy|tableau|power bi|looker" },

  // DevOps & Cloud
  { name: "AWS", pattern: "\\baws\\b|amazon web services|\\bec2\\b|\\bs3\\b|lambda" },
  { name: "GCP", pattern: "\\bgcp\\b|google cloud" },
  { name: "Azure", pattern: "\\bazure\\b" },
  { name: "Docker", pattern: "docker|containeri[sz]ation" },
  { name: "Kubernetes", pattern: "kubernetes|\\bk8s\\b|\\beks\\b|\\bgke\\b" },
  { name: "CI/CD", pattern: "ci/cd|continuous integration|github actions|gitlab ci|jenkins|circleci" },
  { name: "Terraform", pattern: "terraform|\\biaa?c\\b|infrastructure as code|pulumi" },
  { name: "Linux", pattern: "\\blinux\\b|\\bbash\\b|\\bshell scripting\\b" },
  { name: "Monitoring", pattern: "prometheus|grafana|datadog|observability|\\botel\\b" },

  // Mobile
  { name: "React Native", pattern: "react native" },
  { name: "Flutter", pattern: "flutter|\\bdart\\b" },
  { name: "iOS", pattern: "\\bios\\b|swift(?:ui)?|xcode" },
  { name: "Android", pattern: "android|\\bjvm\\b|kotlin" },

  // Product, design & ways of working
  { name: "Agile / Scrum", pattern: "agile|scrum|kanban|sprint" },
  { name: "Product Management", pattern: "product management|product owner|roadmap|prd" },
  { name: "UI/UX Design", pattern: "\\bux\\b|\\bui\\b|figma|user experience|wireframe|prototype" },
  { name: "Testing / QA", pattern: "\\bqa\\b|jest|cypress|playwright|unit test|e2e|automated testing" },
  { name: "Technical Writing", pattern: "technical writing|documentation" },
  { name: "SEO", pattern: "\\bseo\\b|search engine optimi" },
  { name: "Digital Marketing", pattern: "digital marketing|google ads|meta ads|campaign" },
  { name: "Content", pattern: "content (writing|strategy|creation)|copywriting" },

  // Soft / business
  { name: "Remote Collaboration", pattern: "remote (work|team|collaborat)|async(hronous)?|distributed team" },
  { name: "Leadership", pattern: "led|mentored|managed a team|team lead|tech lead" },
  { name: "Communication", pattern: "stakeholder|cross[- ]functional|communication" },
  { name: "Customer Focus", pattern: "customer (success|support|experience)|client facing" },
];

const COMPILED = SKILL_DICTIONARY.map((entry) => ({
  name: entry.name,
  regex: new RegExp(`(^|[^a-z0-9+#])${entry.pattern}($|[^a-z0-9+#])`, "iu"),
}));

const YEARS_RE = /(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b(?![^.]{0,40}\bold\b)/gi;

/** Detect years of professional experience from common resume phrasings. */
export function extractYearsExperience(text: string): number | null {
  const matches = [...text.matchAll(YEARS_RE)].map((m) => Number(m[1]));
  const plausible = matches.filter((n) => n >= 1 && n <= 40);
  if (plausible.length === 0) return null;
  // Phrases like "8+ years" and "5 years of experience" both appear; take the
  // highest claim rather than the first or the average.
  return Math.max(...plausible);
}

/** Canonical skills found in free text (resume, job description, title). */
export function extractSkills(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const entry of COMPILED) {
    if (entry.regex.test(text)) found.push(entry.name);
  }
  return found;
}

/** Expected level for a given number of years of experience. */
export function levelForYears(years: number | null): "junior" | "mid" | "senior" | "lead" {
  if (years === null) return "mid";
  if (years < 2) return "junior";
  if (years < 5) return "mid";
  if (years < 9) return "senior";
  return "lead";
}

const LEVEL_ORDER = { junior: 0, mid: 1, senior: 2, lead: 3 } as const;

export interface JobMatch {
  score: number;
  /** Resume skills the job explicitly looks for. */
  strengths: string[];
  /** Job skills missing from the resume. */
  missing: string[];
}

/**
 * Score how well a resume fits a job.
 *
 * `jobText` should be title + tags + category + plain description; the skill
 * dictionary turns it into the job's requirement set. Scoring: skill coverage
 * dominates, with a seniority-alignment adjustment.
 */
export function scoreJobMatch(
  jobText: string,
  jobLevel: string,
  resumeSkills: string[],
  resumeYears: number | null
): JobMatch {
  const jobSkills = new Set(extractSkills(jobText));

  const resumeSet = new Set(resumeSkills);
  const strengths = resumeSkills.filter((skill) => jobSkills.has(skill));
  const missing = [...jobSkills]
    .filter((skill) => !resumeSet.has(skill))
    // Requirements named in a title ("Senior React Engineer") matter most.
    .sort((a, b) => Number(b === "Other") - Number(a === "Other"))
    .slice(0, 4);

  // Cover the top requirement skills; beyond ~8 skills the marginal ones
  // should not drag the score down.
  const target = Math.min(jobSkills.size, 8) || 1;
  const coverage = Math.min(strengths.length, target) / target;

  const resumeLevel = levelForYears(resumeYears);
  const gap = Math.abs(LEVEL_ORDER[resumeLevel] - (LEVEL_ORDER[jobLevel as keyof typeof LEVEL_ORDER] ?? 1));
  const seniority = gap === 0 ? 1 : gap === 1 ? 0.75 : 0.45;

  const score = Math.max(
    5,
    Math.min(99, Math.round(coverage * 85 + seniority * 14))
  );

  return { score, strengths: strengths.slice(0, 6), missing };
}

export const SKILL_COUNT = SKILL_DICTIONARY.length;
