import Dashboard from './Dashboard'
import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const NF_COLORS = [
  '#FFE44A','#5EE07A','#4DC8F0','#F4A0C0','#FF9B3D',
  '#A78BFA','#F87171','#34D399','#60A5FA','#FBBF24',
]
const NF_VAZIA = {
  numero:'', data:new Date().toISOString().slice(0,10),
  fck:'', slump:'', volume:'', concreteira:'',
  horario:'', caminhao:'', placa:'',
  inicio_descarga:'', hora_moldagem:'', fim_descarga:'',
}
const CP_VAZIA = {
  numero_cp:'', data_moldagem:new Date().toISOString().slice(0,10),
  hora_moldagem:'', responsavel:'', tipo:'12h',
  data_ruptura:'', resultado_mpa:'', observacao:'',
}

// ── PDF ──────────────────────────────────────────────────────
async function gerarPDF(obra, torre, pav, nfs, paintCanvas, bgCanvas, viewMode) {
  if(!window.jspdf){
    await new Promise((res,rej)=>{
      const s=document.createElement('script')
      s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload=res;s.onerror=rej;document.head.appendChild(s)
    })
  }
  const {jsPDF}=window.jspdf
  const pdf=new jsPDF('landscape','mm','a4')
  const PW=pdf.internal.pageSize.getWidth(),PH=pdf.internal.pageSize.getHeight()
  const hoje=new Date().toLocaleDateString('pt-BR')
  const hora=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
  pdf.setFillColor(29,158,117);pdf.rect(0,0,PW,14,'F')
  pdf.setTextColor(255,255,255);pdf.setFontSize(13);pdf.setFont('helvetica','bold')
  pdf.text('MAPEAMENTO DE CONCRETO — ESTRUTURA',PW/2,9,{align:'center'})
  pdf.setFontSize(8);pdf.text('ConcreteMap',PW-10,9,{align:'right'})
  pdf.setTextColor(50,50,50);pdf.setFontSize(9);pdf.setFont('helvetica','normal')
  pdf.text(`Obra: ${obra.nome}`,10,20);pdf.text(`Torre: ${torre.nome}`,10,25)
  pdf.text(`Pavimento: ${pav.nome}`,10,30);pdf.text(`Data: ${hoje} ${hora}`,PW-10,20,{align:'right'})
  pdf.setFont('helvetica','bold')
  pdf.text(`${nfs.length} NFs · ${nfs.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0).toFixed(1)} m³`,PW-10,26,{align:'right'})
  pdf.setDrawColor(200,200,200);pdf.setLineWidth(0.3);pdf.line(10,34,PW-10,34)
  const cols=['NF','Data','Placa','Vol.','fck','Slump','Chegada','Início','Moldagem','Fim','Concreteira']
  const colW=[18,20,18,14,12,14,16,18,16,16,30]
  let tx=10,ty=40
  pdf.setFillColor(245,245,245);pdf.rect(tx,ty-4,colW.reduce((a,b)=>a+b,0),6,'F')
  pdf.setFont('helvetica','bold');pdf.setFontSize(7);pdf.setTextColor(80,80,80)
  cols.forEach((c,i)=>{pdf.text(c,tx+1,ty);tx+=colW[i]});ty+=3
  nfs.forEach(nf=>{
    tx=10;pdf.setFont('helvetica','normal');pdf.setFontSize(7)
    const rgb=hexToRgb(nf.cor||'#ccc')
    pdf.setFillColor(rgb[0],rgb[1],rgb[2]);pdf.rect(tx,ty-3,colW[0],5,'F')
    const row=[nf.numero,nf.data?new Date(nf.data+'T00:00:00').toLocaleDateString('pt-BR'):'—',
      nf.placa||'—',nf.volume||'—',`C${nf.fck||'—'}`,`${nf.slump||'—'}cm`,
      nf.horario||'—',nf.inicio_descarga||'—',nf.hora_moldagem||'—',nf.fim_descarga||'—',nf.concreteira||'—']
    pdf.setTextColor(40,40,40)
    row.forEach((v,i)=>{if(i>0)pdf.text(String(v),tx+1,ty);tx+=colW[i]})
    pdf.text(nf.numero,11,ty)
    ty+=5;pdf.setDrawColor(230,230,230);pdf.setLineWidth(0.1)
    pdf.line(10,ty-1,10+colW.reduce((a,b)=>a+b,0),ty-1)
  })
  if(bgCanvas&&paintCanvas){
    const tmp=document.createElement('canvas');tmp.width=bgCanvas.width;tmp.height=bgCanvas.height
    const tc=tmp.getContext('2d');tc.drawImage(bgCanvas,0,0);tc.drawImage(paintCanvas,0,0)
    pdf.addImage(tmp.toDataURL('image/jpeg',0.9),'JPEG',10,ty+3,PW-20,PH-ty-21)
  }
  const legY=PH-12;pdf.setFillColor(250,250,250);pdf.rect(0,legY-2,PW,14,'F')
  pdf.setDrawColor(220,220,220);pdf.line(0,legY-2,PW,legY-2)
  pdf.setFontSize(7);pdf.setFont('helvetica','bold');pdf.setTextColor(100,100,100)
  pdf.text('LEGENDA:',10,legY+3);let lx=32
  nfs.forEach(nf=>{
    const rgb=hexToRgb(nf.cor||'#ccc');pdf.setFillColor(rgb[0],rgb[1],rgb[2]);pdf.rect(lx,legY,8,4,'F')
    pdf.setFont('helvetica','normal');pdf.setTextColor(50,50,50)
    pdf.text(`NF ${nf.numero} (${nf.volume||'—'}m³)`,lx+10,legY+3);lx+=48
  })
  pdf.setFontSize(6);pdf.setTextColor(180,180,180)
  pdf.text(`ConcreteMap · ${obra.nome} · ${hoje} ${hora}`,PW/2,PH-2,{align:'center'})
  pdf.save(`MC_${obra.nome.replace(/\s/g,'_')}_${pav.nome}_${hoje.replace(/\//g,'')}.pdf`)
}
function hexToRgb(hex){return[parseInt(hex.slice(1,3),16)||200,parseInt(hex.slice(3,5),16)||200,parseInt(hex.slice(5,7),16)||200]}

// ── TELA LOGIN ────────────────────────────────────────────────
function TelaLogin({onLogin}){
  const[email,setEmail]=useState('')
  const[senha,setSenha]=useState('')
  const[erro,setErro]=useState('')
  const[loading,setLoading]=useState(false)
  const[showSenha,setShowSenha]=useState(false)

  async function handleLogin(e){
    e.preventDefault()
    if(!email.trim()||!senha.trim()){setErro('Preencha email e senha');return}
    setLoading(true);setErro('')
    const{error}=await supabase.auth.signInWithPassword({email,password:senha})
    setLoading(false)
    if(error) setErro('Email ou senha incorretos')
    else onLogin()
  }

  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#f8f7f4',fontFamily:'system-ui,sans-serif'}}>
      <div style={{width:'100%',maxWidth:380,padding:'0 16px'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:8}}>🏗️</div>
          <div style={{fontSize:24,fontWeight:700,color:'#1D9E75'}}>ConcreteMap</div>
          <div style={{fontSize:13,color:'#9ca3af',marginTop:4}}>Rastreabilidade de Concretagem</div>
        </div>
        <div style={{background:'#fff',borderRadius:16,padding:28,boxShadow:'0 4px 24px rgba(0,0,0,.08)',border:'1px solid #e5e7eb'}}>
          <div style={{fontSize:16,fontWeight:600,color:'#111827',marginBottom:20}}>Entrar no sistema</div>
          <form onSubmit={handleLogin}>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:500,color:'#374151',display:'block',marginBottom:5}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com.br" autoComplete="email"
                style={{width:'100%',padding:'10px 12px',border:`1px solid ${erro?'#fca5a5':'#d1d5db'}`,borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:12,fontWeight:500,color:'#374151',display:'block',marginBottom:5}}>Senha</label>
              <div style={{position:'relative'}}>
                <input type={showSenha?'text':'password'} value={senha} onChange={e=>setSenha(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                  style={{width:'100%',padding:'10px 40px 10px 12px',border:`1px solid ${erro?'#fca5a5':'#d1d5db'}`,borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
                <button type="button" onClick={()=>setShowSenha(s=>!s)}
                  style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#9ca3af',padding:0}}>
                  {showSenha?'🙈':'👁️'}
                </button>
              </div>
            </div>
            {erro&&<div style={{marginBottom:14,padding:'8px 12px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,fontSize:12,color:'#dc2626'}}>⚠️ {erro}</div>}
            <button type="submit" disabled={loading}
              style={{width:'100%',padding:'11px',background:loading?'#9ca3af':'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:500,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit'}}>
              {loading?'Entrando...':'Entrar'}
            </button>
          </form>
        </div>
        <div style={{textAlign:'center',marginTop:16,fontSize:11,color:'#9ca3af'}}>VL Construtora · Sistema Interno · v1.0</div>
      </div>
    </div>
  )
}

// ── HOOKS ────────────────────────────────────────────────────
function useObras(){
  const[obras,setObras]=useState([])
  const[loading,setLoading]=useState(true)
  async function carregar(){
    setLoading(true)
    const{data:obrasData}=await supabase.from('obras').select('*').order('criado_em')
    if(!obrasData){setLoading(false);return}
    const obrasCompletas=await Promise.all(obrasData.map(async(obra)=>{
      const{data:torresData}=await supabase.from('torres').select('*').eq('obra_id',obra.id).order('ordem')
      const torres=await Promise.all((torresData||[]).map(async(torre)=>{
        const{data:pavsData}=await supabase.from('pavimentos').select('*').eq('torre_id',torre.id).order('ordem')
        return{...torre,pavimentos:pavsData||[]}
      }))
      return{...obra,torres}
    }))
    setObras(obrasCompletas);setLoading(false)
  }
  async function criarObra(nome,endereco,nTorres,nPavs,cor){
    const{data:obra}=await supabase.from('obras').insert({nome,endereco,cor,progresso:0}).select().single()
    if(!obra) return null
    for(let i=1;i<=nTorres;i++){
      const{data:torre}=await supabase.from('torres').insert({obra_id:obra.id,nome:`Torre ${String(i).padStart(2,'0')}`,ordem:i}).select().single()
      if(!torre) continue
      for(let j=1;j<=nPavs;j++) await supabase.from('pavimentos').insert({torre_id:torre.id,nome:`Pavimento ${String(j).padStart(2,'0')}`,ordem:j})
    }
    await carregar();return obra
  }
  async function editarObra(id,dados){await supabase.from('obras').update(dados).eq('id',id);await carregar()}
  async function excluirObra(id){await supabase.from('obras').delete().eq('id',id);await carregar()}
  async function salvarPavimentos(pavs){
    for(const p of pavs) await supabase.from('pavimentos').update({nome:p.nome,tipo:p.tipo||'tipo'}).eq('id',p.id)
    await carregar()
  }
  useEffect(()=>{carregar()},[])
  return{obras,loading,carregar,criarObra,editarObra,excluirObra,salvarPavimentos}
}

function useNFs(obraId){
  const[nfs,setNfs]=useState([])
  async function carregar(){
    if(!obraId){setNfs([]);return}
    const{data}=await supabase.from('nfs').select('*').eq('obra_id',obraId).order('criado_em')
    setNfs(data||[])
  }
  async function salvar(formNF,editingId,cor){
    const payload={obra_id:obraId,numero:formNF.numero,data:formNF.data||null,fck:formNF.fck,slump:formNF.slump,
      volume:formNF.volume,concreteira:formNF.concreteira,horario:formNF.horario||null,caminhao:formNF.caminhao,
      placa:formNF.placa,inicio_descarga:formNF.inicio_descarga||null,hora_moldagem:formNF.hora_moldagem||null,
      fim_descarga:formNF.fim_descarga||null,cor}
    if(editingId) await supabase.from('nfs').update(payload).eq('id',editingId)
    else await supabase.from('nfs').insert(payload)
    await carregar()
  }
  async function excluir(id){await supabase.from('nfs').delete().eq('id',id);await carregar()}
  useEffect(()=>{carregar()},[obraId])
  return{nfs,salvar,excluir}
}

function useCPs(obraId){
  const[cps,setCps]=useState([])
  async function carregar(){
    if(!obraId){setCps([]);return}
    const{data}=await supabase.from('cps').select('*').eq('obra_id',obraId).order('criado_em')
    setCps(data||[])
  }
  async function salvar(formCP,nfId,editingId){
    const mpa=parseFloat(formCP.resultado_mpa)||null
    const status12h = formCP.tipo==='12h'&&mpa!==null ? (mpa>=3?'aprovado':'reprovado') : null
    const status28d = formCP.tipo==='28d'&&mpa!==null ? 'concluido' : null
    const statusFinal = status12h||status28d||(mpa!==null?'concluido':'pendente')
    const desformaOk = formCP.tipo==='12h'&&mpa!==null&&mpa>=3
    const payload={
      obra_id:obraId,nf_id:nfId,numero_cp:formCP.numero_cp,
      data_moldagem:formCP.data_moldagem||null,hora_moldagem:formCP.hora_moldagem||null,
      responsavel:formCP.responsavel,tipo:formCP.tipo,
      data_ruptura:formCP.data_ruptura||null,resultado_mpa:mpa,
      status:statusFinal,observacao:formCP.observacao,
      desforma_liberada:desformaOk,
      liberado_por:desformaOk?formCP.responsavel:null,
      liberado_em:desformaOk?new Date().toISOString():null,
    }
    if(editingId) await supabase.from('cps').update(payload).eq('id',editingId)
    else await supabase.from('cps').insert(payload)
    await carregar()
  }
  async function excluir(id){await supabase.from('cps').delete().eq('id',id);await carregar()}
  useEffect(()=>{carregar()},[obraId])
  return{cps,salvar:salvar,excluir,carregar}
}

function usePlanta(obraId,torreId,pavId){
  const[plantaImg,setPlantaImg]=useState(null)
  const[paintData,setPaintData]=useState(null)
  async function carregarPlanta(){
    if(!pavId){setPlantaImg(null);return}
    const{data}=await supabase.from('plantas').select('imagem_data').eq('pavimento_id',pavId).single()
    if(data?.imagem_data){setPlantaImg(data.imagem_data);return}
    const{data:d2}=await supabase.from('plantas').select('imagem_data').eq('obra_id',obraId).limit(1).single()
    setPlantaImg(d2?.imagem_data||null)
  }
  async function salvarPlanta(dataUrl){
    if(!pavId||!obraId||!torreId) return
    await supabase.from('plantas').upsert({obra_id:obraId,torre_id:torreId,pavimento_id:pavId,imagem_data:dataUrl,atualizado_em:new Date().toISOString()},{onConflict:'pavimento_id'})
    setPlantaImg(dataUrl)
  }
  async function carregarPintura(viewMode){
    if(!pavId){setPaintData(null);return}
    const{data}=await supabase.from('pinturas').select('imagem_data').eq('pavimento_id',pavId).eq('view_mode',viewMode).single()
    setPaintData(data?.imagem_data||null)
  }
  async function salvarPintura(dataUrl,viewMode){
    if(!pavId) return
    await supabase.from('pinturas').upsert({pavimento_id:pavId,view_mode:viewMode,imagem_data:dataUrl,atualizado_em:new Date().toISOString()},{onConflict:'pavimento_id, view_mode'})
    setPaintData(dataUrl)
  }
  useEffect(()=>{carregarPlanta()},[pavId])
  return{plantaImg,paintData,salvarPlanta,carregarPintura,salvarPintura}
}

// ── TELA CPs ─────────────────────────────────────────────────
function TelaCP({obra, nfs, cps, onSalvar, onExcluir, onClose}){
  const[modalCP,setModalCP]=useState(false)
  const[editingCP,setEditingCP]=useState(null)
  const[nfSelecionada,setNfSelecionada]=useState(null)
  const[formCP,setFormCP]=useState({...CP_VAZIA})
  const[filtroNF,setFiltroNF]=useState('todas')
  const[filtroTipo,setFiltroTipo]=useState('todos')
  const[filtroStatus,setFiltroStatus]=useState('todos')

  function abrirModalCP(cp=null, nf=null){
    if(cp){
      setEditingCP(cp)
      setNfSelecionada(nfs.find(n=>n.id===cp.nf_id)||null)
      setFormCP({
        numero_cp:cp.numero_cp||'',data_moldagem:cp.data_moldagem||new Date().toISOString().slice(0,10),
        hora_moldagem:cp.hora_moldagem||'',responsavel:cp.responsavel||'',tipo:cp.tipo||'12h',
        data_ruptura:cp.data_ruptura||'',resultado_mpa:cp.resultado_mpa||'',observacao:cp.observacao||'',
      })
    } else {
      setEditingCP(null)
      setNfSelecionada(nf)
      setFormCP({...CP_VAZIA,data_moldagem:nf?.data||new Date().toISOString().slice(0,10)})
    }
    setModalCP(true)
  }

  async function handleSalvar(){
    if(!nfSelecionada){alert('Selecione uma NF');return}
    await onSalvar(formCP,nfSelecionada.id,editingCP?.id)
    setModalCP(false)
  }

  // Status visual
  function statusBadge(cp){
    if(cp.tipo==='12h'){
      if(cp.resultado_mpa===null||cp.resultado_mpa===undefined) return{label:'Aguardando 12h',bg:'#fef3c7',color:'#b45309'}
      if(cp.desforma_liberada) return{label:'✓ Desforma liberada',bg:'#d1fae5',color:'#065f46'}
      return{label:'✗ Não libera desforma',bg:'#fee2e2',color:'#991b1b'}
    }
    if(cp.resultado_mpa===null||cp.resultado_mpa===undefined) return{label:'Aguardando 28d',bg:'#ede9fe',color:'#5b21b6'}
    return{label:'Concluído 28d',bg:'#e0f2fe',color:'#0369a1'}
  }

  // Filtros
  const cpsFiltrados = cps.filter(cp=>{
    if(filtroNF!=='todas'&&cp.nf_id!==filtroNF) return false
    if(filtroTipo!=='todos'&&cp.tipo!==filtroTipo) return false
    if(filtroStatus==='pendentes'&&cp.resultado_mpa!==null) return false
    if(filtroStatus==='liberados'&&!cp.desforma_liberada) return false
    if(filtroStatus==='reprovados'&&(cp.desforma_liberada||cp.resultado_mpa===null)) return false
    return true
  })

  // Alertas: CPs 12h sem resultado
  const alertas12h = cps.filter(cp=>cp.tipo==='12h'&&(cp.resultado_mpa===null||cp.resultado_mpa===undefined))
  const alertas28d = cps.filter(cp=>cp.tipo==='28d'&&(cp.resultado_mpa===null||cp.resultado_mpa===undefined))

  // Resumo
  const total = cps.length
  const liberados = cps.filter(c=>c.desforma_liberada).length
  const pendentes12h = alertas12h.length
  const pendentes28d = alertas28d.length

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',fontFamily:'system-ui,sans-serif'}}>

      {/* HEADER */}
      <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'12px 20px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:'#111827'}}>🧪 Controle de Corpos de Prova</div>
          <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{obra.nome}</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>abrirModalCP()} style={{padding:'6px 14px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontWeight:500}}>
            + Novo CP
          </button>
          <button onClick={onClose} style={{padding:'6px 14px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:12,cursor:'pointer'}}>
            ← Voltar
          </button>
        </div>
      </div>

      {/* ALERTAS */}
      {(pendentes12h>0||pendentes28d>0)&&(
        <div style={{background:'#fffbeb',borderBottom:'1px solid #fde68a',padding:'8px 20px',display:'flex',gap:16,alignItems:'center',flexShrink:0}}>
          <span style={{fontSize:16}}>⚠️</span>
          {pendentes12h>0&&<span style={{fontSize:12,color:'#92400e',fontWeight:500}}>{pendentes12h} CP(s) de 12h aguardando resultado — verificar desforma!</span>}
          {pendentes28d>0&&<span style={{fontSize:12,color:'#4c1d95',fontWeight:500}}>{pendentes28d} CP(s) de 28 dias aguardando resultado</span>}
        </div>
      )}

      {/* CARDS RESUMO */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,padding:'16px 20px',flexShrink:0}}>
        {[
          ['Total de CPs',total,'#374151','#f9fafb'],
          ['Desformas liberadas',liberados,'#065f46','#d1fae5'],
          ['Pendentes 12h',pendentes12h,'#b45309','#fef3c7'],
          ['Pendentes 28d',pendentes28d,'#5b21b6','#ede9fe'],
        ].map(([l,v,c,bg])=>(
          <div key={l} style={{background:bg,borderRadius:10,padding:'12px 16px'}}>
            <div style={{fontSize:10,color:c,fontWeight:500,textTransform:'uppercase',marginBottom:4}}>{l}</div>
            <div style={{fontSize:24,fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{padding:'0 20px 12px',display:'flex',gap:8,flexWrap:'wrap',flexShrink:0}}>
        <select value={filtroNF} onChange={e=>setFiltroNF(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,outline:'none',color:'#374151',background:'#fff'}}>
          <option value="todas">Todas as NFs</option>
          {nfs.map(nf=><option key={nf.id} value={nf.id}>NF {nf.numero}</option>)}
        </select>
        <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,outline:'none',color:'#374151',background:'#fff'}}>
          <option value="todos">12h + 28d</option>
          <option value="12h">Só 12h (desforma)</option>
          <option value="28d">Só 28 dias</option>
        </select>
        <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}
          style={{padding:'6px 10px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,outline:'none',color:'#374151',background:'#fff'}}>
          <option value="todos">Todos os status</option>
          <option value="pendentes">Pendentes</option>
          <option value="liberados">Desforma liberada</option>
          <option value="reprovados">Não liberou desforma</option>
        </select>
        <span style={{fontSize:11,color:'#9ca3af',alignSelf:'center'}}>{cpsFiltrados.length} registro(s)</span>
      </div>

      {/* LISTA DE CPs */}
      <div style={{flex:1,overflowY:'auto',padding:'0 20px 20px'}}>
        {cpsFiltrados.length===0&&(
          <div style={{textAlign:'center',padding:40,color:'#9ca3af'}}>
            <div style={{fontSize:40,marginBottom:12}}>🧪</div>
            <div style={{fontSize:14,fontWeight:500,marginBottom:6}}>Nenhum CP encontrado</div>
            <div style={{fontSize:12}}>Cadastre CPs para cada NF da concretagem</div>
          </div>
        )}

        {/* Agrupado por NF */}
        {nfs.filter(nf=>cpsFiltrados.some(cp=>cp.nf_id===nf.id)).map(nf=>{
          const cpsNF = cpsFiltrados.filter(cp=>cp.nf_id===nf.id)
          const liberou12h = cpsNF.some(cp=>cp.tipo==='12h'&&cp.desforma_liberada)
          const pendente12h = cpsNF.some(cp=>cp.tipo==='12h'&&(cp.resultado_mpa===null||cp.resultado_mpa===undefined))
          return(
            <div key={nf.id} style={{marginBottom:16}}>
              {/* Header da NF */}
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <div style={{width:14,height:14,borderRadius:3,background:nf.cor||'#ccc',flexShrink:0}}/>
                <span style={{fontSize:13,fontWeight:600,color:'#374151'}}>NF {nf.numero}</span>
                <span style={{fontSize:11,color:'#9ca3af'}}>{nf.data?new Date(nf.data+'T00:00:00').toLocaleDateString('pt-BR'):''} · C{nf.fck} · {nf.volume}m³</span>
                {liberou12h&&<span style={{fontSize:10,background:'#d1fae5',color:'#065f46',padding:'2px 8px',borderRadius:10,fontWeight:500}}>✓ Desforma liberada</span>}
                {pendente12h&&!liberou12h&&<span style={{fontSize:10,background:'#fef3c7',color:'#b45309',padding:'2px 8px',borderRadius:10,fontWeight:500}}>⚠️ Aguardando CP 12h</span>}
                <button onClick={()=>abrirModalCP(null,nf)}
                  style={{marginLeft:'auto',padding:'3px 10px',border:'1px solid #e5e7eb',borderRadius:5,background:'#f9fafb',cursor:'pointer',fontSize:10,color:'#374151'}}>
                  + CP desta NF
                </button>
              </div>

              {/* Cards dos CPs */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:8}}>
                {cpsNF.map(cp=>{
                  const badge=statusBadge(cp)
                  const mpa=cp.resultado_mpa
                  return(
                    <div key={cp.id} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:12,position:'relative',cursor:'pointer'}}
                      onClick={()=>abrirModalCP(cp)}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='#1D9E75'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='#e5e7eb'}>
                      {/* Faixa tipo */}
                      <div style={{position:'absolute',top:0,left:0,right:0,height:4,borderRadius:'10px 10px 0 0',background:cp.tipo==='12h'?'#f59e0b':'#3b82f6'}}/>
                      <div style={{marginTop:4,display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:'#111827'}}>CP {cp.numero_cp||'—'}</div>
                          <div style={{fontSize:10,color:'#9ca3af'}}>{cp.tipo==='12h'?'🕐 12h (desforma)':'📅 28 dias'}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          {mpa!==null&&mpa!==undefined?(
                            <div style={{fontSize:20,fontWeight:700,color:cp.tipo==='12h'?(mpa>=3?'#065f46':'#991b1b'):'#0369a1'}}>
                              {mpa} MPa
                            </div>
                          ):(
                            <div style={{fontSize:11,color:'#9ca3af',fontStyle:'italic'}}>Sem resultado</div>
                          )}
                        </div>
                      </div>
                      {/* Badge status */}
                      <div style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',background:badge.bg,borderRadius:8,marginBottom:8}}>
                        <span style={{fontSize:9,fontWeight:600,color:badge.color}}>{badge.label}</span>
                      </div>
                      <div style={{fontSize:10,color:'#6b7280'}}>
                        {cp.data_moldagem&&<div>Moldagem: {new Date(cp.data_moldagem+'T00:00:00').toLocaleDateString('pt-BR')} {cp.hora_moldagem||''}</div>}
                        {cp.data_ruptura&&<div>Ruptura: {new Date(cp.data_ruptura+'T00:00:00').toLocaleDateString('pt-BR')}</div>}
                        {cp.responsavel&&<div>Resp.: {cp.responsavel}</div>}
                        {cp.desforma_liberada&&cp.liberado_por&&<div style={{color:'#065f46',fontWeight:500}}>Lib.: {cp.liberado_por}</div>}
                      </div>
                      {cp.observacao&&<div style={{marginTop:6,fontSize:10,color:'#9ca3af',fontStyle:'italic',borderTop:'1px solid #f3f4f6',paddingTop:6}}>{cp.observacao}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* NFs sem CP */}
        {nfs.filter(nf=>!cpsFiltrados.some(cp=>cp.nf_id===nf.id)&&filtroNF==='todas'&&filtroStatus==='todos').map(nf=>(
          <div key={nf.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#fff',border:'1px dashed #e5e7eb',borderRadius:8,marginBottom:8,cursor:'pointer'}}
            onClick={()=>abrirModalCP(null,nf)}>
            <div style={{width:10,height:10,borderRadius:2,background:nf.cor||'#ccc',flexShrink:0}}/>
            <span style={{fontSize:12,color:'#6b7280'}}>NF {nf.numero} — nenhum CP cadastrado</span>
            <span style={{marginLeft:'auto',fontSize:11,color:'#1D9E75',fontWeight:500}}>+ Cadastrar CP</span>
          </div>
        ))}
      </div>

      {/* MODAL CP */}
      {modalCP&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <div style={{fontSize:15,fontWeight:600}}>{editingCP?'Editar CP':'Cadastrar CP'}</div>
                <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>
                  {nfSelecionada?`NF ${nfSelecionada.numero} · C${nfSelecionada.fck}`:obra.nome}
                </div>
              </div>
              <button onClick={()=>setModalCP(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>

            {/* Selecionar NF */}
            {!editingCP&&(
              <div style={{marginBottom:14}}>
                <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>NF (concretagem) *</label>
                <select value={nfSelecionada?.id||''} onChange={e=>setNfSelecionada(nfs.find(n=>n.id===e.target.value)||null)}
                  style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,outline:'none',fontFamily:'inherit',color:'#374151'}}>
                  <option value="">Selecione a NF...</option>
                  {nfs.map(nf=><option key={nf.id} value={nf.id}>NF {nf.numero} — {nf.data?new Date(nf.data+'T00:00:00').toLocaleDateString('pt-BR'):''} · C{nf.fck}</option>)}
                </select>
              </div>
            )}

            {/* Tipo */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>Tipo de ensaio *</label>
              <div style={{display:'flex',gap:8}}>
                {[['12h','🕐 12h — Desforma'],['28d','📅 28 dias — fck']].map(([v,l])=>(
                  <button key={v} onClick={()=>setFormCP(p=>({...p,tipo:v}))}
                    style={{flex:1,padding:'8px',border:`2px solid ${formCP.tipo===v?'#1D9E75':'#e5e7eb'}`,borderRadius:8,background:formCP.tipo===v?'#e6f7f1':'#fff',cursor:'pointer',fontSize:12,fontWeight:formCP.tipo===v?600:400,color:formCP.tipo===v?'#1D9E75':'#374151',fontFamily:'inherit'}}>
                    {l}
                  </button>
                ))}
              </div>
              {formCP.tipo==='12h'&&(
                <div style={{marginTop:6,padding:'6px 10px',background:'#fef3c7',borderRadius:6,fontSize:11,color:'#92400e'}}>
                  ⚠️ Resultado ≥ 3 MPa libera desforma automaticamente
                </div>
              )}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              {[
                ['Nº do CP','numero_cp','text','Ex: CP-01'],
                ['Responsável','responsavel','text','Nome do técnico'],
                ['Data de moldagem','data_moldagem','date',''],
                ['Hora de moldagem','hora_moldagem','time',''],
              ].map(([lb,k,t,ph])=>(
                <div key={k}>
                  <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
                  <input type={t} value={formCP[k]||''} onChange={e=>setFormCP(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                    style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                </div>
              ))}
            </div>

            {/* Resultado */}
            <div style={{background:'#f9fafb',borderRadius:10,padding:14,marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:600,color:'#374151',marginBottom:10}}>Resultado da ruptura</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>Data da ruptura</label>
                  <input type="date" value={formCP.data_ruptura||''} onChange={e=>setFormCP(p=>({...p,data_ruptura:e.target.value}))}
                    style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>Resultado (MPa)</label>
                  <input type="number" step="0.1" value={formCP.resultado_mpa||''} onChange={e=>setFormCP(p=>({...p,resultado_mpa:e.target.value}))} placeholder="Ex: 4.2"
                    style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                </div>
              </div>
              {/* Preview do resultado */}
              {formCP.resultado_mpa&&formCP.tipo==='12h'&&(
                <div style={{marginTop:10,padding:'8px 12px',background:parseFloat(formCP.resultado_mpa)>=3?'#d1fae5':'#fee2e2',borderRadius:8,fontSize:12,fontWeight:600,color:parseFloat(formCP.resultado_mpa)>=3?'#065f46':'#991b1b'}}>
                  {parseFloat(formCP.resultado_mpa)>=3?'✅ Desforma liberada automaticamente':'❌ Resistência insuficiente — não libera desforma'}
                </div>
              )}
            </div>

            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>Observações</label>
              <textarea value={formCP.observacao||''} onChange={e=>setFormCP(p=>({...p,observacao:e.target.value}))} placeholder="Anotações sobre o ensaio..."
                style={{width:'100%',padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,outline:'none',fontFamily:'inherit',resize:'vertical',minHeight:60}}/>
            </div>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalCP(false)} style={{padding:'8px 16px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12}}>Cancelar</button>
              {editingCP&&(
                <button onClick={async()=>{await onExcluir(editingCP.id);setModalCP(false)}}
                  style={{padding:'8px 16px',border:'1px solid #fecaca',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12,color:'#ef4444'}}>
                  Excluir
                </button>
              )}
              <button onClick={handleSalvar} style={{padding:'8px 16px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}}>
                {editingCP?'Salvar':'Cadastrar CP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── APP PRINCIPAL ─────────────────────────────────────────────
export default function App(){
  const[sessao,setSessao]=useState(null)
  const[checandoAuth,setChecandoAuth]=useState(true)

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setSessao(session);setChecandoAuth(false)})
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>setSessao(session))
    return()=>subscription.unsubscribe()
  },[])

  async function handleLogout(){await supabase.auth.signOut();setSessao(null)}

  if(checandoAuth) return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'system-ui',flexDirection:'column',gap:12}}>
      <div style={{fontSize:32}}>🏗️</div>
      <div style={{fontSize:14,color:'#6b7280'}}>Carregando...</div>
    </div>
  )
  if(!sessao) return <TelaLogin onLogin={()=>supabase.auth.getSession().then(({data:{session}})=>setSessao(session))}/>
  return <AppInterno sessao={sessao} onLogout={handleLogout}/>
}

function AppInterno({sessao,onLogout}){
  const{obras,loading,carregar:recarregarObras,criarObra,editarObra,excluirObra,salvarPavimentos}=useObras()
  const[currentObra,setCurrentObra]=useState(null)
  const[currentTorre,setCurrentTorre]=useState(null)
  const[currentPav,setCurrentPav]=useState(null)
  const[activeNF,setActiveNF]=useState(null)
  const[tool,setTool]=useState('pen')
  const[brushSize,setBrushSize]=useState(18)
  const[opacity,setOpacity]=useState(0.65)
  const[viewMode,setViewMode]=useState('parede')
  const[telaAtiva,setTelaAtiva]=useState('mapa') // 'mapa' | 'cps' | 'dashboard'
  const[modalObra,setModalObra]=useState(false)
  const[modalNF,setModalNF]=useState(false)
  const[modalEditObra,setModalEditObra]=useState(false)
  const[modalEditPav,setModalEditPav]=useState(false)
  const[editingNF,setEditingNF]=useState(null)
  const[formNF,setFormNF]=useState({...NF_VAZIA})
  const[novaObra,setNovaObra]=useState({nome:'',endereco:'',torres:1,pavimentos:5})
  const[editObra,setEditObra]=useState({nome:'',endereco:'',progresso:0})
  const[editPavs,setEditPavs]=useState([])
  const[toast,setToast]=useState('')
  const[salvando,setSalvando]=useState(false)
  const canvasRefs=useRef({bg:null,paint:null})

  const{nfs,salvar:salvarNF,excluir:excluirNFDB}=useNFs(currentObra?.id)
  const{cps,salvar:salvarCP,excluir:excluirCP}=useCPs(currentObra?.id)
  const{plantaImg,paintData,salvarPlanta,carregarPintura,salvarPintura}=usePlanta(currentObra?.id,currentTorre?.id,currentPav?.id)

  useEffect(()=>{if(currentPav) carregarPintura(viewMode)},[currentPav,viewMode])

  function showToast(msg,dur=2500){setToast(msg);setTimeout(()=>setToast(''),dur)}

  async function handleCriarObra(){
    if(!novaObra.nome.trim()){showToast('Informe o nome');return}
    const cores=['#1D9E75','#3b82f6','#f59e0b','#ef4444','#8b5cf6']
    await criarObra(novaObra.nome,novaObra.endereco,novaObra.torres,novaObra.pavimentos,cores[obras.length%cores.length])
    setModalObra(false);setNovaObra({nome:'',endereco:'',torres:1,pavimentos:5})
    showToast(`Obra "${novaObra.nome}" criada!`)
  }

  function abrirEditarObra(){
    if(!currentObra) return
    setEditObra({nome:currentObra.nome,endereco:currentObra.endereco||'',progresso:currentObra.progresso||0})
    setModalEditObra(true)
  }

  async function handleEditarObra(){
    if(!editObra.nome?.trim()){showToast('Informe o nome');return}
    await editarObra(currentObra.id,{nome:editObra.nome,endereco:editObra.endereco,progresso:parseInt(editObra.progresso)||0})
    setCurrentObra(prev=>({...prev,...editObra}));setModalEditObra(false);showToast('Obra atualizada!')
  }

  async function handleExcluirObra(){
    if(!window.confirm(`Excluir "${currentObra.nome}"?`)) return
    await excluirObra(currentObra.id);setCurrentObra(null);setCurrentTorre(null);setCurrentPav(null)
    showToast('Obra excluída')
  }

  function abrirEditPavs(){
    if(!currentTorre) return
    setEditPavs([...(currentTorre.pavimentos||[]).map(p=>({...p}))])
    setModalEditPav(true)
  }

  async function handleSalvarPavs(){
    await salvarPavimentos(editPavs);setModalEditPav(false);showToast('Pavimentos atualizados!')
  }

  function abrirModalNF(nf=null){
    if(nf){
      setEditingNF(nf)
      setFormNF({numero:nf.numero||'',data:nf.data||new Date().toISOString().slice(0,10),fck:nf.fck||'',slump:nf.slump||'',volume:nf.volume||'',
        concreteira:nf.concreteira||'',horario:nf.horario||'',caminhao:nf.caminhao||'',placa:nf.placa||'',
        inicio_descarga:nf.inicio_descarga||'',hora_moldagem:nf.hora_moldagem||'',fim_descarga:nf.fim_descarga||''})
    } else {setEditingNF(null);setFormNF({...NF_VAZIA})}
    setModalNF(true)
  }

  async function handleSalvarNF(){
    if(!formNF.numero.trim()){showToast('Informe o número da NF');return}
    if(!currentObra){showToast('Selecione uma obra');return}
    const cor=editingNF?editingNF.cor:NF_COLORS[nfs.length%NF_COLORS.length]
    await salvarNF(formNF,editingNF?.id,cor)
    setModalNF(false);setEditingNF(null)
    showToast(editingNF?`NF ${formNF.numero} atualizada!`:`NF ${formNF.numero} cadastrada!`)
  }

  async function handleExcluirNF(id){
    if(!window.confirm('Excluir esta NF?')) return
    await excluirNFDB(id);if(activeNF?.id===id) setActiveNF(null);showToast('NF excluída')
  }

  async function handleUploadPlanta(dataUrl){setSalvando(true);await salvarPlanta(dataUrl);setSalvando(false);showToast('Planta salva! ✓')}
  async function handleSalvarPintura(dataUrl){await salvarPintura(dataUrl,viewMode)}

  async function exportarPDF(){
    if(!currentObra||!currentTorre||!currentPav){showToast('Selecione um pavimento');return}
    showToast('Gerando PDF...',4000)
    await gerarPDF(currentObra,currentTorre,currentPav,nfs,canvasRefs.current.paint,canvasRefs.current.bg,viewMode)
    showToast('PDF gerado! ✓')
  }

  // Alertas CPs para badge no botão
  const cpsPendentes12h = cps.filter(cp=>cp.tipo==='12h'&&(cp.resultado_mpa===null||cp.resultado_mpa===undefined)).length

  const TABELA_CAMPOS=[
    {key:'volume',label:'Volume (m³)'},{key:'horario',label:'Hora chegada BT'},
    {key:'inicio_descarga',label:'Início descarga'},{key:'hora_moldagem',label:'Hora moldagem'},
    {key:'fim_descarga',label:'Fim descarga'},{key:'placa',label:'Placa BT'},
    {key:'slump',label:'Slump'},{key:'fck',label:'fck'},{key:'concreteira',label:'Concreteira'},
  ]

  if(loading) return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'system-ui',flexDirection:'column',gap:12}}>
      <div style={{fontSize:32}}>🏗️</div>
      <div style={{fontSize:14,color:'#6b7280'}}>Carregando obras...</div>
    </div>
  )

  // Tela de CPs
  if(telaAtiva==='cps'&&currentObra) return(
    <div style={{height:'100vh',fontFamily:'system-ui,sans-serif',display:'flex',flexDirection:'column'}}>
      <TelaCP
        obra={currentObra}
        nfs={nfs}
        cps={cps}
        onSalvar={async(formCP,nfId,editingId)=>{await salvarCP(formCP,nfId,editingId);showToast('CP salvo!')}}
        onExcluir={async(id)=>{await excluirCP(id);showToast('CP excluído')}}
        onClose={()=>setTelaAtiva('mapa')}
      />
    </div>
  )


  // Tela Dashboard
  if(telaAtiva==='dashboard') return(
    <div style={{height:'100vh',fontFamily:'system-ui,sans-serif',display:'flex',flexDirection:'column'}}>
      <Dashboard
        obras={obras}
        nfs={nfs}
        cps={cps}
        onClose={()=>setTelaAtiva('mapa')}
      />
    </div>
  )

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:'system-ui,sans-serif',background:'#f8f7f4'}}>

      {/* TOPBAR */}
      <div style={{height:52,background:'#fff',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:'0 14px',gap:10,flexShrink:0}}>
        <div style={{fontSize:15,fontWeight:700,color:'#1D9E75',cursor:'pointer',whiteSpace:'nowrap'}}
          onClick={()=>{setCurrentObra(null);setCurrentTorre(null);setCurrentPav(null);setActiveNF(null);setTelaAtiva('mapa')}}>
          🏗️ ConcreteMap
        </div>
        <div style={{fontSize:11,color:'#9ca3af',flex:1,display:'flex',alignItems:'center',gap:4,overflow:'hidden'}}>
          {currentObra&&<span style={{color:'#374151',cursor:'pointer',whiteSpace:'nowrap'}} onClick={()=>{setCurrentObra(null);setCurrentTorre(null);setCurrentPav(null)}}>{currentObra.nome}</span>}
          {currentTorre&&<><span style={{color:'#d1d5db'}}> › </span><span style={{color:'#374151',whiteSpace:'nowrap'}}>{currentTorre.nome}</span></>}
          {currentPav&&<><span style={{color:'#d1d5db'}}> › </span><span style={{color:'#111827',fontWeight:500,whiteSpace:'nowrap'}}>{currentPav.nome}</span></>}
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
          {salvando&&<span style={{fontSize:10,color:'#9ca3af'}}>Salvando...</span>}
          <button onClick={()=>setTelaAtiva('dashboard')}
            style={{padding:'5px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
            📊 Dashboard
          </button>
          {currentObra&&(
            <button onClick={()=>setTelaAtiva('cps')}
              style={{padding:'5px 10px',background:cpsPendentes12h>0?'#fef3c7':'#f3f4f6',border:`1px solid ${cpsPendentes12h>0?'#fbbf24':'#e5e7eb'}`,borderRadius:6,fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontWeight:cpsPendentes12h>0?600:400,color:cpsPendentes12h>0?'#b45309':'#374151'}}>
              🧪 CPs
              {cpsPendentes12h>0&&<span style={{background:'#f59e0b',color:'#fff',borderRadius:'50%',width:16,height:16,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>{cpsPendentes12h}</span>}
            </button>
          )}
          {currentObra&&<button onClick={abrirEditarObra} style={{padding:'5px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer'}}>✏️ Editar obra</button>}
          {currentObra&&<button onClick={()=>abrirModalNF()} style={{padding:'5px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer'}}>+ Nova NF</button>}
          {currentPav&&<button onClick={exportarPDF} style={{padding:'5px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer'}}>📄 PDF</button>}
          <button onClick={()=>setModalObra(true)} style={{padding:'5px 12px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:500}}>+ Nova Obra</button>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:6}}>
            <div style={{width:22,height:22,borderRadius:'50%',background:'#1D9E75',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#fff',fontWeight:600}}>
              {sessao.user.email[0].toUpperCase()}
            </div>
            <span style={{fontSize:10,color:'#6b7280',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sessao.user.email}</span>
            <button onClick={onLogout} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#9ca3af',padding:'0 2px'}} title="Sair">⏻</button>
          </div>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* SIDEBAR ESQUERDA */}
        <div style={{width:215,background:'#fff',borderRight:'1px solid #e5e7eb',overflowY:'auto',flexShrink:0}}>
          <div style={{padding:'8px 8px 4px',fontSize:10,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.06em'}}>Obras</div>
          {obras.length===0&&<div style={{padding:16,fontSize:11,color:'#9ca3af',textAlign:'center'}}>Nenhuma obra.<br/>Crie a primeira!</div>}
          {obras.map(o=>(
            <div key={o.id}>
              <div onClick={()=>{setCurrentObra(o);setCurrentTorre(null);setCurrentPav(null);setActiveNF(null);setTelaAtiva('mapa')}}
                style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',margin:'1px 6px',borderRadius:6,cursor:'pointer',fontSize:12,color:'#374151',background:currentObra?.id===o.id?'#e6f7f1':'transparent',fontWeight:currentObra?.id===o.id?500:400}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:o.cor||'#1D9E75',flexShrink:0}}/>
                <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.nome}</span>
                {currentObra?.id===o.id&&<span onClick={e=>{e.stopPropagation();abrirEditarObra()}} style={{fontSize:10,color:'#9ca3af',cursor:'pointer',padding:'1px 4px'}} title="Editar">✏️</span>}
              </div>
              {currentObra?.id===o.id&&(o.torres||[]).map(t=>(
                <div key={t.id}>
                  <div onClick={()=>{setCurrentTorre(currentTorre?.id===t.id?null:t);setCurrentPav(null)}}
                    style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px 6px 22px',margin:'1px 6px',borderRadius:6,cursor:'pointer',fontSize:11,color:'#374151',background:currentTorre?.id===t.id?'#e6f7f1':'transparent'}}>
                    🏢 <span style={{flex:1}}>{t.nome}</span>
                    {currentTorre?.id===t.id&&<span onClick={e=>{e.stopPropagation();setCurrentTorre(t);abrirEditPavs()}} style={{fontSize:10,color:'#9ca3af',cursor:'pointer',padding:'1px 4px'}}>✏️</span>}
                    <span style={{color:'#9ca3af',fontSize:10}}>{currentTorre?.id===t.id?'▾':'▸'}</span>
                  </div>
                  {currentTorre?.id===t.id&&(t.pavimentos||[]).map(p=>(
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
              <div style={{fontSize:13,color:'#6b7280',marginBottom:6}}>{obras.length===0?'Crie sua primeira obra para começar':'Selecione uma obra ou crie uma nova'}</div>
              <div style={{fontSize:10,color:'#9ca3af',marginBottom:20,display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#1D9E75',display:'inline-block'}}/>
                Logado como {sessao.user.email} · Dados salvos na nuvem
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
                {obras.map(o=>(
                  <div key={o.id} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:16,cursor:'pointer'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#1D9E75'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#e5e7eb'}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:o.cor||'#1D9E75',flexShrink:0}}/>
                      <div style={{fontSize:14,fontWeight:600,flex:1}} onClick={()=>{setCurrentObra(o);setCurrentTorre(o.torres?.[0]||null);setCurrentPav(null)}}>{o.nome}</div>
                      <button onClick={e=>{e.stopPropagation();setCurrentObra(o);setEditObra({nome:o.nome,endereco:o.endereco||'',progresso:o.progresso||0});setModalEditObra(true)}}
                        style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#9ca3af',padding:'2px 4px'}}>✏️</button>
                    </div>
                    <div style={{fontSize:11,color:'#9ca3af',marginBottom:12,cursor:'pointer'}} onClick={()=>{setCurrentObra(o);setCurrentTorre(o.torres?.[0]||null);setCurrentPav(null)}}>{o.endereco}</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}} onClick={()=>{setCurrentObra(o);setCurrentTorre(o.torres?.[0]||null);setCurrentPav(null)}}>
                      {[['Torres',(o.torres||[]).length],['Pavimentos',(o.torres?.[0]?.pavimentos||[]).length],['NFs',nfs.filter(n=>n.obra_id===o.id).length],['Progresso',(o.progresso||0)+'%']].map(([l,v])=>(
                        <div key={l} style={{background:'#f9fafb',borderRadius:6,padding:'6px 8px'}}>
                          <div style={{fontSize:9,color:'#9ca3af',textTransform:'uppercase'}}>{l}</div>
                          <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{height:4,background:'#e5e7eb',borderRadius:2,overflow:'hidden'}}>
                      <div style={{height:'100%',background:o.cor||'#1D9E75',width:(o.progresso||0)+'%',borderRadius:2}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ):(
            <>
              <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',padding:'4px 12px',borderBottom:'1px solid #f3f4f6',gap:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:'#374151'}}>{currentObra?.nome} · {currentTorre?.nome} · {currentPav?.nome}</div>
                  <div style={{fontSize:10,color:'#9ca3af'}}>{new Date().toLocaleDateString('pt-BR')}</div>
                  <div style={{marginLeft:'auto',display:'flex',gap:4}}>
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
                {nfs.length>0&&(
                  <div style={{overflowX:'auto',maxHeight:130}}>
                    <table style={{borderCollapse:'collapse',fontSize:9,width:'100%',minWidth:800}}>
                      <thead style={{position:'sticky',top:0,zIndex:1}}>
                        <tr>
                          <td style={{padding:'3px 8px',background:'#f5f5f5',fontWeight:600,color:'#666',fontSize:8,border:'1px solid #e5e7eb',writingMode:'vertical-rl',transform:'rotate(180deg)',width:26,textAlign:'center'}}>CONCRETAGEM</td>
                          {nfs.map(nf=>{
                            const nfCPs=cps.filter(c=>c.nf_id===nf.id)
                            const liberou=nfCPs.some(c=>c.tipo==='12h'&&c.desforma_liberada)
                            const pendente=nfCPs.some(c=>c.tipo==='12h'&&(c.resultado_mpa===null||c.resultado_mpa===undefined))
                            return(
                              <td key={nf.id} style={{padding:'3px 8px',textAlign:'center',border:'1px solid #e5e7eb',fontWeight:700,fontSize:9,background:nf.cor||'#eee',color:'#333',minWidth:68,whiteSpace:'nowrap',cursor:'pointer'}}
                                onClick={()=>abrirModalNF(nf)}>
                                {nf.numero} ✏️
                                {liberou&&<span style={{marginLeft:4,fontSize:8}}>✓</span>}
                                {pendente&&!liberou&&<span style={{marginLeft:4,fontSize:8}}>⚠️</span>}
                              </td>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {TABELA_CAMPOS.map(({key,label})=>(
                          <tr key={key}>
                            <td style={{padding:'2px 8px',background:'#f9f9f9',fontWeight:500,color:'#555',fontSize:8,border:'1px solid #e5e7eb',whiteSpace:'nowrap'}}>{label}</td>
                            {nfs.map(nf=>(
                              <td key={nf.id} style={{padding:'2px 8px',textAlign:'center',border:'1px solid #e5e7eb',fontSize:9,color:'#333',cursor:'pointer'}} onClick={()=>abrirModalNF(nf)}>
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
                <label style={{display:'flex',alignItems:'center',gap:4,padding:'4px 9px',background:plantaImg?'#e6f7f1':'#fff',border:`1px solid ${plantaImg?'#1D9E75':'#e5e7eb'}`,borderRadius:6,fontSize:10,cursor:'pointer',fontWeight:500,color:plantaImg?'#1D9E75':'#374151',whiteSpace:'nowrap'}}>
                  {plantaImg?'🖼️ Trocar':'📁 Carregar planta'}
                  <input type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(!f) return;const r=new FileReader();r.onload=ev=>handleUploadPlanta(ev.target.result);r.readAsDataURL(f)}} style={{display:'none'}}/>
                </label>
                <button onClick={exportarPDF} style={{marginLeft:'auto',padding:'4px 9px',borderRadius:6,cursor:'pointer',border:'1px solid #e5e7eb',background:'#fff',fontSize:10,color:'#374151'}}>📄 PDF</button>
              </div>
              <PlantaCanvas
                key={`${currentPav?.id}_${viewMode}`}
                plantaImg={plantaImg} paintData={paintData} activeNF={activeNF} tool={tool}
                brushSize={brushSize} opacity={opacity}
                onCanvasReady={(bg,paint)=>{canvasRefs.current={bg,paint}}}
                onUpload={handleUploadPlanta} onSavePaint={handleSalvarPintura}
              />
            </>
          )}
        </div>

        {/* SIDEBAR DIREITA */}
        {currentObra&&(
          <div style={{width:210,background:'#fff',borderLeft:'1px solid #e5e7eb',display:'flex',flexDirection:'column',flexShrink:0}}>
            <div style={{padding:'10px 12px 6px',borderBottom:'1px solid #f3f4f6'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>Notas Fiscais</div>
              <div style={{fontSize:9,color:'#9ca3af',marginTop:1}}>Clique para selecionar · ✏️ editar</div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:6}}>
              {nfs.length===0&&<div style={{padding:16,textAlign:'center',color:'#9ca3af',fontSize:11}}>Nenhuma NF.<br/>Clique em "+ Nova NF"</div>}
              {nfs.map(nf=>{
                const nfCPs=cps.filter(c=>c.nf_id===nf.id)
                const liberou=nfCPs.some(c=>c.tipo==='12h'&&c.desforma_liberada)
                const pendente12h=nfCPs.some(c=>c.tipo==='12h'&&(c.resultado_mpa===null||c.resultado_mpa===undefined))
                return(
                  <div key={nf.id}
                    style={{border:`1.5px solid ${activeNF?.id===nf.id?'#1D9E75':'#e5e7eb'}`,borderRadius:8,padding:'7px 8px 7px 12px',marginBottom:5,position:'relative',background:activeNF?.id===nf.id?'#e6f7f1':'#fff',transition:'all .1s'}}>
                    <div style={{position:'absolute',left:0,top:0,bottom:0,width:4,background:nf.cor||'#ccc',borderRadius:'6px 0 0 6px'}}/>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                      <div style={{width:10,height:10,borderRadius:2,background:nf.cor||'#ccc',flexShrink:0,cursor:'pointer'}} onClick={()=>setActiveNF(activeNF?.id===nf.id?null:nf)}/>
                      <div style={{fontSize:11,fontWeight:600,cursor:'pointer',flex:1}} onClick={()=>setActiveNF(activeNF?.id===nf.id?null:nf)}>NF {nf.numero}</div>
                      {activeNF?.id===nf.id&&<span style={{fontSize:8,background:'#1D9E75',color:'#fff',padding:'1px 5px',borderRadius:8}}>ATIVA</span>}
                    </div>
                    <div style={{fontSize:9,color:'#6b7280',cursor:'pointer'}} onClick={()=>setActiveNF(activeNF?.id===nf.id?null:nf)}>C{nf.fck} · {nf.slump}cm · {nf.volume}m³</div>
                    {/* Status CP */}
                    {liberou&&<div style={{fontSize:9,color:'#065f46',fontWeight:500,marginTop:2}}>✓ Desforma liberada</div>}
                    {pendente12h&&!liberou&&<div style={{fontSize:9,color:'#b45309',fontWeight:500,marginTop:2}}>⚠️ CP 12h pendente</div>}
                    {nf.placa&&<div style={{fontSize:9,color:'#9ca3af'}}>{nf.placa}</div>}
                    <div style={{display:'flex',gap:4,marginTop:5}}>
                      <button onClick={()=>abrirModalNF(nf)} style={{flex:1,padding:'3px 0',border:'1px solid #e5e7eb',borderRadius:5,background:'#f9fafb',cursor:'pointer',fontSize:10,color:'#374151',display:'flex',alignItems:'center',justifyContent:'center',gap:3}}>✏️ Editar</button>
                      <button onClick={()=>handleExcluirNF(nf.id)} style={{padding:'3px 8px',border:'1px solid #fecaca',borderRadius:5,background:'#fff',cursor:'pointer',fontSize:10,color:'#ef4444'}}>✕</button>
                    </div>
                  </div>
                )
              })}
              <button onClick={()=>abrirModalNF()} style={{width:'100%',padding:7,borderRadius:8,border:'1.5px dashed #d1d5db',background:'transparent',color:'#6b7280',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,fontFamily:'inherit',marginTop:3}}>+ Nova NF</button>
            </div>
            {nfs.length>0&&(
              <div style={{padding:'8px 12px',borderTop:'1px solid #f3f4f6'}}>
                <div style={{fontSize:9,fontWeight:500,color:'#9ca3af',marginBottom:4}}>Legenda</div>
                {nfs.map(nf=>(
                  <div key={nf.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:9,color:'#6b7280',marginBottom:3}}>
                    <div style={{width:10,height:10,borderRadius:2,background:nf.cor||'#ccc',flexShrink:0}}/>
                    NF {nf.numero} · {nf.volume||'—'}m³
                  </div>
                ))}
                <div style={{marginTop:5,padding:'4px 8px',background:'#f9fafb',borderRadius:5,fontSize:9}}>
                  <span style={{fontWeight:500}}>{nfs.length} NFs · </span>
                  {nfs.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0).toFixed(1)} m³
                </div>
                {/* Atalho para CPs */}
                <button onClick={()=>setTelaAtiva('cps')}
                  style={{width:'100%',marginTop:8,padding:'6px',border:'1px solid #e5e7eb',borderRadius:6,background:'#f9fafb',cursor:'pointer',fontSize:10,color:'#374151',display:'flex',alignItems:'center',justifyContent:'center',gap:5,fontFamily:'inherit'}}>
                  🧪 Ver controle de CPs
                  {cpsPendentes12h>0&&<span style={{background:'#f59e0b',color:'#fff',borderRadius:'50%',width:14,height:14,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700}}>{cpsPendentes12h}</span>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* STATUS */}
      <div style={{height:26,background:'#fff',borderTop:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:'0 12px',gap:14,fontSize:9,color:'#6b7280',flexShrink:0}}>
        <span style={{display:'flex',alignItems:'center',gap:3}}><span style={{width:5,height:5,borderRadius:'50%',background:'#1D9E75',display:'inline-block'}}/>Conectado</span>
        <span>{activeNF?`🖌️ NF ${activeNF.numero} ativa`:'Selecione uma NF para pintar'}</span>
        {cpsPendentes12h>0&&<span style={{color:'#b45309',fontWeight:500}}>⚠️ {cpsPendentes12h} CP(s) 12h aguardando resultado</span>}
        <span style={{marginLeft:'auto'}}>☁️ {sessao.user.email}</span>
      </div>

      {/* MODAIS */}
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
              <button onClick={handleCriarObra} style={{padding:'8px 16px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}}>Criar Obra</button>
            </div>
          </div>
        </div>
      )}

      {modalEditObra&&currentObra&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:22,width:'100%',maxWidth:420}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div><div style={{fontSize:15,fontWeight:600}}>Editar Obra</div><div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{currentObra.nome}</div></div>
              <button onClick={()=>setModalEditObra(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>
            {[['Nome da Obra *','nome','text',''],['Endereço','endereco','text','']].map(([lb,k,t,ph])=>(
              <div key={k} style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
                <input value={editObra[k]||''} onChange={e=>setEditObra(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                  style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
              </div>
            ))}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>Progresso (%)</label>
              <input type="number" min="0" max="100" value={editObra.progresso||0} onChange={e=>setEditObra(p=>({...p,progresso:parseInt(e.target.value)||0}))}
                style={{width:'100%',padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'space-between'}}>
              <button onClick={handleExcluirObra} style={{padding:'8px 14px',border:'1px solid #fecaca',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12,color:'#ef4444'}}>🗑️ Excluir</button>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setModalEditObra(false)} style={{padding:'8px 16px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12}}>Cancelar</button>
                <button onClick={handleEditarObra} style={{padding:'8px 16px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalEditPav&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:22,width:'100%',maxWidth:420,maxHeight:'80vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div><div style={{fontSize:15,fontWeight:600}}>Editar Pavimentos</div><div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{currentTorre?.nome}</div></div>
              <button onClick={()=>setModalEditPav(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>
            <div style={{fontSize:11,color:'#6b7280',marginBottom:12,padding:'8px 12px',background:'#f9fafb',borderRadius:8}}>
              💡 Renomeie cada pavimento e defina se é <strong>Tipo</strong> ou <strong>Especial</strong> (platibanda)
            </div>
            {editPavs.map((p,i)=>(
              <div key={p.id} style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
                <span style={{fontSize:10,color:'#9ca3af',minWidth:18,textAlign:'right'}}>{i+1}.</span>
                <input value={p.nome} onChange={e=>setEditPavs(prev=>prev.map((pv,idx)=>idx===i?{...pv,nome:e.target.value}:pv))}
                  style={{flex:1,padding:'7px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                <select value={p.tipo||'tipo'} onChange={e=>setEditPavs(prev=>prev.map((pv,idx)=>idx===i?{...pv,tipo:e.target.value}:pv))}
                  style={{padding:'7px 8px',border:'1px solid #d1d5db',borderRadius:6,fontSize:11,outline:'none',fontFamily:'inherit',color:'#374151'}}>
                  <option value="tipo">Tipo</option>
                  <option value="especial">Especial</option>
                </select>
              </div>
            ))}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
              <button onClick={()=>setModalEditPav(false)} style={{padding:'8px 16px',border:'1px solid #e5e7eb',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12}}>Cancelar</button>
              <button onClick={handleSalvarPavs} style={{padding:'8px 16px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {modalNF&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:22,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div><div style={{fontSize:15,fontWeight:600}}>{editingNF?'Editar NF':'Cadastrar NF'}</div><div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{currentObra?.nome}</div></div>
              <button onClick={()=>setModalNF(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>
            {editingNF&&(
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,padding:'8px 12px',background:(editingNF.cor||'#eee')+'22',borderRadius:8,border:`1px solid ${editingNF.cor||'#eee'}`}}>
                <div style={{width:14,height:14,borderRadius:3,background:editingNF.cor||'#eee'}}/>
                <span style={{fontSize:11,fontWeight:500}}>NF {editingNF.numero}</span>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[['Número da NF *','numero','text','Ex: 9445'],['Data da concretagem','data','date',''],
                ['Concreteira','concreteira','text','Nome da usina'],['Caminhão (BT)','caminhao','text','Ex: BT 68'],
                ['Placa do caminhão','placa','text','Ex: ABC-1234'],['fck (MPa)','fck','text','Ex: 25'],
                ['Slump (cm)','slump','text','Ex: 22'],['Volume (m³)','volume','text','Ex: 7,0'],
                ['Hora chegada BT','horario','time',''],['Início descarga','inicio_descarga','time',''],
                ['Hora moldagem CP','hora_moldagem','time',''],['Fim descarga','fim_descarga','time',''],
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
              {editingNF&&<button onClick={()=>{handleExcluirNF(editingNF.id);setModalNF(false)}} style={{padding:'8px 16px',border:'1px solid #fecaca',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:12,color:'#ef4444'}}>Excluir</button>}
              <button onClick={handleSalvarNF} style={{padding:'8px 16px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:500}}>
                {editingNF?'Salvar alterações':'Cadastrar NF'}
              </button>
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
function PlantaCanvas({plantaImg,paintData,activeNF,tool,brushSize,opacity,onUpload,onCanvasReady,onSavePaint}){
  const bgRef=useRef(null),paintRef=useRef(null),wrapperRef=useRef(null)
  const zoomRef=useRef(1),panRef=useRef({x:0,y:0})
  const[zoomPct,setZoomPct]=useState(100)
  const isPainting=useRef(false),isPanning=useRef(false)
  const lastMouse=useRef({x:0,y:0}),lastPaintPos=useRef(null)
  const saveTimer=useRef(null)
  const CW=1200,CH=700

  useEffect(()=>{if(bgRef.current&&paintRef.current&&onCanvasReady) onCanvasReady(bgRef.current,paintRef.current)},[])
  useEffect(()=>{
    if(!plantaImg) return
    const img=new Image()
    img.onload=()=>{const ctx=bgRef.current?.getContext('2d');if(!ctx) return;ctx.clearRect(0,0,CW,CH);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,CW,CH);const sc=Math.min(CW/img.width,CH/img.height)*0.95;ctx.drawImage(img,(CW-img.width*sc)/2,(CH-img.height*sc)/2,img.width*sc,img.height*sc)}
    img.src=plantaImg
  },[plantaImg])
  useEffect(()=>{
    if(!paintRef.current) return
    const ctx=paintRef.current.getContext('2d');ctx.clearRect(0,0,CW,CH)
    if(!paintData) return
    const img=new Image();img.onload=()=>ctx.drawImage(img,0,0);img.src=paintData
  },[paintData])
  function applyT(){if(wrapperRef.current) wrapperRef.current.style.transform=`translate(${panRef.current.x}px,${panRef.current.y}px) scale(${zoomRef.current})`;setZoomPct(Math.round(zoomRef.current*100))}
  function scheduleSave(){clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>{if(!paintRef.current) return;onSavePaint(paintRef.current.toDataURL('image/png'))},1500)}
  function toCanvas(sx,sy){const el=bgRef.current?.parentElement?.parentElement;if(!el) return{x:0,y:0};const r=el.getBoundingClientRect();return{x:(sx-r.left-panRef.current.x)/zoomRef.current,y:(sy-r.top-panRef.current.y)/zoomRef.current}}
  function getXY(e){return e.touches?{x:e.touches[0].clientX,y:e.touches[0].clientY}:{x:e.clientX,y:e.clientY}}
  function paintAt(pos){
    const c=paintRef.current;if(!c) return;const ctx=c.getContext('2d')
    const alpha=Math.round(opacity*255).toString(16).padStart(2,'0')
    if(tool==='erase'){ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(pos.x,pos.y,brushSize*1.5,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,1)';ctx.fill();ctx.globalCompositeOperation='source-over'}
    else if(tool==='pen'&&activeNF){
      ctx.globalCompositeOperation='source-over';ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=brushSize;ctx.strokeStyle=(activeNF.cor||'#000')+alpha
      if(lastPaintPos.current){ctx.beginPath();ctx.moveTo(lastPaintPos.current.x,lastPaintPos.current.y);ctx.lineTo(pos.x,pos.y);ctx.stroke()}
      else{ctx.beginPath();ctx.arc(pos.x,pos.y,brushSize/2,0,Math.PI*2);ctx.fillStyle=(activeNF.cor||'#000')+alpha;ctx.fill()}
    }
    lastPaintPos.current=pos
  }
  function onDown(e){e.preventDefault();const xy=getXY(e);lastMouse.current=xy;if(tool==='pan'){isPanning.current=true;return};if(tool==='pen'&&!activeNF) return;isPainting.current=true;lastPaintPos.current=null;paintAt(toCanvas(xy.x,xy.y))}
  function onMove(e){e.preventDefault();const xy=getXY(e);if(isPanning.current){panRef.current={x:panRef.current.x+(xy.x-lastMouse.current.x),y:panRef.current.y+(xy.y-lastMouse.current.y)};lastMouse.current=xy;applyT();return};if(isPainting.current){paintAt(toCanvas(xy.x,xy.y));lastMouse.current=xy}}
  function onUp(){if(isPainting.current) scheduleSave();isPainting.current=false;isPanning.current=false;lastPaintPos.current=null}
  function onWheel(e){e.preventDefault();const f=e.deltaY<0?1.12:0.9;const el=bgRef.current?.parentElement?.parentElement;if(!el) return;const r=el.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;const nz=Math.max(0.15,Math.min(8,zoomRef.current*f));panRef.current={x:mx-(mx-panRef.current.x)*(nz/zoomRef.current),y:my-(my-panRef.current.y)*(nz/zoomRef.current)};zoomRef.current=nz;applyT()}
  function limpar(){if(!window.confirm('Limpar toda a pintura?')) return;paintRef.current?.getContext('2d')?.clearRect(0,0,CW,CH);onSavePaint(paintRef.current.toDataURL('image/png'))}

  if(!plantaImg) return(
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f7f4'}}>
      <div style={{textAlign:'center',padding:40,maxWidth:360}}>
        <div style={{fontSize:56,marginBottom:16}}>🖼️</div>
        <div style={{fontSize:18,fontWeight:600,color:'#374151',marginBottom:8}}>Carregar planta deste pavimento</div>
        <div style={{fontSize:13,color:'#6b7280',marginBottom:4}}>Aceita JPG ou PNG</div>
        <div style={{fontSize:12,color:'#9ca3af',marginBottom:24}}>Salva automaticamente na nuvem</div>
        <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 28px',background:'#1D9E75',color:'#fff',borderRadius:8,fontSize:14,cursor:'pointer',fontWeight:500}}>
          📁 Selecionar imagem
          <input type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(!f) return;const r=new FileReader();r.onload=ev=>onUpload(ev.target.result);r.readAsDataURL(f)}} style={{display:'none'}}/>
        </label>
      </div>
    </div>
  )
  return(
    <div style={{flex:1,overflow:'hidden',background:'#e8e5de',position:'relative',cursor:tool==='pan'?'grab':'crosshair',userSelect:'none',touchAction:'none'}}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} onWheel={onWheel}>
      {activeNF&&<div style={{position:'absolute',top:10,left:10,zIndex:10,background:activeNF.cor||'#ccc',padding:'4px 12px',borderRadius:6,fontSize:11,fontWeight:700,color:'#333',pointerEvents:'none'}}>🖌️ NF {activeNF.numero}</div>}
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
