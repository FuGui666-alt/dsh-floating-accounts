# dsh-floating-accounts 1.2.0 源码增量审计（delta-audit）

- 任务：t2 [t-audit]（dfa-130-opt 队，只读审计轮）
- 日期：2026-11-21
- 审计对象：`dsh-floating-accounts/src/`（client.js 556 / style.css 44 / index.js 83 / host-providers.js 535 / vault.js 473 / balance.js 264 / balance-http.js 138 / validation.js 73 / vault-model.js 73 / dpapi.js 63），配套 `tests/`（22 个文件）、`scripts/`（11 个）、`package.json`
- 上一轮基线：[ui-ux-review.md](../optimization-2026-11-20/ui-ux-review.md)（24 条候选项 A1–A7 / B1–B4 / C1–C5 / D1–D4 / E1–E2 / F1–F2）
- 纪律：本轮**未修改** `src/`、`lib/`、`tests/`、`scripts/`、`package.json`、`dist/`；本文件是本轮唯一新增文件。所有取证脚本写在 `D:\FUGUI\ai\tmp\dfa-audit\`（项目外），未落进仓库。

---

## 0. 取证方法与结论强度

| 手段 | 用途 | 强度 |
| --- | --- | --- |
| 逐行读 `src/` 全部 11 个文件 | 状态判定、行号锚点 | 静态事实 |
| 在 `lib/client.js`（= src/client.js 的构建产物，sha 相同）上跑 **ModuleLoader 桩 harness**（React `useState/useRef/useEffect` 桩 + 假 RPC） | 复现交互缺陷 | **可复现**，附实测输出 |
| 直接调用 `lib/vault.js` / `lib/host-providers.js` / `lib/balance.js` 导出函数 | 复现后端逻辑缺陷 | **可复现**，附实测输出 |
| `npm test`（272 项全绿）+ `node --test` 4 个被漏跑文件 | 测试覆盖面事实 | 实测 |
| `distributionFiles()` 对账 | 分发集漂移 | 实测 |

> 标注约定：**[实证]** = 本轮脚本实测复现；**[推导]** = 源码语义推导，未单独跑脚本。

---

## 1. 24 条候选项状态判定（逐条）

结论：**24 条全部仍然成立，0 条被 1.2.0 解决，0 条被部分修**。行号方面，除下表列出的偏移外，`src/client.js` 与 `src/style.css` 的行号**未漂移**（两文件行数与上一轮完全一致：556 / 44），上一轮报告的行号可直接复用。

| ID | 状态 | 当前准确行号 | 增量说明 |
| --- | --- | --- | --- |
| A1 | **仍然成立** | `client.js:520`（浮球）、`client.js:496`（面板）、`style.css:2-4` | **[实证]** 面板无 `id`、浮球无 `aria-controls`、无 `data-open`；`src/` 内 `fieldset`/`legend` 零命中。键盘移动/复位入口仍不存在。 |
| A2 | **仍然成立** | `client.js:340-348`、`228-232`、`233-237`、`139`、`318-323` | **[实证]** 全文件只有 2 处 `.focus()`（139 关闭归还、320 面板自身）。**且 320 行本身构成新问题**：该 `useEffect` 依赖 `[open, busy, editor]`，`editor` 一变就重新执行 → **打开编辑器时焦点被强行拉回面板容器**，把用户从正在操作的表单里拽走（详见 N-04）。 |
| A3 | **仍然成立** | `client.js:296-299`（冲突行）、`style.css:24` | **[实证]** 冲突区渲染 3 个 radio（新建 + 2 站点），但 `fieldset=0 / legend=0`；组名只存在于视觉 `<p>` 里，屏幕阅读器不可达。 |
| A4 | **仍然成立** | `client.js:86-87` | **[实证]** `.dfa-balance` 容器带 `aria-live=polite`，内部又有 `role='status'` / `role='alert'`。 |
| A5 | **仍然成立** | `client.js:494`、`489`、`507` | **[实证]** 4 个账号级按钮 `aria-label` 均为 `undefined`（只有余额 Key 下拉 `client.js:492` 有 `aria-label`）。 |
| A6 | **仍然成立** | `client.js:318-323`、`131`、`139` | **[实证]** `document.addEventListener('keydown', key)` 仍是**冒泡阶段**、无 `capture`；`stopPropagation()` 而非 `stopImmediatePropagation()`；Esc 路径不经过 `importBack()`，向导第二步按 Esc 直接关整面板。 |
| A7 | **仍然成立** | `client.js:497`（`strong`）、`506`（`h3`）、`487`（`strong`）、`502`/`509`/`280`（`h3`） | **[实证]** 标题序列实测为 `strong > h3 > strong` —— 面板级无标题、账号（子级）用 `strong` 弱于站点 `h3`。 |
| B1 | **仍然成立** | `style.css:6` | `backdrop-filter:blur(16px) saturate(1.18)` 硬编码，未接 `--dsw-menu-backdrop-filter`；无 `prefers-reduced-transparency` 分支。 |
| B2 | **仍然成立** | `style.css:36`、`41`、`37` | 呼吸光仍是 `box-shadow` keyframes 无限动画；`transition` 与 `animation` 同抢 `box-shadow`；无暂停开关。 |
| B3 | **仍然成立** | `style.css:5` | 三段 `rgba(21,43,94,…)` 蓝调阴影硬编码；`border-radius:20px`；未接 `--dsw-elevation-prominent` / `--dsw-specific-menu`。 |
| B4 | **仍然成立** | `client.js:506`、`style.css`（全文） | **[实证]** `content-visibility` / `contain-intrinsic-size` 零命中；`.dfa-site,.dfa-account` 仍全量渲染。 |
| C1 | **仍然成立** | `client.js:275-305`、`280`、`302` | **[实证]** 确认步渲染成功，但无步骤条（无"第 N 步"文案）、无 `aria-busy`、无"已选 N / 可导入 M"计数徽标。 |
| C2 | **仍然成立** | `client.js:291-293`、`71`、`78-81`、`263` | **[实证]** 预览行只有 `P1 · https://relay.invalid/v1 · 已配置 Key · 1 个模型`；**无"新建账号/并入「站点名」"徽标**、无汇总条。成功提示只有一句汇总 notice（`已从 DSH 导入 3 个账号（新建 2 个站点）`），无逐项清单。 |
| C3 | **仍然成立** | `client.js:505`、`288`、`490`、`style.css:10` | 全空态仍只有一种；供应商为空仍是 `.dfa-meta` 纯文本（无 `.dfa-empty`）；空态无 CTA 按钮。 |
| C4 | **仍然成立** | `client.js:498`、`544`、`57`、`63`、`270` | `error` 仍是全局字符串单槽；无 scope、无就地重试、无离线态标记。 |
| C5 | **仍然成立** | `client.js:506` | 站点卡仍只有名称/URL/协议 chip/3 按钮，无账号数/凭据数/余额摘要。 |
| D1 | **仍然成立** | `client.js:500`、`506` | 工具栏仍只有 3 个按钮；无过滤框、无排序。 |
| D2 | **仍然成立** | `client.js:420-440` | 删除仍逐条 `window.confirm`；无多选、无批量条。 |
| D3 | **仍然成立** | `client.js:296-299`、`242-248`、`226` | **[实证]** 冲突区无"应用到全部"批量策略（实测 `应用到全部` 零命中）。 |
| D4 | **仍然成立** | `client.js:494`、`149-164` | 无"全部查询余额"。 |
| E1 | **仍然成立** | `style.css:44`、`client.js:495` | 唯一断点仍是 `@media(max-width:480px)`；无 `@container`、无 `640px` 兜底。 |
| E2 | **仍然成立** | `client.js:44-53`、`54-65`、`84`、`90`、`314` | **[实证]** `toLocaleString('zh-CN')` 仍 3 处硬编码；无字典、无 locale 入口。 |
| F1 | **仍然成立** | `style.css:2,4,5,9,13,14,15,19,23,24,26-31` | 语义色（`#b73131`/`#19764b`/`#b08a1e`/`#8a6d1a`）、主色（`#5264dc`/`#6275e8`）、焦点环（`#6b82f5`/`#93a7ff`）、滚动条（`rgba(105,117,137,…)`）全部硬编码；**零处** `--dsw-alias-state-*` / `--dsw-focus-ring-*` / `--dsh-scrollbar-thumb`。页脚仍 11px（`style.css:16`）。 |
| F2 | **仍然成立** | `style.css:11`、`18` | `.dfa-account` 用 layer-2、`.dfa-site` 用 layer-1；浅色主题下同值事实未变。 |

### 1.1 判定汇总

| 状态 | 条数 | ID |
| --- | --- | --- |
| 已被 1.2.0 解决 | **0** | — |
| 已部分修 | **0** | — |
| 仍然成立 | **24** | A1–A7, B1–B4, C1–C5, D1–D4, E1–E2, F1–F2 |
| 行号漂移 | **0** | —（client.js 556 行 / style.css 44 行，与上一轮一致） |

> **结论**：上一轮报告的 24 条不是"候选项"，而是一条未动的 backlog。1.3.0 的 UI/UX 批次可直接整段执行，无需重新验证前提。

---

## 2. 新发现 —— A 类：功能与逻辑缺陷

### N-01 [高] **同一批次**内多个同源供应商会创建重复站点，且之后该 origin 的导入永久冲突

- **证据**：`src/host-providers.js:342-351`（`planImport` 自动解析）、`src/host-providers.js:437-440`（`DshProviderImporter.import` 把 plan 结果转交 vault）、`src/vault.js:443-462`（`importFromDsh` 落库）
- **推导路径**：
  1. `planImport` 对"零同源站点"分支执行 `targetSiteId = matches.length === 1 ? matches[0].id : null`（`host-providers.js:348`）——**把 `undefined`（自动解析）改写成 `null`（显式新建站点）**。
  2. `DshProviderImporter.import` 原样把 `item.targetSiteId` 放进 `imports`（`host-providers.js:437`），此时 `null` 已经是"显式新建"。
  3. `vault.importFromDsh` 看到 `targetSiteId === null` 走"显式新建站点"分支（`vault.js:443-455`），**不再做同源合并**。
- **[实证] 复现**（`planImport` → `importFromDsh` 全链，两条同 origin 供应商）：
  ```
  PLAN targetSiteId: [{"id":"p1","targetSiteId":null},{"id":"p2","targetSiteId":null}]
  PLAN conflicts: 0
  SITES: [{"name":"P1",...},{"name":"P2",...}]   SITE COUNT: 2   <-- 期望 1
  3rd import FAILED code= IMPORT_CONFLICT
    conflicts: [{"providerId":"p3","origin":"https://relay.example.com","siteIds":[P1, P2]}]
  ```
- **精确触发条件（[实证] 触发矩阵）**：**同一批次内 ≥2 个同 origin 供应商，且导入前该 origin 还没有任何站点**。

  | 导入前该 origin 的站点数 | `planImport` 给出的 targetSiteId | 结果 |
  | --- | --- | --- |
  | 0 | `[null, null]` | **建出 2 个同 origin 站点（缺陷）** |
  | 1 | `[siteId, siteId]`（同一个） | 正确并入现有站点，1 个站点（正常） |
  | 2 | 走冲突分支 | `IMPORT_CONFLICT`（正常） |

  根因：`planImport` 是按**导入前**的 `state.sites` 计算合并目标的，同批次内新创建的站点对它不可见；"0 个同源站点"分支又被写成 `null`（显式新建），于是同批次的第二个供应商**也**被判成"显式新建"。
- **[实证] 逐个单独导入不受影响**：连续两次单供应商自动解析导入 → `sites: 1  accounts: 2`（正确合并）。**缺陷仅在批量路径出现**。
- **影响**：① 一次批量导入同 relay 的多个供应商 → 建出 N 个同 origin 站点，**直接违反 UI 上写的"同 origin 已有单站点时默认并入该站点"**（`client.js:289`）；② 之后**再也无法自动导入任何该 origin 的供应商**（恒定 ≥2 个同源站点 → 恒定冲突），用户必须逐条手工选"并入站点「P1」"。
- **[实证] 修复假设已端到端验证**：把 `host-providers.js:348` 改为保留 `undefined`（仅在 `matches.length === 1` 时给 id，其余保留 `undefined`），同场景结果变为：
  ```
  FIXED plan targets: [undefined, undefined]
  FIXED result -> sites: 1 accounts: 2
    accounts per site: [{"site":"P1","accts":["P1","P2"]}]
  FIXED 3rd import MERGED -> sites: 1 accounts: 3
  FIXED explicit-null still creates a NEW site -> sites: 2 (expect 2)
  ```
  即：**同批次同 origin 正确合并为 1 个站点 + 2 个账号**；后续同 origin 导入正常并入；**"显式新建站点"（`targetSiteId: null`）语义不受影响**（仍建独立站点）。
  > 注：`FIXED plan targets` 打印为 `[null,null]` 是 `JSON.stringify` 把 `undefined` 序列化成 `null` 的显示假象，实际值是 `undefined`（由后两行结果反证）。
- **修复建议**：改动层级 = **host-providers.js（1 行）+ vault.js 复核**。`planImport` 必须保留"自动解析"与"显式新建"的语义区分（`undefined` vs `null`），并加一条"同一批次内同 origin 的后续供应商复用本批次新建站点"的批次内合并规则。预估工作量 **1.5h**。需后端能力：**否**（纯宿主侧逻辑）。
- **回归断言**：新增测试 —— 两个同 origin 供应商一次导入 → `sites.length === 1`、`accounts.length === 2`；第三次同 origin 导入 → 无 `IMPORT_CONFLICT`。

### N-02 [高] 导入向导的 providerId 若命中 `Object.prototype` 键，**用户未勾选也会被提交**

- **证据**：`src/client.js:217`（`selected[providerId] = true` / `delete selected[providerId]`）、`src/client.js:226`（`wizard.selected[c.providerId]`）、`src/client.js:286`（`checked: !!wizard.selected[p.providerId]`）、`src/client.js:222`（`wizard.selected[p.providerId]`）
- **推导路径**：`wizard.selected` 是普通对象字面量 `{}`（`client.js:206`）。读取 `selected['constructor']` / `selected['toString']` / `selected['valueOf']` / `selected['hasOwnProperty']` 会命中 `Object.prototype` 上的继承属性 → 返回**函数/对象（truthy）**。
- **[实证] 复现**（providerId = `constructor`，用户从未点过复选框）：
  ```
  constructor checkbox checked (untouched): true
  next disabled: false
  SUBMITTED selections: [{"providerId":"constructor"}]
  -> provider imported anyway: true
  ```
  `__proto__` 同样实测 `checked: true / nextDisabled: false`。
- **影响**：违反导入向导最核心的"显式两步同意"契约 —— **未经用户勾选的供应商被真实写入 vault**（含明文密钥经 DPAPI 加密落盘）。触发条件是宿主 `llm-pi-ai` 供应商配置里存在 id 为 `constructor`/`toString`/`valueOf`/`hasOwnProperty`/`__proto__` 的条目。
- **可达性**：`host-providers.js:29` 的 `PROVIDER_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/` **允许** `constructor`、`toString`、`valueOf`、`hasOwnProperty`（都是合法标识符形状），`normalizeProviders` 只做去重（`host-providers.js:286`）→ **宿主侧不拦截，客户端也不拦截**。
- **修复建议**：改动层级 = **client.js**（`selected` / `targets` / `conflicts` 三张表全部改用 `Object.create(null)` 或 `Map`；所有读取点改 `Object.hasOwn` 判断）。预估工作量 **1h**。需后端能力：**否**。
- **建议同时**：`host-providers.js:29` 的 `PROVIDER_ID` 增加保留名单（`constructor`/`prototype`/`__proto__` 等）作为第二道防线；`safeProviderList`（`client.js:67-71`）同步拒绝。

### N-03 [中] 取消导入后，未完成的 `listDshProviders` 迟到响应会让已取消的向导重新出现

- **证据**：`src/client.js:198-211`（`openImport`）、`src/client.js:238-241`（`cancelImport`）
- **推导路径**：`openImport` 在 `await api('listDshProviders')` 前后用 `generation !== balanceGeneration.current` 做失效判定（`client.js:205`、`:208`）。但 `cancelImport`（`client.js:238-241`）**只清 `dshImportRef` / `setDshImport(null)` / `setError('')`，既不递增 `balanceGeneration`，也不设置任何 cancelled 标记**。因此迟到的响应仍满足 `generation === balanceGeneration.current`，会把 `dshImportRef.current` 重新写成 `{status:'ready', step:'list', ...}` 并 `setDshImport(...)` → **向导复活**。
- **[实证] 复现**：
  ```
  P2 wizard visible while loading: true
  P2 after cancel, wizard gone: true
  P2 after cancel, wizard REAPPEARED: true
  P2 provider checkbox rendered again: true
  ```
- **影响**：用户点"取消导入"后，向导带着供应商清单自己回来；用户以为已取消，实际仍处于"可提交"状态，可误触提交。
- **修复建议**：改动层级 = **client.js**。`cancelImport` 内 `balanceGeneration.current++`（配合既有 generation 失效机制），或引入独立的 `importToken` 计数器。预估工作量 **0.5h**。需后端能力：**否**。
- **同类路径**：`close()`（`client.js:139`）走 `invalidateBalances()`（会递增 generation），所以关闭面板是安全的 —— 只有"取消导入"这条路径漏了。

### N-04 [中] 打开编辑器时，面板 `useEffect` 依赖 `editor` 导致焦点被强行拉回面板

- **证据**：`src/client.js:318-323`
  ```js
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const key = event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [open, busy, editor]);
  ```
- **推导路径**：`editor` 在依赖数组里。`beginEditor`（`client.js:343`）调用 `setEditor(nextEditor)` → 依赖变化 → effect 重跑 → **再次执行 `panel.current?.focus()`**。此时用户刚点开编辑器，焦点被从"打开的表单"抢回"面板容器"。
- **影响**：与 A2 同一处代码，但方向相反：A2 要的是"视图切换时把焦点迁到新视图"，而现状是"视图切换时把焦点扔回面板根部"。两者叠加后，正确修法必须是"移除 `editor` 依赖 + 新增显式焦点迁移"，不能只在 A2 上追加 `focus()`。
- **[实证] 现状**：`src/client.js` 中 `.focus()` 只有 2 处（139、320），没有任何"迁焦到表单首字段"的调用。
- **修复建议**：改动层级 = **client.js**。① 从依赖数组移除 `editor`（改为 `[open]` + 单独的 busy 派生）；② 视图容器加 `tabIndex:-1` ref，`beginEditor` / `importPreview` / `importBack` / `submitImport` 成功后显式 `focus()`。预估工作量 **2h**（与 A2 合并做）。需后端能力：**否**。

### N-05 [中] `safeSnapshot` 对畸形 `sites` 直接抛原生 `TypeError`，原始内部报错文本进 UI

- **证据**：`src/client.js:21`（`(value.sites || []).map(...)`）、`src/client.js:23`、错误渲染 `src/client.js:498`（`e.message || operationFailure(e.code)`）
- **推导路径**：`safeSnapshot` 的 schema-2 分支有 `Array.isArray(value.sites)` 校验（`client.js:11`、`:15`），但 **schema 未定义（legacy fixture / 老宿主）分支没有**：`value.sites` 若是对象 `{oops:true}`，`(value.sites || []).map` 抛原生 `TypeError`；该异常没有 `code` 属性 → `operationFailure(undefined)` 走兜底，但 `e.message` **truthy**（TypeError 有 message）→ **UI 显示的是 `(value.sites || []).map is not a function`**。
- **[实证] 复现**：
  ```
  V1 UI error text: "(value.sites || []).map is not a function"
  ```
  （对照：`accounts` 畸形时正常显示 `宿主返回的配置格式无效，请重新载入` → 说明只有 `sites` 这条路径漏了防护。）
- **影响**：① 内部实现细节（源码表达式）暴露给终端用户，与 `client.js:546` 的"永不显示网关/服务原始细节"原则自相矛盾；② 用户看到的是无意义的 JS 报错，无法判断该刷新还是重装。
- **修复建议**：改动层级 = **client.js**。① `safeSnapshot` 在 schema 未定义分支补 `Array.isArray(value.sites)` 判定（不通过即 `RPC_RESPONSE`）；② 错误渲染改为"只有 `e.code` 已知时才用 `e.message`"，否则一律 `operationFailure(e.code)`。预估工作量 **0.5h**。需后端能力：**否**。

### N-06 [中] `safeProviderList` 上限 100 < 宿主 `MAX_PROVIDERS` 1000，超限供应商整体不可导入

- **证据**：`src/client.js:68`（`value.providers.length > 100` → 抛 `RPC_RESPONSE`）、`src/host-providers.js:27`（`MAX_PROVIDERS = 1000`）
- **推导路径**：宿主允许最多 1000 个 provider 并全部返回；客户端在 `safeProviderList` 处硬拒 >100 → 整个 `listDshProviders` 响应被判为格式无效。
- **[实证] 复现**（101 个 provider）：
  ```
  P3 error banner: "宿主返回的配置格式无效，请重新载入"
  ```
  用户看到的是"配置格式无效"，实际是"供应商太多"——完全误导。
- **影响**：装了大量模型的 DSH 实例**整个供应商导入功能不可用**，且错误信息误导为配置损坏。
- **修复建议**：改动层级 = **client.js**（+ 可选 host-providers.js）。① 客户端上限提到与宿主一致（1000），或改成"按名称截断并提示"；② 错误文案区分"供应商数量超限"。预估工作量 **0.5h**。需后端能力：**否**（纯客户端上限对齐）。

### N-07 [中] `planImport` 的"自动解析"语义在跨层传递时被降级为"显式新建"，与文档注释矛盾

- **证据**：`src/host-providers.js:320-325`（注释明确写 `targetSiteId is three-valued: absent -> auto-resolve … null -> explicit new site`）、`src/host-providers.js:342-351`（实际把 absent 变成 null）、`src/vault.js:433-434`（vault 侧同样按三值语义实现）
- **推导路径**：这是 N-01 的**根因**。注释、`planImport` 的输入契约、vault 的三值实现三者一致，**只有 `planImport` 的输出违反契约**。`planImport` 单独存在时行为正确（`planImport` 直接吃 `undefined` 时返回 `undefined`），一旦经过 `DshProviderImporter` 的 `imports` 中转就被改成 `null`。
- **[实证]**：`planImport(state, items)` 直接调用 → `targetSiteId: null`（已丢失 absent 语义）。
- **修复建议**：见 N-01。改动层级 = **host-providers.js（根因）**，`vault.js` 无需改（其三值语义是对的）。预估工作量 **0.5h**（N-01 的子集）。需后端能力：**否**。

### N-08 [低] YAML 子集解析器对重复键"后者静默覆盖"，与真实 YAML 语义不符

- **证据**：`src/host-providers.js:121-181`（`parseMapping`）、`src/host-providers.js:244-264`（`parsePatchProviders` 用 `Object.assign(merged, defs)` 合并）
- **推导路径**：`parseMapping` 用 `result[name] = ...` 逐键赋值，重复键**后者覆盖前者**，无告警、无 `SubsetError`。真实 YAML 解析器（及 DSH 宿主的加载器）对重复键通常报 last-wins 或直接报错。
- **[实证] 复现**：
  ```
  Y1 duplicate key result: {"a":2}            <-- 后者静默胜出
  Y2 duplicate nested key result: {"providers":{"p2":{...}}}   <-- p1 整块丢失
  ```
- **影响**：`providers` 段重复定义时，**前一个供应商定义被静默丢弃**（Y2 中 `p1` 消失）→ 用户以为在导入两个供应商，实际只有一个。属于"猜测"型行为，与本模块"拒绝猜测、宁可整体降级"的设计原则（`host-providers.js:43-51` 注释）不一致。
- **修复建议**：改动层级 = **host-providers.js**。`parseMapping` 遇到重复键抛 `SubsetError`（整个层降级为不可读），与现有"超集结构宁可整体不可用"的策略一致。预估工作量 **0.5h**。需后端能力：**否**。

### N-09 [低] YAML 子集解析器把"数字 + 纯量续行"拼成字符串

- **证据**：`src/host-providers.js:161-178`（plain-scalar folding）、`src/host-providers.js:198-203`（`plainValue` 数字识别）
- **推导路径**：plain scalar 续行折叠**发生在类型识别之后** —— `parseScalar` 已把 `2` 识别为数字 `2`，随后 `parseMapping` 的续行循环执行 `result[name] += ...`（`host-providers.js:175`）→ 数字被字符串拼接，结果变成字符串 `"2 trailing"`。
- **[实证] 复现**：
  ```
  Y6 numeric+continuation: {"version":1,"other":"true trailing"}
  ```
  （`other` 的值 `2` 被折叠成字符串 `"2 trailing"`，且 `redact=true` 时先变 `true` 再拼成 `"true trailing"`。）
- **影响**：类型不稳定 —— 同一个字段在有无续行时类型不同（number vs string）。当前 provider 白名单只消费 `string` 字段（`baseURL`/`displayName`/`apiKeyEnv`），实际触发面窄；但 `version` 字段若在 `.credentials.yaml` 里出现续行，`document.version !== 1` 判定会因类型变成字符串而失败（`host-providers.js:466`）→ 凭据名单静默退化为空。
- **[实证] 相关**：`Y8` 显示 `version: "1"`（带引号）解析为字符串 `"1"`，同样 `!== 1` → refs 兜底直接失效。**`host-providers.js:466` 的版本闸门只接受数字 `1`**，但 `.credentials.yaml` 的 `version` 写成 `"1"` 是合法 YAML。
- **修复建议**：改动层级 = **host-providers.js**。① 版本闸门放宽为 `Number(document.version) === 1`；② 续行折叠前先确定标量类型，或在续行命中时按字符串处理。预估工作量 **0.5h**。需后端能力：**否**。

### N-10 [低] `balance-http.js` 的 DNS 钉扎在多 A 记录场景下固定用第一条，且不回退

- **证据**：`src/balance-http.js:76-85`
  ```js
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(entry =>
    !entry || !isPublicAddress(entry.address) || isIP(entry.address) !== entry.family)) {
    throw fail('BALANCE_ADDRESS', '余额接口必须解析到公网地址；未发送请求');
  }
  const pinned = addresses[0];
  ```
- **推导路径**：**全部**解析结果都必须是公网地址（`some` 判定）→ 只要有 **一个** A 记录落在私网/保留段，整次查询就失败，即使其余记录完全正常。而实际取用的又只是 `addresses[0]`，其余地址**从不使用**。
- **影响**：① **可用性风险**：公网域名只要有一条私网 A 记录（内网 DNS 污染、多机房混合解析、CDN 回源到私网），余额查询就整体不可用；② **未使用**：多 A 记录场景没有择优/回退机制，第一条不可达即 `BALANCE_NETWORK` 失败，不尝试其他已验证为公网的地址。
- **严重度说明**：**安全侧是收紧的**（没有 DNS rebinding 窗口，钉扎生效），所以这是可用性问题而非 SSRF 绕过。`isPublicAddress`（`balance-http.js:19-23`）本身覆盖完整（含 `100.64/10` CGNAT、`198.18/15`、`2001::/23`、`3fff::/20` 等）。
- **[实证] 边界覆盖已在 `tests/balance-http.test.mjs` 覆盖**（`public-IP boundary excludes private, loopback, mapped and special-use ranges` / `invalid keys, unsafe IPs and mixed DNS answers never create a request`）。
- **修复建议**：改动层级 = **balance-http.js**。① 改为"至少一条公网地址即通过，钉扎选第一条**公网**地址"；② 或保留 fail-closed 但把 `addresses[0]` 换成"第一条通过公网校验的地址"。预估工作量 **1h**（需同步改 1 条既有测试的期望）。需后端能力：**否**。

### N-11 [低] `importFromDsh` 自动把导入的凭据设为余额查询 Key，与 UI 文案承诺相反

- **证据**：`src/vault.js:465`（`balanceCredentialId: credential.id`）、`src/client.js:411`（"凭据已加密保存；明文不会回显，余额查询 Key 不会自动选择"）、`src/client.js:290`（导入说明）、`src/client.js:289`
- **推导路径**：`vault.importFromDsh` 建账号时无条件写 `balanceCredentialId: credential.id`，即导入的 model-api-key **立即成为该账号的余额查询 Key**。而手动加凭据路径（`vault.saveCredential`，`vault.js:329-342`）**不**自动选（`balanceCredentialId` 保持 `null`），UI 也明文承诺"不会自动选择"。
- **影响**：行为不一致 —— 导入的账号会立刻具备余额查询能力（一次点击即可把 Key 发往该站点），手动录入的账号则不会。用户对"导入是否等于授权查询"的理解被打破。
- **[实证]**：`V4 import account row: { …, balanceCredentialId: credential.id, … }`。
- **修复建议**：改动层级 = **vault.js**（1 处）。要么改成 `balanceCredentialId: null`（与手动路径一致），要么改 UI 文案明确"导入即绑定为余额查询 Key"。**建议前者**（默认最小权限）。预估工作量 **0.5h** + 文案同步。需后端能力：**否**。

### N-12 [低] 失败路径的 `cleanupWarnings` 在 vault → service 之间被丢弃（成功路径正常）

- **证据**：`src/vault.js:261`（`primary.cleanupWarnings = warnings`）、`src/vault.js:262`（成功路径 `result.warning = { code:'CLEANUP_WARNING', … }`）、`src/index.js:32-33`（`result()` 的 catch 只构造 `{ code, message }`）、`src/client.js:372`（读 `raw.warning?.code`）
- **[实证] 成功路径正常**（注入锁清理失败）：`CASE1 success result.warning: {"code":"CLEANUP_WARNING","message":"配置已提交，但临时文件或锁清理失败。…"}`。层级核对：`vault` 把 `warning` 挂在 `publicState()` 结果顶层 → `index.js:30` 的 `{ ...await action(), version }` 展开保留 → 网关信封 `result.value.value` → 客户端 `raw.warning` **可达**，`client.js:372` 的展示逻辑有效。**这一侧无需修改**。
- **[实证] 失败路径断链**：`CASE2 error.code: COMMIT_UNKNOWN` / `CASE2 error.cleanupWarnings: ["LOCK_CLEANUP_FAILED"]`。`index.js:33` 只取 `error.code` / `error.message` 构造错误信封 → `cleanupWarnings` 属性被丢弃。
- **影响**：`commitAttempted === true` 之后的失败正是 **COMMIT_UNKNOWN**（"提交结果无法确认"）—— 这是最需要用户人工检查锁/临时文件的场景，而恰恰在这里**清理细节不告知用户**。用户只看到"提交结果未知"，不知道 `.lock` 是否残留、要不要去清理。
- **修复建议**：改动层级 = **index.js**（1 处）。`index.js:32-33` 的 catch 里补 `cleanupWarnings` 透传（`known ? error.cleanupWarnings : undefined`），客户端 `operationFailure('COMMIT_UNKNOWN')` 文案追加"若存在残留锁/临时文件请人工处理"。预估工作量 **0.5h**。需后端能力：**否**。

---

## 3. 新发现 —— B 类：可测试性与回归缺口

### N-13 [中] `npm test` 漏跑 4 个测试文件（22 个文件只跑 18 个），且这 4 个在当前环境下**无法运行**

- **证据**：`package.json` `scripts.test`（18 个文件）vs `tests/`（22 个文件）
- **漏跑清单**：`tests/host.test.mjs`、`tests/multi-site-host.test.mjs`、`tests/protocol-detection-host.test.mjs`、`tests/provider-import-host.test.mjs`
- **[实证]** 这 4 个文件 `import { Context } from '@deepseek-ai/cordis'` 等 4 个宿主 SDK 包；项目**没有 `node_modules/`**（`ls node_modules` → No such file or directory），`require.resolve('@deepseek-ai/cordis')` → MISSING → 直接运行抛 `ERR_MODULE_NOT_FOUND`。
- **影响**：这 4 个文件覆盖的是**真实 Cordis 服务注册 / 真实 SDK 网关**路径（`rpc-contract.test.mjs` 的对端）。它们在 `npm test` 里"绿灯"是因为**根本没跑**。`scripts/verify.mjs:6-7` 的做法是对的（用 `DSH_TEST_EXECUTABLE` + `DSH_TEST_LOADER` 显式标记"宿主可用才跑"），但 `package.json` 的 `npm test` 没有任何等价标注 → **读 CI 日志的人会误以为 272 项覆盖了全部**。
- **修复建议**：改动层级 = **package.json**。① `scripts.test` 改为 `node --test tests/`（自动收录全部 22 个），把宿主 SDK 那 4 个移入独立脚本 `test:host`；② 或在 `test` 里加显式 skip 标记并在输出里说明。预估工作量 **0.5h**。需后端能力：**否**。

### N-14 [中] `scripts/verify.mjs` 的 `localTests` 列表与 `package.json` 的 `npm test` 列表**不一致**

- **证据**：`scripts/verify.mjs:4`（17 个）vs `package.json` `scripts.test`（18 个）
- **[实证]** 差集：`in npm test but NOT in verify.mjs: ['tests/protocol-detection.test.mjs']`
- **影响**：两条"回归入口"覆盖不同的文件集合 → `artifacts/verification.json`（`verify.mjs:10` 产出）的 `completeLocalRegression: true` **不代表 `npm test` 的全集通过**。发布前用哪条命令决定证据强度。
- **修复建议**：改动层级 = **scripts/verify.mjs**（或抽一个共享的测试清单模块）。预估工作量 **0.5h**。需后端能力：**否**。

### N-15 [中] 关键路径缺断言（逐条）

| # | 缺失的断言 | 证据 | 影响 |
| --- | --- | --- | --- |
| a | **build 失败的事务性** | `scripts/build.mjs:11-34`；`tests/build-repairs.test.mjs` 只测 `verifyBuild`（4 例），**不测 build 本身** | build 先写私有 staging、全部 `--check` 通过后才 promote 到 `lib/`（`build.mjs:20-29`），逻辑上是事务的；但 `build.mjs:29` 把 **staging 目录里所有文件**直接 copy 到 `lib/`，包括 `build-manifest.json` —— 一旦 staging 里多出一个不在白名单里的文件，它会**进入 `lib/` 并被 `verifyBuild` 认可**。没有测试锁定这条边界。 |
| b | **pack 内容与 `distributionFiles` 的一致性** | `scripts/pack.mjs:13-18`；`tests/` 中 `pack.mjs` **零命中**（实测） | `pack.mjs:17` 只断言 tgz 里**含** `package/lib/client.js`，不校验 `MANIFEST.json` 的 `files` 与 tgz 实际条目一致；`rows.length` 与 `list.stdout` 的行数**没有交叉校验**。离线包内容漂移不会被 CI 拦住。 |
| c | **client 焦点迁移** | `tests/` 中 `focus()` **零命中**（实测） | A2 / N-04 的修复没有回归护栏；现有 harness（`tests/client.test.mjs:3-13`）的 `document.addEventListener` 是**空桩**，连 Esc 都测不了。 |
| d | **导入冲突分支** | `tests/provider-import-client.test.mjs` 确实有 `IMPORT_CONFLICT`（实测命中），但断言的是"radio 存在 / payload 正确" | 缺"冲突组有可访问名"（A3）与"批量策略"（D3）的断言 —— 这两条 1.3.0 要落地时**必须同时补断言**，否则改完无法证明生效。 |
| e | **同源多供应商批量导入** | `tests/provider-import.test.mjs` 有 `planImport merge branches`（单例） | 无"同批次内两个同 origin 供应商 → 1 个站点"的用例 → **N-01 因此逃过全部回归**。 |
| f | **原型链键名** | 无 | 无"providerId 命中 `Object.prototype` 键"的用例 → **N-02 逃过全部回归**。 |
| g | **取消导入的迟到响应** | `tests/provider-import-client.test.mjs` 有 `panel close invalidates the wizard; late provider lists … never render` | **只覆盖了"关闭面板"，没覆盖"取消导入"** → N-03 逃过回归。 |
| h | **`safeSnapshot` 畸形输入矩阵** | `tests/provider-import-client.test.mjs` 有 `list safe DTO strips extras and rejects nested metadata objects` | 只覆盖 `list` 侧 DTO；`safeSnapshot` 的 `sites` 非数组（legacy schema 分支）无用例 → N-05 逃过回归。 |

- **修复建议**：改动层级 = **tests/**（新增用例，不改产品逻辑）。建议在 1.3.0 落地每条修复时**同批补断言**，估计合计 **3h**（8 组）。需后端能力：**否**。

### N-16 [低] `tests/` 的 harness 与真实 React 行为差距被固化成"绿灯"

- **证据**：`tests/client.test.mjs:4`（`useEffect:()=>{}` —— **所有 effect 都不执行**）、`tests/client.test.mjs:6`（`document.addEventListener:()=>{}`）、`tests/provider-import-client.test.mjs` 同构
- **推导路径**：`useEffect` 被实现成空函数 → `client.js:137-138`（alive 守卫）、`:318-323`（面板聚焦 + Esc 监听）、`scripts` 中的清理逻辑**在测试里从不执行**。这直接解释了为什么 `focus()` / Esc 这类行为无法被断言，也解释了"关闭面板能取消向导、取消导入却不能"（N-03）为何长期未被发现。
- **修复建议**：改动层级 = **tests/**。把 `useEffect` 桩升级为"记录 effect + 按 deps 变化重跑 + 执行 cleanup"，即可解锁焦点/事件/守卫类断言。预估工作量 **2h**。需后端能力：**否**。

---

## 4. 新发现 —— C 类：工程化欠账

### N-17 [中] 无 Git 仓库 —— 无版本历史、无 diff 审查、无回滚

- **证据**：`git status` → `fatal: not a git repository (or any of the parent directories): .git`
- **影响**：① 1.3.0 要落地 style.css token 化 + client.js 可访问性 + 导入向导 IA 三批改动，**没有基线可比对**，回归定位只能靠 `lib/build-manifest.json` 的 sha 快照（`build.mjs:25`）做"整体变了"的二值判断；② 任何误改无法回滚；③ GitHub 可发布目标（团队目标）**必须先有仓库**。
- **修复建议**：改动层级 = 新建 `git init` + `.gitignore`（排除 `node_modules/`、`tests/.fixtures/`、`.build-staging-*`、`artifacts/`、`dist/*.tgz`）+ 首次提交。预估工作量 **1h**。需后端能力：**否**。
- **建议 `.gitignore` 至少包含**：`node_modules/`、`tests/.fixtures/`、`.build-staging-*/`、`dist/`、`artifacts/`、`*.log`。

### N-18 [中] 无 CI、无 lint/typecheck、无 CHANGELOG

- **证据**：`ls -d .github .gitlab-ci.yml .circleci` → 全部不存在；`ls .eslintrc* eslint.config.* tsconfig.json jsconfig.json .prettierrc* biome.json` → 全部不存在；`ls | grep -i change` → 无 CHANGELOG
- **影响**：
  - **无 CI**：272 项回归全靠人工记得跑 `npm test`；`scripts/verify.mjs` 存在但无自动触发。
  - **无 lint/typecheck**：代码风格全靠约定。实证副作用 —— `src/client.js` 与 `src/style.css` 都是**单行超长压缩格式**（`style.css` 44 行承载约 13KB CSS；`client.js` 556 行承载 68KB），**行号级评审基本不可用**（这也是本轮必须逐行读而无法靠 diff 定位的原因）。无 typecheck 意味着 `client.js` 里 `snapshot.sites.length`（`client.js:505`）这类**可能为 undefined 的属性访问**不会被静态发现 —— N-05 正是此类。
  - **无 CHANGELOG**：1.2.0 → 1.3.0 的对外变更没有可追溯记录，而 README 里已有 `## 1.2.0升级范围` / `## 1.1.0升级范围` 两段手写（`README.md:5`、`:15`）—— 说明版本说明目前靠 README 手工维护。
- **修复建议**：
  - CI（GitHub Actions，1 个 workflow 文件）：`node --test tests/` + `node scripts/build.mjs` + `node scripts/pack.mjs`。
  - lint：最小成本方案 —— 加 `eslint` flat config，只开 `no-unused-vars` / `no-undef` / `eqeqeq` 三条；或先用 `node --check`（已内建于 build）替代。
  - typecheck：给 `src/client.js` 加 `// @ts-check` + `checkJs` JSDoc（成本高，**建议 1.3.0 不做**）。
  - CHANGELOG.md：Keep a Changelog 格式，1.3.0 起维护。
  - 预估工作量 **CI 2h + lint 1.5h + CHANGELOG 0.5h**。需后端能力：**否**。

### N-19 [中] `package.json` `files` 列表与磁盘实际内容漂移（4 个文件漏发）

- **证据**：`package.json` `files` 显式列出 `docs/balance-query-plan.md`、`docs/multi-site-upgrade-spec.md`、`docs/protocol-detection-spec.md`、`docs/provider-import-spec.md` —— 但 `docs/` 下还有 4 个文件未列入：
  - `docs/2026-11-19_余额接入-全部模型供应商-report.md`
  - `docs/2026-11-19_升级交付-多站点1.1.0-report.md`
  - `docs/balance-query-result.md`
  - `docs/balance-wallet-fix-2026-11-19.md`
- **[实证]**（`distributionFiles()` 对账）：
  ```
  distributionFiles count: 64
  on-disk but NOT distributed:
    "docs/2026-11-19_余额接入-全部模型供应商-report.md"
    "docs/2026-11-19_升级交付-多站点1.1.0-report.md"
    "docs/balance-query-result.md"
    "docs/balance-wallet-fix-2026-11-19.md"
  distributed but missing on disk: []
  ```
- **漂移风险（双向）**：`package.json` 的 `files` 是**手工枚举**（`distribution.mjs:21` 逐条 `add(entry)`），不是通配。新增文件时**默认不发布**，除非记得改 `package.json`。反向风险同样存在：删了 `files` 里某项但磁盘还在 → 静默不发。
- **修复建议**：改动层级 = **package.json**。① 把 `docs/balance-query-plan.md` 等 4 个具名项换成 `"docs"`（`distribution.mjs:15-17` 的目录遍历已跳过 `.` 开头、`artifacts`、`dist`、`node_modules`，安全）；② 或加一条 CI 断言："`docs/`/`Plan/` 下所有 `.md` 都必须在 `files` 里"。预估工作量 **0.5h**。需后端能力：**否**。

### N-20 [低] `scripts/probe-sdk.mjs` 是开发探针但不在分发集，也不在 `files` 白名单

- **证据**：`scripts/probe-sdk.mjs`（13 行，打印 cordis/typert-protocol 导出与注册流程），`package.json` `files` 显式列了 9 个 script，**不含 `probe-sdk.mjs`**
- **[实证]**：`distributionFiles()` 输出中无 `scripts/probe-sdk.mjs`（它确实没被 `files` 引用）。
- **影响**：① 该文件记录了 typert 远程方法注册的**逆向推导过程**，是理解 `src/index.js:71-77`（`markRemoteMethod` 手工模拟 initializer）的重要上下文，**GitHub 发布后不可见**；② 反过来说，`files` 白名单的写法反而"保护"了不该发布的文件 —— 但这是巧合而非设计。
- **修复建议**：改动层级 = 二选一。① 若视为开发文档 → 移到 `docs/` 并加入 `files`（但需先确认不含宿主内部路径/敏感信息，探针会打印 `ctx keys` 等）；② 若视为临时脚本 → 删除或加 `.md` 说明。**建议 ②**（它只是探索期工具，`src/index.js` 的做法已固化）。预估工作量 **0.5h**。需后端能力：**否**。

### N-21 [低] `dist/` 累积 5 个历史 tgz，无清理策略；`package-receipt.json` 只覆盖最新

- **证据**：`dist/` 含 `1.0.0` / `1.0.1` / `1.1.0` / `1.1.1` / `1.2.0` 五个 tgz（34KB → 203KB），加一份 `package-receipt.json`（仅记录最新一次的 sha + files）
- **影响**：① 历史包在 GitHub 发布后若未忽略会撑大仓库；② **只有最新的有 receipt** → 旧包无法自证完整性；③ 无 `dist/` 的 `.gitignore`（N-17 会一并解决）。
- **修复建议**：改动层级 = **scripts/pack.mjs**（可选：保留最近 N 个 + 为每个包写 receipt）。预估工作量 **0.5h**。需后端能力：**否**。

### N-22 [低] `verify-installed.mjs` 只比对 5 个文件，安装完整性证明不足

- **证据**：`scripts/verify-installed.mjs:15` —— `for(const name of ['index.js','validation.js','vault.js','dpapi.ps1','client.js'])`
- **[实证]**：`lib/` 实际产出 11 个文件（`build.mjs:24` 的 `outputs` 列表：`index.js`/`vault.js`/`vault-model.js`/`validation.js`/`dpapi.js`/`client.js`/`dpapi.ps1`/`balance.js`/`balance-http.js`/`host-providers.js` + `build-manifest.json`）。**`balance.js` / `balance-http.js` / `host-providers.js` / `vault-model.js` / `dpapi.js` / `build-manifest.json` 都不在安装校验范围内**。
- **影响**：安装校验的 `installedSourceMatchesBuild: true` **只覆盖 5/11**，余额查询与导入这两个 1.2.0 头条能力的主文件**未纳入证明**。
- **修复建议**：改动层级 = **scripts/verify-installed.mjs**。改为读 `lib/build-manifest.json` 的 `outputs` 全量比对（manifest 已是可信来源，`distribution.mjs:25-37` 已用它做门禁）。预估工作量 **0.5h**。需后端能力：**否**。

---

## 5. 汇总与建议排序

### 5.1 新发现一览

| ID | 类别 | 严重度 | 位置 | 需后端/宿主能力 | 工作量 |
| --- | --- | --- | --- | --- | --- |
| N-01 | 功能缺陷 | **高** | host-providers.js:348 / vault.js:443 | 否 | 1.5h |
| N-02 | 功能缺陷 | **高** | client.js:217/222/226/286 | 否 | 1h |
| N-03 | 功能缺陷 | 中 | client.js:238-241 | 否 | 0.5h |
| N-04 | 功能缺陷 | 中 | client.js:318-323 | 否 | 2h |
| N-05 | 功能缺陷 | 中 | client.js:21/498 | 否 | 0.5h |
| N-06 | 功能缺陷 | 中 | client.js:68 vs host-providers.js:27 | 否 | 0.5h |
| N-07 | 功能缺陷（根因） | 中 | host-providers.js:320-351 | 否 | 0.5h |
| N-08 | 功能缺陷 | 低 | host-providers.js:121-181 | 否 | 0.5h |
| N-09 | 功能缺陷 | 低 | host-providers.js:161-178,466 | 否 | 0.5h |
| N-10 | 功能缺陷 | 低 | balance-http.js:76-85 | 否 | 1h |
| N-11 | 功能缺陷 | 低 | vault.js:465 | 否 | 0.5h |
| N-12 | 功能缺陷 | 低 | vault.js:261 / index.js:33 | 否 | 0.5h |
| N-13 | 可测试性 | 中 | package.json `scripts.test` | 否 | 0.5h |
| N-14 | 可测试性 | 中 | scripts/verify.mjs:4 | 否 | 0.5h |
| N-15 | 可测试性 | 中 | tests/（8 组缺断言） | 否 | 3h |
| N-16 | 可测试性 | 低 | tests/client.test.mjs:4,6 | 否 | 2h |
| N-17 | 工程化 | 中 | 仓库根（无 .git） | 否 | 1h |
| N-18 | 工程化 | 中 | 仓库根（无 CI/lint/CHANGELOG） | 否 | 4h |
| N-19 | 工程化 | 中 | package.json `files` | 否 | 0.5h |
| N-20 | 工程化 | 低 | scripts/probe-sdk.mjs | 否 | 0.5h |
| N-21 | 工程化 | 低 | dist/ | 否 | 0.5h |
| N-22 | 工程化 | 低 | scripts/verify-installed.mjs:15 | 否 | 0.5h |

**合计**：新发现 22 条（高 2 / 中 9 / 低 11），预估 **22.5h**。

### 5.2 建议的 1.3.0 批次（与团队既定批次对齐）

- **批次 A（纯 style.css，零行为变更）**：F1 → B3 → F2 → B1 → B4 → E1 —— 6 条，~5.5h
- **批次 B（client.js 可访问性）**：A2（**含 N-04 的 effect 依赖修正**）→ A3 → A4 → A5 → A6 → A7 → A1 —— 7 条，~9h
- **批次 C（信息架构 / 导入向导 IA）**：C1 → C2 → C3 → C4 → C5 → D1 → D3 → D4 → D2(前端版) —— 9 条，~17h
- **批次 D（功能缺陷修复，1.3.0 必做）**：**N-01 + N-07**（同源合并，高）→ **N-02**（原型链，高）→ N-03 / N-04 / N-05 / N-06 —— ~6h
- **批次 E（可测试性）**：N-15 的 8 组断言（**必须与批次 B/C/D 同批落地**）→ N-16（harness 升级）→ N-13 / N-14 —— ~6h
- **批次 F（工程化 / GitHub 发布前置）**：**N-17（git init）** → N-19 → N-18（CI+lint+CHANGELOG）→ N-22 → N-20 / N-21 —— ~7.5h

### 5.3 优先做的 3 件事（若 1.3.0 时间有限）

1. **N-17 `git init`**（1h）—— 其余所有改动都依赖它做基线与回滚，且是 GitHub 发布的硬前置。
2. **N-01 + N-02**（2.5h）—— 两条高severity 的**功能正确性**缺陷：同源批量导入建重复站点、用户未勾选的供应商被写入。前者直接违反 UI 上写给用户的承诺，后者违反导入向导最核心的"显式两步同意"契约。
3. **N-15（部分，1.5h）** —— 为 N-01 / N-02 / N-03 补回归断言。这三条**逃过了现有全部 272 项回归**，补上断言才能保证修完不再退。

---

## 6. 本轮边界与未覆盖项

1. **未做浏览器/GUI 实测**：焦点行为、Esc 分级、屏幕阅读器播报均以源码语义推导 + Node harness 复现为准；`useEffect` 桩（`tests/client.test.mjs:4`）与真实 React 的差异已在 N-16 标注。
2. **未修改任何产品代码**：所有复现脚本写在 `D:\FUGUI\ai\tmp\dfa-audit\`（项目目录外），`src/`、`lib/`、`tests/`、`scripts/`、`package.json`、`dist/` 均未改动；`npm test` 运行前后 272 项全绿（fail 0）。
3. **宿主 SDK 路径未实测**：N-13 的 4 个文件因缺 `node_modules`（4 个宿主 SDK 包）无法运行；`src/host-providers.js` 的 `ctx.get('credentials')` / `credentials.describe/resolve` 真实链路未验证。
4. **未审 `src/dpapi.js` 内部实现**（63 行，PowerShell 调用与 base64 编解码边界）—— 属其他轮次范围。
5. **`planImport` 的批次内同源合并语义**（N-01 的修复细节）需产品确认：同批次两个同 origin 供应商**合并到 1 个站点**是否与"每个供应商一个账号"的既有语义兼容 —— 本报告按既有注释（`host-providers.js:320-325`）判定为"应合并"。
