# 手动余额查询源码交付结果

## 最新状态：钱包响应误拒绝
用户已点击余额按钮并反馈“平台未确认余额查询成功”。16:54（Asia/Shanghai）另行授权的一次只读诊断返回isValid=true及钱包balance=remaining=1.70511289 USD，无status；旧限额解析器将status=active作为全局必需字段而拒绝。源码已按固定上游明确的钱包模式修复，构建、本地100/100、实际隔离SDK10/10回归通过；**17:23（Asia/Shanghai）已另行授权覆盖安装修复版，真实页面仍待用户重启后验收**。覆盖45分发文件完全一致，8保护对象不变，旧完整插件树备份一致，实际SDK隔离加载及安装钱包解析器合成结构核验通过；未重启、未代点余额、未再请求平台。见[修复版安装核验](<../artifacts/balance-query-2026-11-19/wallet-deployment-verification.json>)。

诊断mode未被安全白名单保留，因此不声称完整本次JSON被修复版原样通过，也不猜测未知mode。严格钱包用例为上游unrestricted结构+本次已脱敏数字，不是完整live重放。新一次授权已消耗，无重试，真实账号密钥不落盘，加密账号文件hash不变。见[修复说明](<balance-wallet-fix-2026-11-19.md>)、[本次脱敏诊断](<../artifacts/balance-query-2026-11-19/live-sub2api-diagnosis-1651-receipt.json>)、[修复回归记录](<../artifacts/balance-query-2026-11-19/verification-wallet-fix.json>)。

后文是16:03安装及更早源码交付历史；其中源码=安装45文件的证据仅适用于当时。本次已覆盖的钱包修复版以新安装收据为准，限额响应仍只提供key额度，钱包响应可显示账户余额，不能沿用历史‘接口未提供’作为所有模式的验收预期。

## 先前授权部署结果（16:03历史）
2026-11-19 **16:03（Asia/Shanghai）已完成用户授权的desktop覆盖安装与本站余额配置启用**。当时源码/45个安装分发文件、配置合并及注册已验证，版本保持1.0.2。**当时未自动重启DSH**。无配置时插件默认关闭；本站配置已显式设置Sub2API /v1/usage、USD、倍率1。
- 覆盖目标：[desktop插件](<D:/FUGUI/ai/dsh-data/profiles/desktop/node_modules/dsh-floating-accounts/package.json>)。未重复注册；原profile package/root/pnpm/settings、真实加密账号文件共7个保护对象hash保持不变。
- 本次唯一配置修改：[desktop补丁](<D:/FUGUI/ai/dsh-data/profiles/desktop/cordis.patch.yml>)原字节作为前缀保留，仅追加一个id=floating-accounts的config.balanceQuery；实际宿主SDK纯合并和安装版隔离挂载通过，queryBalance注册有效，未boot真实profile/调用RPC。
- 备份：[任务前快照](<D:/FUGUI/ai/dsh-data/profiles/desktop/floating-accounts-balance-backup-70387b76-f790-4d0a-abb6-09e21e167cde/task-start-snapshot.json>)、[旧插件清单](<D:/FUGUI/ai/dsh-data/profiles/desktop/floating-accounts-balance-backup-70387b76-f790-4d0a-abb6-09e21e167cde/plugin-before/package.json>)和[旧补丁](<D:/FUGUI/ai/dsh-data/profiles/desktop/floating-accounts-balance-backup-70387b76-f790-4d0a-abb6-09e21e167cde/cordis.patch.yml>)完整保留。配置备份可能包含已有敏感内容，仅本机保留，不公开正文；恢复前需停止相关进程并核对当前变化，不能整份盲盖。
- 验证：本轮部署前构建退出0、94/94本地、9/9实际SDK隔离测试通过；安装45文件逐字节匹配，旧包和旧patch备份一致，lifecycle锁/暂存残留为0。见[部署记录](<../artifacts/balance-query-2026-11-19/deployment-receipt.json>)、[部署前回归](<../artifacts/balance-query-2026-11-19/verification-predeployment.json>)、[最终安装核验](<../artifacts/balance-query-2026-11-19/deployment-final-verification.json>)。
- 独立部署脚本审查的回退全树身份、异常清理漏锁问题已验证修正；[五项保护反例](<../artifacts/balance-query-2026-11-19/deployment-guard-verification.json>)证明外部修改target/backup/patch时拒绝回退。视觉转义的换行finding经实际JS求值/YAML预检证伪，不列为真实代码缺陷。独立报告为修正前版本，修正后由Lead核验。
- 边界：本轮0平台请求、0真实密钥解密，无browser/UIA/重启/模型调用/其它插件变更/DSH代码改动/依赖升级/Git提交。账号文件只对加密字节哈希，不读取明文；历史审查未闭合项仍存在。

### 用户下一步
1. 保存当前会话，完整退出并重新启动DSH（仅刷新网页不足）。
2. 打开“账”面板，确认每账号出现“查询余额”。打开面板不应自动查询。
3. 在本站账号手动点一次按钮；应显示密钥额度、USD及本次查询时间；账户余额应明确“接口未提供”，不是0或密钥额度。该点击由用户触发实际请求，本轮助手未代点。
4. 失败应显示错误；历史成功须标“上次成功结果（非本次）”。遇异常保留错误码/不含秘密的截图反馈，不重复保存或提供明文key。

完成口径：覆盖安装和配置启用两条磁盘主线已验证（2/2）；运行中加载和页面验收未验证。证据等级B：直接安装/配置SDK核验+完整回归，有界余留风险为重启/UI真实链路及平台后续响应。配置为本插件全局，混合平台账号不自动选择协议。账户钱包余额及未核验的无限/订阅模式仍不在已支持事实内。

## Sub2API 实测与适配续作（部署前历史）

2026-11-19 **15:27:46（Asia/Shanghai）**，用户明确授权的唯一一次 `GET https://yizhichun.online/v1/usage` 成功（HTTP 200，无重定向/重试/模型调用）：

| 本站响应事实 | 值 |
|---|---|
| 密钥模式/状态 | quota_limited / active / isValid=true |
| 密钥总额度 | 2.5 USD |
| 密钥已用额度 | 0.47240917 USD |
| 密钥剩余额度 | **2.02759083 USD** |
| 账户钱包余额 | **接口未提供，不能从密钥额度推算** |
| 加密账号文件前后哈希 | 一致，修订未改 |

[单次查询脱敏记录](<../artifacts/balance-query-2026-11-19/live-sub2api-once-receipt.json>)保留必要金额及字段结构，去除了用户/密钥/模型/用量详情。API密钥仅在解密后的进程内存及TLS请求头，不输出到日志/命令行/明文文件；JS字符串无法保证物理清零，已清除可控引用。由原Vault方法加载现有加密数据，未向平台传递分组密钥。独占账本阻止脚本重跑，后续请求必须重新授权，不以验证失败为理由自动重试。

[Sub2API源码](<../src/balance.js>)新增显式协议 `sub2api-usage`：固定 `/v1/usage`、倍率1、配置和根/quota单位必须一致、有效active的quota_limited模式、原始数字/上下层remaining一致且remaining不超过limit。不推断订阅/无限模式或钱包字段；其它未实测模式报不支持。旧New API路径保留以兼容已有显式配置，不用于本站，也不回退探测。退役触发为未来明确移除New API支持，而非本次站点适配。

独立只读复查发现一项P2：0上限却有正remaining可通过。Lead离线复现后最小修正上限检查、补矛盾响应测试及自洽零额度fixture。不强加未经核验的limit-used精确等式；不使用浮点容差吞掉超限剩余值。复查针对修正前版本，修正后由Lead回归证明。

最终本轮构建退出0、**本地94/94 / 实际隔离SDK 9/9通过**，均0失败/0跳过。完整证据见[Sub2API回归记录](<../artifacts/balance-query-2026-11-19/verification-sub2api.json>)、[离线验证脚本](<../artifacts/balance-query-2026-11-19/verify-sub2api.mjs>)。该记录中liveAPIRequested=false等字段仅描述此次回归执行；本轮唯一真实请求事实由上面的独立单次查询记录证明，不表示没有执行过用户授权请求。额外离线重放脱敏真实响应产出正确密钥金额，矛盾0上限被BALANCE_RESPONSE拒绝，不再次联网。

[续作前快照](<../artifacts/balance-query-2026-11-19/baseline-sub2api/snapshot.json>)保存11个项目文件；无依赖/版本升级/分支/提交（无Git）。[客户端](<../src/client.js>)仅扩展协议白名单与安全的“不支持”提示，无新RPC或状态owner；网络与Vault模块未再修改。安装版本、宿主配置、真实账号数据、其它插件/profile/DSH实现均未修改。下一步只需用户授权部署并人工页面验收，不需要再提供明文密钥。

## 实现范围
- [客户端](<../src/client.js>)：账号级“查询余额”按钮，账户余额/密钥额度/查询完成时间分开；成功零、无限额度、字段未提供、失败明确区分。
- [余额编排](<../src/balance.js>)：元数据-only queryBalance(request)，强制 id/revision；显式协议/单位/倍率，查询前后修订检查；同账号1个、实例最多4个在途；超时或配置变化丢弃结果。
- [HTTPS 边界](<../src/balance-http.js>)：同 origin 公网 HTTPS；单次GET，无重定向、自动重试、Cookie、分组密钥或模型请求；DNS 地址固定、10秒与64KiB界限。
- [Vault](<../src/vault.js>)：仅新增宿主内部只读查询方法，不注册为Remote；保留CRUD与DPAPI数据结构。成功/失败查询均不写账号文件、不改变修订。
- [宿主](<../src/index.js>)：保留 list/save/remove，新增 queryBalance；沿用 args:{request}。查询结果只含安全事实，不含密钥。
- [构建](<../scripts/build.mjs>)：新模块在复制/语法检查/源哈希/输出哈希四处配对；只生成项目内产物。
- [测试入口](<../package.json>)与[验证入口](<../scripts/verify.mjs>)：纳入三套新余额测试；包的文件清单纳入实施文档，避免README链接在开发包中失效。

## 适配前验证证据（历史记录）
此节保留Sub2API续作之前的证据；当前验证结果见上面的续作节。当时验证时间为 2026-11-19 15:03（Asia/Shanghai）：

| 范围 | 结果 |
|---|---|
| 修改前本地基线 | 54/54，0失败 |
| 修改后完整本地回归 | 89/89，0失败、0跳过；新增35例 |
| 实际 Cordis/Typert SDK 隔离 gateway | 8/8，0失败、0跳过 |
| 项目构建 | 退出码0 |
| 记录的最终文件 SHA-256 校验 | 不匹配0 |
| 新模块构建清单 | source与outputs均包含2个模块 |
| 测试隔离目录及构建暂存残留 | 0 |

完整命令、输出与源码身份在[验证记录](<../artifacts/balance-query-2026-11-19/verification.json>)；可回查的[验证脚本](<../artifacts/balance-query-2026-11-19/verify.mjs>)只运行项目fixture，输出路径已有文件时拒绝覆盖。SDK使用现有Electron公开依赖，不启动GUI；Node v24.19.0。实验性loader警告不影响测试成功，尚未改为register API。

真实 Windows DPAPI 仅用于随机临时目录中的合成数据。新测试验证成功/业务失败查询后的合成加密账号文件字节完全一致、修订不变，不接触现有账号文件。

## 独立复查与本轮修正
两位独立审查者均只读，审查针对修正前版本；并行报告不代表修正后再次独立审查通过。Lead 已确认并修正以下4项 P2，本轮最终回归覆盖每项：

| 问题 | 原 owner 的修正与用例 |
|---|---|
| 非零极小金额被格式化成0 | 有效数字/小值科学计数；正负1e-9、USD/QUOTA不显示0 |
| 超安全范围的十进制字符串舍入后通过 | Number转换前比较原文绝对值；正负安全上限+.1/+.0001拒绝，精确边界成功 |
| 倍率换算下溢变成成功0 | 原始非零、结果零时报响应错误；正负下溢拒绝，原始零仍成功 |
| 未知UUID可无界启动前置读取 | 全局4槽在任何Vault读取前检查；256个UUID只有4次读取，其余拒绝；超时后不提前释放，迟到工作结束才回收 |

未确认新增P0/P1。没有修改旧测试断言以掩盖失败；宿主Remote名称断言按新增方法扩展。旧复查报告中的其它问题没有因这次89例通过而自动闭合。

## 适配前未验证项（历史记录，本站事实已由续作节更新）
1. 用户平台是否支持 New API read-only token-usage 协议、候选路径和Bearer鉴权仍未确认。不能把该上游协议当成用户平台事实。
2. 真实平台币种/原始额度单位/换算倍率仍未知；未默认USD、500000或汇率。需平台公开资料或不含密钥的接口契约后再核对配置。
3. 所有新HTTP测试均为注入DNS/请求对象的离线验证；未真实DNS/HTTP/TLS调用。实际SDK为内存gateway，未调用运行中的DSH RPC。
4. 新UI未进行浏览器/真实React页面验收；hook harness未覆盖真实effect重绑定、Escape生命周期及长时钟场景，不能以它替代人工页面验收。
5. 覆盖安装、读取/使用真实密钥及单次真实平台请求分别需要后续明确授权；本轮不自动继续执行。
6. 不可取消的Vault工作若永久阻塞，其4个槽位会保留；这是有界fail-closed而非后台自动恢复。正常工作结束后释放，无无限排队。

实施与人工验收路径见[实施计划](<balance-query-plan.md>)和[README](<../README.md>)。请不要提供明文API密钥。

## 部署前范围保持与续作记录（历史）
未操作浏览器/CDP/UIA/截图，未改原余额插件、其它插件、profile、真实数据或DSH实现。没有版本升级、安装替换、Git分支或提交；项目根目录实测不存在.git，回退依据为[修改前快照](<../artifacts/balance-query-2026-11-19/baseline/snapshot.json>)，不恢复或覆盖任何真实profile。

本轮先后遇到shell转义和Shell语法不一致：首次快照命令未执行写入，修正后保存37个基线文件；一次构建命令在解析PowerShell语法时失败，改为已实测Bash的&&后成功。未绕过权限或改用另一执行工具。后续长命令通过落盘Node脚本避免引用歧义。

部署前验收状态（历史）：源码/离线链路、本站单次限额密钥查询已验证；当时覆盖安装仍待授权。当前已安装且启用配置，见报告开头；其它密钥模式、DSH重启后加载及新页面人工验收仍待办，不宣称运行中的插件已升级或端到端完成。
