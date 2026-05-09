import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MessageCircle, Send } from 'lucide-react'

export default function Chat() {
  const { profile } = useAuth()
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadMensajes()
    const channel = supabase
      .channel('chat-mensajes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
        setMensajes(prev => [...prev, payload.new])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [loading])

  async function loadMensajes() {
    const { data } = await supabase
      .from('mensajes')
      .select('*, profiles(username)')
      .order('created_at', { ascending: true })
      .limit(100)
    setMensajes(data || [])
    setLoading(false)
  }

  async function enviar(e) {
    e.preventDefault()
    const t = texto.trim()
    if (!t || !profile) return
    setSending(true)
    setTexto('')
    await supabase.from('mensajes').insert({ user_id: profile.id, texto: t })
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar(e)
    }
  }

  // Agrupar mensajes consecutivos del mismo usuario
  function isSameAuthor(i) {
    return i > 0 && mensajes[i].user_id === mensajes[i - 1].user_id
  }

  if (loading) return null

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100vh', paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}>

      {/* Header */}
      <div style={{ padding: '24px 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <MessageCircle size={20} color="var(--verde)" />
          <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em' }}>Chat</h1>
        </div>
        <p style={{ color: 'var(--text2)', fontSize: '13px' }}>Comenta con el grupo</p>
      </div>

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 12px' }}>
        {mensajes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
            <MessageCircle size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p style={{ fontSize: '14px' }}>Sé el primero en escribir algo</p>
          </div>
        ) : mensajes.map((m, i) => {
          const esMio = m.user_id === profile?.id
          const repetido = isSameAuthor(i)
          const fecha = format(new Date(m.created_at), "HH:mm", { locale: es })

          return (
            <div key={m.id} style={{
              display: 'flex',
              flexDirection: esMio ? 'row-reverse' : 'row',
              gap: '8px',
              marginBottom: '4px',
              marginTop: repetido ? '2px' : '12px',
              alignItems: 'flex-end',
            }}>
              {/* Avatar */}
              {!esMio && (
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--verde), #00796b)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: '700', color: '#000',
                  visibility: repetido ? 'hidden' : 'visible',
                }}>
                  {(m.profiles?.username || '?')[0].toUpperCase()}
                </div>
              )}

              <div style={{ maxWidth: '75%' }}>
                {/* Nombre */}
                {!esMio && !repetido && (
                  <p style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '3px', paddingLeft: '4px' }}>
                    {m.profiles?.username}
                  </p>
                )}
                {/* Burbuja */}
                <div style={{
                  background: esMio ? 'var(--verde)' : 'var(--bg3)',
                  color: esMio ? '#000' : 'var(--text)',
                  borderRadius: esMio ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '9px 13px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  wordBreak: 'break-word',
                }}>
                  {m.texto}
                </div>
                {/* Hora */}
                <p style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px', textAlign: esMio ? 'right' : 'left', paddingLeft: '4px' }}>
                  {fecha}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
        flexShrink: 0,
      }}>
        <form onSubmit={enviar} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            maxLength={300}
            rows={1}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: '20px',
              background: 'var(--bg3)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: '14px', resize: 'none',
              outline: 'none', lineHeight: '1.4', maxHeight: '100px',
              overflowY: 'auto', fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={!texto.trim() || sending}
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: texto.trim() ? 'var(--verde)' : 'var(--bg3)',
              border: 'none', cursor: texto.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s',
            }}
          >
            <Send size={16} color={texto.trim() ? '#000' : 'var(--text3)'} />
          </button>
        </form>
      </div>
    </div>
  )
}
