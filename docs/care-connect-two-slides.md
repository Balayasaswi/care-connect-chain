# Slide 1: Care Connect Chain - Proposed Architecture

## Problem

- Student mental health support is fragmented across students, guardians, counsellors, and institutions.
- Sensitive conversations need privacy, trust, and tamper-resistant records.

## Solution Overview

- Care Connect Chain unifies support stakeholders in one secure digital care network.
- Hybrid stack: AI-assisted interaction + IPFS storage + optional blockchain proof.

## Core Flow

1. Student interacts through guided chat.
2. Session summary is generated with emotional signal tags.
3. Summary data is stored in IPFS for distributed availability.
4. CID can be anchored on blockchain for integrity verification.
5. Authorized roles view role-specific insights (privacy-preserving access).

## Key Modules

- Role-based auth: Student, Guardian, Counsellor, Institution
- Session and summary engine
- IPFS pinning and retrieval pipeline
- Blockchain CID registry integration
- Institution-level monitoring dashboards

---

# Slide 2: Proposed Algorithm / Methodology

## 1) Context-Aware Retrieval

- Match current user query with session history, emotional context, and role permissions.
- Retrieve only relevant context blocks for response generation.

## 2) Signal Extraction and Scoring

- Parse chat transcripts to extract keywords, urgency cues, and emotional category.
- Compute a wellness trend signal from recency + severity + frequency.

## 3) Role-Based Decision Logic

- Student: supportive conversational response.
- Guardian: summary-level visibility only.
- Counsellor: prioritized risk and intervention cues.
- Institution: anonymized aggregate trend insights.

## 4) Storage and Integrity Pipeline

- Persist session payload and summary to IPFS and obtain CID.
- Append CID reference for immutable traceability.
- Optionally store CID on-chain for proof of integrity.

## 5) Fallback and Escalation

- If confidence is low, route to fallback response strategy.
- If risk threshold is high, trigger counsellor escalation workflow.

## Outcome

- Faster support coordination, privacy-aware access, and verifiable data integrity for mental health workflows.
