const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const out={steps:[],fail:false}
const step=(n,ok,detail)=>{out.steps.push({name:n,ok,detail}); if(!ok) out.fail=true}
const store=window.__dshWorktable.splitStore
const rects=()=>[...document.querySelectorAll('.dsh-mt_pane')].map(el=>{const r=el.getBoundingClientRect();return{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}})
const act=(k,n=0)=>[...document.querySelectorAll('[data-pane-action="'+k+'"]')][n]
const near=(a,b,tol=6)=>Math.abs(a-b)<=tol
store.open({id:'probe-half2',title:'p',top:null,main:[{id:'p1',title:'窗口1',min:160,content:null}],chatWidth:{default:380,min:260,max:700},chatSide:'right',chatFullHeight:true})
await sleep(1500)
let r=rects(); const full=r[0].w
act('split-right').click(); await sleep(800); r=rects()
step('唯一窗口向右分栏 → 两半相等', r.length===2 && near(r[0].w,r[1].w), `${full} → ${r.map(x=>x.w).join('/')}`)
const w0=r[0].w, wLastOld=r[1].w
act('split-right',1).click(); await sleep(900); r=rects()
step('切「末窗」：原末窗一分为二（两半相等）', r.length===3 && near(r[1].w,r[2].w), `${wLastOld} → ${r.map(x=>x.w).join('/')}`)
step('两半之和 + 间隙 ≈ 原末窗宽度（没吞掉邻居的空间）', near(r[1].w+r[2].w+4, wLastOld, 8), `${r[1].w}+${r[2].w}+4 vs ${wLastOld}`)
step('第一个窗口宽度不变', near(r[0].w,w0), `${w0} → ${r[0].w}`)
// 2×2：上排（2 窗）再切末窗
act('split-down').click(); await sleep(900)
let rowsY=[...new Set(rects().map(x=>x.y))].sort((a,b)=>a-b)
const topBefore=rects().filter(x=>x.y===rowsY[0]).map(x=>x.w)
act('split-right',1).click(); await sleep(900)
const top=rects().filter(x=>x.y===rowsY[0]).map(x=>x.w)
step('2×2 上排切末窗：末窗一分为二、首窗不变', top.length===3 && near(top[1],top[2]) && near(top[0],topBefore[0]),
  `上排 ${topBefore.join('/')} → ${top.join('/')}`)
step('下排（1 窗）不受影响', (()=>{const bot=rects().filter(x=>x.y===rowsY[1]); return bot.length===1})())
// 三排：中间排切末窗
act('split-down').click(); await sleep(900)
act('split-right',2).click(); await sleep(900)
const r2=rects(); rowsY=[...new Set(r2.map(x=>x.y))].sort((a,b)=>a-b)
const mid=r2.filter(x=>x.y===rowsY[1]).map(x=>x.w)
step('三排中间排切末窗 → 该排两窗相等', mid.length>=2 && near(Math.min(...mid),Math.max(...mid)), `中间排 ${mid.join('/')}`)
out.all=r2.map(x=>`${x.x},${x.y} ${x.w}x${x.h}`)
store.close(); await sleep(300)
return out
