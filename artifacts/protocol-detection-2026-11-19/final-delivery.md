# 1.1.1 最终离线交付验证

2026-11-20，任务 t10 attempt 3（23136c56-131c-4ba6-955f-8ae4cb74fa9a）。在 t6/t9 独立复审通过后重新按顺序完成构建、离线回归、SDK 测试和打包。本记录替代 t7 候选包结论；历史审查不改写。

| 验证命令 | 退出码 | 结果 |
| --- | --- | --- |
| `node scripts/build.mjs` | 0 | fresh build 成功 |
| `npm test` | 0 | 245/245 通过，见 final-local.log |
| `ELECTRON_RUN_AS_NODE=1 DSH_CHECKOUT='D:/FUGUI/ai/guanfangdsh/dsh/resources/app.asar/dsh' 'D:/FUGUI/ai/guanfangdsh/dsh/DeepSeek Harness.exe' --expose-internals --loader ./scripts/runtime-loader.mjs --test tests/host.test.mjs tests/multi-site-host.test.mjs tests/protocol-detection-host.test.mjs` | 0 | 18/18 通过，见 final-sdk.log |
| `node scripts/pack.mjs` | 0 | 57 文件离线包生成成功 |
| `node artifacts/protocol-detection-2026-11-19/final-evidence.mjs` | 0 | manifest 57 条逐路径核对包内及工作区 SHA256 全部一致，文件集合与 distributionFiles 一致，build 身份校验通过 |

最终离线包：`dist/dsh-floating-accounts-1.1.1.tgz`

SHA256：`9170d0ac44ab7f4c8ccfbb1d332f57f1ddc47af094d9579e6d1eecab88478e39`

详细逐路径摘要、命令及保护边界见 final-verification.json。

## Findings 关闭依据

- PD-1：t5 修复、t6 独立复审通过。New API 自动检测候选强制 QUOTA/倍率1，伪造 USD/CNY 和异常倍率拒绝；合法候选、二次确认及 revision/代际保护保留。
- PD-2：t8 修复、t9 独立复审通过。真实 HTTP owner 将429映射为 BALANCE_RATE_LIMIT，detect 立即停止；组合 mock 断言仅一次请求、无 postcheck、无原响应泄漏。
- PD-3：t8 修复、t9 独立复审通过。Sub2API 仅从显式 USD/CNY 构造候选并进入原严格 parser；缺失、非法、嵌套冲突单位和金额不一致均拒绝。
- t4 原 needs_revision 作为历史记录保留；以上关闭依据来自后续专属修复和独立复审，本任务仅刷新最终验证证据。

## 范围与残余风险

沿用 t7 已验证环境：Electron 44.7.0、Node 24.21.0，通过既有 runtime-loader 读取 ASAR 中 SDK；未安装依赖或修改宿主。task-start 基线列出的54个已安装文件逐路径哈希全部未变，install/uninstall/lifecycle 脚本也未变。

未执行安装、真实迁移、真实 Key 或生产 HTTP 请求。真实 vault 没有读取或解密；基线未记录真实密文路径/摘要，因此不声称已验证真实密文字节一致。测试使用 synthetic fixture 数据。

未覆盖真实 GUI 操作、供应商真实响应及安装/真实迁移。证据等级 B：离线回归、真实 SDK carrier 与交付包完整性已验证；产品实站行为仍需用户以后显式授权验证。工作区没有 Git 仓库，本任务未创建分支或提交。
