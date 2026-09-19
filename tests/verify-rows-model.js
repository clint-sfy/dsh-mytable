const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const out={steps:[],fail:false}
const step=(n,ok,d)=>{out.steps.push({name:n,ok,detail:d}); if(!ok) out.fail=true}
const store=window.__dshWorktable.splitStore
const titles=()=>[...document.querySelectorAll('.dsh-mt_paneTitle')].map(e=>e.textContent.trim())
const rects=()=>[...document.querySelectorAll('.dsh-mt_pane')].map(el=>{const r=el.getBoundingClientRect();return{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}})
const rowsOf=()=>{const ys=[...new Set(rects().map(r=>r.y))].sort((a,b)=>a-b);return ys}
const act=(k,n=0)=>[...document.querySelectorAll('[data-pane-action="'+k+'"]')][n]
const seq=(n)=>Array.from({length:n},(_,i)=>'窗口'+(i+1))
store.open({id:'probe-rows2',title:'p',top:null,main:[{id:'p1',title:'窗口1',min:200,content:null}],chatWidth:{default:380,min:260,max:700},chatSide:'right',chatFullHeight:true})
await sleep(1500)
const g=store.geom
act('split-right').click(); await sleep(800)   // 1 排 2 窗
step('向右分栏后：1 排 2 窗，名字 1/2', rowsOf().length===1 && rects().length===2 && JSON.stringify(titles())===JSON.stringify(seq(2)), titles().join('/'))

act('split-down').click(); await sleep(1000)   // 2 排（上排 2 窗 + 下排 1 窗）
out.r2=rects()
step('第 1 次向下：2 排 3 窗，名字 1/2/3', rowsOf().length===2 && rects().length===3 && JSON.stringify(titles())===JSON.stringify(seq(3)), `${rowsOf().length}排 ${titles().join('/')}`)

act('split-down').click(); await sleep(1000)   // 3 排
out.r3=rects()
step('第 2 次向下：3 排 4 窗，名字 1/2/3/4（无重复）', rowsOf().length===3 && rects().length===4 && JSON.stringify(titles())===JSON.stringify(seq(4)), `${rowsOf().length}排 ${titles().join('/')}`)

act('split-down').click(); await sleep(1000)   // 4 排
out.r4=rects()
step('第 3 次向下：4 排 5 窗，名字 1…5（无重复）', rowsOf().length===4 && rects().length===5 && JSON.stringify(titles())===JSON.stringify(seq(5)), `${rowsOf().length}排 ${titles().join('/')}`)
step('各排高度之和 = 内容区高度（无重叠/无溢出）', (()=>{const per={};for(const r of out.r4) per[r.y]=r.h;const sum=Object.values(per).reduce((a,b)=>a+b,0);const span=Math.max(...out.r4.map(r=>r.y+r.h))-Math.min(...out.r4.map(r=>r.y));return Math.abs(sum-span)<=14})(), JSON.stringify(out.r4.map(r=>`${r.y}:${r.h}`)))
step('每个窗口都在左侧内容区（右边界 < 聊天列起点）', out.r4.every(r=>r.x+r.w <= g.right-300), JSON.stringify(out.r4.map(r=>`${r.x}+${r.w}`)))
step('4 排时每窗都有 ✕ 关闭键', document.querySelectorAll('[data-pane-action="close-pane"]').length===5, String(document.querySelectorAll('[data-pane-action="close-pane"]').length))

// 排内向右分栏：只切本排被点的窗口
act('split-right').click(); await sleep(900)
out.r5=rects()
step('排内向右分栏：窗口 +1，排数不变，名字连续', rowsOf().length===4 && rects().length===6 && JSON.stringify(titles())===JSON.stringify(seq(6)), `${rowsOf().length}排 ${titles().join('/')}`)

// 关闭：排删空即删排 + 名字补位
let guard=0
while (document.querySelectorAll('[data-pane-action="close-pane"]').length>1 && guard++<10) { document.querySelector('[data-pane-action="close-pane"]').click(); await sleep(650) }
out.last={rows:rowsOf().length,titles:titles()}
step('一路关闭：排数随排删空递减、名字始终从 1 连续', JSON.stringify(out.last.titles)===JSON.stringify(seq(rects().length)), `剩 ${rects().length} 窗 / ${out.last.rows} 排 / ${out.last.titles.join('/')}`)
step('最后只剩一个窗口且无 ✕', rects().length===1 && document.querySelectorAll('[data-pane-action="close-pane"]').length===0, titles().join('/'))
store.close(); await sleep(300)
return out
