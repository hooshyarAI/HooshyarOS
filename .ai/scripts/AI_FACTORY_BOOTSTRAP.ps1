
Write-Host "Starting HooshyarOS AI Factory v0.2"


$folders = @(

".ai/agents",
".ai/workflows",
".ai/context",
".ai/tasks",
".ai/scripts",
".ai/reports",
".ai/templates",
".ai/outputs/architecture-plans"

)


foreach($folder in $folders){

New-Item -ItemType Directory -Force -Path $folder | Out-Null

}



$files = @{


".ai/context/AI_FACTORY_RULES.md" = @"

# HooshyarOS AI Factory Rules


Architecture First

Every Capability:

1. Design
2. Implementation
3. Test
4. Review
5. Commit


Development Pattern:

One Capability
One Class
One Test
One Commit

"@



".ai/tasks/CURRENT_TASK.md" = @"

# Current Task


Name:


Status:
PLANNING


Architecture:
Pending


Development:
Pending


Testing:
Pending


Review:
Pending

"@



".ai/workflows/Feature.workflow.md" = @"

# Feature Development Workflow


Requirement

â†“

Architecture

â†“

Code

â†“

Test

â†“

Review

â†“

Commit


"@



".ai/workflows/Release.workflow.md" = @"

# Release Workflow


Test

Validation

Documentation

Version

Release


"@



".ai/agents/ArchitectAgent.md" = @"

# Architect Agent


Role:

System Architecture.


Tasks:

- Design modules
- Check dependencies
- Detect risks

"@



".ai/agents/DeveloperAgent.md" = @"

# Developer Agent


Role:

Implementation.


Tasks:

- Write TypeScript
- Follow templates
- Create tests

"@



".ai/agents/TesterAgent.md" = @"

# Tester Agent


Role:

Quality Control.


Tasks:

- Run Jest
- Validate behavior

"@



".ai/agents/ReviewerAgent.md" = @"

# Reviewer Agent


Role:

Code Review.


Tasks:

- Find issues
- Protect architecture

"@



".ai/scripts/create-engine.ps1" = @"

param(
[string]`$EngineName
)


Write-Host "Creating Engine: `$EngineName"


"@



".ai/reports/DailyReport.md" = @"

# HooshyarOS Daily Report


Progress:


Tests:


Issues:


Next Actions:

"@


}



foreach($file in $files.Keys){

Set-Content `
-Path $file `
-Value $files[$file] `
-Encoding utf8

}



Write-Host ""
Write-Host "================================"
Write-Host " HooshyarOS AI Factory READY "
Write-Host "================================"

