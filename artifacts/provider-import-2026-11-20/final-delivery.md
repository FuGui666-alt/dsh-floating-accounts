# 1.2.0 最终离线交付验证（从 DSH 导入供应商）

2026-11-20，任务 t6 attempt 2（bf391b16-a9b7-4ca0-9ef7-09169e269cda）。attempt 1 安全复核通过但 SDK carrier 回归阻断（PI-1..PI-4，needs_revision 退回 backend）；backend 修复后本 attempt 重跑全链并关闭全部 findings。attempt 1 的 needs_revision 结论作为历史记录保留不改写。

| 验证命令 | 退出码 | 结果 |
| --- | --- | --- |
| `node scripts/build.mjs` | 0 | fresh build 成功（final2-build.log） |
| `npm test` | 0 | 272/272 通过，0 fail（final2-local.log） |
| `ELECTRON_RUN_AS_NODE=1 DSH_CHECKOUT='D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh' 'D:/FUGUI/ai/guanfangdsh/dsh/DeepSeek Harness.exe' --expose-internals --loader ./scripts/runtime-loader.mjs --test tests/host.test.mjs tests/multi-site-host.test.mjs tests/provider-import-host.test.mjs` | 0 | 20/20 通过（final2-sdk.log；attempt 1 同命令 11/20） |
| `node scripts/pack.mjs` | 0 | 64 文件离线包生成成功（final2-pack.log） |
| `node artifacts/provider-import-2026-11-20/final-evidence.mjs` | 0 | MANIFEST 64 条逐路径包内/工作区 SHA256 全部一致，文件集合与 distributionFiles 一致，receipt 哈希一致，build 身份校验通过 |

最终离线包：`dist/dsh-floating-accounts-1.2.0.tgz`（199,990 字节，64 文件）

SHA256：`b12992daeb6add43f501d543ef1e974f6644b29841fd41d3d5a2948c140ab06c`（final-evidence.mjs 与独立 sha256sum 交叉一致）

## 阶段A 独立安全复核（5/5 通过，attempt 1 完成、attempt 2 复核修复后仍成立）

1. 明文 Key 仅存在于 resolve→DPAPI 加密前瞬间（transact 内 `plain.fill(0)`）；DTO/日志/错误/前端状态/测试断言零明文 Key、零 apiKeyEnv 引用名（client 三重白名单拷贝 + 测试 assertNoLeak/doesNotMatch 全覆盖；全 src 无 console.*）。
2. 无勾选/confirmText 不符在任何 vault I/O 与 credentials 解析之前返回（步骤①零 I/O 校验，resolve 计数 0、vault 字节不变断言）。
3. 同 origin 合并规则三态（缺省自动/null 显式新建/uuid 指定）与 IMPORT_CONFLICT 清单结构符合冻结 spec；锁内重验。
4. `listDshProviders` 纯 readFile 零写盘；单测前后配置文件 sha256 逐一相同。
5. 导入路径零联网（import 白名单静态断言 + 网络原语 regex）；`balance.js`/`balance-http.js` 与 T0 基线同哈希，detectBalanceProtocol 行为未变。

非阻断备忘：勾选 hasKey=false 且带 ref 的供应商在宿主端走 resolve 阶段映射（MISSING_KEY/INVALID_SECRET）而非 INVALID_INPUT；ref 缺失 → INVALID_INPUT；UI 已禁选。spec §行为3 与 §错误白名单两行间的口径选择，测试已固化，零写入不变。

## Findings 关闭依据

- PI-1 [high]：backend 将 DshProviderImporter 改为 symbol-slot 惰性构建（首次调用 listDshProviders/importDshProviders 时创建，保留第4参注入）；host/multi-site 旧 SDK carrier 构造不再崩，20/20 通过。verifier attempt 2 独立复核。
- PI-2 [medium]：provider-import-host.test.mjs call() 零参发 `args:{}`，真实 gateway 接受。已复核。
- PI-3 [medium]：描述符测试解构 peer，ReferenceError 消除。已复核。
- PI-4 [medium]：host.test.mjs:17 期望名单扩展两新方法，旧断言未删。已复核。

## 基线对账（final-verification.json baseline 段）

- 本轮有意变更 16 路径（src×5、lib×5、tests×2、package.json、scripts/build.mjs、scripts/verify.mjs、README.md[t7]），无超集变更；新增分发文件 7+LICENSE；无分发文件删除（4 份工作区报告文档 + scripts/probe-sdk.mjs 为历来不在分发集的快照口径项，文件本体均在且未变）。
- 已安装目录 58 文件逐路径哈希全部未变（零安装）；install/uninstall/lifecycle 脚本未变。
- 真实 vault `accounts.dpapi.json`：bytes=3150，sha256=`240e4771d4f6ff354da9ffc9207662866741ae3019bd5c5e07f49670b2ae53cd`，与 T0 基线逐字节一致（只读哈希，未解密）。
- desktop profile package.json 哈希未变。

## 范围与残余风险

沿用既有环境：Electron 44.7.0 / Node 24.21.0，经未改动的 runtime-loader 读取 ASAR 内 SDK；未装依赖、未改宿主。测试全部 synthetic fixture。未覆盖真实 GUI 交互、真实供应商 HTTP/Key 行为、安装与真实导入（安装与真实导入需用户另次明确授权）。证据等级 B：离线回归、真实 SDK carrier 与交付包完整性已验证。工作区无 Git 仓库，未建分支或提交。
