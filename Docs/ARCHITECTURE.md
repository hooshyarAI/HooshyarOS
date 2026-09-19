# HooshyarOS Architecture Document

Version: 1.0  
Architecture: HBOS Core Architecture
Status: Architecture Freeze V4.1


# 1. Overview

HooshyarOS is an intelligent operating platform designed for financial, managerial and organizational decision intelligence.

The core of HooshyarOS is:

HBOS

(Hooshyar Brain Operating System)

HBOS provides the foundation for:

- Intelligent reasoning
- Decision support
- Organizational intelligence
- Autonomous operations
- Financial intelligence


---

# 2. Core Architecture Principle

The main architecture principle:

Every canonical product capability must have exactly one canonical owner.

Canonical intelligence capabilities are implemented as canonical Engines.
Supporting services, platform services, adapters, integrations and infrastructure components are permitted when their responsibility, ownership, interface, authority and dependency boundaries are explicit.

One Capability
=

One Canonical Owner
=

Explicit Authority
=

Explicit Contract
=

Explicit Dependency Direction
=

Testable Evidence

Canonical Intelligence Engines:
- ReasoningEngine
- GovernanceEngine
- ExecutiveIntelligenceEngine
- OrganizationalIntelligenceEngine
- AutonomousOperationsEngine

Supporting Services:
- MemoryEngine
- KnowledgeEngine
- ProjectPilotEngine
- ReactionEngine

Platform Services (NOT required to implement Engine interface):
- AssistantEngine

Reasoning Pipeline:
- IntelligenceEngine (reasoning pipeline composition; registered by `Core/HBOS.ts` and used by `AssistantEngine`). It composes reasoning strategies and is distinct from the domain calculation engines `FinancialIntelligenceEngine`, `RiskIntelligenceEngine` and `BudgetIntelligenceEngine`, which provide domain mathematics rather than pipeline composition.

Legacy/Transitional:
- DecisionEngine (canonical supporting decision capability)
- DecisionIntelligenceEngine (implemented decision-intelligence engine: AHP, TOPSIS and decision-tree owner; live consumers are `Product/DecisionWorkbench.ts` and `Product/OrchestratedDecisionIntelligenceService.ts`)

Each canonical Engine must have:


- Identity
- Lifecycle management
- Initialization process
- Health monitoring
- Test coverage
- Documentation


Architecture rule:

One Capability
=

One Canonical Owner
=

Explicit Authority
=

Explicit Contract
=

Explicit Dependency Direction
=

Testable Evidence



---

# 3. HBOS Core Architecture

                HooshyarOS


                     |

                     |

                    HBOS


                     |

    --------------------------------

    |              |               |              Manager


                     |

                     |

             Engine Ecosystem


                     |

---

# 4. Five Main Intelligence Engines


According to Architecture Freeze V4:


## 4.1 Reasoning Engine


Purpose:

Advanced reasoning and analysis.


Responsibilities:


- Problem analysis
- Logical inference
- Scenario evaluation
- Recommendation generation


Reasoning provider boundary:

- The canonical provider is a deterministic, in-process, evidence-bound reasoner implemented in TypeScript; it reasons only over verified context values and never invents thresholds, transactions or external facts.
- The repository-native Python AI Runtime (`Backend/AI_Runtime/reasoning/reasoning_engine.py`) remains an optional provider, selected only when the operator explicitly configures `HOOSHYAR_PYTHON`. An explicitly configured but unusable interpreter fails closed (`reasoning_failed`).
- The installed product therefore never depends on an external interpreter to reason.



---


## 4.2 Governance Engine


Purpose:

Control and compliance.


Responsibilities:


- Rules enforcement
- Policy checking
- Compliance monitoring
- Audit support



---


## 4.3 Executive Intelligence Engine


Purpose:

Management decision intelligence.


Responsibilities:


- Executive dashboards
- KPI analysis
- Strategic recommendations
- Performance evaluation



---


## 4.4 Organizational Intelligence Engine


Purpose:

Organization understanding.


Responsibilities:


- Process intelligence
- Employee workflow analysis
- Organizational learning
- Knowledge flow management



---


## 4.5 Autonomous Operations Engine


Purpose:

Automated execution.


Responsibilities:


- Task planning
- Workflow automation
- Agent coordination
- Autonomous actions



---

# 5. Existing HBOS Engines


## Memory Engine


Role:

Knowledge and context storage.


Functions:


- Store information
- Retrieve context
- Maintain system memory



Status:

Implemented



---


## Decision Engine


Role:

Canonical supporting decision capability.


Functions:


- Analyze options
- Calculate decisions
- Generate recommendations



Status:

Implemented



---


## Knowledge Engine


Role:

Domain knowledge management.


Functions:


- Store rules
- Manage standards
- Provide expertise



Status:

Implemented



---


## Assistant Engine


Role:

Platform / interaction service.


Functions:


- Explain decisions
- Communicate results
- Assist users



Status:

Implemented



---


## Project Pilot Engine


Role:

Project lifecycle intelligence.


Functions:


- Manage projects
- Track progress
- Monitor execution



Status:

Implemented



---


## Reaction Engine


Role:

Event response system.


Functions:


- Detect events
- Trigger actions
- Automate reactions



Status:

Implemented



---


## HealthMonitorEngine

Canonical implementation: `Engines/HealthMonitorEngine.ts` (implements `Engine`); consumed by `AutonomousOperationsEngine` for health verification.


Role:

System self-monitoring.


Functions:


- Engine health checking
- System readiness
- Failure detection
- Health reports



Status:

Implemented



---

## DecisionIntelligenceEngine

Canonical implementation: `Engines/DecisionIntelligenceEngine.ts` (implements `Engine`).

Role:

Decision-intelligence engine; owner of the decision mathematics
(AHP, TOPSIS and decision-tree expected monetary value).

Live consumers:

- `Product/DecisionWorkbench.ts`
- `Product/OrchestratedDecisionIntelligenceService.ts`

Status:

Implemented

---

# 6. Core Management Components


## Engine Registry


Purpose:

Central engine registration system.


Responsibilities:


- Register engines
- Discover engines
- Manage engine identity



---


## LifecycleManager

Canonical implementation: `Engines/LifecycleManager.ts`.


Purpose:

Manage engine lifecycle and compute the canonical startup/shutdown order.


Responsibilities:


- Initialize engines
- Update status
- Monitor states
- Compute dependency tier order


Startup order model:

`getStartupOrder()` resolves each registered engine against a five-tier
preferred order declared in `Engines/LifecycleManager.ts`. Tier membership is a
preferred ordering, not the registry: an unregistered tier name is skipped, and
a registered engine not named in any tier is appended afterwards. The tier list
is therefore a superset of the engines registered by `Core/HBOS.ts`.
`getShutdownOrder()` returns the reverse of the resolved order.


---


## Dependency Manager


Purpose:

Manage engine relationships.


Responsibilities:


- Dependency validation
- Startup order
- Conflict detection



---


## Boot System


Purpose:

System startup management.


Responsibilities:


- Engine loading
- Dependency checking
- Boot reporting



---


# 7. Health Architecture


Every Engine must expose:



Example:


```json
{
 "engine":"Memory Engine",
 "status":"RUNNING",
 "healthy":true
}
SYSTEM HEALTH REPORT


Memory Engine

Status: RUNNING

Health: OK



Decision Engine

Status: RUNNING

Health: OK



System:

READY
Capability

↓

Engine

↓

Test

↓

Documentation

↓

Commit