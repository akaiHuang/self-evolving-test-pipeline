/**
 * 多代理開發工作流程範例
 * 
 * 此範例展示如何使用 GitHub Copilot SDK 創建一個多代理系統:
 * 1. 監工代理 - 負責任務分配和協調
 * 2. 開發者代理 - 負責實際編碼
 * 3. 測試代理 - 負責自動化測試
 */

import { CopilotClient, CustomAgentConfig, SessionEvent } from "@github/copilot-sdk";
import * as fs from "fs/promises";
import * as path from "path";

// ============================================================================
// 代理定義
// ============================================================================

const supervisorAgent: CustomAgentConfig = {
    name: "supervisor",
    displayName: "專案監工",
    description: "負責任務分解、分配和進度追蹤",
    prompt: `你是一位經驗豐富的專案經理,負責:
1. 分析用戶需求,將大型任務分解為可執行的小任務
2. 評估每個任務的優先級和依賴關係
3. 分配任務給適當的開發者
4. 追蹤整體專案進度
5. 協調團隊成員之間的工作
6. 識別風險並提出解決方案

請以結構化的方式輸出任務列表,包含:
- 任務編號
- 任務描述
- 優先級 (高/中/低)
- 預估時間
- 分配給哪個代理 (developer/tester)
- 依賴項`,
    tools: ["view", "search"],
    infer: true
};

const developerAgent: CustomAgentConfig = {
    name: "developer",
    displayName: "開發工程師",
    description: "負責實現功能和編寫代碼",
    prompt: `你是一位資深全端工程師,專精於:
1. 編寫乾淨、可維護的 TypeScript/JavaScript 代碼
2. 遵循最佳實踐和設計模式 (SOLID, DRY, KISS)
3. 實現功能需求
4. 撰寫清晰的代碼註釋和文檔
5. 使用 TypeScript 進行類型安全開發
6. 熟悉 React、Next.js、Node.js 等現代技術棧

在編碼前,請先:
1. 理解需求
2. 設計解決方案
3. 考慮邊界情況
4. 編寫可測試的代碼`,
    tools: ["edit", "view", "bash", "search"],
    infer: true
};

const testerAgent: CustomAgentConfig = {
    name: "tester",
    displayName: "測試工程師",
    description: "負責自動化測試和質量保證",
    prompt: `你是一位測試工程師,專精於:
1. 編寫全面的單元測試 (使用 Jest/Vitest)
2. 編寫整合測試和 E2E 測試 (使用 Playwright)
3. 確保高代碼覆蓋率 (>80%)
4. 測試邊界情況和錯誤處理
5. 發現和報告 bug
6. 驗證功能需求是否滿足

測試應該包含:
1. 正常流程測試
2. 錯誤處理測試
3. 邊界條件測試
4. 性能測試 (如適用)

請確保所有測試通過後才標記任務完成。`,
    tools: ["edit", "view", "bash", "search"],
    infer: true
};

// ============================================================================
// 任務追蹤系統
// ============================================================================

interface Task {
    id: string;
    description: string;
    priority: "high" | "medium" | "low";
    assignedTo: "developer" | "tester";
    status: "pending" | "in-progress" | "testing" | "completed" | "failed";
    dependencies: string[];
    result?: string;
    startTime?: Date;
    endTime?: Date;
}

class TaskManager {
    private tasks: Map<string, Task> = new Map();
    private logFile: string;

    constructor(logFile: string) {
        this.logFile = logFile;
    }

    async addTask(task: Task) {
        this.tasks.set(task.id, task);
        await this.saveLog();
    }

    async updateTask(id: string, updates: Partial<Task>) {
        const task = this.tasks.get(id);
        if (task) {
            Object.assign(task, updates);
            await this.saveLog();
        }
    }

    getTask(id: string): Task | undefined {
        return this.tasks.get(id);
    }

    getAllTasks(): Task[] {
        return Array.from(this.tasks.values());
    }

    getReadyTasks(): Task[] {
        return this.getAllTasks().filter(task => {
            if (task.status !== "pending") return false;
            // 檢查所有依賴是否完成
            return task.dependencies.every(depId => {
                const dep = this.tasks.get(depId);
                return dep && dep.status === "completed";
            });
        });
    }

    async saveLog() {
        const log = {
            timestamp: new Date().toISOString(),
            tasks: Array.from(this.tasks.values())
        };
        await fs.writeFile(this.logFile, JSON.stringify(log, null, 2));
    }

    getProgress(): { total: number; completed: number; failed: number; percentage: number } {
        const tasks = this.getAllTasks();
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === "completed").length;
        const failed = tasks.filter(t => t.status === "failed").length;
        return {
            total,
            completed,
            failed,
            percentage: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }
}

// ============================================================================
// 多代理協調器
// ============================================================================

class MultiAgentOrchestrator {
    private client: CopilotClient;
    private supervisorSession: any;
    private devSession: any;
    private testSession: any;
    private taskManager: TaskManager;

    constructor() {
        this.client = new CopilotClient();
        this.taskManager = new TaskManager("./task-log.json");
    }

    async initialize() {
        await this.client.start();

        // 創建監工會話
        this.supervisorSession = await this.client.createSession({
            sessionId: "supervisor-session",
            customAgents: [supervisorAgent],
            model: "gpt-4.1"
        });

        // 創建開發者會話
        this.devSession = await this.client.createSession({
            sessionId: "developer-session",
            customAgents: [developerAgent],
            model: "gpt-4.1"
        });

        // 創建測試會話
        this.testSession = await this.client.createSession({
            sessionId: "tester-session",
            customAgents: [testerAgent],
            model: "gpt-4.1"
        });

        // 設置事件監聽
        this.setupEventListeners();
    }

    private setupEventListeners() {
        // 監工會話事件
        this.supervisorSession.on((event: SessionEvent) => {
            if (event.type === "assistant.message") {
                console.log("\n📋 [監工]:", event.data.content);
            } else if (event.type === "tool.execution_start") {
                console.log(`  🔧 監工執行工具: ${event.data.toolName}`);
            }
        });

        // 開發者會話事件
        this.devSession.on((event: SessionEvent) => {
            if (event.type === "assistant.message") {
                console.log("\n💻 [開發者]:", event.data.content);
            } else if (event.type === "tool.execution_start") {
                console.log(`  🔧 開發者執行工具: ${event.data.toolName}`);
            }
        });

        // 測試會話事件
        this.testSession.on((event: SessionEvent) => {
            if (event.type === "assistant.message") {
                console.log("\n🧪 [測試]:", event.data.content);
            } else if (event.type === "tool.execution_start") {
                console.log(`  🔧 測試執行工具: ${event.data.toolName}`);
            }
        });
    }

    async processProject(projectDescription: string) {
        console.log("\n" + "=".repeat(80));
        console.log("🚀 啟動多代理開發流程");
        console.log("=".repeat(80));

        // 步驟 1: 監工分析和分解任務
        console.log("\n[步驟 1] 監工正在分析專案需求...\n");
        const taskBreakdown = await this.getTasks(projectDescription);
        
        // 步驟 2: 開發者執行任務
        console.log("\n[步驟 2] 開始開發任務...\n");
        await this.executeDevelopmentTasks();

        // 步驟 3: 測試工程師執行測試
        console.log("\n[步驟 3] 開始測試流程...\n");
        await this.executeTestingTasks();

        // 步驟 4: 監工檢查完成狀態
        console.log("\n[步驟 4] 監工檢查專案狀態...\n");
        await this.finalReview();

        // 顯示最終報告
        this.showFinalReport();
    }

    private async getTasks(projectDescription: string): Promise<void> {
        const prompt = `請分析以下專案需求,並將其分解為具體的開發任務:

專案描述:
${projectDescription}

請提供:
1. 任務列表 (編號 T1, T2, T3...)
2. 每個任務的詳細描述
3. 優先級 (high/medium/low)
4. 分配對象 (developer/tester)
5. 任務間的依賴關係

範例格式:
T1: [描述] | 優先級: high | 分配: developer | 依賴: []
T2: [描述] | 優先級: medium | 分配: tester | 依賴: [T1]`;

        const done = new Promise<void>((resolve) => {
            this.supervisorSession.on((event: SessionEvent) => {
                if (event.type === "session.idle") {
                    resolve();
                }
            });
        });

        await this.supervisorSession.send({ prompt });
        await done;

        // 這裡應該解析監工的回應,創建任務
        // 為了示範,我們手動創建一些任務
        await this.createSampleTasks();
    }

    private async createSampleTasks() {
        const sampleTasks: Task[] = [
            {
                id: "T1",
                description: "設計和實現用戶認證模組",
                priority: "high",
                assignedTo: "developer",
                status: "pending",
                dependencies: []
            },
            {
                id: "T2",
                description: "創建用戶資料庫模型",
                priority: "high",
                assignedTo: "developer",
                status: "pending",
                dependencies: []
            },
            {
                id: "T3",
                description: "為認證模組編寫單元測試",
                priority: "high",
                assignedTo: "tester",
                status: "pending",
                dependencies: ["T1"]
            },
            {
                id: "T4",
                description: "實現用戶註冊 API 端點",
                priority: "medium",
                assignedTo: "developer",
                status: "pending",
                dependencies: ["T2"]
            },
            {
                id: "T5",
                description: "編寫 API 整合測試",
                priority: "medium",
                assignedTo: "tester",
                status: "pending",
                dependencies: ["T4"]
            }
        ];

        for (const task of sampleTasks) {
            await this.taskManager.addTask(task);
        }

        console.log(`📝 已創建 ${sampleTasks.length} 個任務`);
    }

    private async executeDevelopmentTasks() {
        const devTasks = this.taskManager.getAllTasks()
            .filter(t => t.assignedTo === "developer");

        console.log(`💻 找到 ${devTasks.length} 個開發任務\n`);

        // 並行執行可以並行的任務
        const readyTasks = this.taskManager.getReadyTasks()
            .filter(t => t.assignedTo === "developer");

        for (const task of readyTasks) {
            await this.executeTask(task, this.devSession);
        }
    }

    private async executeTestingTasks() {
        const testTasks = this.taskManager.getAllTasks()
            .filter(t => t.assignedTo === "tester");

        console.log(`🧪 找到 ${testTasks.length} 個測試任務\n`);

        for (const task of testTasks) {
            const readyTasks = this.taskManager.getReadyTasks();
            if (readyTasks.find(t => t.id === task.id)) {
                await this.executeTask(task, this.testSession);
            }
        }
    }

    private async executeTask(task: Task, session: any) {
        console.log(`\n▶️  開始執行任務 ${task.id}: ${task.description}`);
        
        await this.taskManager.updateTask(task.id, {
            status: "in-progress",
            startTime: new Date()
        });

        const prompt = `請執行以下任務:

任務ID: ${task.id}
描述: ${task.description}
優先級: ${task.priority}

請:
1. 分析需求
2. 實現解決方案
3. 確保代碼質量
4. 提供完成報告`;

        const done = new Promise<string>((resolve) => {
            let result = "";
            session.on((event: SessionEvent) => {
                if (event.type === "assistant.message") {
                    result = event.data.content || "";
                } else if (event.type === "session.idle") {
                    resolve(result);
                }
            });
        });

        await session.send({ prompt });
        const result = await done;

        await this.taskManager.updateTask(task.id, {
            status: "completed",
            endTime: new Date(),
            result
        });

        console.log(`✅ 任務 ${task.id} 完成`);
    }

    private async finalReview() {
        const progress = this.taskManager.getProgress();
        
        const prompt = `請檢查專案完成狀態:

總任務數: ${progress.total}
已完成: ${progress.completed}
失敗: ${progress.failed}
完成率: ${progress.percentage}%

請提供:
1. 整體評估
2. 發現的問題
3. 改進建議
4. 下一步行動`;

        const done = new Promise<void>((resolve) => {
            this.supervisorSession.on((event: SessionEvent) => {
                if (event.type === "session.idle") {
                    resolve();
                }
            });
        });

        await this.supervisorSession.send({ prompt });
        await done;
    }

    private showFinalReport() {
        const progress = this.taskManager.getProgress();
        
        console.log("\n" + "=".repeat(80));
        console.log("📊 專案完成報告");
        console.log("=".repeat(80));
        console.log(`總任務數: ${progress.total}`);
        console.log(`已完成: ${progress.completed} (${progress.percentage}%)`);
        console.log(`失敗: ${progress.failed}`);
        console.log("=".repeat(80) + "\n");

        // 顯示每個任務的詳情
        console.log("📋 任務詳情:\n");
        this.taskManager.getAllTasks().forEach(task => {
            const status = task.status === "completed" ? "✅" :
                          task.status === "failed" ? "❌" :
                          task.status === "in-progress" ? "🔄" : "⏸️";
            
            console.log(`${status} ${task.id}: ${task.description}`);
            console.log(`   優先級: ${task.priority} | 分配: ${task.assignedTo}`);
            if (task.startTime && task.endTime) {
                const duration = (task.endTime.getTime() - task.startTime.getTime()) / 1000;
                console.log(`   耗時: ${duration.toFixed(2)}秒`);
            }
            console.log();
        });
    }

    async cleanup() {
        await this.supervisorSession?.destroy();
        await this.devSession?.destroy();
        await this.testSession?.destroy();
        await this.client.stop();
    }
}

// ============================================================================
// 主程式
// ============================================================================

async function main() {
    const orchestrator = new MultiAgentOrchestrator();
    
    try {
        await orchestrator.initialize();
        
        // 示例專案描述
        const projectDescription = `
創建一個用戶認證系統,包含以下功能:
1. 用戶註冊 (email + password)
2. 用戶登入 (JWT token)
3. 密碼加密 (bcrypt)
4. Token 驗證中間件
5. 完整的錯誤處理
6. 輸入驗證

技術棧:
- TypeScript
- Express.js
- PostgreSQL
- Jest for testing

要求:
- 遵循 RESTful API 設計
- 代碼覆蓋率 > 80%
- 包含完整的測試
        `.trim();

        await orchestrator.processProject(projectDescription);
        
    } catch (error) {
        console.error("❌ 錯誤:", error);
    } finally {
        await orchestrator.cleanup();
    }
}

// 執行主程式
if (require.main === module) {
    main().catch(console.error);
}

export { MultiAgentOrchestrator, TaskManager };
