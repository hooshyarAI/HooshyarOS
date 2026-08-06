Write-Host "Initializing HooshyarOS AI Factory..."

$folders = @(
".ai/agents",
".ai/workflows",
".ai/context",
".ai/scripts",
".ai/outputs/architecture-plans"
)

foreach($folder in $folders){
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
}


$files = @{
".ai/context/PROJECT_CONTEXT.md" =
"# HooshyarOS Project Context

AI Operating System Platform.

Goal:
Build intelligent financial and management decision systems.

Development Rule:
One capability.
One class.
One test.
One commit."


".ai/context/ARCHITECTURE_CONTEXT.md" =
"# Architecture Context

Architecture Freeze V4.

Core Engines:

1 Reasoning Engine
2 Governance Engine
3 Executive Intelligence Engine
4 Organizational Intelligence Engine
5 Autonomous Operations Engine


Foundation:
HBOS Core."


".ai/context/DEVELOPMENT_STATE.md" =
"# Development State

HBOS Core:
READY

AI Factory:
BOOTSTRAPPING


Status:
Active Development."


".ai/context/AI_MEMORY.md" =
"# AI Memory Rules

Always respect architecture.

Never break existing tests.

Every capability requires:
Design
Implementation
Test
Review
Commit."


".ai/agents/ArchitectAgent.md" =
"# Architect Agent

Responsibilities:

Architecture design.
Dependency analysis.
Risk detection."


".ai/agents/DeveloperAgent.md" =
"# Developer Agent

Responsibilities:

Implement features.
Follow templates.
Write clean TypeScript."


".ai/agents/TesterAgent.md" =
"# Tester Agent

Responsibilities:

Create Jest tests.
Validate behavior."


".ai/agents/ReviewerAgent.md" =
"# Reviewer Agent

Responsibilities:

Review code quality.
Check architecture compliance."


".ai/agents/ProjectManagerAgent.md" =
"# Project Manager Agent

Responsibilities:

Track progress.
Manage workflow."


".ai/workflows/FeatureDevelopment.workflow.md" =
"# Feature Development

Requirement
Architecture
Implementation
Test
Review
Commit"


".ai/workflows/BugFix.workflow.md" =
"# Bug Fix

Detect
Analyze
Fix
Test
Commit"


".ai/workflows/DailyReport.workflow.md" =
"# Daily Report

Progress
Tests
Risks
Next Actions"


".ai/outputs/architecture-plans/README.md" =
"# Architecture Plans"
}


foreach($file in $files.Keys){

Set-Content `
-Path $file `
-Value $files[$file] `
-Encoding utf8

}


Write-Host "HooshyarOS AI Factory Ready"
