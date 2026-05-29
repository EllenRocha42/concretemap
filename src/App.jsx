import { useState, useEffect, useRef } from 'react'
import { supabase, salvarImagemPlanta, salvarPinturaStorage } from './supabase'
import Dashboard from './Dashboard'

const NF_COLORS=['#FFE44A','#5EE07A','#4DC8F0','#F4A0C0','#FF9B3D','#A78BFA','#F87171','#34D399','#60A5FA','#FBBF24']
const NF_VAZIA={numero:'',data:new Date().toISOString().slice(0,10),fck:'',slump:'',volume:'',concreteira:'',horario:'',caminhao:'',placa:'',inicio_descarga:'',hora_moldagem:'',fim_descarga:'',agua_adicionada:'',agua_autorizado_por:''}
const CP_VAZIA={numero_cp:'',data_moldagem:new Date().toISOString().slice(0,10),hora_moldagem:'',responsavel:'',tipo:'12h',data_ruptura:'',resultado_mpa:'',observacao:''}

// ── HOOK: detectar mobile ──────────────────────────────────────
function useIsMobile(){ 
  const[m,setM]=useState(window.innerWidth<768)
  useEffect(()=>{const fn=()=>setM(window.innerWidth<768);window.addEventListener('resize',fn);return()=>window.removeEventListener('resize',fn)},[])
  return m
}

// ── PDF ───────────────────────────────────────────────────────
async function gerarPDF(obra,torre,pav,nfs,paintCanvas,bgCanvas,viewMode){
  if(!window.jspdf){await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
  const{jsPDF}=window.jspdf;const pdf=new jsPDF('landscape','mm','a4')
  const PW=pdf.internal.pageSize.getWidth(),PH=pdf.internal.pageSize.getHeight()
  const hoje=new Date().toLocaleDateString('pt-BR'),hora=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
  pdf.setFillColor(29,158,117);pdf.rect(0,0,PW,14,'F')
  pdf.setTextColor(255,255,255);pdf.setFontSize(13);pdf.setFont('helvetica','bold')
  pdf.text('MAPEAMENTO DE CONCRETO — ESTRUTURA',PW/2,9,{align:'center'})
  pdf.setFontSize(8);pdf.text('ConcreteMap',PW-10,9,{align:'right'})
  pdf.setTextColor(50,50,50);pdf.setFontSize(9);pdf.setFont('helvetica','normal')
  pdf.text(`Obra: ${obra.nome}`,10,20);pdf.text(`Torre: ${torre.nome}`,10,25)
  pdf.text(`Pavimento: ${pav.nome}`,10,30);pdf.text(`Data: ${hoje} ${hora}`,PW-10,20,{align:'right'})
  pdf.setFont('helvetica','bold');pdf.text(`${nfs.length} NFs · ${nfs.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0).toFixed(1)} m³`,PW-10,26,{align:'right'})
  pdf.setDrawColor(200,200,200);pdf.setLineWidth(0.3);pdf.line(10,34,PW-10,34)
  const cols=['NF','Data','Placa','Vol.','fck','Slump','Chegada','Início','Moldagem','Fim','Concreteira']
  const colW=[18,20,18,14,12,14,16,18,16,16,30]
  let tx=10,ty=40
  pdf.setFillColor(245,245,245);pdf.rect(tx,ty-4,colW.reduce((a,b)=>a+b,0),6,'F')
  pdf.setFont('helvetica','bold');pdf.setFontSize(7);pdf.setTextColor(80,80,80)
  cols.forEach((c,i)=>{pdf.text(c,tx+1,ty);tx+=colW[i]});ty+=3
  nfs.forEach(nf=>{tx=10;pdf.setFont('helvetica','normal');pdf.setFontSize(7);const rgb=hexRgb(nf.cor||'#ccc');pdf.setFillColor(rgb[0],rgb[1],rgb[2]);pdf.rect(tx,ty-3,colW[0],5,'F');const row=[nf.numero,nf.data?new Date(nf.data+'T00:00:00').toLocaleDateString('pt-BR'):'—',nf.placa||'—',nf.volume||'—',`C${nf.fck||'—'}`,`${nf.slump||'—'}cm`,nf.horario||'—',nf.inicio_descarga||'—',nf.hora_moldagem||'—',nf.fim_descarga||'—',nf.concreteira||'—'];pdf.setTextColor(40,40,40);row.forEach((v,i)=>{if(i>0)pdf.text(String(v),tx+1,ty);tx+=colW[i]});pdf.text(nf.numero,11,ty);ty+=5;pdf.setDrawColor(230,230,230);pdf.setLineWidth(0.1);pdf.line(10,ty-1,10+colW.reduce((a,b)=>a+b,0),ty-1)})
  if(bgCanvas&&paintCanvas){const tmp=document.createElement('canvas');tmp.width=bgCanvas.width;tmp.height=bgCanvas.height;const tc=tmp.getContext('2d');tc.drawImage(bgCanvas,0,0);tc.drawImage(paintCanvas,0,0);pdf.addImage(tmp.toDataURL('image/jpeg',0.9),'JPEG',10,ty+3,PW-20,PH-ty-21)}
  const legY=PH-12;pdf.setFillColor(250,250,250);pdf.rect(0,legY-2,PW,14,'F');pdf.setDrawColor(220,220,220);pdf.line(0,legY-2,PW,legY-2);pdf.setFontSize(7);pdf.setFont('helvetica','bold');pdf.setTextColor(100,100,100);pdf.text('LEGENDA:',10,legY+3);let lx=32
  nfs.forEach(nf=>{const rgb=hexRgb(nf.cor||'#ccc');pdf.setFillColor(rgb[0],rgb[1],rgb[2]);pdf.rect(lx,legY,8,4,'F');pdf.setFont('helvetica','normal');pdf.setTextColor(50,50,50);pdf.text(`NF ${nf.numero} (${nf.volume||'—'}m³)`,lx+10,legY+3);lx+=48})
  pdf.setFontSize(6);pdf.setTextColor(180,180,180);pdf.text(`ConcreteMap · ${obra.nome} · ${hoje} ${hora}`,PW/2,PH-2,{align:'center'})
  pdf.save(`MC_${obra.nome.replace(/\s/g,'_')}_${pav.nome}_${hoje.replace(/\//g,'')}.pdf`)
}
function hexRgb(hex){return[parseInt(hex.slice(1,3),16)||200,parseInt(hex.slice(3,5),16)||200,parseInt(hex.slice(5,7),16)||200]}

// ── LOGIN ─────────────────────────────────────────────────────
function TelaLogin({onLogin}){
  const[email,setEmail]=useState('');const[senha,setSenha]=useState('');const[erro,setErro]=useState('');const[loading,setLoading]=useState(false);const[show,setShow]=useState(false)
  async function handleLogin(e){e.preventDefault();if(!email.trim()||!senha.trim()){setErro('Preencha email e senha');return};setLoading(true);setErro('');const{error}=await supabase.auth.signInWithPassword({email,password:senha});setLoading(false);if(error)setErro('Email ou senha incorretos');else onLogin()}
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f8f7f4',fontFamily:'system-ui,sans-serif',padding:16}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:48,marginBottom:8}}>🏗️</div>
          <div style={{fontSize:24,fontWeight:700,color:'#1D9E75'}}>ConcreteMap</div>
          <div style={{fontSize:13,color:'#9ca3af',marginTop:4}}>Rastreabilidade de Concretagem</div>
        </div>
        <div style={{background:'#fff',borderRadius:16,padding:24,boxShadow:'0 4px 24px rgba(0,0,0,.08)',border:'1px solid #e5e7eb'}}>
          <form onSubmit={handleLogin}>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:13,fontWeight:500,color:'#374151',display:'block',marginBottom:6}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com.br" autoComplete="email"
                style={{width:'100%',padding:'12px 14px',border:`1px solid ${erro?'#fca5a5':'#d1d5db'}`,borderRadius:10,fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:13,fontWeight:500,color:'#374151',display:'block',marginBottom:6}}>Senha</label>
              <div style={{position:'relative'}}>
                <input type={show?'text':'password'} value={senha} onChange={e=>setSenha(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                  style={{width:'100%',padding:'12px 44px 12px 14px',border:`1px solid ${erro?'#fca5a5':'#d1d5db'}`,borderRadius:10,fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
                <button type="button" onClick={()=>setShow(s=>!s)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#9ca3af',padding:0}}>{show?'🙈':'👁️'}</button>
              </div>
            </div>
            {erro&&<div style={{marginBottom:14,padding:'10px 14px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,fontSize:13,color:'#dc2626'}}>⚠️ {erro}</div>}
            <button type="submit" disabled={loading} style={{width:'100%',padding:'14px',background:loading?'#9ca3af':'#1D9E75',color:'#fff',border:'none',borderRadius:10,fontSize:15,fontWeight:600,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit'}}>
              {loading?'Entrando...':'Entrar'}
            </button>
          </form>
        </div>
        <div style={{textAlign:'center',marginTop:16,fontSize:12,color:'#9ca3af'}}>VL Construtora · Sistema Interno</div>
      </div>
    </div>
  )
}

// ── HOOKS ─────────────────────────────────────────────────────
function useObras(){
  const[obras,setObras]=useState([]);const[loading,setLoading]=useState(true)
  async function carregar(){setLoading(true);const{data:od}=await supabase.from('obras').select('*').order('criado_em');if(!od){setLoading(false);return};const oc=await Promise.all(od.map(async o=>{const{data:td}=await supabase.from('torres').select('*').eq('obra_id',o.id).order('ordem');const torres=await Promise.all((td||[]).map(async t=>{const{data:pd}=await supabase.from('pavimentos').select('*').eq('torre_id',t.id).order('ordem');return{...t,pavimentos:pd||[]}}));return{...o,torres}}));setObras(oc);setLoading(false)}
  async function criarObra(nome,endereco,nT,nP,cor){const{data:o}=await supabase.from('obras').insert({nome,endereco,cor,progresso:0}).select().single();if(!o) return null;for(let i=1;i<=nT;i++){const{data:t}=await supabase.from('torres').insert({obra_id:o.id,nome:`Torre ${String(i).padStart(2,'0')}`,ordem:i}).select().single();if(!t) continue;for(let j=1;j<=nP;j++) await supabase.from('pavimentos').insert({torre_id:t.id,nome:`Pavimento ${String(j).padStart(2,'0')}`,ordem:j})};await carregar();return o}
  async function editarObra(id,d){await supabase.from('obras').update(d).eq('id',id);await carregar()}
  async function excluirObra(id){await supabase.from('obras').delete().eq('id',id);await carregar()}
  async function salvarPavimentos(pavs){for(const p of pavs) await supabase.from('pavimentos').update({nome:p.nome,tipo:p.tipo||'tipo'}).eq('id',p.id);await carregar()}
  useEffect(()=>{carregar()},[])
  return{obras,loading,carregar,criarObra,editarObra,excluirObra,salvarPavimentos}
}

function useNFs(obraId, pavimentoId){
  const[nfs,setNfs]=useState([])
  async function carregar(){
    if(!obraId){setNfs([]);return}
    if(!pavimentoId){setNfs([]);return}
    const{data}=await supabase
      .from('nfs')
      .select('*')
      .eq('obra_id',obraId)
      .eq('pavimento_id',pavimentoId)
      .order('criado_em')
    setNfs(data||[])
  }
  async function salvar(f,eid,cor,torreId,pavId){
    const p={obra_id:obraId,torre_id:torreId||null,pavimento_id:pavId||null,numero:f.numero,data:f.data||null,fck:f.fck,slump:f.slump,volume:f.volume,concreteira:f.concreteira,horario:f.horario||null,caminhao:f.caminhao,placa:f.placa,inicio_descarga:f.inicio_descarga||null,hora_moldagem:f.hora_moldagem||null,fim_descarga:f.fim_descarga||null,agua_adicionada:parseFloat(f.agua_adicionada)||null,agua_autorizado_por:f.agua_autorizado_por||null,cor}
    if(eid) await supabase.from('nfs').update(p).eq('id',eid)
    else await supabase.from('nfs').insert(p)
    await carregar()
  }
  async function excluir(id){await supabase.from('nfs').delete().eq('id',id);await carregar()}
  useEffect(()=>{carregar()},[obraId,pavimentoId])
  return{nfs,salvar,excluir}
}

function useCPs(obraId){
  const[cps,setCps]=useState([])
  async function carregar(){if(!obraId){setCps([]);return};const{data}=await supabase.from('cps').select('*').eq('obra_id',obraId).order('criado_em');setCps(data||[])}
  async function salvar(f,nfId,eid){const mpa=parseFloat(f.resultado_mpa)||null;const desf=f.tipo==='12h'&&mpa!==null&&mpa>=3;const st=f.tipo==='12h'&&mpa!==null?(mpa>=3?'aprovado':'reprovado'):mpa!==null?'concluido':'pendente';const p={obra_id:obraId,nf_id:nfId,numero_cp:f.numero_cp,data_moldagem:f.data_moldagem||null,hora_moldagem:f.hora_moldagem||null,responsavel:f.responsavel,tipo:f.tipo,data_ruptura:f.data_ruptura||null,resultado_mpa:mpa,status:st,observacao:f.observacao,desforma_liberada:desf,liberado_por:desf?f.responsavel:null,liberado_em:desf?new Date().toISOString():null};if(eid) await supabase.from('cps').update(p).eq('id',eid);else await supabase.from('cps').insert(p);await carregar()}
  async function excluir(id){await supabase.from('cps').delete().eq('id',id);await carregar()}
  useEffect(()=>{carregar()},[obraId])
  return{cps,salvar,excluir}
}

function usePlanta(obraId,torreId,pavId){
  const[plantaImg,setPlantaImg]=useState(null);const[paintData,setPaintData]=useState(null)

  async function carregarPlanta(){
    if(!pavId){setPlantaImg(null);return}
    // Tenta planta específica do pavimento
    const{data}=await supabase.from('plantas').select('imagem_url,imagem_data').eq('pavimento_id',pavId).single()
    if(data?.imagem_url){setPlantaImg(data.imagem_url);return}
    if(data?.imagem_data){setPlantaImg(data.imagem_data);return}
    // Fallback: planta de outro pavimento da mesma obra
    const{data:d2}=await supabase.from('plantas').select('imagem_url,imagem_data').eq('obra_id',obraId).not('imagem_url','is',null).limit(1).single()
    if(d2?.imagem_url){setPlantaImg(d2.imagem_url);return}
    const{data:d3}=await supabase.from('plantas').select('imagem_url,imagem_data').eq('obra_id',obraId).limit(1).single()
    setPlantaImg(d3?.imagem_url||d3?.imagem_data||null)
  }

  async function salvarPlanta(dataUrl){
    if(!pavId||!obraId||!torreId) return
    // Upload para Storage e pegar URL pública
    const publicUrl = await salvarImagemPlanta(pavId, dataUrl)
    const urlParaSalvar = publicUrl || dataUrl // fallback para base64 se storage falhar
    await supabase.from('plantas').upsert({
      obra_id:obraId,torre_id:torreId,pavimento_id:pavId,
      imagem_url: publicUrl||null,
      imagem_data: publicUrl?null:dataUrl, // só salva base64 se storage falhar
      atualizado_em:new Date().toISOString()
    },{onConflict:'pavimento_id'})
    setPlantaImg(urlParaSalvar)
  }

  async function carregarPintura(vm){
    if(!pavId){setPaintData(null);return}
    const{data}=await supabase.from('pinturas').select('imagem_url,imagem_data').eq('pavimento_id',pavId).eq('view_mode',vm).single()
    setPaintData(data?.imagem_url||data?.imagem_data||null)
  }

  async function salvarPintura(dataUrl,vm){
    if(!pavId) return
    const publicUrl = await salvarPinturaStorage(pavId, vm, dataUrl)
    await supabase.from('pinturas').upsert({
      pavimento_id:pavId,view_mode:vm,
      imagem_url: publicUrl||null,
      imagem_data: publicUrl?null:dataUrl,
      atualizado_em:new Date().toISOString()
    },{onConflict:'pavimento_id, view_mode'})
    setPaintData(publicUrl||dataUrl)
  }

  useEffect(()=>{carregarPlanta()},[pavId])
  return{plantaImg,paintData,salvarPlanta,carregarPintura,salvarPintura}
}

// ── APP ROOT ──────────────────────────────────────────────────
export default function App(){
  const[sessao,setSessao]=useState(null);const[check,setCheck]=useState(true)
  useEffect(()=>{supabase.auth.getSession().then(({data:{session}})=>{setSessao(session);setCheck(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSessao(s));return()=>subscription.unsubscribe()},[])
  async function handleLogout(){await supabase.auth.signOut();setSessao(null)}
  if(check) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'system-ui',flexDirection:'column',gap:12}}><div style={{fontSize:40}}>🏗️</div><div style={{fontSize:14,color:'#6b7280'}}>Carregando...</div></div>
  if(!sessao) return <TelaLogin onLogin={()=>supabase.auth.getSession().then(({data:{session}})=>setSessao(session))}/>
  return <AppInterno sessao={sessao} onLogout={handleLogout}/>
}

// ── APP INTERNO ───────────────────────────────────────────────
function AppInterno({sessao,onLogout}){
  const isMobile=useIsMobile()
  const{obras,loading,carregar:recarregar,criarObra,editarObra,excluirObra,salvarPavimentos}=useObras()
  const[currentObra,setCurrentObra]=useState(null)
  const[currentTorre,setCurrentTorre]=useState(null)
  const[currentPav,setCurrentPav]=useState(null)
  const[activeNF,setActiveNF]=useState(null)
  const[tool,setTool]=useState('pen')
  const[brushSize,setBrushSize]=useState(22)
  const[opacity,setOpacity]=useState(0.65)
  const[viewMode,setViewMode]=useState('parede')
  const[tela,setTela]=useState('obras') // obras|mapa|cps|dashboard
  const[modalObra,setModalObra]=useState(false)
  const[modalEditObra,setModalEditObra]=useState(false)
  const[modalEditPav,setModalEditPav]=useState(false)
  const[modalNF,setModalNF]=useState(false)
  const[modalCP,setModalCP]=useState(false)
  const[editingNF,setEditingNF]=useState(null)
  const[editingCP,setEditingCP]=useState(null)
  const[nfParaCP,setNfParaCP]=useState(null)
  const[formNF,setFormNF]=useState({...NF_VAZIA})
  const[formCP,setFormCP]=useState({...CP_VAZIA})
  const[novaObra,setNovaObra]=useState({nome:'',endereco:'',torres:1,pavimentos:5})
  const[editObra,setEditObra]=useState({nome:'',endereco:'',progresso:0})
  const[editPavs,setEditPavs]=useState([])
  const[toast,setToast]=useState('')
  const[salvando,setSalvando]=useState(false)
  const[sidebarOpen,setSidebarOpen]=useState(false)
  const canvasRefs=useRef({bg:null,paint:null})

  const{nfs,salvar:salvarNF,excluir:excluirNFDB}=useNFs(currentObra?.id, currentPav?.id)
  const{cps,salvar:salvarCP,excluir:excluirCPDB}=useCPs(currentObra?.id)
  const{plantaImg,paintData,salvarPlanta,carregarPintura,salvarPintura}=usePlanta(currentObra?.id,currentTorre?.id,currentPav?.id)

  useEffect(()=>{if(currentPav) carregarPintura(viewMode)},[currentPav,viewMode])


  function showToast(msg,dur=2500){setToast(msg);setTimeout(()=>setToast(''),dur)}

  function selecionarObra(o){setCurrentObra(o);setCurrentTorre(o.torres?.[0]||null);setCurrentPav(null);setActiveNF(null);setTela('mapa');setSidebarOpen(false)}
  function selecionarPav(p){setCurrentPav(currentPav?.id===p.id?null:p);if(isMobile) setSidebarOpen(false)}

  async function handleCriarObra(){
    if(!novaObra.nome.trim()){showToast('Informe o nome');return}
    const cores=['#1D9E75','#3b82f6','#f59e0b','#ef4444','#8b5cf6']
    await criarObra(novaObra.nome,novaObra.endereco,novaObra.torres,novaObra.pavimentos,cores[obras.length%cores.length])
    setModalObra(false);setNovaObra({nome:'',endereco:'',torres:1,pavimentos:5})
    showToast('Obra criada!')
  }
  async function handleEditarObra(){
    if(!editObra.nome?.trim()){showToast('Informe o nome');return}
    await editarObra(currentObra.id,{nome:editObra.nome,endereco:editObra.endereco,progresso:parseInt(editObra.progresso)||0})
    setCurrentObra(p=>({...p,...editObra}));setModalEditObra(false);showToast('Obra atualizada!')
  }
  async function handleExcluirObra(){
    if(!window.confirm(`Excluir "${currentObra.nome}"?`)) return
    await excluirObra(currentObra.id);setCurrentObra(null);setCurrentTorre(null);setCurrentPav(null);setTela('obras')
    showToast('Obra excluída')
  }
  async function handleSalvarPavs(){await salvarPavimentos(editPavs);setModalEditPav(false);showToast('Pavimentos atualizados!')}

  function abrirNF(nf=null){
    if(nf){setEditingNF(nf);setFormNF({numero:nf.numero||'',data:nf.data||new Date().toISOString().slice(0,10),fck:nf.fck||'',slump:nf.slump||'',volume:nf.volume||'',concreteira:nf.concreteira||'',horario:nf.horario||'',caminhao:nf.caminhao||'',placa:nf.placa||'',inicio_descarga:nf.inicio_descarga||'',hora_moldagem:nf.hora_moldagem||'',fim_descarga:nf.fim_descarga||'',agua_adicionada:nf.agua_adicionada||'',agua_autorizado_por:nf.agua_autorizado_por||''})}
    else{setEditingNF(null);setFormNF({...NF_VAZIA})}
    setModalNF(true)
  }
  async function handleSalvarNF(){
    if(!formNF.numero.trim()){showToast('Informe o número da NF');return}
    const cor=editingNF?editingNF.cor:NF_COLORS[nfs.length%NF_COLORS.length]
    await salvarNF(formNF,editingNF?.id,cor,currentTorre?.id,currentPav?.id)
    setModalNF(false);setEditingNF(null)
    showToast(editingNF?'NF atualizada!':'NF cadastrada!')
  }
  async function handleExcluirNF(id){
    if(!window.confirm('Excluir esta NF?')) return
    await excluirNFDB(id);if(activeNF?.id===id) setActiveNF(null);showToast('NF excluída')
  }

  function abrirCP(cp=null,nf=null){
    if(cp){setEditingCP(cp);setNfParaCP(nfs.find(n=>n.id===cp.nf_id)||null);setFormCP({numero_cp:cp.numero_cp||'',data_moldagem:cp.data_moldagem||new Date().toISOString().slice(0,10),hora_moldagem:cp.hora_moldagem||'',responsavel:cp.responsavel||'',tipo:cp.tipo||'12h',data_ruptura:cp.data_ruptura||'',resultado_mpa:cp.resultado_mpa||'',observacao:cp.observacao||''})}
    else{setEditingCP(null);setNfParaCP(nf);setFormCP({...CP_VAZIA,data_moldagem:nf?.data||new Date().toISOString().slice(0,10)})}
    setModalCP(true)
  }
  async function handleSalvarCP(){
    if(!nfParaCP){showToast('Selecione uma NF');return}
    await salvarCP(formCP,nfParaCP.id,editingCP?.id)
    setModalCP(false);showToast('CP salvo!')
  }

  async function handleUploadPlanta(url){setSalvando(true);await salvarPlanta(url);setSalvando(false);showToast('Planta salva! ✓')}
  async function handleSalvarPintura(url){await salvarPintura(url,viewMode)}
  async function exportarPDF(){
    if(!currentObra||!currentTorre||!currentPav){showToast('Selecione um pavimento');return}
    showToast('Gerando PDF...',4000)
    await gerarPDF(currentObra,currentTorre,currentPav,nfs,canvasRefs.current.paint,canvasRefs.current.bg,viewMode)
    showToast('PDF gerado!')
  }

  const cpsPendentes12h=cps.filter(c=>c.tipo==='12h'&&(c.resultado_mpa===null||c.resultado_mpa===undefined)).length

  const TABELA_CAMPOS=[
    {key:'volume',label:'Volume (m³)'},{key:'horario',label:'Chegada BT'},
    {key:'inicio_descarga',label:'Início desc.'},{key:'hora_moldagem',label:'Moldagem'},
    {key:'fim_descarga',label:'Fim desc.'},{key:'placa',label:'Placa'},
    {key:'slump',label:'Slump'},{key:'fck',label:'fck'},{key:'concreteira',label:'Concreteira'},{key:'agua_adicionada',label:'Água (L)'},{key:'agua_autorizado_por',label:'Autorizado'},
  ]

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'system-ui',flexDirection:'column',gap:12}}><div style={{fontSize:40}}>🏗️</div><div style={{fontSize:14,color:'#6b7280'}}>Carregando...</div></div>

  // ── TELAS ESPECIAIS ──
  if(tela==='dashboard') return(
    <div style={{height:'100vh',display:'flex',flexDirection:'column'}}>
      <Dashboard obras={obras} nfs={nfs} cps={cps} onClose={()=>setTela(currentObra?'mapa':'obras')}/>
    </div>
  )

  if(tela==='cps'&&currentObra) return(
    <div style={{height:'100vh',display:'flex',flexDirection:'column',fontFamily:'system-ui'}}>
      <TelaCPs obra={currentObra} nfs={nfs} cps={cps} isMobile={isMobile}
        onSalvarCP={async(f,nfId,eid)=>{await salvarCP(f,nfId,eid);showToast('CP salvo!')}}
        onExcluirCP={async(id)=>{await excluirCPDB(id);showToast('CP excluído')}}
        onClose={()=>setTela('mapa')}/>
      {toast&&<Toast msg={toast}/>}
    </div>
  )

  // ── LAYOUT PRINCIPAL ──
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:'system-ui,sans-serif',background:'#f8f7f4',overflow:'hidden'}}>

      {/* TOPBAR */}
      <div style={{height:isMobile?52:52,background:'#fff',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:`0 ${isMobile?12:14}px`,gap:8,flexShrink:0,zIndex:100}}>
        {/* Hamburger mobile */}
        {isMobile&&(
          <button onClick={()=>setSidebarOpen(s=>!s)} style={{width:36,height:36,border:'none',background:'transparent',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,flexShrink:0}}>
            ☰
          </button>
        )}
        <div style={{fontSize:isMobile?14:15,fontWeight:700,color:'#1D9E75',cursor:'pointer',whiteSpace:'nowrap'}}
          onClick={()=>{setCurrentObra(null);setCurrentTorre(null);setCurrentPav(null);setTela('obras')}}>
          🏗️ {!isMobile&&'ConcreteMap'}
        </div>
        {/* Breadcrumb — só desktop */}
        {!isMobile&&<div style={{fontSize:11,color:'#9ca3af',flex:1,display:'flex',alignItems:'center',gap:4,overflow:'hidden'}}>
          {currentObra&&<span style={{color:'#374151',cursor:'pointer',whiteSpace:'nowrap'}} onClick={()=>{setCurrentObra(null);setTela('obras')}}>{currentObra.nome}</span>}
          {currentTorre&&<><span style={{color:'#d1d5db'}}> › </span><span style={{color:'#374151',whiteSpace:'nowrap'}}>{currentTorre.nome}</span></>}
          {currentPav&&<><span style={{color:'#d1d5db'}}> › </span><span style={{color:'#111827',fontWeight:500,whiteSpace:'nowrap'}}>{currentPav.nome}</span></>}
        </div>}
        {isMobile&&<div style={{flex:1,fontSize:12,fontWeight:500,color:'#374151',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {currentPav?currentPav.nome:currentObra?currentObra.nome:'Obras'}
        </div>}
        <div style={{display:'flex',gap:isMobile?4:6,flexShrink:0,alignItems:'center'}}>
          {salvando&&!isMobile&&<span style={{fontSize:10,color:'#9ca3af'}}>Salvando...</span>}
          {!isMobile&&<button onClick={()=>setTela('dashboard')} style={{padding:'5px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer'}}>📊</button>}
          {currentObra&&!isMobile&&<button onClick={()=>setTela('cps')} style={{padding:'5px 10px',background:cpsPendentes12h>0?'#fef3c7':'#f3f4f6',border:`1px solid ${cpsPendentes12h>0?'#fbbf24':'#e5e7eb'}`,borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:cpsPendentes12h>0?600:400,color:cpsPendentes12h>0?'#b45309':'#374151',display:'flex',alignItems:'center',gap:4}}>
            🧪{cpsPendentes12h>0&&<span style={{background:'#f59e0b',color:'#fff',borderRadius:'50%',width:14,height:14,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>{cpsPendentes12h}</span>}
          </button>}
          {currentObra&&!isMobile&&<button onClick={()=>abrirNF()} style={{padding:'5px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer'}}>+ NF</button>}
          {currentPav&&!isMobile&&<button onClick={exportarPDF} style={{padding:'5px 10px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:6,fontSize:11,cursor:'pointer'}}>📄</button>}
          {!isMobile&&<button onClick={()=>setModalObra(true)} style={{padding:'5px 10px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:500}}>+ Obra</button>}
          {/* Avatar */}
          <div onClick={onLogout} title="Sair" style={{width:32,height:32,borderRadius:'50%',background:'#1D9E75',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff',fontWeight:600,cursor:'pointer',flexShrink:0}}>
            {sessao.user.email[0].toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative'}}>

        {/* SIDEBAR — overlay mobile, fixo desktop */}
        {(sidebarOpen||!isMobile)&&(
          <>
            {isMobile&&sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:200}}/>}
            <div style={{
              width:isMobile?260:215,
              background:'#fff',
              borderRight:'1px solid #e5e7eb',
              overflowY:'auto',
              flexShrink:0,
              zIndex:isMobile?201:1,
              position:isMobile?'fixed':'relative',
              left:0, top:isMobile?52:0,
              bottom:isMobile?60:0,
              boxShadow:isMobile?'4px 0 20px rgba(0,0,0,.1)':'none',
            }}>
              <div style={{padding:'10px 10px 4px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:10,fontWeight:600,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.06em'}}>Obras</span>
                <button onClick={()=>setModalObra(true)} style={{fontSize:11,background:'#1D9E75',color:'#fff',border:'none',borderRadius:5,padding:'3px 8px',cursor:'pointer'}}>+ Nova</button>
              </div>
              {obras.length===0&&<div style={{padding:16,fontSize:12,color:'#9ca3af',textAlign:'center'}}>Nenhuma obra.<br/>Crie a primeira!</div>}
              {obras.map((o,oi)=>(
                <div key={o.id}>
                  <div onClick={()=>selecionarObra(o)}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',margin:'2px 6px',borderRadius:8,cursor:'pointer',fontSize:13,color:'#374151',background:currentObra?.id===o.id?'#e6f7f1':'transparent',fontWeight:currentObra?.id===o.id?500:400}}>
                    <div style={{width:9,height:9,borderRadius:'50%',background:o.cor||'#1D9E75',flexShrink:0}}/>
                    <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.nome}</span>
                    {currentObra?.id===o.id&&<span onClick={e=>{e.stopPropagation();setEditObra({nome:o.nome,endereco:o.endereco||'',progresso:o.progresso||0});setModalEditObra(true)}} style={{fontSize:12,color:'#9ca3af',cursor:'pointer'}}>✏️</span>}
                  </div>
                  {currentObra?.id===o.id&&(o.torres||[]).map(t=>(
                    <div key={t.id}>
                      <div onClick={()=>{setCurrentTorre(currentTorre?.id===t.id?null:t);setCurrentPav(null)}}
                        style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px 8px 28px',margin:'1px 6px',borderRadius:8,cursor:'pointer',fontSize:12,color:'#374151',background:currentTorre?.id===t.id?'#e6f7f1':'transparent'}}>
                        🏢 <span style={{flex:1}}>{t.nome}</span>
                        {currentTorre?.id===t.id&&<span onClick={e=>{e.stopPropagation();setCurrentTorre(t);setEditPavs([...(t.pavimentos||[]).map(p=>({...p}))]);setModalEditPav(true)}} style={{fontSize:12,color:'#9ca3af',cursor:'pointer'}}>✏️</span>}
                        <span style={{color:'#9ca3af',fontSize:11}}>{currentTorre?.id===t.id?'▾':'▸'}</span>
                      </div>
                      {currentTorre?.id===t.id&&(t.pavimentos||[]).map(p=>(
                        <div key={p.id} onClick={()=>selecionarPav(p)}
                          style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px 8px 42px',margin:'1px 6px',borderRadius:8,cursor:'pointer',fontSize:12,
                            color:currentPav?.id===p.id?'#1D9E75':'#6b7280',fontWeight:currentPav?.id===p.id?500:400,background:currentPav?.id===p.id?'#e6f7f1':'transparent'}}>
                          {p.tipo==='especial'?'🔲':'📐'} {p.nome}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ÁREA CENTRAL */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>

          {/* TELA: LISTA DE OBRAS */}
          {tela==='obras'&&(
            <div style={{flex:1,overflowY:'auto',padding:isMobile?12:24}}>
              <div style={{fontSize:isMobile?18:22,fontWeight:700,marginBottom:4}}>Rastreabilidade de Concretagem</div>
              <div style={{fontSize:12,color:'#6b7280',marginBottom:isMobile?12:20}}>
                {obras.length===0?'Crie sua primeira obra':'Selecione uma obra ou crie uma nova'}
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                {obras.map((o,i)=>(
                  <div key={o.id} onClick={()=>selecionarObra(o)}
                    style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:isMobile?14:16,cursor:'pointer',touchAction:'manipulation'}}
                    onMouseEnter={e=>!isMobile&&(e.currentTarget.style.borderColor='#1D9E75')}
                    onMouseLeave={e=>!isMobile&&(e.currentTarget.style.borderColor='#e5e7eb')}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:o.cor||'#1D9E75',flexShrink:0}}/>
                      <div style={{fontSize:isMobile?15:14,fontWeight:600,flex:1}}>{o.nome}</div>
                    </div>
                    <div style={{fontSize:12,color:'#9ca3af',marginBottom:12}}>{o.endereco}</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}}>
                      {[['Torres',(o.torres||[]).length],['Pavimentos',(o.torres?.[0]?.pavimentos||[]).length],['NFs',nfs.filter(n=>n.obra_id===o.id).length],['Progresso',(o.progresso||0)+'%']].map(([l,v])=>(
                        <div key={l} style={{background:'#f9fafb',borderRadius:6,padding:'6px 8px'}}>
                          <div style={{fontSize:9,color:'#9ca3af',textTransform:'uppercase'}}>{l}</div>
                          <div style={{fontSize:14,fontWeight:600}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{height:5,background:'#e5e7eb',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',background:o.cor||'#1D9E75',width:`${o.progresso||0}%`,borderRadius:3}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TELA: MAPA */}
          {tela==='mapa'&&(
            <>
              {/* TABELA NFs — compacta mobile */}
              {!isMobile&&(
                <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'center',padding:'4px 12px',borderBottom:'1px solid #f3f4f6',gap:10}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#374151'}}>{currentObra?.nome} · {currentTorre?.nome} · {currentPav?.nome||'—'}</div>
                    <div style={{marginLeft:'auto',display:'flex',gap:4}}>
                      <div style={{display:'flex',background:'#f3f4f6',borderRadius:6,padding:2,gap:2}}>
                        {['parede','laje'].map(m=>(
                          <button key={m} onClick={()=>setViewMode(m)} style={{padding:'3px 8px',borderRadius:4,fontSize:10,fontWeight:500,cursor:'pointer',border:'none',background:viewMode===m?'#fff':'transparent',color:viewMode===m?'#111827':'#6b7280',boxShadow:viewMode===m?'0 1px 3px rgba(0,0,0,.1)':'none'}}>{m==='parede'?'Parede':'Laje/Teto'}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {nfs.length>0&&(
                    <div style={{overflowX:'auto',maxHeight:120}}>
                      <table style={{borderCollapse:'collapse',fontSize:9,width:'100%',minWidth:700}}>
                        <thead style={{position:'sticky',top:0,zIndex:1}}>
                          <tr>
                            <td style={{padding:'3px 8px',background:'#f5f5f5',fontWeight:600,color:'#666',fontSize:8,border:'1px solid #e5e7eb',writingMode:'vertical-rl',transform:'rotate(180deg)',width:24,textAlign:'center'}}>CONCRETAGEM</td>
                            {nfs.map(nf=>(<td key={nf.id} style={{padding:'3px 8px',textAlign:'center',border:'1px solid #e5e7eb',fontWeight:700,fontSize:9,background:nf.cor||'#eee',color:'#333',minWidth:65,whiteSpace:'nowrap',cursor:'pointer'}} onClick={()=>abrirNF(nf)}>{nf.numero} ✏️</td>))}
                          </tr>
                        </thead>
                        <tbody>
                          {TABELA_CAMPOS.map(({key,label})=>(
                            <tr key={key}>
                              <td style={{padding:'2px 8px',background:'#f9f9f9',fontWeight:500,color:'#555',fontSize:8,border:'1px solid #e5e7eb',whiteSpace:'nowrap'}}>{label}</td>
                              {nfs.map(nf=>(<td key={nf.id} style={{padding:'2px 8px',textAlign:'center',border:'1px solid #e5e7eb',fontSize:9,color:'#333',cursor:'pointer'}} onClick={()=>abrirNF(nf)}>{key==='data'&&nf[key]?new Date(nf[key]+'T00:00:00').toLocaleDateString('pt-BR'):nf[key]||'—'}</td>))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TOOLBAR */}
              <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:isMobile?'6px 10px':'4px 10px',gap:isMobile?6:6,flexShrink:0,overflowX:'auto'}}>
                {/* Ferramentas */}
                {[['pen','🖌️',isMobile?'':'Pincel'],['erase','🧹',isMobile?'':'Borracha'],['pan','✋',isMobile?'':'Mover']].map(([t,ico,lb])=>(
                  <button key={t} onClick={()=>setTool(t)}
                    style={{display:'flex',alignItems:'center',gap:4,padding:isMobile?'8px 12px':'4px 9px',borderRadius:8,cursor:'pointer',border:`1.5px solid ${tool===t?'#1D9E75':'#e5e7eb'}`,background:tool===t?'#e6f7f1':'transparent',fontSize:isMobile?18:11,fontWeight:500,color:tool===t?'#1D9E75':'#374151',flexShrink:0,minWidth:isMobile?44:0,justifyContent:'center'}}>
                    {ico}{lb&&<span style={{fontSize:10}}>{lb}</span>}
                  </button>
                ))}
                <div style={{width:1,height:20,background:'#e5e7eb',flexShrink:0}}/>
                {/* Tamanho pincel */}
                {[8,18,32,52].map(s=>(
                  <button key={s} onClick={()=>setBrushSize(s)}
                    style={{width:isMobile?36:26,height:isMobile?36:26,borderRadius:'50%',border:`2px solid ${s===brushSize?'#1D9E75':'#e5e7eb'}`,background:s===brushSize?'#e6f7f1':'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <div style={{width:Math.max(3,s/7),height:Math.max(3,s/7),borderRadius:'50%',background:'#374151'}}/>
                  </button>
                ))}
                {!isMobile&&<>
                  <div style={{width:1,height:20,background:'#e5e7eb',flexShrink:0}}/>
                  <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                    <span style={{fontSize:9,color:'#6b7280'}}>Opac.:</span>
                    <input type="range" min="20" max="90" value={Math.round(opacity*100)} onChange={e=>setOpacity(parseInt(e.target.value)/100)} style={{width:60,cursor:'pointer'}}/>
                    <span style={{fontSize:9,color:'#374151',minWidth:26}}>{Math.round(opacity*100)}%</span>
                  </div>
                </>}
                <div style={{width:1,height:20,background:'#e5e7eb',flexShrink:0}}/>
                <label style={{display:'flex',alignItems:'center',gap:4,padding:isMobile?'8px 12px':'4px 9px',background:plantaImg?'#e6f7f1':'#fff',border:`1.5px solid ${plantaImg?'#1D9E75':'#e5e7eb'}`,borderRadius:8,fontSize:isMobile?13:10,cursor:'pointer',fontWeight:500,color:plantaImg?'#1D9E75':'#374151',whiteSpace:'nowrap',flexShrink:0}}>
                  {plantaImg?'🖼️':'📁'} {isMobile?(plantaImg?'Trocar':'Planta'):(plantaImg?'Trocar':'Carregar planta')}
                  <input type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(!f) return;const r=new FileReader();r.onload=ev=>handleUploadPlanta(ev.target.result);r.readAsDataURL(f)}} style={{display:'none'}}/>
                </label>
                {isMobile&&(
                  <>
                    <div style={{width:1,height:20,background:'#e5e7eb',flexShrink:0}}/>
                    <select value={viewMode} onChange={e=>setViewMode(e.target.value)} style={{padding:'6px 8px',border:'1px solid #e5e7eb',borderRadius:6,fontSize:12,outline:'none',color:'#374151',background:'#fff',flexShrink:0}}>
                      <option value="parede">Parede</option>
                      <option value="laje">Laje/Teto</option>
                    </select>
                  </>
                )}
                <button onClick={exportarPDF} style={{marginLeft:'auto',padding:isMobile?'8px 12px':'4px 9px',borderRadius:8,cursor:'pointer',border:'1px solid #e5e7eb',background:'#fff',fontSize:isMobile?14:10,color:'#374151',flexShrink:0}}>📄</button>
              </div>

              {/* CANVAS — ocupa todo espaço restante */}
              {/* Seletor de pavimento mobile quando nenhum pav selecionado */}
              {isMobile&&!currentPav&&(
                <div style={{flex:1,overflowY:'auto',padding:16,background:'#f8f7f4'}}>
                  <div style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>{currentObra?.nome}</div>
                  <div style={{fontSize:12,color:'#9ca3af',marginBottom:16}}>Selecione uma torre e pavimento</div>
                  {(currentObra?.torres||[]).map(t=>(
                    <div key={t.id} style={{marginBottom:12}}>
                      <div style={{fontSize:12,fontWeight:600,color:'#6b7280',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
                        🏢 {t.nome}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        {(t.pavimentos||[]).map(p=>(
                          <button key={p.id}
                            onClick={()=>{setCurrentTorre(t);setCurrentPav(p)}}
                            style={{padding:'12px 10px',border:'1px solid #e5e7eb',borderRadius:10,background:'#fff',cursor:'pointer',fontSize:13,fontWeight:500,color:'#374151',fontFamily:'inherit',display:'flex',alignItems:'center',gap:8,textAlign:'left'}}>
                            {p.tipo==='especial'?'🔲':'📐'} {p.nome}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {(!isMobile||currentPav)&&<PlantaCanvas
                key={`${currentPav?.id}_${viewMode}`}
                plantaImg={plantaImg} paintData={paintData} activeNF={activeNF}
                tool={tool} brushSize={brushSize} opacity={opacity} isMobile={isMobile}
                onCanvasReady={(bg,paint)=>{canvasRefs.current={bg,paint}}}
                onUpload={handleUploadPlanta} onSavePaint={handleSalvarPintura}
              />}
              {/* Painel NFs mobile — FORA do canvas para receber toques */}
              {isMobile&&currentPav&&nfs&&nfs.length>0&&(
                <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:500,background:'rgba(255,255,255,.98)',borderTop:'1px solid #e5e7eb',padding:'10px 12px 12px',boxShadow:'0 -4px 20px rgba(0,0,0,.12)'}}>
                  <div style={{fontSize:10,color:'#9ca3af',marginBottom:8,fontWeight:600,letterSpacing:'.04em'}}>SELECIONE UMA NF PARA PINTAR</div>
                  <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:2}}>
                    {nfs.map(nf=>(
                      <button key={nf.id}
                        onClick={(e)=>{e.stopPropagation();setActiveNF(activeNF?.id===nf.id?null:nf)}}
                        style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'10px 16px',borderRadius:12,border:`2.5px solid ${activeNF?.id===nf.id?nf.cor||'#1D9E75':'#e5e7eb'}`,background:activeNF?.id===nf.id?(nf.cor||'#1D9E75')+'33':'#fff',cursor:'pointer',flexShrink:0,minWidth:80,fontFamily:'inherit',touchAction:'manipulation',WebkitTapHighlightColor:'transparent'}}>
                        <div style={{width:20,height:20,borderRadius:5,background:nf.cor||'#ccc',border:'1px solid rgba(0,0,0,.1)'}}/>
                        <span style={{fontSize:12,fontWeight:activeNF?.id===nf.id?700:500,color:activeNF?.id===nf.id?'#111827':'#6b7280',whiteSpace:'nowrap'}}>NF {nf.numero}</span>
                        <span style={{fontSize:9,color:activeNF?.id===nf.id?'#1D9E75':'#9ca3af',fontWeight:activeNF?.id===nf.id?700:400}}>{activeNF?.id===nf.id?'✓ ATIVA':nf.volume+'m³'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* SIDEBAR DIREITA — NFs (só desktop) */}
        {!isMobile&&currentObra&&(
          <div style={{width:210,background:'#fff',borderLeft:'1px solid #e5e7eb',display:'flex',flexDirection:'column',flexShrink:0}}>
            <div style={{padding:'10px 12px 6px',borderBottom:'1px solid #f3f4f6'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>Notas Fiscais</div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:6}}>
              {nfs.length===0&&<div style={{padding:16,textAlign:'center',color:'#9ca3af',fontSize:11}}>Nenhuma NF.<br/>Clique "+ NF"</div>}
              {nfs.map(nf=>{
                const lib=cps.some(c=>c.nf_id===nf.id&&c.desforma_liberada)
                const pend=cps.some(c=>c.nf_id===nf.id&&c.tipo==='12h'&&(c.resultado_mpa===null||c.resultado_mpa===undefined))
                return(
                  <div key={nf.id} style={{border:`1.5px solid ${activeNF?.id===nf.id?'#1D9E75':'#e5e7eb'}`,borderRadius:8,padding:'7px 8px 7px 12px',marginBottom:5,position:'relative',background:activeNF?.id===nf.id?'#e6f7f1':'#fff'}}>
                    <div style={{position:'absolute',left:0,top:0,bottom:0,width:4,background:nf.cor||'#ccc',borderRadius:'6px 0 0 6px'}}/>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                      <div style={{width:10,height:10,borderRadius:2,background:nf.cor||'#ccc',cursor:'pointer'}} onClick={()=>setActiveNF(activeNF?.id===nf.id?null:nf)}/>
                      <div style={{fontSize:11,fontWeight:600,cursor:'pointer',flex:1}} onClick={()=>setActiveNF(activeNF?.id===nf.id?null:nf)}>NF {nf.numero}</div>
                      {activeNF?.id===nf.id&&<span style={{fontSize:8,background:'#1D9E75',color:'#fff',padding:'1px 5px',borderRadius:8}}>ATIVA</span>}
                    </div>
                    <div style={{fontSize:9,color:'#6b7280',cursor:'pointer'}} onClick={()=>setActiveNF(activeNF?.id===nf.id?null:nf)}>C{nf.fck} · {nf.slump}cm · {nf.volume}m³</div>
                    {lib&&<div style={{fontSize:9,color:'#065f46',fontWeight:500}}>✓ Desforma ok</div>}
                    {pend&&!lib&&<div style={{fontSize:9,color:'#b45309',fontWeight:500}}>⚠️ CP 12h pendente</div>}
                    <div style={{display:'flex',gap:4,marginTop:5}}>
                      <button onClick={()=>abrirNF(nf)} style={{flex:1,padding:'3px',border:'1px solid #e5e7eb',borderRadius:5,background:'#f9fafb',cursor:'pointer',fontSize:10,color:'#374151'}}>✏️ Editar</button>
                      <button onClick={()=>handleExcluirNF(nf.id)} style={{padding:'3px 7px',border:'1px solid #fecaca',borderRadius:5,background:'#fff',cursor:'pointer',fontSize:10,color:'#ef4444'}}>✕</button>
                    </div>
                  </div>
                )
              })}
              <button onClick={()=>abrirNF()} style={{width:'100%',padding:7,borderRadius:8,border:'1.5px dashed #d1d5db',background:'transparent',color:'#6b7280',fontSize:11,cursor:'pointer',fontFamily:'inherit',marginTop:3}}>+ Nova NF</button>
            </div>
            {nfs.length>0&&(
              <div style={{padding:'8px 12px',borderTop:'1px solid #f3f4f6'}}>
                <div style={{fontSize:9,fontWeight:500,color:'#9ca3af',marginBottom:4}}>Legenda</div>
                {nfs.map(nf=>(<div key={nf.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:9,color:'#6b7280',marginBottom:3}}><div style={{width:10,height:10,borderRadius:2,background:nf.cor||'#ccc',flexShrink:0}}/> NF {nf.numero} · {nf.volume||'—'}m³</div>))}
                <div style={{marginTop:5,padding:'4px 8px',background:'#f9fafb',borderRadius:5,fontSize:9}}><span style={{fontWeight:500}}>{nfs.length} NFs · </span>{nfs.reduce((a,n)=>a+parseFloat((n.volume||'0').replace(',','.')),0).toFixed(1)} m³</div>
                <button onClick={()=>setTela('cps')} style={{width:'100%',marginTop:8,padding:'6px',border:'1px solid #e5e7eb',borderRadius:6,background:'#f9fafb',cursor:'pointer',fontSize:10,color:'#374151',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                  🧪 CPs{cpsPendentes12h>0&&<span style={{background:'#f59e0b',color:'#fff',borderRadius:'50%',width:14,height:14,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700}}>{cpsPendentes12h}</span>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV MOBILE ── */}
      {isMobile&&(
        <div style={{height:60,background:'#fff',borderTop:'1px solid #e5e7eb',display:'flex',alignItems:'center',flexShrink:0,zIndex:300,position:'relative'}}>
          {[
            {ico:'🏠',label:'Obras',t:'obras'},
            {ico:'📐',label:'Planta',t:'mapa'},
            {ico:'🧪',label:'CPs',t:'cps',badge:cpsPendentes12h},
            {ico:'📊',label:'Dashboard',t:'dashboard'},
          ].map(({ico,label,t,badge})=>(
            <button key={t} onClick={()=>{if(t==='mapa'&&!currentObra){showToast('Selecione uma obra');return};setTela(t)}}
              style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,border:'none',background:'transparent',cursor:'pointer',padding:'6px 0',position:'relative'}}>
              <span style={{fontSize:20}}>{ico}</span>
              <span style={{fontSize:9,color:tela===t?'#1D9E75':'#9ca3af',fontWeight:tela===t?600:400}}>{label}</span>
              {badge>0&&<span style={{position:'absolute',top:4,right:'calc(50% - 18px)',background:'#f59e0b',color:'#fff',borderRadius:'50%',width:14,height:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700}}>{badge}</span>}
              {tela===t&&<div style={{position:'absolute',bottom:0,left:'25%',right:'25%',height:2,background:'#1D9E75',borderRadius:2}}/>}
            </button>
          ))}
          {/* Botão + NF no mobile */}
          {currentObra&&(
            <button onClick={()=>abrirNF()}
              style={{width:52,height:52,borderRadius:'50%',background:'#1D9E75',border:'none',color:'#fff',fontSize:24,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,margin:'0 8px',boxShadow:'0 4px 12px rgba(29,158,117,.4)'}}>
              +
            </button>
          )}
        </div>
      )}

      {/* STATUS BAR — só desktop */}
      {!isMobile&&(
        <div style={{height:26,background:'#fff',borderTop:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:'0 12px',gap:14,fontSize:9,color:'#6b7280',flexShrink:0}}>
          <span style={{display:'flex',alignItems:'center',gap:3}}><span style={{width:5,height:5,borderRadius:'50%',background:'#1D9E75',display:'inline-block'}}/>Conectado</span>
          <span>{activeNF?`🖌️ NF ${activeNF.numero} ativa`:'Selecione uma NF'}</span>
          {cpsPendentes12h>0&&<span style={{color:'#b45309',fontWeight:500}}>⚠️ {cpsPendentes12h} CP(s) 12h pendentes</span>}
          <span style={{marginLeft:'auto'}}>☁️ {sessao.user.email}</span>
        </div>
      )}

      {/* MODAIS */}
      {modalObra&&<Modal onClose={()=>setModalObra(false)} title="Nova Obra">
        {[['Nome *','nome','text','Ex: Vila do Paraíso'],['Endereço','endereco','text','Rua, número']].map(([lb,k,t,ph])=>(
          <div key={k} style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
            <input value={novaObra[k]||''} onChange={e=>setNovaObra(p=>({...p,[k]:e.target.value}))} placeholder={ph} type={t}
              style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:8,fontSize:14,outline:'none',fontFamily:'inherit'}}/>
          </div>
        ))}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          {[['Torres','torres'],['Pavimentos','pavimentos']].map(([lb,k])=>(
            <div key={k}>
              <label style={{fontSize:12,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>Nº de {lb}</label>
              <input type="number" min="1" value={novaObra[k]} onChange={e=>setNovaObra(p=>({...p,[k]:parseInt(e.target.value)||1}))}
                style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:8,fontSize:14,outline:'none',fontFamily:'inherit'}}/>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={()=>setModalObra(false)} style={{padding:'10px 18px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={handleCriarObra} style={{padding:'10px 18px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500}}>Criar</button>
        </div>
      </Modal>}

      {modalEditObra&&currentObra&&<Modal onClose={()=>setModalEditObra(false)} title="Editar Obra">
        {[['Nome *','nome','text'],['Endereço','endereco','text']].map(([lb,k,t])=>(
          <div key={k} style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
            <input value={editObra[k]||''} onChange={e=>setEditObra(p=>({...p,[k]:e.target.value}))} type={t}
              style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:8,fontSize:14,outline:'none',fontFamily:'inherit'}}/>
          </div>
        ))}
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>Progresso (%)</label>
          <input type="number" min="0" max="100" value={editObra.progresso||0} onChange={e=>setEditObra(p=>({...p,progresso:parseInt(e.target.value)||0}))}
            style={{width:'100%',padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:8,fontSize:14,outline:'none',fontFamily:'inherit'}}/>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'space-between'}}>
          <button onClick={handleExcluirObra} style={{padding:'10px 14px',border:'1px solid #fecaca',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13,color:'#ef4444'}}>🗑️ Excluir</button>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setModalEditObra(false)} style={{padding:'10px 18px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
            <button onClick={handleEditarObra} style={{padding:'10px 18px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500}}>Salvar</button>
          </div>
        </div>
      </Modal>}

      {modalEditPav&&<Modal onClose={()=>setModalEditPav(false)} title={`Pavimentos — ${currentTorre?.nome}`}>
        <div style={{fontSize:12,color:'#6b7280',marginBottom:12,padding:'8px 12px',background:'#f9fafb',borderRadius:8}}>
          💡 Renomeie e defina se é <strong>Tipo</strong> ou <strong>Especial</strong> (platibanda)
        </div>
        {editPavs.map((p,i)=>(
          <div key={p.id} style={{display:'flex',gap:8,marginBottom:10,alignItems:'center'}}>
            <span style={{fontSize:11,color:'#9ca3af',minWidth:20,textAlign:'right'}}>{i+1}.</span>
            <input value={p.nome} onChange={e=>setEditPavs(prev=>prev.map((pv,idx)=>idx===i?{...pv,nome:e.target.value}:pv))}
              style={{flex:1,padding:'10px 12px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
            <select value={p.tipo||'tipo'} onChange={e=>setEditPavs(prev=>prev.map((pv,idx)=>idx===i?{...pv,tipo:e.target.value}:pv))}
              style={{padding:'10px 8px',border:'1px solid #d1d5db',borderRadius:8,fontSize:12,outline:'none',fontFamily:'inherit',color:'#374151'}}>
              <option value="tipo">Tipo</option>
              <option value="especial">Especial</option>
            </select>
          </div>
        ))}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
          <button onClick={()=>setModalEditPav(false)} style={{padding:'10px 18px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={handleSalvarPavs} style={{padding:'10px 18px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500}}>Salvar</button>
        </div>
      </Modal>}

      {modalNF&&<Modal onClose={()=>setModalNF(false)} title={editingNF?'Editar NF':'Nova NF'} sub={currentObra?.nome}>
        {editingNF&&<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,padding:'8px 12px',background:(editingNF.cor||'#eee')+'22',borderRadius:8,border:`1px solid ${editingNF.cor||'#eee'}`}}>
          <div style={{width:14,height:14,borderRadius:3,background:editingNF.cor||'#eee'}}/><span style={{fontSize:12,fontWeight:500}}>NF {editingNF.numero}</span>
        </div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {[['Número *','numero','text','Ex: 9445'],['Data','data','date',''],['Concreteira','concreteira','text','Usina'],['Caminhão','caminhao','text','Ex: BT 68'],['Placa','placa','text','ABC-1234'],['fck (MPa)','fck','text','25'],['Slump (cm)','slump','text','22'],['Volume (m³)','volume','text','7,0'],['Chegada BT','horario','time',''],['Início desc.','inicio_descarga','time',''],['Moldagem','hora_moldagem','time',''],['Fim desc.','fim_descarga','time',''],['Água adicionada (L)','agua_adicionada','number','Ex: 20'],['Autorizado por','agua_autorizado_por','text','Nome do responsável']].map(([lb,k,t,ph])=>(
            <div key={k}>
              <label style={{fontSize:11,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
              <input type={t} value={formNF[k]||''} onChange={e=>setFormNF(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                style={{width:'100%',padding:'10px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
          <button onClick={()=>setModalNF(false)} style={{padding:'10px 16px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
          {editingNF&&<button onClick={()=>{handleExcluirNF(editingNF.id);setModalNF(false)}} style={{padding:'10px 16px',border:'1px solid #fecaca',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13,color:'#ef4444'}}>Excluir</button>}
          <button onClick={handleSalvarNF} style={{padding:'10px 18px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500}}>{editingNF?'Salvar':'Cadastrar'}</button>
        </div>
      </Modal>}

      {toast&&<Toast msg={toast}/>}
    </div>
  )
}

// ── COMPONENTE MODAL ──────────────────────────────────────────
function Modal({children, onClose, title, sub}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:0}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'20px 20px 32px',width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 -8px 40px rgba(0,0,0,.15)'}}>
        <div style={{width:40,height:4,background:'#e5e7eb',borderRadius:2,margin:'0 auto 16px',flexShrink:0}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:'#111827'}}>{title}</div>
            {sub&&<div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{sub}</div>}
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#9ca3af',padding:'0 0 0 16px',lineHeight:1}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── TOAST ─────────────────────────────────────────────────────
function Toast({msg}){
  return <div style={{position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',background:'#1f2937',color:'#fff',padding:'10px 20px',borderRadius:20,fontSize:13,fontWeight:500,zIndex:3000,boxShadow:'0 4px 16px rgba(0,0,0,.2)',whiteSpace:'nowrap'}}>{msg}</div>
}

// ── TELA CPs ─────────────────────────────────────────────────
function TelaCPs({obra,nfs,cps,isMobile,onSalvarCP,onExcluirCP,onClose}){
  const[modalCP,setModalCP]=useState(false)
  const[editCP,setEditCP]=useState(null)
  const[nfSel,setNfSel]=useState(null)
  const[formCP,setFormCP]=useState({...CP_VAZIA})
  const[filtroNF,setFiltroNF]=useState('todas')
  const alertas=cps.filter(c=>c.tipo==='12h'&&(c.resultado_mpa===null||c.resultado_mpa===undefined))
  const liberados=cps.filter(c=>c.desforma_liberada).length

  function abrirCP(cp=null,nf=null){
    if(cp){setEditCP(cp);setNfSel(nfs.find(n=>n.id===cp.nf_id)||null);setFormCP({numero_cp:cp.numero_cp||'',data_moldagem:cp.data_moldagem||new Date().toISOString().slice(0,10),hora_moldagem:cp.hora_moldagem||'',responsavel:cp.responsavel||'',tipo:cp.tipo||'12h',data_ruptura:cp.data_ruptura||'',resultado_mpa:cp.resultado_mpa||'',observacao:cp.observacao||''})}
    else{setEditCP(null);setNfSel(nf);setFormCP({...CP_VAZIA,data_moldagem:nf?.data||new Date().toISOString().slice(0,10)})}
    setModalCP(true)
  }
  async function handleSalvar(){if(!nfSel){alert('Selecione uma NF');return};await onSalvarCP(formCP,nfSel.id,editCP?.id);setModalCP(false)}

  function statusBadge(cp){
    if(cp.tipo==='12h'){if(cp.resultado_mpa===null||cp.resultado_mpa===undefined) return{label:'Aguardando 12h',bg:'#fef3c7',c:'#b45309'};if(cp.desforma_liberada) return{label:'✓ Desforma liberada',bg:'#d1fae5',c:'#065f46'};return{label:'✗ Não libera',bg:'#fee2e2',c:'#991b1b'}}
    if(cp.resultado_mpa===null||cp.resultado_mpa===undefined) return{label:'Aguardando 28d',bg:'#ede9fe',c:'#5b21b6'}
    return{label:'Concluído 28d',bg:'#e0f2fe',c:'#0369a1'}
  }

  const cpsFiltrados=cps.filter(c=>filtroNF==='todas'||c.nf_id===filtroNF)

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'12px 16px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <div>
          <div style={{fontSize:15,fontWeight:700}}>🧪 Controle de CPs</div>
          <div style={{fontSize:11,color:'#9ca3af'}}>{obra.nome}</div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          <button onClick={()=>abrirCP()} style={{padding:'8px 14px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontWeight:500}}>+ Novo CP</button>
          <button onClick={onClose} style={{padding:'8px 14px',background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,cursor:'pointer'}}>← Voltar</button>
        </div>
      </div>
      {alertas.length>0&&<div style={{background:'#fffbeb',borderBottom:'1px solid #fde68a',padding:'8px 16px',fontSize:13,color:'#92400e',fontWeight:500,flexShrink:0}}>⚠️ {alertas.length} CP(s) de 12h aguardando resultado — verificar desforma!</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,padding:'12px 16px',flexShrink:0}}>
        {[['Total',cps.length,'#374151','#f9fafb'],['Liberados',liberados,'#065f46','#d1fae5'],['Pendentes 12h',alertas.length,'#b45309','#fef3c7']].map(([l,v,c,bg])=>(
          <div key={l} style={{background:bg,borderRadius:10,padding:'10px 12px',textAlign:'center'}}>
            <div style={{fontSize:9,color:c,fontWeight:500,textTransform:'uppercase'}}>{l}</div>
            <div style={{fontSize:22,fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{padding:'0 16px 8px',flexShrink:0}}>
        <select value={filtroNF} onChange={e=>setFiltroNF(e.target.value)} style={{width:'100%',padding:'10px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,outline:'none',color:'#374151',background:'#fff'}}>
          <option value="todas">Todas as NFs</option>
          {nfs.map(nf=><option key={nf.id} value={nf.id}>NF {nf.numero} — {nf.data?new Date(nf.data+'T00:00:00').toLocaleDateString('pt-BR'):''}</option>)}
        </select>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'0 16px 16px'}}>
        {nfs.filter(nf=>cpsFiltrados.some(c=>c.nf_id===nf.id)).map(nf=>{
          const cpsNF=cpsFiltrados.filter(c=>c.nf_id===nf.id)
          const lib=cpsNF.some(c=>c.tipo==='12h'&&c.desforma_liberada)
          const pend=cpsNF.some(c=>c.tipo==='12h'&&(c.resultado_mpa===null||c.resultado_mpa===undefined))
          return(
            <div key={nf.id} style={{marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <div style={{width:12,height:12,borderRadius:2,background:nf.cor||'#ccc'}}/>
                <span style={{fontSize:13,fontWeight:600}}>NF {nf.numero}</span>
                <span style={{fontSize:11,color:'#9ca3af'}}>{nf.data?new Date(nf.data+'T00:00:00').toLocaleDateString('pt-BR'):''} · C{nf.fck}</span>
                {lib&&<span style={{fontSize:10,background:'#d1fae5',color:'#065f46',padding:'2px 8px',borderRadius:8,fontWeight:500}}>✓ Desforma ok</span>}
                {pend&&!lib&&<span style={{fontSize:10,background:'#fef3c7',color:'#b45309',padding:'2px 8px',borderRadius:8,fontWeight:500}}>⚠️ Pendente</span>}
                <button onClick={()=>abrirCP(null,nf)} style={{marginLeft:'auto',padding:'5px 10px',border:'1px solid #e5e7eb',borderRadius:6,background:'#f9fafb',cursor:'pointer',fontSize:11}}>+ CP</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
                {cpsNF.map(cp=>{const b=statusBadge(cp);return(
                  <div key={cp.id} onClick={()=>abrirCP(cp)} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:12,cursor:'pointer',position:'relative'}}>
                    <div style={{position:'absolute',top:0,left:0,right:0,height:4,borderRadius:'10px 10px 0 0',background:cp.tipo==='12h'?'#f59e0b':'#3b82f6'}}/>
                    <div style={{marginTop:6,display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <div><div style={{fontSize:13,fontWeight:600}}>CP {cp.numero_cp||'—'}</div><div style={{fontSize:10,color:'#9ca3af'}}>{cp.tipo==='12h'?'🕐 12h':'📅 28d'}</div></div>
                      {cp.resultado_mpa!==null&&cp.resultado_mpa!==undefined?(
                        <div style={{fontSize:18,fontWeight:700,color:cp.tipo==='12h'?(cp.resultado_mpa>=3?'#065f46':'#991b1b'):'#0369a1'}}>{cp.resultado_mpa} MPa</div>
                      ):<div style={{fontSize:11,color:'#9ca3af',fontStyle:'italic'}}>Sem resultado</div>}
                    </div>
                    <div style={{display:'inline-flex',padding:'2px 8px',background:b.bg,borderRadius:6,marginBottom:6}}><span style={{fontSize:9,fontWeight:600,color:b.c}}>{b.label}</span></div>
                    <div style={{fontSize:10,color:'#6b7280'}}>{cp.responsavel&&<div>{cp.responsavel}</div>}{cp.data_moldagem&&<div>{new Date(cp.data_moldagem+'T00:00:00').toLocaleDateString('pt-BR')}</div>}</div>
                  </div>
                )})}
              </div>
            </div>
          )
        })}
        {nfs.filter(nf=>!cpsFiltrados.some(c=>c.nf_id===nf.id)&&filtroNF==='todas').map(nf=>(
          <div key={nf.id} onClick={()=>abrirCP(null,nf)} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'#fff',border:'1px dashed #e5e7eb',borderRadius:10,marginBottom:8,cursor:'pointer'}}>
            <div style={{width:10,height:10,borderRadius:2,background:nf.cor||'#ccc'}}/>
            <span style={{fontSize:13,color:'#6b7280'}}>NF {nf.numero} — sem CP</span>
            <span style={{marginLeft:'auto',fontSize:12,color:'#1D9E75',fontWeight:500}}>+ Cadastrar</span>
          </div>
        ))}
      </div>

      {/* Modal CP */}
      {modalCP&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'20px 20px 32px',width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{width:40,height:4,background:'#e5e7eb',borderRadius:2,margin:'0 auto 16px'}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:700}}>{editCP?'Editar CP':'Novo CP'}</div>
              <button onClick={()=>setModalCP(false)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>
            {!editCP&&(
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight, fontWeight:500,color:'#374151',display:'block',marginBottom:6}}>NF *</label>
                <select value={nfSel?.id||''} onChange={e=>setNfSel(nfs.find(n=>n.id===e.target.value)||null)}
                  style={{width:'100%',padding:'10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit',color:'#374151'}}>
                  <option value="">Selecione...</option>
                  {nfs.map(nf=><option key={nf.id} value={nf.id}>NF {nf.numero} — C{nf.fck}</option>)}
                </select>
              </div>
            )}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:500,color:'#374151',display:'block',marginBottom:6}}>Tipo *</label>
              <div style={{display:'flex',gap:8}}>
                {[['12h','🕐 12h — Desforma'],['28d','📅 28 dias — fck']].map(([v,l])=>(
                  <button key={v} onClick={()=>setFormCP(p=>({...p,tipo:v}))}
                    style={{flex:1,padding:'10px',border:`2px solid ${formCP.tipo===v?'#1D9E75':'#e5e7eb'}`,borderRadius:10,background:formCP.tipo===v?'#e6f7f1':'#fff',cursor:'pointer',fontSize:13,fontWeight:formCP.tipo===v?600:400,color:formCP.tipo===v?'#1D9E75':'#374151',fontFamily:'inherit'}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              {[['Nº CP','numero_cp','text','CP-01'],['Responsável','responsavel','text','Técnico'],['Data moldagem','data_moldagem','date',''],['Hora','hora_moldagem','time',''],['Data ruptura','data_ruptura','date',''],['Resultado MPa','resultado_mpa','number','']].map(([lb,k,t,ph])=>(
                <div key={k}>
                  <label style={{fontSize:12,fontWeight:500,color:'#374151',display:'block',marginBottom:4}}>{lb}</label>
                  <input type={t} step={t==='number'?'0.1':undefined} value={formCP[k]||''} onChange={e=>setFormCP(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                    style={{width:'100%',padding:'10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
                </div>
              ))}
            </div>
            {formCP.resultado_mpa&&formCP.tipo==='12h'&&(
              <div style={{marginBottom:14,padding:'10px 12px',background:parseFloat(formCP.resultado_mpa)>=3?'#d1fae5':'#fee2e2',borderRadius:8,fontSize:13,fontWeight:600,color:parseFloat(formCP.resultado_mpa)>=3?'#065f46':'#991b1b'}}>
                {parseFloat(formCP.resultado_mpa)>=3?'✅ Desforma liberada!':'❌ Resistência insuficiente'}
              </div>
            )}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModalCP(false)} style={{padding:'10px 16px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
              {editCP&&<button onClick={async()=>{await onExcluirCP(editCP.id);setModalCP(false)}} style={{padding:'10px 16px',border:'1px solid #fecaca',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:13,color:'#ef4444'}}>Excluir</button>}
              <button onClick={handleSalvar} style={{padding:'10px 18px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:500}}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PLANTA CANVAS ─────────────────────────────────────────────
function PlantaCanvas({plantaImg,paintData,activeNF,tool,brushSize,opacity,onUpload,onCanvasReady,onSavePaint,isMobile,nfs,onSelectNF}){
  const bgRef=useRef(null),paintRef=useRef(null),wrapperRef=useRef(null)
  const zoomRef=useRef(1),panRef=useRef({x:0,y:0})
  const[zoomPct,setZoomPct]=useState(100)
  const isPainting=useRef(false),isPanning=useRef(false)
  const lastMouse=useRef({x:0,y:0}),lastPaintPos=useRef(null)
  const saveTimer=useRef(null)
  const lastPinch=useRef(null)
  const CW=1200,CH=700

  useEffect(()=>{if(bgRef.current&&paintRef.current&&onCanvasReady) onCanvasReady(bgRef.current,paintRef.current)},[])

  useEffect(()=>{
    if(!plantaImg) return
    const img=new Image()
    img.onload=()=>{
      const ctx=bgRef.current?.getContext('2d');if(!ctx) return
      ctx.clearRect(0,0,CW,CH);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,CW,CH)
      const sc=Math.min(CW/img.width,CH/img.height)*0.95
      ctx.drawImage(img,(CW-img.width*sc)/2,(CH-img.height*sc)/2,img.width*sc,img.height*sc)
    }
    img.src=plantaImg
  },[plantaImg])

  useEffect(()=>{
    if(!paintRef.current) return
    const ctx=paintRef.current.getContext('2d');ctx.clearRect(0,0,CW,CH)
    if(!paintData) return
    const img=new Image();img.onload=()=>ctx.drawImage(img,0,0);img.src=paintData
  },[paintData])

  function applyT(){
    if(wrapperRef.current) wrapperRef.current.style.transform=`translate(${panRef.current.x}px,${panRef.current.y}px) scale(${zoomRef.current})`
    setZoomPct(Math.round(zoomRef.current*100))
  }

  function scheduleSave(){
    clearTimeout(saveTimer.current)
    saveTimer.current=setTimeout(()=>{
      if(!paintRef.current) return
      onSavePaint(paintRef.current.toDataURL('image/png'))
    },1500)
  }

  function toCanvas(sx,sy){
    const el=bgRef.current?.parentElement?.parentElement;if(!el) return{x:0,y:0}
    const r=el.getBoundingClientRect()
    return{x:(sx-r.left-panRef.current.x)/zoomRef.current,y:(sy-r.top-panRef.current.y)/zoomRef.current}
  }

  function paintAt(pos){
    const c=paintRef.current;if(!c) return
    const ctx=c.getContext('2d')
    const alpha=Math.round(opacity*255).toString(16).padStart(2,'0')
    if(tool==='erase'){
      ctx.globalCompositeOperation='destination-out'
      ctx.beginPath();ctx.arc(pos.x,pos.y,brushSize*1.5,0,Math.PI*2)
      ctx.fillStyle='rgba(0,0,0,1)';ctx.fill()
      ctx.globalCompositeOperation='source-over'
    } else if(tool==='pen'&&activeNF){
      ctx.globalCompositeOperation='source-over'
      ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=brushSize
      ctx.strokeStyle=(activeNF.cor||'#000')+alpha
      if(lastPaintPos.current){
        ctx.beginPath();ctx.moveTo(lastPaintPos.current.x,lastPaintPos.current.y)
        ctx.lineTo(pos.x,pos.y);ctx.stroke()
      } else {
        ctx.beginPath();ctx.arc(pos.x,pos.y,brushSize/2,0,Math.PI*2)
        ctx.fillStyle=(activeNF.cor||'#000')+alpha;ctx.fill()
      }
    }
    lastPaintPos.current=pos
  }

  function onMouseDown(e){
    e.preventDefault();const xy={x:e.clientX,y:e.clientY};lastMouse.current=xy
    if(tool==='pan'){isPanning.current=true;return}
    if(tool==='pen'&&!activeNF) return
    isPainting.current=true;lastPaintPos.current=null;paintAt(toCanvas(xy.x,xy.y))
  }
  function onMouseMove(e){
    e.preventDefault();const xy={x:e.clientX,y:e.clientY}
    if(isPanning.current){panRef.current={x:panRef.current.x+(xy.x-lastMouse.current.x),y:panRef.current.y+(xy.y-lastMouse.current.y)};lastMouse.current=xy;applyT();return}
    if(isPainting.current){paintAt(toCanvas(xy.x,xy.y));lastMouse.current=xy}
  }
  function onMouseUp(){if(isPainting.current) scheduleSave();isPainting.current=false;isPanning.current=false;lastPaintPos.current=null}

  function onWheel(e){
    e.preventDefault();const f=e.deltaY<0?1.12:0.9
    const el=bgRef.current?.parentElement?.parentElement;if(!el) return
    const r=el.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top
    const nz=Math.max(0.15,Math.min(8,zoomRef.current*f))
    panRef.current={x:mx-(mx-panRef.current.x)*(nz/zoomRef.current),y:my-(my-panRef.current.y)*(nz/zoomRef.current)}
    zoomRef.current=nz;applyT()
  }

  function onTouchStart(e){
    e.preventDefault()
    if(e.touches.length===2){
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY)
      lastPinch.current={dist:d,zoom:zoomRef.current,cx:(e.touches[0].clientX+e.touches[1].clientX)/2,cy:(e.touches[0].clientY+e.touches[1].clientY)/2}
      isPainting.current=false;isPanning.current=false;return
    }
    const xy={x:e.touches[0].clientX,y:e.touches[0].clientY};lastMouse.current=xy
    if(tool==='pan'){isPanning.current=true;return}
    if(tool==='pen'&&!activeNF) return
    isPainting.current=true;lastPaintPos.current=null;paintAt(toCanvas(xy.x,xy.y))
  }

  function onTouchMove(e){
    e.preventDefault()
    if(e.touches.length===2&&lastPinch.current){
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY)
      const scale=d/lastPinch.current.dist
      const nz=Math.max(0.15,Math.min(8,lastPinch.current.zoom*scale))
      const el=bgRef.current?.parentElement?.parentElement;if(!el) return
      const r=el.getBoundingClientRect()
      const mx=lastPinch.current.cx-r.left,my=lastPinch.current.cy-r.top
      panRef.current={x:mx-(mx-panRef.current.x)*(nz/zoomRef.current),y:my-(my-panRef.current.y)*(nz/zoomRef.current)}
      zoomRef.current=nz;applyT();return
    }
    lastPinch.current=null
    const xy={x:e.touches[0].clientX,y:e.touches[0].clientY}
    if(isPanning.current){panRef.current={x:panRef.current.x+(xy.x-lastMouse.current.x),y:panRef.current.y+(xy.y-lastMouse.current.y)};lastMouse.current=xy;applyT();return}
    if(isPainting.current){paintAt(toCanvas(xy.x,xy.y));lastMouse.current=xy}
  }

  function onTouchEnd(){
    if(isPainting.current) scheduleSave()
    isPainting.current=false;isPanning.current=false;lastPaintPos.current=null;lastPinch.current=null
  }

  function limpar(){
    if(!window.confirm('Limpar toda a pintura?')) return
    paintRef.current?.getContext('2d')?.clearRect(0,0,CW,CH)
    onSavePaint(paintRef.current.toDataURL('image/png'))
  }

  if(!plantaImg) return(
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#f8f7f4'}}>
      <div style={{textAlign:'center',padding:32,maxWidth:340}}>
        <div style={{fontSize:56,marginBottom:16}}>🖼️</div>
        <div style={{fontSize:18,fontWeight:600,color:'#374151',marginBottom:8}}>Carregar planta</div>
        <div style={{fontSize:13,color:'#6b7280',marginBottom:6}}>Aceita JPG ou PNG</div>
        <div style={{fontSize:12,color:'#9ca3af',marginBottom:24}}>Salva automaticamente na nuvem</div>
        <label style={{display:'inline-flex',alignItems:'center',gap:8,padding:'14px 28px',background:'#1D9E75',color:'#fff',borderRadius:12,fontSize:15,cursor:'pointer',fontWeight:600}}>
          📁 Selecionar imagem
          <input type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(!f) return;const r=new FileReader();r.onload=ev=>onUpload(ev.target.result);r.readAsDataURL(f)}} style={{display:'none'}}/>
        </label>
      </div>
    </div>
  )

  return(
    <div style={{flex:1,overflow:'hidden',background:'#e8e5de',position:'relative',cursor:tool==='pan'?'grab':tool==='erase'?'cell':'crosshair',userSelect:'none',touchAction:'none'}}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onWheel={onWheel}>
      {activeNF&&<div style={{position:'absolute',top:10,left:10,zIndex:10,background:activeNF.cor||'#ccc',padding:'5px 14px',borderRadius:8,fontSize:12,fontWeight:700,color:'#333',pointerEvents:'none',boxShadow:'0 2px 8px rgba(0,0,0,.15)'}}>🖌️ NF {activeNF.numero}</div>}
      {tool==='pan'&&<div style={{position:'absolute',top:10,left:10,zIndex:10,background:'rgba(255,255,255,.9)',padding:'5px 14px',borderRadius:8,fontSize:12,color:'#374151',border:'1px solid #e5e7eb',pointerEvents:'none'}}>✋ {isMobile?'2 dedos = zoom':'Arraste para mover'}</div>}
      {!activeNF&&tool==='pen'&&<div style={{position:'absolute',top:10,left:10,zIndex:10,background:'rgba(255,255,255,.9)',padding:'5px 14px',borderRadius:8,fontSize:11,color:'#9ca3af',border:'1px solid #e5e7eb',pointerEvents:'none'}}>← Selecione uma NF</div>}
      <div style={{position:'absolute',top:10,right:10,zIndex:10,display:'flex',gap:4}}>
        {[['＋',()=>{zoomRef.current=Math.min(8,zoomRef.current*1.2);applyT()}],
          ['－',()=>{zoomRef.current=Math.max(.15,zoomRef.current*0.83);applyT()}],
          ['⊡',()=>{zoomRef.current=1;panRef.current={x:0,y:0};applyT()}]].map(([ico,fn])=>(
          <button key={ico} onClick={fn} style={{width:isMobile?38:30,height:isMobile?38:30,border:'1px solid #e5e7eb',borderRadius:8,background:'rgba(255,255,255,.9)',cursor:'pointer',fontSize:isMobile?18:15,display:'flex',alignItems:'center',justifyContent:'center'}}>{ico}</button>
        ))}
        <span style={{padding:'0 8px',background:'rgba(255,255,255,.9)',border:'1px solid #e5e7eb',borderRadius:8,fontSize:11,display:'flex',alignItems:'center',color:'#6b7280',minWidth:46,justifyContent:'center'}}>{zoomPct}%</span>
        <button onClick={limpar} style={{padding:'0 10px',border:'1px solid #fecaca',borderRadius:8,background:'rgba(255,255,255,.9)',cursor:'pointer',fontSize:isMobile?12:10,color:'#ef4444',display:'flex',alignItems:'center'}}>🗑️</button>
      </div>
      <div ref={wrapperRef} style={{position:'absolute',top:0,left:0,width:CW,height:CH,transformOrigin:'0 0',boxShadow:'0 4px 20px rgba(0,0,0,.15)'}}>
        <canvas ref={bgRef} width={CW} height={CH} style={{position:'absolute',top:0,left:0,pointerEvents:'none'}}/>
        <canvas ref={paintRef} width={CW} height={CH} style={{position:'absolute',top:0,left:0,pointerEvents:'none'}}/>
      </div>
    </div>
  )
}
