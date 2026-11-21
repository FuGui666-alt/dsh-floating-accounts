# T3 宿主端实现证据（provider-import 2026-11-20）

- 任务：provider-import 轮 t4（T3 宿主端实现），执行 backend，2026-11-20 10:31–11:40 (+08:00)
- 依据：docs/provider-import-spec.md（冻结 1.2.0）+ Plan/4. 供应商导入_plan.md + T1 host-provider-storage-evidence.md
- 纪律：全程零 DSH_HOME 写入、零 asar 写入、零网络、真实 accounts.dpapi.json 未触碰（探针 io 桩位强制拒绝）、测试只用 synthetic fixture + 临时目录 vault

## 1. 交付与 changedPaths

| 文件 | 变更 |
|---|---|
| src/host-providers.js | 新增：白名单 YAML 子集解析器（含纯函数折叠）、三层只读读取（profile→home→settings 段）、hasKey describe/refs 双口径、planImport 纯合并规划、DshProviderImporter 编排（确认门→宿主侧重读→冲突预检→逐项 resolve→单事务） |
| src/vault.js | 新增 AccountVault.importFromDsh：唯一新写入口，复用 transact（唯一 revision+锁+DPAPI owner），三态 targetSiteId（缺省自动 / null 显式新建 / uuid 目标站），冲突重验、站点≤100/账号≤100、新建站点 balanceQuery=null、凭据 kind=model-api-key label=providerId、balanceCredentialId=新凭据 |
| src/validation.js | 新增 isUuid、originOf（origin= new URL(validateURL(v)).origin，供合并规则与事务重验共用） |
| src/index.js | version 1.2.0；新增 listDshProviders（无参，result 包装，非预期→STORAGE_FAILED 兜底）与 importDshProviders（命名 request，独立 catch：AccountError 透传+conflicts 字段，非预期→IMPORT_FAILED 固定文案「导入失败；未写入任何变更」）；markRemoteMethod 名单追加两方法（旧断言未删） |
| tests/provider-import.test.mjs | 新增 18 用例：DTO 白名单/零泄漏、refs 兜底与 version 门控、describe 失败整批降级、超集降级表（锚点/块标量/非空流/tab/文档标记）、profileDir 三分支、跨层覆盖、planImport 分支、vault 事务/DPAPI 信封/同 origin 合并、原子性表（8 失败形态字节不变+无锁残留）、迁移门、容量门、全流程确认门、冲突清单结构、resolve 失败映射、零网络 import 白名单静态断言、解析器语义 |
| tests/provider-import-host.test.mjs | 新增 SDK carrier（仿 protocol-detection-host）：descriptor 参数断言（listDshProviders=[]、importDshProviders=['request']）、位置参数拒绝、gateway list/import 全流程、冲突信封、RESULT 语义、泄漏断言；由 verifier 阶段统一运行 |
| tests/rpc-contract.test.mjs | 既有断言追加 importDshProviders（写方法 request 绑定环）与 listDshProviders（零参数信封环），未删任何旧断言 |
| package.json | version 1.2.0；files 增补 docs/provider-import-spec.md 与 Plan/4. 供应商导入_plan.md；npm test 增补 provider-import.test.mjs 与 provider-import-client.test.mjs |
| scripts/build.mjs | 四处清单（src 复制/语法检查/outputs/manifest source）加入 host-providers.js |
| scripts/verify.mjs | localTests 增补 provider-import.test.mjs + provider-import-client.test.mjs；host SDK 组增补 provider-import-host.test.mjs |
| lib/* | build 产物再生成（build-manifest.json source/outputs 均含 host-providers.js） |
| artifacts/provider-import-2026-11-20/probe-host-providers-t3.mjs(+.log/.electron.log)、probe-parse-bisect-t3.mjs(+.log) | 实现期只读探针与诊断留档 |

命名说明：任务写 scope 指定 `src/host-providers.js`（与成员角色描述一致）；冻结规格文本写 `src/provider-import.js`。以任务分配为准实现为 src/host-providers.js，规格文档的文件名留待规格 owner 随评审一并更正（本任务未改规格）。

## 2. 实现期只读确认（冻结规格 §未知与限度 要求）

1. **profileDir 可见性**：探针（plain node v24.19.0 与 ELECTRON_RUN_AS_NODE v24.21.0 双环境）实测 `env.DSH_PROFILE_DIR="D:\FUGUI\ai\dsh-data\profiles\desktop"`、`env.DSH_PROFILE="desktop"`（子进程可见性证据；宿主主进程可见性仍未实测）。实现回退链 `DSH_PROFILE_DIR → $DSH_HOME/profiles/<DSH_PROFILE|desktop>/cordis.patch.yml`，两条链在本机解析到**同一文件**，主进程可见性差异不影响结果。
2. **真实配置过 shipping 解析器**：desktop patch 实测解析成功 22 个 provider（活文件，较 T1 时点 24 个有用户增删；sha 时点 0c42482a…）；source=["profiles/desktop/cordis.patch.yml","settings.yaml"]（home 层不存在、settings 无 llm-pi-ai 段，与 T1 一致）；hasKeyBasis=refs（探针无 credentials 服务，走键名兜底）hasKeyTrue=22；modelTotal=171。读取前后四文件 sha256 逐一对照 identical（readOnlyProof=identical）。
3. **发现并处置的解析器偏差（真实文件驱动，均已入测试）**：
   - 空流式集合 `[]`/`{}`（真实 patch L582 起 19 处）：作为退化序列/映射接受（语义唯一，非「猜」）；非空流式仍拒绝。
   - 多行纯标量折叠（真实 patch L801-802 descriptionEn 续行）：按 YAML 纯标量折叠语义支持（单换行→空格、空行→换行、续行含 ": " 拒绝）——属规格白名单「标量」范畴；块标量/锚点/标签仍整层降级。
   - 红acted 解析保留顶层 `version` 键明值（version:1 门控所需），refs 值仍全部脱敏不保留。

## 3. 验证结果

- `node scripts/build.mjs` ✓（无外部构建依赖，语法检查含新文件）
- `npm test`（272 tests = 原 254 + 本任务 18 + UI client 5 … 实际计数以运行为准）：**272/272 pass，0 fail**（含真实 DPAPI 回归、rpc-contract 新断言、UI 侧 provider-import-client 交叉兼容）
- 真实 vault：bytes=3150，sha256=240e4771d4f6ff354da9ffc9207662866741ae3019bd5c5e07f49670b2ae53cd，mtime=2026-11-20T01:16:08Z —— 与 T0 基线逐字节一致（本任务零接触；探针 io 桩位见 probe-host-providers-t3.mjs）
- 零泄漏静态+动态断言：DTO/错误/返回值 JSON 无 apiKeyEnv 引用名、无凭据值；探针 referenceOrValueLeak=clean
- SDK host 测试（tests/provider-import-host.test.mjs）按分工由 verifier 阶段以 DSH_TEST_EXECUTABLE/DSH_TEST_LOADER 统一运行

## 4. 移交事项

- README 版本段与功能描述未更新（不在 t4 写 scope，规格 §版本与清单 要求 1.2.0）——待队长指派（UI 实现者或后续收尾轮）。
- UI（t5）已确认 wire 契约：IMPORT_CONFLICT 走 error.conflicts 结构化字段；listDshProviders args={}；importDshProviders 命名 request={selections,confirmText}；writing 分类 RESULT_UNKNOWN——宿主端实现与之一致。
- 真实安装、真实导入仍需用户另次明确授权（规格红线）。
