# Self-Evolving Test Pipeline

**AI Feedback Loop for Continuous Optimization -- Systems That Test, Learn, and Adapt Automatically**

## About

Self-Evolving Test Pipeline 以 AI 回饋迴圈強化傳統 CI/CD，讓測試、診斷、修復與再驗證形成可自動迭代的閉環。適合用於提升測試覆蓋與修復效率的工程實驗，也可作為 agentic testing 與自動修復流程的參考架構。

## 📋 Quick Summary

> 🔄 **會自我進化的測試管線——測試、學習、修復、再測試，全程無需人工介入！** 本專案突破傳統 CI/CD 的線性流程限制，引入 AI 回饋迴圈機制。🤖 系統由多個專業 AI 代理組成：Supervisor 負責任務分解與風險識別、Developer 負責程式碼實作與重構、Tester 負責測試生成與覆蓋率分析。🧪 當測試失敗時，系統不僅回報錯誤，更會 **自動分析根因、產生修復方案、重新執行測試**，反覆迭代直到收斂。📦 提供四套生產級工作流範本：多代理協作、Next.js 測試自動化（五階段循環）、平行開發（前端/後端/資料庫/測試四路並行）、以及行銷智慧分析管線。⚙️ 基於 GitHub Copilot SDK 與 GPT-4.1 構建，每個代理擁有獨立工具權限（edit、view、bash、search），透過記憶體內任務追蹤器管理依賴關係。📊 所有執行結果自動輸出 JSON 資料檔與 Markdown 報告，完美整合進現有開發流程。

---

## 🤔 Why This Exists

Traditional CI/CD pipelines are linear: code goes in, tests run, a pass/fail comes out. When tests fail, a human reads the error, fixes the code, and pushes again. The pipeline itself learns nothing from each cycle.

Self-Evolving Test Pipeline introduces a feedback loop. Multiple AI agents -- a supervisor, developers, testers, and specialists -- work in parallel sessions, each with distinct expertise. When tests fail, the system does not just report the failure. It analyzes root causes, generates fixes, re-runs the tests, and produces a comprehensive report. Over successive iterations, the pipeline accumulates context and improves its strategies.

This is the concept of self-evolution applied to software development: the system tests, learns, and adapts without waiting for a human to close the loop.

---

## 🏗️ Architecture

```
                    +-----------------------+
                    |   Orchestrator        |
                    |   (Task Coordinator)  |
                    +----------+------------+
                               |
          +--------------------+--------------------+
          |                    |                    |
          v                    v                    v
+------------------+ +------------------+ +------------------+
|   Supervisor     | |   Developer      | |   Tester         |
|   Agent          | |   Agent          | |   Agent          |
|                  | |                  | |                  |
|  - Task decomp.  | |  - Code impl.   | |  - Test gen.     |
|  - Priority      | |  - Design       | |  - Test exec.    |
|  - Coordination  | |  - Best         | |  - Coverage      |
|  - Risk ID       | |    practices    | |  - Fix failures  |
+------------------+ +------------------+ +------------------+
          |                    |                    |
          +--------------------+--------------------+
                               |
                    +----------+------------+
                    |   Feedback Loop       |
                    |                       |
                    |  Test -> Analyze ->   |
                    |  Fix -> Re-test ->    |
                    |  Report -> Improve    |
                    +-----------------------+
```

### Workflow Examples

The `examples/` directory contains four production-ready workflow templates:

| Example | File | Description |
|---------|------|-------------|
| **Multi-Agent Workflow** | `multi-agent-workflow.ts` | Three-agent system (supervisor, developer, tester) with task decomposition, dependency tracking, parallel execution, and progress reporting |
| **Next.js Test Automation** | `nextjs-test-automation.ts` | Five-step automation cycle: generate tests, execute suite, analyze failures, auto-fix, re-run, and produce coverage reports |
| **Parallel Development** | `parallel-development.ts` | Four specialized sessions (frontend, backend, database, testing) running simultaneously with independent task queues |
| **Marketing Intel Orchestrator** | `marketing-intel-orchestrator.ts` | Four-agent intelligence pipeline (strategist, data analyst, compliance, ops planner) that transforms a brief into an actionable marketing plan |

### Core Patterns

Each workflow implements the same fundamental pattern:

1. **Decompose** -- Break a high-level objective into atomic tasks with dependencies
2. **Distribute** -- Assign tasks to specialized AI agents running in parallel sessions
3. **Execute** -- Agents work independently, using tools (edit, view, bash, search)
4. **Evaluate** -- Collect results, analyze failures, identify root causes
5. **Adapt** -- Generate fixes, re-execute failed tasks, iterate until convergence
6. **Report** -- Produce structured output (JSON + Markdown) with metrics and recommendations

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | TypeScript (Node.js) |
| AI Orchestration | GitHub Copilot SDK (`@github/copilot-sdk`) |
| AI Model | GPT-4.1 (via Copilot Sessions) |
| Agent Capabilities | Custom agent configs with tool permissions (edit, view, bash, search) |
| Task Management | In-memory task tracker with dependency resolution |
| Output | JSON reports + Markdown summaries |

---

## 🏁 Quick Start

```bash
# Install dependencies
npm install

# Run multi-agent workflow example
npx tsx examples/multi-agent-workflow.ts

# Run marketing intelligence orchestrator
npx tsx examples/marketing-intel-orchestrator.ts --brief "Launch campaign for a new AI productivity tool targeting developers"

# Run Next.js test automation
npx tsx examples/nextjs-test-automation.ts ./my-nextjs-app

# Run parallel development
npx tsx examples/parallel-development.ts
```

Each workflow produces both a JSON data file and a Markdown report in the working directory.

---

## 👤 Author

**Huang Akai (Kai)** -- Founder @ Universal FAW Labs | Creative Technologist | Ex-Ogilvy | 15+ years in digital creative and marketing technology.
