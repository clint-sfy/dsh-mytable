# 行列表模型（A′）：向下分栏不再限两排

> 状态：**待实施**（2026-09-13 记录）。当前引擎是「左栏 + 顶排 `top` + 主排 `main`」两排硬编码，
> 所以「向下分栏」到两排就置灰。本单把它换成任意排数（m×n 网格，每排内可再向右分）。
> 工作区在本单写下时是**验证全绿**的（`npm test` 21 项 + 三个真机探针），实施时请保持绿色。

## 目标行为

- 「向下分栏」在**任意排**下方插入新排（新排 1 个空窗），可反复叠加 → 3 排、4 排……
- 每排内的「向右分栏」照旧（只切开被点的那个窗口）
- 关闭窗口后：排删空则删排；窗口名按阅读顺序重编为 窗口1…N（已实现，`renumberPanes`）
- 聊天框固定右侧满高（已实现，`chatSide:'right'` + `chatFullHeight:true` 在 `open()` 里强制）
- 旧布局（`{top, main}` 两排、`dsh.mytable.split.v2` 旧尺寸键）自动迁移，不重建

## 改动清单（全部在 `src/client/split.tsx`，除非另注）

1. **布局形状**：`LayoutSpec` 增 `mid?: SplitPane[][]`（中间排）。首排= `top`、末排= `main`、中间= `mid`。
   读取时归一，写入时用 `withRows()` 回写（单排 → `top:null, mid:[], main:rows[0]`）。
2. **助手函数**（模块级，靠近 `renumberPanes`）：
   - `rowsOf(spec): SplitPane[][]` — `[top?, ...mid, main]`（过滤空排）
   - `withRows(spec, rows): LayoutSpec`
   - `rowIndex(spec, row): number` — `'top'→0`、`'main'→rows.length-1`、数字直接用、`'left'→-1`
   - `updatePane(spec, row, i, fn): LayoutSpec | null` — 统一收口目前重复 5 遍的
     `if (row==='left') … else if (row==='top') … else …` 分支；`openTab/closeTab/setActiveTab/`
     `toggleCollapsed/lockPane/setTabContent` 六个算子改为调用它（净减代码）
3. **尺寸状态**：`topH: number` → `rowHs: number[]`（各排高度，**末排吃余量**）；
   `paneWs: number[]` + `topWs: number[]` → `rowWs: number[][]`（每排各窗宽度）。
   `rowWs` 长度随排数变化，插入/删除排时同步增删。
4. **几何**（`WorkspaceLayer`）：按 `rowHs` 累加算出每排 `y/h`，逐排 `allocate(rowWs[i], 宽度)` 渲染；
   删除现在 `topItems/mainItems` 的两排写法（约 3300-3450 行区间）。
5. **分隔条**：每排内部竖条沿用它自己的 `rowWs[i]`（`makeDividerHandler('pane', index)` 加排号参数）；
   相邻排之间一条横条（N 排 → N-1 条），拖动改 `rowHs[i]`（`setRowH(i, h)` 取代 `setTopH`）。
6. **算子**：
   - `splitRowBelow(row, i)`：去掉 `isSingleRow` 限制；在 `rowIndex(row)+1` 处插入新排，
     高度 = 相邻排高度一半（末排插入时先把余量一分为二），宽度表同步。**同时删掉
     `pane.splitDownMax` 的置灰逻辑**（按钮永远可用）。
   - `closePane(row, i)`：排删空 → 删该排（保持至少一排、至少一个窗）。
7. **applyMargin**：聊天框已满高 → `marginTop` 恒为 `BAR_H`，把 `topH` 从这里彻底删掉。
8. **快照/池**：`PoolItem` 与 `WorkspaceLayer` 的 props 从 `topH/paneWs/topWs` 换成 `rowHs/rowWs`
   （约 3505-3580 行的三处快照 + 传参）。
9. **持久化**：`dsh.mytable.split.v2` 的每布局记录由 `{chatW, topH, leftW, paneWs, topWs, leftWs}`
   改为 `{chatW, leftW, rowHs, rowWs, leftWs}`；读到旧键时迁移（旧两排 → `rowHs=[oldTopH]`、
   `rowWs=[oldTopWs, oldPaneWs]`）。`index.tsx` 里的项目视图（`projects.v1.views`）存的是 spec 本身，
   `mid` 是普通字段，无需额外迁移。

## 验收（改完必须全绿）

```powershell
cd C:\MyProject\deepseek\work_table\dsh-mytable
npm run build ; npm run check ; npm test          # 10 门禁 + 8 锚点 + 3 数据目录
npm pack                                          # → dsh-mytable-0.1.0.tgz
# 两个 profile 都要重装（web 是 3080 那个 GUI 用的）
node "C:\MySoftware\nodejs\node_global\node_modules\@deepseek-ai\dsh\lib\bin.js" plugin --profile mytable remove dsh-mytable
node "C:\MySoftware\nodejs\node_global\node_modules\@deepseek-ai\dsh\lib\bin.js" plugin --profile mytable add "file:C:/MyProject/deepseek/work_table/dsh-mytable/dsh-mytable-0.1.0.tgz"
# web 同样一遍
```

真机探针（需要 headless Edge 带 `--remote-debugging-port=9222` + 一个跑着的实例）：

```powershell
node tests\cdp-probe.mjs <ws 模块路径> <就绪 URL> tests\verify-pane-split.js .tmp\shot.png fresh
node tests\cdp-probe.mjs <ws 模块路径> <就绪 URL> tests\verify-pane-renumber.js .tmp\shot2.png fresh
node tests\cdp-probe.mjs <ws 模块路径> <就绪 URL> tests\verify-fixed-layout.js .tmp\shot3.png fresh
```

`tests/verify-pane-split.js` 需按新行为改两类断言：
- 「已经是两排 → 向下分栏禁用」→ 改成「连点两次向下 → 3 排，`⤓` 仍可用」
- 新增：4 排时各排 `y` 递增、每排内 `x/w` 一致、各排高度之和 ≈ 内容区高度；排内 `⇥` 只切开本排被点的窗
- 新增：3 排 + 各排 2 窗（3×2=6 窗）的网格断言

装完最后用 `tools\restart-dsh-web.ps1 -Port 3080 -DelaySec 50 -TaskName dsh-mytable-web-restart`
（先 `schtasks /create … /run`）重启用户的 3080 实例，重启后浏览器会自动打开带新 token 的地址。

## 参考（用户点名）

`DSH-better-sidebar` 用**递归分割树 + 分数尺寸**实现了任意方向的切分，若要再进一步
（只切某一个窗口、同排邻居不受影响），照它的 `src/client/state.ts` 移植即可：
`SplitNode = SidebarLeaf | { dir:'row'|'col', children, sizes }`、`splitLeafAt`、`removeLeafAt`、
`moveTabToEdge(..., 'left'|'right'|'up'|'down'|'center')`，`sizes` 和为 1、几何由分数递推。
