import { useState, useEffect, useRef } from 'react'

const NF_COLORS = [
  '#FFE44A','#5EE07A','#4DC8F0','#F4A0C0','#FF9B3D',
  '#A78BFA','#F87171','#34D399','#60A5FA','#FBBF24',
]

const OBRAS_INICIAIS = [
  {
    id:'obra1', nome:'Vila do Paraíso', endereco:'Bloco 04 — MCMV',
    torres:[
      {id:'t1',nome:'Torre 01',pavimentos:[
        {id:'p1',nome:'Pavimento 01'},{id:'p2',nome:'Pavimento 02'},
        {id:'p3',nome:'Pavimento 03'},{id:'p4',nome:'Pavimento 04'},
        {id:'p5',nome:'Pavimento 05'},{id:'p6',nome:'Platibanda',tipo:'especial'},
      ]},
      {id:'t2',nome:'Torre 02',pavimentos:[
        {id:'p1',nome:'Pavimento 01'},{id:'p2',nome:'Pavimento 02'},{id:'p3',nome:'Pavimento 03'},
      ]},
    ],
    progresso:62, cor:'#1D9E75'
  },
  {
    id:'obra2', nome:'Vila Gonzaga', endereco:'Bloco 01 — MCMV',
    torres:[{id:'t1',nome:'Torre 01',pavimentos:[
      {id:'p1',nome:'Pav 01'},{id:'p2',nome:'Pav 02'},{id:'p3',nome:'Pav 03'},{id:'p4',nome:'Pav 04'},
    ]}],
    progresso:28, cor:'#3b82f6'
  },
  {
    id:'obra3', nome:'Vila das Tulipas', endereco:'Bloco 02 — MCMV',
    torres:[{id:'t1',nome:'Torre Única',pavimentos:[
      {id:'p1',nome:'Pav 01'},{id:'p2',nome:'Pav 02'},{id:'p3',nome:'Pav 03'},
      {id:'p4',nome:'Pav 04'},{id:'p5',nome:'Pav 05'},{id:'p6',nome:'Pav 06'},
    ]}],
    progresso:85, cor:'#f59e0b'
  },
]

const NF_VAZIA = {
  numero:'', data:new Date().toISOString().slice(0,10),
  fck:'', slump:'', volume:'', concreteira:'',
  horario:'', caminhao:'', placa:'',
  inicioDescarga:'', horaMoldagem:'', fimDescarga:'',
}

// ── GERADOR DE PDF ──
async function gerarPDF(obra, torre, pav, nfs, paintCanvas, bgCanvas, viewMode) {
  if(!window.jspdf) {
    await new Promise((res,rej)=>{
      const s=document.createElement('script')
      s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload=res; s.onerror=rej; document.head.appendChild(s)
    })
  }
  const { jsPDF } = window.jspdf
  const pdf = new jsPDF('landscape','mm','a4')
  const PW=pdf.internal.pageSize.getWidth(), PH=pdf.internal.pageSize.getHeight()
  const hoje=new Date().toLocaleDateString('pt-BR')
  const hora=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})

  // Cabeçalho
  pdf.setFillColor(29,158,117); pdf.rect(0,0,PW,14,'F')
  pdf.setTextColor(255,255,255); pdf.setFontSize(13); pdf.setFont('helvetica','bold')
  pdf.text('MAPEAMENTO DE CONCRETO — ESTRUTURA',PW/2,9,{align:'center'})
  pdf.setFontSize(8); pdf.text('ConcreteMap',PW-10,9,{align:'right'})

  pdf.setTextColor(50,50,50); pdf.setFontSize(9); pdf.setFont('helvetica','normal')
  pdf.text(`Obra: ${obra.nome}`,10,20); pdf.text(`Torre: ${torre.nome}`,10,25)
  pdf.text(`Pavimento: ${pav.nome}`,10,30); pdf.text(`Modo: ${viewMode==='parede'?'Parede':'Laje/Teto'}`,10,35)
  pdf.text(`Data: ${hoje}  Hora: ${hora}`,PW-10,20,{align:'right'})
  pdf.setFont('helvetica','bold')
  pdf.text(`${nfs.length} NFs · ${nfs.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0).toFixed(1)} m³`,PW-10,25,{align:'right'})

  pdf.setDrawColor(200,200,200); pdf.setLineWidth(0.3); pdf.line(10,38,PW-10,38)

  // Tabela
  const cols=['NF','Data','Placa BT','Vol.','fck','Slump','Chegada','Início Desc.','Moldagem','Fim Desc.','Concreteira']
  const colW=[18,20,18,14,12,14,16,18,16,16,30]
  let tx=10, ty=44
  pdf.setFillColor(245,245,245); pdf.rect(tx,ty-4,colW.reduce((a,b)=>a+b,0),6,'F')
  pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(80,80,80)
  cols.forEach((c,i)=>{ pdf.text(c,tx+1,ty); tx+=colW[i] })
  ty+=3
  nfs.forEach(nf=>{
    tx=10; pdf.setFont('helvetica','normal'); pdf.setFontSize(7)
    const rgb=hexToRgb(nf.cor)
    pdf.setFillColor(rgb[0],rgb[1],rgb[2]); pdf.rect(tx,ty-3,colW[0],5,'F')
    const row=[nf.numero,nf.data?new Date(nf.data+'T00:00:00').toLocaleDateString('pt-BR'):'—',
      nf.placa||'—',nf.volume||'—',`C${nf.fck||'—'}`,`${nf.slump||'—'}cm`,
      nf.horario||'—',nf.inicioDescarga||'—',nf.horaMoldagem||'—',nf.fimDescarga||'—',nf.concreteira||'—']
    pdf.setTextColor(40,40,40)
    row.forEach((v,i)=>{ if(i>0)pdf.text(String(v),tx+1,ty); tx+=colW[i] })
    pdf.text(nf.numero,11,ty)
    ty+=5; pdf.setDrawColor(230,230,230); pdf.setLineWidth(0.1)
    pdf.line(10,ty-1,10+colW.reduce((a,b)=>a+b,0),ty-1)
  })

  // Planta
  if(bgCanvas&&paintCanvas){
    const tmp=document.createElement('canvas'); tmp.width=bgCanvas.width; tmp.height=bgCanvas.height
    const tctx=tmp.getContext('2d'); tctx.drawImage(bgCanvas,0,0); tctx.drawImage(paintCanvas,0,0)
    const imgData=tmp.toDataURL('image/jpeg',0.92)
    const imgY=ty+3, imgH=PH-imgY-18, imgW=PW-20
    pdf.addImage(imgData,'JPEG',10,imgY,imgW,imgH)
  }

  // Legenda
  const legY=PH-12; pdf.setFillColor(250,250,250); pdf.rect(0,legY-2,PW,14,'F')
  pdf.setDrawColor(220,220,220); pdf.line(0,legY-2,PW,legY-2)
  pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor(100,100,100)
  pdf.text('LEGENDA:',10,legY+3)
  let lx=32
  nfs.forEach(nf=>{
    const rgb=hexToRgb(nf.cor); pdf.setFillColor(rgb[0],rgb[1],rgb[2]); pdf.rect(lx,legY,8,4,'F')
    pdf.setFont('helvetica','normal'); pdf.setTextColor(50,50,50)
    pdf.text(`NF ${nf.numero} (${nf.volume||'—'}m³)`,lx+10,legY+3)
    lx+=48; if(lx>PW-52){lx=32}
  })
  pdf.setFontSize(6); pdf.setTextColor(180,180,180)
  pdf.text(`ConcreteMap · ${obra.nome} · ${torre.nome} · ${pav.nome} · ${hoje} ${hora}`,PW/2,PH-2,{align:'center'})
  pdf.save(`MC_${obra.nome.replace(/\s/g,'_')}_${torre.nome}_${pav.nome}_${hoje.replace(/\//g,'')}.pdf`)
}

function hexToRgb(hex){
  return[parseInt(hex.slice(1,3),16)||0,parseInt(hex.slice(3,5),16)||0,parseInt(hex.slice(5,7),16)||0]
}

export default function App() {
  const [obras, setObras] = useState(()=>{
    try{const s=localStorage.getItem('cm_obras_v7');return s?JSON.parse(s):OBRAS_INICIAIS}catch{return OBRAS_INICIAIS}
  })
  const [nfs, setNfs] = useState(()=>{
    try{const s=localStorage.getItem('cm_nfs_v7');return s?JSON.parse(s):{
      obra1:[
        {id:'nf1',numero:'9445',data:'2026-02-10',fck:'25',slump:'24',volume:'7,0',concreteira:'Concrecity',horario:'15:19',caminhao:'BT 68',placa:'ABC-1111',inicioDescarga:'16:20',horaMoldagem:'16:15',fimDescarga:'16:31',cor:'#FFE44A'},
        {id:'nf2',numero:'9446',data:'2026-02-10',fck:'25',slump:'25',volume:'7,0',concreteira:'Concrecity',horario:'16:01',caminhao:'BT 75',placa:'DEF-2222',inicioDescarga:'16:33',horaMoldagem:'16:28',fimDescarga:'16:44',cor:'#FF9B3D'},
        {id:'nf3',numero:'9447',data:'2026-02-10',fck:'25',slump:'24',volume:'7,0',concreteira:'Concrecity',horario:'16:20',caminhao:'BT 76',placa:'GHI-3333',inicioDescarga:'16:46',horaMoldagem:'16:41',fimDescarga:'16:59',cor:'#4DC8F0'},
        {id:'nf4',numero:'9449',data:'2026-02-10',fck:'25',slump:'24.5',volume:'7,0',concreteira:'Concrecity',horario:'17:35',caminhao:'BT 71',placa:'JKL-4444',inicioDescarga:'17:48',horaMoldagem:'17:43',fimDescarga:'18:02',cor:'#5EE07A'},
        {id:'nf5',numero:'9450',data:'2026-02-10',fck:'25',slump:'25',volume:'6,0',concreteira:'Concrecity',horario:'18:31',caminhao:'BT 73',placa:'MNO-5555',inicioDescarga:'18:49',horaMoldagem:'18:44',fimDescarga:'19:03',cor:'#F4A0C0'},
      ]
    }}catch{return{}}
  })
  const [currentObra, setCurrentObra] = useState(null)
  const [currentTorre, setCurrentTorre] = useState(null)
  const [currentPav, setCurrentPav] = useState(null)
  const [activeNF, setActiveNF] = useState(null)
  const [tool, setTool] = useState('pen')
  const [brushSize, setBrushSize] = useState(18)
  const [opacity, setOpacity] = useState(0.65)
  const [viewMode, setViewMode] = useState('parede')
  const [modalObra, setModalObra] = useState(false)
  const [modalNF, setModalNF] = useState(false)
  const [modalRel, setModalRel] = useState(false)
  const [editingNF, setEditingNF] = useState(null) // null = nova NF, objeto = editando
  const [novaObra, setNovaObra] = useState({nome:'',endereco:'',torres:1,pavimentos:5})
  const [formNF, setFormNF] = useState({...NF_VAZIA})
  const [toast, setToast] = useState('')
  const [refresh, setRefresh] = useState(0)
  const canvasRefs = useRef({bg:null,paint:null})

  useEffect(()=>{localStorage.setItem('cm_obras_v7',JSON.stringify(obras))},[obras])
  useEffect(()=>{localStorage.setItem('cm_nfs_v7',JSON.stringify(nfs))},[nfs])

  function showToast(msg,dur=2500){setToast(msg);setTimeout(()=>setToast(''),dur)}

  // ── CHAVE DA PLANTA — agora por pavimento ──
  function getPlantaImgKey(){
    if(!currentObra||!currentTorre||!currentPav) return null
    return `cm_img_${currentObra.id}_${currentTorre.id}_${currentPav.id}`
  }

  function getPlantaImg(){
    const key = getPlantaImgKey()
    if(!key) return null
    // Tenta planta específica do pavimento
    const especifica = localStorage.getItem(key)
    if(especifica) return especifica
    // Fallback: planta padrão da obra
    return localStorage.getItem(`cm_img_${currentObra.id}_padrao`)
  }

  function salvarPlantaImg(dataUrl){
    const key = getPlantaImgKey()
    if(!key) return
    localStorage.setItem(key, dataUrl)
    // Também salva como padrão da obra se for o primeiro upload
    if(!localStorage.getItem(`cm_img_${currentObra.id}_padrao`)){
      localStorage.setItem(`cm_img_${currentObra.id}_padrao`, dataUrl)
    }
    setRefresh(r=>r+1)
    showToast('Planta carregada! ✓')
  }

  function getPlantaKey(){
    if(!currentObra||!currentTorre||!currentPav) return null
    return `cm_paint_${currentObra.id}_${currentTorre.id}_${currentPav.id}_${viewMode}`
  }

  async function exportarPDF(){
    const nfsObra=currentObra?(nfs[currentObra.id]||[]):[]
    if(!currentObra||!currentTorre||!currentPav){showToast('Selecione um pavimento');return}
    showToast('Gerando PDF...',4000)
    await gerarPDF(currentObra,currentTorre,currentPav,nfsObra,canvasRefs.current.paint,canvasRefs.current.bg,viewMode)
    showToast('PDF gerado! ✓')
  }

  function criarObra(){
    if(!novaObra.nome.trim()){showToast('Informe o nome');return}
    const torres=Array.from({length:novaObra.torres},(_,i)=>({
      id:`t${i+1}`,nome:`Torre ${String(i+1).padStart(2,'0')}`,
      pavimentos:Array.from({length:novaObra.pavimentos},(_,j)=>({id:`p${j+1}`,nome:`Pavimento ${String(j+1).padStart(2,'0')}`}))
    }))
    const cores=['#1D9E75','#3b82f6','#f59e0b','#ef4444','#8b5cf6']
    const nova={id:'obra'+Date.now(),nome:novaObra.nome,endereco:novaObra.endereco,torres,progresso:0,cor:cores[obras.length%cores.length]}
    setObras(p=>[...p,nova])
    setModalObra(false)
    setNovaObra({nome:'',endereco:'',torres:1,pavimentos:5})
    showToast(`Obra "${nova.nome}" criada!`)
  }

  // ── ABRIR MODAL NF (nova ou edição) ──
  function abrirModalNF(nf=null){
    if(nf){
      setEditingNF(nf)
      setFormNF({...NF_VAZIA,...nf})
    } else {
      setEditingNF(null)
      setFormNF({...NF_VAZIA})
    }
    setModalNF(true)
  }

  function salvarNF(){
    if(!formNF.numero.trim()){showToast('Informe o número da NF');return}
    if(!currentObra){showToast('Selecione uma obra');return}

    if(editingNF){
      // Editar NF existente
      setNfs(p=>({
        ...p,
        [currentObra.id]:(p[currentObra.id]||[]).map(n=>
          n.id===editingNF.id ? {...n,...formNF} : n
        )
      }))
      if(activeNF?.id===editingNF.id) setActiveNF(prev=>({...prev,...formNF}))
      showToast(`NF ${formNF.numero} atualizada!`)
    } else {
      // Nova NF
      const lista=nfs[currentObra.id]||[]
      const cor=NF_COLORS[lista.length%NF_COLORS.length]
      const nf={id:'nf'+Date.now(),...formNF,cor}
      setNfs(p=>({...p,[currentObra.id]:[...(p[currentObra.id]||[]),nf]}))
      showToast(`NF ${formNF.numero} cadastrada!`)
    }
    setModalNF(false)
    setEditingNF(null)
  }

  function excluirNF(nfId){
    if(!currentObra||!window.confirm('Excluir esta NF?')) return
    setNfs(p=>({...p,[currentObra.id]:(p[currentObra.id]||[]).filter(n=>n.id!==nfId)}))
    if(activeNF?.id===nfId) setActiveNF(null)
    showToast('NF excluída')
  }

  const nfsObra=currentObra?(nfs[currentObra.id]||[]):[]
  const plantaImg=(currentPav&&refresh>=0)?getPlantaImg():null
  const plantaKey=getPlantaKey()

  function getRelatorios(){
    if(!currentObra) return []
    const lista=nfs[currentObra.id]||[]
    const grupos={}
    lista.forEach(n=>{const d=n.data||'Sem data';if(!grupos[d])grupos[d]=[];grupos[d].push(n)})
    return Object.entries(grupos).sort((a,b)=>b[0].localeCompare(a[0]))
  }

  // Campos da tabela de concretagem (colunas visíveis)
  const TABELA_CAMPOS = [
    {key:'volume',    label:'Volume (m³)'},
    {key:'horario',   label:'Hora chegada BT'},
    {key:'inicioDescarga', label:'Início descarga'},
    {key:'horaMoldagem',   label:'Hora moldagem'},
    {key:'fimDescarga',    label:'Fim descarga'},
    {key:'placa',     label:'Placa BT'},
    {key:'slump',     label:'Slump'},
    {key:'fck',       label:'fck'},
    {key:'concreteira',label:'Concreteira'},
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:'system-ui,sans-serif',background:'#f8f7f4'}}>

      {/* TOPBAR */}
      <div style={{height:52,background:'#fff',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:'0 14px',gap:10,flexShrink:0}}>
        <div style={{fontSize:15,fontWeight:700,color:'#1D9E75',cursor:'pointer',whiteSpace:'nowrap'}}
          onClick={()=>{setCurrentObra(null);setCurrentTorre(null);setCurrentPav(null)}}>
          🏗️ ConcreteMap
        </div>
        <div style={{fontSize:11,color:'#9ca3af',flex:1,display:'flex',alignItems:'center',gap:4,overflow:'hidden'}}>
          {currentObra&&<span style={{color:'#374151',cursor:'pointer',whiteSpace:'nowrap'}} onClick={()=>{setCurrentObra(null);setCurrentTorre(null);setCurrentPav(null)}}>{currentObra.nome}</span>}
          {currentTorre&&<><span style={{color:'#d1d5db'}}> › </span><span style={{color:'#374151',whiteSpace:'nowrap'}}>{currentTorre.nome}</span></>}
          {currentPav&&<><span style={{color:'#d1d5db'}}> › </span><span style={{color:'#111827',fontWeight:500,whiteSpace:'nowrap'}}>{currentPav.nome}</span></>}
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          {currentObra&&<button onClick={()=>setModalRel(true)} style={{padding:'5px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer'}}>📊 Relatórios</button>}
          {currentPav&&<button onClick={exportarPDF} style={{padding:'5px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer'}}>📄 PDF</button>}
          {currentObra&&<button onClick={()=>abrirModalNF()} style={{padding:'5px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer'}}>+ Nova NF</button>}
          <button onClick={()=>setModalObra(true)} style={{padding:'5px 12px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:500}}>+ Nova Obra</button>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* SIDEBAR ESQUERDA */}
        <div style={{width:210,background:'#fff',borderRight:'1px solid #e5e7eb',overflowY:'auto',flexShrink:0}}>
          <div style={{padding:'8px 8px 4px',fontSize:10,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.06em'}}>Obras</div>
          {obras.map(o=>(
            <div key={o.id}>
              <div onClick={()=>{setCurrentObra(o);setCurrentTorre(null);setCurrentPav(null);setActiveNF(null)}}
                style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',margin:'1px 6px',borderRadius:6,cursor:'pointer',fontSize:12,color:'#374151',background:currentObra?.id===o.id?'#e6f7f1':'transparent',fontWeight:currentObra?.id===o.id?500:400}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:o.cor,flexShrink:0}}/>{o.nome}
              </div>
              {currentObra?.id===o.id&&o.torres.map(t=>(
                <div key={t.id}>
                  <div onClick={()=>{setCurrentTorre(currentTorre?.id===t.id?null:t);setCurrentPav(null)}}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px 6px 22px',margin:'1px 6px',borderRadius:6,cursor:'pointer',fontSize:11,color:'#374151',background:currentTorre?.id===t.id?'#e6f7f1':'transparent'}}>
                    🏢 {t.nome}
                    <span style={{marginLeft:'auto',color:'#9ca3af',fontSize:10}}>{currentTorre?.id===t.id?'▾':'▸'}</span>
                  </div>
                  {currentTorre?.id===t.id&&t.pavimentos.map(p=>(
                    <div key={p.id} onClick={()=>setCurrentPav(currentPav?.id===p.id?null:p)}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px 5px 36px',margin:'1px 6px',borderRadius:6,cursor:'pointer',fontSize:11,
                        color:currentPav?.id===p.id?'#1D9E75':'#6b7280',fontWeight:currentPav?.id===p.id?500:400,background:currentPav?.id===p.id?'#e6f7f1':'transparent'}}>
                      {p.tipo==='especial'?'🔲':'📐'} {p.nome}
                      {/* indicador de planta carregada por pavimento */}
                      {localStorage.getItem(`cm_img_${o.id}_${t.id}_${p.id}`)&&
                        <span style={{marginLeft:'auto',fontSize:8,color:'#1D9E75'}}>●</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* CENTRO */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {!currentPav?(
            <div style={{flex:1,overflowY:'auto',padding:24}}>
              <div style={{fontSize:22,fontWeight:700,marginBottom:4}}>Rastreabilidade de Concretagem</div>
              <div style={{fontSize:13,color:'#6b7280',marginBottom:20}}>Selecione uma obra ou crie uma nova</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
                {obras.map(o=>(
                  <div key={o.id} onClick={()=>{setCurrentObra(o);setCurrentTorre(o.torres[0]);setCurrentPav(null)}}
                    style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:16,cursor:'pointer'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#1D9E75'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#e5e7eb'}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:o.cor}}/>
                      <div style={{fontSize:14,fontWeight:600}}>{o.nome}</div>
                    </div>
                    <div style={{fontSize:11,color:'#9ca3af',marginBottom:12}}>{o.endereco}</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>
                      {[['Torres',o.torres.length],['Pavimentos',o.torres[0]?.pavimentos.length||0],['NFs',(nfs[o.id]||[]).length],['Progresso',o.progresso+'%']].map(([l,v])=>(
                        <div key={l} style={{background:'#f9fafb',borderRadius:6,padding:'6px 8px'}}>
                          <div style={{fontSize:9,color:'#9ca3af',textTransform:'uppercase'}}>{l}</div>
                          <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{height:4,background:'#e5e7eb',borderRadius:2,overflow:'hidden'}}>
                      <div style={{height:'100%',background:o.cor,width:o.progresso+'%',borderRadius:2}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ):(
            <>
              {/* TABELA DE CONCRETAGEM */}
              <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',padding:'5px 12px',borderBottom:'1px solid #f3f4f6',gap:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:'#374151'}}>
                    {currentObra?.nome} · {currentTorre?.nome} · {currentPav?.nome}
                  </div>
                  <div style={{fontSize:10,color:'#9ca3af'}}>{new Date().toLocaleDateString('pt-BR')}</div>
                  <div style={{marginLeft:'auto',display:'flex',gap:5}}>
                    <div style={{display:'flex',background:'#f3f4f6',borderRadius:6,padding:2,gap:2}}>
                      {['parede','laje'].map(m=>(
                        <button key={m} onClick={()=>setViewMode(m)}
                          style={{padding:'3px 8px',borderRadius:4,fontSize:10,fontWeight:500,cursor:'pointer',border:'none',background:viewMode===m?'#fff':'transparent',color:viewMode===m?'#111827':'#6b7280',boxShadow:viewMode===m?'0 1px 3px rgba(0,0,0,.1)':'none'}}>
                          {m==='parede'?'Parede':'Laje/Teto'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tabela completa */}
                {nfsObra.length>0&&(
                  <div style={{overflowX:'auto',maxHeight:140}}>
                    <table style={{borderCollapse:'collapse',fontSize:9,width:'100%',minWidth:800}}>
                      <thead style={{position:'sticky',top:0,zIndex:1}}>
                        <tr>
                          <td style={{padding:'4px 8px',background:'#f5f5f5',fontWeight:600,color:'#666',fontSize:8,border:'1px solid #e5e7eb',writingMode:'vertical-rl',transform:'rotate(180deg)',width:28,textAlign:'center',whiteSpace:'nowrap'}}>
                            CONCRETAGEM
                          </td>
                          {nfsObra.map(nf=>(
                            <td key={nf.id} style={{padding:'3px 8px',textAlign:'center',border:'1px solid #e5e7eb',fontWeight:700,fontSize:9,background:nf.cor,color:'#333',minWidth:70,whiteSpace:'nowrap',cursor:'pointer'}}
                              onClick={()=>abrirModalNF(nf)} title="Clique para editar">
                              {nf.numero} ✏️
                            </td>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TABELA_CAMPOS.map(({key,label})=>(
                          <tr key={key}>
                            <td style={{padding:'2px 8px',background:'#f9f9f9',fontWeight:500,color:'#555',fontSize:8,border:'1px solid #e5e7eb',whiteSpace:'nowrap'}}>{label}</td>
                            {nfsObra.map(nf=>(
                              <td key={nf.id} style={{padding:'2px 8px',textAlign:'center',border:'1px solid #e5e7eb',fontSize:9,color:'#333',background:nf===activeNF?nf.cor+'22':'#fff',cursor:'pointer'}}
                                onClick={()=>abrirModalNF(nf)}>
                                {key==='data'&&nf[key]?new Date(nf[key]+'T00:00:00').toLocaleDateString('pt-BR'):nf[key]||'—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* TOOLBAR */}
              <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:'4px 10px',gap:6,flexShrink:0,flexWrap:'wrap'}}>
                {[['pen','🖌️','Pincel'],['erase','🧹','Borracha'],['pan','✋','Mover']].map(([t,ico,lb])=>(
                  <button key={t} onClick={()=>setTool(t)}
                    style={{display:'flex',alignItems:'center',gap:4,padding:'4px 9px',borderRadius:6,cursor:'pointer',border:`1px solid ${tool===t?'#1D9E75':'#e5e7eb'}`,background:tool===t?'#e6f7f1':'transparent',fontSize:11,fontWeight:500,color:tool===t?'#1D9E75':'#374151'}}>
                    {ico} {lb}
                  </button>
                ))}
                <div style={{width:1,height:20,background:'#e5e7eb'}}/>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontSize:9,color:'#6b7280'}}>Tamanho:</span>
                  {[8,16,28,48].map(s=>(
                    <button key={s} onClick={()=>setBrushSize(s)}
                      style={{width:24,height:24,borderRadius:'50%',border:`2px solid ${s===brushSize?'#1D9E75':'#e5e7eb'}`,background:s===brushSize?'#e6f7f1':'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <div style={{width:Math.max(3,s/6),height:Math.max(3,s/6),borderRadius:'50%',background:'#374151'}}/>
                    </button>
                  ))}
                </div>
                <div style={{width:1,height:20,background:'#e5e7eb'}}/>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontSize:9,color:'#6b7280'}}>Opac.:</span>
                  <input type="range" min="20" max="90" value={Math.round(opacity*100)} onChange={e=>setOpacity(parseInt(e.target.value)/100)} style={{width:60,cursor:'pointer'}}/>
                  <span style={{fontSize:9,color:'#374151',minWidth:26}}>{Math.round(opacity*100)}%</span>
                </div>
                <div style={{width:1,height:20,background:'#e5e7eb'}}/>
                {/* Upload planta por pavimento */}
                <label style={{display:'flex',alignItems:'center',gap:4,padding:'4px 9px',background:plantaImg?'#e6f7f1':'#fff',border:`1px solid ${plantaImg?'#1D9E75':'#e5e7eb'}`,borderRadius:6,fontSize:10,cursor:'pointer',fontWeight:500,color:plantaImg?'#1D9E75':'#374151',whiteSpace:'nowrap'}}>
                  {plantaImg?'🖼️ Trocar planta':'📁 Planta deste pav.'}
                  <input type="file" accept="image/*" onChange={e=>{
                    const f=e.target.files[0];if(!f||!currentObra) return
                    const r=new FileReader();r.onload=ev=>salvarPlantaImg(ev.target.result);r.readAsDataURL(f)
                  }} style={{display:'none'}}/>
                </label>
                <button onClick={exportarPDF} style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:4,padding:'4px 9px',borderRadius:6,cursor:'pointer',border:'1px solid #e5e7eb',background:'#fff',fontSize:10,fontWeight:500,color:'#374151'}}>
                  📄 PDF
                </button>
              </div>

              {/* CANVAS */}
              <PlantaCanvas
                key={`${plantaKey}_${refresh}`}
                plantaKey={plantaKey}
                plantaImg={plantaImg}
                activeNF={activeNF}
                tool={tool}
                brushSize={brushSize}
                opacity={opacity}
                onCanvasReady={(bg,paint)=>{canvasRefs.current={bg,paint}}}
                onUpload={salvarPlantaImg}
              />
            </>
          )}
        </div>

        {/* SIDEBAR DIREITA */}
        {currentObra&&(
          <div style={{width:210,background:'#fff',borderLeft:'1px solid #e5e7eb',display:'flex',flexDirection:'column',flexShrink:0}}>
            <div style={{padding:'10px 12px 6px',borderBottom:'1px solid #f3f4f6'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>Notas Fiscais</div>
              <div style={{fontSize:9,color:'#9ca3af',marginTop:1}}>Clique para selecionar · ✏️ para editar</div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:6}}>
              {nfsObra.length===0&&(
                <div style={{padding:16,textAlign:'center',color:'#9ca3af',fontSize:11}}>Nenhuma NF.<br/>Clique em "+ Nova NF"</div>
              )}
              {nfsObra.map(nf=>(
                <div key={nf.id}
                  style={{border:`1.5px solid ${activeNF?.id===nf.id?'#1D9E75':'#e5e7eb'}`,borderRadius:8,padding:'7px 8px 7px 12px',marginBottom:5,position:'relative',background:activeNF?.id===nf.id?'#e6f7f1':'#fff',transition:'all .1s'}}>
                  <div style={{position:'absolute',left:0,top:0,bottom:0,width:4,background:nf.cor,borderRadius:'6px 0 0 6px'}}/>
                  <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                    <div style={{width:10,height:10,borderRadius:2,background:nf.cor,flexShrink:0,cursor:'pointer'}} onClick={()=>setActiveNF(activeNF?.id===nf.id?null:nf)}/>
                    <div style={{fontSize:11,fontWeight:600,cursor:'pointer',flex:1}} onClick={()=>setActiveNF(activeNF?.id===nf.id?null:nf)}>NF {nf.numero}</div>
                    {activeNF?.id===nf.id&&<span style={{fontSize:8,background:'#1D9E75',color:'#fff',padding:'1px 5px',borderRadius:8}}>ATIVA</span>}
                  </div>
                  <div style={{fontSize:9,color:'#6b7280',cursor:'pointer'}} onClick={()=>setActiveNF(activeNF?.id===nf.id?null:nf)}>
                    C{nf.fck} · {nf.slump}cm · {nf.volume}m³
                  </div>
                  {nf.placa&&<div style={{fontSize:9,color:'#9ca3af'}}>{nf.placa} · {nf.horario||''}</div>}
                  {/* Botões ação */}
                  <div style={{display:'flex',gap:4,marginTop:5}}>
                    <button onClick={()=>abrirModalNF(nf)}
                      style={{flex:1,padding:'3px 0',border:'1px solid #e5e7eb',borderRadius:5,background:'#f9fafb',cursor:'pointer',fontSize:10,color:'#374151',display:'flex',alignItems:'center',justifyContent:'center',gap:3}}>
                      ✏️ Editar
                    </button>
                    <button onClick={()=>excluirNF(nf.id)}
                      style={{padding:'3px 8px',border:'1px solid #fecaca',borderRadius:5,background:'#fff',cursor:'pointer',fontSize:10,color:'#ef4444'}}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={()=>abrirModalNF()}
                style={{width:'100%',padding:7,borderRadius:8,border:'1.5px dashed #d1d5db',background:'transparent',color:'#6b7280',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,fontFamily:'inherit',marginTop:3}}>
                + Nova NF
              </button>
            </div>
            {nfsObra.length>0&&(
              <div style={{padding:'8px 12px',borderTop:'1px solid #f3f4f6'}}>
                <div style={{fontSize:9,fontWeight:500,color:'#9ca3af',marginBottom:4}}>Legenda</div>
                {nfsObra.map(nf=>(
                  <div key={nf.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:9,color:'#6b7280',marginBottom:3}}>
                    <div style={{width:10,height:10,borderRadius:2,background:nf.cor,flexShrink:0}}/>
                    NF {nf.numero} · {nf.volume||'—'}m³
                    {nf.data&&<span style={{marginLeft:'auto',color:'#bbb'}}>{new Date(nf.data+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span>}
                  </div>
                ))}
                <div style={{marginTop:5,padding:'4px 8px',background:'#f9fafb',borderRadius:5,fontSize:9}}>
                  <span style={{fontWeight:500}}>{nfsObra.length} NFs · </span>
                  {nfsObra.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0).toFixed(1)} m³
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* STATUS BAR */}
      <div style={{height:26,background:'#fff',borderTop:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:'0 12px',gap:14,fontSize:9,color:'#6b7280',flexShrink:0}}>
        <span style={{display:'flex',alignItems:'center',gap:3}}><span style={{width:5,height:5,borderRadius:'50%',background:'#1D9E75',display:'inline-block'}}/>Online</span>
        <span>{activeNF?`🖌️ NF ${activeNF.numero} ativa — pintando`:'Selecione uma NF para pintar'}</span>
        <span style={{marginLeft:'auto'}}>✓ Salvo automaticamente</span>
      </div>

      {/* MODAL NF (nova + edição) */}
      {modalNF&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:22,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <div style={{fontSize:15,fontWeight:600}}>{editingNF?'Editar NF':'Cadastrar NF'}</div>
                <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{currentObra?.nome} {editingNF?`· NF ${editingNF.numero}`:''}</div>
              </div>
              <button onClick={()=>setModalNF(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>

            {/* Se editando, mostra a cor atual */}
            {editingNF&&(
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,padding:'8px 12px',background:editingNF.cor+'22',borderRadius:8,border:`1px solid ${editingNF.cor}`}}>
                <div style={{width:16,height:16,borderRadius:4,background:editingNF.cor}}/>
                <span style={{fontSize:11,fontWeight:500}}>NF {editingNF.numero} — cor atribuída automaticamente</span>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[
                ['Número da NF *','numero','text','Ex: 9445'],
                ['Data da concretagem','data','date',''],
                ['Concreteira','concreteira','text','Nome da usina'],
                ['Caminhão (BT)','caminhao','text','Ex: BT 68'],
                ['Placa do caminhão','placa','text','Ex: ABC-1234'],
                ['fck (MPa)','fck','text','Ex: 25'],
                ['Slump (cm)','slump','text','Ex: 22'],
                ['Volume (m³)','volume','text','Ex: 7,0'],
                ['Hora chegada BT','horario','time',''],
                ['Início descarga','inicioDescarga','time',''],
                ['Hora moldagem CP','horaMoldagem','time',''],
                ['Fim descarga','fimDescarga','time',''],
              ].map(([lb,k,t,ph])=>(
                <div key={k}>
                  <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
                  <input type={t} value={formNF[k]||''} onChange={e=>setFormNF(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                    style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                </div>
              ))}
            </div>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
              <button onClick={()=>setModalNF(false)} style={{padding:'8px 16px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12}}>Cancelar</button>
              {editingNF&&(
                <button onClick={()=>{excluirNF(editingNF.id);setModalNF(false)}}
                  style={{padding:'8px 16px',border:'1px solid #fecaca',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12,color:'#ef4444'}}>
                  Excluir NF
                </button>
              )}
              <button onClick={salvarNF} style={{padding:'8px 16px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}}>
                {editingNF?'Salvar alterações':'Cadastrar NF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA OBRA */}
      {modalObra&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:22,width:'100%',maxWidth:420}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:600}}>Nova Obra</div>
              <button onClick={()=>setModalObra(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>
            {[['Nome da Obra *','nome','text','Ex: Vila do Paraíso'],['Endereço','endereco','text','Rua, número']].map(([lb,k,t,ph])=>(
              <div key={k} style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
                <input value={novaObra[k]||''} onChange={e=>setNovaObra(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                  style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
              </div>
            ))}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
              {[['Nº de Torres','torres'],['Nº de Pavimentos','pavimentos']].map(([lb,k])=>(
                <div key={k}>
                  <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
                  <input type="number" min="1" value={novaObra[k]} onChange={e=>setNovaObra(p=>({...p,[k]:parseInt(e.target.value)||1}))}
                    style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalObra(false)} style={{padding:'8px 16px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12}}>Cancelar</button>
              <button onClick={criarObra} style={{padding:'8px 16px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}}>Criar Obra</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RELATÓRIOS */}
      {modalRel&&currentObra&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:22,width:'100%',maxWidth:600,maxHeight:'88vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div>
                <div style={{fontSize:15,fontWeight:600}}>Relatórios — {currentObra.nome}</div>
                <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>NFs agrupadas por data</div>
              </div>
              <button onClick={()=>setModalRel(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
              {[['Total de NFs',nfsObra.length],['Volume total',nfsObra.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0).toFixed(1)+' m³'],['Dias de concretagem',new Set(nfsObra.map(n=>n.data||'').filter(Boolean)).size]].map(([l,v])=>(
                <div key={l} style={{background:'#f9fafb',borderRadius:8,padding:'8px 12px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:'#9ca3af',textTransform:'uppercase',marginBottom:3}}>{l}</div>
                  <div style={{fontSize:18,fontWeight:700,color:'#111827'}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{flex:1,overflowY:'auto'}}>
              {getRelatorios().length===0&&<div style={{textAlign:'center',padding:24,color:'#9ca3af',fontSize:13}}>Nenhuma NF cadastrada</div>}
              {getRelatorios().map(([data,lista])=>(
                <div key={data} style={{marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>
                      📅 {data!=='Sem data'?new Date(data+'T00:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}):data}
                    </div>
                    <div style={{fontSize:10,color:'#9ca3af'}}>{lista.length} NFs · {lista.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0).toFixed(1)}m³</div>
                  </div>
                  <div style={{border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
                      <thead>
                        <tr style={{background:'#f9fafb'}}>
                          {['NF','Placa','Vol.','fck','Slump','Chegada','Início','Moldagem','Fim','Concreteira'].map(h=>(
                            <th key={h} style={{padding:'5px 7px',textAlign:'left',fontWeight:500,color:'#6b7280',fontSize:9,borderBottom:'1px solid #e5e7eb'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map(nf=>(
                          <tr key={nf.id} style={{cursor:'pointer'}} onClick={()=>{setModalRel(false);abrirModalNF(nf)}}>
                            <td style={{padding:'4px 7px',borderBottom:'1px solid #f3f4f6'}}>
                              <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                                <div style={{width:9,height:9,borderRadius:2,background:nf.cor}}/>
                                <strong>{nf.numero}</strong>
                              </span>
                            </td>
                            <td style={{padding:'4px 7px',borderBottom:'1px solid #f3f4f6'}}>{nf.placa||'—'}</td>
                            <td style={{padding:'4px 7px',borderBottom:'1px solid #f3f4f6'}}>{nf.volume||'—'}m³</td>
                            <td style={{padding:'4px 7px',borderBottom:'1px solid #f3f4f6'}}>C{nf.fck||'—'}</td>
                            <td style={{padding:'4px 7px',borderBottom:'1px solid #f3f4f6'}}>{nf.slump||'—'}cm</td>
                            <td style={{padding:'4px 7px',borderBottom:'1px solid #f3f4f6'}}>{nf.horario||'—'}</td>
                            <td style={{padding:'4px 7px',borderBottom:'1px solid #f3f4f6'}}>{nf.inicioDescarga||'—'}</td>
                            <td style={{padding:'4px 7px',borderBottom:'1px solid #f3f4f6'}}>{nf.horaMoldagem||'—'}</td>
                            <td style={{padding:'4px 7px',borderBottom:'1px solid #f3f4f6'}}>{nf.fimDescarga||'—'}</td>
                            <td style={{padding:'4px 7px',borderBottom:'1px solid #f3f4f6'}}>{nf.concreteira||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12,paddingTop:12,borderTop:'1px solid #f3f4f6'}}>
              <button onClick={()=>setModalRel(false)} style={{padding:'7px 16px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12}}>Fechar</button>
              <button onClick={()=>{setModalRel(false);exportarPDF()}} style={{padding:'7px 16px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}}>📄 Exportar PDF</button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:'fixed',bottom:20,right:20,background:'#1f2937',color:'#fff',padding:'10px 16px',borderRadius:8,fontSize:12,fontWeight:500,zIndex:2000}}>
          {toast}
        </div>
      )}
    </div>
  )
}

/* ══ PLANTA CANVAS ══ */
function PlantaCanvas({ plantaKey, plantaImg, activeNF, tool, brushSize, opacity, onUpload, onCanvasReady }) {
  const bgRef=useRef(null), paintRef=useRef(null), wrapperRef=useRef(null)
  const zoomRef=useRef(1), panRef=useRef({x:0,y:0})
  const [zoomPct,setZoomPct]=useState(100)
  const isPainting=useRef(false), isPanning=useRef(false)
  const lastMouse=useRef({x:0,y:0}), lastPaintPos=useRef(null)
  const CW=1200,CH=700

  useEffect(()=>{ if(bgRef.current&&paintRef.current&&onCanvasReady) onCanvasReady(bgRef.current,paintRef.current) },[])

  useEffect(()=>{
    if(!plantaImg) return
    const img=new Image()
    img.onload=()=>{
      const ctx=bgRef.current?.getContext('2d'); if(!ctx) return
      ctx.clearRect(0,0,CW,CH); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,CW,CH)
      const sc=Math.min(CW/img.width,CH/img.height)*0.95
      ctx.drawImage(img,(CW-img.width*sc)/2,(CH-img.height*sc)/2,img.width*sc,img.height*sc)
    }
    img.src=plantaImg
  },[plantaImg])

  useEffect(()=>{
    if(!plantaKey||!paintRef.current) return
    const ctx=paintRef.current.getContext('2d'); ctx.clearRect(0,0,CW,CH)
    const saved=localStorage.getItem(plantaKey); if(!saved) return
    const img=new Image(); img.onload=()=>ctx.drawImage(img,0,0); img.src=saved
  },[plantaKey])

  function applyT(){ if(wrapperRef.current) wrapperRef.current.style.transform=`translate(${panRef.current.x}px,${panRef.current.y}px) scale(${zoomRef.current})`; setZoomPct(Math.round(zoomRef.current*100)) }
  function save(){ if(!paintRef.current||!plantaKey) return; localStorage.setItem(plantaKey,paintRef.current.toDataURL('image/png')) }

  function toCanvas(sx,sy){
    const el=bgRef.current?.parentElement?.parentElement; if(!el) return{x:0,y:0}
    const r=el.getBoundingClientRect()
    return{x:(sx-r.left-panRef.current.x)/zoomRef.current,y:(sy-r.top-panRef.current.y)/zoomRef.current}
  }
  function getXY(e){ return e.touches?{x:e.touches[0].clientX,y:e.touches[0].clientY}:{x:e.clientX,y:e.clientY} }

  function paintAt(pos){
    const c=paintRef.current; if(!c) return
    const ctx=c.getContext('2d')
    const alpha=Math.round(opacity*255).toString(16).padStart(2,'0')
    if(tool==='erase'){
      ctx.globalCompositeOperation='destination-out'
      ctx.beginPath(); ctx.arc(pos.x,pos.y,brushSize*1.5,0,Math.PI*2)
      ctx.fillStyle='rgba(0,0,0,1)'; ctx.fill()
      ctx.globalCompositeOperation='source-over'
    } else if(tool==='pen'&&activeNF){
      ctx.globalCompositeOperation='source-over'
      ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=brushSize; ctx.strokeStyle=activeNF.cor+alpha
      if(lastPaintPos.current){ ctx.beginPath(); ctx.moveTo(lastPaintPos.current.x,lastPaintPos.current.y); ctx.lineTo(pos.x,pos.y); ctx.stroke() }
      else { ctx.beginPath(); ctx.arc(pos.x,pos.y,brushSize/2,0,Math.PI*2); ctx.fillStyle=activeNF.cor+alpha; ctx.fill() }
    }
    lastPaintPos.current=pos
  }

  function onDown(e){ e.preventDefault(); const xy=getXY(e); lastMouse.current=xy
    if(tool==='pan'){isPanning.current=true;return}
    if(tool==='pen'&&!activeNF) return
    isPainting.current=true; lastPaintPos.current=null; paintAt(toCanvas(xy.x,xy.y))
  }
  function onMove(e){ e.preventDefault(); const xy=getXY(e)
    if(isPanning.current){ panRef.current={x:panRef.current.x+(xy.x-lastMouse.current.x),y:panRef.current.y+(xy.y-lastMouse.current.y)}; lastMouse.current=xy; applyT(); return }
    if(isPainting.current){ paintAt(toCanvas(xy.x,xy.y)); lastMouse.current=xy }
  }
  function onUp(){ if(isPainting.current) save(); isPainting.current=false; isPanning.current=false; lastPaintPos.current=null }
  function onWheel(e){ e.preventDefault(); const f=e.deltaY<0?1.12:0.9
    const el=bgRef.current?.parentElement?.parentElement; if(!el) return
    const r=el.getBoundingClientRect(); const mx=e.clientX-r.left,my=e.clientY-r.top
    const nz=Math.max(0.15,Math.min(8,zoomRef.current*f))
    panRef.current={x:mx-(mx-panRef.current.x)*(nz/zoomRef.current),y:my-(my-panRef.current.y)*(nz/zoomRef.current)}
    zoomRef.current=nz; applyT()
  }
  function limpar(){ if(!window.confirm('Limpar toda a pintura?')) return; paintRef.current?.getContext('2d')?.clearRect(0,0,CW,CH); if(plantaKey) localStorage.removeItem(plantaKey) }

  if(!plantaImg) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f7f4'}}>
      <div style={{textAlign:'center',padding:40,maxWidth:360}}>
        <div style={{fontSize:56,marginBottom:16}}>🖼️</div>
        <div style={{fontSize:18,fontWeight:600,color:'#374151',marginBottom:8}}>Carregar planta deste pavimento</div>
        <div style={{fontSize:13,color:'#6b7280',marginBottom:4}}>Cada pavimento pode ter sua própria planta</div>
        <div style={{fontSize:12,color:'#9ca3af',marginBottom:24}}>Aceita JPG ou PNG</div>
        <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 28px',background:'#1D9E75',color:'#fff',borderRadius:8,fontSize:14,cursor:'pointer',fontWeight:500}}>
          📁 Selecionar imagem
          <input type="file" accept="image/*" onChange={e=>{ const f=e.target.files[0];if(!f) return; const r=new FileReader();r.onload=ev=>onUpload(ev.target.result);r.readAsDataURL(f) }} style={{display:'none'}}/>
        </label>
      </div>
    </div>
  )

  return (
    <div style={{flex:1,overflow:'hidden',background:'#e8e5de',position:'relative',cursor:tool==='pan'?'grab':'crosshair',userSelect:'none',touchAction:'none'}}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} onWheel={onWheel}>
      {activeNF&&<div style={{position:'absolute',top:10,left:10,zIndex:10,background:activeNF.cor,padding:'4px 12px',borderRadius:6,fontSize:11,fontWeight:700,color:'#333',pointerEvents:'none'}}>🖌️ NF {activeNF.numero}</div>}
      {tool==='pan'&&<div style={{position:'absolute',top:10,left:10,zIndex:10,background:'#fff',padding:'4px 12px',borderRadius:6,fontSize:10,color:'#374151',border:'1px solid #e5e7eb',pointerEvents:'none'}}>✋ Arraste para mover</div>}
      <div style={{position:'absolute',top:10,right:10,zIndex:10,display:'flex',gap:3}}>
        {[['＋',()=>{zoomRef.current=Math.min(8,zoomRef.current*1.2);applyT()}],['－',()=>{zoomRef.current=Math.max(.15,zoomRef.current*0.83);applyT()}],['⊡',()=>{zoomRef.current=1;panRef.current={x:0,y:0};applyT()}]].map(([ico,fn])=>(
          <button key={ico} onClick={fn} style={{width:30,height:30,border:'1px solid #e5e7eb',borderRadius:5,background:'#fff',cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center'}}>{ico}</button>
        ))}
        <span style={{padding:'0 8px',background:'#fff',border:'1px solid #e5e7eb',borderRadius:5,fontSize:10,display:'flex',alignItems:'center',color:'#6b7280',minWidth:46,justifyContent:'center'}}>{zoomPct}%</span>
        <button onClick={limpar} style={{padding:'0 8px',border:'1px solid #fecaca',borderRadius:5,background:'#fff',cursor:'pointer',fontSize:10,color:'#ef4444',display:'flex',alignItems:'center',gap:3}}>🗑️ Limpar</button>
      </div>
      <div ref={wrapperRef} style={{position:'absolute',top:0,left:0,width:CW,height:CH,transformOrigin:'0 0',boxShadow:'0 4px 20px rgba(0,0,0,.15)'}}>
        <canvas ref={bgRef} width={CW} height={CH} style={{position:'absolute',top:0,left:0,pointerEvents:'none'}}/>
        <canvas ref={paintRef} width={CW} height={CH} style={{position:'absolute',top:0,left:0,pointerEvents:'none'}}/>
      </div>
    </div>
  )
}
