# Devpost submission draft

## Project name

Small-Stake Sentinel

## One-line summary

An evidence-backed personal AI agent that protects tiny business bankrolls by separating model reasoning from deterministic spending rules and a mandatory human approval gate.

## Inspiration

People experimenting with side income are routinely shown attractive margins without a verified buyer, current fee data, refund risk, or an exit plan. For a person with only ¥100, one bad prepaid fee or speculative purchase can end the entire experiment. Small-Stake Sentinel treats capital preservation as a first-class product requirement.

## What it does

The user describes a real opportunity and its estimated costs. The system then:

1. retrieves current supporting evidence through Tavily;
2. calculates net profit, probability-weighted return, maximum cash loss, and bankroll exposure;
3. applies deterministic hard stops that the language model cannot override;
4. asks NVIDIA Nemotron on Nebius Token Factory to explain the decision and surface uncertainty;
5. blocks every payment or external commitment until a human explicitly approves it;
6. records a readable audit log containing the policy result, evidence URLs, model mode, and approval state.

## How we built it

The prototype is a zero-dependency Node.js web application. Its policy engine is pure deterministic code with automated tests. Tavily provides time-sensitive source retrieval. NVIDIA Nemotron 3 Super runs through the OpenAI-compatible Nebius Token Factory API and receives only the opportunity, retrieved evidence, and policy output. The browser never receives API keys.

## What makes it different

Most agent demos optimize for taking more actions. Small-Stake Sentinel is intentionally optimized for refusing unsafe actions. The AI can search, compare, and explain, but it cannot silently spend money or rewrite the exposure policy. This makes the agent useful for first-time sellers, students, gig workers, and anyone operating with a bankroll too small to absorb a single bad decision.

## Challenges

- Turning uncertain outcomes into transparent numbers without pretending the estimates are facts.
- Preserving model usefulness while preventing it from overriding safety rules.
- Showing both the evidence and the precise point where automation must stop.

## Accomplishments

- Working end-to-end browser interface.
- Deterministic approval, review, and rejection policy.
- Automated tests for excessive exposure, missing buyers, and paid-action gating.
- Demo mode that can be evaluated without API spend.
- Live adapters for Tavily and Nebius Token Factory.

## What we learned

An autonomous system becomes more trustworthy when it exposes uncertainty, cites current evidence, and treats inaction as a valid outcome. Product-level safety is easier to audit when important controls live outside the probabilistic model.

## What's next

- Add evidence freshness and source-quality scoring.
- Persist a signed decision ledger.
- Compare model recommendations with actual outcomes to recalibrate probability estimates.
- Add multilingual reports and configurable household or small-business risk policies.

## Required disclosure

The project was designed and implemented with AI coding assistance. All third-party services, open-source components, and model usage will be declared in the final submission.
