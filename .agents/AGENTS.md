# AI Agent Customization Rules for SEAL Management System

As an AI Coding Assistant working on this workspace, you must adhere to the following strict guidelines to maintain the integrity of the **System-Level Harness** architecture.

---

## 1. Always Use the System-Level Harness

When creating new AI Agent features (e.g., scoring assistants, chatbots, notification systems) or modifying existing ones, **NEVER** write raw, ad-hoc LLM calls, custom retry logic, or manual JSON parsing. 

You **MUST** wrap and protect all AI logic using the global Harness components located in:
> `server/harness/`

---

## 2. Follow the 6-Layer Harness Contract

When adding any AI capabilities, structure your code according to these 6 layers:

1. **Ràng buộc & Ranh giới (Constraints & Boundaries)**:
   * Prompts must be stored statically in [promptsManager.js](file:///c:/Users/Triet/MyProject/seal-management-system/server/harness/boundaries/promptsManager.js).
   * Enforce file size and token limit checks using `enforceFilePatchBoundary(patchContent)`.

2. **Công cụ thực thi (Execution Tools)**:
   * Register all database or third-party APIs used by the Agent in [toolRegistry.js](file:///c:/Users/Triet/MyProject/seal-management-system/server/harness/gateway/toolRegistry.js) using the `registerTool` function with JSON schema definitions.

3. **Xác minh & Guardrails (Verification & Guardrails)**:
   * Guard inbound prompts using `sanitizePromptString` from [securityGuard.js](file:///c:/Users/Triet/MyProject/seal-management-system/server/harness/guardrails/securityGuard.js).
   * Validate outbound LLM JSON structures against schemas using `validateSchema` from [schemaValidator.js](file:///c:/Users/Triet/MyProject/seal-management-system/server/harness/guardrails/schemaValidator.js).

4. **Quản lý trạng thái (State Management)**:
   * Access long-term memory or session context via [contextStore.js](file:///c:/Users/Triet/MyProject/seal-management-system/server/harness/memory/contextStore.js).

5. **Vòng lặp phản hồi (Feedback Loops)**:
   * Call LLMs through the resilience engine retry loop using `executeWithRetry` and auto-repair corrupted JSON outputs using `autoFixJsonString` from [resilienceEngine.js](file:///c:/Users/Triet/MyProject/seal-management-system/server/harness/feedback/resilienceEngine.js).

6. **Phê duyệt con người & Giám sát (Human Approval & Telemetry)**:
   * Log token usage, latency, and success rates using `recordTelemetry` from [hitlManager.js](file:///c:/Users/Triet/MyProject/seal-management-system/server/harness/telemetry/hitlManager.js).
   * Enforce human-in-the-loop validation using `markForHumanApproval` before publishing critical outputs.

---

## 3. Reference Documentation

For details on how to write code adhering to these rules, read:
* **[SYSTEM_HARNESS_GUIDE.md](file:///c:/Users/Triet/MyProject/seal-management-system/SYSTEM_HARNESS_GUIDE.md)**

---

## 4. UI/UX & Design Constraints

* **NO 3D/Colored Emojis or Icons**: Never use 3D-styled colored emoji/icon assets (such as 📥, 📤, or similar 3D colored emojis) in code or UI. Always use flat, outline, vector-based SVG icons (such as Lucide React icons like `Download`, `Upload`, etc.) to maintain a premium, clean, professional modern developer aesthetic.
