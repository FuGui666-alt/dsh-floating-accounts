# dsh-floating-accounts 1.3.0 — Release Notes（草稿 / 待发布）

> **状态：本地可发布，尚未发布。**
> 本仓库已建立本地 Git 仓库与基线提交，但**未配置任何远程、未推送 GitHub、未发布 npm**。
> 推送与发布需要用户单独授权与凭据；进 DSH 市场还需真实 GitHub 仓库 + npm 发布（宿主市场契约生成 `git+<url>.git#<commit>&path:/<path>`）。
> `plugin.json` **不是** DSH 官方 manifest（宿主不读），因此**不创建**；官方 manifest 走 `package.json` 的 `dsh` 字段。

---

## 1.3.0 变更范围

本轮落地四个批次：**A（样式 token 化）**、**B（可访问性）**、**C（导入向导信息架构）**、**D0（高危缺陷修复）**。

### D0 · 高危缺陷修复（最高优先级）

| 编号 | 问题 | 修复 | 验证 |
|---|---|---|---|
| N-01 / N-07 | 同批次多个**同 origin** 供应商会建出**重复站点**，之后永久 `IMPORT_CONFLICT`（违反 UI 上「同 origin 默认并入」的承诺） | `src/host-providers.js` 的 `planImport` auto-resolve 分支由 `targetSiteId = … : null` 改为 `… : undefined`，把三值语义（`undefined`=自动解析 / `null`=显式新建 / id=并入）**原样透传**到 vault，由 vault 在同一事务内解析目标 | 独立探针：同批次 2 个同 origin → **1 站点 + 2 账号（同 siteId）**；后续再导入同 origin → **并入不新建**；显式 `targetSiteId=null` → **仍新建独立站点**。`src/vault.js` 逐字节未改 |
| N-02 | `providerId` 命中 `Object.prototype` 键（`constructor` / `__proto__` / `toString` / `valueOf` / `hasOwnProperty`）时，**用户未勾选也会被真实提交**（含密钥落盘） | 客户端所有以 `providerId` 为键的对象访问改为无原型污染：新增 `dict()`（`Object.create(null)`）、`dictHas()`（`Object.prototype.hasOwnProperty.call`）、`dictCopy()`，勾选/目标/冲突/计数全部走 own-property 判定 | 独立对抗探针：5 个原型形 id **未勾选时提交 0 条**、勾选 1 条**只提交该条**、`confirmText` 逐字为「确认导入」、`Object.prototype` 未被污染 |
| N-03 | 取消导入后**迟到的响应**会让已取消的向导复活 | 引入 `importGeneration` 令牌；每次 `await` 之后重新比对令牌，取消/关闭面板时递增令牌，迟到响应被丢弃 | 回归：取消后迟到响应不渲染向导、关闭面板后迟到响应不渲染向导 |
| N-06 | 供应商上限 100 < 宿主 `MAX_PROVIDERS = 1000`，导致导入整体不可用且文案误导（「宿主返回的配置格式无效」） | 客户端上限对齐为 **1000**，超限抛 `PROVIDER_LIMIT` 并显示真实上限文案；另按宿主 `MAX_IMPORTS = 100` 增加单次导入上限 **100**，超限时在向导内就地提示并阻止必败提交 | 回归：101 个供应商可读、1001 个被拒且文案正确、单次上限 100 就地拦截 |
| N-05 | 畸形 `sites` 载荷抛原生 `TypeError`，内部报错文本（含源码表达式）进 UI | `safeSnapshot` 把任何非 `RPC_RESPONSE` 的异常统一映射为 `RPC_RESPONSE` | 回归：UI 只显示「配置格式无效」，不出现 `is not a function` / `undefined is not` |

### A · 样式宿主 token 化（`src/style.css`，44 → 76 行，零行为变更）

- **18 个宿主 token 家族全部接入**，且每个 `var()` 都带原值 fallback —— 裸 `var(--x)` 引用计数为 **0**；在**没有** `--dsw-*` token 的普通 Web 视口下外观不退化。
- 接入的 token：`--dsw-focus-ring-color/-width`、`--dsw-alias-state-error/success/warn-primary/warn-secondary`、`--dsw-alias-state-business-primary`、`--dsw-elevation-prominent/-soft`、`--dsw-specific-menu`、`--dsw-menu-backdrop-filter`、`--dsh-scrollbar-thumb/-hover`、`--dsw-alias-border-l2`、`--dsw-radius-sm/md/lg/xl`。
- 字面色从 117 处降到「仅 fallback 位」；语义色不再作为独立字面值出现。
- **卡片层级**：`.dfa-account` 改为透明底继承面板底色，`.dfa-site` 描边升到 `border-l2`，两级深度用 `elevation-soft` 表达（浅色/深色下层级方向一致）。
- **磨砂降本**：改用 `var(--dsw-menu-backdrop-filter, …)`；新增 `@media (prefers-reduced-transparency: reduce)` 去掉 `backdrop-filter` 并回落不透明底色。
- **渲染裁剪**：`.dfa-site` / `.dfa-account` 加 `content-visibility: auto` + `contain-intrinsic-size`（220px / 120px / 凭据行 40px），防滚动条抖动。
- **断点**：面板加 `container-type: inline-size` + `container-name: dfa-panel`，新增 `@container dfa-panel (max-width: 456px)`，保留 `@media (max-width: 480px)` 兜底；新增 `@media (max-width: 640px)` 与 `@media (pointer: coarse)` 把触摸目标提到 44px。
- 所有 `animation` 仍在 `@media (prefers-reduced-motion: no-preference)` 块内。

### B · 可访问性（`src/client.js`）

- **ARIA 关联**：面板加 `id="dfa-panel"`；浮球加 `aria-controls="dfa-panel"` + `aria-haspopup="dialog"` + `aria-expanded` + `data-open`。
- **浮球键盘可达**：方向键 12px 步进（Shift 32px）移动并持久化坐标，`Home` 复位到默认位；指针拖拽行为不变。
- **焦点迁移与归还**（同时修掉 N-04「开编辑器把焦点抢回面板」）：面板 `useEffect` 依赖收敛到 `[open]`；新增焦点账本（只存 DOM 节点与字符串键，**绝不存任何密钥**）；打开编辑器 → 编辑器容器，进入预览 → 确认步，返回 → 列表步，导入成功/取消 → 面板，取消编辑 → 归还触发按钮锚点。
- **冲突单选组**改用 `fieldset` + `legend`（legend 含供应商名与 origin），`radio` 的 `name` 不变。
- **live region 去重**：余额容器与检测区移除 `aria-live`，只保留内层 `role="status"`；错误统一收敛到单一常量 `ERROR_ROLE`，**全屏最多 1 个 `role="alert"`**；`uncertain` 与面板级错误互斥。

### C · 导入向导信息架构

- **C1 步骤条**：`ol` + `aria-current="step"`；三枚计数徽标（已选 N / 可导入 M / 未配 Key K）；`aria-busy`；提交中 `role="status"` 进度行；成功完成态。
- **C2 预览汇总**：供应商数 / 新建站点 X / 新建账号 Y / 并入 Z / 冲突 K；逐行徽标（并入站点「X」/ 新建账号 / 同源站点冲突）。同源比对复用客户端已有的 `snapshot.sites`，**零新增 RPC、零新增网络请求**；新建站点数按 origin 分组，与 D0-1 修好后的宿主行为**口径完全一致**。
- **C3 结果清单**：导入成功把 `created.siteIds/accountIds/credentialIds` 展开为逐项结果（账号名 / 所属站点 / 凭据数），原汇总句保留。
- **C4 分级空态**：全空态主 CTA 改为「从 DSH 导入供应商」；新增「站点已建立但还没有账号」态；供应商为空态带「重新读取清单」。
- **C5 错误作用域化**：错误状态由单槽字符串升级为 `{scope, message, retry, offline}`；导入错误渲染在 `.dfa-import` 区块内并带「重试读取清单」，面板级错误带「重试读取配置」，宿主不可达时标 `data-offline="true"`。

---

## 安全与契约不变项（逐条核验）

- RPC 方法集合**逐字未变**（6 个：`list` / `listDshProviders` / `importDshProviders` / `previewMigration` / `queryBalance` / `detectBalanceProtocol`）；写类方法一律 `args: { request }`，读类方法一律 `args: {}`。
- 错误码映射表**逐字未变**（`balanceFailure` 22 项、`operationFailure` 21 项）。新增的 `PROVIDER_LIMIT` 是**客户端本地**校验码，不进入宿主错误码空间。
- 确认文案**逐字未变**：`confirmText: '确认导入'` 是唯一写入 RPC 的位置，与宿主 `CONFIRM_TEXT` 一致。
- **两段确认未被绕过**：勾选校验与冲突校验全部在 `importDshProviders` 调用**之前**完成；宿主侧 `assertFields` + `confirmText` 比对也在任何 vault 读取与密钥解析之前。
- **白名单仍封闭**：`safeSnapshot` / `safeProviderList` / `safeImportResult` / `safeConflicts` 只回传白名单字段；`apiKeyEnv`、引用名、凭据值一律不进客户端状态。
- **import 路径零联网**：`fetch` / `XMLHttpRequest` / `WebSocket` / `node:http` 计数为 0；`console.*` 计数为 0；`localStorage` 仍只有浮球坐标两处。
- **无明文 Key 新落点**：浏览器侧从不解密；明文只在宿主内解析后进 DPAPI 加密。

---

## 回归证据

| 命令 | 退出码 | 结果 |
|---|---|---|
| `node scripts/build.mjs` | 0 | 构建成功 |
| `npm test` | 0 | **324 pass / 0 fail**（基线 272 + D0/C 新增 52），连续 3 次稳定 |
| SDK 宿主测试（Electron + ASAR loader，3 个文件） | 0 | **20 pass / 0 fail** |
| `node scripts/pack.mjs` | 0 | 离线包 64 文件 + `MANIFEST.json` + 收据 |
| `node scripts/verify.mjs` | 0 | build syntax: 0 / local regressions: 0 |
| `node --test tests/multi-site-vault.test.mjs` ×10 | 0 ×10 | 每次 **96 pass / 0 fail**（N-23 修复后 10/10 稳定） |

---

## N-23 修复（测试稳定性）

`tests/multi-site-vault.test.mjs` 中「同字节替换文件必须被迁移预览判定为身份变化」这条**安全相关不变量**的守护用例，此前用 inode 号比较，在 Windows 上 `fs.rename` 覆盖目标时可能复用 inode，产生**极低概率的假失败**。

**修复方式**（**不删用例、不弱化语义**）：改用「候选文件先校验 inode 确实不同 → `rm` 原文件 + `link` 候选」**确定性构造**出「同字节 + 同 mtime + 同大小但不同文件实例」的状态，并对三个「相同」条件逐一显式断言。真正的产品不变量（vault 必须拒绝迁移、文件必须逐字节不变）由原有的 `unchanged(...)` 断言继续守护。

---

## 发布前仍需完成（详见 `final-review.md` §10）

1. **版本号与元数据**：`package.json.version` → `1.3.0`（含 `src/index.js` 的 `export const version`）；补 `dsh.manifestVersion`、`engines.dsh`、`dsh.client.inject`、`icon`；`files` 补 4 个 `docs/*.md`（N-19）；`exports` 在 `locale/`、`icon.svg` 创建后补齐。
2. **创建 `locale/{en,zh}.json`、`icon.svg`、`CHANGELOG.md`、CI workflow**（N-18）。
3. **README 英文版**（当前仅中文）。
4. **统一测试清单**（N-14）：`scripts/verify.mjs` 缺 `tests/protocol-detection.test.mjs`。
5. **`dist/` 清理**（N-21）：5 个 tgz 中只有最新有收据；旧包建议归档到 `artifacts/`。
6. **离线包可复现性**：`lib/build-manifest.json` 的 `generatedAt` 使同版本号的 tgz 每次重打包 sha256 都不同——发布凭据需要稳定哈希。
7. **批次 D**（需宿主能力）：locale 字典接入 / `shell.overlay` 迁移 / 原子批量删除 RPC / `ctx.credentials` 存储层 / `dsh-atomic-write` / `settings.section` 入口。
8. **真实 GUI 验收**：本轮全部为 Node 级测试与 ASAR SDK gateway 验证，**不是** GUI 验收。
9. **GitHub 推送与 npm 发布**：需用户单独授权与凭据。
