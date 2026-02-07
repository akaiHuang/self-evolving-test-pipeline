/**
 * 行銷情報多代理協作範例
 *
 * 目的: 輸入品牌/產品/目標, 由多代理輸出:
 * - 目標客群與定位
 * - 有效資料定義與來源建議
 * - 合規/風險與 robots 策略
 * - 可執行的 pipeline 指令與設定建議
 */

import { CopilotClient, CustomAgentConfig, SessionEvent } from "@github/copilot-sdk";
import * as fs from "fs/promises";
import * as path from "path";

type AgentOutput = {
    name: string;
    raw: string;
    json?: Record<string, unknown>;
};

const strategistAgent: CustomAgentConfig = {
    name: "marketing-strategist",
    displayName: "行銷策略師",
    description: "輸出定位、受眾、主張與 KPI",
    prompt: `你是資深行銷策略師,請以 JSON 回答。
鍵: icp, positioning, key_messages, objections, kpis, assumptions。
要求: 不臆測未公開資訊, 僅給可驗證或可收集的假設。`,
    tools: ["view", "search"],
    infer: true
};

const dataAnalystAgent: CustomAgentConfig = {
    name: "data-analyst",
    displayName: "資料分析師",
    description: "定義有效資料與關鍵訊號",
    prompt: `你是資料分析師,請以 JSON 回答。
鍵: data_types, signals, query_keywords, platform_categories, avoid_sources。
要求: 可直接轉為資料收集與文案依據。`,
    tools: ["view", "search"],
    infer: true
};

const complianceAgent: CustomAgentConfig = {
    name: "compliance-analyst",
    displayName: "合規風險顧問",
    description: "提供合規/robots 與風險建議",
    prompt: `你是合規風險顧問,請以 JSON 回答。
鍵: allow_domains, deny_domains, robots_policy, legal_notes, risk_flags。
要求: 僅建議公開且允許抓取的來源類型。`,
    tools: ["view", "search"],
    infer: true
};

const opsAgent: CustomAgentConfig = {
    name: "ops-planner",
    displayName: "自動化規劃師",
    description: "輸出可執行的 pipeline 指令與設定建議",
    prompt: `你是自動化規劃師,請以 JSON 回答。
鍵: pipeline_steps, commands, env_suggestions, output_artifacts。
要求: 命令僅示範, 不要真的執行。`,
    tools: ["view", "search"],
    infer: true
};

function extractJson(text: string): Record<string, unknown> | undefined {
    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        // Try to extract first JSON object
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return undefined;
        try {
            return JSON.parse(match[0]) as Record<string, unknown>;
        } catch {
            return undefined;
        }
    }
}

async function runAgent(session: any, prompt: string, name: string): Promise<AgentOutput> {
    let output = "";
    const done = new Promise<void>((resolve) => {
        session.on((event: SessionEvent) => {
            if (event.type === "assistant.message") {
                output += `${event.data.content}\n`;
            }
            if (event.type === "session.idle") {
                resolve();
            }
        });
    });

    await session.send({ prompt });
    await done;

    return {
        name,
        raw: output.trim(),
        json: extractJson(output)
    };
}

async function main() {
    const args = process.argv.slice(2);
    const briefIndex = args.indexOf("--brief");
    const briefFileIndex = args.indexOf("--brief-file");
    const outIndex = args.indexOf("--output");

    let brief = "";
    if (briefIndex >= 0 && args[briefIndex + 1]) {
        brief = args[briefIndex + 1];
    }
    if (!brief && briefFileIndex >= 0 && args[briefFileIndex + 1]) {
        const filePath = args[briefFileIndex + 1];
        brief = await fs.readFile(filePath, "utf-8");
    }

    if (!brief) {
        console.log("Usage: npx tsx examples/marketing-intel-orchestrator.ts --brief \"...\" [--output ./marketing-plan.json]");
        process.exit(1);
    }

    const outputPath = outIndex >= 0 && args[outIndex + 1]
        ? args[outIndex + 1]
        : "./marketing-plan.json";

    const client = new CopilotClient();
    await client.start();

    const strategistSession = await client.createSession({
        sessionId: "marketing-strategist",
        customAgents: [strategistAgent],
        model: "gpt-4.1"
    });

    const dataSession = await client.createSession({
        sessionId: "data-analyst",
        customAgents: [dataAnalystAgent],
        model: "gpt-4.1"
    });

    const complianceSession = await client.createSession({
        sessionId: "compliance-analyst",
        customAgents: [complianceAgent],
        model: "gpt-4.1"
    });

    const opsSession = await client.createSession({
        sessionId: "ops-planner",
        customAgents: [opsAgent],
        model: "gpt-4.1"
    });

    const promptBase = `需求簡述:
${brief}

請輸出可直接用於行銷資料收集與策略的建議。`;

    const [strategist, data, compliance, ops] = await Promise.all([
        runAgent(strategistSession, promptBase, "strategist"),
        runAgent(dataSession, promptBase, "data_analyst"),
        runAgent(complianceSession, promptBase, "compliance"),
        runAgent(opsSession, promptBase, "ops")
    ]);

    const report = {
        generated_at: new Date().toISOString(),
        brief,
        results: [strategist, data, compliance, ops]
    };

    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));

    const mdPath = outputPath.replace(path.extname(outputPath), ".md");
    const md = [
        "# Marketing Intelligence Plan",
        "",
        "## Brief",
        brief,
        "",
        "## Strategist",
        strategist.raw || "(no output)",
        "",
        "## Data Analyst",
        data.raw || "(no output)",
        "",
        "## Compliance",
        compliance.raw || "(no output)",
        "",
        "## Ops",
        ops.raw || "(no output)",
        ""
    ].join("\n");
    await fs.writeFile(mdPath, md);

    await strategistSession.destroy();
    await dataSession.destroy();
    await complianceSession.destroy();
    await opsSession.destroy();
    await client.stop();

    console.log(`✅ 已產出: ${outputPath} & ${mdPath}`);
}

main().catch((error) => {
    console.error("❌ 執行失敗:", error);
    process.exit(1);
});
