# 修复执行回执

- E1 → src/validation.js:14-16、tests/validation-repairs.test.mjs → 规范化后长度上限；中文、已编码、2048边界与幂等重读 → 2项通过。
- E2 → scripts/lifecycle.mjs、install.mjs、uninstall.mjs、tests/lifecycle-repairs.test.mjs → 共用独占锁、随机staging、profile快照CAS、owner token、只备份本次目标，不盲写整份旧清单 → 3项竞争/冲突/外部改写用例通过。
- E3 → scripts/uninstall.mjs、tests/lifecycle-repairs.test.mjs → prepared/code-backed-up/complete阶段日志，搬移失败保留注册，续作重读最新快照，加密数据保留 → 2项用例通过，重复卸载与重装可完成。
- E4 → src/vault.js、src/client.js、tests/vault-repairs.test.mjs → 提交结果与清理告警分离、close/unlink 独立、保留主异常、owner 校验后再删锁 → 2项用例通过。
- E5 → scripts/distribution.mjs、install.mjs、pack.mjs、package.json → package.files 为唯一清单；开发包携带验证脚本、loader 与全部测试；隔离 fixture 不入包 → 安装完整性用例通过。
- E6 → scripts/verify-installed.mjs、tests/lifecycle-repairs.test.mjs → 脚本根定位、mkdir 输出目录、profile 参数、快照变化单列 → 非 desktop / 异 cwd / 干净目录用例通过。
- R1 → src/style.css、tests/client-repairs.test.mjs → 球层高于面板，展开后仍可点到球；真实布局遮挡仍需人工确认。
- R2 → src/client.js、tests/client-repairs.test.mjs → 显式 20s 期限；仅超时视为结果未知、不自动重试、禁止再次写入直至重载；即时传输失败保持原文案。
- R3 → src/dpapi.js（新增）、src/dpapi.ps1、src/vault.js、tests/vault-repairs.test.mjs → 统一完成/终止路径、完成后停止累积、环境故障与不可解密分型、PS finally 清数组；不承诺不可变字符串彻底擦除 → 3项新增 + 真 DPAPI 15项通过。
- R4 → src/vault.js → 单句柄 fstat + 有界读取、读后与提交前两次身份/大小/mtime 比对，变化即 FILE_CHANGED 且不覆盖外来内容；最后一次检查到 rename 之间对非协作进程仍有残余窗口，已披露 → 3项用例通过。
- S1 → scripts/build.mjs、scripts/distribution.mjs、install.mjs、pack.mjs、tests/build-repairs.test.mjs → 随机 staging + 校验后提升 + build-manifest；篡改、源漂移、缺清单均拒绝 → 5项用例通过。
- S2 → src/validation.js、src/vault.js、tests/validation-repairs.test.mjs、tests/vault-repairs.test.mjs → 全 Unicode 空白/控制、严格 UUID、revision 上限拒绝、默认名避撞 → 4项用例通过；旧非规范记录不自动改写。
- S3 → package.json、scripts/verify.mjs、tests/client-repairs.test.mjs → 单一本地全量测试入口；SDK 缺失显式 hostTestsSkipped；宿主测试名称标注非传输 → 通过。

回归汇总：本地 50 项通过（原 23 项 + 新增 27 项）；宿主 SDK 4 项通过，合计 54 项；build/verify/pack 全部 exit 0；新包 36 文件，SHA256 f3698d9a5b27dc9fe4bcc16f56b4f8803d027424d2a207400768e1210b3f9631。

未改动：真实 profile 与已安装插件（仍在运行 1.0.0）、余额插件、加密账号文件。真实 GUI/RPC 未验证，属用户实操。