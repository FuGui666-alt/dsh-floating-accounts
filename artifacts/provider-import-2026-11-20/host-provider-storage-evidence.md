# T1 宿主供应商存储调查（文件证据）

- 任务：provider-import 轮 t2（T1 宿主供应商存储调查）
- 执行：recon，2026-11-20 09:55–10:15 (+08:00)
- DSH_HOME：`D:\FUGUI\ai\dsh-data`（env `DSH_HOME` 解析）
- 宿主运行时：`D:\FUGUI\ai\guanfangdsh\dsh\DeepSeek Harness.exe`（Electron 44.7.0 / Node 24.21.0，`@deepseek-ai/dsh-desktop-runtime@0.2.1-rc.3`，宿主包见 `app.asar/dsh/package.json`）
- 方法：全程只读。读取经 `ELECTRON_RUN_AS_NODE=1` 的 Electron 二进制（asar 内部路径仅 Electron fs 可达；外部 Node 无法解析 asar，与上一轮 final-evidence.mjs 记录一致）。零写入 DSH_HOME、零 asar 写入、零网络请求、vault 未触碰（t1 之外）、明文 Key/secret 值未写进任何产出（仅记录引用名与值形状）。

## 0. 结论速览

1. **供应商定义（baseURL/模型名/Key 引用名）存两处**：
   - **组合层（本机权威）**：`%DSH_HOME%\profiles\desktop\cordis.patch.yml` 的 `- id: llm-pi-ai` 条目 `config.providers.<providerId>`（desktop 现有 **24 个 provider**，L51 起）。schema：`displayName? / apiKeyEnv / api / baseURL / models[{id, maxTokens?, name?}]`。
   - **settings 覆盖层**：settings 文档可携带 `llm-pi-ai:` 段覆盖 provider profiles（dsh-base patch 注释与 UI 源码证实此通道）；**本机 settings.yaml 无 `llm-pi-ai` 段**（grep 0 命中），故运行时 provider 全部来自组合层。
2. **明文 Key 存于 `%DSH_HOME%\.credentials.yaml` 顶层 `refs:` 段**（34 个引用名 → 明文字符串值，`version: 1` 门控；值仅记录形状：34 个字符串，长度 5–2355，charset token-like/ascii/non-ascii，**值本身未读取未输出**）。`records:` 段在主文件当前 0 条；另有独立 `.credentials-records.yaml`（536B，8 条记录，按任务约束不碰）。读取优先级（源码注释）：managed file **>** 继承的进程环境 **>** 调用目录 `.env` **>** `$DSH_HOME/.env`。
3. **宿主读取链**（源码级证据见 §6）：cordis 组合器按 `dsh.profile.bundles` → profile 自身 `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml`（本机不存在）→ `--patch` 顺序合成条目树 → `llm-pi-ai` 的 zod schema 校验 `Config.providers`（`apiKeyEnv: z.string().role("credential-ref")`）→ 每次请求经 credentials 服务 `resolve(ref)` 取明文 → 未配置抛 `LlmError(MISSING_CREDENTIAL)`。
4. **hasKey 现状**：desktop 24 个 provider 的 `apiKeyEnv` 引用名 **全部存在** 于 refs（基线时点）；headless 的 `XINJIANGG_API_KEY` 亦存在。例外分歧：settings.yaml `provider-usage` 段的 maikuai 用 `MINEKUAI_ACCOUNT_TOKEN`（不在 refs），而 patch 层同 id provider 用 `MAIKUAI_API_KEY`（在 refs）——跨层引用名可能不一致，hasKey 必须按"当前读的那一层"的引用名判定。
5. **RPC 导出建议**：DTO 仅 `providerId / name(displayName‖id) / baseURL / hasKey(bool) / models 白名单`；`apiKeyEnv` 引用名只作宿主内部 hasKey 判定输入，**不进 DTO/日志/错误信息**（与 t3 冻结方向一致）；任何路径都不得调用 `credentials.resolve()` 取值——导入流程确需值时由宿主侧解析后直接 DPAPI 入本插件 vault。

## 1. 组合层：profiles/desktop/cordis.patch.yml

- 文件：`D:\FUGUI\ai\dsh-data\profiles\desktop\cordis.patch.yml`
- 行数 1983（任务锚点写 1982，差 1 为行尾计数口径）、bytes 66366、sha256 `6b83989ea73deff48477230bb776aa84784a7ce4573d8f213748f585583f0f12`、mtime 2026-11-20 之前（基线快照 t1 已固化）。
- `llm-pi-ai` 条目（L51–54，摘录）：

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      nvidia-nim:
        displayName: NVIDIA接口
        apiKeyEnv: NVIDIA_NIM_API_KEY
        api: openai-completions
        baseURL: https://integrate.api.nvidia.com/v1
        models:
          - id: nvidia/nemotron-3-ultra-550b-a55b
            maxTokens: 8192
            name: NVIDIA Nemotron 3 Ultra 550B
```

- Provider 清单（24 个，来自结构化探测；`displayName=(none)` 表示该条目未写 displayName，导出时回退 providerId）：

| providerId | displayName | apiKeyEnv | baseURL | models |
|---|---|---|---|---|
| nvidia-nim | NVIDIA接口 | NVIDIA_NIM_API_KEY | https://integrate.api.nvidia.com/v1 | 13 |
| doubao | seed21pro | DOUBAO_API_KEY | https://ark.cn-beijing.volces.com/api/v3 | 1 |
| my-ollama | 越狱ai | MY_OLLAMA_API_KEY | http://localhost:11434/v1 | 2 |
| afb-v4 | (none) | AFB_V4_API_KEY | https://ai.zfb.la/v1 | 3 |
| yueshuai | 悦数ai | YUESHUAI_API_KEY | https://ys666.site/v1 | 8 |
| yeushu | 满血0.55倍 | YEUSHU_API_KEY | https://ys666.site/v1 | 6 |
| afbpro | (none) | AFBPRO_API_KEY | https://ai.zfb.la/v1 | 4 |
| sap | (none) | SAP_API_KEY | https://no1.token999.shop/v1 | 6 |
| afb-015 | (none) | AFB_015_API_KEY | https://ai.zfb.la/v1 | 4 |
| xinjiang123 | 他人密钥 | XINJIANG123_API_KEY | https://api.hcnsec.cn/v1 | 3 |
| svip | 公益二svip | SVIP_API_KEY | https://api.hcnsec.cn/v1 | 17 |
| xinjiangg | 幻城渣渣宇 | XINJIANGG_API_KEY | https://api.hcnsec.cn/v1 | 21 |
| zhipu | 智谱 | ZHIPU_API_KEY | https://open.bigmodel.cn/api/paas/v4/ | 12 |
| maikuai | 麦块云 | MAIKUAI_API_KEY | https://minekuai.cn/v1 | 1 |
| xingjiang | auto | XINGJIANG_API_KEY | https://api.hcnsec.cn/v1 | 41 |
| yizhichun | 1531577373 | YIZHICHUN_API_KEY | https://yizhichun.online/v1 | 9 |
| yizhichun1 | Deepseek分组 | YIZHICHUN1_API_KEY | https://yizhichun.online/v1 | 1 |
| yizhichun2 | 385266 | YIZHICHUN2_API_KEY | https://yizhichun.online/v1 | 5 |
| yizhichun3 | ChatGPT 分组 | YIZHICHUN3_API_KEY | https://yizhichun.online/v1 | 7 |
| yizhiichun5 | 智谱分组 | YIZHIICHUN5_API_KEY | https://yizhichun.online/v1 | 2 |
| pp | pp | PP_API_KEY | http://192.168.137.1:3425/v1 | 1 |
| yizhichun5 | 混元四 | YIZHICHUN5_API_KEY | https://yizhichun.online/v1 | 3 |
| svenx | svenx2215 | SVENX_API_KEY | https://svenx.net | 8 |
| svenx221514 | 无审查 | SVENX221514_API_KEY | https://svenx.net | 3 |

注：`yizhiichun5`（双 i 拼写）与 `yizhichun5` 是两个不同 providerId、引用两个不同 ref（YIZHIICHUN5_API_KEY / YIZHICHUN5_API_KEY）——providerId 与 ref 名没有推导关系，**必须逐条读取，不得按命名规则合成 ref**。

## 2. cordis.yml 的角色（4 行文件）

`profiles/desktop/cordis.yml` 与 `profiles/headless/cordis.yml` 均 223B / 5 行、内容逐字相同（L2-5）：

```yaml
# dsh profile root — an empty entry list. The tree is composed as patches:
# each bundle in package.json's dsh.profile.bundles, then cordis.patch.yml, then any
# --patch overlays. Edit cordis.patch.yml, not this file.
[]
```

源码级解释（asar `node_modules/@deepseek-ai/dsh/lib/profile-boot-C14i-8IN.js`，`PROFILE_ROOT_CONFIG`≈L117-122、`PROFILE_ROOT_FILENAME` L127）：该文件内容就是源码常量 `PROFILE_ROOT_CONFIG`，由 `prepareProfile()` 每次 `writeFileSync(join(profile.dir, PROFILE_ROOT_FILENAME), PROFILE_ROOT_CONFIG)` 写出（≈L220，region 205-235）——它是 Loader 需要的真实 include 根（锚定 `baseUrl`），**不承载用户数据**；真正的用户层是 `cordis.patch.yml`（`PROFILE_PATCH_FILENAME`）。

## 3. desktop 与 headless patch 的同构性

- **schema 同构，内容不同**。headless `cordis.patch.yml` 仅 18 行 / 506B / sha256 `9ca1f468ba10ab916d573bec68c7ed600673845aa30162c5f30a6bfca21796d5`：同样的 `- id: llm-pi-ai` + `config.providers.xinjiangg`（1 provider，displayName=zhazhayyu，auto 模型），另加 `- id: agent-default-model` 条目把 headless 通道钉在 `provider: xinjiangg / model: auto`。
- 结论：两 profile 走**同一组合机制与同一 entry schema**（`config.providers.<id>`），desktop 是全量用户层（24 providers），headless 是最小覆盖层（1 provider + 默认路由）。导入 RPC 读取时按当前 profile 的 `cordis.patch.yml` 读取即可，两 profile 无需不同代码路径。
- 组合顺序（asar `@deepseek-ai/dsh/lib/profile-boot-C14i-8IN.js` L76-77 摘录）："bundle layers in `dsh.profile.bundles` order, the profile's own `cordis.patch.yml`, `--patch` overlays, the telemetry switch"；home 层 `$DSH_HOME/cordis.patch.yml`（若存在）排在 per-profile 层之后、优先级更高（region 205-235，≈L216-217）。**本机 `$DSH_HOME/cordis.patch.yml` 不存在**（ls 确认），无 home 层干扰。

## 4. 明文 Key 存储：.credentials.yaml

- 文件：`D:\FUGUI\ai\dsh-data\.credentials.yaml`，9916B / 43 行，mtime 2026-11-20 09:35（本轮探测期间宿主在运行，文件随宿主写入而变；基线以本轮探测时点为准），sha256 `02a3ec6e9b08132acabe9969374b4477bae180498a31fed3601ed01b119cc939`（探测时点 2026-11-20T01:35:15Z 记录于 probe-credentials-structure.log；该文件是活文件，hash 仅作时点锚）。
- 结构（结构化探测，值未读取）：顶层 `version: 1` + `refs:`（**34 个引用名**）+ `records:`（0 条）。另有独立 `.credentials-records.yaml`（536B，records 8 条，历史/独立文件，读取方未追溯，按约束不碰）；`.credentials.yaml.bak-*` 多个历史备份存在，均未读取。
- refs 引用名全名单（值不记）：DEEPSEEK_API_KEY、NVIDIA_NIM_API_KEY、DOUBAO_API_KEY、MY_OLLAMA_API_KEY、AFB_V4_API_KEY、YUESHUAI_API_KEY、YEUSHU_API_KEY、AFBPRO_API_KEY、SAP_API_KEY、AFB_015_API_KEY、XINJIANG123_API_KEY、DEEPSEEK_BALANCE_API_KEY、SVIP_API_KEY、XINJIANGG_API_KEY、XINGJIANG_API_KEY、im_connect_qq_00e373a842ad_appSecret、CODEX_API_KEY、CODEARTS_ACCOUNT_6B921A53、TRAE_ACCOUNT_27515DEA、CODEARTS_ACCOUNT_6B5D25A8、ZCODE_ACCOUNT_5F092C64、ZHIPU_API_KEY、MAIKUAI_API_KEY、QODER_ACCOUNT_57F39C78、QODER_ACCOUNT_E588CC69、YIZHICHUN_API_KEY、YIZHICHUN1_API_KEY、YIZHICHUN2_API_KEY、YIZHICHUN3_API_KEY、YIZHIICHUN5_API_KEY、PP_API_KEY、YIZHICHUN5_API_KEY、SVENX_API_KEY、SVENX221514_API_KEY。
- 值形状（仅形状）：34 个全部为字符串；长度 min 5 / max 2355；charset token-like/ascii/non-ascii 混合。**全部为明文（非 DPAPI 密文、非加密容器）**——由 `parseRefs` 的"非空字符串值"校验与形状探测共同证实。
- 读取方（asar `node_modules/@deepseek-ai/dsh-credentials-local/lib/index.js`，区域行号见摘录日志）：
  - L49 `const CREDENTIALS_FILENAME = ".credentials.yaml";`；L58-64 `resolveSpec`（锚 L58）：`filename: resolve(config.path ?? join(resolveDshHome(config.dshHome), ".credentials.yaml"))`。
  - ≈L137-158 `parseCredentialsDocument`（version:1 门控锚 L153）：强制 `version: 1`（否则拒绝"pre-release flat layout"）；返回 `{refs Map, records Map, ignoredKeys}`；未知顶层键不阻断启动但告警。
  - L195-203 `parseRefs`："POSIX-identifier keys over non-empty string values"（`credentialRef(key)` 校验键名；值必须非空字符串）。
  - L205-215 `parseRecords`：`<scope>/<id>` 键 + tagged record（api-key record 的 `fields.key`，L246-251）——本机主文件 records 为 0 条。
  - ≈L329-337 `renderRef`（setIn 锚 L333-334）：`document.setIn(["refs", ref], value)` —— 写入即明文；跨进程写锁 + 保留注释格式（L36-40 注释）。
  - ≈L481-493 `resolve(ref)`（层序锚 L486-488）：file 值 → 继承进程环境 → `.env` 回退，返回 `{value, source}`；≈L499-520 `describe(ref)`（锚 L504）：返回 `{configured: bool, source, writable}` **不含值** —— 这就是宿主原生的 hasKey 原语。
  - ≈L729-737 `warnIgnoredKeys`（warn 调用锚 L734）：注释明言 "**only key names are printed, never values**" —— 宿主自身对日志纪律与本任务约束一致。
  - 分层优先级（L15-24 注释）：managed `.credentials.yaml` > 继承进程环境 > cwd `.env` > `$DSH_HOME/.env`；"The managed store wins because a credential the user explicitly saved in the product must take effect consistently"。
- 基座 patch 注册（asar `node_modules/@deepseek-ai/dsh-base/cordis.patch.yml` L663-676）："Credential sources: managed `$DSH_HOME/.credentials.yaml`, then inherited environment, project `.env`, and user `.env` fallbacks. Adapters resolve references per request; the Models page writes only the managed document, which is never materialized into the process environment." + `- id: credentials / name: '@deepseek-ai/dsh-credentials-local'`。

## 5. settings.yaml / settings.yaml.imported 旁证

- `settings.yaml`（2532B / 77 行，mtime 2026-11-18 14:18）：其 `providers:` 段属于顶层 `provider-usage:`（用户安装的 dsh-provider-usage 插件的余额/用量规格），**不是 llm-pi-ai 的**。13 条 provider 规格，schema 同款（id/kind/displayName/baseURL/apiKeyEnv），注释明言"只存凭据引用，不存密钥"。佐证：多个插件共用 refs 引用名寻址同一批凭据。
  - 分歧实例：provider-usage 的 maikuai 条目用 `apiKeyEnv: MINEKUAI_ACCOUNT_TOKEN`（**不在** refs 34 名单内），patch 层 maikuai 用 `MAIKUAI_API_KEY`（在 refs）。hasKey 判定必须与被读取层的引用名一致。
- `settings.yaml.imported`（4425B / 155 行，mtime 2026-10-19 11:54，早于队长预查标注的"11-16"，以 mtime 为准）：9 条同 schema 规格（nvidia-nim/doubao/my-ollama/afb-v4/yueshuai/yeushu/afbpro/sap/…），是历史导入快照，佐证 schema 长期稳定。文件内亦无 `llm-pi-ai` 段（grep 0 命中）。
- **settings 文档的 llm-pi-ai 覆盖通道**：dsh-base patch 注释（L678-684）"mounted dormant: zero routes … until a `llm-pi-ai:` settings section supplies provider profiles — then those routes register live"。本机 settings.yaml 无该段 → 运行时 provider 全部来自 patch 层。导入 RPC 若只读 patch 文件，在本机配置下无损；若要面向通用情形，应把"settings 文档 llm-pi-ai 段覆盖"列为已知变体（本机可检测：段不存在即跳过）。

## 6. 宿主源码级证据（app.asar 内，行号对应摘录日志 probe-source-excerpts.log 的 region 范围）

| # | asar 内路径 | 行号 | 函数/常量 | 作用 |
|---|---|---|---|---|
| 1 | `node_modules/@deepseek-ai/dsh-credentials-local/lib/index.js` | L15-52 | 模块文档 + `CREDENTIALS_FILENAME` | `$DSH_HOME/.credentials.yaml`，managed 优先层序 |
| 2 | 同上 | L58-64（锚 L58） | `resolveSpec` | `resolveDshHome(dshHome) + "/.credentials.yaml"`（可被 config.path 覆盖） |
| 3 | 同上 | ≈L137-158（version 锚 L153） | `parseCredentialsDocument` | version:1 门控；refs/records Map；ignoredKeys 告警 |
| 4 | 同上 | L195-215 | `parseRefs` / `parseRecords` | refs=POSIX 标识符键 + 非空字符串值；records=`<scope>/<id>` |
| 5 | 同上 | ≈L329-337（setIn 锚 L333-334） | `renderRef` | `setIn(["refs", ref], value)` 明文写入，保留注释 |
| 6 | 同上 | ≈L481-493（层序锚 L486-488） | `resolve(ref)` | file→env→.env 取值（返回值含明文——导入路径才允许触碰） |
| 7 | 同上 | ≈L499-520（锚 L504） | `describe(ref)` | `{configured, source, writable}` 无值返回 = hasKey 原语 |
| 8 | 同上 | ≈L729-737（warn 锚 L734） | `warnIgnoredKeys` | 日志只打印键名不打印值（宿主自带纪律） |
| 9 | `node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js` | L1050-1084（锚 L1050） | `profile` zod schema + `Config` | `apiKeyEnv: z.string().role("credential-ref")`；`Config = z.object({providers: z.dict(profile).default({}).volatile()})` |
| 10 | 同上 | ≈L1091-1096（锚 L1093） | `assertServiceable` | 变更的 provider profile 经 `resolveProfiles` 校验 |
| 11 | 同上 | ≈L1139-1185（锚 L1160/1166/1171） | `resolveProfiles` | `namesCredential: source.apiKeyEnv !== void 0`；`apiKeyEnv → credentialRef(apiKeyEnv)` 归一 |
| 12 | 同上 | L2158 | `modify` 守卫 | providerId 不得直寻存储凭据记录（"authenticate this route through apiKeyEnv"） |
| 13 | 同上 | L2877-2899 | `profiles()` + `resolveApiKey` | `config.providers.get()` 快照；`ctx.get("credentials").resolve(ref)` 按请求取值；未配置抛 `LlmError(MISSING_CREDENTIAL)` |
| 14 | `node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js` | L1273-1279 | `apiKeyEnvOf` | UI 从 schema 取 profile 的 apiKeyEnv 引用 |
| 15 | 同上 | ≈L1396-1412（锚 L1398/1404） | rows 映射 | `credentials[row.apiKeyEnv]` 存在性检查 + `credentialChecks` |
| 16 | 同上 | L2295-2297 | `keyConfiguredOf` | `row.credential?.configured === true` = UI 的 hasKey 语义 |
| 17 | `node_modules/@deepseek-ai/dsh-base/cordis.patch.yml` | L663-686 | 基座注册 | credentials 服务 + llm-pi-ai 挂载注释（引用按请求解析；Models 页只写 managed 文档） |
| 18 | `node_modules/@deepseek-ai/dsh-app-boot/lib/index.js` | L486-510（常量锚 L508/510） | 组合文档 + 常量 | `PROFILES_DIR="profiles"`；`PROFILE_PATCH_FILENAME="cordis.patch.yml"`；profile=目录(package.json 的 `dsh.profile.bundles` + cordis.patch.yml 用户层) |
| 19 | 同上 | region L1040-1140（patchPath 锚 L1041；loadProfile≈L1065；composeEntries≈L1084） | `loadProfileDirectory`/`loadProfile`/`composeEntries` | patchPath 读取 + `applyEntryPatches([], …)` 空根合成 |
| 20 | 同上 | ≈L1121-1137（home 层 join 锚 L1131） | `readProfilePatches` | bundle 层 → profile 层 → `$DSH_HOME/cordis.patch.yml` → overlays 的完整顺序 |
| 21 | `node_modules/@deepseek-ai/dsh/lib/profile-boot-C14i-8IN.js` | 层序注释 L76-77；PROFILE_ROOT_CONFIG≈L117-122；PROFILE_ROOT_FILENAME L127（grep 锚） | 层序 + `PROFILE_ROOT_CONFIG`/`PROFILE_ROOT_FILENAME` | cordis.yml 是常量写出的空根；层序权威注释 |
| 22 | 同上 | ≈L216-223（region 205-235；writeFileSync ≈L220） | `prepareProfile` | `writeFileSync(cordis.yml, PROFILE_ROOT_CONFIG)`——4 行文件的出处 |

行号说明：`≈` 为摘录区域推算（±3 行内）；`锚`/确切 `L` 为 grep/扫描验证的行号；每个 region 的精确起止见 `probe-source-excerpts.log` 与 `excerpt-spec.json`。

## 7. 读取方式建议（任务 c）

**读哪个文件**
- 主源：`%DSH_HOME%\profiles\<当前profile>\cordis.patch.yml` → `- id: llm-pi-ai` 条目 → `config.providers`。本机 desktop=24、headless=1，schema 稳定。
- 变体防御：若 settings 文档存在顶层 `llm-pi-ai:` 段则该段覆盖 provider profiles（本机不存在，grep 0 命中）；`$DSH_HOME/cordis.patch.yml` home 层本机不存在。实现按"段存在才合并"处理，缺失即零成本跳过。
- 不要读：`settings.yaml` 的 `provider-usage.providers`（另一插件的数据，仅引用名寻址）；`.credentials.yaml` 的值；任何 `.bak`/`.imported` 文件。

**导出字段（DTO）**
- `providerId`（dict 键）、`name = displayName ?? providerId`、`baseURL`、`models` 白名单数组（`id` 必列，`name`/`maxTokens` 可选带上）、`hasKey: boolean`。
- `apiKeyEnv` 引用名：**仅作宿主内部 hasKey 判定输入**，不进 DTO、不进日志、不进错误信息、不进前端状态（t3 冻结方向）。
- 明文 Key：任何路径不得导出。hasKey 判定不需要值。

**hasKey 判定（两条途径，推荐 ①）**
1. **credentials 服务**：插件与 credentials 服务同树运行，`ctx.get("credentials")` 后对每个 provider 的 `credentialRef(apiKeyEnv)` 调 `describe(ref)` → `configured === true` 即 hasKey。与宿主运行时语义完全一致（含进程 env/.env 回退），且天然不触值（源码 `describe` ≈L499-520）。
2. **文件级兜底**：解析 `.credentials.yaml` 顶层 `refs` 的**键名集合**（不读值），`hasKey = refs.has(apiKeyEnv)`。注意此口径不含 env 回退（provider-usage 的 MINEKUAI_ACCOUNT_TOKEN 即属此类分歧），实现若采用需在返回中注明口径。
- 红线：两条途径都**不得**调用 `resolve(ref)`；错误信息里只允许出现引用名与 providerId。

**导入路径（importDshProviders，t3 冻结范围，此处仅确认可行性）**
- 值获取唯一合法时机：用户勾选 + 确认后，宿主侧 `credentials.resolve(ref)` 取明文 → 立即 DPAPI 加密 → 按本插件现有 vault 事务写入 site/account/credential → 值不落日志/DTO/前端。
- 同 origin 合并、零写入前置校验等契约以 t3 冻结规格为准（本报告只提供"值从哪来、如何不泄"的文件证据）。

## 8. 方法与审计

- **脚本**（均只读，位于本目录）：
  - `probe-credentials-structure.cjs` → `probe-credentials-structure.log`（8 个 DSH_HOME 文件的结构+hash+形状，白名单外全脱敏）
  - `probe-asar-search.mjs` / `probe-asar-search2.mjs` → `probe-asar-search(.2).log`（asar 全量 14037 文件关键字扫描；命中按文件聚合）
  - `probe-scan-lines.mjs`（单文件行扫描，stdout 见运行记录）
  - `probe-source-excerpts.mjs` + `excerpt-spec.json` → `probe-source-excerpts.log`（20 个 region 的源码摘录，内置 apiKey/token/secret 字面量掩码护栏）
  - `read-only-loader.mjs`（按任务处方的只读 loader，镜像插件 `scripts/runtime-loader.mjs` 先例）
- **--loader 处方的执行情况**：3 次尝试（.cjs 入口 / .mjs 入口 / file:// 入口）均以 `ERR_UNSUPPORTED_ESM_URL_SCHEME`（'d:' 协议）失败——本 Electron 构建（node 24.21.0）的 ESM hook worker 对直跑脚本入口不兼容。上一轮先例（protocol-detection `final-evidence.mjs` L21）是在 `--expose-internals --loader … --test`（node --test 子命令）下使用的，本次补试 `--expose-internals --loader` 仍失败。**最终以 loader-less 的 `ELECTRON_RUN_AS_NODE=1 … <script>` 完成**：Electron fs 的 asar 支持在 run-as-node 模式下可用，读取行为与 loader 路径等价（本探测不 import 宿主模块，loader 本就 inert）。三个失败脚本现场与成功调用已如实记录于此。
- **只读纪律核对**：DSH_HOME 零写入（所有输出落本目录）；asar 零写入；全程无网络调用（脚本仅 fs）；vault 未触碰；`.credentials.yaml` 仅结构/形状读取，值从未进入任何输出。

## 附录 A：产物清单（本目录）

| 文件 | 说明 |
|---|---|
| host-provider-storage-evidence.md | 本报告 |
| probe-credentials-structure.cjs / .log | 凭据/设置文件结构探测（脱敏） |
| probe-asar-search.mjs / probe-asar-search.cjs / .log | asar 关键字扫描（14037 文件） |
| probe-asar-search2.mjs / .log | 组合/settings 通道定向扫描 |
| probe-scan-lines.mjs | 单文件行扫描器 |
| probe-source-excerpts.mjs / excerpt-spec.json / .log | 源码区域摘录（20 regions） |
| read-only-loader.mjs | 只读 loader（处方留档） |
| baseline-snapshot.json / make-baseline-snapshot.cjs | t1 产物（本目录共用） |

脚本与日志 SHA256 已在取证时点记录于运行输出（2026-11-20 10:05 +08:00）：probe-credentials-structure.cjs `52407450…`、probe-asar-search.mjs `f1d5874e…`、probe-asar-search2.mjs `4f6985e0…`、probe-source-excerpts.mjs `f887de2c…`、read-only-loader.mjs `ca3ba9ae…`、probe-source-excerpts.log `fbe28f06…`、probe-credentials-structure.log `f21e7736…`、probe-asar-search.log `1630d065…`、probe-asar-search2.log `12aacc8c…`。

## 附录 B：引用日志定位

- 源码摘录（含行号区间与掩码护栏）：`probe-source-excerpts.log`（regions 数组按本报告 §6 表格顺序排列）。
- 结构探测（含 refs 名单、值形状、providers 清单、文件 hash/mtime）：`probe-credentials-structure.log`。
- 关键字命中明细：`probe-asar-search.log` / `probe-asar-search2.log`。
