import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type QuestionRubric, QuestionRubricSchema } from "../schemas/rubric.js";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUBRICS_DIR = path.resolve(__dirname, "../rubrics");

// In-memory store for all loaded rubrics
const rubrics: Map<string, QuestionRubric> = new Map();

/**
 * Reads all JSON files in a given directory, parses them,
 * validates against the schema, and stores them.
 */
function loadRubricsFromDir(domain: "sql" | "python", dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    console.warn(`Directory not found: ${dirPath}. Skipping.`);
    return;
  }

  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    try {
      const rawContent = fs.readFileSync(fullPath, "utf-8");
      const json = JSON.parse(rawContent);

      const parsed = QuestionRubricSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error(`Validation failed for rubric ${file}:\n${parsed.error.message}`);
      }

      if (parsed.data.domain !== domain) {
        throw new Error(
          `Domain mismatch in ${file}. Expected ${domain}, got ${parsed.data.domain}`,
        );
      }

      if (rubrics.has(parsed.data.questionId)) {
        throw new Error(`Duplicate questionId found: ${parsed.data.questionId}`);
      }

      rubrics.set(parsed.data.questionId, parsed.data);
    } catch (error) {
      console.error(`❌ Failed to load rubric file at boot: ${fullPath}`);
      // Fail fast as per requirements
      throw error;
    }
  }
}

// Load rubrics at boot
loadRubricsFromDir("sql", path.join(RUBRICS_DIR, "sql"));
loadRubricsFromDir("python", path.join(RUBRICS_DIR, "python"));

/**
 * Retrieve a rubric by question ID.
 */
export function getRubric(questionId: string): QuestionRubric | undefined {
  return rubrics.get(questionId);
}

/**
 * List all loaded rubrics, optionally filtered by domain.
 */
export function listRubrics(domain?: "sql" | "python"): QuestionRubric[] {
  const allRubrics = Array.from(rubrics.values());
  if (domain) {
    return allRubrics.filter((r) => r.domain === domain);
  }
  return allRubrics;
}
