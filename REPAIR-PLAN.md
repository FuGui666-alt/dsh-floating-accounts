# 静态审查全清单修复计划

## 状态
进行中。基线为用户已确认的E1–E6、R1–R4、S1–S3完整报告（13项）；没有截断未知条目。逐项依序实现。仅项目源码/测试/打包，不自动更新真实profile、不浏览器、不真实页面、不AI/余额请求、不改旧余额插件。原GUI验收由用户执行。

## 执行路线
inline主代理顺序实施，最终独立只读复审。无Git仓库，不提交。源文件已读，基线快照保存artifacts/repair-baseline，旧包保留。无需再次批准，用户已经明确授权修复。
TDD Route: Mode off; Decision skipped; Strict authority not applicable; Test posture post-change regression。既有27用例不删不减；新增故障/边界用例。环境以node版本/PowerShell静态解析为准。无新外部依赖。

## 任务与必要性
- E1 validation规范化后限2048，URL自校验幂等；添加中文/编码/临界用例。
- E2 lifecycle辅助模块独占profile锁+文件快照CAS+随机staging，安装只清理自己目录、禁止整份盲回滚；测试并发与外部改写。
- E3 卸载阶段日志与续作，先备份/移动自身代码后CAS撤注册；失败不删数据，测试阶段恢复。
- E4 vault区分提交/清理，安全清理自身锁，warning白名单、安全主错误；测试close/unlink失败与提交成功。
- E5 统一distribution模块和package.files、install/pack选文件规则，开发包完整可执行；测试已安装脚本依赖。
- E6 verify-installed基于脚本根目录、创建artifacts、profile参数；测试异cwd/非desktop/干净输出。
- R1 球层高于面板，展开时仍可点击，拖动逻辑保持；静态层级+组件回归，真人步骤只写文档。
- R2 RPC显式deadline，写入超时/传输失败视为结果未知，不自动重试；清秘密、禁再写直至重载确认；测试迟到响应/一次调用。
- R3 dpapi独立生命周期模块统一进程close/超时/输出上限，环境错误分型；PS finally清数组且文档不承诺字符串完全擦除；测试假子进程+真DPAPI。
- R4 单句柄fstat+有界读取+读前后身份和内容快照对比，提交前拒绝目标变化；测试并发替换/超长。标准Node原子rename不提供对非协作进程的跨平台CAS，仍须文档说明最后检查到rename之间残余窗口；不宣称抵抗同用户恶意进程。
- S1 随机stage构建、验证后提交；pack/install强制同源产物校验；测试坏源不破坏旧lib、陈旧产物拒绝。
- S2 全Unicode空白/控制、严格UUID、revision递增上限、默认名避撞；测试极端值。旧已存在非规范值不自动改写/迁移；损坏路径仍关闭保护。
- S3 默认测试入口统一全本地集，SDK缺失显式SKIPPED/非完整验证；effect生命周期harness补监听/卸载/Esc，服务测试如实标非RPC；测试清单与构建身份。

## 复杂度/边界
新增辅助模块仅为清单源头职责：scripts/lifecycle.mjs（profile事务）、scripts/distribution.mjs（交付清单）、src/dpapi.js（子进程）及src/file-snapshot.js（有界快照）。替换旧重复/盲回滚/无界read路径，不加兼容adapter。锁只保护本插件安装/卸载及其vault协作写入，外部不遵锁进程不视为可完全隔离。安全/失败路径返回白名单错误，绝不记录秘密。文件I/O注入仅单元故障验证，不暴露RPC选项。

## 检查点与验证
每项完成更新执行回执，先E1-E3再E4-E6再R/S，不并行写同文件。全部node --check、PS parser、27既有+新测试、真WindowsDPAPI/实际Cordis服务、包MANIFEST/source/lib一致、无账号数据入包。最终保留新版本1.0.1独立tgz并记录旧安装未改，需用户安装后人工验收。故障测试只用项目隔离fixture，清理前校验绝对路径。

## 门禁
A1-A10通过：清单、输入/输出/接口、失败、验证、备份、批量范围和边界完整。B3/B5/B6/B7/B9/B10/B11/B12通过；数据库/新外部依赖/性能承诺为N/A。C1/C2以顺序13项检查点执行。无未确认业务变化。
## 不卡死计数
0；遇独立失败先归因，不改既有验收断言为迁就业务实现。无法保证的真实GUI/RPC只人工验收，不新增浏览器动作。
