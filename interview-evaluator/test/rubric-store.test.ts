import assert from "node:assert/strict";
import test from "node:test";
import { getRubric, listRubrics } from "../src/rubric-store/index.js";

test("rubric-store should load and list all 8 SQL rubrics at boot", () => {
  const sqlRubrics = listRubrics("sql");
  assert.equal(sqlRubrics.length, 8, "Should have exactly 8 SQL rubrics loaded");

  const pythonRubrics = listRubrics("python");
  assert.equal(pythonRubrics.length, 0, "Should have 0 Python rubrics loaded");
});

test("rubric-store should retrieve a specific rubric by ID", () => {
  const rubric = getRubric("sql_join_001");
  assert.ok(rubric, "Rubric should exist");
  assert.equal(rubric.domain, "sql");
  assert.equal(rubric.questionId, "sql_join_001");
});
