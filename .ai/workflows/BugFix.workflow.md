# Bug Fix Workflow

## Purpose

Controlled process for fixing problems in HooshyarOS.


## Pipeline

Bug Report
↓
Analysis
↓
Architecture Check
↓
Fix Implementation
↓
Testing
↓
Review
↓
Commit


## Step 1

Identify:

- Error message
- Affected module
- Reproduction steps


## Step 2

Analyze:

Owner:
ReviewerAgent

Questions:

- Is this a code issue?
- Is this architecture issue?
- Is this dependency issue?


## Step 3

Fix

Owner:
DeveloperAgent


Rules:

- Minimum change.
- No unnecessary refactor.
- Add regression test.


## Step 4

Test

Owner:
TesterAgent


Run:

npm test


## Step 5

Review

Owner:
ArchitectAgent + ReviewerAgent


Check:

- Fix quality.
- No new risk.


## Final

Commit:

fix(component): description


Push to GitHub.