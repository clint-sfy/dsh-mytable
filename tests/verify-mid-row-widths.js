const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const out={steps:[],fail:false}
const step=(n,ok,detail)=>{out.steps.push({name:n,ok,detail}); if(!ok) out.fail=true}
const store=window.__dshWorktable.splitStore
const P=(t)=>({id:'p-'+t,title:t,min:160,content:null,tabs:[],active:0})
const visPanes=()=>[...document.querySelectorAll('.dsh-mt_pane')].filter(el=>el.getBoundingClientRect().width>1)
const rowDump=()=>{const ps=visPanes().map(el=>{const r=el.getBoundingClientRect();return{y:Math.round(r.top),h:Math.round(r.height),x:Math.round(r.left),w:Math.round(r.width)}})
  const ys=[...new Set(ps.map(p=>p.y))].sort((a,b)=>a-b); return ys.map(y=>({y,h:ps.find(p=>p.y===y).h,n:ps.filter(p=>p.y===y).length}))}
const vDivs=()=>[...document.querySelectorAll('.dsh-mt_splitDivider:not(.dsh-mt_splitDividerH)')].filter(el=>el.getBoundingClientRect().height>1)
  .map(el=>{const r=el.getBoundingClientRect();return{y:Math.round(r.top),h:Math.round(r.height),x:Math.round(r.left)}}).sort((a,b)=>a.y-b.y||a.x-b.x)
// 你的布局：2 / 2 / 3
store.open({id:'vfix',title:'p',chatWidth:{default:380,min:260,max:700},chatSide:'right',chatFullHeight:true,
  top:[P('1'),P('2')], mid:[[P('3'),P('4')]], main:[P('5'),P('6'),P('7')]})
await sleep(1600)
const rows=rowDump(), vs=vDivs()
out.rows=rows; out.vs=vs
// 每排内窗口之间的竖线应落在该排的 y..y+h 区间内
const inRow=(d)=>rows.findIndex(r=>d.y>=r.y-2 && d.y+d.h<=r.y+r.h+2)
const mapped=vs.map(d=>({d,row:inRow(d)}))
out.mapped=mapped.map(m=>`y=${m.d.y} h=${m.d.h} → 第${m.row+1}排`)
step('每条竖线都完整落在某一排内（无跨界/无错排）', mapped.every(m=>m.row>=0), out.mapped.join(' | '))
step('末排（第3排，3 窗）有 2 条竖线且在第 3 排', (()=>{const last=rows.length-1; const c=mapped.filter(m=>m.row===last && (m.d.h<=rows[last].h+2)); return rows[last].n===3 && c.length===2})(), `末排 ${rows[rows.length-1]?.n} 窗`)
step('第2排（2 窗）有 1 条竖线且在第 2 排', (()=>{const c=mapped.filter(m=>m.row===1); return c.length>=1})(), JSON.stringify(mapped.filter(m=>m.row===1).map(m=>m.d)))
step('没有竖线落在第 2 排却属于第 3 排（旧 bug）', !mapped.some(m=>m.row===1 && m.d.h>rows[1].h+2), JSON.stringify(mapped.filter(m=>m.row===1).map(m=>`h=${m.d.h} vs 排高${rows[1].h}`)))
// 交互路径：点出来 2/2/3 再看
const act=(k,n=0)=>[...document.querySelectorAll('[data-pane-action="'+k+'"]')].filter(b=>(b.closest('.dsh-mt_pane')?.getBoundingClientRect().width??0)>1)[n]
store.close(); await sleep(400)
store.open({id:'vfix2',title:'p',top:null,main:[P('a')],chatWidth:{default:380,min:260,max:700},chatSide:'right',chatFullHeight:true})
await sleep(1400)
act('split-right').click(); await sleep(700)
act('split-down').click(); await sleep(800)
store.splitPaneRight(1,0); await sleep(700)
store.splitRowBelow(1,0); await sleep(900)
store.splitPaneRight(2,0); await sleep(700)
store.splitPaneRight(2,1); await sleep(800)
const rows2=rowDump(), vs2=vDivs()
const mapped2=vs2.map(d=>({d,row:rows2.findIndex(r=>d.y>=r.y-2 && d.y+d.h<=r.y+r.h+2)}))
out.path={counts:rows2.map(r=>r.n).join('/'), mapped:mapped2.map(m=>`y=${m.d.y} h=${m.d.h} → 第${m.row+1}排`)}
step('点击搭出 2/2/3：每排竖线都在本排内', rows2.map(r=>r.n).join('/')==='2/2/3' && mapped2.every(m=>m.row>=0), `${out.path.counts} | ${out.path.mapped.join(' | ')}`)
store.close(); await sleep(300)
return out
