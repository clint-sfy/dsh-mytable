const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const out={steps:[],fail:false}
const step=(n,ok,detail)=>{out.steps.push({name:n,ok,detail}); if(!ok) out.fail=true}
const store=window.__dshWorktable.splitStore
const shown=()=>[...document.querySelectorAll('.dsh-mt_tabKeep')].filter(w=>getComputedStyle(w).display!=='none')[0]
const probe=()=>{
  const host=document.querySelector('.dsh-mt_termHost')
  const row=(host||document).querySelector('.xterm-rows')
  const span=row?.querySelector('span')
  return {
    hostBg: host?getComputedStyle(host).backgroundColor:'',
    viewportBg: (()=>{const v=document.querySelector('.xterm-viewport'); return v?getComputedStyle(v).backgroundColor:''})(),
    textColor: span?getComputedStyle(span).color:(row?getComputedStyle(row).color:''),
  }
}
const setScheme=(dark)=>{
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  if (dark) document.body.setAttribute('data-ds-dark-theme',''); else document.body.removeAttribute('data-ds-dark-theme')
}
store.open({id:'term-theme',title:'t',top:null,main:[{id:'p1',title:'窗口1',min:200,content:null,tabs:[],active:0}],chatWidth:{default:380,min:260,max:700},chatSide:'right',chatFullHeight:true})
await sleep(1400)
;[...document.querySelectorAll('.dsh-mt_panePick')].find(b=>/终端/.test(b.textContent||''))?.click()
await sleep(2600)
setScheme(true); await sleep(900); out.dark=probe()
setScheme(false); await sleep(900); out.light=probe()
setScheme(true); await sleep(700); out.dark2=probe()
const lum=(c)=>{const m=/(\d+),\s*(\d+),\s*(\d+)/.exec(c||''); return m?(+m[1]*0.299 + +m[2]*0.587 + +m[3]*0.114):-1}
step('深色：宿主底色偏暗、终端文字偏亮', lum(out.dark.hostBg)<90 && lum(out.dark.textColor)>150, 'bg='+out.dark.hostBg+' text='+out.dark.textColor)
step('切浅色：宿主底色变白、终端文字变深（xterm theme 真换掉了）', lum(out.light.hostBg)>200 && lum(out.light.textColor)<120, 'bg='+out.light.hostBg+' text='+out.light.textColor)
step('切回深色：两项都跟着回来（双向跟随，不是一次性）', lum(out.dark2.hostBg)<90 && lum(out.dark2.textColor)>150 && out.dark2.textColor===out.dark.textColor, 'bg='+out.dark2.hostBg+' text='+out.dark2.textColor)
step('viewport 不是硬编码黑（浅色下不再有黑色底块）', /rgba\(0, 0, 0, 0\)/.test(out.light.viewportBg) || lum(out.light.viewportBg)>240, 'viewportBg='+out.light.viewportBg)
out.pairs={dark:out.dark.textColor, light:out.light.textColor}
store.close(); await sleep(300)
return out
