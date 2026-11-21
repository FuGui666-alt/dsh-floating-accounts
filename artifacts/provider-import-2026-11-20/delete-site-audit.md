# 删除站点无反应：client 侧点击链静态审计（T9 / 2026-11-20）

审计人：ui（client.js owner）。纯静态审计，零改码，真实 vault / 真实数据零触碰。
用户报告：2026-11-20 13:07，重启 DSH 后点击「删除站点」无反应。
基线：1.1.1 交付包 `artifacts/protocol-detection-2026-11-19/final-extracted/package/src/client.js`（428 行）。
被审版本：工作区 `src/client.js`（556 行，1.2.0）。全量逐行 diff 已存证：`client-1.1.1-vs-1.2.0.diff`（6 个 hunk，全部为 1.2.0 供应商导入新增，无一处落在 removeSite 处理链）。

## 一、removeSite 全点击链逐跳核对（1.2.0 vs 1.1.1）

| # | 跳 | 1.2.0（src/client.js） | 1.1.1 基线（final-extracted/src/client.js） | 一致性 |
|---|---|---|---|---|
| 1 | 按钮 onClick | `h('button', { className: 'dfa-danger', onClick: () => removeSite(site), disabled }, '删除站点')` :506 | 同（:372） | ✅ 逐字一致（外层仅加 `!dshImport &&` 显隐条件，button 元素本身零差异） |
| 2 | disabled 判定 | `const disabled = busy \|\| loading \|\| uncertain \|\| !snapshot` :483 | 同（:356 语义位） | ✅ 一致（shorthand `disabled: disabled`） |
| 3 | 函数入口预检 | `if (blocked() \|\| snapshot.schema !== 2) return;` :426 | 同（:299） | ✅ 一致；`blocked()` 含 `!snapshot` 短路，先于 `.schema` 访问，无空引用风险 |
| 4 | invalidateBalances | :427（调用处一致） | 同（:300） | ✅ 调用一致；函数体 :128 相比基线 :120 仅追加 `dshImportRef.current = null; setDshImport(null);`（导入向导重置，不影响本链语义） |
| 5 | SITE_IN_USE 预检 | `if (snapshot.accounts.some(a => a.siteId === site.id)) { setError(operationFailure('SITE_IN_USE')); return; }` :427 | 同（:300） | ✅ 逐字一致；**站点有账号时不弹 confirm、不发 RPC，唯一反馈是 setError** |
| 6 | window.confirm | `if (!window.confirm(\`删除站点「${site.name}」？此操作不可撤销。\`)) return;` :428 | 同（:301） | ✅ 逐字一致 |
| 7 | commit → RPC | `await commit('removeSite', { revision: snapshot.revision, id: site.id }, '站点已删除');` :429 | 同（:302） | ✅ 一致；commit :360 起与基线 :233 起逐字一致（diff 无 hunk） |
| 8 | 代际 guard | commit 内 `invalidateBalances()` + RPC 后 `alive/openRef` 判定，与基线同 | 同 | ✅ 一致 |
| 9 | RPC 分类 | rpcWithDeadline writing 名单 :533 新增 `'importDshProviders'`，removeSite 原位保留 | 同（:405 无 importDshProviders） | ✅ removeSite 超时语义（RESULT_UNKNOWN）不变 |

**结论：removeSite 处理链在 1.2.0 与 1.1.1 逐字一致（diff hunk 位于基线行 59-67 / 104-113 / 176-181 / 370-383 / 402-408 / 419-425，removeSite 位于基线行 298-303，不在任何 hunk 内）。** 「删除站点无反应」不是 1.2.0 引入的处理链回归。

其余三个删除类按钮同样逐字一致：remove（:420-424 ↔ 基线 :293-297）、removeAccount（:431-435 ↔ :304-308）、removeCredential（:436-440 ↔ :309-313）。

## 二、错误可见性审计（SITE_IN_USE 静默观感判定）

- 文案（`operationFailure('SITE_IN_USE')`，src/client.js:59）：**「站点仍有关联账号或凭据，不能删除或更换 origin；请先处理站内账号，跨 origin 须新建站点并重新录入凭据」**。
- 渲染位置：`.dfa-body` 的**第一个子元素** `h('div', { className: 'dfa-error', role: 'alert' }, error)`（:498）——即整个可滚动正文的最顶部。
- 样式（src/style.css:11）：`.dfa-error{color:#b73131;background:#ffeded;border:1px solid #f3b8b8;padding:10px 12px;border-radius:8px;margin-bottom:12px}`——红底红字横幅，视觉显著；但容器 `.dfa-body{...overflow:auto...}`（style.css:6）可滚动，且 **setError 后无 scroll-to-top、无 focus 转移、无动画**。
- 判定：**「点了没反应」完全可能是 SITE_IN_USE 的静默观感。** 站点有账号（绝大多数真实站点都有）时，removeSite 走 :427 早退：不弹 confirm、不发 RPC、按钮无任何即时变化；唯一反馈的红横幅渲染在滚动区顶部——用户滚动到站点列表处点击删除时，横幅在视口外，观感即「无反应」。且重复点击永远复现同一静默结果。

## 三、window.confirm 依赖审计（1.1.1 以来一致性 + DSH 环境证据）

**插件侧依赖（7 处，全部与 1.1.1 逐字一致，diff 证明零改动）：**
`discard` :131（↔:113）、detectProtocol :176（↔:158）、applyDetection :193（↔:175）、remove :422（↔:295）、removeSite :428（↔:301）、removeAccount :433（↔::306）、removeCredential :438（↔:311）。即：**所有删除类按钮自 1.1.1 起一直依赖 window.confirm 同步对话框**——若 confirm 被环境吞掉（返回 false），四个删除按钮全部呈现「点了没反应」且零错误提示，与用户报告的表象完全吻合，且属于**历史存在、只在用户真实点击删除时才暴露**的行为。

**DSH 环境代码证据（asar 字节级提取，证据文件同目录）：**
1. Web GUI 主包 `dsh-web-frontend/dist/assets/index-BXV-oxvX.js`（941KB，提取为 web-bundle-evidence.js）：`sandbox`=0、`allow-modals`=0、`<iframe`/`createElement("iframe")`=0、`window.confirm`=0、confirm 赋值=0。**DSH 自家前端无 iframe 嵌套、无沙箱属性、无 confirm 覆写。**
2. ModuleLoader `dsh-client-modules/lib/client.js`（moduleloader-evidence.js）：无 iframe、无 confirm 处理；插件经 `createPortal(..., document.body)`（src/client.js:392，与基线一致）挂进**顶层文档**。
3. Electron 主进程 `lib/main.js`（main-evidence.js）：应用窗口 `loadURL(\`${this.origin}/\`)` 顶层加载本机服务页面；`webPreferences` 为 `sandbox:true, contextIsolation:true, nodeIntegration:false, webviewTag:false`（:10156-10162 一带）。**Electron 渲染器沙箱只关 Node 能力，不禁 JS 对话框**；主进程对 JS confirm 无任何拦截（仅原生 dialog.showOpenDialog 流，:7023 一带）。
4. `lib/preload-app.cjs`：3 处 "confirm" 命中均为更新提示文案，无 window.confirm 覆写。
5. 桌面壳 Electron 版本 44.7.0（应用根 `version` 文件）：Chromium 顶层页面支持 window.confirm 同步对话框。

**结论：DSH 代码侧没有任何吞掉 window.confirm 的机制。** 剩余两个环境级风险（非 DSH 代码所致、无法从代码排除）：
- **Chromium 页面级对话框抑制**：同一页面连续快速触发 ≥2 次对话框后，Chromium 弹出「阻止此页面创建更多对话框」选项；一旦勾选，后续所有 `confirm()` 静默返回 false 并在 console 记录。DSH 的每次删除/检测/放弃编辑都会弹一次 confirm，长会话中存在触发的现实可能。
- 假想的跨域/沙箱 iframe 嵌入（缺 allow-modals 时 confirm 被自动拒绝）——**DSH 自身代码未这样做**，仅在第三方异常嵌入时成立。

## 四、1.2.0 导入向导状态粘滞逐路径排查（busy / uncertain / dshImport）

| 路径 | busy（busyRef/setBusy） | uncertain | dshImport 残留 | 站点列表可见？ | 结论 |
|---|---|---|---|---|---|
| 打开清单 openImport :198-211 | 不触碰 busy | 不触碰 | loading→ready 或 catch→null | 向导打开期间按 :497-506 的 `!dshImport` 守卫隐藏，**向导自身可见**（非静默消失） | ✅ 无粘滞 |
| 取消 cancelImport :238-241 | guard busy，不改动 | 不触碰 | →null | 恢复 | ✅ 无粘滞 |
| 返回修改 importBack :233-237 | guard busy/submitting | 不触碰 | step→list | 恢复 | ✅ 无粘滞 |
| 提交→IMPORT_CONFLICT :266-267 | **finally :273 无条件释放** | 不触碰 | →ready/confirm+conflicts（向导继续可见） | 向导面板可见 | ✅ 无粘滞 |
| 提交→其他服务错误 :268-272 | **finally 释放** | 不触碰 | →ready/list（向导可见+错误横幅） | 向导面板可见 | ✅ 无粘滞 |
| 提交→RESULT_UNKNOWN / COMMIT_UNKNOWN / RPC_RESPONSE :271 | **finally 释放** | **=true（设计锁，与 1.1.1 migrate/save 同语义）** | →null（向导关闭） | 恢复 | ⚠️ 写操作全禁属**设计行为**：全站删除/保存按钮 disabled=true（半透明 opacity .55，style.css:7）+顶部红色「提交结果未知」横幅（:499）；恢复途径存在——「重新载入」按钮 `disabled: busy \|\| loading`（:500 行内）**不含 uncertain**，点击后 load() 成功即解锁（:331） |
| 提交→成功 :256-263 | :260 先释放再复用 load()（t5 修复），finally 幂等再释放 | load 成功后清 false（:331） | →null | 恢复 | ✅ 无粘滞；**t5 修复覆盖完备性：失败路径不调用 load()（无需先释放），busy 统一由 finally :273 无条件释放——成功/失败两路均无 busy 泄漏** |
| RPC 未决窗口 | busy=true 期间 close()/cancelImport 被 guard 阻断（:139/:239） | — | 'submitting' 悬置 | 隐藏 | ⚠️ 仅持续至 rpcWithDeadline 20s 超时（:522-537 必然 settle），自恢复，无永久残留 |

粘滞总结：**不存在 1.2.0 引入的永久 busy/dshImport 残留**；唯一的持续禁用态是设计内的 `uncertain` 锁（触发条件：任一写 RPC 超时/未知结果——1.2.0 新增的 import 属 writing 类，超时同样进入该锁）。若用户在点击删除站点前发生过一次导入超时，删除按钮 disabled=true + 解释横幅在滚动区顶部（同第二节视口问题）→ 观感「点了没反应」。

## 五、1.2.0 挂载/渲染运行时错误风险

- 新增模块函数（safeProviderList/safeConflicts/safeImportResult :66-81）：纯函数，加载期不执行，无 throw 面。
- 新增 `useState(null)` + `useRef(null)` 常量初始化（:124），且声明先于 :128 invalidateBalances 引用，无 TDZ 风险。
- importView :275-305：`if (!wizard) return null`；importSelection/importConfirmReady 对非 ready 形状防御（:221/:225）；`.map/.join/.find` 的宿主数组全部由 safeProviderList/safeConflicts 白名单保证；查找用 `?.`。所有 setter 都 spread 保留 `targets/selected` 对象，confirm 步访问 `wizard.targets[c.providerId]` 不会 undefined。
- localStorage：仅基线既有的 POS_KEY 位置持久化（try/catch 包裹），1.2.0 零新增 localStorage 写。
- 反证：若渲染抛错，React 树卸载表现为**整个悬浮面板（含悬浮球）消失**，而非「面板正常显示但删除按钮无反应」——与用户报告不符。
- **结论：1.2.0 未引入会使面板树挂掉的运行时错误风险；该候选排除。**

## 六、候选根因排序（可能性从高到低）

### #1（最可能）SITE_IN_USE 设计性早退 + 错误横幅在滚动区顶部、视口外 ——「静默观感」
- 证据：src/client.js:427（有账号→setError 即 return，无 confirm 无 RPC）、:59（文案）、:498（横幅渲染于 .dfa-body 顶部）、style.css:6（overflow:auto 可滚动）。
- 特征：站点有关联账号时**按设计不允许直接删除**；用户视角零即时反馈。与「重启 DSH 后点击无反应」完全吻合（重启不改变账号挂靠）。
- 用户侧验证：① 看该站点区块下方是否列有账号/凭据（有=设计禁止，先删账号或改选空站点）；② 点击后**向上滚动**面板，查红色横幅是否为「站点仍有关联账号或凭据…」；③ 在只有空站点的 vault 上点「删除站点」——若 confirm 正常弹出并删除成功，即实锤点击链本身是通的。
- GUI 侧验证（供后续修复任务参考，本任务未改码）：将操作类错误改为就地内联提示（如站点区块内 dfa-error）或 setError 后 scrollIntoView/focus，消除视口外静默。

### #2（中）uncertain 锁残留：此前任一写操作超时/未知结果（含 1.2.0 新增导入路径）
- 证据：src/client.js:483（disabled 含 uncertain）、:499（顶部横幅）、:533（importDshProviders 属 writing 类，20s 超时→RESULT_UNKNOWN）、style.css:7（disabled 半透明）。
- 特征：所有写按钮半透明可辨但易忽略；解释横幅同样可能被滚出视口。
- 用户侧验证：观察删除站点按钮是否半透明；向上滚动看「提交结果未知：所有写操作已禁用…」横幅；点「重新载入」后重试删除。
- GUI 侧验证：DevTools console 无 removeSite RPC 发出 + 按钮半透明 = 该路径。

### #3（中低）window.confirm 被 Chromium 层抑制（环境级，非 DSH 代码）
- 证据：第三节——插件 7 处 confirm 依赖与 1.1.1 逐字一致；DSH 全栈（web bundle / ModuleLoader / preload / main.js）零 confirm 拦截、零沙箱 iframe；Chromium「阻止此页面创建更多对话框」特性可在长会话中人为触发，触发后 confirm 静默返回 false → 四个删除按钮全部「无反应」，且该行为 1.1.1 起一直存在、从未被真实点击删除时未暴露。
- 用户侧/GUI 侧验证：面板打开时 DevTools console 执行 `window.confirm('audit-test')`——正常弹窗=confirm 可用；返回 false 且 console 出现 dialog suppressed 记录=抑制实锤；重启 DSH 恢复。另可观察 Network 面板：点击删除后是否发出 removeSite RPC（未发出=confirm/预检早退；发出但报错=横幅可见性/服务端问题）。

### #4（低）commit 后服务端错误（CONFLICT/BUSY/WRITE_FAILED）横幅同样在视口外
- 证据：commit 错误路径 setError（:376 一带）与 :498 渲染同 #1 的可见性问题；removeSite 点击链本身会发 RPC。
- 判定：与 #1 同属「错误可见性」类，用户侧以 Network 面板区分。

### #5（排除）1.2.0 渲染崩溃 / 状态粘滞 / busy 泄漏
- 证据：第四、五节逐路径与逐行分析——busy 恒由 finally 释放（t5 修复对失败路径完备：失败路径不调 load()，无需先释放）、dshImport 残留仅存在于必然 settle 的 20s RPC 窗口、渲染新增面全部防御式。面板若崩溃会整体消失，与「面板可见但删除无反应」表象不符。

## 七、审计留档清单（同目录）

- `client-1.1.1-vs-1.2.0.diff`：1.1.1 基线 ↔ 1.2.0 全量 diff（6 hunks，零触碰 removeSite 链）。
- `asar-context-scan.cjs` / `asar-list.cjs` / `asar-extract.cjs` / `gui-shell-probe.cjs`：DSH 桌面壳 app.asar 只读取证脚本（GUI 实测探针返回 401 需令牌，未深取）。
- `main-evidence.js`（lib/main.js 516KB）、`preload-app-evidence.cjs`、`moduleloader-evidence.js`（dsh-client-modules/lib/client.js）、`web-bundle-evidence.js`（dsh-web-frontend index bundle 941KB）、`dsh-package-evidence.json`：提取自 app.asar 的只读证据副本。
- 真实 vault / 真实数据 / DSH_HOME：零读取零写入；本插件源码：零改动。
