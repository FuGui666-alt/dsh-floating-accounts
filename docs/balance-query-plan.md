# 手动余额查询实施与续作计划

## 最新钱包误拒绝修复（2026-11-19 16:54诊断）
用户点击按钮得到BALANCE_REJECTED。新明确授权的一次GET返回HTTP200/isValid=true、USD、balance=remaining=1.70511289，无status/quota/subscription/error；旧解析器因全局要求status=active而拒绝。诊断mode不在旧安全白名单，被脱敏，不能宣称修复版完整实测通过。固定Sub2API上游明确unrestricted钱包分支无status；源码仅在明确该模式+严格钱包字段时接受，未知模式不从balance猜测。quota_limited仍须status=active及完整quota；订阅拒绝，钱包真实零/负数如实显示。

仅修改现有解析owner，复用BalanceQuery→RPC→现有客户端，无新增协议/网络/持久化/凭据路径。钱包输出accountBalance available与keyQuota unlimited，后者仅代表无独立key额度，不是无限账户资金。全局status必需约束退役，限额分支约束仍保留。TDD off/post-change regression，源测试增加钱包失效/未知/单位/矛盾/零/负数与客户端、实际SDK路径；构建退出0，本地100/100、SDK10/10。独立只读审查无Critical/Important，唯一Minor为文档状态未同步，已由Lead对照回归证据同步；审查不代替部署授权或真实页面验收。

**用户已另行授权覆盖钱包修复版，部署切片不改profile/vault、不重启/浏览器操作、不请求平台。** 保留旧完整插件树及配置快照，独占stage/CAS替换后核验完整安装树、8保护对象与实际SDK隔离加载；本机收据为安装完成依据，不能以收据代替重启后的真实页面验收。后文保留各阶段历史结果，不把当时的“当前/不支持”视为最新状态。

## 目标、依据与边界（最初实现阶段）
用户已批准本会话列出的手动查询方向。当前工作区和安装版均为 1.0.2；账号保存的 RPC 已修复。已有 PLAN.md 的 CRUD、DPAPI、元数据-only 出口保持不变；本计划只扩展“余额查询”，取代旧计划中的不查询余额非目标，不改变其它边界。复查报告 2026-11-19_代码复查-report.md 的其它故障路径未全部解决，本计划不宣称解决它们。

平台是否为 New API、路径及单位仍未知。因此本次实现的是可离线验证的查询能力，默认不启用网络。没有 balanceQuery 配置或配置不合法时，查询立即返回安全错误，不读取账号文件、不解密密钥、不发 DNS/HTTP 请求。真实平台接入仍需接口资料和单独授权，覆盖安装也需单独授权。

技术：现有 JavaScript / React / Cordis Remote / Node 24.19.0，无新增第三方依赖。内联实施，最后独立只读复查；不创建 Git 分支、不提交、不部署。TDD Route: mode off; decision skipped; strict authority not applicable; posture post-change regression。

TaskStartSnapshot：artifacts/balance-query-2026-11-19/baseline 保存了 37 个项目文件及 SHA-256。首次命令因 shell 引号失败且未执行写入；修正后完成快照。源码校验基线使用读取工具 revision。回滚仅恢复本轮项目文件，不触碰已安装文件或账号文件。

## 已固定的设计
- 新 RPC queryBalance(request)，参数只有 id 和 revision；args:{request:{id,revision}}。保留 list/save/remove 原契约。
- 余额配置由宿主插件配置 balanceQuery 提供：protocol 必须为 new-api-token-usage；endpointPath 必须为无 query/hash、无身份信息的根相对路径；unit 显式为 USD/CNY/QUOTA；quotaPerUnit 为正的有限数（QUOTA 时必须为 1）。无默认倍率、无默认汇率、无自动站点识别、无自定义跨域 URL。
- Vault 仍为唯一密钥数据源。新增只读 lookupForBalance，验证请求、读取当前修订并只在宿主返回选中账号的必要字段；不暴露 RPC，不写文件、不递增 revision。请求前以及返回前验证配置修订，变化时不显示旧结果。
- BalanceQuery 在任何密钥读取之前验证配置。每账号同一宿主实例限一个在途查询，宿主实例全局限 4 个（包括尚未确定存在的 UUID）；整个读取/请求/后置核验最多 12 秒。超时后的不可取消读取仍占槽至结束，防止迟到请求和无限排队。底层 HTTPS 最多 10 秒、JSON 响应最多 64 KiB。
- HTTPS 直连所保存 URL 的同一 origin，余额路径显式由配置提供。禁止跟随重定向；仅 Bearer API key，不使用 groupKey、Cookie、代理或模型接口。DNS 一次解析并固定合法公网地址到 HTTPS lookup；拒绝私网/回环/保留地址，避免新增 SSRF 面。该限制只适用于余额请求，不改变账号原有 URL 保存规则。
- New API 解析：业务 code:true；data.total_available 为密钥额度，data.unlimited_quota 为无限标志；可选 data.user_quota.total_available 为账户余额。有限数与严格十进制数值字符串可接受；空白、null、NaN、Infinity、超出安全整数范围及非法结构拒绝；十进制字符串在 Number 转换前按原文比较范围，非零额度换算下溢成零也拒绝。缺少账户字段仅标为 unavailable，不能用密钥额度代替；存在但非法的账户数据应报响应错误。失败不产生金额。
- 返回只包含 accountId/revision/protocol/queriedAt/accountBalance/keyQuota；数值为 amount + unit，无限额度为 status:unlimited（没有伪造金额）；未提供账户余额为 status:unavailable。
- UI 每账号按钮和独立状态，未查询/查询中/成功/失败分开。结果仅内存，不写账号或 localStorage。保留历史成功结果时标“上次成功结果（非本次）”。重新载入、编辑、删除、保存、未知写入结果时使余额请求世代失效，迟到结果不能覆盖新配置。关闭/卸载也使在途结果失效。客户端同步在途 ref 阻止同一事件循环双击。

## 修改必要性与职责
现有 UI 和宿主无查询入口，纯配置修改无法满足需求。新增 src/balance.js 负责配置/解析/查询编排，src/balance-http.js 负责 HTTPS 公网/超时/大小边界；index.js 只接线，vault.js 只加只读查找，client.js 和 style.css 加展示/状态；build.mjs 将新必需模块纳入复制、语法和清单。复用既有 RPC 与 DPAPI，不复制原余额插件。预计核心模块各小于 250 行，保持可审查边界。

无退休或迁移，无 schema 改动，无 fallback 链。保留分布出去的 CRUD、版本和文件路径。版本本轮仍为 1.0.2（未发布开发修改），文档明确安装版不会自动获得功能。

## 任务与验证
1. 保存基线、运行 npm test（修改前）；记录现有失败，不修 unrelated 项。
2. 实现 balance.js / balance-http.js / vault.js / index.js：queryBalance 默认关闭、修订检查、受限 HTTPS、安全输出；新 tests/balance.test.mjs 和 tests/balance-http.test.mjs 使用合成数据和注入传输/DNS，不实际连接网络。
3. 实现账号按钮和状态；新 tests/balance-client.test.mjs 在生成客户端 hook harness 运行真实处理函数，验证无自动请求、双击抑制、迟到结果、零值/无限/失败/历史结果。不是浏览器验收。
4. 修改 build.mjs 仅纳入新增模块；package.json test 和 scripts/verify.mjs 加新测试，不改变既有断言以求通过。tests/host.test.mjs 仅扩展预期的 remote 名称及新 SDK 测试；隔离 Context 和合成 vault，不真实 RPC。
5. node scripts/build.mjs；npm test；通过现有 runtime-loader 运行隔离 SDK。Node 不启动 GUI。保留完整命令、退出码和输出于 artifacts/balance-query-2026-11-19/verification.json。
6. 独立只读审查新增功能，Lead 复核最后差异；修正本轮缺陷、再跑验证，更新 README 和本计划的结果节。

## 验收与完成边界
本轮完成证据：按钮、元数据-only RPC、默认关闭、成功/失败语义、严格额度单位、无持久化查询、竞态和网络安全边界均由测试证明；新增模块构建完整；原回归不新增失败。真实平台/真实密钥/页面/覆盖安装不属于本轮完成证据，必须明确未验证。

## Sub2API 续作（2026-11-19 15:27）
用户明确授权仅一次 `GET https://yizhichun.online/v1/usage`，使用本站已保存 API key；不调用模型、无重试、不覆盖安装。单次执行脚本有独占 `wx` 账本，重跑会拒绝；密钥仅内存和TLS请求头。实测 HTTP 200，`mode:quota_limited/isValid:true/status:active`；顶层 `unit:USD`，`quota:{limit:2.5,used:0.47240917,remaining:2.02759083,unit:USD}`，顶层 `remaining` 同值。未返回钱包余额。加密账号文件查询前后 SHA-256 一致。完整脱敏事实在 artifacts/balance-query-2026-11-19/live-sub2api-once-receipt.json。

最小续作：src/balance.js 在明确配置下增加 `sub2api-usage` 协议，路径固定 `/v1/usage`，倍率必须1，单位只接受USD/CNY且根与quota.unit必须匹配配置。仅支持此次已实测的 quota_limited/active/有效模式，严格验证数字字段、上下层remaining一致且剩余额度不超过limit。独立只读复查发现0上限/正remaining可通过的P2，Lead离线复现后补此边界和自洽的零余额fixture；不擅自强加未核验的limit-used等式或透支规则。账户余额返回unavailable，不用密钥额度替代；订阅、unlimited或其它未实测模式返回不支持，不推断无限。客户端只增加协议名称白名单。New API配置、默认关闭、手动查询/并发/超时/网络边界/RPC不改变。

不再发真实请求，不访问真实账号数据；回归只使用合成或已脱敏响应。验证结果：最终工作区构建退出0，本地94/94、实际SDK隔离gateway 9/9通过；离线重放脱敏真实响应结果正确，矛盾上限被拒绝。独立审查完成，唯一P2已由Lead复现修正并回归。安装与宿主配置仍等待明确授权。TaskStartSnapshot为 artifacts/balance-query-2026-11-19/baseline-sub2api/snapshot.json（11个文件）。TDD off/post-change regression，inline实现、只读复查。此处为已批准余额方向的实测契约收敛，不新增站点自动发现或自动启用。

## 授权覆盖安装（2026-11-19）
用户已明确允许覆盖desktop安装并启用本站余额配置。执行边界：只替换 `profiles/desktop/node_modules/dsh-floating-accounts`，保留版本1.0.2；只向 `profiles/desktop/cordis.patch.yml` 追加按id `floating-accounts` 的 `config.balanceQuery:{protocol:sub2api-usage,endpointPath:/v1/usage,unit:USD,quotaPerUnit:1}`，不插入第二插件、不改注册package/root/pnpm/settings/其它插件。源码不再修改。账号加密文件仅哈希，无解密，无平台请求，无浏览器/重启/服务器替换。

预检发现现有install.mjs拒绝已有目录，不重复uninstall/install。旧replace脚本硬编码1.0.1且清单不含余额模块，不能直接复用。采用本轮专用部署脚本：显式目标路径检查、lifecycle独占锁、完整manifest和分发身份核验，暂存新插件与新补丁后验证；完整旧目录及配置原字节备份到profile内唯一命名backup；切换前CAS核验，目录rename替换，补丁文件atomic rename。切换失败仅在归属/当前hash仍匹配时回退；外部变更保留并报manual recovery，不覆盖其它状态。备份不删除，凭据配置备份不输出正文。

验证：先完整本地94/SDK9回归；部署脚本check-only；实际宿主公开loadOverlayPatches/composeEntries纯解析确认按id覆盖生效（不boot，不调用API）；安装所有分发文件与工作区逐文件一致，完整DPAPI/余额模块，profile注册唯一，旧目录备份一致，账号加密文件/root/package/锁文件/settings未改；新配置只新增一个非secret patch。最后实际SDK隔离挂载安装版并确认queryBalance注册/配置，无读取真实Vault。运行中的DSH未重启，页面验收由用户后续执行。

阶段：2026-11-19 16:03（Asia/Shanghai）覆盖安装+启用配置已完成；全部45个分发文件与工作区一致、7个受保护文件未变、旧代码和patch备份逐字节一致。实际SDK安装版隔离挂载/Remote注册/配置合并通过，未读取真实Vault/请求平台。TaskStartSnapshot保存在profile内唯一backup，部署证据见[部署记录](<../artifacts/balance-query-2026-11-19/deployment-receipt.json>)和[最终安装核验](<../artifacts/balance-query-2026-11-19/deployment-final-verification.json>)。无Git（实测.git不存在），不创建branch/commit。主线：覆盖安装+启用配置；完成条件为磁盘安装和真实配置合并验证通过，不宣称运行中已加载。

## 状态
当前：源码及授权磁盘部署已验证，重启后的真实页面验收待用户执行。部署前回归94/94、本机实际SDK9/9通过。以下保留首轮修正时的历史检查点，不作为当前未完成状态。

历史：修改前 54/54 本地回归通过；首轮实现后 85/85 本地、8/8 实际隔离 SDK 通过，两个只读独立审查均已结束。确认的 4 个 P2 问题已在原 owner 最小修正：小数显示非零变零（格式化有效数字+小值科学计数）、十进制原文超范围被 Number 舍入后通过（转换前比较）、倍率下溢非零变零（拒绝下溢）、跨 UUID 前置读取无全局上限（全局4槽，工作真正结束才释放）。已补正负小余额/越界/下溢/真零和256个未知UUID的回归。此后最终验证已重新执行并通过；独立报告针对修正前版本，不冒充修正后再次审查通过。

非 Git 项目（已实测 .git 不存在），不创建分支/提交。37 个基线项目文件按任务快照逐文件校验，不改已有用户状态。核心新模块各小于 250 行；客户端保持原 ModuleLoader 工厂，在同一组件中增加账号级状态；无第三方包。

可回查的公开协议依据：All API Hub commit `5c4101d93143df6b3b112ccd819a29f3f4ada78c` 的 [telemetry](https://github.com/qixing-jk/all-api-hub/tree/5c4101d93143df6b3b112ccd819a29f3f4ada78c/src/services/apiCredentialProfiles/telemetry)；New API commit `3a407cc9b064fe79a4ffac4146b2690c465dc929` 的 [token controller](https://github.com/QuantumNous/new-api/blob/3a407cc9b064fe79a4ffac4146b2690c465dc929/controller/token.go) 和 [router](https://github.com/QuantumNous/new-api/blob/3a407cc9b064fe79a4ffac4146b2690c465dc929/router/api-router.go)。仅借鉴协议与分层，未复制上游轮询、模型探测、重试或站点自动发现。


部署脚本独立审查：回退token不能覆盖全树身份以及清理异常漏锁问题已核实修正，合成反例证明foreign target/backup/patch均拒绝；视觉转义的换行finding经实际JS求值与YAML check-only证伪，未盲目改变正确转义。追加使用Buffer保留原patch字节；完整原包作为回退backup保留（用户确认后才退休/清理）。无业务代码新增、无fallback/依赖扩张；宿主未重启，不能以隔离mount宣称运行中已更新。
