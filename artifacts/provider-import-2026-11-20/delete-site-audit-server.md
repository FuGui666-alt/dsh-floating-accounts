# 删除站点无反应：服务端链路纯静态审计（backend owner，2026-11-20）

- 任务 t11 attempt 16b428f8-48fa-492e-b93c-76636dbb915d；纯审计零改码；真实 vault 未触碰未解密。
- 对照基线：artifacts/protocol-detection-2026-11-19/final-extracted/package/src/（1.1.1 交付提取件）
- 方法：全文件机械 diff（index.js / vault.js / validation.js / vault-model.js）+ 已装目录逐字节比对 + removeSite 抽核。

## 1. index.js Remote 层：1.2.0 vs 1.1.1

差异全清单（diff 实测，6 处，全部为 DSH 导入接线，无一处触及 removeSite）：

| # | 位置 | 差异 |
|---|---|---|
| 1 | L7 | 新增 `import { DshProviderImporter } from './host-providers.js'` |
| 2 | L9 | version 1.1.1 → 1.2.0 |
| 3 | L11-23 | 新增模块级 `dshImporterSlot`/`pluginContextSlot` Symbol 与 `dshImporter(receiver)` 函数 |
| 4 | L25-28 | 构造函数新增第4参 `dshProviders = null`，写入 Symbol 槽；`this.vault/this.balance` 赋值不变 |
| 5 | L37-48 | 新增 `listDshProviders`/`importDshProviders` 两个方法 |
| 6 | L77 | markRemoteMethod 名单在 'list' 后追加两方法 |

removeSite 相关逐项确认：
- `async removeSite(request) { return this.result(() => this.vault.removeSite(request)); }` —— 1.1.1 基线 L23 与 1.2.0 L52 **逐字一致**；分支逻辑/错误白名单/AccountError 透传由共享的 `result()`（1.2.0 L17-23 = 1.1.1 L12-18，零差异）承担，未变。
- `removeSite` 方法体只触 `this.vault`（公共属性，typert 包装接收者可转发），**不经过 DshProviderImporter**；1.2.0 的构造改动（Symbol 槽赋值）在构造期执行、不依赖任何 I/O，不影响 removeSite 路径。SDK 实证：t8 修复后三组 20/20 全绿，其中 multi-site-host 的 schema2 CRUD 用例经真实 gateway 走通 removeSite。
- markRemoteMethod 循环中 `'removeSite'` 保留原位（L77），Remote 注册未变。

## 2. vault.js 事务层：1.2.0 vs 1.1.1

机械 diff：**恰好一个 hunk** `@@ -418,4 +418,56 @@` = 类尾部追加 `importFromDsh`（1.2.0 L421-473）。以下路径逐字零差异：
- `removeSite`（1.2.0 L303-310 = 1.1.1 同文）：`request(input,['revision','id'],['revision','id'])` → `uuid(input.id,'站点')` → `transact(expected, mutate)` → `requireSchema2(state)` → `siteById` → 非空站拒绝 → splice。
- `transact`（L207-267）：锁（`wx` 独占 + token 属主校验）、`readState`、`state.revision !== expected → CONFLICT`（L220）、`revision+1` 上限、DPAPI 加密、temp+rename 提交、COMMIT_UNKNOWN 语义 —— 全部未动。
- `readState`/`assertUnchanged`/`siteById`（L51-55，NOT_FOUND '站点不存在，请重新载入'）未动。
- 辅助文件：validation.js 仅追加 `isUuid`/`originOf`（@@ -64,6 +64,10 @@，纯增量，不动既有校验）；vault-model.js **零差异**。

## 3. SITE_IN_USE 服务端语义（触发条件与客户端一致性）

- **服务端存在非空站拒绝**：src/vault.js L307 —— `if (state.accounts.some(row => row.siteId === site.id)) throw new AccountError('SITE_IN_USE', '请先移除关联账号；站点不会级联删除账号或凭据')`。
- 触发条件：站点下存在**任意账号**（不看凭据、不看 origin）。返回 RPC 信封 `{ok:false, error:{code:'SITE_IN_USE', message:'请先移除关联账号；站点不会级联删除账号或凭据'}}`。
- **客户端预检与服务端一致**：服务端谓词与客户端预检（`accounts.some(row => row.siteId === site.id)`）是同一表达式——非竞态下服务端不会产生预检之外的新拒绝；服务端该检查是并发窗口的第二道防线。
- 服务端 removeSite 可能返回的全部错误码：SITE_IN_USE（L307，非空站）、CONFLICT（L220，revision 不匹配，文案『账号已在其他窗口更新，请重新载入再编辑』）、NOT_FOUND（L51-55 经 siteById，站点不存在）、MIGRATION_REQUIRED（requireSchema2，schema1 旧账本）、INVALID_REVISION/INVALID_INPUT/INVALID_ID（请求形状）、BUSY（锁占用）、WRITE_FAILED/COMMIT_UNKNOWN/READ_FAILED（I/O 层）。**不存在静默成功或静默吞错路径**：所有失败都以 `{ok:false,…}` 信封返回。

## 4. 同 origin 合并新逻辑对删除的影响

- importFromDsh 是唯一新增写入口，且为**纯增量**：只 `push` 新站点/新账号，不修改既有站点对象字段、不删除任何站点/账号；删除事务（removeSite）与合并逻辑无共享代码路径（除共用 transact 框架，该框架零差异）。
- 可删性判定按 `site.id` **精确匹配**（L307），不按 origin——同 origin 的其它站点（含导入新建的同 origin 站点）不影响某站点的可删性判定。
- 间接效应（语义既有、触发源新）：导入会在某站下**新增账号**，使该站点进入 SITE_IN_USE 状态（须先删账号才能删站）；同时导入使 vault revision+1——若面板在导入后未重新载入就删除站点，revision 预期值过期。这两点都是 1.1.1 既有语义对"新增了会写 vault 的新操作"的正常反应，不是删除判定逻辑的变化。

## 5. 已装目录核验（排除面板跑旧代码）

- 已装 `profiles/desktop/node_modules/dsh-floating-accounts/package.json` version=**1.2.0**。
- 五文件与工作区 lib **逐字节 IDENTICAL**（cmp 实测）：lib/index.js（faba89e0…）、lib/vault.js（0313976f…）、lib/vault-model.js（a145842f…）、lib/validation.js（1a34af89…）、lib/client.js（ac0130e1…）、lib/build-manifest.json（d51c3fd9…）。
- 已装 lib/index.js L52/L77 与 lib/vault.js L303/307 均为 1.2.0 形态。**排除"面板跑旧代码"。**

## 6. 服务端候选根因排序（供 captain/UI 联查）

1. **【排除】服务端回归**：removeSite 链路 1.2.0 vs 1.1.1 逐字一致（Remote 层+事务层+错误码），且 SDK 20/20 中含 removeSite 的真实 gateway 用例全绿。
2. **【最高概率】revision 竞态 → CONFLICT**：导入供应商（revision+1）或另一窗口操作后，面板持旧 revision 删除站点 → `{ok:false, code:'CONFLICT'}`（vault.js L220）。服务端必然有响应；"无反应"应查客户端是否未渲染该错误信封（client.js 1.2.0 未改，此路径 1.1.1 亦存在，但导入是新的 revision 变更源——建议 UI 联查复现序列"导入→不重载→删站"）。
3. **【次之】SITE_IN_USE 双保险**：预检与预检后并发窗口内该站新增账号 → 服务端 SITE_IN_USE；预检一致故静态场景不会出现。
4. **【已排除】面板跑旧代码**：已装 1.2.0 且五文件与工作区 lib 逐字节一致。
5. **【已排除】服务端静默路径**：removeSite 全路径返回信封，无静默吞错。

结论：服务端 removeSite 链路对"删除站点无反应"**无可归责回归**；建议下一步按候选 2 在客户端/复现序列取证（导入后未重载 → 删站 → CONFLICT 是否被 UI 吞掉）。
