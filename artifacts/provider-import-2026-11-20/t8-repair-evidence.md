# T8 修复证据（provider-import 2026-11-20）

- 任务：t8（T7 修复：SDK 三组 9 败根因 PI-1..PI-4，宿主端），执行 backend，attempt 9bcb7e27-6dc8-4874-aabb-21d03458a811，2026-11-20 12:02–12:25 (+08:00)
- 依据：artifacts/provider-import-2026-11-20/t5-review-blocker.md 判责清单
- 写 scope：src/index.js、tests/provider-import-host.test.mjs、tests/host.test.mjs（其余文件零改动）

## 1. 修复清单与 diff 摘要

**PI-1 [high] src/index.js 构造函数急切构建 → 惰性构建 + 包装接收者兼容（合并修复，见 PI-5）**
- 初版修复：`this.dshProviders = dshProviders ?? new DshProviderImporter(vault, ctx)` 改为存参 + 首次调用时构建缓存（`??=`），保留第4参注入路径。
- 追加修复（PI-5，诊断后）：Remote 方法不得经私有类成员访问状态——typert 注册的包装接收者（`ctx.get('floatingAccounts') !== service`，方法内 `this === service` 为 false）会转发属性访问但**不透传私有字段/私有方法**（TypeError）。
- 终版形态：模块级 Symbol 槽 `dshImporterSlot`/`pluginContextSlot` + 模块级函数 `dshImporter(receiver)`（`receiver[dshImporterSlot] ??= new DshProviderImporter(receiver.vault, receiver[pluginContextSlot])`）；`listDshProviders`/`importDshProviders` 经 `dshImporter(this)` 调用。类中不再有任何私有成员参与 Remote 方法路径；旧方法（list/save/…）与 detectBalanceProtocol/queryBalance 未动。
- 证明：无 importFromDsh 的最小 vault 桩构造不再抛错（host.test.mjs 11/11、multi-site-host.test.mjs 全绿恢复）；SDK 探针 `registered.listDshProviders()` 经包装接收者返回 ok:true 且 hasKey=describe（注入 importer 生效）。

**PI-2 [med] tests/provider-import-host.test.mjs:54**
- `call` 助手：`args: { request }` → `args: request === undefined ? {} : { request }`。零参 listDshProviders 现发送 `{"args":{}}` 信封，对齐 client rpcWithDeadline 与 host/multi-site 既有 harness。

**PI-3 [med] tests/provider-import-host.test.mjs:60**
- 测试1解构 `{ g, call, invoke }` → `{ g, peer, call, invoke }`（assert.rejects 内 `peer` 不再 ReferenceError）。

**PI-4 [med] tests/host.test.mjs:17**
- remoteMethods 精确名单在 `'list'` 后追加 `'listDshProviders','importDshProviders'`，与 markRemoteMethod 顺序一致；其余 14 项逐字保留，未删任何旧断言。

## 2. 诊断过程（新增根因 PI-5 的证据链）

- probe-sdk-diagnose-t8.mjs / .log（artifacts 留档）：直调 importer.list() 与 service.listDshProviders() 均 ok:true；经 gateway 调用返回 {ok:false, STORAGE_FAILED/IMPORT_FAILED} → 差异锁定在 gateway 调用层。
- `ctx.get('floatingAccounts') === service` → false；spy 记录方法调用 `this === service: false`；`registered.list()` ok（公共属性转发）而 `registered.listDshProviders()` 抛非 AccountError（私有成员 TypeError 被 result() 兜底）→ 结论：私有成员不兼容 typert 包装接收者。
- （探针日志尾部 `gateway/signature-invalid` 为探针自身 spy 的 rest 参数伪影，与插件无关；真实方法签名均为唯一标识符参数，通过签名校验。）

## 3. 验证结果（t8 Verify 三命令 + 哈希复核）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `node scripts/build.mjs` | 0 | fresh build 成功（lib 含 Symbol 槽版 index.js） |
| `npm test` | 0 | 272/272 pass，0 fail（含 provider-import 18 用例与 UI client 测试） |
| `ELECTRON_RUN_AS_NODE=1 DSH_CHECKOUT='D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh' 'D:/FUGUI/ai/guanfangdsh/dsh/DeepSeek Harness.exe' --expose-internals --loader ./scripts/runtime-loader.mjs --test tests/host.test.mjs tests/multi-site-host.test.mjs tests/provider-import-host.test.mjs` | 0 | **20/20 pass，0 fail**（host 11 + multi-site 5 + provider-import 4；日志 final-sdk-t8.log） |
| 真实 vault 只读哈希复核 | — | bytes=3150，sha256=240e4771d4f6ff354da9ffc9207662866741ae3019bd5c5e07f49670b2ae53cd，mtime=2026-11-20T01:16:08Z —— 与 T0 基线逐字节一致 |

## 4. 红线核查

- 零网络：本修复仅改动构造/调用路径与测试 harness，无任何网络原语引入；provider-import 交付纪律静态断言仍绿。
- 除 PI-1..PI-4（及 PI-5 同文件同方法）指定位置外零改动：Remote 名单/DTO/错误码/冲突信封契约不变；UI（client.js/style.css）、文档、package.json、scripts、其它测试文件未触碰。
- 真实 vault 全程零接触；测试全 synthetic fixture + 临时目录。
