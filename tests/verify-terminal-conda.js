const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const out={steps:[],fail:false}
const step=(n,ok,detail)=>{out.steps.push({name:n,ok,detail}); if(!ok) out.fail=true}
const store=window.__dshWorktable.splitStore
const shown=()=>[...document.querySelectorAll('.dsh-mt_tabKeep')].filter(w=>getComputedStyle(w).display!=='none')[0]
const rows=()=>{const r=(shown()||document).querySelector('.xterm-rows'); return (r?.innerText||'').replace(/\u00a0/g,' ')}
const typeIn=(text)=>{
  const ta=(shown()||document).querySelector('.xterm-helper-textarea'); if(!ta) return 'no-textarea'
  ta.focus(); try { const dt=new DataTransfer(); dt.setData('text/plain',text)
    if (ta.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))) return 'paste' } catch(e) {}
  ta.value=text; ta.dispatchEvent(new InputEvent('input',{bubbles:true,data:text,inputType:'insertText'}))
  ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true})); return 'input-event'
}
store.open({id:'conda-check',title:'t',top:null,main:[{id:'p1',title:'窗口1',min:200,content:null,tabs:[],active:0}],chatWidth:{default:380,min:260,max:700},chatSide:'right',chatFullHeight:true})
await sleep(1400)
;[...document.querySelectorAll('.dsh-mt_panePick')].find(b=>/终端/.test(b.textContent||''))?.click()
await sleep(5200)
out.first=rows().split('\n').filter(Boolean)
step('终端加载了个人配置：出现 PowerShell 横幅（不再是 -NoLogo 的干净首屏）', /Windows PowerShell|版权所有|Copyright/.test(out.first.join(' ')), JSON.stringify(out.first.slice(0,3).join(' | ').slice(0,110)))
step('提示符带 conda 环境 (base)', /\(base\)/.test(out.first.join(' ')), JSON.stringify(out.first.filter(l=>/PS /.test(l)).slice(-1)[0]||''))
typeIn('echo "CONDA=$env:CONDA_DEFAULT_ENV"\r'); await sleep(1800)
out.env=rows().split('\n').filter(Boolean).slice(-3)
step('conda 环境变量在终端里可见（CONDA_DEFAULT_ENV=base）', /CONDA=base/.test(out.env.join(' ')), JSON.stringify(out.env.join(' | ').slice(0,110)))
typeIn('conda env list\r'); await sleep(3500)
out.list=rows().split('\n').filter(Boolean).slice(-8)
const hasBase=out.list.some(l=>/^base\s+/.test(l.trim()) || /\bbase\b.*[A-Za-z]:\\/.test(l))
step('conda 命令可用：conda env list 列出 base 环境', hasBase, JSON.stringify(out.list.slice(-4).join(' | ').slice(0,160)))
typeIn('python -c "import sys; print(sys.executable)"\r'); await sleep(3000)
out.py=rows().split('\n').filter(Boolean).slice(-4)
step('conda 的 python 就是终端里的 python（环境真的生效，不只是提示符好看）', /[Cc]onda|envs/.test(out.py.join(' ')) || /python\.exe/i.test(out.py.join(' ')), JSON.stringify(out.py.slice(-2).join(' | ').slice(0,160)))
store.close(); await sleep(300)
return out
