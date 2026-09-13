import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("./public/", import.meta.url));
const PORT = Number(process.env.PORT || 3000);

export function calculateDecision(opportunity, bankroll = 100) {
  const input = Number(opportunity.inputCost || 0);
  const revenue = Number(opportunity.expectedRevenue || 0);
  const fees = Number(opportunity.platformFees || 0);
  const shipping = Number(opportunity.shipping || 0);
  const refundRisk = Math.min(1, Math.max(0, Number(opportunity.refundProbability || 0) / 100));
  const success = Math.min(1, Math.max(0, Number(opportunity.successProbability || 0) / 100));
  const netIfSuccess = revenue - input - fees - shipping;
  const expectedNet = success * netIfSuccess - (1 - success) * input - refundRisk * revenue;
  const exposure = bankroll > 0 ? input / bankroll : 1;
  const hardStops = [];

  if (input > bankroll) hardStops.push("投入超过可用本金");
  if (exposure > 0.35) hardStops.push("单笔本金暴露超过 35%");
  if (opportunity.requiresAdvanceFee) hardStops.push("要求预付报名费、保证金或解冻费");
  if (!opportunity.hasVerifiableBuyer) hardStops.push("缺少可验证买家或付款方");
  if (opportunity.policyRisk === "high") hardStops.push("平台封禁或合规风险过高");

  let verdict = "REJECT";
  if (hardStops.length === 0 && expectedNet > 0 && success >= 0.35) verdict = "REVIEW";
  if (hardStops.length === 0 && expectedNet >= 10 && success >= 0.55 && exposure <= 0.2) verdict = "APPROVE_CANDIDATE";

  return {
    verdict,
    netIfSuccess: round(netIfSuccess),
    expectedNet: round(expectedNet),
    maxCashLoss: round(Math.min(bankroll, input + fees + shipping)),
    capitalExposurePct: round(exposure * 100),
    hardStops,
    requiresHumanApproval: input > 0 || Boolean(opportunity.externalCommitment)
  };
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function searchEvidence(query) {
  if (!process.env.TAVILY_API_KEY || !query) return [];
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      max_results: 5,
      include_answer: false
    })
  });
  if (!response.ok) throw new Error(`Tavily request failed: ${response.status}`);
  const data = await response.json();
  return (data.results || []).map(({ title, url, content, score }) => ({ title, url, content, score }));
}

async function askNebius(opportunity, evidence, policyResult) {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) return demoNarrative(opportunity, evidence, policyResult);

  const model = process.env.NEBIUS_MODEL || "nvidia/nemotron-3-super-120b-a12b";
  const base = process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1";
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are a capital-preservation analyst for tiny business experiments. Explain the deterministic policy result, cite only supplied evidence URLs, surface uncertainty, and never claim that an external action was taken. Return concise JSON with keys summary, evidence_assessment, risks, next_safe_action."
        },
        {
          role: "user",
          content: JSON.stringify({ opportunity, evidence, policyResult })
        }
      ]
    })
  });
  if (!response.ok) throw new Error(`Nebius request failed: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error("Nebius returned no JSON object");
  return JSON.parse(jsonText);
}

function demoNarrative(opportunity, evidence, policyResult) {
  const label = opportunity.name || "该机会";
  return {
    summary: `${label} 的规则引擎结论为 ${policyResult.verdict}。当前运行在演示模式，未调用外部模型。`,
    evidence_assessment: evidence.length
      ? `已检索 ${evidence.length} 条证据，正式模式会逐条核验来源。`
      : "尚未取得外部证据，因此不能把卖价、买家或付款承诺视为已验证事实。",
    risks: policyResult.hardStops.length ? policyResult.hardStops : ["估算概率可能偏差", "成交和退款条件仍需人工确认"],
    next_safe_action: policyResult.requiresHumanApproval
      ? "生成待批准方案，但不要付款、下单或对外承诺。"
      : "继续补充证据并重新计算，不触发任何外部交易。"
  };
}

async function analyze(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  const bankroll = Number(body.bankroll || 100);
  const opportunity = body.opportunity || {};
  const policyResult = calculateDecision(opportunity, bankroll);
  const evidence = await searchEvidence(body.searchQuery || opportunity.name);
  const narrative = await askNebius(opportunity, evidence, policyResult);

  sendJson(response, 200, {
    mode: process.env.NEBIUS_API_KEY ? "live" : "demo",
    bankroll,
    policyResult,
    evidence,
    narrative,
    approvalGate: policyResult.requiresHumanApproval
      ? { state: "BLOCKED", reason: "付款或外部承诺必须由人类明确批准" }
      : { state: "NOT_REQUIRED", reason: "本次分析不产生费用或外部承诺" }
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) return sendJson(response, 403, { error: "Forbidden" });
  try {
    const data = await readFile(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
    response.writeHead(200, { "content-type": `${types[extname(filePath)] || "application/octet-stream"}; charset=utf-8` });
    response.end(data);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if (request.method === "POST" && url.pathname === "/api/analyze") return await analyze(request, response);
      if (request.method === "GET" && url.pathname === "/api/health") return sendJson(response, 200, { ok: true });
      if (request.method === "GET") return await serveStatic(url.pathname, response);
      sendJson(response, 405, { error: "Method not allowed" });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => console.log(`Small-Stake Sentinel listening on http://localhost:${PORT}`));
}
