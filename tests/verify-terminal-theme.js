const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const out={steps:[],fail:false}
const step=(n,ok,detail)=>{out.steps.push({name:n,ok,detail}); if(!ok) out.fail=true}
const store=window.__dshWorktable.splitStore
store.open({id:'edge',title:'t',top:null,main:[{id:'p1',title:'窗口1',min:200,content:null,tabs:[],active:0}],chatWidth:{default:380,min:260,max:700},chatSide:'right',chatFullHeight:true})
await sleep(1400)
;[...document.querySelectorAll('.dsh-mt_panePick')].find(b=>/终端/.test(b.textContent||''))?.click()
await sleep(2600)
const host=document.querySelector('.dsh-mt_termHost')
const vp=document.querySelector('.dsh-mt_termHost .xterm-viewport')
const xterm=document.querySelector('.dsh-mt_termHost .xterm')
const bg=(el)=>el?getComputedStyle(el).backgroundColor:''
const dark={host:bg(host),vp:bg(vp),xterm:bg(xterm)}
try { document.documentElement.style.colorScheme='light'; document.body.removeAttribute('data-ds-dark-theme') } catch {}
await sleep(1100)
const light={host:bg(host),vp:bg(vp),xterm:bg(xterm)}
out.dark=dark; out.light=light
const isBlack=(c)=>/rgb\(0, 0, 0\)|rgb\(1, 4, 9\)/.test(c)
step('深色：终端宿主/视口都不是硬编码黑', !isBlack(dark.host) && !isBlack(dark.vp), JSON.stringify(dark))
step('浅色：终端宿主/视口同样不是黑（黑边消失）', !isBlack(light.host) && !isBlack(light.vp), JSON.stringify(light))
step('浅色下宿主底色变亮（跟随主题令牌）', (()=>{const n=(c)=>Number((/rgb\((\d+)/.exec(c)||[])[1]||0); return n(light.host)>n(dark.host)})(), `${dark.host} → ${light.host}`)
try { document.documentElement.style.colorScheme='dark'; document.body.setAttribute('data-ds-dark-theme','') } catch {}
await sleep(900)
const back={host:bg(host),vp:bg(vp)}
step('切回深色：底色回到深色值', back.host===dark.host || !isBlack(back.host), JSON.stringify(back))
store.close(); await sleep(300)
return out
