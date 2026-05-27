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

// ── GERADOR DE PDF ──────────────────────────────────────────
async function gerarPDF(obra, torre, pav, nfs, paintCanvas, bgCanvas, viewMode) {
  // Carrega jsPDF dinamicamente
  if(!window.jspdf) {
    await new Promise((res,rej)=>{
      const s=document.createElement('script')
      s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload=res; s.onerror=rej
      document.head.appendChild(s)
    })
  }
  const { jsPDF } = window.jspdf
  const pdf = new jsPDF('landscape','mm','a4')
  const PW = pdf.internal.pageSize.getWidth()
  const PH = pdf.internal.pageSize.getHeight()

  // ── CABEÇALHO ──
  pdf.setFillColor(29,158,117)
  pdf.rect(0,0,PW,14,'F')
  pdf.setTextColor(255,255,255)
  pdf.setFontSize(13)
  pdf.setFont('helvetica','bold')
  pdf.text('MAPEAMENTO DE CONCRETO — ESTRUTURA',PW/2,9,{align:'center'})
  pdf.setFontSize(8)
  pdf.text('ConcreteMap',PW-10,9,{align:'right'})

  // ── DADOS DA OBRA ──
  pdf.setTextColor(50,50,50)
  pdf.setFontSize(9)
  pdf.setFont('helvetica','normal')
  const hoje = new Date().toLocaleDateString('pt-BR')
  const hora = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
  pdf.text(`Obra: ${obra.nome}`,10,20)
  pdf.text(`Torre: ${torre.nome}`,10,25)
  pdf.text(`Pavimento: ${pav.nome}`,10,30)
  pdf.text(`Modo: ${viewMode==='parede'?'Parede':'Laje/Teto'}`,10,35)
  pdf.text(`Data: ${hoje}  Hora: ${hora}`,PW-10,20,{align:'right'})
  pdf.setFont('helvetica','bold')
  pdf.text(`Total de NFs: ${nfs.length}`,PW-10,25,{align:'right'})
  const totalVol = nfs.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0)
  pdf.text(`Volume total: ${totalVol.toFixed(1)} m³`,PW-10,30,{align:'right'})

  // ── LINHA SEPARADORA ──
  pdf.setDrawColor(200,200,200)
  pdf.setLineWidth(0.3)
  pdf.line(10,38,PW-10,38)

  // ── TABELA DE NFs ──
  const cols = ['NF','Concreteira','fck','Slump','Volume','Horário']
  const colW = [22,50,16,16,18,18]
  let tx = 10, ty = 42
  pdf.setFillColor(245,245,245)
  pdf.rect(tx,ty-4,colW.reduce((a,b)=>a+b,0),6,'F')
  pdf.setFont('helvetica','bold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(80,80,80)
  cols.forEach((c,i)=>{
    pdf.text(c, tx+2, ty)
    tx += colW[i]
  })
  ty += 3
  nfs.forEach((nf,idx)=>{
    tx = 10
    pdf.setFont('helvetica','normal')
    pdf.setFontSize(7.5)
    // Cor da NF na primeira célula
    const rgb = hexToRgb(nf.cor)
    pdf.setFillColor(rgb[0],rgb[1],rgb[2])
    pdf.rect(tx,ty-3,colW[0],5.5,'F')
    pdf.setTextColor(40,40,40)
    const row = [nf.numero, nf.concreteira||'—', `C${nf.fck||'—'}`, `${nf.slump||'—'}cm`, `${nf.volume||'—'}m³`, nf.horario||'—']
    row.forEach((v,i)=>{
      if(i>0) pdf.text(v, tx+2, ty)
      tx += colW[i]
    })
    // Texto da NF sobre a cor
    pdf.setTextColor(40,40,40)
    pdf.text(nf.numero, 12, ty)
    ty += 5.5
    pdf.setDrawColor(230,230,230)
    pdf.setLineWidth(0.1)
    pdf.line(10,ty-1,10+colW.reduce((a,b)=>a+b,0),ty-1)
  })

  // ── PLANTA COLORIDA ──
  if(bgCanvas && paintCanvas){
    // Compositar fundo + pintura num canvas temporário
    const tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = bgCanvas.width
    tmpCanvas.height = bgCanvas.height
    const tmpCtx = tmpCanvas.getContext('2d')
    tmpCtx.drawImage(bgCanvas,0,0)
    tmpCtx.drawImage(paintCanvas,0,0)
    const imgData = tmpCanvas.toDataURL('image/jpeg',0.92)

    const imgY = ty + 3
    const imgH = PH - imgY - 20
    const imgW = PW - 20
    pdf.addImage(imgData,'JPEG',10,imgY,imgW,imgH)
  }

  // ── LEGENDA ──
  const legY = PH - 14
  pdf.setFillColor(250,250,250)
  pdf.rect(0,legY-2,PW,16,'F')
  pdf.setDrawColor(220,220,220)
  pdf.line(0,legY-2,PW,legY-2)
  pdf.setFontSize(7)
  pdf.setFont('helvetica','bold')
  pdf.setTextColor(100,100,100)
  pdf.text('LEGENDA:',10,legY+3)
  let lx=32
  nfs.forEach(nf=>{
    const rgb=hexToRgb(nf.cor)
    pdf.setFillColor(rgb[0],rgb[1],rgb[2])
    pdf.rect(lx,legY,10,5,'F')
    pdf.setFont('helvetica','normal')
    pdf.setTextColor(50,50,50)
    pdf.text(`NF ${nf.numero} (${nf.volume||'—'}m³)`,lx+12,legY+4)
    lx+=52
    if(lx>PW-60){lx=32}
  })

  // ── RODAPÉ ──
  pdf.setFontSize(6)
  pdf.setTextColor(180,180,180)
  pdf.text(`ConcreteMap · ${obra.nome} · ${torre.nome} · ${pav.nome} · Gerado em ${hoje} ${hora}`,PW/2,PH-2,{align:'center'})

  const fname=`MC_${obra.nome.replace(/\s/g,'_')}_${torre.nome}_${pav.nome}_${hoje.replace(/\//g,'')}.pdf`
  pdf.save(fname)
}

function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16)||0
  const g=parseInt(hex.slice(3,5),16)||0
  const b=parseInt(hex.slice(5,7),16)||0
  return[r,g,b]
}

export default function App() {
  const [obras, setObras] = useState(()=>{
    try{const s=localStorage.getItem('cm_obras_v6');return s?JSON.parse(s):OBRAS_INICIAIS}catch{return OBRAS_INICIAIS}
  })
  const [nfs, setNfs] = useState(()=>{
    try{const s=localStorage.getItem('cm_nfs_v6');return s?JSON.parse(s):{
      obra1:[
        {id:'nf1',numero:'9445',fck:'25',slump:'24',volume:'7,0',concreteira:'Concrecity',horario:'15:19',cor:'#FFE44A'},
        {id:'nf2',numero:'9446',fck:'25',slump:'25',volume:'7,0',concreteira:'Concrecity',horario:'16:01',cor:'#FF9B3D'},
        {id:'nf3',numero:'9447',fck:'25',slump:'24',volume:'7,0',concreteira:'Concrecity',horario:'16:20',cor:'#4DC8F0'},
        {id:'nf4',numero:'9449',fck:'25',slump:'24.5',volume:'7,0',concreteira:'Concrecity',horario:'17:35',cor:'#5EE07A'},
        {id:'nf5',numero:'9450',fck:'25',slump:'25',volume:'6,0',concreteira:'Concrecity',horario:'18:31',cor:'#F4A0C0'},
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
  const [novaObra, setNovaObra] = useState({nome:'',endereco:'',torres:1,pavimentos:5})
  const [novaNF, setNovaNF] = useState({numero:'',fck:'',slump:'',volume:'',concreteira:'',horario:'',data:new Date().toISOString().slice(0,10)})
  const [toast, setToast] = useState('')
  const [refresh, setRefresh] = useState(0)
  const canvasRefs = useRef({bg:null,paint:null})

  useEffect(()=>{localStorage.setItem('cm_obras_v6',JSON.stringify(obras))},[obras])
  useEffect(()=>{localStorage.setItem('cm_nfs_v6',JSON.stringify(nfs))},[nfs])

  function showToast(msg,dur=2500){setToast(msg);setTimeout(()=>setToast(''),dur)}

  function getPlantaKey(){
    if(!currentObra||!currentTorre||!currentPav) return null
    return `cm_paint_${currentObra.id}_${currentTorre.id}_${currentPav.id}_${viewMode}`
  }

  function getPlantaImg(){
    if(!currentObra||!currentPav) return null
    const isEspecial=currentPav?.tipo==='especial'
    if(isEspecial) return localStorage.getItem(`cm_img_${currentObra.id}_especial`)||localStorage.getItem(`cm_img_${currentObra.id}_padrao`)
    return localStorage.getItem(`cm_img_${currentObra.id}_padrao`)
  }

  function salvarPlantaImg(dataUrl,tipo){
    if(!currentObra) return
    localStorage.setItem(`cm_img_${currentObra.id}_${tipo}`,dataUrl)
    setRefresh(r=>r+1)
    showToast('Planta carregada! ✓')
  }

  async function exportarPDF(){
    const nfsObra = currentObra?(nfs[currentObra.id]||[]):[]
    if(!currentObra||!currentTorre||!currentPav){showToast('Selecione um pavimento');return}
    showToast('Gerando PDF... aguarde',4000)
    await gerarPDF(
      currentObra,currentTorre,currentPav,nfsObra,
      canvasRefs.current.paint,canvasRefs.current.bg,viewMode
    )
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

  function criarNF(){
    if(!novaNF.numero.trim()){showToast('Informe o número da NF');return}
    if(!currentObra){showToast('Selecione uma obra');return}
    const lista=nfs[currentObra.id]||[]
    const cor=NF_COLORS[lista.length%NF_COLORS.length]
    const nf={id:'nf'+Date.now(),...novaNF,cor}
    setNfs(p=>({...p,[currentObra.id]:[...(p[currentObra.id]||[]),nf]}))
    setModalNF(false)
    setNovaNF({numero:'',fck:'',slump:'',volume:'',concreteira:'',horario:'',data:new Date().toISOString().slice(0,10)})
    showToast(`NF ${nf.numero} cadastrada!`)
  }

  function excluirNF(nfId){
    if(!currentObra) return
    if(!window.confirm('Excluir esta NF?')) return
    setNfs(p=>({...p,[currentObra.id]:(p[currentObra.id]||[]).filter(n=>n.id!==nfId)}))
    if(activeNF?.id===nfId) setActiveNF(null)
    showToast('NF excluída')
  }

  const nfsObra=currentObra?(nfs[currentObra.id]||[]):[]
  const plantaImg=(currentPav&&refresh>=0)?getPlantaImg():null
  const plantaKey=getPlantaKey()

  // Relatórios: agrupar NFs por data
  function getRelatorios(){
    if(!currentObra) return []
    const lista=nfs[currentObra.id]||[]
    const grupos={}
    lista.forEach(n=>{
      const d=n.data||'Sem data'
      if(!grupos[d]) grupos[d]=[]
      grupos[d].push(n)
    })
    return Object.entries(grupos).sort((a,b)=>b[0].localeCompare(a[0]))
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:'system-ui,sans-serif',background:'#f8f7f4'}}>

      {/* TOPBAR */}
      <div style={{height:52,background:'#fff',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:'0 16px',gap:10,flexShrink:0}}>
        <div style={{fontSize:16,fontWeight:700,color:'#1D9E75',cursor:'pointer',whiteSpace:'nowrap'}}
          onClick={()=>{setCurrentObra(null);setCurrentTorre(null);setCurrentPav(null)}}>
          🏗️ ConcreteMap
        </div>
        <div style={{fontSize:11,color:'#9ca3af',flex:1,display:'flex',alignItems:'center',gap:4,overflow:'hidden'}}>
          {currentObra&&<span style={{color:'#374151',cursor:'pointer',whiteSpace:'nowrap'}} onClick={()=>{setCurrentObra(null);setCurrentTorre(null);setCurrentPav(null)}}>{currentObra.nome}</span>}
          {currentTorre&&<><span style={{color:'#d1d5db'}}> › </span><span style={{color:'#374151',whiteSpace:'nowrap'}}>{currentTorre.nome}</span></>}
          {currentPav&&<><span style={{color:'#d1d5db'}}> › </span><span style={{color:'#111827',fontWeight:500,whiteSpace:'nowrap'}}>{currentPav.nome}</span></>}
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          {currentObra&&<button onClick={()=>setModalRel(true)} style={{padding:'6px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
            📊 Relatórios
          </button>}
          {currentPav&&<button onClick={exportarPDF} style={{padding:'6px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
            📄 Exportar PDF
          </button>}
          {currentObra&&<button onClick={()=>setModalNF(true)} style={{padding:'6px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer'}}>
            + Nova NF
          </button>}
          <button onClick={()=>setModalObra(true)} style={{padding:'6px 12px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:500}}>
            + Nova Obra
          </button>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* SIDEBAR ESQUERDA */}
        <div style={{width:210,background:'#fff',borderRight:'1px solid #e5e7eb',overflowY:'auto',flexShrink:0}}>
          <div style={{padding:'8px 8px 4px',fontSize:10,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.06em'}}>Obras</div>
          {obras.map(o=>(
            <div key={o.id}>
              <div onClick={()=>{setCurrentObra(o);setCurrentTorre(null);setCurrentPav(null);setActiveNF(null)}}
                style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',margin:'1px 6px',borderRadius:6,cursor:'pointer',fontSize:12,
                  color:'#374151',background:currentObra?.id===o.id?'#e6f7f1':'transparent',fontWeight:currentObra?.id===o.id?500:400}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:o.cor,flexShrink:0}}/>
                {o.nome}
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
              {/* TABELA DE CONCRETAGEM — igual ao mapeamento impresso */}
              <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',flexShrink:0,overflowX:'auto'}}>
                {/* Cabeçalho da tabela */}
                <div style={{display:'flex',alignItems:'center',padding:'6px 12px',borderBottom:'1px solid #f3f4f6',gap:12}}>
                  <div style={{fontSize:11,fontWeight:600,color:'#374151'}}>
                    {currentObra?.nome} · {currentTorre?.nome} · {currentPav?.nome}
                  </div>
                  <div style={{fontSize:10,color:'#9ca3af'}}>
                    {new Date().toLocaleDateString('pt-BR')}
                  </div>
                  <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}>
                    {/* Modo parede/laje */}
                    <div style={{display:'flex',background:'#f3f4f6',borderRadius:6,padding:2,gap:2}}>
                      {['parede','laje'].map(m=>(
                        <button key={m} onClick={()=>setViewMode(m)}
                          style={{padding:'3px 9px',borderRadius:4,fontSize:10,fontWeight:500,cursor:'pointer',border:'none',
                            background:viewMode===m?'#fff':'transparent',color:viewMode===m?'#111827':'#6b7280',
                            boxShadow:viewMode===m?'0 1px 3px rgba(0,0,0,.1)':'none'}}>
                          {m==='parede'?'Parede':'Laje/Teto'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tabela de NFs — estilo mapeamento */}
                {nfsObra.length>0&&(
                  <div style={{overflowX:'auto'}}>
                    <table style={{borderCollapse:'collapse',fontSize:9,width:'100%',minWidth:600}}>
                      <thead>
                        <tr>
                          <td style={{padding:'4px 8px',background:'#f5f5f5',fontWeight:600,color:'#666',fontSize:8,borderRight:'1px solid #e5e7eb',writingMode:'vertical-rl',textOrientation:'mixed',transform:'rotate(180deg)',width:32,verticalAlign:'middle',textAlign:'center',border:'1px solid #e5e7eb'}}>
                            CONCRETAGEM
                          </td>
                          {nfsObra.map(nf=>(
                            <td key={nf.id} style={{padding:'3px 8px',textAlign:'center',border:'1px solid #e5e7eb',fontWeight:600,fontSize:9,background:nf.cor,color:'#333',minWidth:80}}>
                              {nf.numero}
                            </td>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['Volume (m³)','volume'],
                          ['Hora chegada BT','horario'],
                          ['fck','fck'],
                          ['Slump','slump'],
                          ['Concreteira','concreteira'],
                          ['Data','data'],
                        ].map(([label,campo])=>(
                          <tr key={campo}>
                            <td style={{padding:'3px 8px',background:'#f9f9f9',fontWeight:500,color:'#555',fontSize:8,border:'1px solid #e5e7eb',whiteSpace:'nowrap'}}>
                              {label}
                            </td>
                            {nfsObra.map(nf=>(
                              <td key={nf.id} style={{padding:'3px 8px',textAlign:'center',border:'1px solid #e5e7eb',fontSize:9,color:'#333',background:nf===activeNF?nf.cor+'22':'#fff'}}>
                                {campo==='data'&&nf[campo]?new Date(nf[campo]+'T00:00:00').toLocaleDateString('pt-BR'):nf[campo]||'—'}
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
              <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:'5px 12px',gap:8,flexShrink:0,flexWrap:'wrap'}}>
                {[['pen','🖌️','Pincel'],['erase','🧹','Borracha'],['pan','✋','Mover']].map(([t,ico,lb])=>(
                  <button key={t} onClick={()=>setTool(t)} title={lb}
                    style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:6,cursor:'pointer',border:`1px solid ${tool===t?'#1D9E75':'#e5e7eb'}`,
                      background:tool===t?'#e6f7f1':'transparent',fontSize:12,fontWeight:500,color:tool===t?'#1D9E75':'#374151'}}>
                    {ico} <span style={{fontSize:10}}>{lb}</span>
                  </button>
                ))}
                <div style={{width:1,height:20,background:'#e5e7eb'}}/>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontSize:10,color:'#6b7280'}}>Tamanho:</span>
                  {[8,16,28,48].map(s=>(
                    <button key={s} onClick={()=>setBrushSize(s)}
                      style={{width:26,height:26,borderRadius:'50%',border:`2px solid ${s===brushSize?'#1D9E75':'#e5e7eb'}`,background:s===brushSize?'#e6f7f1':'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <div style={{width:Math.max(3,s/6),height:Math.max(3,s/6),borderRadius:'50%',background:'#374151'}}/>
                    </button>
                  ))}
                </div>
                <div style={{width:1,height:20,background:'#e5e7eb'}}/>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontSize:10,color:'#6b7280'}}>Opacidade:</span>
                  <input type="range" min="20" max="90" value={Math.round(opacity*100)} onChange={e=>setOpacity(parseInt(e.target.value)/100)} style={{width:65,cursor:'pointer'}}/>
                  <span style={{fontSize:10,color:'#374151',minWidth:28}}>{Math.round(opacity*100)}%</span>
                </div>
                <div style={{width:1,height:20,background:'#e5e7eb'}}/>
                <label style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',background:plantaImg?'#e6f7f1':'#fff',border:`1px solid ${plantaImg?'#1D9E75':'#e5e7eb'}`,borderRadius:6,fontSize:10,cursor:'pointer',fontWeight:500,color:plantaImg?'#1D9E75':'#374151',whiteSpace:'nowrap'}}>
                  {plantaImg?'🖼️ Trocar':'📁 Carregar planta'}
                  <input type="file" accept="image/*" onChange={e=>{
                    const file=e.target.files[0];if(!file||!currentObra) return
                    const reader=new FileReader()
                    reader.onload=ev=>salvarPlantaImg(ev.target.result,currentPav?.tipo==='especial'?'especial':'padrao')
                    reader.readAsDataURL(file)
                  }} style={{display:'none'}}/>
                </label>
                <button onClick={exportarPDF}
                  style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:6,cursor:'pointer',border:'1px solid #e5e7eb',background:'#fff',fontSize:10,fontWeight:500,color:'#374151',marginLeft:'auto'}}>
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
                onCanvasReady={(bg,paint)=>{ canvasRefs.current={bg,paint} }}
                onUpload={dataUrl=>salvarPlantaImg(dataUrl,currentPav?.tipo==='especial'?'especial':'padrao')}
              />
            </>
          )}
        </div>

        {/* SIDEBAR DIREITA */}
        {currentObra&&(
          <div style={{width:215,background:'#fff',borderLeft:'1px solid #e5e7eb',display:'flex',flexDirection:'column',flexShrink:0}}>
            <div style={{padding:'10px 12px 6px',borderBottom:'1px solid #f3f4f6'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>Notas Fiscais</div>
              <div style={{fontSize:9,color:'#9ca3af',marginTop:1}}>Selecione para pintar</div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:6}}>
              {nfsObra.length===0&&(
                <div style={{padding:16,textAlign:'center',color:'#9ca3af',fontSize:11}}>
                  Nenhuma NF.<br/>Clique em "+ Nova NF"
                </div>
              )}
              {nfsObra.map(nf=>(
                <div key={nf.id} onClick={()=>setActiveNF(activeNF?.id===nf.id?null:nf)}
                  style={{border:`1.5px solid ${activeNF?.id===nf.id?'#1D9E75':'#e5e7eb'}`,borderRadius:8,
                    padding:'7px 8px 7px 12px',marginBottom:5,cursor:'pointer',background:activeNF?.id===nf.id?'#e6f7f1':'#fff',position:'relative',transition:'all .1s'}}>
                  <div style={{position:'absolute',left:0,top:0,bottom:0,width:4,background:nf.cor,borderRadius:'6px 0 0 6px'}}/>
                  <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                    <div style={{width:10,height:10,borderRadius:2,background:nf.cor,flexShrink:0}}/>
                    <div style={{fontSize:11,fontWeight:600}}>NF {nf.numero}</div>
                    {activeNF?.id===nf.id&&<span style={{marginLeft:'auto',fontSize:8,background:'#1D9E75',color:'#fff',padding:'1px 5px',borderRadius:8}}>ATIVA</span>}
                    <button onClick={e=>{e.stopPropagation();excluirNF(nf.id)}}
                      style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#ddd',fontSize:12,padding:'0 2px',lineHeight:1}}
                      title="Excluir NF">✕</button>
                  </div>
                  <div style={{fontSize:9,color:'#6b7280'}}>C{nf.fck} · slump {nf.slump}cm · {nf.volume}m³</div>
                  <div style={{fontSize:9,color:'#9ca3af',marginTop:1}}>{nf.concreteira||''} {nf.horario?`· ${nf.horario}`:''}</div>
                </div>
              ))}
              <button onClick={()=>setModalNF(true)}
                style={{width:'100%',padding:7,borderRadius:8,border:'1.5px dashed #d1d5db',background:'transparent',color:'#6b7280',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,fontFamily:'inherit',marginTop:3}}>
                + Nova NF
              </button>
            </div>
            {nfsObra.length>0&&(
              <div style={{padding:'8px 12px',borderTop:'1px solid #f3f4f6'}}>
                <div style={{fontSize:9,fontWeight:500,color:'#9ca3af',marginBottom:5}}>Legenda</div>
                {nfsObra.map(nf=>(
                  <div key={nf.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:9,color:'#6b7280',marginBottom:3}}>
                    <div style={{width:10,height:10,borderRadius:2,background:nf.cor,flexShrink:0}}/>
                    NF {nf.numero} · {nf.volume||'—'}m³
                    {nf.data&&<span style={{marginLeft:'auto',color:'#bbb'}}>{new Date(nf.data+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span>}
                  </div>
                ))}
                <div style={{marginTop:6,padding:'5px 8px',background:'#f9fafb',borderRadius:6,fontSize:9,color:'#374151'}}>
                  <div style={{fontWeight:500}}>Total</div>
                  <div>{nfsObra.length} NFs · {nfsObra.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0).toFixed(1)} m³</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* STATUS BAR */}
      <div style={{height:26,background:'#fff',borderTop:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:'0 12px',gap:14,fontSize:9,color:'#6b7280',flexShrink:0}}>
        <span style={{display:'flex',alignItems:'center',gap:3}}>
          <span style={{width:5,height:5,borderRadius:'50%',background:'#1D9E75',display:'inline-block'}}/>Online
        </span>
        <span>{activeNF?`🖌️ NF ${activeNF.numero} ativa`:'Selecione uma NF para pintar'}</span>
        <span>{tool==='pan'?'✋ Mover':tool==='erase'?'🧹 Borracha':`🖌️ Pincel ${brushSize}px · ${Math.round(opacity*100)}% opacidade`}</span>
        <span style={{marginLeft:'auto'}}>✓ Salvo automaticamente</span>
      </div>

      {/* MODAL NOVA OBRA */}
      {modalObra&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:440}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:16,fontWeight:600}}>Nova Obra</div>
              <button onClick={()=>setModalObra(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>
            {[['Nome da Obra *','nome','text','Ex: Vila do Paraíso'],['Endereço','endereco','text','Rua, número']].map(([lb,k,t,ph])=>(
              <div key={k} style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
                <input value={novaObra[k]||''} onChange={e=>setNovaObra(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                  style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
              </div>
            ))}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
              {[['Nº de Torres','torres'],['Nº de Pavimentos','pavimentos']].map(([lb,k])=>(
                <div key={k}>
                  <label style={{fontSize:12,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
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

      {/* MODAL NOVA NF */}
      {modalNF&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:460}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <div>
                <div style={{fontSize:15,fontWeight:600}}>Cadastrar NF</div>
                <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{currentObra?.nome}</div>
              </div>
              <button onClick={()=>setModalNF(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              {[
                ['Número da NF *','numero','text','Ex: 9445'],
                ['Data da concretagem','data','date',''],
                ['fck (MPa)','fck','text','Ex: 25'],
                ['Slump (cm)','slump','text','Ex: 22'],
                ['Volume (m³)','volume','text','Ex: 7,0'],
                ['Horário chegada','horario','time',''],
                ['Concreteira','concreteira','text','Nome da usina'],
                ['Caminhão (BT)','caminhao','text','Ex: BT 68'],
              ].map(([lb,k,t,ph])=>(
                <div key={k}>
                  <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
                  <input type={t} value={novaNF[k]||''} onChange={e=>setNovaNF(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                    style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalNF(false)} style={{padding:'8px 16px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12}}>Cancelar</button>
              <button onClick={criarNF} style={{padding:'8px 16px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}}>Cadastrar NF</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RELATÓRIOS */}
      {modalRel&&currentObra&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:560,maxHeight:'85vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <div style={{fontSize:15,fontWeight:600}}>Relatórios — {currentObra.nome}</div>
                <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>NFs agrupadas por data</div>
              </div>
              <button onClick={()=>setModalRel(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>

            {/* Resumo geral */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
              {[
                ['Total de NFs',nfsObra.length],
                ['Volume total',nfsObra.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0).toFixed(1)+' m³'],
                ['Dias de concretagem',new Set(nfsObra.map(n=>n.data||'').filter(Boolean)).size],
              ].map(([l,v])=>(
                <div key={l} style={{background:'#f9fafb',borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:'#9ca3af',textTransform:'uppercase',marginBottom:4}}>{l}</div>
                  <div style={{fontSize:18,fontWeight:700,color:'#111827'}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Lista por data */}
            <div style={{flex:1,overflowY:'auto'}}>
              {getRelatorios().length===0&&(
                <div style={{textAlign:'center',padding:24,color:'#9ca3af',fontSize:13}}>Nenhuma NF cadastrada ainda</div>
              )}
              {getRelatorios().map(([data,lista])=>(
                <div key={data} style={{marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>
                      📅 {data!=='Sem data'?new Date(data+'T00:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}):data}
                    </div>
                    <div style={{fontSize:10,color:'#9ca3af'}}>
                      {lista.length} NFs · {lista.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0).toFixed(1)}m³
                    </div>
                  </div>
                  <div style={{border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                      <thead>
                        <tr style={{background:'#f9fafb'}}>
                          {['NF','Concreteira','fck','Slump','Volume','Horário','Caminhão'].map(h=>(
                            <th key={h} style={{padding:'6px 8px',textAlign:'left',fontWeight:500,color:'#6b7280',fontSize:10,borderBottom:'1px solid #e5e7eb'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map(nf=>(
                          <tr key={nf.id}>
                            <td style={{padding:'5px 8px',borderBottom:'1px solid #f3f4f6'}}>
                              <span style={{display:'inline-flex',alignItems:'center',gap:5}}>
                                <div style={{width:10,height:10,borderRadius:2,background:nf.cor,flexShrink:0}}/>
                                <strong>{nf.numero}</strong>
                              </span>
                            </td>
                            <td style={{padding:'5px 8px',borderBottom:'1px solid #f3f4f6',color:'#374151'}}>{nf.concreteira||'—'}</td>
                            <td style={{padding:'5px 8px',borderBottom:'1px solid #f3f4f6',color:'#374151'}}>C{nf.fck||'—'}</td>
                            <td style={{padding:'5px 8px',borderBottom:'1px solid #f3f4f6',color:'#374151'}}>{nf.slump||'—'}cm</td>
                            <td style={{padding:'5px 8px',borderBottom:'1px solid #f3f4f6',color:'#374151'}}>{nf.volume||'—'}m³</td>
                            <td style={{padding:'5px 8px',borderBottom:'1px solid #f3f4f6',color:'#374151'}}>{nf.horario||'—'}</td>
                            <td style={{padding:'5px 8px',borderBottom:'1px solid #f3f4f6',color:'#374151'}}>{nf.caminhao||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:14,paddingTop:14,borderTop:'1px solid #f3f4f6'}}>
              <button onClick={()=>setModalRel(false)} style={{padding:'8px 16px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12}}>Fechar</button>
              <button onClick={()=>{setModalRel(false);exportarPDF()}}
                style={{padding:'8px 16px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>
                📄 Exportar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:'fixed',bottom:20,right:20,background:'#1f2937',color:'#fff',padding:'10px 16px',borderRadius:8,fontSize:12,fontWeight:500,zIndex:2000,boxShadow:'0 4px 12px rgba(0,0,0,.2)'}}>
          {toast}
        </div>
      )}
    </div>
  )
}

/* ══ PLANTA CANVAS ══ */
function PlantaCanvas({ plantaKey, plantaImg, activeNF, tool, brushSize, opacity, onUpload, onCanvasReady }) {
  const bgRef = useRef(null)
  const paintRef = useRef(null)
  const wrapperRef = useRef(null)
  const zoomRef = useRef(1)
  const panRef = useRef({x:0,y:0})
  const [zoomPct, setZoomPct] = useState(100)
  const isPainting = useRef(false)
  const isPanning = useRef(false)
  const lastMouse = useRef({x:0,y:0})
  const lastPaintPos = useRef(null)
  const CW=1200, CH=700

  useEffect(()=>{
    if(bgRef.current && paintRef.current && onCanvasReady)
      onCanvasReady(bgRef.current, paintRef.current)
  },[])

  useEffect(()=>{
    if(!plantaImg) return
    const img=new Image()
    img.onload=()=>{
      const ctx=bgRef.current?.getContext('2d')
      if(!ctx) return
      ctx.clearRect(0,0,CW,CH)
      ctx.fillStyle='#ffffff'
      ctx.fillRect(0,0,CW,CH)
      const sc=Math.min(CW/img.width,CH/img.height)*0.95
      ctx.drawImage(img,(CW-img.width*sc)/2,(CH-img.height*sc)/2,img.width*sc,img.height*sc)
    }
    img.src=plantaImg
  },[plantaImg])

  useEffect(()=>{
    if(!plantaKey || !paintRef.current) return
    const saved=localStorage.getItem(plantaKey)
    if(!saved) return
    const img=new Image()
    img.onload=()=>{ paintRef.current?.getContext('2d')?.drawImage(img,0,0) }
    img.src=saved
  },[plantaKey])

  function applyT(){
    if(wrapperRef.current)
      wrapperRef.current.style.transform=`translate(${panRef.current.x}px,${panRef.current.y}px) scale(${zoomRef.current})`
    setZoomPct(Math.round(zoomRef.current*100))
  }

  function save(){
    if(!paintRef.current||!plantaKey) return
    localStorage.setItem(plantaKey, paintRef.current.toDataURL('image/png'))
  }

  function toCanvas(sx,sy){
    const el=bgRef.current?.parentElement?.parentElement
    if(!el) return{x:0,y:0}
    const r=el.getBoundingClientRect()
    return{x:(sx-r.left-panRef.current.x)/zoomRef.current, y:(sy-r.top-panRef.current.y)/zoomRef.current}
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
      ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=brushSize
      ctx.strokeStyle=activeNF.cor+alpha
      if(lastPaintPos.current){
        ctx.beginPath(); ctx.moveTo(lastPaintPos.current.x,lastPaintPos.current.y)
        ctx.lineTo(pos.x,pos.y); ctx.stroke()
      } else {
        ctx.beginPath(); ctx.arc(pos.x,pos.y,brushSize/2,0,Math.PI*2)
        ctx.fillStyle=activeNF.cor+alpha; ctx.fill()
      }
    }
    lastPaintPos.current=pos
  }

  function onDown(e){
    e.preventDefault()
    const xy=getXY(e)
    lastMouse.current=xy
    if(tool==='pan'){isPanning.current=true;return}
    if(tool==='pen'&&!activeNF) return
    isPainting.current=true
    lastPaintPos.current=null
    paintAt(toCanvas(xy.x,xy.y))
  }

  function onMove(e){
    e.preventDefault()
    const xy=getXY(e)
    if(isPanning.current){
      panRef.current={x:panRef.current.x+(xy.x-lastMouse.current.x),y:panRef.current.y+(xy.y-lastMouse.current.y)}
      lastMouse.current=xy; applyT(); return
    }
    if(isPainting.current){ paintAt(toCanvas(xy.x,xy.y)); lastMouse.current=xy }
  }

  function onUp(){ if(isPainting.current) save(); isPainting.current=false; isPanning.current=false; lastPaintPos.current=null }

  function onWheel(e){
    e.preventDefault()
    const f=e.deltaY<0?1.12:0.9
    const el=bgRef.current?.parentElement?.parentElement
    if(!el) return
    const r=el.getBoundingClientRect()
    const mx=e.clientX-r.left, my=e.clientY-r.top
    const nz=Math.max(0.15,Math.min(8,zoomRef.current*f))
    panRef.current={x:mx-(mx-panRef.current.x)*(nz/zoomRef.current),y:my-(my-panRef.current.y)*(nz/zoomRef.current)}
    zoomRef.current=nz; applyT()
  }

  function limpar(){
    if(!window.confirm('Limpar toda a pintura?')) return
    paintRef.current?.getContext('2d')?.clearRect(0,0,CW,CH)
    if(plantaKey) localStorage.removeItem(plantaKey)
  }

  if(!plantaImg) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f7f4'}}>
      <div style={{textAlign:'center',padding:40,maxWidth:380}}>
        <div style={{fontSize:56,marginBottom:16}}>🖼️</div>
        <div style={{fontSize:18,fontWeight:600,color:'#374151',marginBottom:8}}>Carregar planta</div>
        <div style={{fontSize:13,color:'#6b7280',marginBottom:6}}>Aceita <strong>JPG ou PNG</strong></div>
        <div style={{fontSize:12,color:'#9ca3af',marginBottom:24}}>Será usada em todos os pavimentos desta obra</div>
        <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 28px',background:'#1D9E75',color:'#fff',borderRadius:8,fontSize:14,cursor:'pointer',fontWeight:500}}>
          📁 Selecionar imagem
          <input type="file" accept="image/*" onChange={e=>{
            const f=e.target.files[0]; if(!f) return
            const r=new FileReader(); r.onload=ev=>onUpload(ev.target.result); r.readAsDataURL(f)
          }} style={{display:'none'}}/>
        </label>
      </div>
    </div>
  )

  return (
    <div style={{flex:1,overflow:'hidden',background:'#e8e5de',position:'relative',cursor:tool==='pan'?(isPanning.current?'grabbing':'grab'):tool==='erase'?'cell':'crosshair',userSelect:'none',touchAction:'none'}}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      onWheel={onWheel}>
      {activeNF&&<div style={{position:'absolute',top:10,left:10,zIndex:10,background:activeNF.cor,padding:'4px 12px',borderRadius:6,fontSize:11,fontWeight:700,color:'#333',pointerEvents:'none'}}>🖌️ NF {activeNF.numero}</div>}
      {tool==='pan'&&<div style={{position:'absolute',top:10,left:10,zIndex:10,background:'#fff',padding:'4px 12px',borderRadius:6,fontSize:10,color:'#374151',border:'1px solid #e5e7eb',pointerEvents:'none'}}>✋ Clique e arraste para mover</div>}
      <div style={{position:'absolute',top:10,right:10,zIndex:10,display:'flex',gap:3}}>
        {[['＋',()=>{zoomRef.current=Math.min(8,zoomRef.current*1.2);applyT()}],
          ['－',()=>{zoomRef.current=Math.max(.15,zoomRef.current*0.83);applyT()}],
          ['⊡',()=>{zoomRef.current=1;panRef.current={x:0,y:0};applyT()}]].map(([ico,fn])=>(
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
