# Agent Skills for Context Engineering

> 本文档整合了 [Agent-Skills-for-Context-Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) 仓库中的所有技能，用于指导 Cursor 的开发实践。
> 
> **来源仓库**: muratcankoylan/Agent-Skills-for-Context-Engineering  
> **最后更新**: 2025-01-04  
> **技能数量**: 11

---

## 技能索引

| 技能名称 | 触发场景 | 适用场景 |
|---------|---------|---------|
| **context-fundamentals** | "understand context", "explain context windows", "design agent architecture" | 设计新系统、调试上下文问题、优化上下文使用 |
| **context-degradation** | "diagnose context problems", "fix lost-in-middle", "debug agent failures" | 诊断性能下降、处理长上下文、分析上下文失败 |
| **context-compression** | "compress context", "summarize conversation", "reduce token usage" | 会话超限、代码库超限、设计压缩策略 |
| **context-optimization** | "optimize context", "reduce token costs", "implement KV-cache" | 优化成本、减少延迟、扩展有效容量 |
| **multi-agent-patterns** | "design multi-agent system", "implement supervisor pattern" | 单智能体限制、并行任务、多域处理 |
| **memory-systems** | "implement agent memory", "build knowledge graph", "track entities" | 跨会话持久化、实体一致性、知识推理 |
| **tool-design** | "design agent tools", "reduce tool complexity", "implement MCP tools" | 创建工具、调试工具失败、优化工具集 |
| **evaluation** | "evaluate agent performance", "build test framework", "measure quality" | 系统测试、验证上下文工程、质量门控 |
| **advanced-evaluation** | "implement LLM-as-judge", "compare model outputs", "mitigate bias" | 自动化评估、模型比较、评估管道 |
| **project-development** | "start LLM project", "design batch pipeline", "evaluate task-model fit" | 新项目启动、架构设计、成本估算 |
| **bdi-mental-states** | "model agent mental states", "implement BDI architecture", "transform RDF to beliefs" | 认知架构、可解释性、多智能体协调 |

---

## 使用说明

### 何时参考这些技能

- **设计新功能时**: 参考 `project-development` 和 `tool-design`，先分析任务匹配度，再规划架构
- **遇到上下文问题时**: 参考 `context-degradation` 和 `context-optimization` 诊断和优化
- **设计多智能体系统时**: 参考 `multi-agent-patterns` 选择合适架构
- **需要评估系统时**: 参考 `evaluation` 和 `advanced-evaluation` 建立评估框架
- **优化性能时**: 参考 `context-optimization` 和 `context-compression` 减少成本

### 技能学习路径

**基础路径**（推荐顺序）:
1. `context-fundamentals` - 理解上下文基础
2. `context-degradation` - 了解上下文退化模式
3. `tool-design` - 学习工具设计原则
4. `project-development` - 掌握项目开发方法

**进阶路径**:
5. `context-optimization` - 上下文优化技术
6. `context-compression` - 上下文压缩策略
7. `multi-agent-patterns` - 多智能体架构
8. `memory-systems` - 记忆系统设计

**专业路径**:
9. `evaluation` - 评估方法
10. `advanced-evaluation` - 高级评估技术
11. `bdi-mental-states` - BDI 心理状态建模

---


---

## 1. 上下文基础 (context-fundamentals)

# Context Engineering Fundamentals

Context is the complete state available to a language model at inference time. It includes everything the model can attend to when generating responses: system instructions, tool definitions, retrieved documents, message history, and tool outputs. Understanding context fundamentals is prerequisite to effective context engineering.

## When to Activate

Activate this skill when:
- Designing new agent systems or modifying existing architectures
- Debugging unexpected agent behavior that may relate to context
- Optimizing context usage to reduce token costs or improve performance
- Onboarding new team members to context engineering concepts
- Reviewing context-related design decisions

## Core Concepts

Context comprises several distinct components, each with different characteristics and constraints. The attention mechanism creates a finite budget that constrains effective context usage. Progressive disclosure manages this constraint by loading information only as needed. The engineering discipline is curating the smallest high-signal token set that achieves desired outcomes.

## Detailed Topics

### The Anatomy of Context

**System Prompts**
System prompts establish the agent's core identity, constraints, and behavioral guidelines. They are loaded once at session start and typically persist throughout the conversation. System prompts should be extremely clear and use simple, direct language at the right altitude for the agent.

The right altitude balances two failure modes. At one extreme, engineers hardcode complex brittle logic that creates fragility and maintenance burden. At the other extreme, engineers provide vague high-level guidance that fails to give concrete signals for desired outputs or falsely assumes shared context. The optimal altitude strikes a balance: specific enough to guide behavior effectively, yet flexible enough to provide strong heuristics.

Organize prompts into distinct sections using XML tagging or Markdown headers to delineate background information, instructions, tool guidance, and output description. The exact formatting matters less as models become more capable, but structural clarity remains valuable.

**Tool Definitions**
Tool definitions specify the actions an agent can take. Each tool includes a name, description, parameters, and return format. Tool definitions live near the front of context after serialization, typically before or after the system prompt.

Tool descriptions collectively steer agent behavior. Poor descriptions force agents to guess; optimized descriptions include usage context, examples, and defaults. The consolidation principle states that if a human engineer cannot definitively say which tool should be used in a given situation, an agent cannot be expected to do better.

**Retrieved Documents**
Retrieved documents provide domain-specific knowledge, reference materials, or task-relevant information. Agents use retrieval augmented generation to pull relevant documents into context at runtime rather than pre-loading all possible information.

The just-in-time approach maintains lightweight identifiers (file paths, stored queries, web links) and uses these references to load data into context dynamically. This mirrors human cognition: we generally do not memorize entire corpuses of information but rather use external organization and indexing systems to retrieve relevant information on demand.

**Message History**
Message history contains the conversation between the user and agent, including previous queries, responses, and reasoning. For long-running tasks, message history can grow to dominate context usage.

Message history serves as scratchpad memory where agents track progress, maintain task state, and preserve reasoning across turns. Effective management of message history is critical for long-horizon task completion.

**Tool Outputs**
Tool outputs are the results of agent actions: file contents, search results, command execution output, API responses, and similar data. Tool outputs comprise the majority of tokens in typical agent trajectories, with research showing observations (tool outputs) can reach 83.9% of total context usage.

Tool outputs consume context whether they are relevant to current decisions or not. This creates pressure for strategies like observation masking, compaction, and selective tool result retention.

### Context Windows and Attention Mechanics

**The Attention Budget Constraint**
Language models process tokens through attention mechanisms that create pairwise relationships between all tokens in context. For n tokens, this creates n² relationships that must be computed and stored. As context length increases, the model's ability to capture these relationships gets stretched thin.

Models develop attention patterns from training data distributions where shorter sequences predominate. This means models have less experience with and fewer specialized parameters for context-wide dependencies. The result is an "attention budget" that depletes as context grows.

**Position Encoding and Context Extension**
Position encoding interpolation allows models to handle longer sequences by adapting them to originally trained smaller contexts. However, this adaptation introduces degradation in token position understanding. Models remain highly capable at longer contexts but show reduced precision for information retrieval and long-range reasoning compared to performance on shorter contexts.

**The Progressive Disclosure Principle**
Progressive disclosure manages context efficiently by loading information only as needed. At startup, agents load only skill names and descriptions—sufficient to know when a skill might be relevant. Full content loads only when a skill is activated for specific tasks.

This approach keeps agents fast while giving them access to more context on demand. The principle applies at multiple levels: skill selection, document loading, and even tool result retrieval.

### Context Quality Versus Context Quantity

The assumption that larger context windows solve memory problems has been empirically debunked. Context engineering means finding the smallest possible set of high-signal tokens that maximize the likelihood of desired outcomes.

Several factors create pressure for context efficiency. Processing cost grows disproportionately with context length—not just double the cost for double the tokens, but exponentially more in time and computing resources. Model performance degrades beyond certain context lengths even when the window technically supports more tokens. Long inputs remain expensive even with prefix caching.

The guiding principle is informativity over exhaustiveness. Include what matters for the decision at hand, exclude what does not, and design systems that can access additional information on demand.

### Context as Finite Resource

Context must be treated as a finite resource with diminishing marginal returns. Like humans with limited working memory, language models have an attention budget drawn on when parsing large volumes of context.

Every new token introduced depletes this budget by some amount. This creates the need for careful curation of available tokens. The engineering problem is optimizing utility against inherent constraints.

Context engineering is iterative and the curation phase happens each time you decide what to pass to the model. It is not a one-time prompt writing exercise but an ongoing discipline of context management.

## Practical Guidance

### File-System-Based Access

Agents with filesystem access can use progressive disclosure naturally. Store reference materials, documentation, and data externally. Load files only when needed using standard filesystem operations. This pattern avoids stuffing context with information that may not be relevant.

The file system itself provides structure that agents can navigate. File sizes suggest complexity; naming conventions hint at purpose; timestamps serve as proxies for relevance. Metadata of file references provides a mechanism to efficiently refine behavior.

### Hybrid Strategies

The most effective agents employ hybrid strategies. Pre-load some context for speed (like CLAUDE.md files or project rules), but enable autonomous exploration for additional context as needed. The decision boundary depends on task characteristics and context dynamics.

For contexts with less dynamic content, pre-loading more upfront makes sense. For rapidly changing or highly specific information, just-in-time loading avoids stale context.

### Context Budgeting

Design with explicit context budgets in mind. Know the effective context limit for your model and task. Monitor context usage during development. Implement compaction triggers at appropriate thresholds. Design systems assuming context will degrade rather than hoping it will not.

Effective context budgeting requires understanding not just raw token counts but also attention distribution patterns. The middle of context receives less attention than the beginning and end. Place critical information at attention-favored positions.

## Examples

**Example 1: Organizing System Prompts**
```markdown
<BACKGROUND_INFORMATION>
You are a Python expert helping a development team.
Current project: Data processing pipeline in Python 3.9+
</BACKGROUND_INFORMATION>

<INSTRUCTIONS>
- Write clean, idiomatic Python code
- Include type hints for function signatures
- Add docstrings for public functions
- Follow PEP 8 style guidelines
</INSTRUCTIONS>

<TOOL_GUIDANCE>
Use bash for shell operations, python for code tasks.
File operations should use pathlib for cross-platform compatibility.
</TOOL_GUIDANCE>

<OUTPUT_DESCRIPTION>
Provide code blocks with syntax highlighting.
Explain non-obvious decisions in comments.
</OUTPUT_DESCRIPTION>
```

**Example 2: Progressive Document Loading**
```markdown
# Instead of loading all documentation at once:

# Step 1: Load summary
docs/api_summary.md          # Lightweight overview

# Step 2: Load specific section as needed
docs/api/endpoints.md        # Only when API calls needed
docs/api/authentication.md   # Only when auth context needed
```

## Guidelines

1. Treat context as a finite resource with diminishing returns
2. Place critical information at attention-favored positions (beginning and end)
3. Use progressive disclosure to defer loading until needed
4. Organize system prompts with clear section boundaries
5. Monitor context usage during development
6. Implement compaction triggers at 70-80% utilization
7. Design for context degradation rather than hoping to avoid it
8. Prefer smaller high-signal context over larger low-signal context

## Integration

This skill provides foundational context that all other skills build upon. It should be studied first before exploring:

- context-degradation - Understanding how context fails
- context-optimization - Techniques for extending context capacity
- multi-agent-patterns - How context isolation enables multi-agent systems
- tool-design - How tool definitions interact with context

## References

Internal reference:
- [Context Components Reference](./references/context-components.md) - Detailed technical reference

Related skills in this collection:
- context-degradation - Understanding context failure patterns
- context-optimization - Techniques for efficient context use

External resources:
- Research on transformer attention mechanisms
- Production engineering guides from leading AI labs
- Framework documentation on context window management

---

## Skill Metadata

**Created**: 2025-12-20
**Last Updated**: 2025-12-20
**Author**: Agent Skills for Context Engineering Contributors
**Version**: 1.0.0


---

## 2. 上下文退化 (context-degradation)

# Context Degradation Patterns

Language models exhibit predictable degradation patterns as context length increases. Understanding these patterns is essential for diagnosing failures and designing resilient systems. Context degradation is not a binary state but a continuum of performance degradation that manifests in several distinct ways.

## When to Activate

Activate this skill when:
- Agent performance degrades unexpectedly during long conversations
- Debugging cases where agents produce incorrect or irrelevant outputs
- Designing systems that must handle large contexts reliably
- Evaluating context engineering choices for production systems
- Investigating "lost in middle" phenomena in agent outputs
- Analyzing context-related failures in agent behavior

## Core Concepts

Context degradation manifests through several distinct patterns. The lost-in-middle phenomenon causes information in the center of context to receive less attention. Context poisoning occurs when errors compound through repeated reference. Context distraction happens when irrelevant information overwhelms relevant content. Context confusion arises when the model cannot determine which context applies. Context clash develops when accumulated information directly conflicts.

These patterns are predictable and can be mitigated through architectural patterns like compaction, masking, partitioning, and isolation.

## Detailed Topics

### The Lost-in-Middle Phenomenon

The most well-documented degradation pattern is the "lost-in-middle" effect, where models demonstrate U-shaped attention curves. Information at the beginning and end of context receives reliable attention, while information buried in the middle suffers from dramatically reduced recall accuracy.

**Empirical Evidence**
Research demonstrates that relevant information placed in the middle of context experiences 10-40% lower recall accuracy compared to the same information at the beginning or end. This is not a failure of the model but a consequence of attention mechanics and training data distributions.

Models allocate massive attention to the first token (often the BOS token) to stabilize internal states. This creates an "attention sink" that soaks up attention budget. As context grows, the limited budget is stretched thinner, and middle tokens fail to garner sufficient attention weight for reliable retrieval.

**Practical Implications**
Design context placement with attention patterns in mind. Place critical information at the beginning or end of context. Consider whether information will be queried directly or needs to support reasoning—if the latter, placement matters less but overall signal quality matters more.

For long documents or conversations, use summary structures that surface key information at attention-favored positions. Use explicit section headers and transitions to help models navigate structure.

### Context Poisoning

Context poisoning occurs when hallucinations, errors, or incorrect information enters context and compounds through repeated reference. Once poisoned, context creates feedback loops that reinforce incorrect beliefs.

**How Poisoning Occurs**
Poisoning typically enters through three pathways. First, tool outputs may contain errors or unexpected formats that models accept as ground truth. Second, retrieved documents may contain incorrect or outdated information that models incorporate into reasoning. Third, model-generated summaries or intermediate outputs may introduce hallucinations that persist in context.

The compounding effect is severe. If an agent's goals section becomes poisoned, it develops strategies that take substantial effort to undo. Each subsequent decision references the poisoned content, reinforcing incorrect assumptions.

**Detection and Recovery**
Watch for symptoms including degraded output quality on tasks that previously succeeded, tool misalignment where agents call wrong tools or parameters, and hallucinations that persist despite correction attempts. When these symptoms appear, consider context poisoning.

Recovery requires removing or replacing poisoned content. This may involve truncating context to before the poisoning point, explicitly noting the poisoning in context and asking for re-evaluation, or restarting with clean context and preserving only verified information.

### Context Distraction

Context distraction emerges when context grows so long that models over-focus on provided information at the expense of their training knowledge. The model attends to everything in context regardless of relevance, and this creates pressure to use provided information even when internal knowledge is more accurate.

**The Distractor Effect**
Research shows that even a single irrelevant document in context reduces performance on tasks involving relevant documents. Multiple distractors compound degradation. The effect is not about noise in absolute terms but about attention allocation—irrelevant information competes with relevant information for limited attention budget.

Models do not have a mechanism to "skip" irrelevant context. They must attend to everything provided, and this obligation creates distraction even when the irrelevant information is clearly not useful.

**Mitigation Strategies**
Mitigate distraction through careful curation of what enters context. Apply relevance filtering before loading retrieved documents. Use namespacing and organization to make irrelevant sections easy to ignore structurally. Consider whether information truly needs to be in context or can be accessed through tool calls instead.

### Context Confusion

Context confusion arises when irrelevant information influences responses in ways that degrade quality. This is related to distraction but distinct—confusion concerns the influence of context on model behavior rather than attention allocation.

If you put something in context, the model has to pay attention to it. The model may incorporate irrelevant information, use inappropriate tool definitions, or apply constraints that came from different contexts. Confusion is especially problematic when context contains multiple task types or when switching between tasks within a single session.

**Signs of Confusion**
Watch for responses that address the wrong aspect of a query, tool calls that seem appropriate for a different task, or outputs that mix requirements from multiple sources. These indicate confusion about what context applies to the current situation.

**Architectural Solutions**
Architectural solutions include explicit task segmentation where different tasks get different context windows, clear transitions between task contexts, and state management that isolates context for different objectives.

### Context Clash

Context clash develops when accumulated information directly conflicts, creating contradictory guidance that derails reasoning. This differs from poisoning where one piece of information is incorrect—in clash, multiple correct pieces of information contradict each other.

**Sources of Clash**
Clash commonly arises from multi-source retrieval where different sources have contradictory information, version conflicts where outdated and current information both appear in context, and perspective conflicts where different viewpoints are valid but incompatible.

**Resolution Approaches**
Resolution approaches include explicit conflict marking that identifies contradictions and requests clarification, priority rules that establish which source takes precedence, and version filtering that excludes outdated information from context.

### Empirical Benchmarks and Thresholds

Research provides concrete data on degradation patterns that inform design decisions.

**RULER Benchmark Findings**
The RULER benchmark delivers sobering findings: only 50% of models claiming 32K+ context maintain satisfactory performance at 32K tokens. GPT-5.2 shows the least degradation among current models, while many still drop 30+ points at extended contexts. Near-perfect scores on simple needle-in-haystack tests do not translate to real long-context understanding.

**Model-Specific Degradation Thresholds**
| Model | Degradation Onset | Severe Degradation | Notes |
|-------|-------------------|-------------------|-------|
| GPT-5.2 | ~64K tokens | ~200K tokens | Best overall degradation resistance with thinking mode |
| Claude Opus 4.5 | ~100K tokens | ~180K tokens | 200K context window, strong attention management |
| Claude Sonnet 4.5 | ~80K tokens | ~150K tokens | Optimized for agents and coding tasks |
| Gemini 3 Pro | ~500K tokens | ~800K tokens | 1M context window, native multimodality |
| Gemini 3 Flash | ~300K tokens | ~600K tokens | 3x speed of Gemini 2.5, 81.2% MMMU-Pro |

**Model-Specific Behavior Patterns**
Different models exhibit distinct failure modes under context pressure:

- **Claude 4.5 series**: Lowest hallucination rates with calibrated uncertainty. Claude Opus 4.5 achieves 80.9% on SWE-bench Verified. Tends to refuse or ask clarification rather than fabricate.
- **GPT-5.2**: Two modes available - instant (fast) and thinking (reasoning). Thinking mode reduces hallucination through step-by-step verification but increases latency.
- **Gemini 3 Pro/Flash**: Native multimodality with 1M context window. Gemini 3 Flash offers 3x speed improvement over previous generation. Strong at multi-modal reasoning across text, code, images, audio, and video.

These patterns inform model selection for different use cases. High-stakes tasks benefit from Claude 4.5's conservative approach or GPT-5.2's thinking mode; speed-critical tasks may use instant modes.

### Counterintuitive Findings

Research reveals several counterintuitive patterns that challenge assumptions about context management.

**Shuffled Haystacks Outperform Coherent Ones**
Studies found that shuffled (incoherent) haystacks produce better performance than logically coherent ones. This suggests that coherent context may create false associations that confuse retrieval, while incoherent context forces models to rely on exact matching.

**Single Distractors Have Outsized Impact**
Even a single irrelevant document reduces performance significantly. The effect is not proportional to the amount of noise but follows a step function where the presence of any distractor triggers degradation.

**Needle-Question Similarity Correlation**
Lower similarity between needle and question pairs shows faster degradation with context length. Tasks requiring inference across dissimilar content are particularly vulnerable.

### When Larger Contexts Hurt

Larger context windows do not uniformly improve performance. In many cases, larger contexts create new problems that outweigh benefits.

**Performance Degradation Curves**
Models exhibit non-linear degradation with context length. Performance remains stable up to a threshold, then degrades rapidly. The threshold varies by model and task complexity. For many models, meaningful degradation begins around 8,000-16,000 tokens even when context windows support much larger sizes.

**Cost Implications**
Processing cost grows disproportionately with context length. The cost to process a 400K token context is not double the cost of 200K—it increases exponentially in both time and computing resources. For many applications, this makes large-context processing economically impractical.

**Cognitive Load Metaphor**
Even with an infinite context, asking a single model to maintain consistent quality across dozens of independent tasks creates a cognitive bottleneck. The model must constantly switch context between items, maintain a comparative framework, and ensure stylistic consistency. This is not a problem that more context solves.

## Practical Guidance

### The Four-Bucket Approach

Four strategies address different aspects of context degradation:

**Write**: Save context outside the window using scratchpads, file systems, or external storage. This keeps active context lean while preserving information access.

**Select**: Pull relevant context into the window through retrieval, filtering, and prioritization. This addresses distraction by excluding irrelevant information.

**Compress**: Reduce tokens while preserving information through summarization, abstraction, and observation masking. This extends effective context capacity.

**Isolate**: Split context across sub-agents or sessions to prevent any single context from growing large enough to degrade. This is the most aggressive strategy but often the most effective.

### Architectural Patterns

Implement these strategies through specific architectural patterns. Use just-in-time context loading to retrieve information only when needed. Use observation masking to replace verbose tool outputs with compact references. Use sub-agent architectures to isolate context for different tasks. Use compaction to summarize growing context before it exceeds limits.

## Examples

**Example 1: Detecting Degradation**
```yaml
# Context grows during long conversation
turn_1: 1000 tokens
turn_5: 8000 tokens
turn_10: 25000 tokens
turn_20: 60000 tokens (degradation begins)
turn_30: 90000 tokens (significant degradation)
```

**Example 2: Mitigating Lost-in-Middle**
```markdown
# Organize context with critical info at edges

[CURRENT TASK]                      # At start
- Goal: Generate quarterly report
- Deadline: End of week

[DETAILED CONTEXT]                  # Middle (less attention)
- 50 pages of data
- Multiple analysis sections
- Supporting evidence

[KEY FINDINGS]                     # At end
- Revenue up 15%
- Costs down 8%
- Growth in Region A
```

## Guidelines

1. Monitor context length and performance correlation during development
2. Place critical information at beginning or end of context
3. Implement compaction triggers before degradation becomes severe
4. Validate retrieved documents for accuracy before adding to context
5. Use versioning to prevent outdated information from causing clash
6. Segment tasks to prevent context confusion across different objectives
7. Design for graceful degradation rather than assuming perfect conditions
8. Test with progressively larger contexts to find degradation thresholds

## Integration

This skill builds on context-fundamentals and should be studied after understanding basic context concepts. It connects to:

- context-optimization - Techniques for mitigating degradation
- multi-agent-patterns - Using isolation to prevent degradation
- evaluation - Measuring and detecting degradation in production

## References

Internal reference:
- [Degradation Patterns Reference](./references/patterns.md) - Detailed technical reference

Related skills in this collection:
- context-fundamentals - Context basics
- context-optimization - Mitigation techniques
- evaluation - Detection and measurement

External resources:
- Research on attention mechanisms and context window limitations
- Studies on the "lost-in-middle" phenomenon
- Production engineering guides from AI labs

---

## Skill Metadata

**Created**: 2025-12-20
**Last Updated**: 2025-12-20
**Author**: Agent Skills for Context Engineering Contributors
**Version**: 1.0.0


---

## 3. 上下文压缩 (context-compression)

# Context Compression Strategies

When agent sessions generate millions of tokens of conversation history, compression becomes mandatory. The naive approach is aggressive compression to minimize tokens per request. The correct optimization target is tokens per task: total tokens consumed to complete a task, including re-fetching costs when compression loses critical information.

## When to Activate

Activate this skill when:
- Agent sessions exceed context window limits
- Codebases exceed context windows (5M+ token systems)
- Designing conversation summarization strategies
- Debugging cases where agents "forget" what files they modified
- Building evaluation frameworks for compression quality

## Core Concepts

Context compression trades token savings against information loss. Three production-ready approaches exist:

1. **Anchored Iterative Summarization**: Maintain structured, persistent summaries with explicit sections for session intent, file modifications, decisions, and next steps. When compression triggers, summarize only the newly-truncated span and merge with the existing summary. Structure forces preservation by dedicating sections to specific information types.

2. **Opaque Compression**: Produce compressed representations optimized for reconstruction fidelity. Achieves highest compression ratios (99%+) but sacrifices interpretability. Cannot verify what was preserved.

3. **Regenerative Full Summary**: Generate detailed structured summaries on each compression. Produces readable output but may lose details across repeated compression cycles due to full regeneration rather than incremental merging.

The critical insight: structure forces preservation. Dedicated sections act as checklists that the summarizer must populate, preventing silent information drift.

## Detailed Topics

### Why Tokens-Per-Task Matters

Traditional compression metrics target tokens-per-request. This is the wrong optimization. When compression loses critical details like file paths or error messages, the agent must re-fetch information, re-explore approaches, and waste tokens recovering context.

The right metric is tokens-per-task: total tokens consumed from task start to completion. A compression strategy saving 0.5% more tokens but causing 20% more re-fetching costs more overall.

### The Artifact Trail Problem

Artifact trail integrity is the weakest dimension across all compression methods, scoring 2.2-2.5 out of 5.0 in evaluations. Even structured summarization with explicit file sections struggles to maintain complete file tracking across long sessions.

Coding agents need to know:
- Which files were created
- Which files were modified and what changed
- Which files were read but not changed
- Function names, variable names, error messages

This problem likely requires specialized handling beyond general summarization: a separate artifact index or explicit file-state tracking in agent scaffolding.

### Structured Summary Sections

Effective structured summaries include explicit sections:

```markdown
## Session Intent
[What the user is trying to accomplish]

## Files Modified
- auth.controller.ts: Fixed JWT token generation
- config/redis.ts: Updated connection pooling
- tests/auth.test.ts: Added mock setup for new config

## Decisions Made
- Using Redis connection pool instead of per-request connections
- Retry logic with exponential backoff for transient failures

## Current State
- 14 tests passing, 2 failing
- Remaining: mock setup for session service tests

## Next Steps
1. Fix remaining test failures
2. Run full test suite
3. Update documentation
```

This structure prevents silent loss of file paths or decisions because each section must be explicitly addressed.

### Compression Trigger Strategies

When to trigger compression matters as much as how to compress:

| Strategy | Trigger Point | Trade-off |
|----------|---------------|-----------|
| Fixed threshold | 70-80% context utilization | Simple but may compress too early |
| Sliding window | Keep last N turns + summary | Predictable context size |
| Importance-based | Compress low-relevance sections first | Complex but preserves signal |
| Task-boundary | Compress at logical task completions | Clean summaries but unpredictable timing |

The sliding window approach with structured summaries provides the best balance of predictability and quality for most coding agent use cases.

### Probe-Based Evaluation

Traditional metrics like ROUGE or embedding similarity fail to capture functional compression quality. A summary may score high on lexical overlap while missing the one file path the agent needs.

Probe-based evaluation directly measures functional quality by asking questions after compression:

| Probe Type | What It Tests | Example Question |
|------------|---------------|------------------|
| Recall | Factual retention | "What was the original error message?" |
| Artifact | File tracking | "Which files have we modified?" |
| Continuation | Task planning | "What should we do next?" |
| Decision | Reasoning chain | "What did we decide about the Redis issue?" |

If compression preserved the right information, the agent answers correctly. If not, it guesses or hallucinates.

### Evaluation Dimensions

Six dimensions capture compression quality for coding agents:

1. **Accuracy**: Are technical details correct? File paths, function names, error codes.
2. **Context Awareness**: Does the response reflect current conversation state?
3. **Artifact Trail**: Does the agent know which files were read or modified?
4. **Completeness**: Does the response address all parts of the question?
5. **Continuity**: Can work continue without re-fetching information?
6. **Instruction Following**: Does the response respect stated constraints?

Accuracy shows the largest variation between compression methods (0.6 point gap). Artifact trail is universally weak (2.2-2.5 range).

## Practical Guidance

### Three-Phase Compression Workflow

For large codebases or agent systems exceeding context windows, apply compression through three phases:

1. **Research Phase**: Produce a research document from architecture diagrams, documentation, and key interfaces. Compress exploration into a structured analysis of components and dependencies. Output: single research document.

2. **Planning Phase**: Convert research into implementation specification with function signatures, type definitions, and data flow. A 5M token codebase compresses to approximately 2,000 words of specification.

3. **Implementation Phase**: Execute against the specification. Context remains focused on the spec rather than raw codebase exploration.

### Using Example Artifacts as Seeds

When provided with a manual migration example or reference PR, use it as a template to understand the target pattern. The example reveals constraints that static analysis cannot surface: which invariants must hold, which services break on changes, and what a clean migration looks like.

This is particularly important when the agent cannot distinguish essential complexity (business requirements) from accidental complexity (legacy workarounds). The example artifact encodes that distinction.

### Implementing Anchored Iterative Summarization

1. Define explicit summary sections matching your agent's needs
2. On first compression trigger, summarize truncated history into sections
3. On subsequent compressions, summarize only new truncated content
4. Merge new summary into existing sections rather than regenerating
5. Track which information came from which compression cycle for debugging

### When to Use Each Approach

**Use anchored iterative summarization when:**
- Sessions are long-running (100+ messages)
- File tracking matters (coding, debugging)
- You need to verify what was preserved

**Use opaque compression when:**
- Maximum token savings required
- Sessions are relatively short
- Re-fetching costs are low

**Use regenerative summaries when:**
- Summary interpretability is critical
- Sessions have clear phase boundaries
- Full context review is acceptable on each compression

### Compression Ratio Considerations

| Method | Compression Ratio | Quality Score | Trade-off |
|--------|-------------------|---------------|-----------|
| Anchored Iterative | 98.6% | 3.70 | Best quality, slightly less compression |
| Regenerative | 98.7% | 3.44 | Good quality, moderate compression |
| Opaque | 99.3% | 3.35 | Best compression, quality loss |

The 0.7% additional tokens retained by structured summarization buys 0.35 quality points. For any task where re-fetching costs matter, this trade-off favors structured approaches.

## Examples

**Example 1: Debugging Session Compression**

Original context (89,000 tokens, 178 messages):
- 401 error on /api/auth/login endpoint
- Traced through auth controller, middleware, session store
- Found stale Redis connection
- Fixed connection pooling, added retry logic
- 14 tests passing, 2 failing

Structured summary after compression:

```markdown
## Session Intent
Debug 401 Unauthorized error on /api/auth/login despite valid credentials.

## Root Cause
Stale Redis connection in session store. JWT generated correctly but session could not be persisted.

## Files Modified
- auth.controller.ts: No changes (read only)
- middleware/cors.ts: No changes (examined)
- config/redis.ts: Fixed connection pooling configuration
- services/session.service.ts: Added retry logic for transient failures
- tests/auth.test.ts: Updated mock setup

## Test Status
14 passing, 2 failing (mock setup issues)

## Next Steps
1. Fix remaining test failures (mock session service)
2. Run full test suite
3. Deploy to staging
```

**Example 2: Probe Response Quality**

After compression, asking "What was the original error?":

Good response (structured summarization):
> "The original error was a 401 Unauthorized response from the /api/auth/login endpoint. Users received this error with valid credentials. Root cause was stale Redis connection in session store."

Poor response (aggressive compression):
> "We were debugging an authentication issue. The login was failing. We fixed some configuration problems."

The structured response preserves endpoint, error code, and root cause. The aggressive response loses all technical detail.

## Guidelines

1. Optimize for tokens-per-task, not tokens-per-request
2. Use structured summaries with explicit sections for file tracking
3. Trigger compression at 70-80% context utilization
4. Implement incremental merging rather than full regeneration
5. Test compression quality with probe-based evaluation
6. Track artifact trail separately if file tracking is critical
7. Accept slightly lower compression ratios for better quality retention
8. Monitor re-fetching frequency as a compression quality signal

## Integration

This skill connects to several others in the collection:

- context-degradation - Compression is a mitigation strategy for degradation
- context-optimization - Compression is one optimization technique among many
- evaluation - Probe-based evaluation applies to compression testing
- memory-systems - Compression relates to scratchpad and summary memory patterns

## References

Internal reference:
- [Evaluation Framework Reference](./references/evaluation-framework.md) - Detailed probe types and scoring rubrics

Related skills in this collection:
- context-degradation - Understanding what compression prevents
- context-optimization - Broader optimization strategies
- evaluation - Building evaluation frameworks

External resources:
- Factory Research: Evaluating Context Compression for AI Agents (December 2025)
- Research on LLM-as-judge evaluation methodology (Zheng et al., 2023)
- Netflix Engineering: "The Infinite Software Crisis" - Three-phase workflow and context compression at scale (AI Summit 2025)

---

## Skill Metadata

**Created**: 2025-12-22
**Last Updated**: 2025-12-26
**Author**: Agent Skills for Context Engineering Contributors
**Version**: 1.1.0


---

## 4. 上下文优化 (context-optimization)

# Context Optimization Techniques

Context optimization extends the effective capacity of limited context windows through strategic compression, masking, caching, and partitioning. The goal is not to magically increase context windows but to make better use of available capacity. Effective optimization can double or triple effective context capacity without requiring larger models or longer contexts.

## When to Activate

Activate this skill when:
- Context limits constrain task complexity
- Optimizing for cost reduction (fewer tokens = lower costs)
- Reducing latency for long conversations
- Implementing long-running agent systems
- Needing to handle larger documents or conversations
- Building production systems at scale

## Core Concepts

Context optimization extends effective capacity through four primary strategies: compaction (summarizing context near limits), observation masking (replacing verbose outputs with references), KV-cache optimization (reusing cached computations), and context partitioning (splitting work across isolated contexts).

The key insight is that context quality matters more than quantity. Optimization preserves signal while reducing noise. The art lies in selecting what to keep versus what to discard, and when to apply each technique.

## Detailed Topics

### Compaction Strategies

**What is Compaction**
Compaction is the practice of summarizing context contents when approaching limits, then reinitializing a new context window with the summary. This distills the contents of a context window in a high-fidelity manner, enabling the agent to continue with minimal performance degradation.

Compaction typically serves as the first lever in context optimization. The art lies in selecting what to keep versus what to discard.

**Compaction Implementation**
Compaction works by identifying sections that can be compressed, generating summaries that capture essential points, and replacing full content with summaries. Priority for compression goes to tool outputs (replace with summaries), old turns (summarize early conversation), retrieved docs (summarize if recent versions exist), and never compress system prompt.

**Summary Generation**
Effective summaries preserve different elements depending on message type:

Tool outputs: Preserve key findings, metrics, and conclusions. Remove verbose raw output.

Conversational turns: Preserve key decisions, commitments, and context shifts. Remove filler and back-and-forth.

Retrieved documents: Preserve key facts and claims. Remove supporting evidence and elaboration.

### Observation Masking

**The Observation Problem**
Tool outputs can comprise 80%+ of token usage in agent trajectories. Much of this is verbose output that has already served its purpose. Once an agent has used a tool output to make a decision, keeping the full output provides diminishing value while consuming significant context.

Observation masking replaces verbose tool outputs with compact references. The information remains accessible if needed but does not consume context continuously.

**Masking Strategy Selection**
Not all observations should be masked equally:

Never mask: Observations critical to current task, observations from the most recent turn, observations used in active reasoning.

Consider masking: Observations from 3+ turns ago, verbose outputs with key points extractable, observations whose purpose has been served.

Always mask: Repeated outputs, boilerplate headers/footers, outputs already summarized in conversation.

### KV-Cache Optimization

**Understanding KV-Cache**
The KV-cache stores Key and Value tensors computed during inference, growing linearly with sequence length. Caching the KV-cache across requests sharing identical prefixes avoids recomputation.

Prefix caching reuses KV blocks across requests with identical prefixes using hash-based block matching. This dramatically reduces cost and latency for requests with common prefixes like system prompts.

**Cache Optimization Patterns**
Optimize for caching by reordering context elements to maximize cache hits. Place stable elements first (system prompt, tool definitions), then frequently reused elements, then unique elements last.

Design prompts to maximize cache stability: avoid dynamic content like timestamps, use consistent formatting, keep structure stable across sessions.

### Context Partitioning

**Sub-Agent Partitioning**
The most aggressive form of context optimization is partitioning work across sub-agents with isolated contexts. Each sub-agent operates in a clean context focused on its subtask without carrying accumulated context from other subtasks.

This approach achieves separation of concerns—the detailed search context remains isolated within sub-agents while the coordinator focuses on synthesis and analysis.

**Result Aggregation**
Aggregate results from partitioned subtasks by validating all partitions completed, merging compatible results, and summarizing if still too large.

### Budget Management

**Context Budget Allocation**
Design explicit context budgets. Allocate tokens to categories: system prompt, tool definitions, retrieved docs, message history, and reserved buffer. Monitor usage against budget and trigger optimization when approaching limits.

**Trigger-Based Optimization**
Monitor signals for optimization triggers: token utilization above 80%, degradation indicators, and performance drops. Apply appropriate optimization techniques based on context composition.

## Practical Guidance

### Optimization Decision Framework

When to optimize:
- Context utilization exceeds 70%
- Response quality degrades as conversations extend
- Costs increase due to long contexts
- Latency increases with conversation length

What to apply:
- Tool outputs dominate: observation masking
- Retrieved documents dominate: summarization or partitioning
- Message history dominates: compaction with summarization
- Multiple components: combine strategies

### Performance Considerations

Compaction should achieve 50-70% token reduction with less than 5% quality degradation. Masking should achieve 60-80% reduction in masked observations. Cache optimization should achieve 70%+ hit rate for stable workloads.

Monitor and iterate on optimization strategies based on measured effectiveness.

## Examples

**Example 1: Compaction Trigger**
```python
if context_tokens / context_limit > 0.8:
    context = compact_context(context)
```

**Example 2: Observation Masking**
```python
if len(observation) > max_length:
    ref_id = store_observation(observation)
    return f"[Obs:{ref_id} elided. Key: {extract_key(observation)}]"
```

**Example 3: Cache-Friendly Ordering**
```python
# Stable content first
context = [system_prompt, tool_definitions]  # Cacheable
context += [reused_templates]  # Reusable
context += [unique_content]  # Unique
```

## Guidelines

1. Measure before optimizing—know your current state
2. Apply compaction before masking when possible
3. Design for cache stability with consistent prompts
4. Partition before context becomes problematic
5. Monitor optimization effectiveness over time
6. Balance token savings against quality preservation
7. Test optimization at production scale
8. Implement graceful degradation for edge cases

## Integration

This skill builds on context-fundamentals and context-degradation. It connects to:

- multi-agent-patterns - Partitioning as isolation
- evaluation - Measuring optimization effectiveness
- memory-systems - Offloading context to memory

## References

Internal reference:
- [Optimization Techniques Reference](./references/optimization_techniques.md) - Detailed technical reference

Related skills in this collection:
- context-fundamentals - Context basics
- context-degradation - Understanding when to optimize
- evaluation - Measuring optimization

External resources:
- Research on context window limitations
- KV-cache optimization techniques
- Production engineering guides

---

## Skill Metadata

**Created**: 2025-12-20
**Last Updated**: 2025-12-20
**Author**: Agent Skills for Context Engineering Contributors
**Version**: 1.0.0


---

## 5. 多智能体模式 (multi-agent-patterns)

# Multi-Agent Architecture Patterns

Multi-agent architectures distribute work across multiple language model instances, each with its own context window. When designed well, this distribution enables capabilities beyond single-agent limits. When designed poorly, it introduces coordination overhead that negates benefits. The critical insight is that sub-agents exist primarily to isolate context, not to anthropomorphize role division.

## When to Activate

Activate this skill when:
- Single-agent context limits constrain task complexity
- Tasks decompose naturally into parallel subtasks
- Different subtasks require different tool sets or system prompts
- Building systems that must handle multiple domains simultaneously
- Scaling agent capabilities beyond single-context limits
- Designing production agent systems with multiple specialized components

## Core Concepts

Multi-agent systems address single-agent context limitations through distribution. Three dominant patterns exist: supervisor/orchestrator for centralized control, peer-to-peer/swarm for flexible handoffs, and hierarchical for layered abstraction. The critical design principle is context isolation—sub-agents exist primarily to partition context rather than to simulate organizational roles.

Effective multi-agent systems require explicit coordination protocols, consensus mechanisms that avoid sycophancy, and careful attention to failure modes including bottlenecks, divergence, and error propagation.

## Detailed Topics

### Why Multi-Agent Architectures

**The Context Bottleneck**
Single agents face inherent ceilings in reasoning capability, context management, and tool coordination. As tasks grow more complex, context windows fill with accumulated history, retrieved documents, and tool outputs. Performance degrades according to predictable patterns: the lost-in-middle effect, attention scarcity, and context poisoning.

Multi-agent architectures address these limitations by partitioning work across multiple context windows. Each agent operates in a clean context focused on its subtask. Results aggregate at a coordination layer without any single context bearing the full burden.

**The Token Economics Reality**
Multi-agent systems consume significantly more tokens than single-agent approaches. Production data shows:

| Architecture | Token Multiplier | Use Case |
|--------------|------------------|----------|
| Single agent chat | 1× baseline | Simple queries |
| Single agent with tools | ~4× baseline | Tool-using tasks |
| Multi-agent system | ~15× baseline | Complex research/coordination |

Research on the BrowseComp evaluation found that three factors explain 95% of performance variance: token usage (80% of variance), number of tool calls, and model choice. This validates the multi-agent approach of distributing work across agents with separate context windows to add capacity for parallel reasoning.

Critically, upgrading to better models often provides larger performance gains than doubling token budgets. Claude Sonnet 4.5 showed larger gains than doubling tokens on earlier Sonnet versions. GPT-5.2's thinking mode similarly outperforms raw token increases. This suggests model selection and multi-agent architecture are complementary strategies.

**The Parallelization Argument**
Many tasks contain parallelizable subtasks that a single agent must execute sequentially. A research task might require searching multiple independent sources, analyzing different documents, or comparing competing approaches. A single agent processes these sequentially, accumulating context with each step.

Multi-agent architectures assign each subtask to a dedicated agent with a fresh context. All agents work simultaneously, then return results to a coordinator. The total real-world time approaches the duration of the longest subtask rather than the sum of all subtasks.

**The Specialization Argument**
Different tasks benefit from different agent configurations: different system prompts, different tool sets, different context structures. A general-purpose agent must carry all possible configurations in context. Specialized agents carry only what they need.

Multi-agent architectures enable specialization without combinatorial explosion. The coordinator routes to specialized agents; each agent operates with lean context optimized for its domain.

### Architectural Patterns

**Pattern 1: Supervisor/Orchestrator**
The supervisor pattern places a central agent in control, delegating to specialists and synthesizing results. The supervisor maintains global state and trajectory, decomposes user objectives into subtasks, and routes to appropriate workers.

```
User Query -> Supervisor -> [Specialist, Specialist, Specialist] -> Aggregation -> Final Output
```

When to use: Complex tasks with clear decomposition, tasks requiring coordination across domains, tasks where human oversight is important.

Advantages: Strict control over workflow, easier to implement human-in-the-loop interventions, ensures adherence to predefined plans.

Disadvantages: Supervisor context becomes bottleneck, supervisor failures cascade to all workers, "telephone game" problem where supervisors paraphrase sub-agent responses incorrectly.

**The Telephone Game Problem and Solution**
LangGraph benchmarks found supervisor architectures initially performed 50% worse than optimized versions due to the "telephone game" problem where supervisors paraphrase sub-agent responses incorrectly, losing fidelity.

The fix: implement a `forward_message` tool allowing sub-agents to pass responses directly to users:

```python
def forward_message(message: str, to_user: bool = True):
    """
    Forward sub-agent response directly to user without supervisor synthesis.
    
    Use when:
    - Sub-agent response is final and complete
    - Supervisor synthesis would lose important details
    - Response format must be preserved exactly
    """
    if to_user:
        return {"type": "direct_response", "content": message}
    return {"type": "supervisor_input", "content": message}
```

With this pattern, swarm architectures slightly outperform supervisors because sub-agents respond directly to users, eliminating translation errors.

Implementation note: Implement direct pass-through mechanisms allowing sub-agents to pass responses directly to users rather than through supervisor synthesis when appropriate.

**Pattern 2: Peer-to-Peer/Swarm**
The peer-to-peer pattern removes central control, allowing agents to communicate directly based on predefined protocols. Any agent can transfer control to any other through explicit handoff mechanisms.

```python
def transfer_to_agent_b():
    return agent_b  # Handoff via function return

agent_a = Agent(
    name="Agent A",
    functions=[transfer_to_agent_b]
)
```

When to use: Tasks requiring flexible exploration, tasks where rigid planning is counterproductive, tasks with emergent requirements that defy upfront decomposition.

Advantages: No single point of failure, scales effectively for breadth-first exploration, enables emergent problem-solving behaviors.

Disadvantages: Coordination complexity increases with agent count, risk of divergence without central state keeper, requires robust convergence constraints.

Implementation note: Define explicit handoff protocols with state passing. Ensure agents can communicate their context needs to receiving agents.

**Pattern 3: Hierarchical**
Hierarchical structures organize agents into layers of abstraction: strategic, planning, and execution layers. Strategy layer agents define goals and constraints; planning layer agents break goals into actionable plans; execution layer agents perform atomic tasks.

```
Strategy Layer (Goal Definition) -> Planning Layer (Task Decomposition) -> Execution Layer (Atomic Tasks)
```

When to use: Large-scale projects with clear hierarchical structure, enterprise workflows with management layers, tasks requiring both high-level planning and detailed execution.

Advantages: Mirrors organizational structures, clear separation of concerns, enables different context structures at different levels.

Disadvantages: Coordination overhead between layers, potential for misalignment between strategy and execution, complex error propagation.

### Context Isolation as Design Principle

The primary purpose of multi-agent architectures is context isolation. Each sub-agent operates in a clean context window focused on its subtask without carrying accumulated context from other subtasks.

**Isolation Mechanisms**
Full context delegation: For complex tasks where the sub-agent needs complete understanding, the planner shares its entire context. The sub-agent has its own tools and instructions but receives full context for its decisions.

Instruction passing: For simple, well-defined subtasks, the planner creates instructions via function call. The sub-agent receives only the instructions needed for its specific task.

File system memory: For complex tasks requiring shared state, agents read and write to persistent storage. The file system serves as the coordination mechanism, avoiding context bloat from shared state passing.

**Isolation Trade-offs**
Full context delegation provides maximum capability but defeats the purpose of sub-agents. Instruction passing maintains isolation but limits sub-agent flexibility. File system memory enables shared state without context passing but introduces latency and consistency challenges.

The right choice depends on task complexity, coordination needs, and acceptable latency.

### Consensus and Coordination

**The Voting Problem**
Simple majority voting treats hallucinations from weak models as equal to reasoning from strong models. Without intervention, multi-agent discussions devolve into consensus on false premises due to inherent bias toward agreement.

**Weighted Voting**
Weight agent votes by confidence or expertise. Agents with higher confidence or domain expertise carry more weight in final decisions.

**Debate Protocols**
Debate protocols require agents to critique each other's outputs over multiple rounds. Adversarial critique often yields higher accuracy on complex reasoning than collaborative consensus.

**Trigger-Based Intervention**
Monitor multi-agent interactions for specific behavioral markers. Stall triggers activate when discussions make no progress. Sycophancy triggers detect when agents mimic each other's answers without unique reasoning.

### Framework Considerations

Different frameworks implement these patterns with different philosophies. LangGraph uses graph-based state machines with explicit nodes and edges. AutoGen uses conversational/event-driven patterns with GroupChat. CrewAI uses role-based process flows with hierarchical crew structures.

## Practical Guidance

### Failure Modes and Mitigations

**Failure: Supervisor Bottleneck**
The supervisor accumulates context from all workers, becoming susceptible to saturation and degradation.

Mitigation: Implement output schema constraints so workers return only distilled summaries. Use checkpointing to persist supervisor state without carrying full history.

**Failure: Coordination Overhead**
Agent communication consumes tokens and introduces latency. Complex coordination can negate parallelization benefits.

Mitigation: Minimize communication through clear handoff protocols. Batch results where possible. Use asynchronous communication patterns.

**Failure: Divergence**
Agents pursuing different goals without central coordination can drift from intended objectives.

Mitigation: Define clear objective boundaries for each agent. Implement convergence checks that verify progress toward shared goals. Use time-to-live limits on agent execution.

**Failure: Error Propagation**
Errors in one agent's output propagate to downstream agents that consume that output.

Mitigation: Validate agent outputs before passing to consumers. Implement retry logic with circuit breakers. Use idempotent operations where possible.

## Examples

**Example 1: Research Team Architecture**
```text
Supervisor
├── Researcher (web search, document retrieval)
├── Analyzer (data analysis, statistics)
├── Fact-checker (verification, validation)
└── Writer (report generation, formatting)
```

**Example 2: Handoff Protocol**
```python
def handle_customer_request(request):
    if request.type == "billing":
        return transfer_to(billing_agent)
    elif request.type == "technical":
        return transfer_to(technical_agent)
    elif request.type == "sales":
        return transfer_to(sales_agent)
    else:
        return handle_general(request)
```

## Guidelines

1. Design for context isolation as the primary benefit of multi-agent systems
2. Choose architecture pattern based on coordination needs, not organizational metaphor
3. Implement explicit handoff protocols with state passing
4. Use weighted voting or debate protocols for consensus
5. Monitor for supervisor bottlenecks and implement checkpointing
6. Validate outputs before passing between agents
7. Set time-to-live limits to prevent infinite loops
8. Test failure scenarios explicitly

## Integration

This skill builds on context-fundamentals and context-degradation. It connects to:

- memory-systems - Shared state management across agents
- tool-design - Tool specialization per agent
- context-optimization - Context partitioning strategies

## References

Internal reference:
- [Frameworks Reference](./references/frameworks.md) - Detailed framework implementation patterns

Related skills in this collection:
- context-fundamentals - Context basics
- memory-systems - Cross-agent memory
- context-optimization - Partitioning strategies

External resources:
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/) - Multi-agent patterns and state management
- [AutoGen Framework](https://microsoft.github.io/autogen/) - GroupChat and conversational patterns
- [CrewAI Documentation](https://docs.crewai.com/) - Hierarchical agent processes
- [Research on Multi-Agent Coordination](https://arxiv.org/abs/2308.00352) - Survey of multi-agent systems

---

## Skill Metadata

**Created**: 2025-12-20
**Last Updated**: 2025-12-20
**Author**: Agent Skills for Context Engineering Contributors
**Version**: 1.0.0


---

## 6. 记忆系统 (memory-systems)

# Memory System Design

Memory provides the persistence layer that allows agents to maintain continuity across sessions and reason over accumulated knowledge. Simple agents rely entirely on context for memory, losing all state when sessions end. Sophisticated agents implement layered memory architectures that balance immediate context needs with long-term knowledge retention. The evolution from vector stores to knowledge graphs to temporal knowledge graphs represents increasing investment in structured memory for improved retrieval and reasoning.

## When to Activate

Activate this skill when:
- Building agents that must persist across sessions
- Needing to maintain entity consistency across conversations
- Implementing reasoning over accumulated knowledge
- Designing systems that learn from past interactions
- Creating knowledge bases that grow over time
- Building temporal-aware systems that track state changes

## Core Concepts

Memory exists on a spectrum from immediate context to permanent storage. At one extreme, working memory in the context window provides zero-latency access but vanishes when sessions end. At the other extreme, permanent storage persists indefinitely but requires retrieval to enter context.

Simple vector stores lack relationship and temporal structure. Knowledge graphs preserve relationships for reasoning. Temporal knowledge graphs add validity periods for time-aware queries. Implementation choices depend on query complexity, infrastructure constraints, and accuracy requirements.

## Detailed Topics

### Memory Architecture Fundamentals

**The Context-Memory Spectrum**
Memory exists on a spectrum from immediate context to permanent storage. At one extreme, working memory in the context window provides zero-latency access but vanishes when sessions end. At the other extreme, permanent storage persists indefinitely but requires retrieval to enter context. Effective architectures use multiple layers along this spectrum.

The spectrum includes working memory (context window, zero latency, volatile), short-term memory (session-persistent, searchable, volatile), long-term memory (cross-session persistent, structured, semi-permanent), and permanent memory (archival, queryable, permanent). Each layer has different latency, capacity, and persistence characteristics.

**Why Simple Vector Stores Fall Short**
Vector RAG provides semantic retrieval by embedding queries and documents in a shared embedding space. Similarity search retrieves the most semantically similar documents. This works well for document retrieval but lacks structure for agent memory.

Vector stores lose relationship information. If an agent learns that "Customer X purchased Product Y on Date Z," a vector store can retrieve this fact if asked directly. But it cannot answer "What products did customers who purchased Product Y also buy?" because relationship structure is not preserved.

Vector stores also struggle with temporal validity. Facts change over time, but vector stores provide no mechanism to distinguish "current fact" from "outdated fact" except through explicit metadata and filtering.

**The Move to Graph-Based Memory**
Knowledge graphs preserve relationships between entities. Instead of isolated document chunks, graphs encode that Entity A has Relationship R to Entity B. This enables queries that traverse relationships rather than just similarity.

Temporal knowledge graphs add validity periods to facts. Each fact has a "valid from" and optionally "valid until" timestamp. This enables time-travel queries that reconstruct knowledge at specific points in time.

**Benchmark Performance Comparison**
The Deep Memory Retrieval (DMR) benchmark provides concrete performance data across memory architectures:

| Memory System | DMR Accuracy | Retrieval Latency | Notes |
|---------------|--------------|-------------------|-------|
| Zep (Temporal KG) | 94.8% | 2.58s | Best accuracy, fast retrieval |
| MemGPT | 93.4% | Variable | Good general performance |
| GraphRAG | ~75-85% | Variable | 20-35% gains over baseline RAG |
| Vector RAG | ~60-70% | Fast | Loses relationship structure |
| Recursive Summarization | 35.3% | Low | Severe information loss |

Zep demonstrated 90% reduction in retrieval latency compared to full-context baselines (2.58s vs 28.9s for GPT-5.2). This efficiency comes from retrieving only relevant subgraphs rather than entire context history.

GraphRAG achieves approximately 20-35% accuracy gains over baseline RAG in complex reasoning tasks and reduces hallucination by up to 30% through community-based summarization.

### Memory Layer Architecture

**Layer 1: Working Memory**
Working memory is the context window itself. It provides immediate access to information currently being processed but has limited capacity and vanishes when sessions end.

Working memory usage patterns include scratchpad calculations where agents track intermediate results, conversation history that preserves dialogue for current task, current task state that tracks progress on active objectives, and active retrieved documents that hold information currently being used.

Optimize working memory by keeping only active information, summarizing completed work before it falls out of attention, and using attention-favored positions for critical information.

**Layer 2: Short-Term Memory**
Short-term memory persists across the current session but not across sessions. It provides search and retrieval capabilities without the latency of permanent storage.

Common implementations include session-scoped databases that persist until session end, file-system storage in designated session directories, and in-memory caches keyed by session ID.

Short-term memory use cases include tracking conversation state across turns without stuffing context, storing intermediate results from tool calls that may be needed later, maintaining task checklists and progress tracking, and caching retrieved information within sessions.

**Layer 3: Long-Term Memory**
Long-term memory persists across sessions indefinitely. It enables agents to learn from past interactions and build knowledge over time.

Long-term memory implementations range from simple key-value stores to sophisticated graph databases. The choice depends on complexity of relationships to model, query patterns required, and acceptable infrastructure complexity.

Long-term memory use cases include learning user preferences across sessions, building domain knowledge bases that grow over time, maintaining entity registries with relationship history, and storing successful patterns that can be reused.

**Layer 4: Entity Memory**
Entity memory specifically tracks information about entities (people, places, concepts, objects) to maintain consistency. This creates a rudimentary knowledge graph where entities are recognized across multiple interactions.

Entity memory maintains entity identity by tracking that "John Doe" mentioned in one conversation is the same person in another. It maintains entity properties by storing facts discovered about entities over time. It maintains entity relationships by tracking relationships between entities as they are discovered.

**Layer 5: Temporal Knowledge Graphs**
Temporal knowledge graphs extend entity memory with explicit validity periods. Facts are not just true or false but true during specific time ranges.

This enables queries like "What was the user's address on Date X?" by retrieving facts valid during that date range. It prevents context clash when outdated information contradicts new data. It enables temporal reasoning about how entities changed over time.

### Memory Implementation Patterns

**Pattern 1: File-System-as-Memory**
The file system itself can serve as a memory layer. This pattern is simple, requires no additional infrastructure, and enables the same just-in-time loading that makes file-system-based context effective.

Implementation uses the file system hierarchy for organization. Use naming conventions that convey meaning. Store facts in structured formats (JSON, YAML). Use timestamps in filenames or metadata for temporal tracking.

Advantages: Simplicity, transparency, portability.
Disadvantages: No semantic search, no relationship tracking, manual organization required.

**Pattern 2: Vector RAG with Metadata**
Vector stores enhanced with rich metadata provide semantic search with filtering capabilities.

Implementation embeds facts or documents and stores with metadata including entity tags, temporal validity, source attribution, and confidence scores. Query includes metadata filters alongside semantic search.

**Pattern 3: Knowledge Graph**
Knowledge graphs explicitly model entities and relationships. Implementation defines entity types and relationship types, uses graph database or property graph storage, and maintains indexes for common query patterns.

**Pattern 4: Temporal Knowledge Graph**
Temporal knowledge graphs add validity periods to facts, enabling time-travel queries and preventing context clash from outdated information.

### Memory Retrieval Patterns

**Semantic Retrieval**
Retrieve memories semantically similar to current query using embedding similarity search.

**Entity-Based Retrieval**
Retrieve all memories related to specific entities by traversing graph relationships.

**Temporal Retrieval**
Retrieve memories valid at specific time or within time range using validity period filters.

### Memory Consolidation

Memories accumulate over time and require consolidation to prevent unbounded growth and remove outdated information.

**Consolidation Triggers**
Trigger consolidation after significant memory accumulation, when retrieval returns too many outdated results, periodically on a schedule, or when explicit consolidation is requested.

**Consolidation Process**
Identify outdated facts, merge related facts, update validity periods, archive or delete obsolete facts, and rebuild indexes.

## Practical Guidance

### Integration with Context

Memories must integrate with context systems to be useful. Use just-in-time memory loading to retrieve relevant memories when needed. Use strategic injection to place memories in attention-favored positions.

### Memory System Selection

Choose memory architecture based on requirements:
- Simple persistence needs: File-system memory
- Semantic search needs: Vector RAG with metadata
- Relationship reasoning needs: Knowledge graph
- Temporal validity needs: Temporal knowledge graph

## Examples

**Example 1: Entity Tracking**
```python
# Track entity across conversations
def remember_entity(entity_id, properties):
    memory.store({
        "type": "entity",
        "id": entity_id,
        "properties": properties,
        "last_updated": now()
    })

def get_entity(entity_id):
    return memory.retrieve_entity(entity_id)
```

**Example 2: Temporal Query**
```python
# What was the user's address on January 15, 2024?
def query_address_at_time(user_id, query_time):
    return temporal_graph.query("""
        MATCH (user)-[r:LIVES_AT]->(address)
        WHERE user.id = $user_id
        AND r.valid_from <= $query_time
        AND (r.valid_until IS NULL OR r.valid_until > $query_time)
        RETURN address
    """, {"user_id": user_id, "query_time": query_time})
```

## Guidelines

1. Match memory architecture to query requirements
2. Implement progressive disclosure for memory access
3. Use temporal validity to prevent outdated information conflicts
4. Consolidate memories periodically to prevent unbounded growth
5. Design for memory retrieval failures gracefully
6. Consider privacy implications of persistent memory
7. Implement backup and recovery for critical memories
8. Monitor memory growth and performance over time

## Integration

This skill builds on context-fundamentals. It connects to:

- multi-agent-patterns - Shared memory across agents
- context-optimization - Memory-based context loading
- evaluation - Evaluating memory quality

## References

Internal reference:
- [Implementation Reference](./references/implementation.md) - Detailed implementation patterns

Related skills in this collection:
- context-fundamentals - Context basics
- multi-agent-patterns - Cross-agent memory

External resources:
- Graph database documentation (Neo4j, etc.)
- Vector store documentation (Pinecone, Weaviate, etc.)
- Research on knowledge graphs and reasoning

---

## Skill Metadata

**Created**: 2025-12-20
**Last Updated**: 2025-12-20
**Author**: Agent Skills for Context Engineering Contributors
**Version**: 1.0.0


---

## 7. 工具设计 (tool-design)

# Tool Design for Agents

Tools are the primary mechanism through which agents interact with the world. They define the contract between deterministic systems and non-deterministic agents. Unlike traditional software APIs designed for developers, tool APIs must be designed for language models that reason about intent, infer parameter values, and generate calls from natural language requests. Poor tool design creates failure modes that no amount of prompt engineering can fix. Effective tool design follows specific principles that account for how agents perceive and use tools.

## When to Activate

Activate this skill when:
- Creating new tools for agent systems
- Debugging tool-related failures or misuse
- Optimizing existing tool sets for better agent performance
- Designing tool APIs from scratch
- Evaluating third-party tools for agent integration
- Standardizing tool conventions across a codebase

## Core Concepts

Tools are contracts between deterministic systems and non-deterministic agents. The consolidation principle states that if a human engineer cannot definitively say which tool should be used in a given situation, an agent cannot be expected to do better. Effective tool descriptions are prompt engineering that shapes agent behavior.

Key principles include: clear descriptions that answer what, when, and what returns; response formats that balance completeness and token efficiency; error messages that enable recovery; and consistent conventions that reduce cognitive load.

## Detailed Topics

### The Tool-Agent Interface

**Tools as Contracts**
Tools are contracts between deterministic systems and non-deterministic agents. When humans call APIs, they understand the contract and make appropriate requests. Agents must infer the contract from descriptions and generate calls that match expected formats.

This fundamental difference requires rethinking API design. The contract must be unambiguous, examples must illustrate expected patterns, and error messages must guide correction. Every ambiguity in tool definitions becomes a potential failure mode.

**Tool Description as Prompt**
Tool descriptions are loaded into agent context and collectively steer behavior. The descriptions are not just documentation—they are prompt engineering that shapes how agents reason about tool use.

Poor descriptions like "Search the database" with cryptic parameter names force agents to guess. Optimized descriptions include usage context, examples, and defaults. The description answers: what the tool does, when to use it, and what it produces.

**Namespacing and Organization**
As tool collections grow, organization becomes critical. Namespacing groups related tools under common prefixes, helping agents select appropriate tools at the right time.

Namespacing creates clear boundaries between functionality. When an agent needs database information, it routes to the database namespace. When it needs web search, it routes to web namespace.

### The Consolidation Principle

**Single Comprehensive Tools**
The consolidation principle states that if a human engineer cannot definitively say which tool should be used in a given situation, an agent cannot be expected to do better. This leads to a preference for single comprehensive tools over multiple narrow tools.

Instead of implementing list_users, list_events, and create_event, implement schedule_event that finds availability and schedules. The comprehensive tool handles the full workflow internally rather than requiring agents to chain multiple calls.

**Why Consolidation Works**
Agents have limited context and attention. Each tool in the collection competes for attention in the tool selection phase. Each tool adds description tokens that consume context budget. Overlapping functionality creates ambiguity about which tool to use.

Consolidation reduces token consumption by eliminating redundant descriptions. It eliminates ambiguity by having one tool cover each workflow. It reduces tool selection complexity by shrinking the effective tool set.

**When Not to Consolidate**
Consolidation is not universally correct. Tools with fundamentally different behaviors should remain separate. Tools used in different contexts benefit from separation. Tools that might be called independently should not be artificially bundled.

### Architectural Reduction

The consolidation principle, taken to its logical extreme, leads to architectural reduction: removing most specialized tools in favor of primitive, general-purpose capabilities. Production evidence shows this approach can outperform sophisticated multi-tool architectures.

**The File System Agent Pattern**
Instead of building custom tools for data exploration, schema lookup, and query validation, provide direct file system access through a single command execution tool. The agent uses standard Unix utilities (grep, cat, find, ls) to explore, understand, and operate on your system.

This works because:
1. File systems are a proven abstraction that models understand deeply
2. Standard tools have predictable, well-documented behavior
3. The agent can chain primitives flexibly rather than being constrained to predefined workflows
4. Good documentation in files replaces the need for summarization tools

**When Reduction Outperforms Complexity**
Reduction works when:
- Your data layer is well-documented and consistently structured
- The model has sufficient reasoning capability to navigate complexity
- Your specialized tools were constraining rather than enabling the model
- You're spending more time maintaining scaffolding than improving outcomes

Reduction fails when:
- Your underlying data is messy, inconsistent, or poorly documented
- The domain requires specialized knowledge the model lacks
- Safety constraints require limiting what the agent can do
- Operations are truly complex and benefit from structured workflows

**Stop Constraining Reasoning**
A common anti-pattern is building tools to "protect" the model from complexity. Pre-filtering context, constraining options, wrapping interactions in validation logic. These guardrails often become liabilities as models improve.

The question to ask: are your tools enabling new capabilities, or are they constraining reasoning the model could handle on its own?

**Build for Future Models**
Models improve faster than tooling can keep up. An architecture optimized for today's model may be over-constrained for tomorrow's. Build minimal architectures that can benefit from model improvements rather than sophisticated architectures that lock in current limitations.

See [Architectural Reduction Case Study](./references/architectural_reduction.md) for production evidence.

### Tool Description Engineering

**Description Structure**
Effective tool descriptions answer four questions:

What does the tool do? Clear, specific description of functionality. Avoid vague language like "helps with" or "can be used for." State exactly what the tool accomplishes.

When should it be used? Specific triggers and contexts. Include both direct triggers ("User asks about pricing") and indirect signals ("Need current market rates").

What inputs does it accept? Parameter descriptions with types, constraints, and defaults. Explain what each parameter controls.

What does it return? Output format and structure. Include examples of successful responses and error conditions.

**Default Parameter Selection**
Defaults should reflect common use cases. They reduce agent burden by eliminating unnecessary parameter specification. They prevent errors from omitted parameters.

### Response Format Optimization

Tool response size significantly impacts context usage. Implementing response format options gives agents control over verbosity.

Concise format returns essential fields only, appropriate for confirmation or basic information. Detailed format returns complete objects with all fields, appropriate when full context is needed for decisions.

Include guidance in tool descriptions about when to use each format. Agents learn to select appropriate formats based on task requirements.

### Error Message Design

Error messages serve two audiences: developers debugging issues and agents recovering from failures. For agents, error messages must be actionable. They must tell the agent what went wrong and how to correct it.

Design error messages that enable recovery. For retryable errors, include retry guidance. For input errors, include corrected format. For missing data, include what's needed.

### Tool Definition Schema

Use a consistent schema across all tools. Establish naming conventions: verb-noun pattern for tool names, consistent parameter names across tools, consistent return field names.

### Tool Collection Design

Research shows tool description overlap causes model confusion. More tools do not always lead to better outcomes. A reasonable guideline is 10-20 tools for most applications. If more are needed, use namespacing to create logical groupings.

Implement mechanisms to help agents select the right tool: tool grouping, example-based selection, and hierarchy with umbrella tools that route to specialized sub-tools.

### MCP Tool Naming Requirements

When using MCP (Model Context Protocol) tools, always use fully qualified tool names to avoid "tool not found" errors.

Format: `ServerName:tool_name`

```python
# Correct: Fully qualified names
"Use the BigQuery:bigquery_schema tool to retrieve table schemas."
"Use the GitHub:create_issue tool to create issues."

# Incorrect: Unqualified names
"Use the bigquery_schema tool..."  # May fail with multiple servers
```

Without the server prefix, agents may fail to locate tools, especially when multiple MCP servers are available. Establish naming conventions that include server context in all tool references.

### Using Agents to Optimize Tools

Claude can optimize its own tools. When given a tool and observed failure modes, it diagnoses issues and suggests improvements. Production testing shows this approach achieves 40% reduction in task completion time by helping future agents avoid mistakes.

**The Tool-Testing Agent Pattern**:

```python
def optimize_tool_description(tool_spec, failure_examples):
    """
    Use an agent to analyze tool failures and improve descriptions.
    
    Process:
    1. Agent attempts to use tool across diverse tasks
    2. Collect failure modes and friction points
    3. Agent analyzes failures and proposes improvements
    4. Test improved descriptions against same tasks
    """
    prompt = f"""
    Analyze this tool specification and the observed failures.
    
    Tool: {tool_spec}
    
    Failures observed:
    {failure_examples}
    
    Identify:
    1. Why agents are failing with this tool
    2. What information is missing from the description
    3. What ambiguities cause incorrect usage
    
    Propose an improved tool description that addresses these issues.
    """
    
    return get_agent_response(prompt)
```

This creates a feedback loop: agents using tools generate failure data, which agents then use to improve tool descriptions, which reduces future failures.

### Testing Tool Design

Evaluate tool designs against criteria: unambiguity, completeness, recoverability, efficiency, and consistency. Test tools by presenting representative agent requests and evaluating the resulting tool calls.

## Practical Guidance

### Anti-Patterns to Avoid

Vague descriptions: "Search the database for customer information" leaves too many questions unanswered.

Cryptic parameter names: Parameters named x, val, or param1 force agents to guess meaning.

Missing error handling: Tools that fail with generic errors provide no recovery guidance.

Inconsistent naming: Using id in some tools, identifier in others, and customer_id in some creates confusion.

### Tool Selection Framework

When designing tool collections:
1. Identify distinct workflows agents must accomplish
2. Group related actions into comprehensive tools
3. Ensure each tool has a clear, unambiguous purpose
4. Document error cases and recovery paths
5. Test with actual agent interactions

## Examples

**Example 1: Well-Designed Tool**
```python
def get_customer(customer_id: str, format: str = "concise"):
    """
    Retrieve customer information by ID.
    
    Use when:
    - User asks about specific customer details
    - Need customer context for decision-making
    - Verifying customer identity
    
    Args:
        customer_id: Format "CUST-######" (e.g., "CUST-000001")
        format: "concise" for key fields, "detailed" for complete record
    
    Returns:
        Customer object with requested fields
    
    Errors:
        NOT_FOUND: Customer ID not found
        INVALID_FORMAT: ID must match CUST-###### pattern
    """
```

**Example 2: Poor Tool Design**

This example demonstrates several tool design anti-patterns:

```python
def search(query):
    """Search the database."""
    pass
```

**Problems with this design:**

1. **Vague name**: "search" is ambiguous - search what, for what purpose?
2. **Missing parameters**: What database? What format should query take?
3. **No return description**: What does this function return? A list? A string? Error handling?
4. **No usage context**: When should an agent use this versus other tools?
5. **No error handling**: What happens if the database is unavailable?

**Failure modes:**
- Agents may call this tool when they should use a more specific tool
- Agents cannot determine correct query format
- Agents cannot interpret results
- Agents cannot recover from failures

## Guidelines

1. Write descriptions that answer what, when, and what returns
2. Use consolidation to reduce ambiguity
3. Implement response format options for token efficiency
4. Design error messages for agent recovery
5. Establish and follow consistent naming conventions
6. Limit tool count and use namespacing for organization
7. Test tool designs with actual agent interactions
8. Iterate based on observed failure modes
9. Question whether each tool enables or constrains the model
10. Prefer primitive, general-purpose tools over specialized wrappers
11. Invest in documentation quality over tooling sophistication
12. Build minimal architectures that benefit from model improvements

## Integration

This skill connects to:
- context-fundamentals - How tools interact with context
- multi-agent-patterns - Specialized tools per agent
- evaluation - Evaluating tool effectiveness

## References

Internal references:
- [Best Practices Reference](./references/best_practices.md) - Detailed tool design guidelines
- [Architectural Reduction Case Study](./references/architectural_reduction.md) - Production evidence for tool minimalism

Related skills in this collection:
- context-fundamentals - Tool context interactions
- evaluation - Tool testing patterns

External resources:
- MCP (Model Context Protocol) documentation
- Framework tool conventions
- API design best practices for agents
- Vercel d0 agent architecture case study

---

## Skill Metadata

**Created**: 2025-12-20
**Last Updated**: 2025-12-23
**Author**: Agent Skills for Context Engineering Contributors
**Version**: 1.1.0


---

## 8. 评估方法 (evaluation)

# Evaluation Methods for Agent Systems

Evaluation of agent systems requires different approaches than traditional software or even standard language model applications. Agents make dynamic decisions, are non-deterministic between runs, and often lack single correct answers. Effective evaluation must account for these characteristics while providing actionable feedback. A robust evaluation framework enables continuous improvement, catches regressions, and validates that context engineering choices achieve intended effects.

## When to Activate

Activate this skill when:
- Testing agent performance systematically
- Validating context engineering choices
- Measuring improvements over time
- Catching regressions before deployment
- Building quality gates for agent pipelines
- Comparing different agent configurations
- Evaluating production systems continuously

## Core Concepts

Agent evaluation requires outcome-focused approaches that account for non-determinism and multiple valid paths. Multi-dimensional rubrics capture various quality aspects: factual accuracy, completeness, citation accuracy, source quality, and tool efficiency. LLM-as-judge provides scalable evaluation while human evaluation catches edge cases.

The key insight is that agents may find alternative paths to goals—the evaluation should judge whether they achieve right outcomes while following reasonable processes.

**Performance Drivers: The 95% Finding**
Research on the BrowseComp evaluation (which tests browsing agents' ability to locate hard-to-find information) found that three factors explain 95% of performance variance:

| Factor | Variance Explained | Implication |
|--------|-------------------|-------------|
| Token usage | 80% | More tokens = better performance |
| Number of tool calls | ~10% | More exploration helps |
| Model choice | ~5% | Better models multiply efficiency |

This finding has significant implications for evaluation design:
- **Token budgets matter**: Evaluate agents with realistic token budgets, not unlimited resources
- **Model upgrades beat token increases**: Upgrading to Claude Sonnet 4.5 or GPT-5.2 provides larger gains than doubling token budgets on previous versions
- **Multi-agent validation**: The finding validates architectures that distribute work across agents with separate context windows

## Detailed Topics

### Evaluation Challenges

**Non-Determinism and Multiple Valid Paths**
Agents may take completely different valid paths to reach goals. One agent might search three sources while another searches ten. They might use different tools to find the same answer. Traditional evaluations that check for specific steps fail in this context.

The solution is outcome-focused evaluation that judges whether agents achieve right outcomes while following reasonable processes.

**Context-Dependent Failures**
Agent failures often depend on context in subtle ways. An agent might succeed on simple queries but fail on complex ones. It might work well with one tool set but fail with another. Failures may emerge only after extended interaction when context accumulates.

Evaluation must cover a range of complexity levels and test extended interactions, not just isolated queries.

**Composite Quality Dimensions**
Agent quality is not a single dimension. It includes factual accuracy, completeness, coherence, tool efficiency, and process quality. An agent might score high on accuracy but low in efficiency, or vice versa.

Evaluation rubrics must capture multiple dimensions with appropriate weighting for the use case.

### Evaluation Rubric Design

**Multi-Dimensional Rubric**
Effective rubrics cover key dimensions with descriptive levels:

Factual accuracy: Claims match ground truth (excellent to failed)

Completeness: Output covers requested aspects (excellent to failed)

Citation accuracy: Citations match claimed sources (excellent to failed)

Source quality: Uses appropriate primary sources (excellent to failed)

Tool efficiency: Uses right tools reasonable number of times (excellent to failed)

**Rubric Scoring**
Convert dimension assessments to numeric scores (0.0 to 1.0) with appropriate weighting. Calculate weighted overall scores. Determine passing threshold based on use case requirements.

### Evaluation Methodologies

**LLM-as-Judge**
LLM-based evaluation scales to large test sets and provides consistent judgments. The key is designing effective evaluation prompts that capture the dimensions of interest.

Provide clear task description, agent output, ground truth (if available), evaluation scale with level descriptions, and request structured judgment.

**Human Evaluation**
Human evaluation catches what automation misses. Humans notice hallucinated answers on unusual queries, system failures, and subtle biases that automated evaluation misses.

Effective human evaluation covers edge cases, samples systematically, tracks patterns, and provides contextual understanding.

**End-State Evaluation**
For agents that mutate persistent state, end-state evaluation focuses on whether the final state matches expectations rather than how the agent got there.

### Test Set Design

**Sample Selection**
Start with small samples during development. Early in agent development, changes have dramatic impacts because there is abundant low-hanging fruit. Small test sets reveal large effects.

Sample from real usage patterns. Add known edge cases. Ensure coverage across complexity levels.

**Complexity Stratification**
Test sets should span complexity levels: simple (single tool call), medium (multiple tool calls), complex (many tool calls, significant ambiguity), and very complex (extended interaction, deep reasoning).

### Context Engineering Evaluation

**Testing Context Strategies**
Context engineering choices should be validated through systematic evaluation. Run agents with different context strategies on the same test set. Compare quality scores, token usage, and efficiency metrics.

**Degradation Testing**
Test how context degradation affects performance by running agents at different context sizes. Identify performance cliffs where context becomes problematic. Establish safe operating limits.

### Continuous Evaluation

**Evaluation Pipeline**
Build evaluation pipelines that run automatically on agent changes. Track results over time. Compare versions to identify improvements or regressions.

**Monitoring Production**
Track evaluation metrics in production by sampling interactions and evaluating randomly. Set alerts for quality drops. Maintain dashboards for trend analysis.

## Practical Guidance

### Building Evaluation Frameworks

1. Define quality dimensions relevant to your use case
2. Create rubrics with clear, actionable level descriptions
3. Build test sets from real usage patterns and edge cases
4. Implement automated evaluation pipelines
5. Establish baseline metrics before making changes
6. Run evaluations on all significant changes
7. Track metrics over time for trend analysis
8. Supplement automated evaluation with human review

### Avoiding Evaluation Pitfalls

Overfitting to specific paths: Evaluate outcomes, not specific steps.
Ignoring edge cases: Include diverse test scenarios.
Single-metric obsession: Use multi-dimensional rubrics.
Neglecting context effects: Test with realistic context sizes.
Skipping human evaluation: Automated evaluation misses subtle issues.

## Examples

**Example 1: Simple Evaluation**
```python
def evaluate_agent_response(response, expected):
    rubric = load_rubric()
    scores = {}
    for dimension, config in rubric.items():
        scores[dimension] = assess_dimension(response, expected, dimension)
    overall = weighted_average(scores, config["weights"])
    return {"passed": overall >= 0.7, "scores": scores}
```

**Example 2: Test Set Structure**

Test sets should span multiple complexity levels to ensure comprehensive evaluation:

```python
test_set = [
    {
        "name": "simple_lookup",
        "input": "What is the capital of France?",
        "expected": {"type": "fact", "answer": "Paris"},
        "complexity": "simple",
        "description": "Single tool call, factual lookup"
    },
    {
        "name": "medium_query",
        "input": "Compare the revenue of Apple and Microsoft last quarter",
        "complexity": "medium",
        "description": "Multiple tool calls, comparison logic"
    },
    {
        "name": "multi_step_reasoning",
        "input": "Analyze sales data from Q1-Q4 and create a summary report with trends",
        "complexity": "complex",
        "description": "Many tool calls, aggregation, analysis"
    },
    {
        "name": "research_synthesis",
        "input": "Research emerging AI technologies, evaluate their potential impact, and recommend adoption strategy",
        "complexity": "very_complex",
        "description": "Extended interaction, deep reasoning, synthesis"
    }
]
```

## Guidelines

1. Use multi-dimensional rubrics, not single metrics
2. Evaluate outcomes, not specific execution paths
3. Cover complexity levels from simple to complex
4. Test with realistic context sizes and histories
5. Run evaluations continuously, not just before release
6. Supplement LLM evaluation with human review
7. Track metrics over time for trend detection
8. Set clear pass/fail thresholds based on use case

## Integration

This skill connects to all other skills as a cross-cutting concern:

- context-fundamentals - Evaluating context usage
- context-degradation - Detecting degradation
- context-optimization - Measuring optimization effectiveness
- multi-agent-patterns - Evaluating coordination
- tool-design - Evaluating tool effectiveness
- memory-systems - Evaluating memory quality

## References

Internal reference:
- [Metrics Reference](./references/metrics.md) - Detailed evaluation metrics and implementation

## References

Internal skills:
- All other skills connect to evaluation for quality measurement

External resources:
- LLM evaluation benchmarks
- Agent evaluation research papers
- Production monitoring practices

---

## Skill Metadata

**Created**: 2025-12-20
**Last Updated**: 2025-12-20
**Author**: Agent Skills for Context Engineering Contributors
**Version**: 1.0.0


---

## 9. 高级评估 (advanced-evaluation)

# Advanced Evaluation

This skill covers production-grade techniques for evaluating LLM outputs using LLMs as judges. It synthesizes research from academic papers, industry practices, and practical implementation experience into actionable patterns for building reliable evaluation systems.

**Key insight**: LLM-as-a-Judge is not a single technique but a family of approaches, each suited to different evaluation contexts. Choosing the right approach and mitigating known biases is the core competency this skill develops.

## When to Activate

Activate this skill when:

- Building automated evaluation pipelines for LLM outputs
- Comparing multiple model responses to select the best one
- Establishing consistent quality standards across evaluation teams
- Debugging evaluation systems that show inconsistent results
- Designing A/B tests for prompt or model changes
- Creating rubrics for human or automated evaluation
- Analyzing correlation between automated and human judgments

## Core Concepts

### The Evaluation Taxonomy

Evaluation approaches fall into two primary categories with distinct reliability profiles:

**Direct Scoring**: A single LLM rates one response on a defined scale.
- Best for: Objective criteria (factual accuracy, instruction following, toxicity)
- Reliability: Moderate to high for well-defined criteria
- Failure mode: Score calibration drift, inconsistent scale interpretation

**Pairwise Comparison**: An LLM compares two responses and selects the better one.
- Best for: Subjective preferences (tone, style, persuasiveness)
- Reliability: Higher than direct scoring for preferences
- Failure mode: Position bias, length bias

Research from the MT-Bench paper (Zheng et al., 2023) establishes that pairwise comparison achieves higher agreement with human judges than direct scoring for preference-based evaluation, while direct scoring remains appropriate for objective criteria with clear ground truth.

### The Bias Landscape

LLM judges exhibit systematic biases that must be actively mitigated:

**Position Bias**: First-position responses receive preferential treatment in pairwise comparison. Mitigation: Evaluate twice with swapped positions, use majority vote or consistency check.

**Length Bias**: Longer responses are rated higher regardless of quality. Mitigation: Explicit prompting to ignore length, length-normalized scoring.

**Self-Enhancement Bias**: Models rate their own outputs higher. Mitigation: Use different models for generation and evaluation, or acknowledge limitation.

**Verbosity Bias**: Detailed explanations receive higher scores even when unnecessary. Mitigation: Criteria-specific rubrics that penalize irrelevant detail.

**Authority Bias**: Confident, authoritative tone rated higher regardless of accuracy. Mitigation: Require evidence citation, fact-checking layer.

### Metric Selection Framework

Choose metrics based on the evaluation task structure:

| Task Type | Primary Metrics | Secondary Metrics |
|-----------|-----------------|-------------------|
| Binary classification (pass/fail) | Recall, Precision, F1 | Cohen's κ |
| Ordinal scale (1-5 rating) | Spearman's ρ, Kendall's τ | Cohen's κ (weighted) |
| Pairwise preference | Agreement rate, Position consistency | Confidence calibration |
| Multi-label | Macro-F1, Micro-F1 | Per-label precision/recall |

The critical insight: High absolute agreement matters less than systematic disagreement patterns. A judge that consistently disagrees with humans on specific criteria is more problematic than one with random noise.

## Evaluation Approaches

### Direct Scoring Implementation

Direct scoring requires three components: clear criteria, a calibrated scale, and structured output format.

**Criteria Definition Pattern**:
```
Criterion: [Name]
Description: [What this criterion measures]
Weight: [Relative importance, 0-1]
```

**Scale Calibration**:
- 1-3 scales: Binary with neutral option, lowest cognitive load
- 1-5 scales: Standard Likert, good balance of granularity and reliability
- 1-10 scales: High granularity but harder to calibrate, use only with detailed rubrics

**Prompt Structure for Direct Scoring**:
```
You are an expert evaluator assessing response quality.

## Task
Evaluate the following response against each criterion.

## Original Prompt
{prompt}

## Response to Evaluate
{response}

## Criteria
{for each criterion: name, description, weight}

## Instructions
For each criterion:
1. Find specific evidence in the response
2. Score according to the rubric (1-{max} scale)
3. Justify your score with evidence
4. Suggest one specific improvement

## Output Format
Respond with structured JSON containing scores, justifications, and summary.
```

**Chain-of-Thought Requirement**: All scoring prompts must require justification before the score. Research shows this improves reliability by 15-25% compared to score-first approaches.

### Pairwise Comparison Implementation

Pairwise comparison is inherently more reliable for preference-based evaluation but requires bias mitigation.

**Position Bias Mitigation Protocol**:
1. First pass: Response A in first position, Response B in second
2. Second pass: Response B in first position, Response A in second
3. Consistency check: If passes disagree, return TIE with reduced confidence
4. Final verdict: Consistent winner with averaged confidence

**Prompt Structure for Pairwise Comparison**:
```
You are an expert evaluator comparing two AI responses.

## Critical Instructions
- Do NOT prefer responses because they are longer
- Do NOT prefer responses based on position (first vs second)
- Focus ONLY on quality according to the specified criteria
- Ties are acceptable when responses are genuinely equivalent

## Original Prompt
{prompt}

## Response A
{response_a}

## Response B
{response_b}

## Comparison Criteria
{criteria list}

## Instructions
1. Analyze each response independently first
2. Compare them on each criterion
3. Determine overall winner with confidence level

## Output Format
JSON with per-criterion comparison, overall winner, confidence (0-1), and reasoning.
```

**Confidence Calibration**: Confidence scores should reflect position consistency:
- Both passes agree: confidence = average of individual confidences
- Passes disagree: confidence = 0.5, verdict = TIE

### Rubric Generation

Well-defined rubrics reduce evaluation variance by 40-60% compared to open-ended scoring.

**Rubric Components**:
1. **Level descriptions**: Clear boundaries for each score level
2. **Characteristics**: Observable features that define each level
3. **Examples**: Representative text for each level (optional but valuable)
4. **Edge cases**: Guidance for ambiguous situations
5. **Scoring guidelines**: General principles for consistent application

**Strictness Calibration**:
- **Lenient**: Lower bar for passing scores, appropriate for encouraging iteration
- **Balanced**: Fair, typical expectations for production use
- **Strict**: High standards, appropriate for safety-critical or high-stakes evaluation

**Domain Adaptation**: Rubrics should use domain-specific terminology. A "code readability" rubric mentions variables, functions, and comments. A "medical accuracy" rubric references clinical terminology and evidence standards.

## Practical Guidance

### Evaluation Pipeline Design

Production evaluation systems require multiple layers:

```
┌─────────────────────────────────────────────────┐
│                 Evaluation Pipeline              │
├─────────────────────────────────────────────────┤
│                                                   │
│  Input: Response + Prompt + Context               │
│           │                                       │
│           ▼                                       │
│  ┌─────────────────────┐                         │
│  │   Criteria Loader   │ ◄── Rubrics, weights    │
│  └──────────┬──────────┘                         │
│             │                                     │
│             ▼                                     │
│  ┌─────────────────────┐                         │
│  │   Primary Scorer    │ ◄── Direct or Pairwise  │
│  └──────────┬──────────┘                         │
│             │                                     │
│             ▼                                     │
│  ┌─────────────────────┐                         │
│  │   Bias Mitigation   │ ◄── Position swap, etc. │
│  └──────────┬──────────┘                         │
│             │                                     │
│             ▼                                     │
│  ┌─────────────────────┐                         │
│  │ Confidence Scoring  │ ◄── Calibration         │
│  └──────────┬──────────┘                         │
│             │                                     │
│             ▼                                     │
│  Output: Scores + Justifications + Confidence     │
│                                                   │
└─────────────────────────────────────────────────┘
```

### Common Anti-Patterns

**Anti-pattern: Scoring without justification**
- Problem: Scores lack grounding, difficult to debug or improve
- Solution: Always require evidence-based justification before score

**Anti-pattern: Single-pass pairwise comparison**
- Problem: Position bias corrupts results
- Solution: Always swap positions and check consistency

**Anti-pattern: Overloaded criteria**
- Problem: Criteria measuring multiple things are unreliable
- Solution: One criterion = one measurable aspect

**Anti-pattern: Missing edge case guidance**
- Problem: Evaluators handle ambiguous cases inconsistently
- Solution: Include edge cases in rubrics with explicit guidance

**Anti-pattern: Ignoring confidence calibration**
- Problem: High-confidence wrong judgments are worse than low-confidence
- Solution: Calibrate confidence to position consistency and evidence strength

### Decision Framework: Direct vs. Pairwise

Use this decision tree:

```
Is there an objective ground truth?
├── Yes → Direct Scoring
│   └── Examples: factual accuracy, instruction following, format compliance
│
└── No → Is it a preference or quality judgment?
    ├── Yes → Pairwise Comparison
    │   └── Examples: tone, style, persuasiveness, creativity
    │
    └── No → Consider reference-based evaluation
        └── Examples: summarization (compare to source), translation (compare to reference)
```

### Scaling Evaluation

For high-volume evaluation:

1. **Panel of LLMs (PoLL)**: Use multiple models as judges, aggregate votes
   - Reduces individual model bias
   - More expensive but more reliable for high-stakes decisions

2. **Hierarchical evaluation**: Fast cheap model for screening, expensive model for edge cases
   - Cost-effective for large volumes
   - Requires calibration of screening threshold

3. **Human-in-the-loop**: Automated evaluation for clear cases, human review for low-confidence
   - Best reliability for critical applications
   - Design feedback loop to improve automated evaluation

## Examples

### Example 1: Direct Scoring for Accuracy

**Input**:
```
Prompt: "What causes seasons on Earth?"
Response: "Seasons are caused by Earth's tilted axis. As Earth orbits the Sun, 
different hemispheres receive more direct sunlight at different times of year."
Criterion: Factual Accuracy (weight: 1.0)
Scale: 1-5
```

**Output**:
```json
{
  "criterion": "Factual Accuracy",
  "score": 5,
  "evidence": [
    "Correctly identifies axial tilt as primary cause",
    "Correctly explains differential sunlight by hemisphere",
    "No factual errors present"
  ],
  "justification": "Response accurately explains the cause of seasons with correct 
scientific reasoning. Both the axial tilt and its effect on sunlight distribution 
are correctly described.",
  "improvement": "Could add the specific tilt angle (23.5°) for completeness."
}
```

### Example 2: Pairwise Comparison with Position Swap

**Input**:
```
Prompt: "Explain machine learning to a beginner"
Response A: [Technical explanation with jargon]
Response B: [Simple analogy-based explanation]
Criteria: ["clarity", "accessibility"]
```

**First Pass (A first)**:
```json
{ "winner": "B", "confidence": 0.8 }
```

**Second Pass (B first)**:
```json
{ "winner": "A", "confidence": 0.6 }
```
(Note: Winner is A because B was in first position)

**Mapped Second Pass**:
```json
{ "winner": "B", "confidence": 0.6 }
```

**Final Result**:
```json
{
  "winner": "B",
  "confidence": 0.7,
  "positionConsistency": {
    "consistent": true,
    "firstPassWinner": "B",
    "secondPassWinner": "B"
  }
}
```

### Example 3: Rubric Generation

**Input**:
```
criterionName: "Code Readability"
criterionDescription: "How easy the code is to understand and maintain"
domain: "software engineering"
scale: "1-5"
strictness: "balanced"
```

**Output** (abbreviated):
```json
{
  "levels": [
    {
      "score": 1,
      "label": "Poor",
      "description": "Code is difficult to understand without significant effort",
      "characteristics": [
        "No meaningful variable or function names",
        "No comments or documentation",
        "Deeply nested or convoluted logic"
      ]
    },
    {
      "score": 3,
      "label": "Adequate",
      "description": "Code is understandable with some effort",
      "characteristics": [
        "Most variables have meaningful names",
        "Basic comments present for complex sections",
        "Logic is followable but could be cleaner"
      ]
    },
    {
      "score": 5,
      "label": "Excellent",
      "description": "Code is immediately clear and maintainable",
      "characteristics": [
        "All names are descriptive and consistent",
        "Comprehensive documentation",
        "Clean, modular structure"
      ]
    }
  ],
  "edgeCases": [
    {
      "situation": "Code is well-structured but uses domain-specific abbreviations",
      "guidance": "Score based on readability for domain experts, not general audience"
    }
  ]
}
```

## Guidelines

1. **Always require justification before scores** - Chain-of-thought prompting improves reliability by 15-25%

2. **Always swap positions in pairwise comparison** - Single-pass comparison is corrupted by position bias

3. **Match scale granularity to rubric specificity** - Don't use 1-10 without detailed level descriptions

4. **Separate objective and subjective criteria** - Use direct scoring for objective, pairwise for subjective

5. **Include confidence scores** - Calibrate to position consistency and evidence strength

6. **Define edge cases explicitly** - Ambiguous situations cause the most evaluation variance

7. **Use domain-specific rubrics** - Generic rubrics produce generic (less useful) evaluations

8. **Validate against human judgments** - Automated evaluation is only valuable if it correlates with human assessment

9. **Monitor for systematic bias** - Track disagreement patterns by criterion, response type, model

10. **Design for iteration** - Evaluation systems improve with feedback loops

## Integration

This skill integrates with:

- **context-fundamentals** - Evaluation prompts require effective context structure
- **tool-design** - Evaluation tools need proper schemas and error handling
- **context-optimization** - Evaluation prompts can be optimized for token efficiency
- **evaluation** (foundational) - This skill extends the foundational evaluation concepts

## References

Internal reference:
- [LLM-as-Judge Implementation Patterns](./references/implementation-patterns.md)
- [Bias Mitigation Techniques](./references/bias-mitigation.md)
- [Metric Selection Guide](./references/metrics-guide.md)

External research:
- [Eugene Yan: Evaluating the Effectiveness of LLM-Evaluators](https://eugeneyan.com/writing/llm-evaluators/)
- [Judging LLM-as-a-Judge (Zheng et al., 2023)](https://arxiv.org/abs/2306.05685)
- [G-Eval: NLG Evaluation using GPT-4 (Liu et al., 2023)](https://arxiv.org/abs/2303.16634)
- [Large Language Models are not Fair Evaluators (Wang et al., 2023)](https://arxiv.org/abs/2305.17926)

Related skills in this collection:
- evaluation - Foundational evaluation concepts
- context-fundamentals - Context structure for evaluation prompts
- tool-design - Building evaluation tools

---

## Skill Metadata

**Created**: 2024-12-24
**Last Updated**: 2024-12-24
**Author**: Muratcan Koylan
**Version**: 1.0.0


---

## 10. 项目开发 (project-development)

# Project Development Methodology

This skill covers the principles for identifying tasks suited to LLM processing, designing effective project architectures, and iterating rapidly using agent-assisted development. The methodology applies whether building a batch processing pipeline, a multi-agent research system, or an interactive agent application.

## When to Activate

Activate this skill when:
- Starting a new project that might benefit from LLM processing
- Evaluating whether a task is well-suited for agents versus traditional code
- Designing the architecture for an LLM-powered application
- Planning a batch processing pipeline with structured outputs
- Choosing between single-agent and multi-agent approaches
- Estimating costs and timelines for LLM-heavy projects

## Core Concepts

### Task-Model Fit Recognition

Not every problem benefits from LLM processing. The first step in any project is evaluating whether the task characteristics align with LLM strengths. This evaluation should happen before writing any code.

**LLM-suited tasks share these characteristics:**

| Characteristic | Why It Fits |
|----------------|-------------|
| Synthesis across sources | LLMs excel at combining information from multiple inputs |
| Subjective judgment with rubrics | LLMs handle grading, evaluation, and classification with criteria |
| Natural language output | When the goal is human-readable text, not structured data |
| Error tolerance | Individual failures do not break the overall system |
| Batch processing | No conversational state required between items |
| Domain knowledge in training | The model already has relevant context |

**LLM-unsuited tasks share these characteristics:**

| Characteristic | Why It Fails |
|----------------|--------------|
| Precise computation | Math, counting, and exact algorithms are unreliable |
| Real-time requirements | LLM latency is too high for sub-second responses |
| Perfect accuracy requirements | Hallucination risk makes 100% accuracy impossible |
| Proprietary data dependence | The model lacks necessary context |
| Sequential dependencies | Each step depends heavily on the previous result |
| Deterministic output requirements | Same input must produce identical output |

The evaluation should happen through manual prototyping: take one representative example and test it directly with the target model before building any automation.

### The Manual Prototype Step

Before investing in automation, validate task-model fit with a manual test. Copy one representative input into the model interface. Evaluate the output quality. This takes minutes and prevents hours of wasted development.

This validation answers critical questions:
- Does the model have the knowledge required for this task?
- Can the model produce output in the format you need?
- What level of quality should you expect at scale?
- Are there obvious failure modes to address?

If the manual prototype fails, the automated system will fail. If it succeeds, you have a baseline for comparison and a template for prompt design.

### Pipeline Architecture

LLM projects benefit from staged pipeline architectures where each stage is:
- **Discrete**: Clear boundaries between stages
- **Idempotent**: Re-running produces the same result
- **Cacheable**: Intermediate results persist to disk
- **Independent**: Each stage can run separately

**The canonical pipeline structure:**

```
acquire → prepare → process → parse → render
```

1. **Acquire**: Fetch raw data from sources (APIs, files, databases)
2. **Prepare**: Transform data into prompt format
3. **Process**: Execute LLM calls (the expensive, non-deterministic step)
4. **Parse**: Extract structured data from LLM outputs
5. **Render**: Generate final outputs (reports, files, visualizations)

Stages 1, 2, 4, and 5 are deterministic. Stage 3 is non-deterministic and expensive. This separation allows re-running the expensive LLM stage only when necessary, while iterating quickly on parsing and rendering.

### File System as State Machine

Use the file system to track pipeline state rather than databases or in-memory structures. Each processing unit gets a directory. Each stage completion is marked by file existence.

```
data/{id}/
├── raw.json         # acquire stage complete
├── prompt.md        # prepare stage complete
├── response.md      # process stage complete
├── parsed.json      # parse stage complete
```

To check if an item needs processing: check if the output file exists. To re-run a stage: delete its output file and downstream files. To debug: read the intermediate files directly.

This pattern provides:
- Natural idempotency (file existence gates execution)
- Easy debugging (all state is human-readable)
- Simple parallelization (each directory is independent)
- Trivial caching (files persist across runs)

### Structured Output Design

When LLM outputs must be parsed programmatically, prompt design directly determines parsing reliability. The prompt must specify exact format requirements with examples.

**Effective structure specification includes:**

1. **Section markers**: Explicit headers or prefixes for parsing
2. **Format examples**: Show exactly what output should look like
3. **Rationale disclosure**: "I will be parsing this programmatically"
4. **Constrained values**: Enumerated options, score ranges, formats

**Example prompt structure:**
```
Analyze the following and provide your response in exactly this format:

## Summary
[Your summary here]

## Score
Rating: [1-10]

## Details
- Key point 1
- Key point 2

Follow this format exactly because I will be parsing it programmatically.
```

The parsing code must handle variations gracefully. LLMs do not follow instructions perfectly. Build parsers that:
- Use regex patterns flexible enough to handle minor formatting variations
- Provide sensible defaults when sections are missing
- Log parsing failures for later review rather than crashing

### Agent-Assisted Development

Modern agent-capable models can accelerate development significantly. The pattern is:

1. Describe the project goal and constraints
2. Let the agent generate initial implementation
3. Test and iterate on specific failures
4. Refine prompts and architecture based on results

This is about rapid iteration: generate, test, fix, repeat. The agent handles boilerplate and initial structure while you focus on domain-specific requirements and edge cases.

Key practices for effective agent-assisted development:
- Provide clear, specific requirements upfront
- Break large projects into discrete components
- Test each component before moving to the next
- Keep the agent focused on one task at a time

### Cost and Scale Estimation

LLM processing has predictable costs that should be estimated before starting. The formula:

```
Total cost = (items × tokens_per_item × price_per_token) + API overhead
```

For batch processing:
- Estimate input tokens per item (prompt + context)
- Estimate output tokens per item (typical response length)
- Multiply by item count
- Add 20-30% buffer for retries and failures

Track actual costs during development. If costs exceed estimates significantly, re-evaluate the approach. Consider:
- Reducing context length through truncation
- Using smaller models for simpler items
- Caching and reusing partial results
- Parallel processing to reduce wall-clock time (not token cost)

## Detailed Topics

### Choosing Single vs Multi-Agent Architecture

Single-agent pipelines work for:
- Batch processing with independent items
- Tasks where items do not interact
- Simpler cost and complexity management

Multi-agent architectures work for:
- Parallel exploration of different aspects
- Tasks exceeding single context window capacity
- When specialized sub-agents improve quality

The primary reason for multi-agent is context isolation, not role anthropomorphization. Sub-agents get fresh context windows for focused subtasks. This prevents context degradation on long-running tasks.

See `multi-agent-patterns` skill for detailed architecture guidance.

### Architectural Reduction

Start with minimal architecture. Add complexity only when proven necessary. Production evidence shows that removing specialized tools often improves performance.

Vercel's d0 agent achieved 100% success rate (up from 80%) by reducing from 17 specialized tools to 2 primitives: bash command execution and SQL. The file system agent pattern uses standard Unix utilities (grep, cat, find, ls) instead of custom exploration tools.

**When reduction outperforms complexity:**
- Your data layer is well-documented and consistently structured
- The model has sufficient reasoning capability
- Your specialized tools were constraining rather than enabling
- You are spending more time maintaining scaffolding than improving outcomes

**When complexity is necessary:**
- Your underlying data is messy, inconsistent, or poorly documented
- The domain requires specialized knowledge the model lacks
- Safety constraints require limiting agent capabilities
- Operations are truly complex and benefit from structured workflows

See `tool-design` skill for detailed tool architecture guidance.

### Iteration and Refactoring

Expect to refactor. Production agent systems at scale require multiple architectural iterations. Manus refactored their agent framework five times since launch. The Bitter Lesson suggests that structures added for current model limitations become constraints as models improve.

Build for change:
- Keep architecture simple and unopinionated
- Test across model strengths to verify your harness is not limiting performance
- Design systems that benefit from model improvements rather than locking in limitations

## Practical Guidance

### Project Planning Template

1. **Task Analysis**
   - What is the input? What is the desired output?
   - Is this synthesis, generation, classification, or analysis?
   - What error rate is acceptable?
   - What is the value per successful completion?

2. **Manual Validation**
   - Test one example with target model
   - Evaluate output quality and format
   - Identify failure modes
   - Estimate tokens per item

3. **Architecture Selection**
   - Single pipeline vs multi-agent
   - Required tools and data sources
   - Storage and caching strategy
   - Parallelization approach

4. **Cost Estimation**
   - Items × tokens × price
   - Development time
   - Infrastructure requirements
   - Ongoing operational costs

5. **Development Plan**
   - Stage-by-stage implementation
   - Testing strategy per stage
   - Iteration milestones
   - Deployment approach

### Anti-Patterns to Avoid

**Skipping manual validation**: Building automation before verifying the model can do the task wastes significant time when the approach is fundamentally flawed.

**Monolithic pipelines**: Combining all stages into one script makes debugging and iteration difficult. Separate stages with persistent intermediate outputs.

**Over-constraining the model**: Adding guardrails, pre-filtering, and validation logic that the model could handle on its own. Test whether your scaffolding helps or hurts.

**Ignoring costs until production**: Token costs compound quickly at scale. Estimate and track from the beginning.

**Perfect parsing requirements**: Expecting LLMs to follow format instructions perfectly. Build robust parsers that handle variations.

**Premature optimization**: Adding caching, parallelization, and optimization before the basic pipeline works correctly.

## Examples

**Example 1: Batch Analysis Pipeline (Karpathy's HN Time Capsule)**

Task: Analyze 930 HN discussions from 10 years ago with hindsight grading.

Architecture:
- 5-stage pipeline: fetch → prompt → analyze → parse → render
- File system state: data/{date}/{item_id}/ with stage output files
- Structured output: 6 sections with explicit format requirements
- Parallel execution: 15 workers for LLM calls

Results: $58 total cost, ~1 hour execution, static HTML output.

**Example 2: Architectural Reduction (Vercel d0)**

Task: Text-to-SQL agent for internal analytics.

Before: 17 specialized tools, 80% success rate, 274s average execution.

After: 2 tools (bash + SQL), 100% success rate, 77s average execution.

Key insight: The semantic layer was already good documentation. Claude just needed access to read files directly.

See [Case Studies](./references/case-studies.md) for detailed analysis.

## Guidelines

1. Validate task-model fit with manual prototyping before building automation
2. Structure pipelines as discrete, idempotent, cacheable stages
3. Use the file system for state management and debugging
4. Design prompts for structured, parseable outputs with explicit format examples
5. Start with minimal architecture; add complexity only when proven necessary
6. Estimate costs early and track throughout development
7. Build robust parsers that handle LLM output variations
8. Expect and plan for multiple architectural iterations
9. Test whether scaffolding helps or constrains model performance
10. Use agent-assisted development for rapid iteration on implementation

## Integration

This skill connects to:
- context-fundamentals - Understanding context constraints for prompt design
- tool-design - Designing tools for agent systems within pipelines
- multi-agent-patterns - When to use multi-agent versus single pipelines
- evaluation - Evaluating pipeline outputs and agent performance
- context-compression - Managing context when pipelines exceed limits

## References

Internal references:
- [Case Studies](./references/case-studies.md) - Karpathy HN Capsule, Vercel d0, Manus patterns
- [Pipeline Patterns](./references/pipeline-patterns.md) - Detailed pipeline architecture guidance

Related skills in this collection:
- tool-design - Tool architecture and reduction patterns
- multi-agent-patterns - When to use multi-agent architectures
- evaluation - Output evaluation frameworks

External resources:
- Karpathy's HN Time Capsule project: https://github.com/karpathy/hn-time-capsule
- Vercel d0 architectural reduction: https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools
- Manus context engineering: Peak Ji's blog on context engineering lessons
- Anthropic multi-agent research: How we built our multi-agent research system

---

## Skill Metadata

**Created**: 2025-12-25
**Last Updated**: 2025-12-25
**Author**: Agent Skills for Context Engineering Contributors
**Version**: 1.0.0


---

## 11. BDI 心理状态 (bdi-mental-states)

# BDI Mental State Modeling

Transform external RDF context into agent mental states (beliefs, desires, intentions) using formal BDI ontology patterns. This skill enables agents to reason about context through cognitive architecture, supporting deliberative reasoning, explainability, and semantic interoperability within multi-agent systems.

## When to Activate

Activate this skill when:
- Processing external RDF context into agent beliefs about world states
- Modeling rational agency with perception, deliberation, and action cycles
- Enabling explainability through traceable reasoning chains
- Implementing BDI frameworks (SEMAS, JADE, JADEX)
- Augmenting LLMs with formal cognitive structures (Logic Augmented Generation)
- Coordinating mental states across multi-agent platforms
- Tracking temporal evolution of beliefs, desires, and intentions
- Linking motivational states to action plans

## Core Concepts

### Mental Reality Architecture

**Mental States (Endurants)**: Persistent cognitive attributes
- `Belief`: What the agent believes to be true about the world
- `Desire`: What the agent wishes to bring about
- `Intention`: What the agent commits to achieving

**Mental Processes (Perdurants)**: Events that modify mental states
- `BeliefProcess`: Forming/updating beliefs from perception
- `DesireProcess`: Generating desires from beliefs
- `IntentionProcess`: Committing to desires as actionable intentions

### Cognitive Chain Pattern

```turtle
:Belief_store_open a bdi:Belief ;
    rdfs:comment "Store is open" ;
    bdi:motivates :Desire_buy_groceries .

:Desire_buy_groceries a bdi:Desire ;
    rdfs:comment "I desire to buy groceries" ;
    bdi:isMotivatedBy :Belief_store_open .

:Intention_go_shopping a bdi:Intention ;
    rdfs:comment "I will buy groceries" ;
    bdi:fulfils :Desire_buy_groceries ;
    bdi:isSupportedBy :Belief_store_open ;
    bdi:specifies :Plan_shopping .
```

### World State Grounding

Mental states reference structured configurations of the environment:

```turtle
:Agent_A a bdi:Agent ;
    bdi:perceives :WorldState_WS1 ;
    bdi:hasMentalState :Belief_B1 .

:WorldState_WS1 a bdi:WorldState ;
    rdfs:comment "Meeting scheduled at 10am in Room 5" ;
    bdi:atTime :TimeInstant_10am .

:Belief_B1 a bdi:Belief ;
    bdi:refersTo :WorldState_WS1 .
```

### Goal-Directed Planning

Intentions specify plans that address goals through task sequences:

```turtle
:Intention_I1 bdi:specifies :Plan_P1 .

:Plan_P1 a bdi:Plan ;
    bdi:addresses :Goal_G1 ;
    bdi:beginsWith :Task_T1 ;
    bdi:endsWith :Task_T3 .

:Task_T1 bdi:precedes :Task_T2 .
:Task_T2 bdi:precedes :Task_T3 .
```

## T2B2T Paradigm

Triples-to-Beliefs-to-Triples implements bidirectional flow between RDF knowledge graphs and internal mental states:

**Phase 1: Triples-to-Beliefs**
```turtle
# External RDF context triggers belief formation
:WorldState_notification a bdi:WorldState ;
    rdfs:comment "Push notification: Payment request $250" ;
    bdi:triggers :BeliefProcess_BP1 .

:BeliefProcess_BP1 a bdi:BeliefProcess ;
    bdi:generates :Belief_payment_request .
```

**Phase 2: Beliefs-to-Triples**
```turtle
# Mental deliberation produces new RDF output
:Intention_pay a bdi:Intention ;
    bdi:specifies :Plan_payment .

:PlanExecution_PE1 a bdi:PlanExecution ;
    bdi:satisfies :Plan_payment ;
    bdi:bringsAbout :WorldState_payment_complete .
```

## Notation Selection by Level

| C4 Level | Notation | Mental State Representation |
|----------|----------|----------------------------|
| L1 Context | ArchiMate | Agent boundaries, external perception sources |
| L2 Container | ArchiMate | BDI reasoning engine, belief store, plan executor |
| L3 Component | UML | Mental state managers, process handlers |
| L4 Code | UML/RDF | Belief/Desire/Intention classes, ontology instances |

## Justification and Explainability

Mental entities link to supporting evidence for traceable reasoning:

```turtle
:Belief_B1 a bdi:Belief ;
    bdi:isJustifiedBy :Justification_J1 .

:Justification_J1 a bdi:Justification ;
    rdfs:comment "Official announcement received via email" .

:Intention_I1 a bdi:Intention ;
    bdi:isJustifiedBy :Justification_J2 .

:Justification_J2 a bdi:Justification ;
    rdfs:comment "Location precondition satisfied" .
```

## Temporal Dimensions

Mental states persist over bounded time periods:

```turtle
:Belief_B1 a bdi:Belief ;
    bdi:hasValidity :TimeInterval_TI1 .

:TimeInterval_TI1 a bdi:TimeInterval ;
    bdi:hasStartTime :TimeInstant_9am ;
    bdi:hasEndTime :TimeInstant_11am .
```

Query mental states active at specific moments:

```sparql
SELECT ?mentalState WHERE {
    ?mentalState bdi:hasValidity ?interval .
    ?interval bdi:hasStartTime ?start ;
              bdi:hasEndTime ?end .
    FILTER(?start <= "2025-01-04T10:00:00"^^xsd:dateTime && 
           ?end >= "2025-01-04T10:00:00"^^xsd:dateTime)
}
```

## Compositional Mental Entities

Complex mental entities decompose into constituent parts for selective updates:

```turtle
:Belief_meeting a bdi:Belief ;
    rdfs:comment "Meeting at 10am in Room 5" ;
    bdi:hasPart :Belief_meeting_time , :Belief_meeting_location .

# Update only location component
:BeliefProcess_update a bdi:BeliefProcess ;
    bdi:modifies :Belief_meeting_location .
```

## Integration Patterns

### Logic Augmented Generation (LAG)

Augment LLM outputs with ontological constraints:

```python
def augment_llm_with_bdi_ontology(prompt, ontology_graph):
    ontology_context = serialize_ontology(ontology_graph, format='turtle')
    augmented_prompt = f"{ontology_context}\n\n{prompt}"
    
    response = llm.generate(augmented_prompt)
    triples = extract_rdf_triples(response)
    
    is_consistent = validate_triples(triples, ontology_graph)
    return triples if is_consistent else retry_with_feedback()
```

### SEMAS Rule Translation

Map BDI ontology to executable production rules:

```prolog
% Belief triggers desire formation
[HEAD: belief(agent_a, store_open)] / 
[CONDITIONALS: time(weekday_afternoon)] » 
[TAIL: generate_desire(agent_a, buy_groceries)].

% Desire triggers intention commitment
[HEAD: desire(agent_a, buy_groceries)] / 
[CONDITIONALS: belief(agent_a, has_shopping_list)] » 
[TAIL: commit_intention(agent_a, buy_groceries)].
```

## Guidelines

1. Model world states as configurations independent of agent perspectives, providing referential substrate for mental states.

2. Distinguish endurants (persistent mental states) from perdurants (temporal mental processes), aligning with DOLCE ontology.

3. Treat goals as descriptions rather than mental states, maintaining separation between cognitive and planning layers.

4. Use `hasPart` relations for meronymic structures enabling selective belief updates.

5. Associate every mental entity with temporal constructs via `atTime` or `hasValidity`.

6. Use bidirectional property pairs (`motivates`/`isMotivatedBy`, `generates`/`isGeneratedBy`) for flexible querying.

7. Link mental entities to `Justification` instances for explainability and trust.

8. Implement T2B2T through: (1) translate RDF to beliefs, (2) execute BDI reasoning, (3) project mental states back to RDF.

9. Define existential restrictions on mental processes (e.g., `BeliefProcess ⊑ ∃generates.Belief`).

10. Reuse established ODPs (EventCore, Situation, TimeIndexedSituation, BasicPlan, Provenance) for interoperability.

## Competency Questions

Validate implementation against these SPARQL queries:

```sparql
# CQ1: What beliefs motivated formation of a given desire?
SELECT ?belief WHERE {
    :Desire_D1 bdi:isMotivatedBy ?belief .
}

# CQ2: Which desire does a particular intention fulfill?
SELECT ?desire WHERE {
    :Intention_I1 bdi:fulfils ?desire .
}

# CQ3: Which mental process generated a belief?
SELECT ?process WHERE {
    ?process bdi:generates :Belief_B1 .
}

# CQ4: What is the ordered sequence of tasks in a plan?
SELECT ?task ?nextTask WHERE {
    :Plan_P1 bdi:hasComponent ?task .
    OPTIONAL { ?task bdi:precedes ?nextTask }
} ORDER BY ?task
```

## Anti-Patterns

1. **Conflating mental states with world states**: Mental states reference world states, they are not world states themselves.

2. **Missing temporal bounds**: Every mental state should have validity intervals for diachronic reasoning.

3. **Flat belief structures**: Use compositional modeling with `hasPart` for complex beliefs.

4. **Implicit justifications**: Always link mental entities to explicit justification instances.

5. **Direct intention-to-action mapping**: Intentions specify plans which contain tasks; actions execute tasks.

## Integration

- **RDF Processing**: Apply after parsing external RDF context to construct cognitive representations
- **Semantic Reasoning**: Combine with ontology reasoning to infer implicit mental state relationships
- **Multi-Agent Communication**: Integrate with FIPA ACL for cross-platform belief sharing
- **Temporal Context**: Coordinate with temporal reasoning for mental state evolution
- **Explainable AI**: Feed into explanation systems tracing perception through deliberation to action
- **Neuro-Symbolic AI**: Apply in LAG pipelines to constrain LLM outputs with cognitive structures

## References

See `references/` folder for detailed documentation:
- `bdi-ontology-core.md` - Core ontology patterns and class definitions
- `rdf-examples.md` - Complete RDF/Turtle examples
- `sparql-competency.md` - Full competency question SPARQL queries
- `framework-integration.md` - SEMAS, JADE, LAG integration patterns

Primary sources:
- Zuppiroli et al. "The Belief-Desire-Intention Ontology" (2025)
- Rao & Georgeff "BDI agents: From theory to practice" (1995)
- Bratman "Intention, plans, and practical reason" (1987)

