# DSH 回复防丢失

**状态：核心扩展和独立插件已进行隔离实现，但尚未达到公开发布标准。**

功能：模型流式输出可见正文后，上游返回终态错误时，把原本会消失的正文写成原 DSH 会话中的正式助手消息，持久保存并进入后续模型上下文。不修改供应商过滤结果、原始 attempt 或错误事件。

核心依赖：必须有正式提供 RESPONSE_RECOVERY_CONTRACT_VERSION=1 的 DSH 版本。原版 Desktop 0.2.1-rc.2 不具备该能力，插件会拒绝启用。尚不能假定官方将合并 PR。

选择算法：只考虑最终失败 Step 的 attempts，选择可见正文最长的一次；长度相同选择较早序号。绝不拼接多次尝试，不将隐藏 reasoning 恢复为正文，不恢复未完成工具调用。恢复标记自带源 attempt 序号，核心验证原始文本、失败终态和去重。崩溃后不依赖额外标记。

插件默认自动运行，没有额外按钮与命令。正式安装需要等待官方支持版，通过 DSH 插件机制安装、启用 Cordis 条目。禁用或卸载不会自动删掉已经持久化的助手正文。不可通过覆盖生产 node_modules 向普通用户交付。

dsh-purge 1.6.60 的静默 Retry 会使旧有 Usage 统计无效，这是独立问题。Recovery 不再新增一个计费 attempt，也不伪装既有错误为正常。

现阶段开发测试：npm test。官方 Typecheck、Build、真实 Agent Loop、Cordis 激活与卸载均已通过；完整浏览器测试及 DSH 插件管理器隔离 Profile 安装仍未验证，暂不能视为发布通过。

详见 docs/VALIDATION.md、docs/UPSTREAM_PR.md；此前架构调查保留在 docs/ARCHITECTURE_BLOCKER.md。包仍设置 private: true。


## V4 原生格式兼容要求（Git Closure 01）

完整功能必须包含 Session Format V4 的配套 relationship 校验补丁，允许在终态失败 Turn 后追加**一条**可核实来源的原生 assistant/message。来源必须为同 Turn、同 Step 的失败 attempt，恢复内容必须与原本已输出的可见正文相同；伪造、重复、reasoning 和未完成工具调用均不得变成恢复正文。普通 assistant/message 的原有终态校验不放宽，也不升级 Session Format Version。

据本轮用户提供的历史验收记录，Turn 34（sourceAttemptSeq=732，3,753 字符）曾通过官方持久化 API 恢复、重新载入并进入 deriveMessages。本轮不访问生产 Session，未独立重演该私人样本，也不保留原文。

**安装条件：**需要官方发行同时具备 Recovery 核心合同和 V4 校验补丁的 DSH 版本。原版 0.2.1-rc.2 无法完整支持；已带 Recovery 的 Session 降级到原版 V4 时可能无法加载。插件仍 private: true，不提供 npm 发布或原版 rc.2 直接安装承诺。
