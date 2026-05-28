import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// ── CORES ──────────────────────────────────────────────────────
const CORES_OBRAS = ['#1D9E75','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899']

// ── MINI GRÁFICO DE BARRAS ─────────────────────────────────────
function BarChart({ data, height=120, color='#1D9E75', showValues=true }) {
  if(!data||data.length===0) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af',fontSize:11}}>Sem dados</div>
  const max = Math.max(...data.map(d=>d.valor), 0.1)
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:3,height,paddingTop:8}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
          {showValues&&d.valor>0&&(
            <span style={{fontSize:8,color:'#6b7280',whiteSpace:'nowrap'}}>{d.valor.toFixed(1)}</span>
          )}
          <div style={{
            width:'100%',
            height:`${Math.max(4,(d.valor/max)*(height-24))}px`,
            background:d.cor||color,
            borderRadius:'3px 3px 0 0',
            minHeight:d.valor>0?4:0,
            transition:'height .3s'
          }}/>
          <span style={{fontSize:8,color:'#9ca3af',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%',textAlign:'center'}}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── GRÁFICO DE LINHA ───────────────────────────────────────────
function LineChart({ data, height=120, color='#1D9E75', fill=true }) {
  if(!data||data.length<2) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af',fontSize:11}}>Sem dados suficientes</div>
  const max = Math.max(...data.map(d=>d.valor), 0.1)
  const W=400, H=height-20
  const pts = data.map((d,i)=>({
    x: (i/(data.length-1))*W,
    y: H - (d.valor/max)*H,
    ...d
  }))
  const pathD = pts.map((p,i)=>`${i===0?'M':'L'}${p.x},${p.y}`).join(' ')
  const fillD = `${pathD} L${W},${H} L0,${H} Z`

  return (
    <div style={{position:'relative',height,paddingBottom:20}}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {fill&&<path d={fillD} fill={color+'18'}/>}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p,i)=>(
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke="#fff" strokeWidth="1.5"/>
        ))}
      </svg>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
        {data.map((d,i)=>(
          <span key={i} style={{fontSize:8,color:'#9ca3af',flex:1,textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

// ── GRÁFICO DONUT ──────────────────────────────────────────────
function DonutChart({ segments, size=80, label, sublabel }) {
  const total = segments.reduce((a,s)=>a+s.valor,0)
  if(total===0) return(
    <div style={{width:size,height:size,borderRadius:'50%',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      <span style={{fontSize:10,color:'#9ca3af'}}>—</span>
    </div>
  )
  let acc=0
  const R=size/2, r=R*0.62, cx=R, cy=R
  const paths=segments.map(s=>{
    const start=acc/total*360, end=(acc+s.valor)/total*360
    acc+=s.valor
    const a1=(start-90)*Math.PI/180, a2=(end-90)*Math.PI/180
    const x1=cx+R*Math.cos(a1),y1=cy+R*Math.sin(a1)
    const x2=cx+R*Math.cos(a2),y2=cy+R*Math.sin(a2)
    const xi1=cx+r*Math.cos(a1),yi1=cy+r*Math.sin(a1)
    const xi2=cx+r*Math.cos(a2),yi2=cy+r*Math.sin(a2)
    const large=end-start>180?1:0
    return{...s,d:`M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${r},${r} 0 ${large},0 ${xi1},${yi1} Z`}
  })
  return(
    <div style={{position:'relative',width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size}>
        {paths.map((p,i)=><path key={i} d={p.d} fill={p.cor} stroke="#fff" strokeWidth="1"/>)}
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <div style={{fontSize:14,fontWeight:700,color:'#111827',lineHeight:1}}>{label}</div>
        {sublabel&&<div style={{fontSize:8,color:'#9ca3af'}}>{sublabel}</div>}
      </div>
    </div>
  )
}

// ── CARD MÉTRICA ──────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, color='#1D9E75', bg='#e6f7f1' }) {
  return(
    <div style={{background:'#fff',borderRadius:10,padding:'12px 14px',border:'1px solid #e5e7eb',display:'flex',alignItems:'center',gap:12}}>
      <div style={{width:38,height:38,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:9,color:'#9ca3af',textTransform:'uppercase',fontWeight:500,marginBottom:2}}>{label}</div>
        <div style={{fontSize:20,fontWeight:700,color:color,lineHeight:1}}>{value}</div>
        {sub&&<div style={{fontSize:10,color:'#6b7280',marginTop:2}}>{sub}</div>}
      </div>
    </div>
  )
}

// ── DASHBOARD PRINCIPAL ───────────────────────────────────────
export default function Dashboard({ obras, nfs, cps, onClose }) {
  const [obraFiltro, setObraFiltro] = useState('todas')
  const [periodo, setPeriodo] = useState(30)

  // Dados filtrados
  const obrasVisiveis = obraFiltro==='todas' ? obras : obras.filter(o=>o.id===obraFiltro)
  const nfsFiltradas = nfs.filter(n=> obraFiltro==='todas' || n.obra_id===obraFiltro)
  const cpsFiltrados = cps.filter(c=> obraFiltro==='todas' || c.obra_id===obraFiltro)

  // Filtro de período
  const dataCorte = new Date(); dataCorte.setDate(dataCorte.getDate()-periodo)
  const nfsPeriodo = nfsFiltradas.filter(n=>n.data && new Date(n.data+'T00:00:00')>=dataCorte)

  // ── MÉTRICAS GERAIS ──
  const totalVol = nfsFiltradas.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0)
  const totalNFs = nfsFiltradas.length
  const totalCPs = cpsFiltrados.length
  const desformasOk = cpsFiltrados.filter(c=>c.desforma_liberada).length
  const cpsPendentes = cpsFiltrados.filter(c=>c.tipo==='12h'&&(c.resultado_mpa===null||c.resultado_mpa===undefined)).length
  const fckMedio = cpsFiltrados.filter(c=>c.tipo==='28d'&&c.resultado_mpa).length > 0
    ? (cpsFiltrados.filter(c=>c.tipo==='28d'&&c.resultado_mpa).reduce((a,c)=>a+parseFloat(c.resultado_mpa),0) / cpsFiltrados.filter(c=>c.tipo==='28d'&&c.resultado_mpa).length).toFixed(1)
    : '—'

  // ── VOLUME POR DIA (últimos N dias) ──
  const volPorDia = (() => {
    const mapa = {}
    nfsPeriodo.forEach(n=>{
      if(!n.data) return
      const d = new Date(n.data+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})
      mapa[n.data] = (mapa[n.data]||0) + parseFloat((n.volume||'0').replace(',','.'))
    })
    return Object.entries(mapa).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14).map(([data,vol])=>({
      label: new Date(data+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),
      valor: vol
    }))
  })()

  // ── VOLUME ACUMULADO (linha) ──
  const volAcumulado = (() => {
    let acc=0
    return volPorDia.map(d=>({label:d.label, valor:(acc+=d.valor)}))
  })()

  // ── VOLUME POR OBRA ──
  const volPorObra = obras.map((o,i)=>({
    label: o.nome.split(' ').slice(0,2).join(' '),
    valor: nfs.filter(n=>n.obra_id===o.id).reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0),
    cor: CORES_OBRAS[i%CORES_OBRAS.length]
  }))

  // ── VOLUME PROJETADO VS REAL ──
  // Projetado = progresso estimado com base nos pavimentos
  const projetoVsReal = obras.map((o,i)=>{
    const totalPavs = (o.torres||[]).reduce((a,t)=>a+(t.pavimentos||[]).length,0)
    const volReal = nfs.filter(n=>n.obra_id===o.id).reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0)
    const volProjetado = totalPavs * 35 // estimativa 35m³ por pavimento
    return { obra: o.nome, real: volReal, projetado: volProjetado, progresso: o.progresso||0, cor: CORES_OBRAS[i%CORES_OBRAS.length] }
  })

  // ── PROGRESSO DAS OBRAS ──
  const progressoObras = obras.map((o,i)=>({
    nome: o.nome,
    progresso: o.progresso||0,
    nfs: nfs.filter(n=>n.obra_id===o.id).length,
    vol: nfs.filter(n=>n.obra_id===o.id).reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0),
    cor: CORES_OBRAS[i%CORES_OBRAS.length]
  }))

  // ── CICLO ESTRUTURAL (dias entre concretagens) ──
  const cicloData = (() => {
    const porObra = {}
    nfs.filter(n=>n.data).forEach(n=>{
      if(!porObra[n.obra_id]) porObra[n.obra_id]=[]; porObra[n.obra_id].push(n.data)
    })
    return obras.map((o,i)=>{
      const datas=(porObra[o.id]||[]).sort()
      if(datas.length<2) return null
      let soma=0,count=0
      for(let j=1;j<datas.length;j++){
        const diff=(new Date(datas[j]+'T00:00:00')-new Date(datas[j-1]+'T00:00:00'))/(1000*60*60*24)
        if(diff>0&&diff<60){soma+=diff;count++}
      }
      return count>0?{label:o.nome.split(' ').slice(0,2).join(' '),valor:parseFloat((soma/count).toFixed(1)),cor:CORES_OBRAS[i%CORES_OBRAS.length]}:null
    }).filter(Boolean)
  })()

  // ── STATUS CPs ──
  const statusCPs = [
    { cor:'#1D9E75', label:'Desforma liberada', valor:desformasOk },
    { cor:'#fbbf24', label:'Pendente 12h', valor:cpsPendentes },
    { cor:'#ef4444', label:'Não liberou', valor:cpsFiltrados.filter(c=>c.tipo==='12h'&&c.resultado_mpa!==null&&!c.desforma_liberada).length },
    { cor:'#3b82f6', label:'Concluído 28d', valor:cpsFiltrados.filter(c=>c.tipo==='28d'&&c.resultado_mpa!==null).length },
  ]

  // ── fck por obra ──
  const fckPorObra = obras.map((o,i)=>{
    const cpsObra=cps.filter(c=>c.obra_id===o.id&&c.tipo==='28d'&&c.resultado_mpa)
    if(!cpsObra.length) return null
    return{
      label:o.nome.split(' ').slice(0,2).join(' '),
      valor:parseFloat((cpsObra.reduce((a,c)=>a+parseFloat(c.resultado_mpa),0)/cpsObra.length).toFixed(1)),
      cor:CORES_OBRAS[i%CORES_OBRAS.length]
    }
  }).filter(Boolean)

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#f8f7f4',fontFamily:'system-ui,sans-serif'}}>

      {/* HEADER */}
      <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'12px 20px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:'#111827'}}>📊 Dashboard</div>
          <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>Visão geral da produção estrutural</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          {/* Filtro obra */}
          <select value={obraFiltro} onChange={e=>setObraFiltro(e.target.value)}
            style={{padding:'6px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,outline:'none',color:'#374151',background:'#fff'}}>
            <option value="todas">Todas as obras</option>
            {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          {/* Filtro período */}
          <select value={periodo} onChange={e=>setPeriodo(parseInt(e.target.value))}
            style={{padding:'6px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,outline:'none',color:'#374151',background:'#fff'}}>
            <option value={7}>Últimos 7 dias</option>
            <option value={15}>Últimos 15 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <button onClick={onClose} style={{padding:'6px 14px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:12,cursor:'pointer'}}>
            ← Voltar
          </button>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div style={{flex:1,overflowY:'auto',padding:20}}>

        {/* MÉTRICAS GERAIS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:20}}>
          <MetricCard icon="📦" label="Volume total" value={`${totalVol.toFixed(1)} m³`} sub={`${totalNFs} caminhões`} color="#1D9E75" bg="#e6f7f1"/>
          <MetricCard icon="🏗️" label="Obras ativas" value={obras.length} sub={`${obras.filter(o=>o.progresso<100).length} em andamento`} color="#3b82f6" bg="#dbeafe"/>
          <MetricCard icon="🧪" label="CPs cadastrados" value={totalCPs} sub={`${desformasOk} desformas liberadas`} color="#f59e0b" bg="#fef3c7"/>
          <MetricCard icon="⚠️" label="CPs 12h pendentes" value={cpsPendentes} sub={cpsPendentes>0?"Verificar desforma!":"Tudo em dia ✓"} color={cpsPendentes>0?"#b45309":"#065f46"} bg={cpsPendentes>0?"#fef3c7":"#d1fae5"}/>
          <MetricCard icon="📐" label="fck médio 28d" value={fckMedio==='—'?'—':`${fckMedio} MPa`} sub="média dos ensaios" color="#8b5cf6" bg="#ede9fe"/>
          <MetricCard icon="📅" label="Concretagens" value={nfsPeriodo.length} sub={`últimos ${periodo} dias`} color="#ec4899" bg="#fce7f3"/>
        </div>

        {/* LINHA 1: Volume por dia + Acumulado */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>

          {/* Volume por dia */}
          <div style={{background:'#fff',borderRadius:12,padding:16,border:'1px solid #e5e7eb'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>Volume por dia</div>
                <div style={{fontSize:10,color:'#9ca3af'}}>m³ concretados · últimos {periodo} dias</div>
              </div>
              <div style={{fontSize:12,fontWeight:700,color:'#1D9E75'}}>{volPorDia.reduce((a,d)=>a+d.valor,0).toFixed(1)} m³</div>
            </div>
            <BarChart data={volPorDia} height={120} color="#1D9E75"/>
          </div>

          {/* Volume acumulado */}
          <div style={{background:'#fff',borderRadius:12,padding:16,border:'1px solid #e5e7eb'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>Volume acumulado</div>
                <div style={{fontSize:10,color:'#9ca3af'}}>evolução no período</div>
              </div>
            </div>
            <LineChart data={volAcumulado} height={140} color="#3b82f6"/>
          </div>
        </div>

        {/* LINHA 2: Volume por obra + Projeto vs Real */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>

          {/* Volume por obra */}
          <div style={{background:'#fff',borderRadius:12,padding:16,border:'1px solid #e5e7eb'}}>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>Volume por obra</div>
              <div style={{fontSize:10,color:'#9ca3af'}}>total concretado em cada obra</div>
            </div>
            <BarChart data={volPorObra} height={120} showValues={true}/>
          </div>

          {/* Projeto vs Real */}
          <div style={{background:'#fff',borderRadius:12,padding:16,border:'1px solid #e5e7eb'}}>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>Projetado vs Real</div>
              <div style={{fontSize:10,color:'#9ca3af'}}>volume estimado × concretado por obra</div>
            </div>
            {projetoVsReal.length===0?<div style={{height:120,display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af',fontSize:11}}>Sem dados</div>:(
              <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:4}}>
                {projetoVsReal.map((p,i)=>{
                  const pct = p.projetado>0?Math.min(100,(p.real/p.projetado)*100):0
                  return(
                    <div key={i}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:10,color:'#374151',fontWeight:500}}>{p.obra.split(' ').slice(0,2).join(' ')}</span>
                        <span style={{fontSize:10,color:'#6b7280'}}>{p.real.toFixed(0)} / {p.projetado.toFixed(0)} m³ · {pct.toFixed(0)}%</span>
                      </div>
                      <div style={{height:10,background:'#f3f4f6',borderRadius:5,overflow:'hidden',position:'relative'}}>
                        <div style={{height:'100%',background:p.cor,width:`${pct}%`,borderRadius:5,transition:'width .5s'}}/>
                        {/* Meta line at 100% */}
                        <div style={{position:'absolute',right:0,top:0,bottom:0,width:2,background:'#374151',opacity:0.3}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* LINHA 3: Progresso obras + Ciclo estrutural */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>

          {/* Progresso das obras */}
          <div style={{background:'#fff',borderRadius:12,padding:16,border:'1px solid #e5e7eb'}}>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>Progresso das obras</div>
              <div style={{fontSize:10,color:'#9ca3af'}}>% de conclusão estrutural</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {progressoObras.map((p,i)=>(
                <div key={i}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:p.cor}}/>
                      <span style={{fontSize:11,color:'#374151',fontWeight:500}}>{p.nome.split(' ').slice(0,3).join(' ')}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:10,color:'#9ca3af'}}>{p.nfs} NFs · {p.vol.toFixed(0)}m³</span>
                      <span style={{fontSize:11,fontWeight:700,color:p.cor}}>{p.progresso}%</span>
                    </div>
                  </div>
                  <div style={{height:8,background:'#f3f4f6',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',background:p.cor,width:`${p.progresso}%`,borderRadius:4,transition:'width .5s'}}/>
                  </div>
                </div>
              ))}
              {progressoObras.length===0&&<div style={{height:80,display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af',fontSize:11}}>Nenhuma obra cadastrada</div>}
            </div>
          </div>

          {/* Ciclo estrutural */}
          <div style={{background:'#fff',borderRadius:12,padding:16,border:'1px solid #e5e7eb'}}>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>Ciclo estrutural</div>
              <div style={{fontSize:10,color:'#9ca3af'}}>dias médios entre concretagens por obra</div>
            </div>
            {cicloData.length===0?(
              <div style={{height:120,display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af',fontSize:11,flexDirection:'column',gap:4}}>
                <span style={{fontSize:24}}>📅</span>
                <span>Dados insuficientes para calcular ciclo</span>
              </div>
            ):(
              <>
                <BarChart data={cicloData} height={100} color="#8b5cf6"/>
                <div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap'}}>
                  {cicloData.map((c,i)=>(
                    <div key={i} style={{padding:'4px 10px',background:'#f3f4f6',borderRadius:6,fontSize:10}}>
                      <span style={{color:'#374151'}}>{c.label}: </span>
                      <span style={{fontWeight:700,color:c.valor<=3?'#065f46':c.valor<=5?'#b45309':'#991b1b'}}>{c.valor} dias</span>
                      {c.valor<=3&&<span style={{color:'#065f46'}}> ✓</span>}
                      {c.valor>5&&<span style={{color:'#991b1b'}}> ⚠️</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* LINHA 4: Status CPs + fck por obra */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>

          {/* Status CPs */}
          <div style={{background:'#fff',borderRadius:12,padding:16,border:'1px solid #e5e7eb'}}>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>Status dos CPs</div>
              <div style={{fontSize:10,color:'#9ca3af'}}>distribuição por resultado</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:20}}>
              <DonutChart
                segments={statusCPs.filter(s=>s.valor>0)}
                size={90}
                label={totalCPs}
                sublabel="total"
              />
              <div style={{flex:1}}>
                {statusCPs.map((s,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:10,height:10,borderRadius:2,background:s.cor,flexShrink:0}}/>
                      <span style={{fontSize:10,color:'#374151'}}>{s.label}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:11,fontWeight:700,color:s.cor}}>{s.valor}</span>
                      <span style={{fontSize:9,color:'#9ca3af'}}>{totalCPs>0?((s.valor/totalCPs)*100).toFixed(0)+'%':''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* fck por obra */}
          <div style={{background:'#fff',borderRadius:12,padding:16,border:'1px solid #e5e7eb'}}>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>Resultado médio fck (28d)</div>
              <div style={{fontSize:10,color:'#9ca3af'}}>MPa médio por obra · mínimo C25 = 25 MPa</div>
            </div>
            {fckPorObra.length===0?(
              <div style={{height:120,display:'flex',alignItems:'center',justifyContent:'center',color:'#9ca3af',fontSize:11,flexDirection:'column',gap:4}}>
                <span style={{fontSize:24}}>🧪</span>
                <span>Nenhum resultado de 28d registrado</span>
              </div>
            ):(
              <>
                <BarChart data={fckPorObra} height={100}/>
                {/* Linha de referência fck mínimo */}
                <div style={{marginTop:8,padding:'6px 10px',background:'#f0fdf4',borderRadius:6,fontSize:10,color:'#065f46',display:'flex',alignItems:'center',gap:6}}>
                  <span>—</span>
                  <span>Referência C25: mínimo 25 MPa para aprovação</span>
                </div>
                <div style={{marginTop:6,display:'flex',gap:8,flexWrap:'wrap'}}>
                  {fckPorObra.map((f,i)=>(
                    <div key={i} style={{padding:'4px 10px',background:f.valor>=25?'#d1fae5':'#fee2e2',borderRadius:6,fontSize:10}}>
                      <span style={{color:'#374151'}}>{f.label}: </span>
                      <span style={{fontWeight:700,color:f.valor>=25?'#065f46':'#991b1b'}}>{f.valor} MPa {f.valor>=25?'✓':'⚠️'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* LINHA 5: Tabela resumo por obra */}
        <div style={{background:'#fff',borderRadius:12,padding:16,border:'1px solid #e5e7eb',marginBottom:14}}>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>Resumo por obra</div>
            <div style={{fontSize:10,color:'#9ca3af'}}>visão consolidada de todas as obras</div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead>
                <tr style={{background:'#f9fafb'}}>
                  {['Obra','Torres','Pavimentos','NFs','Volume (m³)','Progresso','CPs total','Desformas','Pendentes 12h','fck médio'].map(h=>(
                    <th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:500,color:'#6b7280',fontSize:10,borderBottom:'1px solid #e5e7eb',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {obras.map((o,i)=>{
                  const nfsO = nfs.filter(n=>n.obra_id===o.id)
                  const cpsO = cps.filter(c=>c.obra_id===o.id)
                  const volO = nfsO.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0)
                  const desformasO = cpsO.filter(c=>c.desforma_liberada).length
                  const pendentesO = cpsO.filter(c=>c.tipo==='12h'&&(c.resultado_mpa===null||c.resultado_mpa===undefined)).length
                  const cps28 = cpsO.filter(c=>c.tipo==='28d'&&c.resultado_mpa)
                  const fckO = cps28.length>0?(cps28.reduce((a,c)=>a+parseFloat(c.resultado_mpa),0)/cps28.length).toFixed(1):'—'
                  const totalPavs=(o.torres||[]).reduce((a,t)=>a+(t.pavimentos||[]).length,0)
                  return(
                    <tr key={o.id} style={{borderBottom:'1px solid #f3f4f6'}}>
                      <td style={{padding:'8px 10px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:CORES_OBRAS[i%CORES_OBRAS.length],flexShrink:0}}/>
                          <span style={{fontWeight:500,color:'#374151'}}>{o.nome}</span>
                        </div>
                      </td>
                      <td style={{padding:'8px 10px',color:'#6b7280'}}>{(o.torres||[]).length}</td>
                      <td style={{padding:'8px 10px',color:'#6b7280'}}>{totalPavs}</td>
                      <td style={{padding:'8px 10px',color:'#6b7280'}}>{nfsO.length}</td>
                      <td style={{padding:'8px 10px',fontWeight:500,color:'#374151'}}>{volO.toFixed(1)}</td>
                      <td style={{padding:'8px 10px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{width:60,height:6,background:'#f3f4f6',borderRadius:3,overflow:'hidden'}}>
                            <div style={{height:'100%',background:CORES_OBRAS[i%CORES_OBRAS.length],width:`${o.progresso||0}%`}}/>
                          </div>
                          <span style={{fontSize:10,color:'#374151',fontWeight:500}}>{o.progresso||0}%</span>
                        </div>
                      </td>
                      <td style={{padding:'8px 10px',color:'#6b7280'}}>{cpsO.length}</td>
                      <td style={{padding:'8px 10px',color:'#065f46',fontWeight:500}}>{desformasO}</td>
                      <td style={{padding:'8px 10px'}}>
                        {pendentesO>0?(
                          <span style={{color:'#b45309',fontWeight:500}}>⚠️ {pendentesO}</span>
                        ):(
                          <span style={{color:'#065f46'}}>✓ 0</span>
                        )}
                      </td>
                      <td style={{padding:'8px 10px'}}>
                        {fckO==='—'?<span style={{color:'#9ca3af'}}>—</span>:(
                          <span style={{color:parseFloat(fckO)>=25?'#065f46':'#991b1b',fontWeight:500}}>{fckO} MPa</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé */}
        <div style={{textAlign:'center',fontSize:10,color:'#9ca3af',paddingBottom:8}}>
          Atualizado em {new Date().toLocaleString('pt-BR')} · ConcreteMap Dashboard
        </div>
      </div>
    </div>
  )
}
