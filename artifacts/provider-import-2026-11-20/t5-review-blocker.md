# T5 复核阻断记录（provider-import 2026-11-20）

任务 t6 attempt 4af5b9f2-2344-43f8-8e58-731d0d057bf0，verifier，2026-11-20 12:0x (+08:00)。
结论：**阶段A 安全复核 5/5 通过；阶段B 全量回归在 SDK carrier 关卡阻断（9 失败），按契约 needs_revision 退回 backend。pack/manifest/tgz/最终交付文档推迟到修复落地后重跑。**

## 阶段A 独立安全复核（全部通过，无需修改）

| 准则 | 结论 | 关键证据锚点 |
|---|---|---|
| ① 明文Key/apiKeyEnv 不落 DTO/日志/错误/前端状态/测试断言 | 通过 | src/host-providers.js list() DTO 白名单（L369-388）、ref 仅模块内私有（L295-297）、import 错误文案只含 providerId 与既定文案；src/vault.js importFromDsh 明文仅存活于 transact DPAPI 前（plain.fill(0)）；src/client.js safeProviderList/safeConflicts/safeImportResult 白名单拷贝（L66-81）；全 src 无 console.*/日志；tests 三文件 assertNoLeak + JSON.doesNotMatch 断言齐全 |
| ② 无勾选/无确认在开锁与写盘前返回 | 通过 | import() 步骤①（L390-410）先校验零 I/O；tests/provider-import.test.mjs 全流程 9 形态拒绝均 vault 字节不变 + resolve 0 次；tests/provider-import-host.test.mjs 确认门测试 vault base64 不变 |
| ③ 同 origin 合并与冲突清单符合 spec | 通过 | planImport 三态 targetSiteId（L326-355）+ vault 锁内重验（vault.js L440-455）；UI 冲突单选门（client.js L226, L294-299）；单测合并四分支/冲突结构/pinned/null 全覆盖 |
| ④ listDshProviders 纯只读零写盘 | 通过 | 模块仅 fs.readFile；单测 list 前后三文件 sha256 逐一相同；SDK 测试 fixture 字节不变断言 |
| ⑤ 导入路径零联网、detectBalanceProtocol 未变 | 通过 | 交付纪律静态断言（provider-import.test.mjs L397-404：imports 白名单 + 网络原语 regex）；src/balance.js、src/balance-http.js 与 T0 基线同 hash（09b2be03…/1eeb097d…）；index.js detectBalanceProtocol 包装器未动 |

非阻断备忘（不影响通过判定，已记录）：勾选 hasKey=false 且带 ref 的供应商，宿主端走 resolve 阶段映射（MISSING_KEY/INVALID_SECRET）而非 INVALID_INPUT；ref 缺失 → INVALID_INPUT；UI 已禁选。属 spec §行为3 与 §错误白名单两行之间的口径选择，测试已固化该行为，零写入不变。

## 阶段B 全量回归：SDK carrier 关卡阻断

| 命令 | 退出码 | 结果 |
|---|---|---|
| `node scripts/build.mjs` | 0 | fresh build 成功（final-build.log） |
| `npm test` | 0 | 272/272 通过，0 fail（final-local.log，18.2s） |
| `ELECTRON_RUN_AS_NODE=1 DSH_CHECKOUT='D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh' 'D:/FUGUI/ai/guanfangdsh/dsh/DeepSeek Harness.exe' --expose-internals --loader ./scripts/runtime-loader.mjs --test tests/host.test.mjs tests/multi-site-host.test.mjs tests/provider-import-host.test.mjs` | **1** | **20 用例 11 过 9 败**（final-sdk.log） |
| `node scripts/pack.mjs` 及后续 | 未执行 | 按“SDK 退出码0”门禁阻断，避免产出带已知失败验收的包 |

9 失败清单与根因（PI-1..PI-4）：

1. **PI-1 [high] src/index.js:15 构造函数回归**（6 失败：host.test.mjs:46/57/65/75/79、multi-site-host.test.mjs:12）
   `dshProviders ?? new DshProviderImporter(vault, ctx)` 在构造时急切构建，而上述既有 SDK 测试用最小 vault 桩（无 importFromDsh）构造 FloatingAccountsService → 抛 “floating-accounts: DshProviderImporter requires an AccountVault”。这些测试本轮零改动（hash=T0 基线），上一轮（protocol-detection 2026-11-19 final-sdk.log 18/18）全绿，回归由 t4 的 index.js 改动引入。
   **requiredFix**：改为惰性构建（首次调用 listDshProviders/importDshProviders 时才 new DshProviderImporter），保留第4参注入；旧 carrier 不应被新功能破坏。
2. **PI-2 [medium] tests/provider-import-host.test.mjs:54 call() 零参形状错误**（1 失败：L68 测试）
   `args: { request }` 无条件包装 → listDshProviders（零参描述符）收到 `{request: undefined}`，真实 gateway 拒绝 `unexpected "request"`（gateway/arguments-invalid）。
   **requiredFix**：`args: request === undefined ? {} : { request }`（对齐 src/client.js rpcWithDeadline 与 host/multi-site 既有 harness）。
3. **PI-3 [medium] tests/provider-import-host.test.mjs:63 `peer` 未定义**（1 失败：L56 描述符测试）
   测试1解构 `{ g, call, invoke }` 但 assert.rejects 内引用裸 `peer` → ReferenceError。
   **requiredFix**：在该测试解构 peer（或经 invoke 传 peer）。
4. **PI-4 [medium] tests/host.test.mjs:17 精确方法名单断言过期**（1 失败）
   实际 remote 名单新增 listDshProviders/importDshProviders，断言未更新。
   **requiredFix**：期望名单按实际顺序在 'list' 后追加两个新方法（扩展断言，不删旧断言）。

## 红线核查（本 attempt 全程）

- 真实 vault：bytes=3150，sha256=240e4771d4f6ff354da9ffc9207662866741ae3019bd5c5e07f49670b2ae53cd —— 与 T0 基线逐字节一致（sha256sum 独立工具复核）。
- DSH_HOME 零写入；未执行安装；未解密真实 vault；测试全 synthetic fixture。
- 修复落地后重跑范围：fresh build → npm test 全量 → 三组 SDK 测试（退出码0）→ pack → MANIFEST 逐路径对账 → tgz SHA256 → vault 基线复验 → final-delivery.md + final-verification.json。
