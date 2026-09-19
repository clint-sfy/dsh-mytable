const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const out={steps:[],fail:false}
const step=(n,ok,d)=>{out.steps.push({name:n,ok,detail:d}); if(!ok) out.fail=true}
const store=window.__dshWorktable.splitStore
const verts=()=>document.querySelectorAll('.dsh-mt_splitDivider:not(.dsh-mt_splitDividerH)').length
const horiz=()=>document.querySelectorAll('.dsh-mt_splitDividerH').length
const rects=()=>[...document.querySelectorAll('.dsh-mt_pane')].map(el=>{const r=el.getBoundingClientRect();return{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}})
const act=(k,n=0)=>[...document.querySelectorAll('[data-pane-action="'+k+'"]')][n]
store.open({id:'probe-div',title:'p',top:null,main:[{id:'p1',title:'窗口1',min:160,content:null}],chatWidth:{default:380,min:260,max:700},chatSide:'right',chatFullHeight:true})
await sleep(1500)
act('split-right').click(); await sleep(800)
step('1 排 2 窗 → 1 条竖线', verts()===1 && horiz()===0, `竖=${verts()} 横=${horiz()}`)
act('split-down').click(); await sleep(900)
step('2 排（上排 2 窗）→ 竖 1 横 1（横向分隔线在位）', verts()===1 && horiz()===1, `竖=${verts()} 横=${horiz()}`)
act('split-right', 1).click(); await sleep(900)   // 主行（末排）再分 → 2×2
out.grid22=rects()
step('2×2（4 窗）→ 两排各有竖线：竖 2 横 1', verts()===2 && horiz()===1, `竖=${verts()} 横=${horiz()} ${JSON.stringify(out.grid22)}`)
act('split-down').click(); await sleep(900)       // 3 排
step('3 排 → 横线 2 条（排与排之间都有）', horiz()===2, `竖=${verts()} 横=${horiz()}`)
act('split-right', 2).click(); await sleep(900)   // 给中间排再分一个窗（中间排 = 第 3 个分栏键所在排）
out.three=rects()
const rowsY=[...new Set(out.three.map(r=>r.y))].sort((a,b)=>a-b)
step('3 排（中间排 2 窗）→ 竖线 2 条（每排有 2 窗的都有一条）', verts()===2 && horiz()===2, `竖=${verts()} 横=${horiz()} 排=${rowsY.length}`)
out.before=rects().find(r=>r.y===rowsY[1])
store.setRowW(1, 0, 260)
await sleep(700)
out.after=rects().find(r=>r.y===rowsY[1])
step('拖中间排竖线（setRowW）能改宽度', !!out.after && Math.abs(out.after.w-260)<=2 && out.after.w!==out.before?.w, `before=${out.before?.w} after=${out.after?.w}`)
store.close(); await sleep(300)
return out
