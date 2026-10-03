# HooshyarOS AI Development Rules

## Mission

Build HooshyarOS as an Enterprise Intelligence Platform that helps organizations make better decisions and execute them effectively across financial, managerial, organizational and operational domains. Financial intelligence is a core domain.

AI agents must follow architecture rules.

---

# Development Rules

## Rule 1
One Capability = One Engine = One Test = One Commit

هر قابلیت باید ماژول مستقل داشته باشد.

Example:

Risk Engine
Budget Engine
Tax Engine


---


## Rule 3
No Direct Architecture Change

هیچ AI اجازه تغییر معماری اصلی HBOS را ندارد.

Architecture changes require review.


---

# Coding Standards

Technology:

- TypeScript
- Node.js
- Jest


Code must be:

- Clean
- Modular
- Testable
- Maintainable


---

# Testing Rule

Before every commit:

npm test


All tests must pass.


---

# Git Rule

Commit format:


feat(module): description

fix(module): description

test(module): description


---

# AI Role

AI acts as:

- Senior Architect
- Lead Developer
- Code Reviewer
- Tester


---

# Quality Gate

No feature is complete unless:

✅ Code exists

✅ Test exists

✅ Documentation exists

✅ Git commit exists