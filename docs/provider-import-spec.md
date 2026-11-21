# 从DSH导入供应商规格1.2.0

## 批准范围
用户要求把DSH宿主已配置的模型供应商（含Key）导入本插件vault。T1只读取证（2026-11-20）已确认存储与读取链：provider定义在profile层 cordis.patch.yml 的 llm-pi-ai `config.providers`（本机desktop 24个，schema displayName?/apiKeyEnv/api/baseURL/models）；明文Key在 `$DSH_HOME/.credentials.yaml` 顶层 refs（引用名→明文字符串）；宿主经 credentials.resolve(ref) 按请求取值、describe(ref).configured 为原生hasKey原语。本规格冻结RPC/DTO/合并/错误码/清单契约，实现前须评审通过。获准：本插件源码、测试、文档、构建与离线包。红线（未获准即禁止）：不改DSH宿主与其它插件；不新增任何网络行为（导入与列出全程零联网）；真实vault只读——持久化写入仅发生在用户勾选+确认的导入RPC内；测试只用synthetic fixture；不读 .credentials.yaml 的值（回退口径仅允许键名集合）与 .bak/.imported/provider-usage 数据；明文Key与引用名(apiKeyEnv)不进DTO、日志、错误信息、前端状态。目标版本1.2.0。

## 行为
1. `listDshProviders(request={})` args={}：宿主只读DSH配置层，返回安全DTO，零写入（不缓存、无临时文件）。读取层序与宿主组合器一致且只读用户可编辑层：① profile补丁 `<profileDir>/cordis.patch.yml`（profileDir=`process.env.DSH_PROFILE_DIR`；缺失时 `join(DSH_HOME,'profiles',process.env.DSH_PROFILE||'desktop')`；两处都不可用→`DSH_SOURCE_UNAVAILABLE`）→ ② `$DSH_HOME/cordis.patch.yml` home层（存在才合并）→ ③ `$DSH_HOME/settings.yaml` 顶层 `llm-pi-ai:` 段（存在才合并）。文件缺失视为空层（与组合器“缺失即跳过”一致）。仅提取 `- id: llm-pi-ai` 条目的 `config.providers`；bundle层（dsh.profile.bundles 指向的node_modules补丁）不读。
2. DTO白名单：providers[] 每项仅 `{providerId, name=displayName??providerId, baseURL, hasKey:boolean, models:[{id,name?,maxTokens?}]}`；顶层仅 `{providers, hasKeyBasis:'describe'|'refs', source:[相对%DSH_HOME%的实际读取路径], version}`。apiKeyEnv 引用名、refs值、credentials取值不进返回。hasKey 优先 `ctx.get("credentials").describe(ref).configured===true`；服务不可用时回退 refs 顶层键名集合（不读值，version≠1或解析失败→全部hasKey=false且hasKeyBasis='refs'，不猜）。任一路径不得调用 resolve()。
3. `importDshProviders(request={selections,confirmText})`：仅前端两步确认后调用。selections 每项 `{providerId, targetSiteId?}`；selections 空缺/超100/重复/多余字段/含未知providerId/勾选hasKey=false项/targetSiteId指向不存在或不同origin站点 → `INVALID_INPUT`。confirmText 逐字等于 `确认导入`，否则 `INVALID_INPUT`。以上校验在任何vault I/O与任何credentials解析之前完成（先校验后开锁）。
4. 导入执行（服务层序）：① 请求形状与白名单校验（零vault I/O）→ ② 宿主重新执行与list相同的读取与校验（不信任前端转发的baseURL/models/Key）→ ③ 只读load当前vault状态做合并计划与冲突预检（冲突→`IMPORT_CONFLICT`+冲突清单，零写入）→ ④ 逐项 credentials.resolve(ref) 取明文，值仅在本次请求生命周期内存活（ref缺失/值空/不过现有secret校验→`MISSING_KEY`/`INVALID_SECRET`，整体零写入）→ ⑤ `vault.importFromDsh` 单事务提交。任一前置失败整体零写入；不做部分导入。
5. `vault.importFromDsh` 是唯一新增写入口，复用现有 transact（唯一revision+锁+DPAPI owner）：锁内重验载荷结构、selections与imports一一对应、冲突与容量（站点≤100/账号≤100/每账号凭据≤10/4MiB），任一失败原文件未覆盖。写入规则：targetSiteId为null或缺省且无同origin站点→新建站点（name=displayName‖providerId截80、baseURL、balanceQuery=null）并在其下新增账号（name=displayName‖providerId截80，balanceCredentialId=新凭据）；同origin站点存在→只新增账号不建站、站点任何字段不改。凭据：kind=model-api-key、label=providerId截80、secret=解引用值经现有DPAPI加密路径。重复导入不判重（vault无provider溯源字段），UI确认文案明示会产生重复账号。
6. 成功返回 `{revision, created:{siteIds,accountIds,credentialIds}, version}`；冲突返回 `{conflicts:[{providerId, origin, siteIds:[{id,name}]}]}`。两者均不含Key、引用名与models以外配置。
7. 明文Key纪律：值只存在于 resolve返回→DPAPI加密→vault事务 的路径内；不落DTO、日志、错误信息、前端状态/localStorage、任何测试fixture。错误信息允许出现providerId与既定文案，禁止出现引用名与值。
8. 导入完成可选链「检测协议」：仅前端引导——成功后提示可对每个新账号使用现有“检测协议”按钮；点击仍走现有 detectBalanceProtocol 显式确认与全部既有限制（最多2请求/官方站1请求、失败不显示余额零、不改数据、captured revision归属）。导入RPC自身零联网、不自动触发检测、不代填协议配置（新建站点balanceQuery=null）。

## 同origin合并规则
- origin=`new URL(baseURL).origin`（scheme+host+port，不含路径）。
- 恰好1个现有站点同origin → 默认合并：新增账号挂该站、不建新站、站点字段不变。
- ≥2个现有站点同origin → 冲突：必须显式 `targetSiteId`（或 `targetSiteId:null` 表示新建站点）才可导入；缺省返回IMPORT_CONFLICT清单，不自动选择、不自动合并。
- 0个现有站点同origin且未指定targetSiteId → 新建站点。
- 合并不按完整baseURL路径比较：站点保留自己的完整baseURL与路径，余额能力由站点现有balanceQuery决定。
- 不按相同origin/名称/Key自动合并既有账号；每次导入总是新增账号。

## 版本与清单
- 版本统一1.2.0：package.json version、src/index.js version、README；RPC返回version随之。
- package.json files：新增 `"docs/provider-import-spec.md"`、`"Plan/4. 供应商导入_plan.md"`（新src/lib/tests文件由目录通配覆盖）。
- npm test 与 scripts/verify.mjs localTests：新增 tests/provider-import.test.mjs、tests/provider-import-client.test.mjs；verify.mjs host SDK 组新增 tests/provider-import-host.test.mjs。
- scripts/build.mjs 四处清单加入 host-providers.js：src复制清单（L12）、语法检查（L20）、outputs（L24）、manifest source（L25）。
- pack.mjs/distribution.mjs 读取 package.json files，随files更新自动生效；交付时逐path hash与MANIFEST对账。

## 接缝与owner
- 新Remote：listDshProviders（只读类，超时RPC_UNAVAILABLE）；importDshProviders（写类：加入 src/client.js writing 分类与 tests/rpc-contract.test.mjs 断言，RPC超时=RESULT_UNKNOWN、不重试）。全部有名参数request；无输入 listDshProviders args={}。
- 新 src/host-providers.js：DSH配置读取+纯合并规划（无网络、无vault写、无credentials.resolve调用、无http/net/fetch导入——测试静态断言）。YAML按白名单子集解析：仅映射/序列/标量/注释，遇锚点、块标量、标签等超集结构→该层降级不可读（DSH_SOURCE_UNAVAILABLE），绝不猜；不引入YAML库、零新依赖。
- vault仍唯一持久化owner：importFromDsh 复用原transact与AccountError家族，不建第二个锁、第二vault、新schema字段。
- credentials服务经 `ctx.get("credentials")`（同树运行，T1证据§6#17）；describe仅用于hasKey、resolve仅用于导入路径；不得缓存服务对象或值到模块级。

## 错误处理白名单
| 情形 | code | 结果 |
|---|---|---|
| selections/confirmText 形状或白名单不满足 | INVALID_INPUT | 零写入 |
| 未知providerId / 勾选hasKey=false / targetSiteId非法 | INVALID_INPUT | 零写入 |
| 多站同origin冲突未决 | IMPORT_CONFLICT | 零写入+冲突清单 |
| DSH配置不可读/超集结构/profileDir两处都不可用 | DSH_SOURCE_UNAVAILABLE | 零写入 |
| ref缺失或解出空值 | MISSING_KEY | 整体零写入（事务前解析阶段即失败） |
| 解出值含空白/控制字符或超8192 | INVALID_SECRET | 整体零写入 |
| revision过期/上限 | CONFLICT / INVALID_REVISION | 零写入 |
| 锁占用或残留 | BUSY | 零写入 |
| 容量或数量上限 | SIZE_LIMIT / LIMIT | 整体零写入 |
| 读/写/DPAPI失败 | READ_FAILED / WRITE_FAILED | 原文件未覆盖 |
| 提交结果未知 | COMMIT_UNKNOWN | 要求重新载入，不盲目重试 |
| 非预期异常 | list→STORAGE_FAILED兜底；import→IMPORT_FAILED固定文案“导入失败；未写入任何变更” | 不吞异常、不吞字段 |

## 验收
1. 无勾选（selections缺失/空）或confirmText不符：RPC错误返回，vault文件sha256前后不变，无 .lock 残留。
2. listDshProviders 返回JSON序列化断言不含apiKeyEnv值、不含任何refs键名与值、仅白名单字段；hasKey与宿主describe语义一致；DSH配置文件读取前后哈希不变。
3. 同origin单站点默认合并：账号挂现有站、站点字段不变、revision+1；多站冲突→IMPORT_CONFLICT且字节不变；带合法targetSiteId或null后成功；非法targetSiteId拒绝。
4. 事务原子性：任一选中项解析失败（synthetic fixture模拟refs缺失/空Key/超长）→全部零写入，revision不变。
5. 导入产物：新站点balanceQuery=null；新账号balanceCredentialId=新凭据；凭据kind=model-api-key、label=providerId；密文沿用现有DPAPI前缀断言。
6. 前端状态不含引用名/Key；确认流程两步（预览清单→固定confirmText按钮）；成功提示复用“检测协议”按钮引导而非自动检测。
7. 版本1.2.0一致；files/test/build四清单更新，pack MANIFEST与交付逐path对账；npm test全绿（旧新全部非SDK）+隔离SDK host测试（host/multi-site/provider-import）。
8. 零新增网络行为（host-providers.js无网络导入+静态断言）；真实vault纯查看字节不变；本轮仅离线包与只读验证，安装与真实导入仍需用户另次明确授权。

## 未知与限度
- bundle层出厂provider（node_modules补丁内llm-pi-ai默认条目）不在读取范围；settings段与home层本机不存在，实现按“存在才合并”防御。
- DSH_PROFILE_DIR在宿主主进程的可见性未实测（宿主文档记载其用于profile加载进程与shell调用）；冻结回退链 desktop，实现期以一次只读运行确认并在T3证据记录。
- provider的api字段（openai-completions）不进DTO：导入与协议无关，检测仍按既有三协议执行；导入成功不假定该站可查余额。
- maikuai类跨层引用名分歧按“当前读取层的引用名”判定（T1证据§4），不按命名规则合成ref。
- 备选方案“经ctx读取llm-pi-ai运行时快照免解析”被拒：耦合宿主内部服务JS API、部分profile下服务未挂载；本规格走文件读取+严格子集解析。
