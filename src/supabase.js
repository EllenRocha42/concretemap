import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rfkdwtegnyvbtfvwjkfa.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJma2R3dGVnbnl2YnRmdndqa2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTIzOTUsImV4cCI6MjA5NTU2ODM5NX0.Kr7PwV6PM_H5uHJP5kUGiE0ebK8QYhT3wSD3ApFIHCs'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export async function salvarImagemPlanta(pavimentoId, dataUrl) {
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const ext = blob.type.includes('png') ? 'png' : 'jpg'
    const path = `plantas/${pavimentoId}.${ext}`
    const { error } = await supabase.storage.from('plantas').upload(path, blob, { upsert: true, contentType: blob.type })
    if (error) { console.error('Erro upload planta:', error); return null }
    const { data } = supabase.storage.from('plantas').getPublicUrl(path)
    return data.publicUrl
  } catch(e) { console.error(e); return null }
}

export async function salvarPinturaStorage(pavimentoId, viewMode, dataUrl) {
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const path = `pinturas/${pavimentoId}_${viewMode}.png`
    const { error } = await supabase.storage.from('plantas').upload(path, blob, { upsert: true, contentType: 'image/png' })
    if (error) { console.error('Erro upload pintura:', error); return null }
    const { data } = supabase.storage.from('plantas').getPublicUrl(path)
    return data.publicUrl
  } catch(e) { console.error(e); return null }
}