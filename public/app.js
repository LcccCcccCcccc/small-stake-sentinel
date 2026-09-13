const form = document.querySelector("#opportunityForm");
const button = form.querySelector("button");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const opportunity = {
    name: data.get("name"),
    inputCost: Number(data.get("inputCost")),
    expectedRevenue: Number(data.get("expectedRevenue")),
    platformFees: Number(data.get("platformFees")),
    shipping: Number(data.get("shipping")),
    successProbability: Number(data.get("successProbability")),
    refundProbability: Number(data.get("refundProbability")),
    hasVerifiableBuyer: data.has("hasVerifiableBuyer"),
    requiresAdvanceFee: data.has("requiresAdvanceFee"),
    externalCommitment: data.has("externalCommitment"),
    policyRisk: "low"
  };

  button.disabled = true;
  button.innerHTML = "正在核验…";
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bankroll: 100, opportunity, searchQuery: data.get("searchQuery") })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "分析失败");
    render(result);
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = "运行证据与风险审查 <span>→</span>";
  }
});

function money(value) {
  return `¥${Number(value).toFixed(2)}`;
}

function render(result) {
  document.querySelector("#idle").hidden = true;
  document.querySelector("#results").hidden = false;
  const policy = result.policyResult;
  const verdict = document.querySelector("#verdict");
  verdict.textContent = policy.verdict;
  verdict.dataset.kind = policy.verdict;
  document.querySelector("#netSuccess").textContent = money(policy.netIfSuccess);
  document.querySelector("#expectedNet").textContent = money(policy.expectedNet);
  document.querySelector("#maxLoss").textContent = money(policy.maxCashLoss);
  document.querySelector("#exposure").textContent = `${policy.capitalExposurePct}%`;
  document.querySelector("#gateState").textContent = result.approvalGate.state;
  document.querySelector("#gateReason").textContent = result.approvalGate.reason;
  document.querySelector("#summary").textContent = result.narrative.summary;
  document.querySelector("#evidence").textContent = result.narrative.evidence_assessment;
  const risks = [...policy.hardStops, ...(result.narrative.risks || [])];
  document.querySelector("#risks").innerHTML = [...new Set(risks)].map((risk) => `<li>${escapeHtml(risk)}</li>`).join("");
  const sourceBlock = document.querySelector("#sourceBlock");
  const sources = document.querySelector("#sources");
  sourceBlock.hidden = result.evidence.length === 0;
  sources.innerHTML = result.evidence.map((item) =>
    `<li><a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><span>${escapeHtml((item.content || "").slice(0, 150))}</span></li>`
  ).join("");
  document.querySelector("#auditLog").textContent = JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: result.mode,
    policy: policy,
    approval_gate: result.approvalGate,
    evidence_urls: result.evidence.map((item) => item.url)
  }, null, 2);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
