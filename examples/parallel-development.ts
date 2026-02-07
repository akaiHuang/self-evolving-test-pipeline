/**
 * 並行開發任務範例
 * 
 * 展示如何使用多個會話同時執行不同的開發任務,
 * 實現真正的多線程並行開發。
 */

import { CopilotClient, CustomAgentConfig, SessionEvent } from "@github/copilot-sdk";
import * as fs from "fs/promises";

// ============================================================================
// 任務定義
// ============================================================================

interface DevelopmentTask {
    id: string;
    type: "frontend" | "backend" | "database" | "testing";
    description: string;
    files: string[];
    status: "pending" | "running" | "completed" | "failed";
    output?: string;
    error?: string;
}

// ============================================================================
// 並行開發管理器
// ============================================================================

class ParallelDevelopmentManager {
    private client: CopilotClient;
    private sessions: Map<string, any> = new Map();
    private tasks: Map<string, DevelopmentTask> = new Map();

    constructor() {
        this.client = new CopilotClient();
    }

    async initialize() {
        await this.client.start();
        console.log("✅ Copilot 客戶端已啟動");
    }

    /**
     * 創建專門化的開發者會話
     */
    async createSpecializedSessions() {
        // 前端開發者
        const frontendSession = await this.client.createSession({
            sessionId: "frontend-dev",
            customAgents: [{
                name: "frontend-specialist",
                displayName: "前端專家",
                description: "專精於 React 和 Next.js 開發",
                prompt: `你是一位前端開發專家,專精於:
- React 18+ 和 Next.js 14+
- TypeScript
- Tailwind CSS
- 響應式設計
- 性能優化
- 無障礙設計 (a11y)

請編寫乾淨、可維護、符合最佳實踐的代碼。`,
                tools: ["edit", "view", "bash"],
                infer: true
            }],
            model: "gpt-4.1"
        });

        // 後端開發者
        const backendSession = await this.client.createSession({
            sessionId: "backend-dev",
            customAgents: [{
                name: "backend-specialist",
                displayName: "後端專家",
                description: "專精於 Node.js API 開發",
                prompt: `你是一位後端開發專家,專精於:
- Node.js 和 Express/Fastify
- RESTful API 設計
- 資料庫設計 (PostgreSQL, MongoDB)
- 認證和授權 (JWT, OAuth)
- API 安全性
- 錯誤處理

請編寫安全、高效、可擴展的後端代碼。`,
                tools: ["edit", "view", "bash"],
                infer: true
            }],
            model: "gpt-4.1"
        });

        // 資料庫專家
        const databaseSession = await this.client.createSession({
            sessionId: "database-expert",
            customAgents: [{
                name: "database-specialist",
                displayName: "資料庫專家",
                description: "專精於資料庫設計和優化",
                prompt: `你是一位資料庫專家,專精於:
- 資料庫架構設計
- SQL 優化
- 索引策略
- 資料遷移
- ORM (Prisma, TypeORM)
- 資料一致性

請設計高效、可擴展的資料庫結構。`,
                tools: ["edit", "view", "bash"],
                infer: true
            }],
            model: "gpt-4.1"
        });

        // 測試工程師
        const testSession = await this.client.createSession({
            sessionId: "test-engineer",
            customAgents: [{
                name: "test-specialist",
                displayName: "測試專家",
                description: "專精於自動化測試",
                prompt: `你是一位測試工程師,專精於:
- Jest/Vitest 單元測試
- Playwright E2E 測試
- React Testing Library
- 測試覆蓋率分析
- 性能測試
- 安全測試

請編寫全面、可靠的測試。`,
                tools: ["edit", "view", "bash"],
                infer: true
            }],
            model: "gpt-4.1"
        });

        this.sessions.set("frontend", frontendSession);
        this.sessions.set("backend", backendSession);
        this.sessions.set("database", databaseSession);
        this.sessions.set("testing", testSession);

        console.log("✅ 已創建 4 個專門化會話");
    }

    /**
     * 添加開發任務
     */
    addTask(task: DevelopmentTask) {
        this.tasks.set(task.id, task);
    }

    /**
     * 並行執行所有任務
     */
    async executeTasksInParallel() {
        console.log("\n🚀 開始並行執行任務...\n");

        const sessionMap: Record<DevelopmentTask["type"], string> = {
            frontend: "frontend",
            backend: "backend",
            database: "database",
            testing: "testing"
        };

        // 將任務按類型分組
        const tasksByType: Record<string, DevelopmentTask[]> = {
            frontend: [],
            backend: [],
            database: [],
            testing: []
        };

        for (const task of this.tasks.values()) {
            tasksByType[task.type].push(task);
        }

        // 為每個會話創建任務隊列
        const sessionPromises = Object.entries(tasksByType).map(([type, tasks]) => {
            if (tasks.length === 0) return Promise.resolve();
            
            const sessionKey = sessionMap[type as DevelopmentTask["type"]];
            const session = this.sessions.get(sessionKey);
            
            return this.executeTasksInSession(session, tasks, type);
        });

        // 並行執行所有會話的任務
        await Promise.all(sessionPromises);

        console.log("\n✅ 所有任務執行完成!\n");
    }

    /**
     * 在特定會話中執行任務
     */
    private async executeTasksInSession(
        session: any,
        tasks: DevelopmentTask[],
        sessionType: string
    ): Promise<void> {
        console.log(`📋 [${sessionType}] 開始執行 ${tasks.length} 個任務`);

        for (const task of tasks) {
            await this.executeTask(session, task, sessionType);
        }
    }

    /**
     * 執行單個任務
     */
    private async executeTask(
        session: any,
        task: DevelopmentTask,
        sessionType: string
    ): Promise<void> {
        console.log(`\n▶️  [${sessionType}] 執行任務: ${task.id}`);
        console.log(`   描述: ${task.description}`);

        task.status = "running";

        const prompt = `請執行以下開發任務:

任務: ${task.description}

涉及的檔案:
${task.files.map(f => `- ${f}`).join("\n")}

請:
1. 分析需求
2. 實現功能
3. 確保代碼質量
4. 提供完成摘要

如果需要創建新檔案,請直接創建。
如果需要修改現有檔案,請進行適當的修改。`;

        try {
            const result = await new Promise<string>((resolve, reject) => {
                let output = "";
                let hasError = false;

                const timeout = setTimeout(() => {
                    reject(new Error("任務執行超時"));
                }, 300000); // 5 分鐘超時

                session.on((event: SessionEvent) => {
                    if (event.type === "assistant.message") {
                        output += event.data.content || "";
                    } else if (event.type === "error") {
                        hasError = true;
                        clearTimeout(timeout);
                        reject(new Error(event.data.message || "執行錯誤"));
                    } else if (event.type === "session.idle") {
                        clearTimeout(timeout);
                        if (!hasError) {
                            resolve(output);
                        }
                    }
                });
            });

            await session.send({ prompt });

            task.status = "completed";
            task.output = result;
            console.log(`✅ [${sessionType}] 任務 ${task.id} 完成`);

        } catch (error) {
            task.status = "failed";
            task.error = error instanceof Error ? error.message : String(error);
            console.error(`❌ [${sessionType}] 任務 ${task.id} 失敗:`, task.error);
        }
    }

    /**
     * 生成執行報告
     */
    generateReport(): string {
        const tasks = Array.from(this.tasks.values());
        const completed = tasks.filter(t => t.status === "completed").length;
        const failed = tasks.filter(t => t.status === "failed").length;
        const pending = tasks.filter(t => t.status === "pending").length;

        let report = "\n" + "=".repeat(80) + "\n";
        report += "📊 並行開發執行報告\n";
        report += "=".repeat(80) + "\n\n";

        report += `總任務數: ${tasks.length}\n`;
        report += `已完成: ${completed} ✅\n`;
        report += `失敗: ${failed} ❌\n`;
        report += `待執行: ${pending} ⏸️\n`;
        report += `成功率: ${((completed / tasks.length) * 100).toFixed(1)}%\n\n`;

        report += "詳細結果:\n";
        report += "-".repeat(80) + "\n";

        for (const task of tasks) {
            const icon = task.status === "completed" ? "✅" :
                        task.status === "failed" ? "❌" :
                        task.status === "running" ? "🔄" : "⏸️";
            
            report += `\n${icon} ${task.id} (${task.type})\n`;
            report += `   ${task.description}\n`;
            
            if (task.status === "completed" && task.output) {
                const summary = task.output.substring(0, 200);
                report += `   輸出: ${summary}${task.output.length > 200 ? "..." : ""}\n`;
            } else if (task.status === "failed" && task.error) {
                report += `   錯誤: ${task.error}\n`;
            }
        }

        report += "\n" + "=".repeat(80) + "\n";

        return report;
    }

    async cleanup() {
        for (const session of this.sessions.values()) {
            await session.destroy();
        }
        await this.client.stop();
        console.log("✅ 資源清理完成");
    }
}

// ============================================================================
// 主程式 - 實際使用範例
// ============================================================================

async function main() {
    const manager = new ParallelDevelopmentManager();

    try {
        // 初始化
        await manager.initialize();
        await manager.createSpecializedSessions();

        // 定義並行開發任務
        const tasks: DevelopmentTask[] = [
            // 前端任務
            {
                id: "FE-001",
                type: "frontend",
                description: "創建用戶登入頁面組件 (LoginPage.tsx)",
                files: ["src/components/LoginPage.tsx", "src/components/LoginForm.tsx"],
                status: "pending"
            },
            {
                id: "FE-002",
                type: "frontend",
                description: "創建用戶註冊頁面組件 (RegisterPage.tsx)",
                files: ["src/components/RegisterPage.tsx", "src/components/RegisterForm.tsx"],
                status: "pending"
            },
            {
                id: "FE-003",
                type: "frontend",
                description: "創建用戶儀表板組件 (Dashboard.tsx)",
                files: ["src/components/Dashboard.tsx", "src/components/UserProfile.tsx"],
                status: "pending"
            },

            // 後端任務
            {
                id: "BE-001",
                type: "backend",
                description: "實現用戶認證 API 端點 (POST /api/auth/login, /api/auth/register)",
                files: ["src/api/auth.ts", "src/middleware/auth.ts"],
                status: "pending"
            },
            {
                id: "BE-002",
                type: "backend",
                description: "實現用戶資料 CRUD API (GET/PUT/DELETE /api/users/:id)",
                files: ["src/api/users.ts", "src/middleware/authorization.ts"],
                status: "pending"
            },

            // 資料庫任務
            {
                id: "DB-001",
                type: "database",
                description: "設計用戶資料表 schema 和遷移腳本",
                files: ["prisma/schema.prisma", "prisma/migrations/001_users.sql"],
                status: "pending"
            },
            {
                id: "DB-002",
                type: "database",
                description: "創建資料庫索引和優化查詢",
                files: ["prisma/migrations/002_indexes.sql"],
                status: "pending"
            },

            // 測試任務
            {
                id: "TEST-001",
                type: "testing",
                description: "為認證 API 編寫單元測試",
                files: ["tests/api/auth.test.ts"],
                status: "pending"
            },
            {
                id: "TEST-002",
                type: "testing",
                description: "為用戶組件編寫 React 測試",
                files: ["tests/components/LoginPage.test.tsx", "tests/components/Dashboard.test.tsx"],
                status: "pending"
            },
            {
                id: "TEST-003",
                type: "testing",
                description: "編寫登入流程 E2E 測試",
                files: ["tests/e2e/auth-flow.spec.ts"],
                status: "pending"
            }
        ];

        // 添加所有任務
        tasks.forEach(task => manager.addTask(task));

        console.log(`\n📋 已添加 ${tasks.length} 個開發任務`);
        console.log("   - 前端任務: 3");
        console.log("   - 後端任務: 2");
        console.log("   - 資料庫任務: 2");
        console.log("   - 測試任務: 3\n");

        // 並行執行所有任務
        const startTime = Date.now();
        await manager.executeTasksInParallel();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        // 生成並顯示報告
        const report = manager.generateReport();
        console.log(report);
        console.log(`⏱️  總執行時間: ${duration} 秒\n`);

        // 保存報告到檔案
        await fs.writeFile("./parallel-dev-report.txt", report);
        console.log("💾 報告已保存到 parallel-dev-report.txt");

    } catch (error) {
        console.error("❌ 執行錯誤:", error);
    } finally {
        await manager.cleanup();
    }
}

// 執行主程式
if (require.main === module) {
    main().catch(console.error);
}

export { ParallelDevelopmentManager, DevelopmentTask };
