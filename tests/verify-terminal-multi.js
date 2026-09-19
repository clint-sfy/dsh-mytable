const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const out={steps:[],fail:false}
const step=(n,ok,detail)=>{out.steps.push({name:n,ok,detail}); if(!ok) out.fail=true}
const store=window.__dshWorktable.splitStore
const tabs=()=>[...document.querySelectorAll('.dsh-mt_tabTitle')].map(e=>e.textContent.trim())
const keeps=()=>[...document.querySelectorAll('.dsh-mt_tabKeep')]
const shown=()=>keeps().filter(w=>getComputedStyle(w).display!=='none')[0]
const rowsOf=(w)=>{const r=(w||document).querySelector('.xterm-rows'); return (r?.innerText||'').replace(/\u00a0/g,' ')}
const hidden=()=>keeps().filter(w=>getComputedStyle(w).display==='none')
// 往当前可见终端敲命令：先试 paste，不行退化为 textarea input 事件
const typeIn=(text)=>{
  const w=shown(); const ta=(w||document).querySelector('.xterm-helper-textarea')
  if(!ta) return 'no-textarea'
  ta.focus()
  try { const dt=new DataTransfer(); dt.setData('text/plain',text)
        if (ta.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))) return 'paste' } catch(e) {}
  ta.value=text
  ta.dispatchEvent(new InputEvent('input',{bubbles:true,data:text,inputType:'insertText'}))
  ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}))
  return 'input-event'
}
store.open({id:'term-multi2',title:'t',top:null,main:[{id:'p1',title:'窗口1',min:200,content:null,tabs:[],active:0}],chatWidth:{default:380,min:260,max:700},chatSide:'right',chatFullHeight:true})
await sleep(1400)
;[...document.querySelectorAll('.dsh-mt_panePick')].find(b=>/终端/.test(b.textContent||''))?.click()
await sleep(2600)
step('第 1 个终端就绪', tabs().filter(t=>/终端/.test(t)).length===1, tabs().join(' / '))
out.how=typeIn('echo MARK-ONE\r')
await sleep(1600)
const r1=rowsOf(shown())
step('第 1 个终端里跑通 echo MARK-ONE（真 shell + 真输入）', /MARK-ONE/.test(r1), out.how+' · '+JSON.stringify(r1.split('\n').filter(Boolean).slice(-2).join(' | ').slice(0,90)))
const node1=document.querySelector('.dsh-mt_termHost'); if(node1) node1.setAttribute('data-probe','t1')
document.querySelector('[data-tab-action="new-terminal"]').click(); await sleep(2800)
out.tabs=tabs()
step('「＋」开出第 2 个终端（编号 终端 2）', out.tabs.filter(t=>/终端/.test(t)).length===2 && /终端 2/.test(out.tabs.join(' ')), out.tabs.join(' / '))
step('第 2 个终端是全新 shell（没有 MARK-ONE 历史）', !/MARK-ONE/.test(rowsOf(shown())), JSON.stringify(rowsOf(shown()).split('\n').filter(Boolean).slice(-1)[0]||''))
step('第 1 个终端被隐藏但没被卸载', !!node1 && node1.isConnected && hidden().length===1, 'connected='+(!!node1&&node1.isConnected)+' hidden='+hidden().length)
// 真实点击标签切回第 1 个终端
;[...document.querySelectorAll('.dsh-mt_tab')][0].click(); await sleep(1200)
const back=rowsOf(shown())
step('切回第 1 个终端：MARK-ONE 历史还在（同一个 shell，未重开）', /MARK-ONE/.test(back), JSON.stringify(back.split('\n').filter(Boolean).slice(-2).join(' | ').slice(0,90)))
const q=document.querySelector('[data-probe="t1"]')
step('切回后仍是同一个 DOM 节点', q===node1 && !!node1 && node1.isConnected, 'probeAttr='+(q?'found':'missing')+' connected='+(!!node1&&node1.isConnected)+' same='+(q===node1))
step('切回后终端尺寸正常（隐藏期未被压扁）', node1.clientWidth>300 && node1.clientHeight>150, node1.clientWidth+'x'+node1.clientHeight)
step('第 2 个终端在后台仍挂载', hidden().length===1 && hidden()[0].querySelector('.xterm')!==null, 'hiddenKeeps='+hidden().length)
// 在标签 2 上再点一次「＋」：编号应继续（终端 3）
;[...document.querySelectorAll('.dsh-mt_tab')][1].click(); await sleep(600)
document.querySelectorAll('[data-tab-action="new-terminal"]')[1].click(); await sleep(2500)
out.tabs3=tabs()
step('在标签 2 上再点「＋」→ 终端 3（编号不重复）', out.tabs3.filter(t=>/终端/.test(t)).length===3 && /终端 3/.test(out.tabs3.join(' ')), out.tabs3.join(' / '))
step('3 个终端同时挂载（各自独立 shell）', keeps().length===3 && document.querySelectorAll('.dsh-mt_termHost .xterm').length===3, 'keeps='+keeps().length+' xterm='+document.querySelectorAll('.dsh-mt_termHost .xterm').length)
store.close(); await sleep(300)
return out
