// Narrow documentation closeout; source and installed docs must still be byte-identical before writing.
import * as fs from 'node:fs';
import assert from 'node:assert/strict';
import { join,dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const artifact=dirname(fileURLToPath(import.meta.url)),source=resolve(artifact,'../..');
const receipt=JSON.parse(fs.readFileSync(join(artifact,'deployment-receipt.json')));
const paths=['README.md','docs/balance-query-plan.md'];
const edits=new Map();
function replace(text,from,to){assert.equal(text.split(from).length,2,'DOC_MATCH_NOT_UNIQUE');return text.replace(from,to);}
for(const path of paths){const a=fs.readFileSync(join(source,path)),b=fs.readFileSync(join(receipt.installed,path));assert.deepEqual(a,b);edits.set(path,{original:a,text:a.toString('utf8')});}
let readme=edits.get('README.md').text;
readme=replace(readme,'当前工作区新增余额能力，尚未发布或替换已安装的 1.0.2。余额网络查询**默认关闭**。2026-11-19 用户授权的本站单次查询已确认 `Sub2API /v1/usage` 的密钥限额模式及USD单位；源码已适配，但尚未覆盖安装或写入宿主配置。','2026-11-19 **16:03（Asia/Shanghai）已按用户授权覆盖desktop安装并启用本站配置**，版本仍为1.0.2。磁盘安装和配置合并/注册已验证；**运行中的DSH未重启，新页面尚未人工验收**。插件本身无配置时仍默认关闭；本站已设 `Sub2API /v1/usage`、USD、倍率1，已验证限额密钥模式。');
readme=replace(readme,'本次没有更改任何已安装宿主配置。','本次仅向desktop profile追加本插件balanceQuery配置，未改模型/其它插件配置。该配置作用于本插件全部账号，混合平台不自动识别。');
readme=replace(readme,'本站后续授权部署时的宿主配置值如下（本轮未写入安装环境）：','本站已授权写入desktop profile的宿主配置值如下：');
readme=replace(readme,'## 安装（本轮未执行）','## 首次安装与当前升级状态');
readme=replace(readme,'解压源码/离线安装包，进入插件目录。PowerShell 示例：','当前desktop已完成覆盖升级，有旧代码与配置完整备份，无需再执行安装器。保存会话后完整退出并重新启动DSH；仅刷新网页不足以确认宿主加载。\n\n以下命令仅适用于**尚未安装**的新环境；已有插件目录时安装器会拒绝。解压源码/离线安装包，进入插件目录。PowerShell 示例：');
readme=replace(readme,'新余额功能需要**另行授权覆盖安装后**由用户人工确认：','新余额功能已完成授权安装，重启后由用户人工确认：');
edits.get('README.md').text=readme;
let plan=edits.get('docs/balance-query-plan.md').text;
plan=replace(plan,'阶段：预检与路径确认完成，备份/安装尚未执行；TaskStartSnapshot将包含旧完整插件树hash、旧patch/package备份及受保护文件hash。','阶段：2026-11-19 16:03（Asia/Shanghai）覆盖安装+启用配置已完成；全部45个分发文件与工作区一致、7个受保护文件未变、旧代码和patch备份逐字节一致。实际SDK安装版隔离挂载/Remote注册/配置合并通过，未读取真实Vault/请求平台。TaskStartSnapshot保存在profile内唯一backup，部署证据见[部署记录](<../artifacts/balance-query-2026-11-19/deployment-receipt.json>)和[最终安装核验](<../artifacts/balance-query-2026-11-19/deployment-final-verification.json>)。');
plan=replace(plan,'## 状态\n进行中：','## 状态\n当前：源码及授权磁盘部署已验证，重启后的真实页面验收待用户执行。部署前回归94/94、本机实际SDK9/9通过。以下保留首轮修正时的历史检查点，不作为当前未完成状态。\n\n历史：');
plan=replace(plan,'最终验证须重新执行；','此后最终验证已重新执行并通过；');
plan+='\n部署脚本独立审查：回退token不能覆盖全树身份以及清理异常漏锁问题已核实修正，合成反例证明foreign target/backup/patch均拒绝；视觉转义的换行finding经实际JS求值与YAML check-only证伪，未盲目改变正确转义。追加使用Buffer保留原patch字节；完整原包作为回退backup保留（用户确认后才退休/清理）。无业务代码新增、无fallback/依赖扩张；宿主未重启，不能以隔离mount宣称运行中已更新。\n';
edits.get('docs/balance-query-plan.md').text=plan;
for(const [path,{original,text}]of edits){assert.deepEqual(fs.readFileSync(join(source,path)),original);assert.deepEqual(fs.readFileSync(join(receipt.installed,path)),original);fs.writeFileSync(join(artifact,path==='README.md'?'README-before-closeout.md':'plan-before-closeout.md'),original,{flag:'wx'});fs.writeFileSync(join(source,path),text);fs.writeFileSync(join(receipt.installed,path),text);assert.deepEqual(fs.readFileSync(join(source,path)),fs.readFileSync(join(receipt.installed,path)));}
console.log(JSON.stringify({docsUpdated:paths,sourceAndInstalledMatch:true,noBusinessCodeChanged:true,noProfileConfigChanged:true}));
