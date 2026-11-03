import assert from "node:assert/strict";
import test from "node:test";
import { filterJobs } from "../src/jobSearch.js";

const sampleJobs = [
  { title: "Remote Math Tutor", company: "Bright Path", category: "Tutoring", location: "Remote", remote: true, type: "Flexible" },
  { title: "Retail Assistant", company: "Northside", category: "Retail", location: "Queens, NY", remote: false, type: "Part-time" },
  { title: "Cafe Team Member", company: "Corner Cafe", category: "Food Service", location: "Brooklyn, NY", remote: false, type: "Part-time" },
];

function filters(overrides = {}) {
  return {
    search: "",
    locationSearch: "",
    categoryFilter: "All Categories",
    scheduleFilter: "Any schedule",
    quickFilter: "All Jobs",
    ...overrides,
  };
}

test("returns all jobs with default filters", () => {
  assert.deepEqual(filterJobs(sampleJobs, filters()), sampleJobs);
});

test("searches title, employer, and category case-insensitively", () => {
  assert.deepEqual(filterJobs(sampleJobs, filters({ search: "  BRIGHT  " })), [sampleJobs[0]]);
  assert.deepEqual(filterJobs(sampleJobs, filters({ search: "cafe" })), [sampleJobs[2]]);
});

test("matches remote and city location searches", () => {
  assert.deepEqual(filterJobs(sampleJobs, filters({ locationSearch: "REMOTE" })), [sampleJobs[0]]);
  assert.deepEqual(filterJobs(sampleJobs, filters({ locationSearch: "queens" })), [sampleJobs[1]]);
});

test("combines category, schedule, and quick filters", () => {
  assert.deepEqual(filterJobs(sampleJobs, filters({ categoryFilter: "Retail" })), [sampleJobs[1]]);
  assert.deepEqual(filterJobs(sampleJobs, filters({ scheduleFilter: "Remote only" })), [sampleJobs[0]]);
  assert.deepEqual(filterJobs(sampleJobs, filters({ quickFilter: "Remote Jobs" })), [sampleJobs[0]]);
  assert.deepEqual(filterJobs(sampleJobs, filters({ quickFilter: "Food Service", search: "tutor" })), []);
});
