import test from "node:test";
import assert from "node:assert/strict";
import { calculateDecision } from "../server.mjs";

test("blocks opportunities that expose too much capital", () => {
  const result = calculateDecision({
    inputCost: 50,
    expectedRevenue: 100,
    successProbability: 80,
    refundProbability: 0,
    hasVerifiableBuyer: true,
    policyRisk: "low"
  }, 100);
  assert.equal(result.verdict, "REJECT");
  assert.match(result.hardStops.join(" "), /35%/);
});

test("requires human approval for any paid candidate", () => {
  const result = calculateDecision({
    inputCost: 10,
    expectedRevenue: 50,
    platformFees: 5,
    successProbability: 70,
    refundProbability: 0,
    hasVerifiableBuyer: true,
    policyRisk: "low"
  }, 100);
  assert.equal(result.verdict, "APPROVE_CANDIDATE");
  assert.equal(result.requiresHumanApproval, true);
});

test("rejects evidence-free opportunities", () => {
  const result = calculateDecision({
    inputCost: 0,
    expectedRevenue: 200,
    successProbability: 90,
    hasVerifiableBuyer: false,
    policyRisk: "low"
  }, 100);
  assert.equal(result.verdict, "REJECT");
  assert.match(result.hardStops.join(" "), /可验证买家/);
});
