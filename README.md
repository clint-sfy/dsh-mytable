# dsh-mytable

一个面向 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) Web 界面的工作台插件。

它把常用项目、文件、终端、浏览器、代码预览、Git 改动、文案模板和对话放进同一个可分栏工作区，减少在多个窗口之间来回切换。

> [!IMPORTANT]
> DeepSeek Harness 目前仍处于开发预览阶段，后续版本可能包含不兼容变化。升级 DSH 或本插件前，建议先备份重要配置。

## 主要功能

- 工作台侧边栏：集中管理项目、图标、顺序、隐藏状态和会话绑定。
- 可调整分栏：支持横向、纵向窗口布局，以及拖动分隔线改变大小。
- 控制室：在一个页面查看不同项目和会话的运行状态。
- 资源管理器：浏览、搜索、预览和引用本地文件。
- 文件预览：支持代码、文本、Markdown、图片、PDF、音频、视频、CSV 等类型。
- 文件改动：查看 AI 本轮修改过的文件和 Git 工作区改动，并点击预览。
- 文案工作区：保存限制文件、固定话语和多个可拖动排序的模板。
- 内置终端和浏览器窗口。
- 内置 `dsh-flowglass`，无需再单独打开它的侧边栏。

## 环境要求

- Windows、macOS 或 Linux。
- Node.js `22.19+` 或 `24+`。
- pnpm。DSH 的插件管理命令会调用 pnpm。

如果电脑还没有 pnpm，可以执行：

```bash
corepack enable
```

如果 `corepack enable` 不适用于当前 Node.js 安装，也可以执行：

```bash
npm install --global pnpm
```

## 最快安装方式

推荐从 GitHub Release 安装已经构建好的 `.tgz` 文件。这样不需要在本机编译源码，也不需要允许安装脚本运行。

发布 `v0.1.0` Release 并上传安装包后，安装命令为：

```bash
npx --yes @deepseek-ai/dsh plugin --profile web add "https://github.com/clint-sfy/dsh-mytable/releases/download/v0.1.0/dsh-mytable-0.1.0.tgz"
npx --yes @deepseek-ai/dsh web
```

浏览器通常会自动打开。如果没有自动打开，请访问：

```text
http://127.0.0.1:3080
```

如果 DSH 已经在运行，请先在原来的终端按 `Ctrl+C` 停止它，安装完成后重新启动。插件集合只会在 DSH 启动时加载，单纯刷新网页不会加载刚安装的插件。

## 下载到本地后安装

### 方法一：下载 Release 安装包

1. 打开仓库的 [Releases](https://github.com/clint-sfy/dsh-mytable/releases)。
2. 下载 `dsh-mytable-0.1.0.tgz`。
3. 在下载目录打开终端。
4. 执行安装和启动命令。

PowerShell 示例：

```powershell
cd $HOME\Downloads
npx --yes @deepseek-ai/dsh plugin --profile web add ".\dsh-mytable-0.1.0.tgz"
npx --yes @deepseek-ai/dsh web
```

macOS / Linux 示例：

```bash
cd ~/Downloads
npx --yes @deepseek-ai/dsh plugin --profile web add ./dsh-mytable-0.1.0.tgz
npx --yes @deepseek-ai/dsh web
```

### 方法二：克隆仓库后直接安装

```bash
git clone https://github.com/clint-sfy/dsh-mytable.git
cd dsh-mytable
npm install
npm run build
npm pack
npx --yes @deepseek-ai/dsh plugin --profile web add ./dsh-mytable-0.1.0.tgz
npx --yes @deepseek-ai/dsh web
```

仓库已经自带 `vendor/dsh-flowglass-0.5.0.tgz`，不需要额外下载或克隆 `dsh-flowglass`。`npm pack` 生成的 `dsh-mytable-0.1.0.tgz` 也会内置运行所需的 Flowglass 依赖。

## 第一次部署 DSH

如果电脑上还没有使用过 DSH，不需要先全局安装。直接执行：

```bash
npx --yes @deepseek-ai/dsh web
```

这会：

1. 下载并启动 DSH。
2. 初始化默认的 `web` profile。
3. 在本机 `127.0.0.1:3080` 启动 Web 界面。
4. 通常自动打开浏览器。

首次启动确认 DSH 正常后，按 `Ctrl+C` 停止，再安装本插件：

```bash
npx --yes @deepseek-ai/dsh plugin --profile web add "路径/到/dsh-mytable-0.1.0.tgz"
npx --yes @deepseek-ai/dsh web
```

### 可选：安装全局 `dsh` 命令

如果不想每次输入 `npx --yes @deepseek-ai/dsh`，可以全局安装：

```bash
npm install --global @deepseek-ai/dsh pnpm
```

之后命令可以简写为：

```bash
dsh plugin --profile web add "路径/到/dsh-mytable-0.1.0.tgz"
dsh web
```

全局命令和 `npx` 使用的是同一个持久化 `web` profile；只要 `DSH_HOME` 没有改变，插件不会因为 npx 临时缓存被清理而消失。

## 使用独立 profile

普通用户建议直接安装到 `web` profile。如果希望把工作台和默认环境隔离，可以建立一个名为 `mytable` 的独立 profile：

```bash
npx --yes @deepseek-ai/dsh --profile mytable --from-default-profile web --dump-config
npx --yes @deepseek-ai/dsh plugin --profile mytable add "路径/到/dsh-mytable-0.1.0.tgz"
npx --yes @deepseek-ai/dsh --profile mytable
```

如果默认的 `3080` 端口已被占用，可以指定其他端口：

```bash
npx --yes @deepseek-ai/dsh --profile mytable --port 3081
```

## 在远程服务器上运行

DSH Web 默认只监听 `127.0.0.1`，不要为了方便直接暴露到公网。

在服务器上启动：

```bash
npx --yes @deepseek-ai/dsh web --no-open
```

然后在自己的电脑上建立 SSH 端口转发：

```bash
ssh -L 3080:127.0.0.1:3080 用户名@服务器地址
```

保持 SSH 连接，在本机浏览器打开：

```text
http://127.0.0.1:3080
```

官方当前不支持通过 `--host 0.0.0.0` 直接公开 DSH Web。需要公网访问时，应额外配置 HTTPS、身份认证、反向代理和可信主机，不建议把未经保护的 DSH 端口直接暴露到互联网。

## 验证安装

查看组合后的配置：

```bash
npx --yes @deepseek-ai/dsh --profile web --dump-config
```

输出中应出现 `dsh-mytable` 对应的配置层。

也可以查看 profile 中是否已经记录插件：

```bash
npx --yes @deepseek-ai/dsh plugin --profile web list
```

启动 DSH 后，侧边栏应出现工作台入口。

## 更新

下载新的版本化 `.tgz`，停止正在运行的 DSH，然后执行：

```bash
npx --yes @deepseek-ai/dsh plugin --profile web remove dsh-mytable
npx --yes @deepseek-ai/dsh plugin --profile web add "路径/到/新版-dsh-mytable.tgz"
npx --yes @deepseek-ai/dsh web
```

建议使用带版本号的安装包和 Release URL。不要长期复用一个内容会变化但地址不变的下载链接，否则 pnpm 可能因缓存完整性检查拒绝更新。

## 卸载

```bash
npx --yes @deepseek-ai/dsh plugin --profile web remove dsh-mytable
```

卸载后重新启动 DSH。

插件的界面状态主要保存在浏览器的 localStorage 和 IndexedDB 中。卸载插件不会自动删除这些数据；如果需要彻底清理，请在浏览器站点数据设置中删除 `127.0.0.1:3080` 的本地数据。

## 本地开发与打包

只需要克隆本仓库，然后在仓库根目录执行：

```bash
npm install
npm run build
npm pack
```

Flowglass 依赖已保存在仓库内的 `vendor/` 目录；无需在本仓库旁边准备其他项目目录。

生成：

```text
dsh-mytable-0.1.0.tgz
```

安装本地构建：

```bash
npx --yes @deepseek-ai/dsh plugin --profile web remove dsh-mytable
npx --yes @deepseek-ai/dsh plugin --profile web add ./dsh-mytable-0.1.0.tgz
npx --yes @deepseek-ai/dsh web
```

常用命令：

```bash
npm run build   # 构建插件
npm run check   # 检查构建产物语法
npm test        # 运行测试
npm pack        # 生成可安装的 tgz
```

## 发布建议

建议每个公开版本都采用不可变的 Git 标签和 Release：

1. 更新 `package.json`、`dsh.plugin.json` 中的版本号。
2. 执行 `npm run build`。
3. 执行 `npm pack`。
4. 创建同版本 Git 标签，例如 `v0.1.0`。
5. 创建 GitHub Release，并上传 `dsh-mytable-0.1.0.tgz`。
6. 在 README 中把推荐安装命令固定到该版本。

仓库可以添加 `dsh-plugin` topic，方便 DSH 用户发现插件。

## 数据与安全

- 插件可以读取用户明确打开或选择的本地工作区文件。
- 终端、文件修改、Git 操作等能力运行在本机 DSH 权限范围内。
- 安装第三方插件等同于允许它在 DSH 进程中运行代码，请只安装可信来源并优先固定版本或提交。
- 浏览器数据按来源隔离。更换端口后看到空白工作台，通常是因为进入了另一个浏览器 origin，并不代表原数据已经丢失。

## 兼容性

本插件面向 DeepSeek Harness Web profile。由于 DSH 仍在快速迭代，建议发布版本时在 Release 说明中记录经过验证的 DSH 版本。

如果升级 DSH 后工作台没有出现，请依次检查：

1. 插件是否安装在当前启动的 profile 中。
2. DSH 是否在安装或更新后完整重启。
3. `--dump-config` 输出中是否包含 `dsh-mytable`。
4. 浏览器是否打开了正确的端口。

## 参考与致谢

`dsh-mytable` 的设计与实现参考了以下优秀的 DSH 社区项目：

- [DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)：参考了文件树、文件预览、Git 改动、终端、子代理视图以及紧凑侧边栏的交互与视觉层次。
- [dsh-flowglass](https://github.com/Iwctwbh/dsh-flowglass)：参考并集成了会话流程图、工具调用和子代理分支的可视化能力；本插件安装包内包含适配后的 Flowglass 运行依赖。
- [dsh-worktable](https://github.com/Aisland-SJL/dsh-worktable)：参考了工作台、项目入口、分栏布局、控制室和项目与会话结合的整体产品思路。

感谢这些项目的作者和贡献者。上游项目的名称、代码与资源仍分别遵循各自仓库中的许可证和版权声明；本项目与上述项目均为独立的社区项目。

## 开源许可

本项目采用 [MIT License](./LICENSE)。

你可以使用、复制、修改、合并、发布和分发本项目，但需要保留原版权声明和许可证文本。本项目按“原样”提供，不附带任何明示或暗示担保。

## 说明

`dsh-mytable` 是社区项目，并非 DeepSeek 官方插件，也不代表 DeepSeek 官方立场。
