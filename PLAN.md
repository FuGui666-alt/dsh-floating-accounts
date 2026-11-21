# 独立悬浮账号配置插件实施计划

## 已批准需求与边界
用户选独立 DSH Desktop 插件并确认开发。目标0.2.x当前宿主；JavaScript/React/Cordis。常驻可拖动球、点击开关面板，多账号添加/编辑/删除，名称自动生成，Base URL/API Key必填，分组密钥选填且视为秘密。重开保持配置。空配置可打开，明确提示。没有网络请求、模型选择、余额、连接测试，不修改原余额插件。

## 环境与源头
工作目录D:/FUGUI/ai/WORK/软件设计；Node24.19.0 Windows；PowerShell可用；DSH_HOME环境已设置。非Git仓库，无提交/推送。现有插件示例证实客户端__ModuleLoader__.load与sidebar.footer.action、connection.rpc.call('/api',method,{args:{}})，宿主TypertRemoteService/Remote；SDK源码位于asar的特殊路径不可由no-follow文件工具读取，禁止绕过；用公开导出运行时API验证而非改宿主。

## 架构/安全契约
- 独立包dsh-floating-accounts，唯一保存文件位于DSH_HOME/plugin-data/dsh-floating-accounts/accounts.dpapi.json。
- 宿主Windows DPAPI CurrentUser加密整个payload；PowerShell只经stdin接收字节，无密钥命令行/日志、无明文临时文件；失败关闭而不降级明文。
- RPC只返回元数据和hasApiKey/hasGroupKey，绝不回传秘密。写入用revision乐观锁，串行队列+文件锁，原子替换。锁遗留不擅自猜测清理，明确恢复说明。
- 客户端填写的秘密只在短期表单/请求内；保存/取消/收起即清除；位置可存localStorage（非秘密）；不读取其它凭据。
- schema版本1，单文件原子写；损坏/不可解密时拒绝覆盖保留原件。各账号uuid、版本revision。
- URL仅HTTPS或回环HTTP；拒绝内嵌身份/query/hash；本任务不连接此URL。
- UI有loading/ready/error/saving状态，删除确认、未保存提醒、快捷Esc、视口限幅；多窗口revision冲突明确提示重新载入。

## 文件与任务
1. src/validation.js、src/vault.js、src/dpapi.ps1：输入契约、Windows加密持久化；tests/vault.test.mjs验证真DPAPI与重建实例后持久化、冲突、失败、删除和无明文。
2. src/index.js：Remote读写/删除/状态；tests/host.test.mjs用实际公开Cordis/Remote接口验证RPC参数和返回，无复制实现。
3. src/client.js、src/style.css：React悬浮面板，不依赖npm外部组件；build脚本封装ModuleLoader文件；组件交互测试及真实GUI视口验证。
4. scripts/build.mjs、scripts/install.mjs、package.json、cordis.patch.yml、README.md：可复制构建、离线安装包和备份/卸载；部署只增加此包与profile bundle。

## 验证/退出条件
node tests实际源代码；真实DPAPI往返、保存后新实例读取一致、编辑保持/替换Key、删除、合法/非法输入、空仓库、原子文件失败恢复、RPC不返密钥；语法检查、包文件清单。通过当前DSH GUI打开/收起/增删改/持久化；若BrowserSkill standalone sidebar仍禁止Agent Window，不切换后端绕过，保留GUI未验证且请用户提供正常浏览器连接。不得用模拟UI替代真实宿主验收。

## 实施路由与维护
TDD Route: Mode off; Decision skipped; Strict authority not applicable; Test posture post-change regression; Reason用户没有严格TDD要求。inline实施，最后独立只读审查。无新分支，无提交。新增代码必要性：现有插件没有独立安全账号编辑功能；最小范围仅本包，不复制/扩充旧余额所有者。逻辑按validation/vault/host/client职责拆分；不添加泛化框架。

## 当前检查点
代码与无依赖构建已实现；真WindowsDPAPI测试15项、实际生成客户端hook事件测试4项、离线安装/卸载测试1项、实际Cordis服务方法测试4项已分别通过，最终整套归档重跑中。客户端hook测试不是真实GUI。独立审查3项中问题已修：加密文件容量上限、编辑时冻结revision且加载中禁止操作、遗留锁明确人工恢复。源头修复+回归已加。

已安装至真实desktop profile；安装回读确认仅新增独立插件、原设置完全保留，安装lib与构建哈希一致。自包含SDK loader整套24项重跑已归档通过，离线tgz已生成。真实宿主RPC参数契约仍待授权GUI确认，不把ctx service方法调用冒充RPC。SDK公开导出确认Remote direct metadata和服务键；本轮修复测试Context返回proxy不等于原实例、hook harness缺URL造成验证脚本失败，没有改业务验收条件。GUI BrowserSkill当前已可创建AgentWindow但页面仍authentication required，用户tab没有DSH；不另起服务器或读取Token。安装只增加独立profile bundle，不改原余额模块。
