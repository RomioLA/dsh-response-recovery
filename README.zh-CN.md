# DSH 回复防丢失

**状态：Experimental（实验性）。插件与配套核心 Fork 已公开到 GitHub；尚未通过普通 DSH 安装验收，也未获得社区市场收录。**

功能：模型流式输出可见正文后，上游返回终态错误时，把原本会消失的正文写成原 DSH 会话中的正式助手消息，持久保存为原生历史。兼容核心的 `deriveMessages` 可在受支持的重载后读取该消息；某次后续模型请求是否实际包含它，还取决于是否继续使用同一会话，以及上下文组装是否保留该消息（未被裁剪、摘要替代或排除）。不修改供应商过滤结果、原始 attempt 或错误事件。

核心依赖：必须运行具备 `RESPONSE_RECOVERY_CONTRACT_VERSION=1` 的 Recovery-aware DSH 核心，并包含 Session 扩展、Agent Loop 失败 Hook、Token Meter 兼容、Web 投影和 V4 Relationship Validator 补丁。原版 Desktop 0.2.1-rc.2 不具备这些能力，插件会拒绝启用；目前没有确认存在官方兼容版本。配套核心 Fork：[RomioLA/deepseek-harness](https://github.com/RomioLA/deepseek-harness/tree/feat/20261030-01-response-recovery)，分支 `feat/20261030-01-response-recovery`，提交 `be3d6eef82408807d4d2c6dd826f08632d937487`。插件仓库：[RomioLA/dsh-response-recovery](https://github.com/RomioLA/dsh-response-recovery)。这些是个人 GitHub 发布，不代表官方合并或发行。

选择算法：只考虑最终失败 Step 的 attempts，选择可见正文最长的一次；长度相同选择较早序号。绝不拼接多次尝试，不将隐藏 reasoning 恢复为正文，不恢复未完成工具调用。恢复标记自带源 attempt 序号，核心验证原始文本、失败终态和去重。崩溃后不依赖额外标记。

插件在兼容核心加载后自动运行，无额外按钮或命令。**禁止在未修改的 DSH 0.2.1-rc.2 上安装。** 实验性使用须先准备包含上述完整补丁（尤其 V4 校验）的隔离 DSH 构建、可解析的插件源码及 peerDependencies，并在隔离测试 Profile 中加载 `cordis.patch.yml`。新增 `dsh.bundle` 只负责声明插件配置，不会修补核心。普通插件管理器/Profile 完整安装流程尚未验收；`private: true` 保留，未发布 npm，不得覆盖生产 DSH、生产 Profile 或 Session。

dsh-purge 1.6.60 的静默 Retry 会使旧有 Usage 统计无效，这是独立问题。Recovery 不再新增一个计费 attempt，也不伪装既有错误为正常。

现阶段定向测试：`npm test`（部分测试依赖本地开发夹具或运行时）。隔离环境中的 Recovery-aware 核心 Typecheck、Build、定向 Vitest、真实 Agent Loop、Cordis 激活和卸载已经通过；完整浏览器 E2E、外部插件管理器及 Profile 安装仍未验证，不能视为普通用户安装验收。禁用 Cordis 条目并卸载插件后，不再产生新的 Recovery；手动添加的 Cordis 条目需单独移除。已保存的助手正文不会自动删除，但必须继续使用支持 Recovery 的核心与 V4 读取器，才能保证会话可读和内容可进入后续模型上下文。

详见 docs/VALIDATION.md、docs/UPSTREAM_PR.md；此前架构调查保留在 docs/ARCHITECTURE_BLOCKER.md。包仍设置 private: true。


## V4 原生格式兼容要求（Git Closure 01）

完整功能必须包含 Session Format V4 的配套 relationship 校验补丁，允许在终态失败 Turn 后追加**一条**可核实来源的原生 assistant/message。来源必须为同 Turn、同 Step 的失败 attempt，恢复内容必须与原本已输出的可见正文相同；伪造、重复、reasoning 和未完成工具调用均不得变成恢复正文。普通 assistant/message 的原有终态校验不放宽，也不升级 Session Format Version。

据本轮用户提供的历史验收记录，Turn 34（sourceAttemptSeq=732，3,753 字符）曾通过官方持久化 API 恢复、重新载入并进入 deriveMessages。本轮不访问生产 Session，未独立重演该私人样本，也不保留原文。

**发行限制：**个人核心 Fork 已公开，但尚无官方 Recovery 兼容发行版。原版 0.2.1-rc.2 无法完整支持；带 Recovery 的 Session 降级到原版 V4 时可能无法加载。插件虽已公开源码，仍为 `private: true` 且未发布 npm，不承诺原版 rc.2 直接安装。功能只针对满足失败终态、实际已输出正文、来源校验等条件的情况；不恢复所有 Provider 错误，不绕过内容过滤。
