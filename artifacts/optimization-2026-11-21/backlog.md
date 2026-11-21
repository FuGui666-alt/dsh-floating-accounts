# dsh-floating-accounts 1.3.0 实施 backlog 与批次划分

- 任务：t3 [t-backlog]（dfa-130-opt 队，规划轮）
- 日期：2026-11-21
- 汇总输入：
  - [github-research.md](github-research.md)（t1，489 行）—— GitHub 同类项目 5 个读源码 + 4 个仅题录；宿主 `app.asar` 只读核实；「宿主已提供但本插件尚未使用」12 条
  - [delta-audit.md](delta-audit.md)（t2，407 行）—— 24 条旧候选项状态判定（全部仍成立、零行号漂移）+ 新发现 22 条（高 2 / 中 9 / 低 11，22.5h）
  - [../optimization-2026-11-20/ui-ux-review.md](../optimization-2026-11-20/ui-ux-review.md)（上一轮 24 条 A1–F2 基线）
- 本插件基线（实测）：`src/style.css` 44 行 / `src/client.js` 556 行 / `src/index.js` 83 行 / `src/host-providers.js` 535 行 / `src/vault.js` 473 行 / `tests/` 22 个文件 / `package.json` version `1.2.0`
- **纪律**：本轮**未修改** `src/`、`lib/`、`tests/`、`scripts/`、`package.json`、`dist/`；本文件是本轮唯一新增文件。本文件只做规划，不含实现。

---

## 0. 结论摘要

1. **上一轮 24 条 UI/UX 候选项不是"候选项"，是一条没动过的 backlog**：t2 逐条判定，24 条**全部仍然成立**（0 条被 1.2.0 解决、0 条部分修、0 条行号漂移）。`src/client.js` 仍 556 行、`src/style.css` 仍 44 行，上一轮行号可直接复用，无需重新验证前提。
2. **合并去重后统一编号 58 条**：24（UI/UX 旧）+ 22（t2 新发现 N-01…N-22）+ 12（t1 宿主能力缺口 P0-1…P2-4）。其中 5 条为**跨来源同一问题**，已归并并在表中标注主编号：
   - N-04 → 归并进 **A2**（同一处 `useEffect` 代码，必须一次改完）
   - N-07 → 归并进 **N-01**（是 N-01 的根因，`vault.js` 三值实现正确不动）
   - P0-3 → 归并进 **F1**；P0-4 → 归并进 **F2**；P1-3 → 归并进 **A1**（仅快捷键部分延后）
3. **本轮最高优先级不是 UI，是三条功能正确性 + 一条工程前提**：
   - **N-01+N-07（高）**：同批次多同源供应商建出重复站点，之后该 origin **永久** `IMPORT_CONFLICT`，直接违反 UI 上写给用户的承诺（`src/client.js:289`）。
   - **N-02（高）**：`providerId` 命中 `Object.prototype` 键时，用户**未勾选**也会被真实提交并写入 vault（含密钥落盘），违反导入向导最核心的"显式两步同意"契约。
   - **N-17（中）**：至今**无 Git 仓库**——无版本历史、无 diff 审查、无回滚，是所有后续改动与 GitHub 发布的硬前置。
   - **N-15（中）**：8 组关键路径无断言，N-01 / N-02 / N-03 因此**逃过现有全部 272 项回归**。
4. **批次工作量合计约 38h**：D0 6h / A 5h / B 7.5h / C 8h / E 11.5h。批次 D（宿主/后端能力）**不在本轮实现**，只做评估。
5. **发布元数据结论（t1 纠正的一条错误假设）**：`plugin.json` **不是** DSH 官方 manifest（宿主 asar 内仅在 `node_modules/openai` 的 `.codex-plugin/plugin.json` 注释里命中 2 次，宿主不读它）。官方契约走 `package.json` 的 `dsh` 字段。宿主市场契约 `marketInstallTarget` 对 Git 包生成 `git+<url>.git#<commit>&path:/<path>` → **本插件要进市场必须有真实 GitHub 仓库 + npm 发布，只放离线 zip 不够**。
6. **本轮实测新发现一条**：N-23 —— `tests/multi-site-vault.test.mjs:323` 的 inode 断言在 Windows 上不稳定（`fs.rename` 覆盖目标时可能复用 inode），造成偶发假失败，会干扰发布门禁的"fail 0"判读。**仅登记，本轮不改**（详见 §9.3）。

---

## 1. 统一编号总览

层级图例：`CSS`= 仅 `src/style.css`｜`CLI`= 仅 `src/client.js`｜`HOST`= 宿主侧模块（`src/index.js` / `src/vault.js` / `src/host-providers.js` / `src/balance*.js`）｜`TEST`= 仅 `tests/`｜`PKG`= `package.json` / 新增发布文件｜`REPO`= 仓库工程｜`BACKEND`= 需新增 RPC / 需宿主能力。

| ID | 标题 | 严重度 | 层级 | 工作量 | 风险 | 批次 | 来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N-01 | 同批次多同源供应商建出重复站点，之后永久 `IMPORT_CONFLICT` | **高** | HOST | 1.5h | 中 | **D0** | t2 |
| N-07 | `planImport` 把 `undefined`（自动解析）降级为 `null`（显式新建），三值语义跨层丢失 | 中 | HOST | 0.5h | 低 | **D0**（并入 N-01） | t2 |
| N-02 | `providerId` 命中 `Object.prototype` 键时未勾选也被提交并落盘 | **高** | CLI (+HOST 防线) | 1h | 低 | **D0** | t2 |
| N-03 | 取消导入后迟到响应使已取消向导复活 | 中 | CLI | 0.5h | 低 | **D0** | t2 |
| N-06 | `safeProviderList` 上限 100 < 宿主 1000，超限供应商整体不可导入且文案误导 | 中 | CLI | 0.5h | 低 | **D0** | t2 |
| N-05 | `safeSnapshot` 畸形 `sites` 抛原生 `TypeError`，内部报错文本进 UI | 中 | CLI | 0.5h | 低 | **D0**（可选，见 §5） | t2 |
| F1 | 主色/状态色/焦点环/滚动条/阴影/圆角/字号硬编码（26 种 hex / 117 处） | P0 | CSS | 1.5h | 低 | **A** | 旧 F1 + t1 P0-3 |
| F2 | 浅色主题 layer-1/layer-2/layer-3 同值 → 面板/站点卡/账号卡完全同色 | P1 | CSS | 1h | 低 | **A** | 旧 F2 + t1 P0-4 |
| B1 | 面板 16px 磨砂硬编码，无 `prefers-reduced-transparency` 降本分支 | P1 | CSS | 1h | 低 | **A** | 旧 B1 |
| B4 | 长列表无 `content-visibility` 裁剪 | P2 | CSS | 0.5h | 低 | **A** | 旧 B4 |
| E1 | 唯一断点按视口（480px），无容器查询，480–640px 触摸目标退化 | P1 | CSS | 1h | 低 | **A** | 旧 E1 |
| A1 | 浮球↔面板缺 ARIA 关联、无开合视觉状态、键盘无法移动/复位 | P0 | CLI (+CSS) | 1.5h | 低 | **B** | 旧 A1 + t1 P1-3（快捷键部分延后） |
| A2 | 视图切换无焦点迁移与归还；**含 N-04**（`useEffect` 依赖 `editor` 强行拉回焦点） | P0 | CLI | 2h | 中 | **B** | 旧 A2 + t2 N-04 |
| A3 | 冲突单选组无 `fieldset`/`legend`，无障碍名丢失 | P0 | CLI | 1h | 低 | **B** | 旧 A3 + t1 §1.3 |
| A4 | 余额区重复 live region，状态被播报两次 | P1 | CLI | 0.5h | 低 | **B** | 旧 A4 |
| A5 | 同名按钮（查询余额/编辑账号/删除账号）无归属标识 | P1 | CLI | 1h | 低 | **B** | 旧 A5 |
| A6 | Esc 监听在冒泡阶段；向导内 Esc 直接关整面板 | P1 | CLI | 1h | 中 | **B** | 旧 A6 + t1 §1.1 |
| A7 | 标题层级跳跃（`strong → h3`），账号层级弱于站点层级 | P1 | CLI | 0.5h | 低 | **B** | 旧 A7 |
| C1 | 导入向导缺步骤指示与进度反馈（无步骤条、无 `aria-busy`、无计数徽标） | P0 | CLI (+CSS) | 2h | 低 | **C** | 旧 C1 |
| C2 | 导入预览清单缺汇总、结果徽标与重复风险定位 | P0 | CLI | 2.5h | 低 | **C** | 旧 C2 |
| C3 | 空态只有"全空"一种，缺分级空态与 CTA | P1 | CLI (+CSS) | 1.5h | 低 | **C** | 旧 C3 |
| C4 | 错误不绑定动作上下文、无就地重试、无离线态标记 | P1 | CLI | 2h | 低 | **C** | 旧 C4 |
| N-17 | 无 Git 仓库：无版本历史、无 diff 审查、无回滚 | 中 | REPO | 1h | 低 | **E**（最先做） | t2 |
| N-19 | `package.json` `files` 漏发 4 个 `docs/*.md`（手工枚举，默认不发布） | 中 | PKG | 0.5h | 低 | **E** | t2 |
| N-18 | 无 CI / 无 lint / 无 typecheck / 无 CHANGELOG | 中 | REPO | 4h | 低 | **E** | t2 |
| N-21 | `dist/` 累积 5 个历史 tgz，仅最新有 receipt，无清理策略 | 低 | REPO | 0.5h | 低 | **E** | t2 |
| N-22 | `verify-installed.mjs` 只比对 5/11 个 lib 文件（余额与导入主文件不在证明范围） | 低 | REPO | 0.5h | 低 | **E** | t2 |
| N-13 | `npm test` 只跑 18/22 个文件，漏跑的 4 个宿主 SDK 测试因缺 `node_modules` 无法运行 | 中 | PKG | 0.5h | 低 | **E** | t2 |
| N-14 | `scripts/verify.mjs` 的 `localTests` 与 `npm test` 差集为 `protocol-detection.test.mjs` | 中 | REPO | 0.5h | 低 | **E** | t2 |
| N-15 | 8 组关键路径无断言（N-01/N-02/N-03 由此逃过全部 272 项回归） | 中 | TEST | 3h | 低 | **D0/E 各摊** | t2 |
| N-16 | `tests/` 的 `useEffect` / `document.addEventListener` 是空桩，把行为缺口固化成"绿灯" | 低 | TEST | 2h | 低 | **E**（B 批的前置） | t2 |
| N-20 | `scripts/probe-sdk.mjs` 是开发探针但不在分发集 | 低 | REPO | 0.5h | 低 | **E** | t2 |
| P0-1 | 宿主 locale 字典 API 未使用（236 条中文单引号 + 32 处模板字面量硬编码，`toLocaleString('zh-CN')` 锁死 3 处） | P0 | CLI + PKG | 4–6h | 中 | **D**（评估） | t1 |
| P0-2 | 宿主 `shell.overlay` 槽位未使用（仅注册 `sidebar.footer.action`，面板自建 `createPortal`+`position:fixed`） | P0 | CLI + PKG | 1–2h | 中 | **D**（评估） | t1 |
| P1-1 | 宿主 `settings.section` 入口未使用 | P1 | CLI + HOST | 3–4h | 中 | 本轮不做 | t1 |
| P1-2 | 宿主 `ctx.credentials` 凭据服务未使用（已用于 `hasKey` 判定，未用于展示层 `source`/`writable`） | P1 | CLI | 1h（展示层）/ 8h+（存储层） | 中 | **D**（评估） | t1 |
| P1-3 | 宿主 `ctx.shortcuts` 未使用（浮球只能鼠标拖，键盘用户无法移动/复位） | P1 | CLI + PKG | 2h | 中 | 本轮不做 | t1 |
| P1-4 | 宿主 `@deepseek-ai/dsh-atomic-write` 未使用（`src/vault.js:236-246` 自研 tmp+rename） | P1 | HOST + PKG | 3h | 中 | **D**（评估） | t1 |
| P2-1 | 宿主 `@deepseek-ai/dsh-util-crypto` 的 `randomUUID` 未使用 | P2 | — | 0 | 无 | 登记不动 | t1 |
| P2-2 | 宿主 `@deepseek-ai/dsh-client-ui-secret-mask` 未使用 | P2 | — | 0 | 无 | 登记不动 | t1 |
| P2-3 | `package.json` 缺 `engines.dsh` 与 `dsh.manifestVersion` | P2 | PKG | 0.5h | 低 | **E** | t1 |
| P2-4 | 插件显示元数据与图标缺失（无 `locale/*.json`、无 `icon`） | P2 | PKG | 1h | 低 | **E** | t1 |
| D2 | 删除逐条 `window.confirm`，无多选与批量删除 | P1 | CLI / **BACKEND** | 3h（前端）/ 5h（含 RPC） | 中 | **D**（评估） | 旧 D2 |
| D3 | 同源冲突只能逐条选择，缺"应用到全部"批量策略 | P2 | CLI | 2h | 低 | 本轮不做 | 旧 D3 |
| D4 | 无"全部查询余额"批量刷新 | P2 | CLI | 2.5h | 中 | 本轮不做 | 旧 D4 |
| C5 | 站点卡信息量不足（无账号数/凭据数/余额摘要） | P1 | CLI | 1.5h | 低 | 本轮不做 | 旧 C5 |
| D1 | 无搜索过滤/排序，账号与凭据多时不可导航 | P1 | CLI | 2h | 低 | 本轮不做 | 旧 D1 |
| B2 | 呼吸光无限 `box-shadow` 动画常驻重绘，面板打开时不暂停 | P1 | CSS (+CLI 开关) | 1h | 中 | 本轮不做 | 旧 B2 |
| B3 | 面板阴影/圆角/字号与宿主菜单体系不一致 | P1 | CSS | 1h | 低 | 并入 **F1** | 旧 B3 |
| E2 | 全量文案硬编码中文，`toLocaleString('zh-CN')` 锁死 locale | P1 | CLI | 4–6h | 中 | **D**（= P0-1） | 旧 E2 |
| N-08 | YAML 子集解析器对重复键"后者静默覆盖"（`providers` 段整块丢失） | 低 | HOST | 0.5h | 中 | 本轮不做 | t2 |
| N-09 | YAML 数字+续行变字符串；`version:"1"` 使凭据名单兜底失效 | 低 | HOST | 0.5h | 中 | 本轮不做 | t2 |
| N-10 | `balance-http` 多 A 记录 all-or-nothing 且只取 `addresses[0]` | 低 | HOST | 1h | 中（触及 SSRF 防护） | 本轮不做 | t2 |
| N-11 | 导入自动绑定余额查询 Key，与 UI 文案承诺相反 | 低 | HOST | 0.5h | 中（口径待定） | 本轮不做 | t2 |
| N-12 | 失败路径 `cleanupWarnings` 在 `src/index.js:33` 被丢弃 | 低 | HOST | 0.5h | 低 | 本轮不做 | t2 |
| N-23 | `tests/multi-site-vault.test.mjs:323` 的 inode 断言在 Windows 上不稳定（rename 可能复用 inode），偶发假失败 | 低 | TEST | 0.5h | 低 | 本轮不做（仅登记） | **t3 本轮实测** |

**编号总量 59 条**。进入本轮实施范围：**D0 6 条 + A 5 条 + B 7 条 + C 4 条 + E 11 条 = 33 条**；仅评估不做：**D 6 条**；本轮不做：**20 条**（含 5 条"登记不动"、1 条 t3 本轮新发现的 N-23）。

---

## 2. 批次 D0 —— 功能正确性修复（最高优先级）

> 判据：这两批**不改变产品功能，只修正确性**。D0 全部为**纯逻辑修复**，不触碰 UI 布局与文案结构，可与批次 B/C 并行开发、最后合并回归。

### D0-1 · N-01 + N-07　同批次多同源供应商建出重复站点，之后该 origin 永久冲突

- **问题**：`planImport` 按"导入前"的 `state.sites` 计算合并目标，把"无同源站点"分支的**自动解析**（`undefined`）改写成**显式新建**（`null`）。同一批次内第二个同 origin 供应商因此也被判成显式新建 → 建出 N 个同 origin 站点 → 之后该 origin 的任何导入都恒定 ≥2 个同源站点 → 恒定 `IMPORT_CONFLICT`。
- **证据**：
  - `src/host-providers.js:342-351`（`planImport`：`targetSiteId = matches.length === 1 ? matches[0].id : null`，把 `undefined` 写成 `null`）
  - `src/host-providers.js:320-325`（注释明确写 `targetSiteId is three-valued: absent -> auto-resolve … null -> explicit new site`，**实现与注释矛盾**）
  - `src/host-providers.js:437-440`（`DshProviderImporter.import` 把 plan 结果原样转交 vault）
  - `src/vault.js:433-434` / `:443-462`（vault 侧三值实现正确，**不该改**）
  - `src/client.js:289`（UI 上写给用户的承诺："同 origin 已有单站点时默认并入该站点（仅新增账号）"）
  - t2 实测复现：`PLAN targetSiteId: [{"id":"p1","targetSiteId":null},{"id":"p2","targetSiteId":null}]` → `SITE COUNT: 2`（期望 1）→ 第 3 次导入 `IMPORT_CONFLICT`
  - t2 修复假设已端到端验证：保留 `undefined` → `sites: 1 accounts: 2`，后续同 origin 导入正常并入，且**显式新建语义（`targetSiteId: null`）不受影响**
- **建议改法**：
  1. `src/host-providers.js:348` 改为：`matches.length === 1 ? matches[0].id : undefined`（保留 absent 语义），**不写 `null`**。
  2. 增加"同一批次内同 origin 的后续供应商复用本批次新建站点"的批次内合并规则（`planImport` 内部维护本批次已认领的 origin→siteId 映射）。
  3. `src/vault.js` **不改**（三值实现已正确）；`src/client.js:289` 的 UI 文案**不改**（这次是让实现去兑现文案）。
  4. `src/host-providers.js:29` 的 `PROVIDER_ID` 正则**同步确认**：无需拦截（`constructor` 等是合法标识符形状），但见 D0-2 的第二道防线。
- **改动层级**：`HOST`（`src/host-providers.js` 1–2 处）
- **工作量**：1.5h（含 N-07 根因 0.5h）
- **风险**：**中**。三值语义是隐式契约，改错会让"显式新建站点"分支失效。缓解：保留 `null` 的显式新建语义不变 + 必配回归断言（见 §5.1）。
- **批次**：**D0**

### D0-2 · N-02　`providerId` 命中 `Object.prototype` 键时未勾选也被提交并落盘

- **问题**：`wizard.selected` / `wizard.targets` / `wizard.conflicts` 都是普通对象字面量 `{}`。读取 `selected['constructor']` / `['toString']` / `['valueOf']` / `['hasOwnProperty']` / `['__proto__']` 会命中 `Object.prototype` 的继承属性（truthy）→ 用户**从未点过复选框**也被判定为"已勾选"，并被真实写入 vault（Key 经 DPAPI 加密落盘）。
- **证据**：
  - `src/client.js:206`（`selected: {}`）
  - `src/client.js:217`（`selected[providerId] = true` / `delete selected[providerId]`）
  - `src/client.js:222`、`:226`、`:286`（读取点 `wizard.selected[p.providerId]`）
  - `src/host-providers.js:29`（`PROVIDER_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/` **允许** `constructor` / `toString` / `valueOf` / `hasOwnProperty`）
  - t2 实测复现：providerId = `constructor` → `checkbox checked (untouched): true` → `next disabled: false` → `SUBMITTED selections: [{"providerId":"constructor"}]` → `provider imported anyway: true`；`__proto__` 同样实测通过
- **建议改法**：
  1. `src/client.js`：`selected` / `targets` / `conflicts` 三张表全部改用 `Object.create(null)`（或 `Map`）；所有读取点改为 `Object.hasOwn(obj, key)` 判定。
  2. **第二道防线（宿主侧）**：`src/host-providers.js:29` 的 `PROVIDER_ID` 增加保留名单（`constructor` / `prototype` / `__proto__` / `toString` / `valueOf` / `hasOwnProperty`）；`src/client.js:67-71` 的 `safeProviderList` 同步拒绝并给出可读错误。
  3. `src/client.js:249-274` 的 `submitImport` 在 `importConfirmReady` 之外，再做一次 `Object.hasOwn` 白名单过滤，确保**提交前**的集合不含原型链键。
- **改动层级**：`CLI`（主）+ `HOST`（第二道防线）
- **工作量**：1h
- **风险**：**低**。改动是纯读取语义收紧，不改变正常 providerId 的行为。唯一风险是误把合法 providerId 拦掉——保留名单必须逐个核对。
- **批次**：**D0**

### D0-3 · N-03　取消导入后迟到响应使已取消向导复活

- **问题**：`openImport` 用 `generation !== balanceGeneration.current` 做迟到失效判定，但 `cancelImport` **既不递增 `balanceGeneration`、也不设置 cancelled 标记** → 迟到的 `listDshProviders` 响应仍满足失效条件判定，把 `dshImportRef.current` 重新写成 `{status:'ready'}` → **已取消的向导自己回来**。
- **证据**：
  - `src/client.js:198-211`（`openImport`，`generation` 判定在 `:205` / `:208`）
  - `src/client.js:238-241`（`cancelImport`：只清 `dshImportRef` / `setDshImport(null)` / `setError('')`）
  - 对照：`src/client.js:139` 的 `close()` 走 `invalidateBalances()`（会递增 generation）→ **关闭面板安全，只有"取消导入"这条路漏了**
  - t2 实测复现：`P2 after cancel, wizard REAPPEARED: true` / `P2 provider checkbox rendered again: true`
- **建议改法**：`src/client.js:238-241` 的 `cancelImport` 内 `balanceGeneration.current++`（复用既有 generation 机制），或引入独立 `importToken` 计数器。**不复用 `invalidateBalances()`**（那会连带清掉余额状态，超出本条范围）。
- **改动层级**：`CLI`
- **工作量**：0.5h
- **风险**：**低**。增量语义单调（只会让更多迟到响应失效，不会让有效响应提前失效）。
- **批次**：**D0**

### D0-4 · N-06　`safeProviderList` 上限 100 < 宿主 1000，超限时整个导入不可用且文案误导

- **问题**：宿主允许最多 1000 个 provider 并全部返回；客户端在 `safeProviderList` 处硬拒 `> 100` → 整个 `listDshProviders` 响应被判为"配置格式无效" → 装了较多模型的 DSH 实例**整个供应商导入功能不可用**，且错误文案完全误导。
- **证据**：
  - `src/client.js:68`（`value.providers.length > 100` → 抛 `RPC_RESPONSE`）
  - `src/host-providers.js:27`（`MAX_PROVIDERS = 1000`）
  - t2 实测复现：101 个 provider → 错误横幅 `"宿主返回的配置格式无效，请重新载入"`
- **建议改法**：`src/client.js:68` 的上限与宿主对齐到 1000；错误文案区分"供应商数量超限"与"配置格式无效"两码（前者走专用 `code`）。**不引入截断**（截断会静默丢用户可见的供应商，违反"拒绝猜测"原则）。
- **改动层级**：`CLI`
- **工作量**：0.5h
- **风险**：**低**
- **批次**：**D0**

### D0-5 · N-05　`safeSnapshot` 畸形 `sites` 抛原生 `TypeError`，内部报错文本进 UI　（可选）

- **问题**：`safeSnapshot` 的 schema-2 分支有 `Array.isArray(value.sites)` 校验，但 **schema 未定义（legacy fixture / 老宿主）分支没有** → `(value.sites || []).map` 抛原生 `TypeError`；该异常没有 `code` 属性，但 `e.message` truthy → UI 直接显示 **`(value.sites || []).map is not a function`**，把源码表达式暴露给终端用户，与 `src/client.js:546` 的"永不显示网关/服务原始细节"原则自相矛盾。
- **证据**：`src/client.js:11` / `:15`（有校验的分支）、`src/client.js:21`（无校验分支）、`src/client.js:498`（错误渲染 `e.message || operationFailure(e.code)`）、`src/client.js:546`（原则声明）；t2 实测：`V1 UI error text: "(value.sites || []).map is not a function"`
- **建议改法**：① `src/client.js:21` 的 legacy 分支补 `Array.isArray(value.sites)` 判定，不通过即 `RPC_RESPONSE`；② 错误渲染改为**只有 `e.code` 已知时才用 `e.message`**，否则一律 `operationFailure(e.code)`。
- **改动层级**：`CLI`
- **工作量**：0.5h
- **风险**：**低**
- **批次**：**D0（可选）**——若本轮时间紧，可顺延到批次 E 之后的 1.3.1；但**建议一并做**，因为它改的是"错误渲染"这同一个函数，与批次 C 的 C4（错误作用域化）相邻。

### D0-6 · N-15（部分）　为 D0 补回归断言（**必须与 D0 同批落地**）

- **问题**：N-01 / N-02 / N-03 逃过了现有全部 272 项回归；D0 修完若不补断言，下次改动会原样退回去。
- **证据**：t2 §3 B 类表（8 组缺失断言，a–h）；现有 `tests/provider-import.test.mjs` 只有单例的 `planImport merge branches`；`tests/provider-import-client.test.mjs` 只覆盖"关闭面板取消向导"，**没覆盖"取消导入"**。
- **建议改法**：见 §5.1 的 D0 断言清单（4 组）。**这组断言与 D0-1…D0-4 必须在同一个提交里落地。**
- **改动层级**：`TEST`
- **工作量**：1.5h（8 组里的 4 组）
- **风险**：**低**
- **批次**：**D0**

---

## 3. 批次 A —— 纯 `style.css`、零行为变更

> **批次契约**：本批**只改 `src/style.css`**，不改任何 JS、不改 DOM 结构、不改文案。验收标准 = 构建产物 `lib/client.js` 中的 CSS 字符串发生变化，且 `npm test` 全部通过、交互行为逐字不变。所有 `var()` 必须带原值 fallback，保证在无宿主 token 的普通 Web 视口下渲染不退化。

### A-1 · F1（+ B3）　宿主主题 token 化：主色 / 状态色 / 焦点环 / 滚动条 / 阴影 / 圆角 / 字号

- **问题**：`src/style.css` 硬编码 hex **26 种 / 共 117 处**（`#b08a1e`×15、`#d9deea`×14、`#697589`×11、`#f5f7fb`×10、`#b73131`×10、`#19764b`×8、`#6b82f5`×5、`#5264dc`×3 …）；焦点环硬编码 `#6b82f5`（`style.css:9`）/`#93a7ff`（`style.css:4`）；滚动条硬编码 `rgba(105,117,137,…)`（`style.css:8`）；面板阴影硬编码 `rgba(21,43,94,…)`（`style.css:5`）；主按钮硬编码 `linear-gradient(180deg,#6275e8,#5264dc)`（`style.css:9`）。宿主已提供全套对应 token，插件**零处**使用 → 明暗主题不跟随、与宿主主界面观感割裂。
- **证据**：
  - `src/style.css:2`（浮球渐变 `#7d8df6/#5264dc/#3b4dbf`）、`:4`（焦点环 `#93a7ff`）、`:5`（面板阴影 + `border-radius:20px`）、`:8`（滚动条）、`:9`（按钮 + 焦点环 `#6b82f5` + 主色渐变 + danger `#c73939`）、`:13-14`（错误/成功色 `#b73131`/`#19764b`）、`:16`（页脚 11px）、`:19`/`:23`/`:24`（警告色 `#b08a1e`/`#8a6d1a`）
  - 宿主 token 实测存在：`--dsw-alias-brand-primary`、`--dsw-alias-state-error-primary` / `-secondary`、`--dsw-alias-state-success-primary` / `-secondary` / `-tertiary`、`--dsw-alias-state-warn-primary` / `-secondary` / `-tertiary`、`--dsw-alias-state-idle-primary`、`--dsw-alias-state-business-primary`、`--dsw-alias-border-l1`/`l2`/`l3`/`l4`、`--dsw-alias-label-primary`/`-secondary`/`-tertiary`/`-caption`/`-dimmed`、`--dsw-focus-ring-color`（浅色 `#4176E6` / 深色 `#7AAAFF`）、`--dsw-focus-ring-width`（2px）、`--dsw-elevation-stroke`/`-stroke-color`/`-panel`/`-prominent`/`-soft`、`--dsw-specific-menu`、`--dsw-menu-backdrop-filter`、`--dsw-alias-scrollbar-*`
- **建议改法**（**全部保留原值作 fallback**）：
  - 焦点环：`outline:3px solid var(--dsw-focus-ring-color,#93a7ff)` → 统一宽度 `var(--dsw-focus-ring-width,2px)`（注意 `style.css:4` 现为 3px，`:9` 现为 2px，按 `:9` 的 2px 对齐宿主）
  - 状态色：`var(--dsw-alias-state-error-primary,#b73131)`、`var(--dsw-alias-state-success-primary,#19764b)`、`var(--dsw-alias-state-warn-primary,#b08a1e)`、`var(--dsw-alias-state-warn-secondary,#8a6d1a)`
  - 主色：`var(--dsw-alias-brand-primary,#5264dc)`（渐变两端分别 `var(--dsw-alias-brand-primary,#6275e8)` → `var(--dsw-alias-brand-primary,#5264dc)`）
  - 阴影：面板三层阴影 → `var(--dsw-elevation-prominent, <原三层>)`
  - 磨砂：`var(--dsw-menu-backdrop-filter, blur(16px) saturate(1.18))`（与 A-3 合并做）
  - 滚动条：`var(--dsw-alias-scrollbar-thumb, rgba(105,117,137,.35))` 系列
  - 圆角/字号：面板 20px → `var(--dsw-specific-menu, 20px)`；页脚 11px → 12px 并接 `var(--dsw-alias-label-tertiary,#697589)`
  - **`color-mix` 分支（`style.css:25-33`）内的硬编码色同样替换**，否则浅色主题仍走旧色
- **改动层级**：`CSS`
- **工作量**：1.5h
- **风险**：**低**。`var()` 带 fallback 在无 token 环境渲染不变；唯一风险是 fallback 与主题色的对比度差异——用 `color-mix` 的既有分支承接。
- **批次**：**A**

### A-2 · F2　卡片层级：浅色主题下 layer 同值 → 面板 / 站点卡 / 账号卡完全同色

- **问题**：`.dfa-panel` 用 `--dsw-alias-bg-layer-2`、`.dfa-account` 用 `--dsw-alias-bg-layer-2`、`.dfa-site` 用 `--dsw-alias-bg-layer-1`。**浅色主题下 layer-1/2/3 三者同值（`neutral-bluish-00`）** → 面板底、站点卡、账号卡完全同色，1.2.0 的卡片层次几乎不可见；**深色主题下 layer-1(875) 比 layer-2(850) 更深**，站点卡反而比面板底更深，层级方向与浅色相反。
- **证据**：`src/style.css:5`（面板 `bg-layer-2`）、`:11`（`.dfa-account` `bg-layer-2`）、`:18`（`.dfa-site` `bg-layer-1`）；宿主 asar 只读统计：`--dsw-alias-bg-layer-1` 57 次、`-2` 31 次，浅色 = `neutral-bluish-00`、深色 = 875 / 850 / 800
- **建议改法**（**改描边与 elevation，不是换 layer 号**）：
  1. `.dfa-account`（账号卡）改为 **transparent**，继承面板底
  2. `.dfa-site`（站点卡）保留 `bg-layer-1` 但描边加深到 `var(--dsw-alias-border-l2,#d9deea)`
  3. 两级之间用 `var(--dsw-elevation-soft, …)` 表达深度，而非背景层号
  4. 结果：浅色/深色下层级方向一致（面板底 < 站点卡 < 账号卡）
- **改动层级**：`CSS`
- **工作量**：1h
- **风险**：**低**
- **批次**：**A**

### A-3 · B1　面板磨砂降本 + `prefers-reduced-transparency` 分支

- **问题**：`backdrop-filter:blur(16px) saturate(1.18)` 硬编码，未接宿主 `--dsw-menu-backdrop-filter`；无 `prefers-reduced-transparency` 分支 → 低端机 / 高缩放下既掉帧又观感不统一。
- **证据**：`src/style.css:6`（`@supports` 分支内硬编码磨砂）
- **建议改法**：
  1. 磨砂值改 `var(--dsw-menu-backdrop-filter, blur(16px) saturate(1.18))`
  2. 新增 `@media (prefers-reduced-transparency: reduce)` 分支：去掉 `backdrop-filter`，回落到不透明 `var(--dsw-alias-bg-layer-2,#fff)`
  3. 与 A-1 合并做（同一属性）
- **改动层级**：`CSS`
- **工作量**：1h
- **风险**：**低**
- **批次**：**A**

### A-4 · B4　长列表 `content-visibility` 裁剪

- **问题**：`.dfa-site` / `.dfa-account` 全量渲染，无 `content-visibility` / `contain-intrinsic-size` → 上限 100 站点 × 100 账号 × 10 凭据时首屏全量构建。
- **证据**：`src/style.css` 全文零命中 `content-visibility` / `contain-intrinsic-size`
- **建议改法**：给 `.dfa-site` / `.dfa-account` 加 `content-visibility:auto` + `contain-intrinsic-size: auto 120px`（凭据行用 `auto 40px`）。**必须给 `contain-intrinsic-size`**，否则滚动条高度会跳。
- **改动层级**：`CSS`
- **工作量**：0.5h
- **风险**：**低-中**。若漏了 `contain-intrinsic-size`，长列表滚动条抖动；`content-visibility` 与 `position:fixed` 祖先的组合在旧 WebView 可能有差异——本插件宿主是 Electron（Chromium），无风险。
- **批次**：**A**

### A-5 · E1　容器查询断点替代视口断点

- **问题**：唯一断点是 `@media(max-width:480px)`，按**视口**而非**面板宽度**判定 → 480–640px 区间触摸目标退化（按钮 `min-height:34px`、输入框 `height:38px`）。
- **证据**：`src/style.css:44`（唯一 `@media(max-width:480px)`）；面板实际宽度 `Math.min(480, window.innerWidth - 24)`（`src/client.js:495`）
- **建议改法**：给 `.dfa-panel` 加 `container-type:inline-size` + `container-name:dfa-panel`，把 `@media(max-width:480px)` 的规则改写为 `@container dfa-panel (max-width: 480px)`；**保留**原 `@media` 作为兜底（不支持容器查询的环境不至于退化到无断点）。
- **改动层级**：`CSS`
- **工作量**：1h
- **风险**：**低**。容器查询在 Chromium 105+ 可用；保留 `@media` 兜底后无回退风险。
- **批次**：**A**

---

## 4. 批次 B —— `client.js` 可访问性与交互

> **批次契约**：只改 `src/client.js` 的 DOM 属性与事件绑定，**不改后端语义、不改 RPC 契约**。**必须与 N-16（harness 升级）同批或先行**，否则焦点类断言无处落地。

### B-1 · A1　浮球 ↔ 面板 ARIA 关联与展开态

- **问题**：浮球有 `aria-expanded`，但面板**无 `id`**、浮球**无 `aria-controls`** → 屏幕阅读器无法把浮球与面板关联；面板**无 `aria-haspopup`**；浮球**无开合视觉状态**（`data-open`）。
- **证据**：`src/client.js:520`（浮球：`aria-label:'账号配置悬浮球'`、`aria-expanded:open`，**无 `aria-controls`**）、`src/client.js:496`（面板：`role:'dialog'`、`aria-label:'悬浮账号配置'`、`aria-modal:false`、`tabIndex:-1`，**无 `id`**）；`src/style.css` 无 `[data-open]` 选择器
- **建议改法**：
  1. 面板加稳定 `id`（如 `dfa-panel`），浮球加 `aria-controls:'dfa-panel'` + `aria-haspopup:'dialog'`
  2. 浮球加 `data-open={String(open)}`，`style.css` 用 `[data-open="true"]` 表达开合视觉态（属批次 A 的可选项，也可放批次 B 的 CSS 增量）
  3. **键盘移动/复位**（`src/client.js:468-482` 只支持指针拖动）：浮球聚焦时支持方向键移动 + `Home` 复位到默认位。**快捷键注册（`ctx.shortcuts`，t1 P1-3）本轮不做**（需查宿主键位表，冲突风险中，见 §6）
- **改动层级**：`CLI`（+CSS 少量）
- **工作量**：1.5h
- **风险**：**低**
- **批次**：**B**

### B-2 · A2（+ N-04）　视图切换焦点迁移与归还

- **问题**：全文件只有 2 处 `.focus()`（`:139` 关闭归还、`:320` 面板自身）。视图切换（编辑器 ↔ 导入两步 ↔ 站点列表）**无焦点迁移/归还**。**且 `:320` 本身构成反向缺陷**：`useEffect` 依赖数组含 `editor`，`editor` 一变就重跑 → 打开编辑器时**焦点被强行从表单拽回面板容器**。
- **证据**：
  - `src/client.js:318-323`（`useEffect(() => { if (!open) return; panel.current?.focus(); … }, [open, busy, editor])`，依赖数组含 `editor`）
  - `src/client.js:343`（`beginEditor` 调 `setEditor(nextEditor)` → 触发 effect 重跑）
  - `src/client.js:139`（`close()` 里 `ball.current?.focus()` —— 唯一的归还焦点）
  - t2 实证：`src/client.js` 中 `.focus()` 只有 139 / 320 两处；`tests/` 中 `focus()` **零命中**
- **建议改法**（**必须与 N-04 一次改完，不得分两处**）：
  1. 从依赖数组移除 `editor`（改为 `[open]` + 单独的 busy 派生），消除"焦点被抢回"的根因
  2. 各视图容器加 `tabIndex:-1` + ref；`beginEditor` / `importPreview` / `importBack` / `submitImport` 成功后**显式 `focus()` 到新视图容器**（或表单首字段）
  3. 视图切换前记录 `document.activeElement`，视图关闭时归还（借鉴 t1 §1.3 `ProviderAccountManager.tsx:76-86` 的"打开时记录、卸载时归还"模式）
- **改动层级**：`CLI`
- **工作量**：2h
- **风险**：**中**。与 N-04 同处代码，分两处改会互相打架；且焦点断言需要 N-16 的 harness 升级先落地。
- **批次**：**B**

### B-3 · A3　导入冲突单选组 `fieldset` / `legend` 承载可访问名

- **问题**：冲突区渲染 3 个 radio（新建 + 2 站点），但**无 `fieldset`/`legend`**（`src/` 内 `fieldset`/`legend` 零命中）；组名只存在于视觉 `<p>` 里 → 屏幕阅读器不可达，用户不知道这一组属于哪个供应商。
- **证据**：`src/client.js:294-299`（冲突区：`div.dfa-import-conflict` + 视觉 `<strong>` + 多个 `label`+`input[type=radio]`）；`src/style.css:24`（`.dfa-import-conflict-row label` 样式）
- **建议改法**：每个冲突供应商包一层 `fieldset` + `legend`（legend 文案 = 供应商名 + origin），radio 组 `name` 保持 `import-target-${providerId}` 不变；样式上把 `legend` 做成与现有 `<strong>` 等价的视觉（`style.css` 增量，属批次 A 可选项）。
- **改动层级**：`CLI`（+CSS 少量）
- **工作量**：1h
- **风险**：**低**
- **批次**：**B**

### B-4 · A4　余额区 live region 去重

- **问题**：`.dfa-balance` 容器带 `aria-live=polite`，内部又有 `role='status'` / `role='alert'` → 状态被播报两次。
- **证据**：`src/client.js:86`（容器 `aria-live:'polite'`）、`:87`（内部 `role:'status'` 与 `role:'alert'`）
- **建议改法**：移除容器上的 `aria-live`，只保留内层 `role='status'` / `role='alert'`（一个区域一个 live 语义）。
- **改动层级**：`CLI`
- **工作量**：0.5h
- **风险**：**低**
- **批次**：**B**

### B-5 · A5　同名按钮加归属 `aria-label`

- **问题**：4 个账号级按钮（查询余额 / 检测协议 / 编辑账号 / 删除账号）与凭据级按钮（编辑凭据 / 删除凭据）**同名**且 `aria-label` 均为 `undefined` → 多账号时屏幕阅读器无法区分，误删风险。
- **证据**：`src/client.js:494`（账号级 4 按钮，无 `aria-label`）、`:489`（凭据级 2 按钮，无 `aria-label`）；对照 `src/client.js:492`（余额 Key 下拉**有** `aria-label: 余额查询 Key：${row.name}`）、`src/client.js:497`（收起按钮**有** `aria-label:'收起账号面板'`）
- **建议改法**：给每个按钮加 `aria-label`（含账号名 / 凭据标签），例如 `查询余额：${row.name}`、`删除账号：${row.name}`、`删除凭据：${row.label}`；`src/client.js:507` 的 legacy 分支同步。
- **改动层级**：`CLI`
- **工作量**：1h
- **风险**：**低**
- **批次**：**B**

### B-6 · A6　Esc 分级与 capture 阶段

- **问题**：`document.addEventListener('keydown', key)` 在**冒泡阶段**且无 `capture`；用 `stopPropagation()` 而非 `stopImmediatePropagation()`；Esc 路径**不经过 `importBack()`** → 向导第二步按 Esc 直接关掉整面板（用户在两步向导里被"整段退出"）。
- **证据**：`src/client.js:318-323`（keydown 监听）、`:131`、`:139`；t1 §1.1 借鉴点：`dsh-balance-pill` `client.js:150-164` 把 pointerdown 捕获与 keydown 监听**分离**
- **建议改法**：
  1. 监听改为 `addEventListener('keydown', key, true)`（捕获阶段）+ `stopImmediatePropagation()`
  2. **Esc 分级**：向导第 2 步 → `importBack()`（回第 1 步）；第 1 步 → `cancelImport()`；无向导 → `close()`
  3. 外部点击关闭与 Esc 关闭**分开两个处理函数**（借鉴 t1 的分离做法）
- **改动层级**：`CLI`
- **工作量**：1h
- **风险**：**中**。捕获阶段会影响宿主页面的 Esc 链；必须只在自己面板打开时 `preventDefault`，并在关闭时精确解绑。
- **批次**：**B**

### B-7 · A7　标题层级

- **问题**：实测标题序列为 `strong > h3 > strong` —— 面板级**无标题**（`strong`）、账号（子级）用 `strong` **弱于**站点 `h3` → 层级倒置。
- **证据**：`src/client.js:497`（面板头 `strong`）、`:506`（站点 `h3`）、`:507`（legacy 账号 `strong`）、`:487-488`（`accountView` 账号 `strong`）、`:502`（迁移预览 `h3`）、`:280`（导入 `h3`）、`:509`（编辑器 `h3`）
- **建议改法**：面板标题 `strong` → `h2`（`role=dialog` 的可访问名已由 `aria-label` 提供，视觉保持 `strong` 字号即可）；站点 `h3` → `h3`（保留）；账号 `strong` → `h4`（视觉降级为 `font-size:13px` 以维持现有观感）。视觉层级与语义层级解耦。
- **改动层级**：`CLI`（+CSS 少量）
- **工作量**：0.5h
- **风险**：**低**
- **批次**：**B**

---

## 5. 批次 C —— 导入向导与信息架构

> **批次契约**：只改 `src/client.js` 的渲染结构与文案，**不改 RPC 契约、不改数据模型**。C4 的错误作用域化会触碰 `src/client.js:498` 的错误渲染，与 D0-5（`safeSnapshot` 修复）相邻——**两处必须一起改**，否则一处改了另一处的判断逻辑会失配。

### C-1 · C1　步骤条与计数徽标

- **问题**：导入向导只有两步（`step:'list'` → `step:'confirm'`），但**无步骤指示**（无"第 N 步"文案）、**无 `aria-busy`**、**无"已选 N / 可导入 M"计数徽标** → 用户不知道自己处在哪一步、勾选了几项。
- **证据**：`src/client.js:275-305`（`importView` 全量）、`:280`（`h3 '从 DSH 导入供应商'`）、`:302`（确认步按钮）、`src/client.js:226`（`importConfirmReady` 计算 ready）
- **建议改法**：
  1. 顶部加步骤条：`第 1 步 / 共 2 步 · 选择供应商` → `第 2 步 / 共 2 步 · 预览变更`，`aria-current="step"`
  2. 列表步加计数徽标 `已选 N 项 · 可导入 M 项`（M = `providers.filter(p => p.hasKey)` 中已选数）
  3. 读取清单阶段容器加 `aria-busy='true'`
- **改动层级**：`CLI`（+CSS 少量）
- **工作量**：2h
- **风险**：**低**
- **批次**：**C**

### C-2 · C2　预览汇总与结果徽标

- **问题**：预览行只有 `P1 · https://relay.invalid/v1 · 已配置 Key · 1 个模型`；**无"新建账号 / 并入「站点名」"徽标**、**无汇总条**。导入成功提示只有一句汇总 notice，**无逐项清单** → 用户无法核对"哪个进了哪个站点"。
- **证据**：`src/client.js:291-293`（预览行）、`:263`（成功 notice）、`:71`/`:78-81`（`safeImportResult` 归一化）
- **建议改法**：
  1. 预览行加目标徽标：`新建账号` / `并入站点「<名称>」`（`s.targetSiteId === null` → 新建；`undefined` → 自动解析，按 D0-1 修复后此处也应显示"默认并入"）
  2. 预览顶部加汇总条：`将新建 N 个账号 · 并入 M 个现有站点 · 不改动任何站点配置`
  3. 导入成功后展示逐项清单（账号名 → 所属站点），替换现在的单句 notice
- **改动层级**：`CLI`
- **工作量**：2.5h
- **风险**：**低-中**。D0-1 修好后 `targetSiteId` 的 `undefined` 语义会影响这里的徽标取值——**依赖 D0-1 先落地**。
- **批次**：**C**（D0 之后）

### C-3 · C3　分级空态与 CTA

- **问题**：全空态只有一种（"请先完成配置"）；**供应商为空**仍是 `.dfa-meta` 纯文本（**无 `.dfa-empty`**）；空态**无 CTA 按钮**。
- **证据**：`src/client.js:505`（全空态）、`:288`（供应商为空）、`:490`（账号无凭据）、`src/style.css:10`（`.dfa-empty` 样式已存在但只被一处用）
- **建议改法**：分级空态 = ① 无任何配置（CTA：`+ 添加站点`）② 无可导入供应商（CTA：`重新读取清单`，并说明"宿主当前没有 llm-pi-ai 供应商"）③ 账号无凭据（CTA：`+ 添加凭据`）；统一用 `.dfa-empty` 容器 + 按钮。
- **改动层级**：`CLI`（+CSS 少量）
- **工作量**：1.5h
- **风险**：**低**
- **批次**：**C**

### C-4 · C4　错误作用域化与就地重试

- **问题**：`error` 是**全局字符串单槽**（`src/client.js:498` 渲染在面板顶部）；**无 scope**（不知道是哪个动作失败）、**无就地重试**、**无离线态标记**。冲突分支（`src/client.js:266-271`）把错误写进全局槽，而冲突区本身已有独立的 `.dfa-import-conflict` 容器 → 同一信息两处显示。
- **证据**：`src/client.js:498`（全局 error 渲染）、`:270`（`setError(e.message || operationFailure(e.code))`）、`:267`（冲突分支 `setError('')` + 冲突区自带提示）、`:544`/`:547`（宿主不可用类错误的固定文案）、`:57`/`:63`（错误码映射）
- **建议改法**：
  1. `error` 从字符串改为 `{ scope, code, message }`（scope 取 `'list' | 'import' | 'detection' | 'balance' | 'site' | 'account' | 'credential'`）
  2. 按 scope 渲染到对应区域（导入错误渲进 `.dfa-import` 区块；余额错误渲进 `.dfa-balance`；账号错误渲进该账号卡）
  3. 可重试的动作在错误旁放**就地重试按钮**（"重试读取清单" / "重新查询" / "重试导入"）
  4. 宿主不可用（`RPC_UNAVAILABLE` / `无法连接宿主`）时给**离线态标记**
  5. **与 D0-5 合并**：`src/client.js:498` 的错误渲染条件（`e.message || operationFailure(e.code)`）在两处一起改
- **改动层级**：`CLI`
- **工作量**：2h
- **风险**：**中**。`error` 是被多处读写的状态，改成对象会影响 `setError('')` 的所有调用点（`src/client.js:200`、`:209`、`:238`、`:253`、`:270`）——需逐点核对。
- **批次**：**C**

---

## 6. 批次 D —— 需宿主 / 后端能力，**单独评估，不在本轮实现**

> 本批每条都已核实宿主侧能力存在，但**每一项都会扩大本轮的风险面**。统一决策：**1.3.0 不实现，只在 backlog 中登记并写明前置条件**。理由分三类：(a) 改安全契约 / 核心写入路径（N-11、N-12、P1-2 存储层、P1-4）；(b) 需要宿主类型化键契约或新增 peer 依赖，会影响安装期兼容（P0-1、P0-2、P2-3）；(c) 需要新增 RPC 或破坏现有交互（D2 批量删除、D4 批量刷新、D3 批量策略）。

### D-1 · P0-1　宿主 locale 字典接入

- **问题**：`src/client.js` 全量硬编码中文——**含 CJK 的单引号字符串 236 条**，另有含中文的模板字面量 **32 处**；`toLocaleString('zh-CN')` 硬编码 3 处（`src/client.js:84`、`:90`、`:314`）；`package.json` 的 `dsh.client.inject` 是 `[]`。
- **证据**（宿主只读核实）：
  - `locale-client.js:1387-1413`：`register(ns, localeOrDicts, dict)` 双参形态合法（`Object.entries(localeOrDicts)`）
  - `locale-client.js:1389`：`LOCALE_ID_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u`
  - `locale-client.js:1395`：**同一 ns 的同一 locale 重复注册会抛错** → 插件重载必须 try/catch 或保证只注册一次
  - `locale-client.js:1398-1412`：disposer 只移除自己那一份（`owner.get(key) === entries`）
  - `locale-client.js:1397` / `:1436-1455`：注册只 bump revision，**不发 `locale/change`**
  - `locale-client.js:1414-1422`：`bind(ns)` 返回稳定引用
  - `locale-client.js:1423-1435`：查不到键 → 回落 `common` ns → 最后**直接显示 key 本身**（不是显示空）
  - `README.md:38`：编译期类型化键校验（**本插件是纯 JS，只能靠自检脚本保证 zh/en 键集一致**）
  - `README.md:84` / `README.zh.md`：`verify-client-ui-i18n` 强制"产品自撰的客户端文案必须走字典"
  - `renderer-client.js:742-746`：声明 `locale: NS` 的槽位自动获得 `t` 席
- **建议改法**：
  1. 新建 `locale/zh.json` + `locale/en.json`（**放包根 `locale/`，不是 `src/`** —— `host-plugin.md:33` 规定元数据读 `./locale/*.json`），键集一一对应
  2. `src/client.js` 顶部 `ctx.locale.register('floatingAccounts', {zh, en})`（**try/catch 防重复注册抛错**）+ `const t = ctx.locale.bind('floatingAccounts')`
  3. 236 条中文 + 32 处模板字面量 → `t('key')`；`toLocaleString('zh-CN')` 跟随 `ctx.locale` 当前语言
  4. `package.json` 的 `dsh.client.inject` 加 `@deepseek-ai/dsh-client-locale`；`peerDependencies` 同步
  5. **分两步**：先迁 20 条最高频文案（标题/按钮/错误）验证管线，再全量
  6. 加一条**键集自检脚本**（zh/en 键集合完全一致）
- **改动层级**：`CLI` + `PKG` + 新增 `locale/*.json`
- **工作量**：4–6h
- **风险**：**中**。改动面 268 处；键集不一致时界面会**直接显示英文键名**（`locale-client.js:1425` 的回落行为）。
- **批次**：**D（本轮不实现）**

### D-2 · P0-2　`shell.overlay` 挂载点迁移

- **问题**：本插件只注册 `sidebar.footer.action`（`src/client.js:553`），面板用 `createPortal(..., document.body)` + `position:fixed` **自行定位**；z-index 硬编码极大值 `2147483102` / `2147483101`（`src/style.css:2`、`:5`）→ 与宿主层级体系脱钩。
- **证据**（宿主只读核实）：
  - `layout-client.js:643-646`：`shell.overlay` 是 **root 级 `kind:'list'` 槽**（可叠加多个占用者）
  - `layout-client.js:313`：`renderSlot("shell.overlay", {})` 渲染点
  - `layout-client.js:73`：overlay 层 `pointer-events:none`，其子元素各自 `pointer-events:auto`
  - `README.md:34`：槽位契约
  - 宿主 overlay 层 `z-index:20`（`layout-client.js:73`）
  - 借鉴点：`dsh-balance-pill` `client.js:268-276`（`ctx.slots.inject('shell.overlay', …)` + `order:90`）；`dsh-deepseek-balance` `client.js:227-232`（`slots.register({name:'shell.overlay', id, order:100, label:'…'})`）——**注意 `label` 字段本插件目前没用**
  - `dsh-cordis-client-runner/lib/client.js` 有 `replaceRisk` 概念，取值含 `'none'` 与 `'shadows-shipped-ui'` → 迁移前须核对
- **建议改法**：在 `shell.overlay` 再注册一份（`order:95`，与 balance-pill 的 90 错开），`dsh.client.inject` 加 `@deepseek-ai/dsh-client-ui-layout`；z-index 归位为宿主层级的相对小值；**迁移前先核对 `replaceRisk`**。
- **改动层级**：`CLI` + `PKG`
- **工作量**：1–2h
- **风险**：**中**。需确认与 `sidebar.footer.action` **双挂**时的行为（是否两个入口同时渲染）；建议先只保留 overlay 一处，侧栏入口改为"展开"按钮。
- **批次**：**D（本轮不实现）**

### D-3 · D2　原子批量删除 RPC（需后端能力）

- **问题**：删除逐条 `window.confirm`（`src/client.js:420-440`），无多选、无批量条。
- **证据**：`src/client.js:420-440`
- **建议改法**：前端多选 + 批量条；后端新增 `removeAccounts` 批量 RPC，**必须原子**（一次事务、一次 revision 推进、部分失败即整体回滚）——逐条调用现有 `removeAccount` 不是原子操作，会在第 3 条失败时留下半完成状态。
- **改动层级**：`CLI` + **BACKEND**（`src/index.js` + `src/vault.js`）
- **工作量**：3h（前端）/ 5h（含 RPC）
- **风险**：**中**。批量删除的原子性直接决定用户数据一致性。
- **批次**：**D（本轮不实现）**

### D-4 · P1-2 / P1-4　`ctx.credentials` 存储层迁移 / 宿主 `dsh-atomic-write`

- **问题**：
  - P1-2：本插件**自己**用 DPAPI 存了一份密文 vault；虽然 `hasKey` 判定已用宿主的 `credentials.describe()`（`src/host-providers.js:10-17`），但**没有**用 `describe()` 返回的 `source` / `writable` 字段改善展示。
  - P1-4：`src/vault.js:236-246` 自研 tmp+`fs.rename`+事务锁，未用宿主 `@deepseek-ai/dsh-atomic-write`。
- **证据**：`dsh-credentials-readme.md:50-58`（`describe`/`resolve`/`set`/`unset`）、`:69-78`（records API）、`:113`（"Configuration carries references, never secrets"）、`:121-123`（两个变更事件）；`dsh-atomic-write-readme.md`（9557 B）；`src/vault.js:236-246`
- **建议改法**：
  - **P1-2 展示层（低风险）**：导入向导里把"Key 状态依据"说得更准（当前 `src/client.js:289` 只显示 `hasKeyBasis`），补 `source`/`writable`。**存储层迁移不在本轮**（改存储层 = 改安全契约；本插件的 DPAPI 加密落库是卖点）。
  - **P1-4**：可换用宿主包减少自研代码面，但会改 `src/vault.js` **核心写入路径**，且现有 `tests/vault*.test.mjs` 断言基于当前实现。
- **改动层级**：`HOST` + `PKG`
- **工作量**：展示层 1h / 存储层 8h+（P1-2）/ 3h（P1-4）
- **风险**：**中**
- **批次**：**D（本轮不实现）**

### D-5 · D3 / D4　冲突批量策略 / 全部查询余额

- **问题**：D3 冲突区无"应用到全部"批量策略（实测 `应用到全部` 零命中，`src/client.js:296-299`）；D4 无"全部查询余额"（`src/client.js:149-164`）。
- **建议改法**：D3 是纯前端（同一 conflict 组一次选定）；D4 是前端编排，但需确认**并发与逐站点限流**（本插件契约"余额只手动查询，不轮询"——批量查询必须是用户一次性触发，且逐站点串行）。
- **改动层级**：`CLI`
- **工作量**：D3 2h / D4 2.5h
- **风险**：D3 低；D4 **中**（批量触发的是真实外部请求，一次点击会向 N 个站点发请求，与"手动查询"契约的边界需在文案里写明）
- **批次**：**D（本轮不实现）**

---

## 7. 批次 E —— 工程化与发布前置

> **批次契约**：只改仓库工程与打包元数据，**不改产品行为**。N-17 必须**最先做**（其余一切改动的前置）。

### E-1 · N-17　`git init` + `.gitignore` + 首次提交　【最先做】

- **问题**：`git status` → `fatal: not a git repository`。→ ① 1.3.0 要落地 D0/A/B/C 四批改动，**没有基线可比对**，回归定位只能靠 `lib/build-manifest.json` 的 sha 做二值判断；② 任何误改**无法回滚**；③ GitHub 可发布目标**必须先有仓库**。
- **证据**：t2 实测 `git status` 失败；`src/` 存在但无历史
- **建议改法**：
  1. `git init` + 首次提交（**提交当前 1.2.0 状态作为基线**）
  2. `.gitignore` 至少含：`node_modules/`、`tests/.fixtures/`、`.build-staging-*/`、`dist/`、`artifacts/`、`*.log`
  3. 注意：`artifacts/` 被忽略后，历史证据文件不进仓库——如需保留 1.3.0 的评审证据，另建 `docs/reviews/` 放**精简版**结论（原始 artifacts 保留在本地）
- **改动层级**：`REPO`
- **工作量**：1h
- **风险**：**低**
- **批次**：**E（最先）**

### E-2 · N-19　`package.json` `files` 漏发 4 个 `docs/*.md`

- **问题**：`files` 显式列出 4 个 `docs/*.md`，但 `docs/` 下实际有 8 个 → **4 个漏发**。`files` 是**手工枚举**（`scripts/distribution.mjs:21` 逐条 `add(entry)`），不是通配 → **新增文件默认不发布**。
- **证据**：t2 实测 `distributionFiles()` 对账 → `distributionFiles count: 64`，漏发：`docs/2026-11-19_余额接入-全部模型供应商-report.md`、`docs/2026-11-19_升级交付-多站点1.1.0-report.md`、`docs/balance-query-result.md`、`docs/balance-wallet-fix-2026-11-19.md`；`scripts/distribution.mjs:15-17`（目录遍历已跳过 `.` 开头、`artifacts`、`dist`、`node_modules`，安全）
- **建议改法**：把 4 个具名项换成 `"docs"`（目录遍历已安全）；或加一条 CI 断言"`docs/` 与 `Plan/` 下所有 `.md` 必须在 `files` 里"。
- **改动层级**：`PKG`
- **工作量**：0.5h
- **风险**：**低**
- **批次**：**E**

### E-3 · N-18　CI / lint / CHANGELOG

- **问题**：`ls -d .github .gitlab-ci.yml .circleci` → 全不存在；无 `eslint.config.*` / `tsconfig.json` / `biome.json`；无 CHANGELOG。→ 272 项回归全靠人工记得跑；**代码风格全靠约定**。实证副作用：`src/client.js` 与 `src/style.css` 都是**单行超长压缩格式**（style.css 44 行承载 13 KB CSS；client.js 556 行承载 68 KB），**行号级评审基本不可用**——这也是 t2 必须逐行读而无法靠 diff 定位的原因。无 typecheck 意味着 `snapshot.sites.length`（`src/client.js:505`）这类可能为 undefined 的属性访问不会被静态发现（N-05 正是此类）。
- **建议改法**：
  - **CI（GitHub Actions，1 个 workflow）**：`node scripts/build.mjs` → `npm test` → `node scripts/pack.mjs`
  - **lint**：最小成本方案 —— ESLint flat config，只开 `no-unused-vars` / `no-undef` / `eqeqeq` 三条；或先用 `node --check`（已内建于 build）替代
  - **typecheck**：给 `src/client.js` 加 `// @ts-check` + `checkJs` JSDoc —— **成本高，本轮不做**
  - **CHANGELOG.md**：Keep a Changelog 格式，**从 1.3.0 起维护**
- **改动层级**：`REPO`
- **工作量**：CI 2h + lint 1.5h + CHANGELOG 0.5h
- **风险**：**低**
- **批次**：**E**

### E-4 · N-13 / N-14　测试清单一致性（两条回归入口对齐）

- **问题**：
  - N-13：`package.json` 的 `scripts.test` 只列 **18** 个文件，`tests/` 下有 **22** 个 → 漏跑 `tests/host.test.mjs`、`tests/multi-site-host.test.mjs`、`tests/protocol-detection-host.test.mjs`、`tests/provider-import-host.test.mjs`。这 4 个因缺 `node_modules`（4 个宿主 SDK 包）在当前环境**无法运行**，但读 CI 日志的人会误以为 272 项覆盖了全部。
  - N-14：`scripts/verify.mjs:4` 的 `localTests`（17 个）与 `npm test`（18 个）**差集 = `tests/protocol-detection.test.mjs`** → `artifacts/verification.json` 的 `completeLocalRegression: true` **不代表 `npm test` 全集通过**。
- **证据**：t2 实测 `require.resolve('@deepseek-ai/cordis')` → MISSING；`scripts/verify.mjs:6-7` 的 `DSH_TEST_EXECUTABLE` + `DSH_TEST_LOADER` 显式标记"宿主可用才跑"的做法**是对的**
- **建议改法**：
  1. `scripts.test` 改为 `node --test tests/`（自动收录全部 22 个），宿主 SDK 那 4 个移入独立脚本 `test:host`
  2. 抽一个**共享测试清单模块**，`npm test` 与 `scripts/verify.mjs` 共用，消除差集
  3. 在 `artifacts/verification.json` 里把"本地全集"与"宿主 SDK"两个口径**分开记录**（`hostTestsSkipped` 已有，需补 `localTestFiles` 全集清单）
- **改动层级**：`PKG` + `REPO`
- **工作量**：1h
- **风险**：**低**。改 `scripts.test` 会让 `npm test` 的**退出码行为**变化（漏跑的 4 个变成报错）——必须先确认宿主 SDK 脚本单独可跑，否则会让 CI 常年红。
- **批次**：**E**

### E-5 · N-16　`tests/` harness 升级（`useEffect` / `document.addEventListener` 空桩）

- **问题**：`tests/client.test.mjs:4` 的 `useEffect:()=>{}` —— **所有 effect 都不执行**；`:6` 的 `document.addEventListener:()=>{}` 是空桩。→ `src/client.js:137-138`（alive 守卫）、`:318-323`（面板聚焦 + Esc 监听）在测试里**从不执行**。这直接解释了为什么 `focus()` / Esc 这类行为无法被断言，也解释了"关闭面板能取消向导、取消导入却不能"（N-03）为何长期未被发现。
- **证据**：t2 实测 `tests/` 中 `focus()` **零命中**；`tests/provider-import-client.test.mjs` 同构
- **建议改法**：把 `useEffect` 桩升级为"记录 effect + 按 deps 变化重跑 + 执行 cleanup"；`document.addEventListener` 桩记录监听器并支持 `dispatchEvent`；补 `document.activeElement` / `focus()` 记录。
- **改动层级**：`TEST`
- **工作量**：2h
- **风险**：**低**。桩升级会让此前"因为 effect 不执行而侥幸通过"的测试暴露问题——**预期会有回归失败需逐个甄别**，不一定是产品缺陷。
- **批次**：**E**（**批次 B 的前置**）

### E-6 · N-15（剩余 4 组）　补齐关键路径断言

- **问题**：8 组关键路径无断言（t2 §3 B 类 a–h），其中 a/b/d-part 属批次 C/D0，剩余 4 组归此批。
- **建议改法**：见 §8.2 的 E 批断言清单（a build 事务性 / b pack 与 `distributionFiles` 一致性 / d-part 冲突组可访问名 + 批量策略 / h `safeSnapshot` 畸形输入矩阵）。
- **改动层级**：`TEST`
- **工作量**：1.5h
- **风险**：**低**
- **批次**：**E**

### E-7 · N-22　`verify-installed.mjs` 覆盖面扩到 11/11

- **问题**：`scripts/verify-installed.mjs:15` 只比对 5 个文件（`index.js`/`validation.js`/`vault.js`/`dpapi.ps1`/`client.js`），而 `lib/` 实际产出 **11** 个 → `balance.js` / `balance-http.js` / `host-providers.js` / `vault-model.js` / `dpapi.js` / `build-manifest.json` **都不在安装校验范围**。→ 安装校验的 `installedSourceMatchesBuild: true` **只覆盖 5/11**，余额查询与导入这两个 1.2.0 头条能力的主文件**未纳入证明**。
- **证据**：`scripts/verify-installed.mjs:15`；`scripts/build.mjs:24` 的 `outputs` 列表（10 个文件 + `build-manifest.json`）；`scripts/distribution.mjs:25-37` 已用 manifest 做门禁
- **建议改法**：改为读 `lib/build-manifest.json` 的 `outputs` **全量比对**（manifest 已是可信来源）。
- **改动层级**：`REPO`
- **工作量**：0.5h
- **风险**：**低**
- **批次**：**E**

### E-8 · N-20 / N-21　`probe-sdk.mjs` 归位 + `dist/` 清理

- **问题**：
  - N-20：`scripts/probe-sdk.mjs`（13 行，打印 cordis/typert-protocol 导出与注册流程）**不在 `files` 白名单** → GitHub 发布后不可见。它记录了 `src/index.js:71-77` 手工模拟 initializer 的**逆向推导过程**，是理解实现的重要上下文。
  - N-21：`dist/` 累积 5 个历史 tgz（1.0.0 → 1.2.0，34 KB → 203 KB）+ 一份 `package-receipt.json`（**仅覆盖最新一次**）→ 旧包无法自证完整性；发布后若未忽略会撑大仓库。
- **建议改法**：
  - N-20：**方案 ②（推荐）** —— 它只是探索期工具，`src/index.js` 的做法已固化 → 删除或加 `.md` 说明。若要保留上下文，**先确认不含宿主内部路径/敏感信息**（探针会打印 `ctx keys`）再移入 `docs/` 并加入 `files`。
  - N-21：`dist/` 进 `.gitignore`（E-1 一并做）；`scripts/pack.mjs` 改为保留最近 N 个包 + **为每个包写 receipt**（当前 `pack.mjs:18` 只写最新的 `package-receipt.json`）。
- **改动层级**：`REPO`
- **工作量**：1h
- **风险**：**低**
- **批次**：**E**

### E-9 · P2-3 / P2-4　`engines.dsh` / `dsh.manifestVersion` / 显示元数据与图标

- **问题**：
  - P2-3：`package.json` 的 `engines` 只有 `{node}`，**没有 `engines.dsh`**；`dsh` 字段只有 `{bundle, client}`，**没有 `manifestVersion`**。
  - P2-4：`files` 数组**没有** `locale/*.json`，也没有 `icon`；`exports` 只有 `./`、`./client`、`./cordis.patch.yml`、`./package.json`。
- **证据**：
  - `manifest-readme.md:53`（`engines.dsh` 是 SemVer range）、`:52`（`dsh.manifestVersion` 是格式标识，值 `1`）、`:46`（`dsh.bundle.patch`）、`:93`（兼容性是**声明式**的，安装器**不强制** `manifestVersion` / `engines.dsh`）
  - `pm-readme.md:69`：**未满足 `engines.dsh` 或 peer 依赖 → 在 pnpm 运行前就拒绝，什么都不下载**
  - `host-plugin.md:29-53`：`locale/en.json` 写 `meta.title` / `meta.description`；需导出 `./locale/*.json` 与 `./icon`；或包根 `package.json` 顶层声明 `icon`；图标限 SVG/PNG/JPEG/WebP、≤256 KiB、须在包内
  - `dsh-app-boot/lib/index.js` 的 `readPluginMeta` / `ctx.pluginPackages.metaOf` 读展示文本
- **建议改法**：
  1. `engines` 加 `"dsh": ">=0.2.1-rc.3"`（与宿主当前版本对齐 —— **下界需与用户确认目标宿主版本线**，写死会挡住老宿主用户）；`dsh` 字段加 `"manifestVersion": 1`
  2. `peerDependencies` 补 `@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-client-ui-layout`（**仅当批次 D 的 D-1 / D-2 落地时**；本轮不落地则不加）
  3. 新增 `locale/en.json` + `locale/zh.json`（含 `meta.title` / `meta.description`，**注意**：这两个是**插件展示元数据**，与 D-1 的**客户端文案字典**是两回事，可以先做 P2-4 的元数据版）
  4. 新增 `icon.svg`（≤256 KiB，自绘或用许可兼容素材），`package.json` 顶层加 `"icon": "./icon.svg"`，`exports` 加 `"./locale/*.json"` 与 `"./icon"`
  5. `files` 加 `locale`、`icon.svg`
- **改动层级**：`PKG` + 新增 `locale/*.json` + `icon.svg`
- **工作量**：1.5h
- **风险**：**低**。唯一需用户决策的是 `engines.dsh` 的版本下界。
- **批次**：**E**

---

## 8. 各批次验收断言（写进 `tests/` 的具体形式）

> **断言风格基准**（照抄现有 `tests/client.test.mjs` 的 harness 约定）：
> - 元素查找：`const button=label=>find(n=>n.tag==='button'&&(n.props['aria-label']===label||n.children.includes(label)));`（`tests/client.test.mjs:11`）
> - 按钮命中：`s.button('账号配置悬浮球').props['aria-expanded']`（`tests/client.test.mjs:14`）
> - 错误节点：`s.find(n=>n.props?.role==='alert')`（`tests/client.test.mjs:18`）
> - 输入框：`const input=name=>find(n=>n.tag==='input'&&n.props.name===name);`（`tests/client.test.mjs:12`）
> - 树遍历：`const all=(tree)=>[tree,...(tree?.children||[]).filter(Boolean).flatMap(all)]`（`tests/client.test.mjs:9`）
>
> **harness 前置**：批次 B 的焦点/事件类断言依赖 **N-16（E-5）** 的 harness 升级（`useEffect` 会执行、`document.addEventListener` 会记录监听器、能记录 `focus()` 调用）。若 N-16 未先落地，B 批断言只能落地其中的**纯属性断言**（ARIA、fieldset/legend、标题层级、live region），焦点与 Esc 断言**顺延**。
>
> **建议新增测试文件**：`tests/style-tokens.test.mjs`（批次 A）、`tests/a11y-contracts.test.mjs`（批次 B/C 的结构断言）、`tests/import-wizard.test.mjs`（批次 C）。**不改** `tests/client.test.mjs` 的 harness 行为以外的部分；harness 升级（N-16）是在其基础上**加能力**，不是重写。

### 8.1 批次 D0 断言（**必须与 D0 同批落地**）

| 断言 ID | 落点 | 断言形式（可直接写） |
| --- | --- | --- |
| T-D0-1 | `tests/provider-import.test.mjs` | 同批次两个同 origin 供应商 → `assert.equal(result.created.siteIds.length,1)` 且 `assert.equal(result.created.accountIds.length,2)`；第三次同 origin 导入 → `assert.equal(err?.code,undefined)`（不得为 `'IMPORT_CONFLICT'`） |
| T-D0-2 | `tests/provider-import.test.mjs` | `planImport(state,items)` 直接调用时"无同源站点"分支 → `assert.ok(!('targetSiteId' in plan[0]))` 或 `assert.equal(plan[0].targetSiteId,undefined)`（**不是 `null`**）；显式新建分支 → `assert.equal(plan[0].targetSiteId,null)`（语义不变） |
| T-D0-3 | `tests/provider-import-client.test.mjs` | providerId = `'constructor'` / `'toString'` / `'valueOf'` / `'hasOwnProperty'` / `'__proto__'` 五个值逐一：`assert.equal(s.find(n=>n.tag==='input'&&n.props.type==='checkbox'&&n.props['aria-label']==='选择供应商 X').props.checked,false)`；且提交 payload → `assert.equal(s.calls.at(-1).carrier.args.request.selections.length,0)` |
| T-D0-4 | `tests/provider-import-client.test.mjs` | 取消导入后迟到响应 → `assert.equal(s.find(n=>n.props?.className==='dfa-import'),undefined)`（向导不再出现）；对照"关闭面板"路径同断言仍成立 |
| T-D0-5 | `tests/provider-import-client.test.mjs` | 101 个 provider → `assert.ok(s.find(n=>n.props?.role==='alert'))` 且错误文案**不**是"配置格式无效"（断言文案含"供应商数量"或等价的可区分措辞） |
| T-D0-6 | `tests/provider-import-client.test.mjs` | 畸形 `sites`（schema 未定义分支，`{oops:true}`）→ `assert.ok(s.find(n=>n.props?.role==='alert'))` 且 `assert.ok(!s.find(n=>n.props?.role==='alert').children.join('').includes('is not a function'))`（不再泄漏源码表达式） |

### 8.2 批次 A 断言（`tests/style-tokens.test.mjs`，只读 `lib/client.js` 里的 CSS 字符串）

> 断言依据是**构建产物**里的 CSS（`scripts/build.mjs:18` 把 `src/style.css` 内联进 `lib/client.js`），因此该测试必须在 `node scripts/build.mjs` 之后运行。

| 断言 ID | 断言形式 |
| --- | --- |
| T-A-1 | `const css=readFileSync('lib/client.js','utf8')` → `assert.ok(css.includes('var(--dsw-focus-ring-color'))` 且 `assert.ok(css.includes('var(--dsw-focus-ring-width'))` |
| T-A-2 | 状态色 token 全部出现：`for(const t of ['--dsw-alias-state-error-primary','--dsw-alias-state-success-primary','--dsw-alias-state-warn-primary','--dsw-alias-brand-primary']) assert.ok(css.includes(t))` |
| T-A-3 | 阴影/磨砂 token：`assert.ok(css.includes('var(--dsw-elevation-prominent'))`、`assert.ok(css.includes('var(--dsw-menu-backdrop-filter'))` |
| T-A-4 | **fallback 保留**（回归护栏）：每个 `var(--dsw-*, <fallback>)` 都必须带 fallback → 断言不存在裸 `var(--dsw-` 结尾（`assert.ok(!/var\(--dsw-[a-z0-9-]+\)/.test(css))`），保证普通 Web 视口渲染不退化 |
| T-A-5 | **硬编码归零**：`assert.ok(!/#[0-9a-f]{6}\b/i.test(css.replace(/#[0-9a-f]{3}\b/gi,'')))` 或更保守：统计 `#[0-9a-f]{6}` 出现次数 ≤ 20（当前 117 处），把目标写成可量化的回归阈值 |
| T-A-6 | 卡片层级：`.dfa-account` 的背景声明为 `transparent` → `assert.ok(/\.dfa-account\{[^}]*background:\s*transparent/.test(css))`；`.dfa-site` 使用 `var(--dsw-alias-border-l2` |
| T-A-7 | 磨砂降本：`assert.ok(css.includes('prefers-reduced-transparency'))` |
| T-A-8 | 渲染裁剪：`assert.ok(css.includes('content-visibility:auto'))` 且 `assert.ok(css.includes('contain-intrinsic-size'))`（**两条都要**，防滚动条抖动） |
| T-A-9 | 容器查询：`assert.ok(css.includes('container-type:inline-size'))` 且 `assert.ok(css.includes('@container'))`，且**保留**原 `@media(max-width:480px)` 作为兜底 → `assert.ok(css.includes('max-width:480px)'))` |

### 8.3 批次 B 断言（`tests/a11y-contracts.test.mjs`，复用 `tests/client.test.mjs` 的 `setup()` harness）

| 断言 ID | 断言形式 |
| --- | --- |
| T-B-1（ARIA 关联） | `const ball=s.button('账号配置悬浮球'); assert.equal(ball.props['aria-expanded'],false); assert.ok(ball.props['aria-controls'])`；`assert.equal(ball.props['aria-haspopup'],'dialog')`；面板 → `assert.equal(s.find(n=>n.props?.role==='dialog').props.id, ball.props['aria-controls'])`（**两侧必须相等**） |
| T-B-2（开合视觉态） | `assert.ok(ball.props['data-open']!==undefined)`；打开后 `assert.equal(s.button('账号配置悬浮球').props['data-open'],'true')` |
| T-B-3（焦点迁移） | 打开编辑器 → 断言焦点落在新视图容器：`assert.equal(s.focusLog.at(-1).node.props.className,'dfa-editor')`（**依赖 N-16**）；关闭编辑器 → 焦点归还触发元素：`assert.equal(s.focusLog.at(-1).node.props['aria-label'],'账号配置悬浮球')` |
| T-B-4（焦点不被抢回 / N-04） | `beginEditor` 触发 `setEditor` 后 → `assert.equal(s.focusLog.filter(f=>f.node.props?.className==='dfa-panel').length,1)`（面板**只**获得焦点一次，`editor` 变化不再触发） |
| T-B-5（冲突 fieldset/legend） | `const fs=s.find(n=>n.tag==='fieldset'); assert.ok(fs); assert.ok(fs.children.some(c=>c.tag==='legend'))`；legend 文案含供应商名与 origin → `assert.ok(fs.children.find(c=>c.tag==='legend').children.join('').includes(origin))` |
| T-B-6（live region 去重） | 余额区 → `assert.equal(s.find(n=>n.props?.className==='dfa-balance').props['aria-live'],undefined)`；且内层仍有 `role='status'` → `assert.ok(s.find(n=>n.tag==='p'&&n.props.role==='status'))` |
| T-B-7（同名按钮归属） | 两个账号 → 断言存在 `aria-label='查询余额：账号A'` 与 `aria-label='查询余额：账号B'` 两个不同按钮：`assert.ok(s.find(n=>n.tag==='button'&&n.props['aria-label']==='查询余额：账号A'))`；且每个账号级按钮的 `aria-label` 都非 `undefined` → 遍历断言 `assert.ok(n.props['aria-label'])` |
| T-B-8（Esc 分级） | 向导第 2 步按 Esc → **回到第 1 步**而非关闭：`assert.ok(s.find(n=>n.props?.className==='dfa-import'))` 且 `assert.ok(s.button('下一步：预览导入'))`；第 1 步按 Esc → 向导消失 `assert.equal(s.find(n=>n.props?.className==='dfa-import'),undefined)`；无向导按 Esc → 面板关闭 `assert.equal(s.button('账号配置悬浮球').props['aria-expanded'],false)` |
| T-B-9（Esc 捕获阶段） | 断言监听注册在捕获阶段 → `assert.equal(s.documentListeners.keydown.options.capture,true)`（**依赖 N-16**） |
| T-B-10（标题层级） | 面板 → `assert.ok(s.find(n=>n.tag==='h2'))`；站点 → `assert.ok(s.find(n=>n.tag==='h3'))`；账号 → `assert.ok(s.find(n=>n.tag==='h4'))`；且**不存在**账号级 `strong` 充当标题 → 断言账号卡首个标题元素 tag 为 `'h4'` |

### 8.4 批次 C 断言（`tests/import-wizard.test.mjs`）

| 断言 ID | 断言形式 |
| --- | --- |
| T-C-1（步骤条） | `assert.ok(s.find(n=>n.children?.includes('第 1 步 / 共 2 步')))`；预览步 → `assert.ok(s.find(n=>n.children?.includes('第 2 步 / 共 2 步')))`；当前步带 `aria-current` → `assert.equal(step.props['aria-current'],'step')` |
| T-C-2（计数徽标） | 勾选 2 个供应商 → `assert.ok(s.find(n=>n.children?.includes('已选 2 项')))`；不可导入的（无 Key）不计入 → `assert.ok(!s.find(n=>n.children?.includes('已选 3 项')))` |
| T-C-3（`aria-busy`） | 读取清单中 → `assert.ok(s.find(n=>n.props?.['aria-busy']==='true'))` |
| T-C-4（目标徽标） | 预览行 → `assert.ok(s.find(n=>n.children?.includes('并入站点「')))` 与 `assert.ok(s.find(n=>n.children?.includes('新建账号')))`（依目标站点情况二选一出现） |
| T-C-5（预览汇总条） | `assert.ok(s.find(n=>n.children?.includes('将新建 2 个账号')))`；并断言**不含**任何密钥字面量 → `assert.ok(!s.find(n=>n.props?.className==='dfa-import-plan').children.join('').includes('sk-'))` |
| T-C-6（分级空态） | 供应商为空 → `assert.ok(s.find(n=>n.props?.className==='dfa-empty'))` 且有 CTA → `assert.ok(s.button('重新读取清单'))`；全空态 → `assert.ok(s.button('+ 添加站点'))` |
| T-C-7（错误作用域） | 导入失败 → 错误节点在 `.dfa-import` 区块**内** → `assert.ok(s.find(n=>n.props?.className==='dfa-import').children.some(c=>c.props?.role==='alert'))`；且面板顶部**不再**出现同一条全局 error |
| T-C-8（就地重试） | 错误旁有重试按钮 → `assert.ok(s.button('重试读取清单'))`，点击后 `assert.equal(s.calls.at(-1).method,'floatingAccounts/listDshProviders')` |
| T-C-9（离线态标记） | 宿主不可用 → `assert.ok(s.find(n=>n.props?.className==='dfa-offline'))`（新增类名） |

### 8.5 批次 E 断言（工程化，不写进 `tests/`，写进 CI 与自检脚本）

| 断言 ID | 落点 | 形式 |
| --- | --- | --- |
| T-E-1 | CI workflow | `node scripts/build.mjs` → `npm test` → `node scripts/pack.mjs` 三步串联，任一步非零即失败 |
| T-E-2 | CI / 自检 | `distributionFiles()` 与 `files` 双向对账 → "磁盘有但未发布" 与 "已声明但磁盘缺" **两个方向都必须为空**（修掉 N-19 的双向漂移） |
| T-E-3 | `tests/` | `node --test tests/` 的文件数 == `readdirSync('tests').length`（修掉 N-13/N-14 的清单差集）；宿主 SDK 4 个文件**单独**脚本 + 显式 skip 标记 |
| T-E-4 | `tests/` | `scripts/verify.mjs` 的 `localTests` 与 `npm test` 的文件集合**完全相等**（差集为空） |
| T-E-5 | `scripts/verify-installed.mjs` | 比对文件数 == `lib/build-manifest.json` 的 `outputs` 条目数（当前 5 → 11） |
| T-E-6 | `tests/` | `scripts/pack.mjs` 产出的 tgz 内 `MANIFEST.json` 的 `files` 集合 == tgz 实际条目集合（修掉 N-15 b） |
| T-E-7 | `scripts/build.mjs` | build 失败的事务性：staging 里出现白名单外文件时**不得**进入 `lib/`（修掉 N-15 a） |
| T-E-8 | 自检脚本 | `locale/zh.json` 与 `locale/en.json` 的**键集合完全相等**（D-1 落地后启用；键集不等直接非零退出） |

---

## 9. 本轮回归命令集与通过标准

> 全部命令在 `D:\FUGUI\ai\WORK\软件设计\dsh-floating-accounts` 根目录执行（**Windows / PowerShell**）。

### 9.1 必跑命令（顺序即依赖）

```powershell
# ① 构建（先于一切测试：tests/ 断言的是 lib/ 构建产物）
node scripts/build.mjs
#   通过标准：stdout 含 "Built host and ModuleLoader client without external build dependencies."
#             退出码 0；lib/build-manifest.json 的 source sha 与 src/ 逐字一致
#             lib/ 下文件数 == 11（10 个产物 + build-manifest.json）

# ② 本地全量回归（改动后项数只增不减）
npm test
#   通过标准：退出码 0；fail 0；项数 >= 272（基线 272，D0/B/C 落地后应显著增加）
#             ⚠ 若采纳 N-13/N-14 的 E-4 改法，此处改为 node --test tests/，
#               宿主 SDK 那 4 个文件必须走 ③，且在 ② 的输出里显式标注为 skipped

# ③ 宿主 SDK 回归（需要本机 DSH SDK 环境；当前缺 node_modules 时会 ERR_MODULE_NOT_FOUND）
$env:DSH_CHECKOUT = 'D:\FUGUI\ai\guanfangdsh\dsh\resources\app.asar\dsh'
$env:ELECTRON_RUN_AS_NODE = '1'
& 'D:\FUGUI\ai\guanfangdsh\dsh\DeepSeek Harness.exe' --expose-internals --loader ./scripts/runtime-loader.mjs --test tests/host.test.mjs tests/multi-site-host.test.mjs tests/protocol-detection-host.test.mjs tests/provider-import-host.test.mjs
Remove-Item Env:ELECTRON_RUN_AS_NODE
#   通过标准：退出码 0；4 个文件全部通过
#   ⚠ 当前环境无 node_modules → 本命令无法运行；必须如实记为"未运行"，
#     不得用 ② 的绿灯替代（这是 N-13 指出的核心失真）

# ④ 一键验证（产出 artifacts/verification.json）
node scripts/verify.mjs
#   通过标准：退出码 0；artifacts/verification.json 的 completeLocalRegression === true
#             hostTestsSkipped 字段如实反映 ③ 是否运行（不得粉饰）

# ⑤ 离线包
node scripts/pack.mjs
#   通过标准：退出码 0；stdout JSON 含 output / files / sha256；
#             dist/dsh-floating-accounts-1.3.0.tgz 存在；
#             dist/package-receipt.json 的 files 列出包内全部条目；
#             包内含 package/lib/client.js（pack.mjs:17 的既有断言）

# ⑥ 安装完整性（需先有已安装环境）
node scripts/verify-installed.mjs
#   通过标准：installedSourceMatchesBuild === true 且比对文件数 == 11（E-7 落地后）

# ⑦ 证据脚本（本轮产物落盘）
#   artifacts/optimization-2026-11-21/backlog.md        ← 本文件
#   artifacts/optimization-2026-11-21/delta-audit.md     ← t2
#   artifacts/optimization-2026-11-21/github-research.md  ← t1
#   artifacts/verification.json                          ← ④ 产出
#   dist/package-receipt.json + dist/dsh-floating-accounts-1.3.0.tgz  ← ⑤ 产出
```

### 9.2 通过标准汇总（1.3.0 发布门禁）

| 门禁项 | 标准 |
| --- | --- |
| 构建 | ① 退出码 0，`lib/` 11 个文件，`build-manifest.json` 与 `src/` 一致 |
| 本地回归 | ② 退出码 0、fail 0、**项数 ≥ 272 且不低于改前**（回归不允许变少） |
| 宿主 SDK 回归 | ③ 退出码 0；**若环境不具备则必须显式记为"未运行"并在发布说明中标注**，不得以 ② 充抵 |
| 一键验证 | ④ `completeLocalRegression === true` |
| 离线包 | ⑤ 退出码 0 + `package-receipt.json` 完整 + 包内含 `package/lib/client.js` |
| 安装完整性 | ⑥ `installedSourceMatchesBuild === true`，覆盖 11/11 |
| 新增断言 | §8 的 D0 6 条 + A 9 条 + B 10 条 + C 9 条 = **34 条**全部通过 |
| 契约不破 | `npm test` 中 `rpc-contract.test.mjs` 全绿（证明 **RPC 契约未变**，批次 D0 只改内部语义、不改契约） |
| 安全契约 | 导入向导"显式两步同意"仍成立 → 断言"未勾选的 provider 不在 `selections` 中"；**任何**批次都不得引入明文 Key 回显 / 浏览器缓存 / 自动轮询 |
| 产品代码未越界 | 本轮（t3 规划轮）**唯一新增文件**是本 `backlog.md`；`src/` `lib/` `tests/` `scripts/` `package.json` `dist/` 的 sha 与改前一致 |

### 9.3 本轮实测基线（2026-11-21，规划轮实测）

> 本轮**未改动任何产品代码**（`src/` 与 `lib/` 的 sha 与 `lib/build-manifest.json` 逐字一致，见 §9.4），以下为原样跑出的基线数字，作为实现轮的对照。

| 项 | 实测值 |
| --- | --- |
| `npm test` | `# tests 22` / `# pass 22` / `# fail 0`（node:test 顶层 22 个文件；子项合计 **272 项**） |
| 复跑稳定性 | 连续 **5 次** `npm test`，5 次均 `fail 0` |
| `node --test tests/multi-site-vault.test.mjs` | `# tests 96` / `# pass 96` / `# fail 0` |

**⚠ 发现一处既有不稳定用例（本轮新发现，建议登记为 N-23）**

- **现象**：首次 `npm test` 出现 1 例失败 —— `tests/multi-site-vault.test.mjs:317` 的 `preview binds encrypted file identity and digest: same-byte-identity-restore`，断言 `(await fs.stat(file)).ino !== beforeStat.ino` 失败（`ino` 相同）。
- **代码位置**：`tests/multi-site-vault.test.mjs:321-323`
  ```js
  const replacement = file + '.replacement';
  await fs.writeFile(replacement, before);
  await fs.utimes(replacement, stableTime, stableTime);
  await fs.rename(replacement, file);
  assert.notEqual((await fs.stat(file)).ino, beforeStat.ino);
  ```
- **性质**：该用例断言"用 rename 替换文件后 inode 必然改变"。在 Windows 上 `fs.rename` 覆盖目标文件时，Node/文件系统**可能复用目标文件的 inode**，因此该断言是**平台相关的不稳定断言**，与被测代码（`src/vault.js` 的迁移绑定逻辑）无关。
- **证据**：连续 5 次全量 `npm test` 中仅**首次**出现，后续 4 次全绿；单独跑该文件 96 项全绿。**本轮未改动 `tests/`、`src/`、`lib/` 任何一行**（sha 校验一致）。
- **影响**：**发布门禁的可信度** —— §9.2 的"fail 0"标准会被这条偶发失败打断，且失败信息**指向与产品无关的文件系统语义**，容易被误判为"改动引入了回归"。
- **建议改法**（登记为 **N-23**，本轮**不改**，交由实现轮或独立修复轮处理）：
  1. 把该断言从"inode 必然改变"放宽为"**文件身份或内容摘要二者之一发生变化**"（与用例名 `same-byte-identity-restore` 的意图一致：同字节但身份必须被识别为新文件）；
  2. 或在断言前显式检查平台：`process.platform === 'win32'` 时改用 `birthtimeMs` / `ctimeMs` 判定；
  3. **不要**简单删除该用例 —— 它守护的是"同字节替换文件必须被迁移预览判定为身份变化"这条安全相关不变量。
- **本轮处置**：**只登记，不修改**（本任务纪律为"只新增 `backlog.md` 一个文件"）。
- **对本轮 backlog 的影响**：**无**。D0 / A / B / C / E 各批均不触碰 `tests/multi-site-vault.test.mjs` 与 `src/vault.js` 的迁移绑定逻辑；N-11 / N-12 会动 `src/vault.js` 与 `src/index.js`，但**均在本轮不做清单内**（§11.2），故不影响。

### 9.4 本轮改动范围自查（发布门禁的"未越界"项）

```bash
# 校验 src/ 与 lib/ 与 lib/build-manifest.json 完全一致（即：本轮未改动任何产品代码）
node -e "const {readFileSync}=require('fs');const {createHash}=require('crypto');
const m=JSON.parse(readFileSync('lib/build-manifest.json','utf8'));
const sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
let bad=0;for(const [n,s] of Object.entries(m.source))if(sha('src/'+n)!==s)bad++;
for(const [n,s] of Object.entries(m.outputs))if(sha('lib/'+n)!==s)bad++;
console.log(bad===0?'OK: src/ 与 lib/ 与 build-manifest 完全一致':'FAIL '+bad);"
```

实测输出：`OK: src/ 与 lib/ 与 build-manifest 完全一致（未改动任何产品代码）`。

本轮**唯一新增文件**：`artifacts/optimization-2026-11-21/backlog.md`（905 行 / 88,666 B）。`src/` `lib/` `tests/` `scripts/` `package.json` `dist/` 均未改动（`dist/` 仍为 5 个历史 tgz + `package-receipt.json`）。

---

## 10. 1.3.0 版本与打包元数据改动清单

### 10.1 `package.json`

| 字段 | 现状 | 1.3.0 目标 | 批次 |
| --- | --- | --- | --- |
| `version` | `"1.2.0"` | `"1.3.0"` | E |
| `dsh.manifestVersion` | **缺失** | `1` | E-9 |
| `dsh.client.inject` | `[]` | 本轮**保持 `[]`**（D-1/D-2 不落地则不加 peer 依赖） | E-9 |
| `engines.dsh` | **缺失** | `">=0.2.1-rc.3"`（**下界需用户确认目标宿主版本线**） | E-9 |
| `engines.node` | `"^22.19.0 \|\| >=24"` | 不变 | — |
| `peerDependencies` | 4 项（cordis / typert-protocol / react / react-dom） | 本轮**不变**；D-1/D-2 落地时再加 `dsh-client-locale` / `dsh-client-ui-layout` | E-9 |
| `files` | 手工枚举 22 项，漏发 4 个 `docs/*.md` | 4 个具名 `docs/*.md` → `"docs"`；**新增** `"locale"`、`"icon.svg"`、`"CHANGELOG.md"` | E-2 / E-9 |
| `exports` | `./`、`./client`、`./cordis.patch.yml`、`./package.json` | **新增** `"./locale/*.json"`、`"./icon"` | E-9 |
| `icon` | **缺失** | `"./icon.svg"`（顶层声明，宿主 `host-plugin.md:51` 优先读顶层） | E-9 |
| `scripts.test` | 18 个文件 | 与 `scripts/verify.mjs` 的清单**完全对齐**（改 `node --test tests/` 或抽共享清单模块） | E-4 |
| `scripts`（新增） | — | `test:host`（4 个宿主 SDK 文件单独入口）、`lint`（若采纳 E-3）、`verify`（包装 `scripts/verify.mjs`） | E-3 / E-4 |

### 10.2 新增文件

| 文件 | 内容 | 批次 |
| --- | --- | --- |
| `locale/en.json` | **插件展示元数据**：`meta.title` / `meta.description`（英文，`LocalizedText` **必须有 en 回落**） | E-9 |
| `locale/zh.json` | 同上，中文 | E-9 |
| `icon.svg` | 插件图标，SVG，**≤256 KiB**，须在包内 | E-9 |
| `CHANGELOG.md` | Keep a Changelog 格式，**从 1.3.0 起维护**（含 1.2.0 / 1.1.1 / 1.1.0 的历史摘要） | E-3 |
| `.gitignore` | `node_modules/`、`tests/.fixtures/`、`.build-staging-*/`、`dist/`、`artifacts/`、`*.log` | E-1 |
| `.github/workflows/ci.yml` | `node scripts/build.mjs` → `npm test` → `node scripts/pack.mjs` | E-3 |

> 注意区分两套 locale：**① 插件展示元数据**（`locale/{en,zh}.json` 的 `meta.title`/`meta.description`，E-9，1h，本轮做）；**② 客户端文案字典**（`ctx.locale.register` 的 236+32 条文案，D-1，4–6h，**本轮不做**）。二者文件名相同、内容不同，落地 D-1 时必须合并到同一份 `locale/*.json` 并用 `meta.*` 段与文案段分区。

### 10.3 README（中英）

| 项 | 说明 |
| --- | --- |
| `README.md`（中文） | 顶部加 `## 1.3.0升级范围` 段，**沿用现有手写段落体例**（`README.md:5` 的 `## 1.2.0升级范围` 写法）：逐条列出 D0 的行为修正（N-01 同源合并修复、N-02 未勾选不导入）、批次 A/B/C 的界面变更、明确"不改变安全契约"；保留 1.2.0 / 1.1.1 / 1.1.0 三段历史 |
| `README.en.md`（英文） | **新建**，与中文 README **逐节对应**（当前仓库**只有中文 README**，GitHub 发布需要英文版）；至少包含：安装纪律、构建/测试/离线包、余额协议、供应商导入、DPAPI 密钥保管边界、1.3.0 升级范围 |
| `README.md:24` | 宿主版本说明保持"DSH 0.2.x"，但若采纳 `engines.dsh` 需同步为具体 range |
| `README.md:78-96` | 构建/测试/离线包章节同步 §9 的回归命令集与通过标准 |
| `README.md:102` | 源码与规格链接表**新增**：本 backlog、t1 调研、t2 审计的链接（或移到 `docs/reviews/`） |

### 10.4 发布前置与授权边界

> **⚠ 推送 GitHub 与 npm 发布需要用户单独授权与凭据，本轮只做到"本地可发布状态"。**

| 前置 | 状态 | 说明 |
| --- | --- | --- |
| Git 仓库 | E-1 落地后**本地存在** | `git init` + 首次提交（1.2.0 基线）+ 1.3.0 提交 |
| 远程仓库 | **未创建** | 需要用户在 GitHub 上建仓并**单独授权** push |
| `.gitignore` | E-1 落地 | `dist/`、`artifacts/` 被忽略 |
| npm 包 | **未发布** | 需用户授权 + npm 凭据（token） |
| 市场收录 | **不可达** | 宿主 `marketInstallTarget` 对 Git 包生成 `git+<url>.git#<commit>&path:/<path>` → **必须有真实 GitHub 仓库 + npm 发布**，只放离线 zip 进不了市场 |
| 离线包 | ⑤ 产出 `dist/dsh-floating-accounts-1.3.0.tgz` | **本地可发布状态**的实体产物 |
| `plugin.json` | **不创建** | t1 已核实：宿主不读它（CaoQiNeng 那套约定不要抄），官方走 `package.json` 的 `dsh` 字段 |
| 市场卡片元数据 | **可选待办** | `awesome-dsh-plugin` 风格的 `owner__plugin.yml` 卡片 schema 未逐字段核实（t1 §6 存疑 1），本轮不做 |

---

## 11. 本轮「不做什么」清单及理由

### 11.1 明确延后到 1.4.0（批次 D，需宿主/后端能力）

| ID | 不做的理由 |
| --- | --- |
| D-1（P0-1 locale 全量接入） | 改动面 268 处文案，键集不一致会让界面**直接显示英文键名**（`locale-client.js:1425`）；宿主 `README.md:84` 的 `verify-client-ui-i18n` 是强制闸门，需配套键集自检脚本。1.3.0 只做**展示元数据版** locale（E-9，1h） |
| D-2（P0-2 shell.overlay 迁移） | 需确认与 `sidebar.footer.action` 双挂行为、`replaceRisk` 语义、z-index 归位；属"换挂载点"而非"改样式"，与批次 A 的零行为变更契约冲突 |
| D-3（D2 原子批量删除 RPC） | 需新增后端 RPC 并保证事务原子性，直接触及用户数据一致性；1.3.0 不动 |
| D-4（P1-2 存储层 / P1-4 atomic-write） | 改**安全契约**（DPAPI 加密落库是本插件卖点）与**核心写入路径**（`src/vault.js:236-246`），现有 `tests/vault*.test.mjs` 断言基于当前实现 |
| D-5（D3 批量策略 / D4 全部查询余额） | D4 一次点击会向 N 个站点发**真实外部请求**，与"余额只手动查询、不轮询"契约的边界需产品口径确认 |

### 11.2 本轮不做（收益/风险比不足）

| ID | 不做的理由 |
| --- | --- |
| B2（呼吸光无限动画） | 暂停需要 `client.js` 状态开关 → 越出批次 A 的"零行为变更"契约；且 `prefers-reduced-motion` 已在 `style.css:34-43` 完整覆盖，收益有限 |
| B3（阴影/圆角/字号体系） | **已并入批次 A 的 F1**（`--dsw-elevation-*` / `--dsw-specific-menu`），不单列 |
| C5（站点卡信息量） | 需在卡片里聚合账号数/凭据数/余额摘要，涉及新的快照字段 → 触碰 `src/vault.js` 的公开状态形状，超出"只改界面"范围 |
| D1（搜索过滤/排序） | 需在渲染层引入过滤状态与列表重建，纯 UI 收益一般，1.3.0 先把 A/B/C 三批收干净 |
| N-08（YAML 重复键） | 严重度低；修法是"整层降级为不可读"，会**降低可用性**（原本能导入的变成不能导入），需要产品口径确认 |
| N-09（YAML 数字+续行 / `version:"1"`） | 严重度低；触发面窄（provider 白名单只消费 string 字段），但 `host-providers.js:466` 的版本闸门确实该放宽 |
| N-10（balance-http 多 A 记录） | 现状是 **fail-closed**（安全侧收紧），改它等于**放宽** SSRF 防护，需与安全口径一并评估；且要改 1 条既有测试的期望 |
| N-11（导入自动绑定余额查询 Key） | **口径待定**：改代码（`balanceCredentialId: null`，最小权限）还是改文案（明示"导入即绑定"）是两个产品决策，不能由实现轮单方面定 |
| N-12（`cleanupWarnings` 失败路径透传） | 严重度低，但 `src/index.js:32-33` 的错误信封形状改动会影响 `rpc-contract.test.mjs` 的契约断言，宜与 D-3 的批量 RPC 一起改 |
| N-23（inode 断言不稳定） | **t3 本轮实测新发现**：Windows 上 `fs.rename` 覆盖目标文件可能复用 inode，`tests/multi-site-vault.test.mjs:323` 的 `assert.notEqual(ino)` 因此偶发失败（实测 5 次全量跑仅首次失败）。它守护的是"同字节替换文件必须被识别为身份变化"这条**安全相关不变量**，修法是放宽断言语义或改用 `birthtimeMs`/`ctimeMs`，**不是删用例**。本任务纪律为"只新增 `backlog.md` 一个文件"，故**仅登记**，交实现轮或独立修复轮处理 |
| N-18 的 typecheck 部分 | 给 68 KB 单行压缩的 `src/client.js` 加 `// @ts-check` + `checkJs` JSDoc 成本过高；**先做 lint** 三条规则即可覆盖 `no-undef` / `eqeqeq` 类问题 |
| P2-1（util-crypto）/ P2-2（secret-mask） | 本插件服务端用 Node `crypto`（`src/vault.js:3`）不受 secure-context 限制；密钥输入框已 `type:'password'` 且从不回显，宿主遮罩只对"用户手动贴进对话"生效 —— **无需改动，仅登记** |
| 浏览器自动化实测 | 本轮全为源码级核实与 Node harness 复现；`shell.overlay` 挂载、locale 切换渲染、token 解析均未在运行中的 GUI 实测（t1 §6 存疑 5）。本轮不出结论，只登记 |

### 11.3 明确"不采纳"的同类项目做法（t1 §4，点名排除）

| 做法 | 出处 | 不采纳理由 |
| --- | --- | --- |
| 明文 Key 常驻内存 + `timer.interval(60000)` 轮询 | `dsh-deepseek-balance` `src/host.js:20` / `client.js:91-99` | 与"DPAPI 加密落库、明文不回显、余额只手动查询"三条不可协商契约直接冲突 |
| 浏览器侧直接发起外部请求（SSE / fetch） | `dsh-balance-pill` `client.js:130` / `:168` | 本插件浏览器只传 `{id, revision}`，Key 由宿主从 vault 读取后使用 |
| 一键导入全部供应商（绕过两段确认） | `dsh-deepseek-balance` `client.js:206-214` | 本插件导入必须"勾选 → 预览 → 逐字确认『确认导入』"（`src/client.js:249-274`） |
| `plugin.json` 作为发布 manifest | `dsh-deepseek-balance` `plugin.json:1-16` | **宿主不读它**（asar 内仅 openai 注释命中 2 次）；官方走 `package.json` 的 `dsh` 字段 |
| 明文落盘的会话草稿 | `dsh-provider-studio` `client.js` 的 `Ti/Te/Ii` | 草稿含 API Key 明文；本插件明文只在 `src/client.js:129` 的 `clearSecrets()` 生命周期内存活 |
| 硬编码 z-index 极大值 | 本插件自身 `style.css:2`、`:5` | 参考项目用小整数（balance-pill 46/47）；宿主 overlay 层是 `z-index:20`。随 D-2 一并归位 |

---

## 12. 执行顺序建议与未决事项

### 12.1 推荐执行顺序（依赖链）

```
E-1 (git init)  ← 必须最先，无基线其余改动无法 diff/回滚
  ↓
D0-1…D0-4 + D0-6 (功能正确性 + 断言)   ← 独立于 UI，可与 A/B/C 并行
E-5 (N-16 harness 升级)                ← 批次 B 的断言前置
  ↓
A 批 (style.css)                       ← 零行为变更，可独立合入
B 批 (可访问性)  ← 依赖 E-5
C 批 (导入向导 IA) ← 依赖 D0-1 (C-2 的 targetSiteId 语义)
  ↓
E-2…E-9 (工程化 + 发布元数据)
  ↓
§9 全量回归 + §10 元数据收口 → 本地可发布状态
```

### 12.2 需要用户 / captain 决策的未决事项

| # | 事项 | 备选 | 影响的条目 |
| --- | --- | --- | --- |
| 1 | `engines.dsh` 的版本下界 | `">=0.2.1-rc.3"`（对齐当前宿主）/ 更宽（如 `">=0.2.0"`）/ **不声明** | E-9、`package.json` |
| 2 | 同批次同 origin 供应商是否**合并为 1 个站点** | 按既有注释判定为"应合并"（t2 §6 未覆盖项 5）；但需产品确认与"每个供应商一个账号"的语义兼容 | D0-1 |
| 3 | 导入是否**自动绑定余额查询 Key** | 改代码（`null`，最小权限）/ 改文案（明示绑定） | N-11 |
| 4 | YAML 重复键的降级策略 | 整层降级为不可读 / 保留 last-wins 但告警 | N-08 |
| 5 | `balance-http` 多 A 记录是否放宽 | 保持 fail-closed / 改为"至少一条公网即通过" | N-10 |
| 6 | 远程仓库地址与仓库名 | 待用户提供 GitHub 账号/仓库名 | §10.4 |
| 7 | 英文 README 的文件名与语气 | `README.en.md` / `README.md` 改中英双语并列 | §10.3 |
| 8 | `artifacts/` 是否进版本库 | 当前 `.gitignore` 建议忽略；如需保留评审证据，另建 `docs/reviews/` 存精简版 | E-1 |

### 12.3 本文件的边界

1. 本文件**只是规划**：不含任何实现，未改动 `src/` `lib/` `tests/` `scripts/` `package.json` `dist/`。
2. 所有行号引用来自 **t1 / t2 报告 + 本轮对 `src/` `tests/` `scripts/` `package.json` 的直接复核**，取自 1.2.0 现状；t2 已核实 `src/client.js` 仍 556 行、`src/style.css` 仍 44 行，**零行号漂移**。
3. §8 的断言是**建议形式**，实现轮可调整写法，但**断言的语义边界不得放宽**（尤其 D0 的 6 条：它们对应的是两条高severity 功能正确性缺陷）。
4. 宿主侧结论均为**源码级核实**（读 `app.asar` 字节），**未做运行级核实**；`shell.overlay` 挂载、locale 切换渲染、token 解析的实际表现仍需在实现轮用 GUI 或 DSH Web GUI 实测。

---

**收口**：当前：dsh-floating-accounts 1.3.0 backlog / 结果：`artifacts/optimization-2026-11-21/backlog.md`（统一编号 58 条、批次 D0/A/B/C/D/E 五批、验收断言 34 条、回归命令集与门禁、1.3.0 元数据清单、本轮不做 19 条）/ 下一步：N-17 `git init` → 批次 D0 功能正确性修复 + 回归断言。

