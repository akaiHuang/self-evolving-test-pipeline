/**
 * Next.js 自動化測試整合範例
 * 
 * 展示如何使用 Copilot SDK 實現完整的自動化測試流程:
 * 1. 自動生成測試代碼
 * 2. 執行測試並分析結果
 * 3. 修復失敗的測試
 * 4. 生成測試報告
 */

import { CopilotClient, CustomAgentConfig, SessionEvent } from "@github/copilot-sdk";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execAsync = promisify(exec);

// ============================================================================
// 測試結果類型定義
// ============================================================================

interface TestResult {
    testFile: string;
    testSuite: string;
    testName: string;
    status: "passed" | "failed" | "skipped";
    duration: number;
    error?: string;
}

interface TestReport {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    coverage?: {
        lines: number;
        functions: number;
        branches: number;
        statements: number;
    };
    results: TestResult[];
}

// ============================================================================
// Next.js 自動化測試管理器
// ============================================================================

class NextJsTestAutomation {
    private client: CopilotClient;
    private testGeneratorSession: any;
    private testRunnerSession: any;
    private testFixerSession: any;
    private projectPath: string;

    constructor(projectPath: string) {
        this.client = new CopilotClient();
        this.projectPath = projectPath;
    }

    async initialize() {
        await this.client.start();
        console.log("✅ Copilot 客戶端已啟動");

        await this.createTestAgents();
    }

    /**
     * 創建測試相關的代理
     */
    private async createTestAgents() {
        // 測試生成代理
        this.testGeneratorSession = await this.client.createSession({
            sessionId: "test-generator",
            customAgents: [{
                name: "test-generator",
                displayName: "測試生成專家",
                description: "專精於生成高質量的自動化測試",
                prompt: `你是一位測試工程師,專精於為 Next.js 應用生成全面的測試:

技能:
- Jest/Vitest 單元測試
- React Testing Library 組件測試
- Playwright E2E 測試
- API 路由測試
- 測試覆蓋率優化

測試原則:
1. 測試應該清晰、可讀、可維護
2. 遵循 AAA 模式 (Arrange, Act, Assert)
3. 使用描述性的測試名稱
4. 測試邊界情況和錯誤處理
5. 確保測試隔離性
6. 使用適當的 mock 和 stub

請生成完整、可執行的測試代碼。`,
                tools: ["edit", "view", "bash", "search"],
                infer: true
            }],
            model: "gpt-4.1"
        });

        // 測試執行代理
        this.testRunnerSession = await this.client.createSession({
            sessionId: "test-runner",
            customAgents: [{
                name: "test-runner",
                displayName: "測試執行專家",
                description: "負責執行測試並分析結果",
                prompt: `你是一位測試執行專家,負責:

1. 執行各種類型的測試
2. 分析測試結果和錯誤訊息
3. 識別測試失敗的根本原因
4. 提供修復建議
5. 生成測試報告

請提供詳細的分析和可行的建議。`,
                tools: ["bash", "view", "search"],
                infer: true
            }],
            model: "gpt-4.1"
        });

        // 測試修復代理
        this.testFixerSession = await this.client.createSession({
            sessionId: "test-fixer",
            customAgents: [{
                name: "test-fixer",
                displayName: "測試修復專家",
                description: "專門修復失敗的測試",
                prompt: `你是一位測試修復專家,負責:

1. 分析失敗的測試
2. 找出問題根源
3. 修復測試代碼或被測試的代碼
4. 確保修復不影響其他測試
5. 驗證修復後測試通過

請系統性地分析和修復問題。`,
                tools: ["edit", "view", "bash", "search"],
                infer: true
            }],
            model: "gpt-4.1"
        });

        console.log("✅ 已創建 3 個測試代理");
    }

    /**
     * 自動生成測試
     */
    async generateTests(componentPath: string, testType: "unit" | "integration" | "e2e") {
        console.log(`\n📝 為 ${componentPath} 生成 ${testType} 測試...`);

        const sourceCode = await fs.readFile(
            path.join(this.projectPath, componentPath),
            "utf-8"
        );

        const prompt = `請為以下 Next.js 組件/功能生成 ${testType} 測試:

檔案路徑: ${componentPath}

原始碼:
\`\`\`typescript
${sourceCode}
\`\`\`

要求:
1. 生成完整的測試檔案
2. 包含所有主要功能的測試
3. 測試邊界情況和錯誤處理
4. 確保測試覆蓋率 > 80%
5. 使用最佳實踐

測試類型說明:
- unit: 使用 Jest/Vitest 和 React Testing Library
- integration: 測試多個組件的互動
- e2e: 使用 Playwright 測試完整流程

請生成測試檔案並保存到適當的位置。`;

        return await this.sendAndWait(this.testGeneratorSession, prompt);
    }

    /**
     * 執行測試套件
     */
    async runTests(testPattern?: string): Promise<TestReport> {
        console.log("\n🧪 執行測試套件...");

        let command = "npm test";
        if (testPattern) {
            command += ` -- ${testPattern}`;
        }
        command += " --coverage --json --outputFile=test-results.json";

        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: this.projectPath,
                maxBuffer: 10 * 1024 * 1024 // 10MB
            });

            console.log("✅ 測試執行完成");

            // 解析測試結果
            const resultsPath = path.join(this.projectPath, "test-results.json");
            const resultsData = await fs.readFile(resultsPath, "utf-8");
            const results = JSON.parse(resultsData);

            return this.parseTestResults(results);

        } catch (error: any) {
            console.log("⚠️  測試執行完成(有失敗)");
            
            // 即使測試失敗,也嘗試解析結果
            try {
                const resultsPath = path.join(this.projectPath, "test-results.json");
                const resultsData = await fs.readFile(resultsPath, "utf-8");
                const results = JSON.parse(resultsData);
                return this.parseTestResults(results);
            } catch {
                throw error;
            }
        }
    }

    /**
     * 解析測試結果
     */
    private parseTestResults(jestResults: any): TestReport {
        const testResults: TestResult[] = [];
        let totalDuration = 0;

        for (const suite of jestResults.testResults) {
            for (const test of suite.assertionResults) {
                testResults.push({
                    testFile: suite.name,
                    testSuite: suite.name,
                    testName: test.fullName || test.title,
                    status: test.status,
                    duration: test.duration || 0,
                    error: test.failureMessages?.join("\n")
                });
            }
            totalDuration += suite.perfStats?.runtime || 0;
        }

        const passed = testResults.filter(t => t.status === "passed").length;
        const failed = testResults.filter(t => t.status === "failed").length;
        const skipped = testResults.filter(t => t.status === "skipped").length;

        return {
            totalTests: testResults.length,
            passed,
            failed,
            skipped,
            duration: totalDuration,
            coverage: jestResults.coverageMap ? {
                lines: jestResults.coverageMap.total?.lines.pct || 0,
                functions: jestResults.coverageMap.total?.functions.pct || 0,
                branches: jestResults.coverageMap.total?.branches.pct || 0,
                statements: jestResults.coverageMap.total?.statements.pct || 0
            } : undefined,
            results: testResults
        };
    }

    /**
     * 自動修復失敗的測試
     */
    async fixFailedTests(report: TestReport): Promise<void> {
        const failedTests = report.results.filter(t => t.status === "failed");
        
        if (failedTests.length === 0) {
            console.log("✅ 沒有失敗的測試需要修復");
            return;
        }

        console.log(`\n🔧 發現 ${failedTests.length} 個失敗的測試,開始修復...\n`);

        for (const test of failedTests) {
            await this.fixSingleTest(test);
        }
    }

    /**
     * 修復單個測試
     */
    private async fixSingleTest(test: TestResult): Promise<void> {
        console.log(`🔧 修復測試: ${test.testName}`);
        console.log(`   檔案: ${test.testFile}`);

        const testCode = await fs.readFile(test.testFile, "utf-8");

        const prompt = `請分析並修復以下失敗的測試:

測試檔案: ${test.testFile}
測試名稱: ${test.testName}
錯誤訊息:
${test.error}

測試代碼:
\`\`\`typescript
${testCode}
\`\`\`

請:
1. 分析失敗原因
2. 確定是測試代碼問題還是被測試代碼問題
3. 提供修復方案
4. 修復代碼
5. 驗證修復

如果是被測試的代碼有問題,請同時修復該代碼。`;

        const result = await this.sendAndWait(this.testFixerSession, prompt);
        
        console.log(`✅ 測試修復完成: ${test.testName}`);
    }

    /**
     * 生成測試報告
     */
    async generateTestReport(report: TestReport): Promise<string> {
        console.log("\n📊 生成測試報告...");

        const prompt = `請基於以下測試結果生成一份詳細的測試報告:

測試統計:
- 總測試數: ${report.totalTests}
- 通過: ${report.passed}
- 失敗: ${report.failed}
- 跳過: ${report.skipped}
- 執行時間: ${(report.duration / 1000).toFixed(2)}秒

${report.coverage ? `代碼覆蓋率:
- 行覆蓋率: ${report.coverage.lines.toFixed(2)}%
- 函數覆蓋率: ${report.coverage.functions.toFixed(2)}%
- 分支覆蓋率: ${report.coverage.branches.toFixed(2)}%
- 語句覆蓋率: ${report.coverage.statements.toFixed(2)}%` : ""}

失敗的測試:
${report.results.filter(t => t.status === "failed").map(t => `
- ${t.testName}
  檔案: ${t.testFile}
  錯誤: ${t.error}`).join("\n")}

請生成:
1. 執行摘要
2. 詳細分析
3. 問題識別
4. 改進建議
5. 下一步行動

格式: Markdown`;

        const reportContent = await this.sendAndWait(this.testRunnerSession, prompt);

        // 保存報告
        const reportPath = path.join(this.projectPath, "test-report.md");
        await fs.writeFile(reportPath, reportContent);
        
        console.log(`✅ 測試報告已保存到: ${reportPath}`);

        return reportContent;
    }

    /**
     * 完整的自動化測試流程
     */
    async runFullTestCycle(componentPaths: string[]) {
        console.log("\n" + "=".repeat(80));
        console.log("🚀 啟動完整自動化測試流程");
        console.log("=".repeat(80));

        try {
            // 步驟 1: 生成測試
            console.log("\n[步驟 1/5] 生成測試代碼...");
            for (const componentPath of componentPaths) {
                await this.generateTests(componentPath, "unit");
            }

            // 步驟 2: 執行測試
            console.log("\n[步驟 2/5] 執行測試套件...");
            let report = await this.runTests();
            
            // 顯示初始結果
            this.displayTestSummary(report);

            // 步驟 3: 修復失敗的測試
            if (report.failed > 0) {
                console.log("\n[步驟 3/5] 修復失敗的測試...");
                await this.fixFailedTests(report);

                // 步驟 4: 重新執行測試
                console.log("\n[步驟 4/5] 重新執行測試...");
                report = await this.runTests();
                this.displayTestSummary(report);
            } else {
                console.log("\n[步驟 3/5] 跳過 - 所有測試通過 ✅");
                console.log("[步驟 4/5] 跳過 - 無需重新測試");
            }

            // 步驟 5: 生成報告
            console.log("\n[步驟 5/5] 生成測試報告...");
            const reportContent = await this.generateTestReport(report);

            console.log("\n" + "=".repeat(80));
            console.log("✅ 自動化測試流程完成!");
            console.log("=".repeat(80));

            return {
                success: report.failed === 0,
                report: reportContent,
                stats: report
            };

        } catch (error) {
            console.error("\n❌ 測試流程失敗:", error);
            throw error;
        }
    }

    /**
     * 顯示測試摘要
     */
    private displayTestSummary(report: TestReport) {
        console.log("\n" + "-".repeat(80));
        console.log("📊 測試結果摘要");
        console.log("-".repeat(80));
        console.log(`總測試數: ${report.totalTests}`);
        console.log(`✅ 通過: ${report.passed} (${((report.passed / report.totalTests) * 100).toFixed(1)}%)`);
        console.log(`❌ 失敗: ${report.failed} (${((report.failed / report.totalTests) * 100).toFixed(1)}%)`);
        console.log(`⏭️  跳過: ${report.skipped}`);
        console.log(`⏱️  執行時間: ${(report.duration / 1000).toFixed(2)}秒`);
        
        if (report.coverage) {
            console.log("\n📈 代碼覆蓋率:");
            console.log(`   行: ${report.coverage.lines.toFixed(2)}%`);
            console.log(`   函數: ${report.coverage.functions.toFixed(2)}%`);
            console.log(`   分支: ${report.coverage.branches.toFixed(2)}%`);
            console.log(`   語句: ${report.coverage.statements.toFixed(2)}%`);
        }
        console.log("-".repeat(80));
    }

    /**
     * 輔助方法: 發送訊息並等待完成
     */
    private async sendAndWait(session: any, prompt: string): Promise<string> {
        return new Promise((resolve, reject) => {
            let result = "";
            let hasError = false;

            const timeout = setTimeout(() => {
                reject(new Error("操作超時"));
            }, 600000); // 10 分鐘超時

            session.on((event: SessionEvent) => {
                if (event.type === "assistant.message") {
                    result = event.data.content || "";
                } else if (event.type === "error") {
                    hasError = true;
                    clearTimeout(timeout);
                    reject(new Error(event.data.message || "執行錯誤"));
                } else if (event.type === "session.idle") {
                    clearTimeout(timeout);
                    if (!hasError) {
                        resolve(result);
                    }
                }
            });

            session.send({ prompt }).catch(reject);
        });
    }

    async cleanup() {
        await this.testGeneratorSession?.destroy();
        await this.testRunnerSession?.destroy();
        await this.testFixerSession?.destroy();
        await this.client.stop();
        console.log("✅ 資源清理完成");
    }
}

// ============================================================================
// 主程式 - 使用範例
// ============================================================================

async function main() {
    // 設定 Next.js 專案路徑
    const projectPath = process.argv[2] || "./my-nextjs-app";
    
    const testAutomation = new NextJsTestAutomation(projectPath);

    try {
        await testAutomation.initialize();

        // 定義要測試的組件
        const componentsToTest = [
            "src/components/LoginForm.tsx",
            "src/components/Dashboard.tsx",
            "src/app/api/users/route.ts"
        ];

        // 執行完整測試流程
        const result = await testAutomation.runFullTestCycle(componentsToTest);

        if (result.success) {
            console.log("\n🎉 所有測試通過!");
        } else {
            console.log("\n⚠️  仍有測試失敗,請查看報告");
            process.exit(1);
        }

    } catch (error) {
        console.error("❌ 錯誤:", error);
        process.exit(1);
    } finally {
        await testAutomation.cleanup();
    }
}

// 執行主程式
if (require.main === module) {
    main().catch(console.error);
}

export { NextJsTestAutomation, TestReport, TestResult };
