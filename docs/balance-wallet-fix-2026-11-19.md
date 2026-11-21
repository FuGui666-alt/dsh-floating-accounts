# Sub2API 钱包响应误拒绝修复

## 当前部署结果（2026-11-19 17:23 Asia/Shanghai）
**用户授权的修复版覆盖安装已完成。** [安装收据](<../artifacts/balance-query-2026-11-19/wallet-deployment-receipt.json>)、[完整安装核验](<../artifacts/balance-query-2026-11-19/wallet-deployment-verification.json>)：45分发文件全部一致，完整target树/token与本次快照一致，8保护对象未变，原46文件插件树和旧patch备份逐字节相同，唯一本插件注册和实际SDK隔离挂载通过，无生命周期锁/stage残留。安装钱包解析器已以合成unrestricted结构核验，但没有发真实平台请求、读取真实账号明文、运行GUI或重启DSH。

- 安装位置：[插件清单](<D:/FUGUI/ai/dsh-data/profiles/desktop/node_modules/dsh-floating-accounts/package.json>)；完整旧包：[旧插件](<D:/FUGUI/ai/dsh-data/profiles/desktop/floating-accounts-wallet-backup-60b42153-badd-4a8b-b9a9-2dfb6ed2cf46/plugin-before/package.json>)；[本轮保护快照](<D:/FUGUI/ai/dsh-data/profiles/desktop/floating-accounts-wallet-backup-60b42153-badd-4a8b-b9a9-2dfb6ed2cf46/task-start-snapshot.json>)。备份中的配置保留已有敏感内容，仅本机保存，不公开正文。旧包保留用于回退，清理须另授权。
- 部署前 fresh build及本地100/100、隔离SDK10/10再次通过，见[重新回归](<../artifacts/balance-query-2026-11-19/verification-wallet-preinstall.json>)。生产源码/测试与已审查版本一致，此部署未再增加业务逻辑。
- 部署脚本独立只读审查提出postSDK复查缺口(H1)、重新枚举source(M1)、安装完整树/token与receipt身份(M2)、项目receipt写入时机(M3)。Lead逐条核对后在实际apply前修正：SDK之后重查全部对象、枚举CAS、收据完整树/token、两份同内容receipt持锁写、项目证据发布失败明确已安装+backup指针禁止重apply、verifier全树/身份/保护对象末次复核。4项合成回退门禁通过。原guard/newreceipt保留可追溯，不把审查建议当发布批准。
- 仍有边界：目录锁只约束配合写者，最后检查到rename/receipt间不可完全原子，强杀/掉电未注入验证；当前成功核验覆盖磁盘和SDK加载，不代表运行host/真实GUI验收。模式字符串脱敏缺口仍存在，未知模式继续拒绝，不能宣称用户报错已经消失。
- 下一步：保存会话、完整退出并重启DSH，打开“账”面板，在本站账号手动点击“查询余额”。若返回受支持钱包形态，应显示账户余额+USD+时间，密钥额度无限仅表示无独立key限额；限额模式仍显示密钥额度且不冒充钱包。失败仍报错而非0。若仍失败先提供安全错误码，再单独授权取证，不自动再次请求。

安装/配置保护主线2/2已验证；真实页面需用户验收。版本仍1.0.2，未代用户Git提交，无依赖/其他插件或DSH实现变更。

## 新授权覆盖安装执行计划（执行前记录）
用户随后明确答复“允许”，授权覆盖修复版，不授权额外平台请求、配置修改、重启或浏览器操作。当前进入部署切片：前置快照包含完整旧46文件树和8个保护对象hash（包括desktop patch）；新分发45文件，版本保持1.0.2。复制到同级独占stage、验证完整build/分发、profile单注册与SDK纯配置，CAS核对源/旧安装/所有保护对象后rename替换。旧树完整保留于唯一wallet-backup。替换后实际SDK隔离挂载在同一事务中验证，失败时仅在token+完整target/backup/patch所有权一致后恢复旧树，不回滚配置、不删除外部变化。生命周期锁独立finally清理。全程真实密钥不解密、平台0请求，不安装依赖、不改生产源码/Git。部署前重新构建，本地100/100、隔离SDK10/10已通过；代码回退保护4项合成检查通过。下方源码切片记录为历史，最终部署结果待本节后续更新。

## 问题与直接证据
- 用户反馈按钮报“平台未确认余额查询成功”；前端对 BALANCE_REJECTED 的映射可触发该文案。
- 16:54（Asia/Shanghai）新明确授权的一次 GET /v1/usage 返回 HTTP200、isValid=true、balance=remaining=1.70511289、unit=USD；无status、quota、subscription、error。旧解析器返回 BALANCE_REJECTED，账号加密文件hash不变；见[脱敏诊断](<../artifacts/balance-query-2026-11-19/live-sub2api-diagnosis-1651-receipt.json>)。
- 诊断脚本mode安全白名单遗漏unrestricted，实际mode字符串被脱敏，不可宣称该完整响应已按原样成功重放；它不属于脚本已记录的quota_limited/unlimited枚举。未知mode不得用钱包字段猜测替换。保留原收据和已消耗ledger，不再请求平台。
- [Sub2API固定上游源码](https://github.com/Wei-Shaw/sub2api/blob/2af3f1e15c98c893a89255a037f551046883b8c0/backend/internal/handler/gateway_handler.go#L1594-L1643)：quota_limited含status与key限额；unrestricted无key限额，可走订阅或钱包分支。钱包分支直接将latestUser.Balance写入balance和remaining，无status；[原文](https://github.com/Wei-Shaw/sub2api/blob/2af3f1e15c98c893a89255a037f551046883b8c0/backend/internal/handler/gateway_handler.go#L1847-L1861)。

## 修复决策与边界（修改前）
- 根因：parseSub2APIUsage以限额模式的status要求覆盖所有模式，并且缺少上游明确的钱包分支。客户端只是呈现安全错误，不能通过前端伪造成功或删掉后端校验修复。
- 修改必要性：调整配置/重启不能让正确钱包结构通过旧解析器。Decision: code-change，仅在现有解析owner加入明确unrestricted钱包分支，不增加协议、网络端点、凭据owner或持久化字段。
- 信任契约：isValid必须true；success=false/error字段/显式非active status均拒绝；quota_limited仍必须active及完整quota。unrestricted仅允许无subscription/quota/rate_limits、正确unit、显式数字balance与remaining相等的形态。未知模式、订阅、畸形值、不匹配币种均拒绝。钱包可如实为0或负数，不把解析失败变零。
- 输出：unrestricted钱包 → accountBalance金额，keyQuota=unlimited，仅代表无独立key限额而非无限账户资金；quota_limited仍只显示key额度，不拿它当账户钱包。
- 影响面：现有BalanceQuery→RPC安全facts→客户端validBalanceResult/balanceView，返回结构不变；共享HTTP限流/超时/HTTPS/DNS限制不改。现有前端已支持钱包数字+unlimited密钥，增加hook路径回归即可，无新UI路径。
- 回归：历史限额结构、钱包无status、显式失败/未知模式、订阅拒绝、零负数/小额、单位和金额矛盾、模拟transport的BalanceQuery及客户端显示。TDD Mode: off，使用直接诊断失败证据与修改后回归，不要求严格RED/GREEN。
- 替换/退役：旧的全局status必需约束退役，限额分支仍保留；历史来源备份和一次性诊断ledger用于审计，不删除或重置。上游unrestricted订阅分支继续未支持。无Git操作/依赖安装。
- 未授权动作：不覆盖已安装插件、不改profile/vault、不重启、不操作浏览器；若源码验证通过，单独请求覆盖修复版授权。

## 当前状态与证据
- 源码修复及工作区构建完成；[完整回归收据](<../artifacts/balance-query-2026-11-19/verification-wallet-fix.json>)记录构建退出0、本地100/100、实际隔离SDK10/10、sourceMatchesBuild=true。钱包专用测试是上游结构与已见数字的合成fixture，不是完整live原样重放；actual SDK也不是当前运行的GUI。
- 修改范围：[解析器](<../src/balance.js#L74-L110>)净增15行，3个测试文件分别增52/13/10行，工作区生成产物相应更新。业务owner仍一个，无新协议/HTTP/RPC/持久化/凭据入口；生产客户端不改。README及历史计划/报告加最新状态，安装旧文档未同步。
- 本轮验证前后6个保护对象（profile补丁、加密vault、安装版4个关键lib模块）hash一致；源码wallet修复未写入安装目录。前置核验已安装SDK合并协议为sub2api-usage，4个模块原先与source一致，排除了误装另一协议的磁盘原因；不证明运行中host加载状态。
- 独立只读审查：Critical0/Important0、Minor1（此文档状态仍为进行中）。Lead核对新收据后通过本节同步关闭该Minor；守卫、历史quota兼容、钱包/密钥分离及无新owner均无阻断发现。审查为advisory，不是部署批准。
- 修复/退役两轨：源码中旧全局status约束已退役，限额status约束仍在；旧安装仍保留，待用户另行授权覆盖后再核验，保留基线/历史收据/独占账本用于可追溯回退，不能为再次查询重置账本。
- 结论等级B仅针对上游明确钱包契约的源码修复；实际mode未保留，真实运行页面未验证，因此**不能宣称用户报错已消失**。下一步是授权覆盖修复版并由用户重启/手动查询验收，若未知mode仍拒绝，先另行取证而非移除模式校验。

## 离线复核方式
在项目目录运行以下命令，只使用合成数据/SDK fixture，不请求真实平台：

```bash
node scripts/build.mjs
node --test tests/balance.test.mjs tests/balance-client.test.mjs
```

完整SDK回归需设置已核验的DSH_CHECKOUT与DSH_TEST_EXECUTABLE；一轮已完成收据保留完整命令和输出。不要重跑真实查询脚本或覆盖收据。
