# T7 SDK与候选包验证记录（待修复，非最终交付）

2026-11-20。本轮只补验收测试及证据，不修改检测业务实现。当前独立审查新增PD-2（HTTP429未停止探测）、PD-3（Sub2API显式CNY识别）仍待专属修复任务，候选包不得称为最终版本。

- 既有Electron 44.7.0、Node 24.21.0可读取ASAR中的SDK。此前普通Node的ERR_MODULE_NOT_FOUND是ASAR路径解析环境问题，并非宿主缺少SDK；没有安装依赖或修改宿主。
- 补齐计划要求的真实SDK carrier测试，并在原host精确Remote枚举末尾添加detectBalanceProtocol，旧断言保留。
- fresh build退出0；npm test为242/242通过；Electron + runtime-loader的host、multi-site-host、protocol-detection-host三组共18/18通过。确切命令及完整日志见t7-verification.json、t7-local.log、t7-sdk.log。
- pack退出0；解包后MANIFEST的57条路径全部与包内文件和工作区文件SHA-256一致；build source/output摘要验证成功。
- 当前待修复候选包SHA-256：`3c5f33d309a96f70db0faa59f4b5a2da5bae6e526c1701ad176031e739ce072a`。
- task-start基线所列54个已安装文件逐路径哈希全部未变；工作区install/uninstall/lifecycle代码未变。未执行安装、真实迁移、生产HTTP或真实Key测试。
- 基线没有真实加密vault路径/摘要，只声明realVaultRead=false；因此不声称已验证真实密文字节一致。本轮没有读或解密真实vault。测试仅创建并清理tests/.fixtures中的synthetic vault。
- 未覆盖真实GUI操作及供应商真实响应。无Git仓库，按既有计划不建分支或提交。证据等级B：SDK与离线回归已验证，待修复项仍阻止最终交付。
