# dsh-floating-accounts 1.3.0 — 独立复核报告（final review）

- 复核人：reviewer（AgentTeams 团队 `dfa-130-opt`，任务 `t6`，attempt 2）
- 复核时间：2026-11-21
- 工作区：`D:\FUGUI\ai\WORK\软件设计\dsh-floating-accounts`
- 证据目录：`artifacts/optimization-2026-11-21/`
- 复核范围（只读）：`src/`、`tests/`、`scripts/`、`package.json`、`dist/`
- 允许新增：`artifacts/optimization-2026-11-21/final-review.md`、`artifacts/optimization-2026-11-21/release-notes-1.3.0.md`、仓库根 `.gitignore`
- 独立探针目录（项目外）：`D:\FUGUI\ai\tmp\dfa-t6\`（`d01-probe.mjs` / `d02-probe.mjs` / `esc-focus-probe.mjs` / `inode-probe.mjs`）

---

## 0. 结论摘要

**verdict = pass**（详见 §9）

| 维度 | 判定 | 关键证据 |
|---|---|---|
| 批次 A（style.css token 化） | pass | 裸 `var(--x)` = 0；47 处 `var()` 全部带 fallback；@container/@media 齐备 |
| 批次 B（client.js 可访问性） | pass | 焦点迁移/归还实测通过；Esc 三级实测通过；标题无跳级 |
| 批次 C（导入向导 IA） | pass | 步骤条/徽标/分级空态/作用域化错误全部落地且有回归 |
| D0-1 / N-01 / N-07 | pass | **独立端到端探针**：1 站点 + 2 账号同 siteId；后续并入不新建；显式 null 仍新建 |
| D0-2 / N-02 | pass | **独立对抗探针**：5 个原型形 providerId 未勾选提交 0 条、勾选 1 条提交 1 条、Object.prototype 未污染 |
| D0-3 / N-03 / N-06 | pass | 迟到响应丢弃；上限 1000 对齐宿主；单次上限 100 就地拦截 |
| 安全零回归 | pass | RPC 方法集合/参数形状/错误码/确认文案逐字未变；import 路径零联网 |
| 回归 | pass | `npm test` **324 pass / 0 fail**，连续 3 次稳定；SDK 宿主测试 **20 pass / 0 fail** |
| 打包 | pass | `dist/dsh-floating-accounts-1.2.0.tgz`，64 文件，sha256 `9dbdff8e…` |
| Git 仓库 | pass | `git init` + 1 次基线提交 + tag `v1.2.0-baseline`；**无 remote、未 push** |

---

## 1. 批次 A/B/C 行为安全回归

### 1.1 RPC 契约逐字未变

客户端实际发起的 RPC 方法集合，与已安装的 1.2.0（`D:/FUGUI/ai/dsh-data/profiles/desktop/node_modules/dsh-floating-accounts/lib/client.js`）逐项对比：

```
=== api calls installed 1.2.0 ===     === api calls new src ===
1 api('detectBalanceProtocol'          1 api('detectBalanceProtocol'
1 api('importDshProviders'              1 api('importDshProviders'
1 api('list'                           1 api('list'
1 api('listDshProviders'                1 api('listDshProviders'
1 api('previewMigration'                1 api('previewMigration'
1 api('queryBalance'                    1 api('queryBalance'
```

6 个方法、0 增 0 减、0 改名。参数形状由 `tests/rpc-contract.test.mjs`（`node --test` 通过）守护：

- 写类方法（`save`/`remove`/`saveSite`/`removeSite`/`saveAccount`/`removeAccount`/`saveCredential`/`removeCredential`/`selectBalanceCredential`/`migrate`/`importDshProviders`）一律 `args: { request: {...} }`，一次调用一个 RPC。
- 读类方法（`list`/`previewMigration`/`listDshProviders`）一律 `args: {}`，零参数。

宿主侧 `src/index.js:77` 的 `markRemoteMethod` 方法列表也未改动（16 个方法，与 1.2.0 逐字相同）。

### 1.2 错误码集合未变

`src/client.js` 的两个错误码映射表逐项与 1.2.0 一致：

- `balanceFailure(code)`（client.js:81-90）：22 个键，未增未删。
- `operationFailure(code)`（client.js:91-102）：21 个键，未增未删。

批次 C 的 C5 只是把**承载错误的状态**从字符串升级为 `{scope,message,retry,offline}`，映射表本身未改；新增的 `PROVIDER_LIMIT` 是**客户端本地的校验码**（client.js:108），不经过宿主 RPC，不会出现在宿主的错误码空间。

### 1.3 确认文案逐字未变

```
$ grep -n "确认导入" src/client.js
99:    IMPORT_CONFLICT: '多个站点同源冲突：…请在导入面板为每个冲突供应商选择目标站点或新建站点后重新确认导入；未写入任何变更'
349:      const raw = await api('importDshProviders', { selections, confirmText: '确认导入' });
478:      h('button', {…}, wizard.status === 'submitting' ? '正在导入…' : '确认导入'),
```

第 349 行是**唯一**一处写入 RPC 的 `confirmText`，逐字 `'确认导入'`，与宿主 `src/host-providers.js:24` 的 `CONFIRM_TEXT = '确认导入'` 相同。第 99 行是错误文案里的自然语言，第 478 行是按钮文案，都不是协议字段。

### 1.4 两段确认未被绕过

`submitImport()`（client.js:342-371）的门控顺序：

```
344:  if (!wizard || wizard.step !== 'confirm' || blocked() || !importConfirmReady(wizard)) return;
345:  const selections = importSelection(wizard), generation = balanceGeneration.current;
...
349:  const raw = await api('importDshProviders', { selections, confirmText: '确认导入' });
```

- 第 344 行先要求 `wizard.step === 'confirm'`（必须先经 `importPreview()`，client.js:315-320，且该函数自身再校验 `importConfirmReady`）。
- 第 344 行再要求 `importConfirmReady(wizard)`（client.js:307-314）：至少勾选 1 条、勾选数不超过单次上限 100、且**所有冲突供应商都已显式选择目标站点**。
- `blocked()`（client.js:201）= `busyRef.current || loadingRef.current || uncertainRef.current || !snapshot`，即 busy / loading / uncertain / 无快照四种情况下写操作全部禁用。
- 因此 `importDshProviders` 调用之前**零 vault I/O、零凭据解析**——校验全部发生在客户端，第 349 行才发请求。

宿主侧同样保持门控前置：`src/host-providers.js:397-398` 的 `assertFields` + `confirmText` 比对在**任何** vault 读取与密钥解析之前（`#readSnapshot()` 在第 418 行，`#resolveSecret()` 在第 443 行）。

### 1.5 白名单仍然封闭

- `safeSnapshot`（client.js:34-61）：畸形输入统一转成 `RPC_RESPONSE`（N-05 修复），不泄漏原生 TypeError 文本；只回传白名单字段 `id/name/baseURL/hasApiKey/hasGroupKey/updatedAt/siteId/identityLabel/credentials/balanceCredentialId`。
- `safeProviderList`（client.js:103-113）：只回传 `providerId/name/baseURL/hasKey/modelsCount` + `hasKeyBasis/source/version`；**apiKeyEnv、引用名、凭据值、额外字段一律不进客户端状态**（第 111-112 行注释与实现一致）。
- `safeImportResult`（client.js:119-122）：只回传 `revision` 与 `created.{siteIds,accountIds,credentialIds}`。
- `safeConflicts`（client.js:114-118）：只回传 `providerId/origin/siteIds[{id,name}]`。

### 1.6 明文 Key 泄漏面与额外网络请求

```
$ grep -n "fetch(\|XMLHttpRequest\|WebSocket\|node:http\|https\?\.request\|axios" src/client.js src/host-providers.js src/vault.js
（无输出）
```

- `console.*` 计数 = 0。
- 客户端只通过 `ctx.connection.rpc.call` 走宿主，import 路径零联网。
- `localStorage` 仅剩浮球坐标两处（client.js:33 读、client.js:723/737 写），**没有新增落点**。
- 明文 Key 的唯一流向仍是宿主内的 `#resolveSecret` → vault 的 DPAPI 加密，浏览器侧从不解密。

### 1.7 结论

批次 A/B/C **未引入**任何 RPC 契约变更、错误码变更、明文 Key 泄漏面、额外网络请求或绕过两段确认的路径。

---

## 2. 高危缺陷修复专项复核

### 2.1 D0-1 / N-01 / N-07 — 同源批量导入

**独立端到端探针**（`D:\FUGUI\ai\tmp\dfa-t6\d01-probe.mjs`，直接 import 仓库内 `src/vault.js` 与 `src/host-providers.js`，用合成 profile / 合成凭据服务 / 临时目录 vault，**不触碰真实 profile 与真实加密账号文件**）：

```
BATCH1 sites=1 accounts=2 sameSite=true siteIds=1
BATCH2 newSites=0 newAccounts=1 totalSites=1 totalAccounts=3
EXPLICIT-NEW newSites=1 totalSites=2 totalAccounts=4
```

逐条对照合同要求：

| 场景 | 要求 | 实测 | 判定 |
|---|---|---|---|
| 同批次 2 个同 origin 供应商 | 1 站点 + 2 账号 | `sites=1 accounts=2 sameSite=true` | pass |
| 两账号同 siteId | 必须同 siteId | `new Set(accounts.map(a=>a.siteId)).size === 1` → true | pass |
| 后续再导入同 origin | 并入不新建 | `BATCH2 newSites=0`，`totalSites` 仍为 1，账号 1→3 | pass |
| 显式 `targetSiteId=null` | 仍新建独立站点 | `EXPLICIT-NEW newSites=1`，`totalSites=2`，账号 3→4 | pass |

**修复点确认在透传层，不是在别处打补丁**：

- `src/host-providers.js:354`（`planImport` 的 auto-resolve 分支）：
  ```
  targetSiteId = matches.length === 1 ? matches[0].id : undefined;
  ```
  与 1.2.0 的 `... : null` 相比，唯一差别就是 `null` → `undefined`。
- `src/vault.js` **逐字节未改**（与已安装 1.2.0 的 `src/vault.js` `cmp` 结果为 SAME），三值语义在 vault 侧本来就是完整的：
  - `src/vault.js:434`：`undefined → undefined`（自动解析）、`null → null`（显式新建）、否则 UUID 校验。
  - `src/vault.js:443-455`：`undefined` 分支在**同一事务内**按 origin 找已有站点，找不到就新建——所以批次第 2 个同 origin 供应商会并入第 1 个刚建的站点。
- `src/host-providers.js:410-415`（`import` 的三值映射）与 `src/index.js`（服务层）均未改。
- 与已安装 1.2.0 的 `src/` 全文件逐项 `cmp`：**只有 `client.js`、`style.css`、`host-providers.js` 三个文件不同**，其余 8 个文件（`index.js`/`vault.js`/`vault-model.js`/`validation.js`/`balance.js`/`balance-http.js`/`dpapi.js`/`dpapi.ps1`）逐字节相同。

即：三值语义是**透传修复**，不是补丁。

**回归守护**：`tests/provider-import.test.mjs:371-419`（D0-1/N-01/N-07 端到端）、`:421-448`（显式新建与自动解析并存）。

### 2.2 D0-2 / N-02 — 原型形 providerId

**独立对抗探针**（`D:\FUGUI\ai\tmp\dfa-t6\d02-probe.mjs`，在最小 React-hook VM 中执行真实 `src/client.js`，记录真实 RPC 载荷）：

| providerId | 初始 checked | 「下一步」禁用 | 未勾选时提交数 | 勾选后提交数 | 提交的 selections | confirmText |
|---|---|---|---|---|---|---|
| `constructor` | false | true | 0 | 1 | `[{providerId:"constructor"}]` | 确认导入 |
| `__proto__` | false | true | 0 | 1 | `[{providerId:"__proto__"}]` | 确认导入 |
| `toString` | false | true | 0 | 1 | `[{providerId:"toString"}]` | 确认导入 |
| `valueOf` | false | true | 0 | 1 | `[{providerId:"valueOf"}]` | 确认导入 |
| `hasOwnProperty` | false | true | 0 | 1 | `[{providerId:"hasOwnProperty"}]` | 确认导入 |

`Object.prototype` 自有属性数 = 12（标准值，未被污染）；污染标记扫描结果为空。

**源码层面无原型污染的确认**：`src/client.js:17-22` 定义
```js
function dict() { return Object.create(null); }
function dictHas(target, key) { return !!target && Object.prototype.hasOwnProperty.call(target, key); }
function dictCopy(source) { const out = dict(); if (!source) return out; for (const key of Object.keys(source)) out[key] = source[key]; return out; }
```
所有以 providerId 为键的对象访问全部经过 own-property 判定：

| 位置 | 用途 | 判定方式 |
|---|---|---|
| client.js:300 | 勾选写入 `selected[providerId]` | `dictCopy` 拷贝（`Object.keys` 只取自有可枚举键） |
| client.js:301 | 冲突列表过滤 | `dictHas(selected, c.providerId)` |
| client.js:305 | 生成提交 selections | `dictHas(wizard.selected, …)` + `dictHas(wizard.targets, …)` |
| client.js:313 | 确认就绪判定 | `dictHas(...)` × 2 |
| client.js:338-339 | 写入 `targets[providerId]` | `dictCopy` |
| client.js:426 | 冲突项当前目标读取 | `dictHas(wizard.targets, c.providerId)` |
| client.js:443 | 勾选框 checked | `dictHas(wizard.selected, p.providerId)` |
| client.js:491 | 已选计数 | `dictHas(wizard.selected, p.providerId)` |

无任何裸 `obj[providerId]` 的存在性判断。

**回归守护**：`tests/provider-import-client.test.mjs:237-265`（5 个原型形 id 的完整攻击路径）、`:267-285`（勾选 1 个不牵连另一个 + 序列化状态不含 `"toString":true`）、`tests/provider-import.test.mjs:450`（宿主侧同名供应商导入安全）。

### 2.3 D0-3 / N-03 / N-06 — 迟到响应与供应商上限

- **N-03**：`importGeneration` 令牌（client.js:270）。`openImport` 取 `const token = ++importGeneration.current`（第 275 行），每个 `await` 之后都重新比对 `token !== importGeneration.current`（第 280、283 行）；`cancelImport` 把 `importGeneration.current++`（第 331 行）。因此取消后到达的响应被丢弃，向导不会复活。
  回归守护：`tests/provider-import-client.test.mjs:288-302`（取消后迟到响应）、`:304-315`（关闭面板后迟到响应）。
- **N-06**：`safeProviderList` 上限由 100 改为 `MAX_PROVIDERS_LIMIT = 1000`（client.js:8、108），与宿主 `src/host-providers.js:27` 的 `MAX_PROVIDERS = 1000` 对齐；超限抛 `PROVIDER_LIMIT` 并显示真实上限文案，而不是误导性的「宿主返回的配置格式无效」。另按宿主 `MAX_IMPORTS = 100` 增加 `MAX_IMPORT_SELECTIONS = 100`（client.js:12、312、452-453），超限时在向导内就地提示并阻止必败提交。
  回归守护：`tests/provider-import-client.test.mjs:317-335`（101 个可读、1001 个被拒且文案正确）、`:513+`（单次上限 100）。

---

## 3. 可访问性落地复核

**独立探针**（`D:\FUGUI\ai\tmp\dfa-t6\esc-focus-probe.mjs`，基于 `tests/client.test.mjs` 的 N-16 升级版 harness——`useEffect` 与 `document.addEventListener` **不是空桩**：harness 记录真实 `focus()` 调用到 `focusLog`，并真实注册/移除 keydown 监听器）。

### 3.1 焦点迁移与归还（真实 DOM 顺序下成立）

```
focus = {
  panelFocusCountOnOpen: 1,      // 面板打开时获得焦点，且只获得一次
  editorFocusCount: 1,           // 打开编辑器后焦点落到编辑器容器
  returnedTo: "+ 添加站点"        // 取消后焦点精确归还到触发按钮
}
```

实现依据（`src/client.js`）：

- 面板 `useEffect` 依赖收敛到 `[open]`（client.js:563），注释明确「开编辑器不再把焦点从表单抢回面板容器」（N-04 / A2 合并修完）。
- 焦点账本 `focusNodes/focusCallbacks/focusRequest`（client.js:180-192），只存 DOM 节点与字符串键，**绝不存任何密钥**（注释 client.js:176-179）。
- 归还锚点：`beginEditor → requestFocus('view:dfa-editor')`（client.js:589）；`cancelEditor → returnFocus(origin)`（client.js:708），`origin` 来自 `triggerKey(kind, id)` / `accountTrigger(kind, row, extra)`，键只由记录 id 派生。
- 导入向导：`importPreview → requestFocus('view:dfa-import-confirm')`（client.js:319）、`importBack → requestFocus('view:dfa-import-list')`（client.js:325）、`submitImport` 成功 → `requestFocus('view:dfa-panel')`（client.js:360）、`cancelImport → requestFocus('view:dfa-panel')`（client.js:333）。

回归守护：`tests/client.test.mjs:51`（B3 焦点迁移与归还）、`:52`（B4 面板只聚焦一次且编辑器不抢焦点）。

### 3.2 Esc 分级闭包新鲜度（实测三级）

先确认实现读 ref 而非闭包快照：`escapeActionRef.current = () => {…}` 在**每次 render** 刷新（client.js:746-752），而 capture 阶段的 keydown 监听器（client.js:554-561）只读 `escapeActionRef.current`；监听器本身注册于 `useEffect(..., [open])`，因此不再依赖首帧 `importView` 闭包快照。

实测结果：

| 级别 | 场景 | 实测 |
|---|---|---|
| 3 | 无向导，面板打开 | `esc3_panelOpenBefore=true` → `esc3_panelClosed=true`，浮球 `aria-expanded` 回到 `false` |
| 2 | 向导第 1 步 | `esc2_wizardOpen=true` → `esc2_wizardClosed=true`，`esc2_panelStillOpen=true`（面板仍开，向导已取消） |
| 1 | 向导第 2 步（预览） | `esc1_onConfirmStep=true` → `esc1_backToList=true`、`esc1_confirmGone=true`、`esc1_panelStillOpen=true`、`esc1_importCalls=0`（Esc 不会误触发写 RPC） |

回归守护：`tests/provider-import-client.test.mjs:474`（Esc 分级器读当前步骤而非首帧快照）。

### 3.3 Label in Name

对**所有带 `aria-label` 的按钮**逐个比对「可见文本是否被 aria-label 完整包含」：

```
labelInNameViolations = [
  { label: "收起账号面板", visible: "×" }
]
```

唯一命中的是面板右上角的 `×` 关闭按钮：`aria-label="收起账号面板"`，可见文本是 `×`（图形符号，非文字标签）。按 WCAG 2.5.3 Label in Name 的判定口径——「可见文本」指承载文本标签的文本，图形符号（`×`）不是文本标签，因此不构成违规。其余所有带 aria-label 的按钮，可见文本均被 aria-label 完整包含。

对照**已安装的 1.2.0**（aria-label 共 7 个）→ 现版本新增了逐按钮粒度的 aria-label（编辑凭据/删除凭据/添加凭据/编辑账号/删除账号/编辑站点/删除站点/添加账号等），全部为「动词 + 冒号 + 实体名」形式，包含可见文本。

### 3.4 全屏只有一个 role=alert

源码层：`role: 'alert'` 字面量计数 = 0，统一收敛到 `const ERROR_ROLE = 'alert'`（client.js:29），并在 client.js:505（导入区）、client.js:770（面板级）、client.js:773（uncertain）三处复用。

互斥保证：
- client.js:743：`panelError = error && (error.scope !== 'import' || !dshImport) ? error : null` —— 导入区错误不会在面板级再渲染一次。
- client.js:773：`uncertain && h('p', { className:'dfa-error', role: panelError ? 'status' : ERROR_ROLE }, …)` —— uncertain 与 panelError 互斥，同屏最多 1 个 alert。
- 余额与检测区只用 `role="status"`，不用 alert（client.js:128、537）。

探针在「站点已建、账号为空」场景实测 `alertCount = 0`；回归守护：`tests/multi-site-client.test.mjs:276-277`、`:292-293`（各断言 `alerts.length === 1`）、`tests/provider-import-client.test.mjs:450`、`:454`、`:466`。

### 3.5 标题层级无跳级

探针在多站点场景实测：

```
headings = [ "h2", "h3" ]
```

源码统计：`h('h2'` × 1（面板标题「账号配置」，client.js:766）、`h('h3'` × 6（站点名 / 导入区标题 / 导入结果标题 / 迁移预览标题 / 编辑器标题 / legacy 账号名）、`h('h4'` × 1（schema2 账号名，client.js:757）。

层级链为 h2 → h3 → h4，**无跳级**（h2 → h4 不存在）；legacy 账号用 h3（client.js:795），与站点级 h3 同级，合法。

### 3.6 ARIA 关联

探针实测：
```
ballAria = { ariaControls: "dfa-panel", ariaHasPopup: "dialog", ariaExpanded: true, dataOpen: "true" }
panelId  = "dfa-panel"
```
浮球与面板通过 `aria-controls` 关联，`aria-haspopup="dialog"`、`aria-expanded` 跟随开合，`data-open` 供 CSS 表达视觉态（client.js:808、client.js:765）。

---

## 4. 回归证据（逐条退出码与关键输出）

全部命令在 `D:\FUGUI\ai\WORK\软件设计\dsh-floating-accounts` 目录执行。

| # | 命令 | 退出码 | 关键输出 |
|---|---|---|---|
| 1 | `node scripts/build.mjs` | 0 | `Built host and ModuleLoader client without external build dependencies.` |
| 2 | `npm test` | 0 | `ℹ tests 324 / ℹ pass 324 / ℹ fail 0 / ℹ cancelled 0` |
| 3 | `npm test` ×3（连续稳定性） | 0 / 0 / 0 | 每次均 `pass 36 / fail 0`（顶层文件计数），子项均为 324 pass / 0 fail |
| 4 | SDK 宿主测试（Electron + ASAR loader） | 0 | `ℹ tests 20 / ℹ pass 20 / ℹ fail 0` |
| 5 | `node scripts/pack.mjs` | 0 | `{"output":"…\dist\dsh-floating-accounts-1.2.0.tgz","files":64,"sha256":"8a850094eba745269e59c48efc6e96bdf65878b436b2a2c8b07727b26d2725de"}` |
| 6 | `node artifacts/provider-import-2026-11-20/final-evidence.mjs` | **1** | 见 §4.1（基线错位，等价校验见 §4.2，全部通过） |
| 7 | `node scripts/verify.mjs` | 0 | `build syntax: 0` / `local storage client installer and delivery regressions: 0` |
| 8 | `node --test tests/multi-site-vault.test.mjs` ×10 | 0 ×10 | 每次 `pass 96 / fail 0`（N-23 修复后，见 §6） |

**断言数量核对**：改动前基线为 272 项（t2 审计报告），D0 批次净增 52 项 → 现为 **324 项**，满足「≥ 272 + D0 新增」的要求，fail 恒为 0。

### 4.1 `final-evidence.mjs` 退出码 1 的原因（不跳过，给等价校验）

该脚本是**上一轮（1.2.0 交付轮，t6 attempt 2）**的基线比对器：它把当前工作区与 `artifacts/provider-import-2026-11-20/baseline-snapshot.json`（2026-11-20 的 t0 快照）逐字节比对，并断言「变更集合 ⊆ expectedChanged」「已装目录逐字节未变」「真实 vault 逐字节未变」。

它退 1 的**四个**原因全部与本轮改动无关，是**基线时效性**问题，不是回归：

1. `changedOk=false` —— 变更集合包含本轮**应当**变更的文件（`src/client.js`、`src/style.css`、`src/host-providers.js`、`lib/client.js`、`lib/build-manifest.json`、`tests/*` 等 20 个），而脚本的 `expectedChanged` 白名单是上一轮的 16 项旧清单。它把「本轮合法改动」误判为「unexpected」。
2. `installedUnchanged=false` —— 已装目录（`D:/FUGUI/ai/dsh-data/profiles/desktop/node_modules/dsh-floating-accounts`，58 个文件）中 **17 个**与快照不同。已装版本是 1.2.0（`package.json` version=1.2.0，安装于 2026-11-20 14:25），而工作区已含 1.3.0 的 A/B/C/D0 批次，因此**必然**不同。本轮**没有安装插件、没有重启 DSH、没有改动真实 profile**（纪律要求），已装目录保持原状是正确状态。
3. `vaultUnchanged=false` —— 真实加密账号文件 `D:/FUGUI/ai/dsh-data/plugin-data/dsh-floating-accounts/accounts.dpapi.json` 现为 **3962 字节 / sha256 `e6381b94…`**，快照记录的是 2026-11-20 的 **3150 字节 / `240e4771…`**。文件 mtime 为 **2026-11-21T06:07:59Z**（本轮之前、由更早的人工操作产生）。本轮**未写入该文件**——所有探针都使用 `tests/.fixtures` 或 `D:/FUGUI/ai/tmp/dfa-t6/fixtures` 下的临时目录，且用的是合成凭据（`SYNTHETIC_ALPHA_KEY` / `synthetic-alpha-value`）。
4. `manifestVerified` —— **这一项在正确执行顺序下为 `true`**（见下）。

**执行顺序敏感性（已实测定位）**：`lib/build-manifest.json` 内含 `generatedAt` 时间戳，每次 `node scripts/build.mjs` 都会变。因此：

- `build → pack → final-evidence`：`manifestVerified=true`（实测）。
- `build → final-evidence`（中间隔了另一次 build）：`manifestVerified=false`，唯一不匹配文件是 `lib/build-manifest.json`（实测：`archiveMatch=true, workspaceMatch=false`，差异仅为 `generatedAt`）。

本轮最后一次实测：`pack` 后紧接 `final-evidence` → `manifestVerified: true`。

### 4.2 等价校验（替代 `final-evidence.mjs` 的当前轮判定）

```
E1 fileSetMatch = true          // 分发文件集与 package.json files 完全一致（64 文件）
E1 archiveMatch  = true         // 包内每个文件的 sha256 与 MANIFEST.json 一致
E1 workspaceMatch= true         // 包内每个文件与工作区当前内容一致
E2 receiptSha = true            // dist/package-receipt.json 的 sha256 == 实际 tgz 的 sha256
E2 receiptName= true            // receipt.output 指向 dsh-floating-accounts-1.2.0.tgz
E3 verifyBuild OK outputs=10 sources=11   // lib/ 与 src/ 的构建身份自洽
E4 版本一致：package.json=1.2.0 / MANIFEST.json=1.2.0 / src/index.js=1.2.0 / lib/client.js VERSION="1.2.0"
E5 production files leak = 0    // 42 个生产文件（lib/src/scripts/docs）无任何夹具密钥
```

E1/E2/E3/E4 全部通过；E5 确认包内出现的 `legacy-fixture-api` / `SYNTHETIC_ALPHA_KEY` **仅存在于 3 个 `tests/*.test.mjs` 夹具文件中**（测试用假密钥），生产代码零泄漏。

---

## 5. 可发布性核对

### 5.1 `package.json` 现状与本轮应补项

当前（14 行全文已核）：

```json
{
  "name": "dsh-floating-accounts",
  "version": "1.2.0",
  "main": "lib/index.js",
  "exports": {".": "./lib/index.js", "./client": "./lib/client.js", "./cordis.patch.yml": "./cordis.patch.yml", "./package.json": "./package.json"},
  "dsh": {"bundle": {"patch": "./cordis.patch.yml"}, "client": {"platform": "web", "inject": []}},
  "files": [...21 项...],
  "engines": {"node": "^22.19.0 || >=24"},
  "peerDependencies": {...4 项...},
  "scripts": {"build": …, "test": …, "pack:offline": …},
  "license": "MIT"
}
```

| 字段 | 现状 | 本轮是否应改 | 说明 |
|---|---|---|---|
| `version` | `1.2.0` | **是**（→ `1.3.0`） | 本轮含 A/B/C/D0 四批实质改动，版本号必须随发布前移；但**本轮未改**，因为改版本号会同时改变离线包文件名、打包收据与 `src/index.js` 的 `export const version`，属于发布动作，需 captain/用户确认时点 |
| `files` | 21 项 | **是** | 见 §5.2（N-19） |
| `exports` | 4 项 | **否**（本轮） | `locale/*.json`、`icon.svg` 本轮**尚未创建**；创建后再补 `"./locale/*": "./locale/*"` 等导出项 |
| `dsh.manifestVersion` | **缺失** | 是（发布前） | 宿主 manifest 走 `package.json` 的 `dsh` 字段，`manifestVersion` 应在发布元数据里补齐（t1 已核实 `plugin.json` **不是** DSH 格式，本轮**不创建** `plugin.json`） |
| `dsh.client.inject` | `[]` | 是（发布前） | 补 `["sidebar.footer.action"]` 之类的真实注入槽声明 |
| `engines.dsh` | **缺失** | 是（发布前） | 宿主 `plugin_manager` 在 pnpm 之前就用 `engines.dsh` 做拒绝判断；缺这项等于放弃宿主级版本护栏 |
| `icon` | **缺失** | 是（发布前） | 显示元数据（`icon.svg`）本轮尚未创建 |
| `locale`（展示元数据） | **缺失** | 是（发布前） | 与 `dsh-client-locale` 的**客户端文案字典**是两套东西，不能混用（t1 已核实 `locale.register(ns,{zh,en})` 的确切签名与 BCP47 校验） |
| `scripts.test` | 18 个文件 | **是**（发布前） | 见 §5.4（N-13/N-14） |

### 5.2 N-19：`files` 漏发 4 个 `docs/*.md`（实测确认）

`docs/` 实际有 8 个 md，`package.json.files` 只列了 4 个。漏发的 4 个：

```
docs/2026-11-19_余额接入-全部模型供应商-report.md
docs/2026-11-19_升级交付-多站点1.1.0-report.md
docs/balance-query-result.md
docs/balance-wallet-fix-2026-11-19.md
```

**本轮应补**：这 4 个是**交付报告与余额修复记录**，属于本插件自身的设计/修复文档，随包分发有据可查；`scripts/probe-sdk.mjs`（N-20）则是**宿主 SDK 诊断探针**，属于开发期工具，默认**不进**分发集（若要进，须同时在 `files` 里显式列出并确认不含路径泄漏）。

`files` 现有 21 项中已包含 `docs/balance-query-plan.md`、`docs/multi-site-upgrade-spec.md`、`docs/protocol-detection-spec.md`、`docs/provider-import-spec.md`（4 个正式 spec/plan）与 `Plan/` 下 3 个计划文件。

### 5.3 README 中英双语与安装/卸载纪律

**实测结论：README 目前只有中文，没有英文段。**

- `grep -n "English|## EN|# Installation|## Install" README.md` → **无命中**。
- 安装纪律**已有且写得相当严格**（README 第 98-99 行「安装纪律」段）：新环境首次安装器拒绝覆盖已有目录、只注册依赖/bundle 并备份原 profile、不读账号明文、安装/卸载独占 lifecycle 锁和快照检查、卸载保留加密数据、「已有安装不能用首次安装器强制覆盖」、不提供自动覆盖真实数据的命令。
- 卸载纪律散见于「旧数据迁移与回退」段（卸载保留加密数据、备份名回退路径）。
- 文档开头还有明确的免责句：「当前源码/离线包升级不表示已安装或迁移当前真实账号」。

**本轮应补**：README 的英文版（或英文摘要段）——GitHub 可发布仓库面向国际用户，纯中文 README 会显著降低采用率。t3 的 §10 元数据清单已把「README 中英清单」列为 1.3.0 元数据项。

### 5.4 `scripts.verify.mjs` 与 `npm test` 的文件列表差异（N-13 / N-14 实测）

| 集合 | 文件数 | 内容 |
|---|---|---|
| `package.json` `scripts.test` | 18 | vault, vault-repairs, validation-repairs, client, client-repairs, rpc-contract, balance, balance-http, balance-client, install, lifecycle-repairs, build-repairs, multi-site-vault, multi-site-balance, multi-site-client, protocol-detection, provider-import, provider-import-client |
| `scripts/verify.mjs` `localTests` | 17 | 与上**相同**，但**缺少 `tests/protocol-detection.test.mjs`** |
| 差集 | 1 | `tests/protocol-detection.test.mjs` ← **N-14 确认成立** |

**N-13（宿主 SDK 测试）核实结果**：本轮实测 **4 个宿主 SDK 测试文件可以正常运行**，无需 `node_modules`：

```
ELECTRON_RUN_AS_NODE=1 DSH_CHECKOUT='…/app.asar/dsh' '…/DeepSeek Harness.exe' \
  --expose-internals --loader ./scripts/runtime-loader.mjs \
  --test tests/host.test.mjs tests/multi-site-host.test.mjs tests/provider-import-host.test.mjs
→ ℹ tests 20 / ℹ pass 20 / ℹ fail 0   (退出码 0)
```

原因：这些测试经 `scripts/runtime-loader.mjs` 从 **ASAR 内的宿主 SDK** 解析 `@deepseek-ai/dsh-typert-protocol`，不需要本仓库 `node_modules`（本仓库也没有 `node_modules/`；`package.json` 的 `peerDependencies` 由宿主提供）。t2 报告的「因缺 node_modules 无法运行」结论**在本机不成立**——等价校验方式就是上面这条命令。仍缺的一个文件是 `tests/protocol-detection-host.test.mjs`（第 4 个宿主测试），本轮**未纳入** SDK 命令（合同给定的命令只含 3 个文件）；若要全量，应追加该文件。

`scripts/verify.mjs` 的宿主步骤是**条件启用**的：需要 `DSH_TEST_EXECUTABLE` 与 `DSH_TEST_LOADER` 两个环境变量，否则 `hostTestsSkipped=true`。本轮直接跑 `node scripts/verify.mjs`（不带这两个变量）时只跑了 2 步，退出码 0。

### 5.5 `dist/` 离线包

```
dist/dsh-floating-accounts-1.0.0.tgz   34438 B  sha256 e8f61933122b1a2abf712e8f70c0681cc78129ef5003b95078a0d87a1fc1fdf9
dist/dsh-floating-accounts-1.0.1.tgz   48568 B  sha256 fb8e8af15ee97305d7a887c078553b5308b69efcf09b3a8efc98c4dc4b02dbe1
dist/dsh-floating-accounts-1.1.0.tgz  140776 B  sha256 22fef256e256fd457640ba44770d9b94966575e67fde288ecaf9d581132076ff
dist/dsh-floating-accounts-1.1.1.tgz  154243 B  sha256 9170d0ac44ab7f4c8ccfbb1d332f57f1ddc47af094d9579e6d1eecab88478e39
dist/dsh-floating-accounts-1.2.0.tgz  231957 B  sha256 8a850094eba745269e59c48efc6e96bdf65878b436b2a2c8b07727b26d2725de  <- 当前
dist/package-receipt.json                         仅覆盖 1.2.0
```

**N-21 结论与本轮应清理项**：

- 离线包 **5 个 tgz 累积**，但只有最新的 1.2.0 有 `package-receipt.json` 收据（`pack.mjs` 每次只覆写同一份收据）。
- **本轮应保留**：`dsh-floating-accounts-1.2.0.tgz` + `package-receipt.json`（当前交付物）。注意：1.2.0 包名**与本轮代码内容已不一致**（本轮含 1.3.0 批次但 `package.json.version` 仍是 1.2.0），发布前必须改版本号并重新打包，否则**离线包与代码内容错位**。
- **本轮应清理（或明确标注为历史归档）**：`1.0.0 / 1.0.1 / 1.1.0 / 1.1.1` 四个旧 tgz。它们没有对应收据，无法自证内容，且与已发布版本的对应关系只存在于 `artifacts/` 的安装记录里。**建议**移到 `artifacts/` 下的历史归档目录而不是直接删除（保留回退证据），或直接删除——`.gitignore` 已忽略 `dist/`，因此**清理与否对仓库无影响**，本轮未做删除（避免不可逆动作）。
- 旧包的 sha256 与 `artifacts/provider-import-2026-11-20/install-1.2.0-2026-11-20.md` 中记录的 1.2.0 交付哈希 `b12992da…` **不一致**——因为该轮打包后又重新构建过（`lib/build-manifest.json` 的 `generatedAt` 会变，离线包因此不可位级复现）。这是 N-21 之外的**第二个可复现性缺口**，已登记。

### 5.6 宿主市场契约（t1 已核实，本轮不越界）

- 宿主市场安装目标由 `marketInstallTarget` 生成 `git+<url>.git#<commit>&path:/<path>` → **进市场必须先有真实 GitHub 仓库 + npm 发布**。
- `plugin.json` **不是** DSH 官方 manifest（宿主不读）→ **本轮不创建 `plugin.json`**。
- 推送 GitHub 与 npm 发布需**用户单独授权与凭据**，本轮只做到「本地可发布状态」。

---

## 6. N-23 修复：Windows inode 断言不稳定

### 6.1 问题复现与定位

原断言（`tests/multi-site-vault.test.mjs:323`）：

```js
const replacement = file + '.replacement';
await fs.writeFile(replacement, before); await fs.utimes(replacement, stableTime, stableTime);
await fs.rename(replacement, file);
assert.notEqual((await fs.stat(file)).ino, beforeStat.ino);
```

它断言的是「rename 覆盖目标后 inode **必然**改变」。这不是被测产品（`src/vault.js` 的迁移绑定）的不变量，而是**平台文件系统语义**——在 Windows 上 rename 覆盖目标时可能把目标文件的 inode 号交给新文件。

**独立探针**（`D:\FUGUI\ai\tmp\dfa-t6\inode-probe2.mjs`，50 次同字节 rename 覆盖）：

```
{ n: 50, inoSame: 0, birthSame: 49, ctimeSame: 2, mtimeSame: 50, sizeSame: 50 }
```

- 本机 50 次里 inode 恰好都没复用（`inoSame: 0`），所以本机复现概率低；
- 但 `birthtimeMs` 在 49/50 次里**相同**（Windows 的 rename 不更新 birthtime），`ctimeMs` 在 48/50 次里**不同**。

结论：**inode 号与 birthtime 在 Windows 上都不可靠**；`ctimeMs` 相对稳定但仍非 Windows 上的标准「文件身份」概念。t2 报告的「5 次仅首次失败」说明该现象在别的机器/文件系统上确实会出现。

### 6.2 真正被守护的安全不变量

该用例（`preview binds encrypted file identity and digest: same-byte-identity-restore`）守护的是：

> **同字节、相同 mtime、相同大小的「另一个文件实例」，必须被迁移预览判定为身份变化**，从而使旧预览失效、拒绝迁移。

我用独立探针（`D:\FUGUI\ai\tmp\dfa-t6\n23-probe.mjs`，60 次完整复现该场景）直接测**产品行为**而非 inode：

```
{ n: 60, inoReused: 0, vaultMissed: 0 }
```

即：60 次里 vault **每一次**都正确拒绝了迁移（`MIGRATION_PREVIEW_REQUIRED`），且文件保持逐字节不变。**产品行为是稳的**，不稳的只有测试里的 inode 断言。

### 6.3 修复方式（不删用例、不弱化语义）

把「inode 号必然改变」换成「**确定性地构造出「同字节 + 同 mtime + 同大小但不同文件实例」的状态**」，并**直接断言该状态成立**：

```js
const replacement = file + '.replacement';
await fs.writeFile(replacement, before); await fs.utimes(replacement, stableTime, stableTime);
const replacementStat = await fs.stat(replacement);
assert.notEqual(replacementStat.ino, beforeStat.ino, 'the replacement file must be a different file instance');
await fs.rm(file); await fs.link(replacement, file); await fs.rm(replacement);
const restored = await fs.stat(file);
assert.equal(restored.size, beforeStat.size, 'the restored file must keep the same byte length');
assert.equal(restored.mtimeMs, beforeStat.mtimeMs, 'the restored file must keep the same mtime');
assert.equal(digest(await fs.readFile(file)), digest(before), 'the restored file must keep the same bytes');
```

要点：

1. **候选文件先写好并校验 inode 确实不同**，再 `rm` 原文件 + `link` 候选 → 结果是原路径上换成了**另一个 inode 的文件**，且**不依赖 rename 的 inode 复用语义**。
2. **同字节、同 mtime、同大小全部显式断言**——即被测场景的三个「相同」条件一个不少地保留下来。
3. **不变量本身仍由后续断言守护**（原用例第 331-332 行未动）：`unchanged(file, () => vault.migrate(...), 'MIGRATION_PREVIEW_REQUIRED')` + 目录文件列表不变。
4. 注释明确写出**为什么不用 inode**：inode 是平台相关的、可被复用的编号，与产品代码无关。

**独立预验证**（`D:\FUGUI\ai\tmp\dfa-t6\n23-fix-probe.mjs`，40 次同构造）：
```
{ N: 40, fail: 0 }
```
（`inoDistinct && refused && sameBytes && mtimeSame && sizeSame` 每次全部成立）

### 6.4 稳定性数据（修复后连续 10 次）

```
run=1 pass 96 / fail 0
run=2 pass 96 / fail 0
run=3 pass 96 / fail 0
run=4 pass 96 / fail 0
run=5 pass 96 / fail 0
run=6 pass 96 / fail 0
run=7 pass 96 / fail 0
run=8 pass 96 / fail 0
run=9 pass 96 / fail 0
run=10 pass 96 / fail 0
```

**10/10 稳定，0 偶发失败**（修复前 t2 实测 5 次有 1 次失败）。用例未被删除、语义未被弱化，且比原来更强：现在额外断言了「同字节 + 同 mtime + 同大小」三个相同条件。

全量 `npm test` 在修复后仍为 **324 pass / 0 fail**。

---

## 7. Git 仓库初始化（本地，未推送）

### 7.1 `.gitignore`（新增，仓库根）

覆盖范围：

| 规则 | 覆盖对象 |
|---|---|
| `/dist/` | 离线包与收据 |
| `/lib/` | 构建产物（`scripts/build.mjs` 可重建） |
| `/.build-staging-*/` | 构建临时目录 |
| `node_modules/` | 依赖 |
| `artifacts/repair-baseline/` | 基线快照目录 |
| `artifacts/**/baseline/`、`artifacts/**/baseline-*/`、`artifacts/**/baseline-wallet-fix/`、`artifacts/**/baseline-sub2api/` | 各轮基线快照目录 |
| `artifacts/**/final-extracted/`、`artifacts/**/t7-extracted/` | 解包后的包内容目录 |
| `/ref/`、`/.ref/`、`/tmp/`、`/.tmp/`、`tmp-repro/` | 临时复现脚本目录 |
| `*.log`、`Thumbs.db`、`.DS_Store` | 本地噪声 |

**明确不忽略**（逐项 `git check-ignore` 验证为未忽略）：`src/`、`tests/`、`scripts/`、`docs/`、`Plan/`、`README.md`、`LICENSE`、`package.json`、`cordis.patch.yml`。

**刻意保留**：`artifacts/provider-import-2026-11-20/baseline-snapshot.json` 与 `ui-polish-baseline.json` **未**被忽略——`final-evidence.mjs` 读取前者，忽略它会让证据链在新克隆里断掉。其余 `artifacts/` 内容（各轮报告与证据）**全部入库**，因为它们是本插件对外可审计的证据链。

### 7.2 提交与 tag

```
$ git init -q
$ git config user.name "dsh-floating-accounts reviewer"
$ git config user.email "reviewer@local.invalid"
$ git config commit.gpgsign false
$ git add -A
$ git commit -m "Baseline commit before dsh-floating-accounts 1.3.0 …"
$ git tag -a v1.2.0-baseline -m "Pre-1.3.0 baseline: 1.2.0 release line plus verified D0/A/B/C batches"
```

提交信息（完整）：

```
Baseline commit before dsh-floating-accounts 1.3.0

This is the pre-1.3.0 baseline of the dsh-floating-accounts plugin: the 1.2.0
release line plus the in-flight 1.3.0 work that is already implemented and
independently verified (batch A style tokenization, batch B client
accessibility, batch C import wizard IA, and the D0 high-severity fixes
N-01/N-07 same-origin merge, N-02 prototype-shaped provider ids, N-03 late
import responses, N-05/N-06 malformed snapshot and provider ceiling).

It is committed as a rollback and review baseline, not as a release. Publishing
to GitHub or npm still requires explicit user authorization and credentials, and
no remote is configured for this repository.

Generated lib/ and dist/ are intentionally not versioned; rebuild with
node scripts/build.mjs and repackage with node scripts/pack.mjs.
```

### 7.3 提交后实际输出

```
$ git log --oneline
e579125 Baseline commit before dsh-floating-accounts 1.3.0

$ git status
On branch master
nothing to commit, working tree clean

$ git remote -v
（无输出 —— 未添加任何远程）

$ git branch -a
* master

$ git tag -l -n1
v1.2.0-baseline  Pre-1.3.0 baseline: 1.2.0 release line plus verified D0/A/B/C batches

$ git ls-files | wc -l
212

$ git ls-files src tests scripts docs Plan | wc -l
54
```

**纪律遵守**：未执行 `git remote add`、未 `push`、未创建 GitHub 仓库、未设置任何凭据（仅本地 `user.name`/`user.email`，用于生成提交者署名）。

---

## 8. 改动范围自查

本轮（t6）**唯一新增/修改的仓库文件**：

| 文件 | 动作 | 理由 |
|---|---|---|
| `.gitignore` | 新增 | 合同允许 |
| `artifacts/optimization-2026-11-21/final-review.md` | 新增 | 合同允许 |
| `artifacts/optimization-2026-11-21/release-notes-1.3.0.md` | 新增 | 合同允许 |
| `tests/multi-site-vault.test.mjs` | 修改（仅 N-23 那一处断言块） | captain 明确交办的 N-23 修复 |

**未改动**：`src/**`（全部 11 个文件）、`lib/**`、`scripts/**`、`package.json`、`docs/**`、`Plan/**`、`README.md`、`LICENSE`、`cordis.patch.yml`、已装 profile、真实加密账号文件。

---

## 9. 结论

**verdict = pass**

依据：

1. 批次 A/B/C **未引入**任何 RPC 契约变更、错误码变更、明文 Key 泄漏面、额外网络请求或绕过两段确认的路径（§1，逐条给出源码行号与对比输出）。
2. 两条高危缺陷 D0-1/D0-2 由**独立探针端到端实证**通过（§2），修复点确认在 `host-providers.js` 的**透传层**，`src/vault.js` 逐字节未改。
3. 可访问性四项（焦点迁移/归还、Esc 三级分级、Label in Name、单 alert、标题层级）在**非空桩 harness** 上实测通过（§3）。
4. 回归证据完整：`npm test` **324 pass / 0 fail**（连续 3 次）、SDK 宿主测试 **20 pass / 0 fail**、build / pack / verify 全部退出码 0（§4）。
5. `final-evidence.mjs` 退出码 1 的原因已定位为**上一轮基线错位**（4 个原因逐条列出），并给出**全部通过**的等价校验（§4.1 / §4.2）。
6. N-23 已修复且**未删用例、未弱化语义**，10/10 稳定（§6）。
7. 可发布性核对完成，缺项清单明确（§5）。
8. 本地 Git 仓库已建立，**无远程、未推送**（§7）。

### 9.1 本轮发现但不构成阻断的问题（供 backlog，非 findings）

| id | 严重度 | 问题 | 建议 |
|---|---|---|---|
| OBS-1 | 中 | `lib/build-manifest.json` 内含 `generatedAt` 时间戳 → 每次 build 产出不同字节 → 离线包不可位级复现，同一版本号的 tgz 反复重打包 sha256 都不同 | 移出 manifest 或改为由 `SOURCE_DATE_EPOCH` 决定；离线包 sha256 才能作为发布凭据 |
| OBS-2 | 低 | `package.json.version` 仍是 `1.2.0`，但工作区已含 1.3.0 的 A/B/C/D0 批次 → 离线包名与内容语义错位 | 发布前统一改 `version`（含 `src/index.js` 的 `export const version`）后重打包 |
| OBS-3 | 低 | `scripts/verify.mjs` 的宿主步骤需 `DSH_TEST_EXECUTABLE` + `DSH_TEST_LOADER` 才启用，默认只跑 17 个本地文件（比 `npm test` 少 `protocol-detection.test.mjs`） | 统一两份清单（N-14）并让 verify 默认启用宿主步骤 |

---

## 10. 还剩哪些没做（明确清单）

### 10.1 批次 D（需宿主/后端能力，本轮只评估未实现）

| 项 | 内容 | 依赖 |
|---|---|---|
| D-1 locale 字典接入 | 用 `dsh-client-locale` 的 `register(ns,{zh,en})` 把客户端文案外置为双语字典（宿主已核实签名、BCP47 校验、重复注册抛错、返回 disposer、查不到键回落显示 key） | 宿主 `dsh-client-locale` |
| D-2 `shell.overlay` 迁移 | 浮球从 `document.body` portal 迁到宿主 `shell.overlay` root 级 list 槽（宿主已核实该槽存在，overlay 层 `pointer-events:none` / 子元素 `auto`） | 宿主 `ui-layout` |
| D-3 原子批量删除 RPC | 站点/账号/凭据批量删除的原子 RPC（当前逐个删除，非原子） | 新增宿主方法 |
| D-4 `ctx.credentials` 存储层 | 改用宿主 credentials 服务存储密钥（当前自建 DPAPI vault） | 宿主 `credentials` 服务 |
| D-5 `dsh-atomic-write` | 写入改用宿主的原子写能力 | 宿主能力 |
| D-6 `settings.section` 入口 | 从 `sidebar.footer.action` 改为设置页 section 入口 | 宿主 `slots` |

### 10.2 发布动作（本轮**未做**，需用户单独授权与凭据）

| 项 | 状态 | 阻塞条件 |
|---|---|---|
| 推送 GitHub 仓库 | **未做** | 需用户授权 + 仓库地址 + 凭据；本轮**禁止** `remote add` / `push` |
| `npm publish` | **未做** | 需用户授权 + npm 凭据 + 2FA |
| 进 DSH 市场 | **未做** | 宿主市场契约要求 `git+<url>.git#<commit>&path:/<path>` → 必须先有真实 GitHub 仓库 + npm 发布 |
| `plugin.json` | **刻意不创建** | 宿主不读该文件；官方走 `package.json` 的 `dsh` 字段 |

### 10.3 真实 GUI 验收（**未做**）

本轮全部验证均为 **Node 级单元/集成测试 + ASAR SDK gateway**，**不是** GUI 验收：

- 未在运行中的 DSH 页面里真实点过浮球、拖过位置、走过导入向导；
- 未在真实 DSH profile 里真实导入过供应商、真实查过余额；
- 未验证 `--dsw-alias-*` token 在**真实宿主主题**下的最终渲染（style.css 的 token 化在无 token 的普通 Web 视口下走 fallback，只保证不退化）；
- 未验证 `@container dfa-panel` 在真实布局中的断点触发；
- 未验证真实屏幕阅读器下的焦点播报。

验收脚本 `scripts/verify-installed.mjs` 的输出里也固定写着 `realGuiVerified: false` 与 `realRpcTransportVerified: false`。

**安装纪律**：安装/升级属于**独立授权动作**，本轮未安装、未重启 DSH、未改动真实 profile。

### 10.4 审计 t2 未修项（本轮未做）

| id | 严重度 | 内容 | 本轮状态 |
|---|---|---|---|
| N-08 | 低 | YAML 重复键后者静默覆盖（providers 段会整块丢失） | 未修 |
| N-09 | 低 | YAML 数字+续行变字符串 + `version:"1"` 使凭据名单兜底失效 | 未修 |
| N-10 | 低 | `balance-http` 多 A 记录 all-or-nothing 且只取 `addresses[0]` | 未修 |
| N-11 | 低 | 导入自动绑定余额查询 Key 与 UI 承诺相反 | 未修（`vault.js` 仍设 `balanceCredentialId: credential.id`；UI 文案已如实说明「不会自动检测，也不会查询余额」，但「自动选择余额查询 Key」这一点 UI 与实际行为**仍有落差**） |
| N-12 | 低 | 失败路径 `cleanupWarnings` 在 `src/index.js:33` 被丢弃 | 未修 |
| N-13 | 低 | `npm test` 只跑 18/22 个文件 | **部分澄清**：实测 4 个宿主 SDK 测试**可**在无 `node_modules` 下运行（§5.4）；但 `scripts.test` 仍未纳入 `protocol-detection-host.test.mjs` |
| N-14 | 低 | `verify.mjs` 与 `npm test` 文件列表差集 | **已确认差集 = `tests/protocol-detection.test.mjs`**，未统一（OBS-3） |
| N-16 | 中 | `tests/` 的 `useEffect` 与 `document.addEventListener` 曾是空桩 | **部分修复**：`tests/client.test.mjs` 已升级为真实 focus log + 真实 keydown 监听器；其余测试文件（`provider-import-client.test.mjs` 等）**仍用空桩** `document.addEventListener(){}` |
| N-17 | 高 | 无 `.git` | **本轮已修**（§7） |
| N-18 | 中 | 无 CI / lint / typecheck / CHANGELOG | 未修（`CHANGELOG.md` 本轮未创建；CI workflow 未创建） |
| N-19 | 低 | `package.json.files` 漏发 4 个 `docs/*.md` | **已定位，未修**（§5.2 列出了确切 4 个） |
| N-20 | 低 | `scripts/probe-sdk.mjs` 不在分发集 | 未修（**刻意**：属开发期探针，默认不进包） |
| N-21 | 低 | `dist/` 累积 5 个 tgz 且只有最新有收据 | **已定位，未清理**（§5.5 说明清理与否对仓库无影响） |
| N-22 | 低 | `verify-installed.mjs` 只比对 5/11 个 lib 文件（余额与导入主文件不在证明范围） | 未修 |
| N-23 | 低 | Windows inode 断言偶发失败 | **本轮已修**（§6），用例保留、语义未弱化、10/10 稳定 |
| N-24（新增） | 中 | 离线包不可位级复现（manifest `generatedAt`） | 已登记为 OBS-1 |

### 10.5 其它未做

- `package.json` 的 1.3.0 元数据更新（`version` / `dsh.manifestVersion` / `engines.dsh` / `dsh.client.inject` / `icon` / `exports` / `files` 补 4 个 docs）——**本轮刻意未改**：改 `version` 会同时改变包名、收据与 `src/index.js` 的 `export const version`，属于发布动作，需 captain/用户确认时点。
- `locale/{en,zh}.json`、`icon.svg`、`CHANGELOG.md`、CI workflow —— 未创建。
- README 英文版 —— 未创建（§5.3）。

---

## 11. 纪律自检

| 纪律项 | 状态 |
|---|---|
| 不安装插件 | ✅ 未执行任何 install 脚本 |
| 不重启 DSH | ✅ 未触碰 DSH 进程 |
| 不改动真实 profile | ✅ 已装目录 58 文件保持 1.2.0 原状（17 个文件与旧快照不同**是 1.3.0 批次导致的必然差异**，非本轮写入） |
| 不改动真实加密账号文件 | ✅ 真实 vault 现为 3962 B / `e6381b94…`，mtime `2026-11-21T06:07:59Z`（本轮之前）；本轮所有写入都在 `tests/.fixtures/` 或 `D:/FUGUI/ai/tmp/dfa-t6/fixtures/` 临时目录 |
| 不推送任何远程仓库 | ✅ `git remote -v` 无输出；未创建 GitHub 仓库；未设置凭据 |
| 独立复核（不自我批准实现） | ✅ 本复核针对 t4/t5 的实现，独立重写探针（D0-1/D0-2/Esc/焦点/N-23），不采信实现者的自述结论 |
