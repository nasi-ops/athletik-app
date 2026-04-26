import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import {
  Dumbbell, Plus, Calendar, Clock, ChevronRight,
  Trash2, LogOut, ArrowLeft, Flame, Trophy,
  RotateCcw, Weight, Pencil, Zap, Shield, Star,
  Crown, Target, Sword, Sparkles, User, Timer,
  BarChart2, Search, Play, Pause, Square, Frown,
  Meh, Smile, Laugh, X, Medal, Home as HomeIcon,
  Volume2, VolumeX, Bell, WifiOff
} from 'lucide-react'

// ==========================================
// 1. HELPERS & THEME
// ==========================================
const hexToRgba = (hex, opacity) => {
  hex = hex.replace('#', '')
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  const r = parseInt(hex.slice(0, 2), 16) || 230
  const g = parseInt(hex.slice(2, 4), 16) || 57
  const b = parseInt(hex.slice(4, 6), 16) || 70
  return `rgba(${r},${g},${b},${opacity})`
}

const adjustColor = (colorCode, amount = 20) => {
  return '#' + colorCode.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

const shadow = (color, opacity = 0.4) => `0 4px 24px ${hexToRgba(color, opacity)}`

const DEFAULT_THEME = {
  bg: '#0d0d0d',
  card: '#1a1a1a',
  text: '#ffffff',
  textMuted: '#999999',
}

const getStaggerDelay = (index) => ({ animationDelay: `${index * 0.1}s` })
const getFormStaggerDelay = (index) => ({ animationDelay: `${index * 0.08}s` })
const ICONS_MAP = { Dumbbell, Flame, Zap, Shield, Star, Crown, Target, Sword }
const COLORS_MAP = ['#e63946', '#ff6b35', '#3a86ff', '#2dc653', '#8338ec', '#ffd60a']
const EMOJI_MAP = { 1: Frown, 2: Meh, 3: Smile, 4: Laugh, 5: Zap }

// ==========================================
// 2. BACKGROUND PARTICLES CANVAS
// ==========================================
function ParticlesBackground({ active, primaryColor }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.15 + 0.05
    }))

    let mouse = { x: -999, y: -999 }

    const onMouseMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    window.addEventListener('mousemove', onMouseMove)

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const color = primaryColor || '#e63946'

      particles.forEach(p => {
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < 120) {
          p.x += dx * 0.015
          p.y += dy * 0.015
        }

        p.x += p.vx
        p.y += p.vy

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = color + Math.floor(p.opacity * 255).toString(16).padStart(2, '0')
        ctx.fill()
      })

      animRef.current = requestAnimationFrame(animate)
    }

    animate()

    const onResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
    }
  }, [active, primaryColor])

  if (!active) return null
  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }} />
}

// Cloche de boxe (audio context native + bell.mp3)

// ==========================================
// 4. MAIN APP ROUTER & LOGIC
// ==========================================
export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)

  const [primaryColor, setPrimaryColor] = useState(localStorage.getItem('primaryColor') || '#e63946')

  // Navigation State
  const [view, setView] = useState('home')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [navData, setNavData] = useState({})

  // Data State
  const [seances, setSeances] = useState([])
  const [badges, setBadges] = useState([])

  // Preferences State
  const [showParticles, setShowParticles] = useState(localStorage.getItem('particles') !== 'false')
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('athletik_onboarding_done') === 'false')

  // PWA & Offline State
  const [offlineMode, setOfflineMode] = useState(false)

  // Notification States
  const [remindersEnabled, setRemindersEnabled] = useState(localStorage.getItem('athletik_reminders') === 'true')
  const [reminderTime, setReminderTime] = useState(localStorage.getItem('athletik_reminder_time') || '18:00')
  const [reminderDays, setReminderDays] = useState(() => JSON.parse(localStorage.getItem('athletik_reminder_days') || '[1,2,3,4,5]'))

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
    return false
  }

  // Meta Viewport Fix for Mobile
  useEffect(() => {
    let meta = document.querySelector('meta[name=viewport]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'viewport'
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0'
      document.head.appendChild(meta)
    }
  }, [])

  // Dynamic CSS Generator for keyframes & specific classes based on primaryColor
  const getDynamicCss = () => `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;700;800&display=swap');

    :root {
      --color-primary: ${primaryColor};
    }

    body {
      background-color: ${DEFAULT_THEME.bg};
      color: ${DEFAULT_THEME.text};
      margin: 0;
      font-family: 'Inter', -apple-system, sans-serif;
      overflow-x: hidden;
    }

    h1, h2, h3, h4, .bebas {
      font-family: 'Bebas Neue', cursive;
      letter-spacing: 1px;
    }

    /* Animations */
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeOutLeft { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-100%); } }
    @keyframes pulseIdle { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
    @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulseTimer { 0% { box-shadow: 0 0 0 0 ${hexToRgba(primaryColor, 0.6)}; } 70% { box-shadow: 0 0 0 20px rgba(0,0,0,0); } 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); } }

    /* Utilities */
    .fade-out-delete { animation: fadeOutLeft 0.3s ease-in forwards !important; }
    .page-enter { animation: fadeIn 0.3s ease-out forwards; }
    .page-exit { animation: fadeOutLeft 0.3s ease-in forwards; }
    
    .content-wrapper { position: relative; z-index: 1; }

    .seance-card {
      background-color: ${DEFAULT_THEME.card}; borderRadius: 12px; padding: 16px; margin-bottom: 16px; width: 100%; box-sizing: border-box;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3); border-left: 3px solid transparent;
      transition: transform 0.2s ease, border-width 0.2s ease, border-color 0.2s ease; cursor: pointer; opacity: 0;
    }
    .seance-card:hover { transform: translateX(6px); border-left: 5px solid var(--color-primary); }

    .btn-primary {
      background: linear-gradient(135deg, ${primaryColor}, ${adjustColor(primaryColor, 20)});
      color: #fff; border: none; border-radius: 8px; padding: 14px 16px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: ${shadow(primaryColor, 0.4)}; transition: transform 0.2s ease, box-shadow 0.2s ease; position: relative; overflow: hidden;
    }
    .btn-primary::after {
      content: ''; position: absolute; top: 0; left: 0; width: 50%; height: 100%;
      background: linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent); transform: translateX(-100%);
    }
    .btn-primary:active::after, .btn-primary:hover::after { animation: shimmer 1s infinite linear; }
    .btn-pulse { animation: pulseIdle 2s infinite ease-in-out; }
    .btn-pulse:hover { animation: none; transform: translateY(-3px); box-shadow: ${shadow(primaryColor, 0.6)}; }

    .input-field {
      width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #333; background-color: #000; color: #fff; margin-bottom: 15px; box-sizing: border-box; font-size: 16px; transition: border-color 0.2s, box-shadow 0.2s;
    }
    .input-field:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 2px ${hexToRgba(primaryColor, 0.3)}; }

    .stat-bar-container { width: 100%; height: 12px; background: #333; border-radius: 6px; overflow: hidden; margin-top: 5px; }
    .stat-bar-fill { height: 100%; background: var(--color-primary); transition: width 0.5s ease; box-shadow: ${shadow(primaryColor, 0.4)}; }

    /* LAYOUT: Mobile First */
    .app-container { display: flex; flex-direction: column; min-height: 100vh; position: relative; z-index: 1; }
    .main-content { flex: 1; padding: 20px; box-sizing: border-box; padding-bottom: 80px; width: 100%; }
    .nav-bar-desktop { display: none; }
    .bottom-nav { 
      position: fixed; bottom: 0; left: 0; right: 0; background-color: ${DEFAULT_THEME.card}; display: flex; justify-content: space-around; padding: 10px 0; z-index: 100; border-top: 1px solid #333; height: 60px; box-sizing: border-box; align-items: center;
    }
    .grid-responsive { display: flex; flex-direction: column; gap: 12px; }
    .title-main { font-size: 32px; }
    .timer-text { font-size: 48px; }
    .timer-circle { width: 200px; height: 200px; }

    /* LAYOUT: Tablet */
    @media (min-width: 480px) {
      .grid-responsive { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .timer-text { font-size: 64px; }
      .timer-circle { width: 220px; height: 220px; }
    }

    /* LAYOUT: Desktop */
    @media (min-width: 768px) {
      .app-container { flex-direction: row; }
      .bottom-nav { display: none; }
      .nav-bar-desktop {
        display: flex; flex-direction: column; width: 64px; background-color: #111; align-items: center; padding-top: 20px; gap: 30px; border-right: 1px solid #333; height: 100vh; position: fixed; z-index: 100;
      }
      .main-content { margin-left: 64px; padding: 40px; max-width: 960px; margin-right: auto; padding-bottom: 40px; }
      .grid-responsive { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
      .title-main { font-size: 48px; }
      .timer-text { font-size: 72px; }
      .timer-circle { width: 250px; height: 250px; }
    }
    
    .timer-circle {
      border-radius: 50%; border: 4px solid #333; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; margin: 40px auto;
    }
    .timer-circle.running { border-color: var(--color-primary); animation: pulseTimer 2s infinite; }
    
    .sparkles-btn {
      position: fixed; bottom: 80px; right: 16px; z-index: 100; background: #1c1c1c; border: 1px solid var(--color-primary); border-radius: 50%; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: ${shadow(primaryColor, 0.4)}; transition: transform 0.2s; color: var(--color-primary);
    }
    @media (min-width: 768px) { .sparkles-btn { bottom: 16px; } }

    @keyframes bellShake {
      0%   { transform: rotate(0deg); }
      25%  { transform: rotate(15deg); }
      50%  { transform: rotate(0deg); }
      75%  { transform: rotate(-15deg); }
      100% { transform: rotate(0deg); }
    }
  `

  // Init Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (uid) => {
    try {
      const { data, error } = await supabase.from('profils').select('*').eq('user_id', uid).maybeSingle()
      if (error) throw error
      if (data) {
        setProfile(data)
        if (data.couleur_principale) {
          setPrimaryColor(data.couleur_principale)
          localStorage.setItem('primaryColor', data.couleur_principale)
        }
      } else {
        const { data: newProf, error: insErr } = await supabase
          .from('profils')
          .insert([{ user_id: uid, couleur_principale: '#e63946', avatar: 'Dumbbell' }])
          .select()
          .single()
        if (insErr) throw insErr
        setProfile(newProf)
      }
    } catch (err) {
      console.error("Profile Error:", err.message)
    }
  }

  const checkBadges = (data) => {
    let unlocked = []
    if (data.length >= 1) unlocked.push("Premier pas")
    if (data.length >= 30) unlocked.push("Guerrier")
    if (data.some(s => s.duree_minutes > 90)) unlocked.push("Marathon")
    const distinctSports = new Set(data.map(s => s.sport))
    if (distinctSports.size >= 3) unlocked.push("Polyvalent")
    setBadges(unlocked)
  }

  const fetchSeances = async (uid) => {
    try {
      const { data, error } = await supabase
        .from('seances')
        .select('*')
        .eq('user_id', uid)
        .order('date', { ascending: false })
      if (error) throw error
      if (data) {
        setSeances(data)
        checkBadges(data)
        localStorage.setItem('athletik_seances_cache', JSON.stringify(data))
      }
    } catch (err) {
      console.error("Seances Error:", err.message)
      const cache = localStorage.getItem('athletik_seances_cache')
      if (cache) {
        setSeances(JSON.parse(cache))
        setOfflineMode(true)
      }
    }
  }

  // Mode Hors-ligne
  useEffect(() => {
    const handleOnline = () => {
      setOfflineMode(false)
      if (session?.user?.id) fetchSeances(session.user.id)
    }
    const handleOffline = () => setOfflineMode(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (!navigator.onLine) setOfflineMode(true)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [session])

  // Rappels
  useEffect(() => {
    if (!remindersEnabled) return
    const checkReminder = () => {
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const currentDay = now.getDay()
      if (currentTime === reminderTime && reminderDays.includes(currentDay)) {
        if (Notification.permission === 'granted') {
          new Notification('Athlétik 💪', {
            body: 'C\'est l\'heure de t\'entraîner ! Bonne séance.',
            icon: '/icon.svg'
          })
        }
      }
    }
    const interval = setInterval(checkReminder, 60000)
    return () => clearInterval(interval)
  }, [remindersEnabled, reminderTime, reminderDays])

  // Sync Data
  useEffect(() => {
    if (session?.user?.id) {
      const uid = session.user.id
      fetchProfile(uid)
      fetchSeances(uid)
      if (localStorage.getItem('athletik_onboarding_done') === 'false') setShowOnboarding(true)
    }
  }, [session])

  const toggleParticles = () => {
    const val = !showParticles
    setShowParticles(val)
    localStorage.setItem('particles', val)
  }

  const navigate = (newView, data = {}) => {
    setIsTransitioning(true)
    setNavData(data)
    setTimeout(() => {
      setView(newView)
      setIsTransitioning(false)
      window.scrollTo(0, 0)
    }, 250)
  }

  if (!session) {
    return (
      <>
        <style>{getDynamicCss()}</style>
        <ParticlesBackground active={showParticles} primaryColor={primaryColor} />
        <div className="content-wrapper"><Auth /></div>
      </>
    )
  }

  return (
    <>
      <style>{getDynamicCss()}</style>
      <ParticlesBackground active={showParticles} primaryColor={primaryColor} />

      {offlineMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#ff6b35', color: '#fff', textAlign: 'center', padding: '8px', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <WifiOff size={16} /> Mode hors-ligne — données en cache
        </div>
      )}

      {showOnboarding && <Onboarding onClose={() => { setShowOnboarding(false); localStorage.setItem('athletik_onboarding_done', 'true') }} pseudo={profile?.pseudo} />}

      <button className="sparkles-btn" onClick={toggleParticles}><Sparkles size={20} /></button>

      <div className="app-container">
        {/* Nav Desktop */}
        <nav className="nav-bar-desktop">
          <Trophy size={28} color="var(--color-primary)" style={{ cursor: 'pointer' }} onClick={() => navigate('home')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginTop: '20px' }}>
            <NavIcon icon={HomeIcon} active={view === 'home'} onClick={() => navigate('home')} />
            <NavIcon icon={Timer} active={view === 'timer'} onClick={() => navigate('timer')} />
            <NavIcon icon={BarChart2} active={view === 'stats'} onClick={() => navigate('stats')} />
            <NavIcon icon={User} active={view === 'profile'} onClick={() => navigate('profile')} />
          </div>
          <div style={{ marginTop: 'auto', marginBottom: '20px' }}>
            <button onClick={async () => await supabase.auth.signOut()} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><LogOut size={24} /></button>
          </div>
        </nav>

        {/* Nav Mobile */}
        <nav className="bottom-nav">
          <NavIcon icon={HomeIcon} active={view === 'home'} onClick={() => navigate('home')} />
          <NavIcon icon={Timer} active={view === 'timer'} onClick={() => navigate('timer')} />
          <NavIcon icon={BarChart2} active={view === 'stats'} onClick={() => navigate('stats')} />
          <NavIcon icon={User} active={view === 'profile'} onClick={() => navigate('profile')} />
        </nav>

        <main className={`main-content ${isTransitioning ? 'page-exit' : 'page-enter'}`}>
          {view === 'home' && <Home seances={seances} onNavigate={navigate} />}
          {view === 'create_seance' && <CreateSeance userId={session.user.id} onBack={() => navigate('home')} onCreated={fetchSeances} navigate={navigate} />}
          {view === 'seance_detail' && <SeanceDetail seance={navData.seance} onBack={() => navigate('home')} onDelete={fetchSeances} navigate={navigate} primaryColor={primaryColor} />}
          {view === 'add_exercice' && <AddExercice seanceId={navData.seanceId} onBack={() => navigate('seance_detail', { seance: navData.seance })} primaryColor={primaryColor} />}
          {view === 'profile' && (
            <Profile
              profile={profile}
              seances={seances}
              badges={badges}
              onUpdate={fetchProfile}
              primaryColor={primaryColor}
              remindersEnabled={remindersEnabled}
              setRemindersEnabled={setRemindersEnabled}
              reminderTime={reminderTime}
              setReminderTime={setReminderTime}
              reminderDays={reminderDays}
              setReminderDays={setReminderDays}
              requestNotificationPermission={requestNotificationPermission}
            />
          )}
          {view === 'stats' && <Stats seances={seances} />}
          {view === 'timer' && <TimerView />}
          {view === 'active_session' && <ActiveSession seance={navData.seance} onFinish={() => navigate('seance_detail', { seance: navData.seance })} primaryColor={primaryColor} />}
        </main>
      </div>
    </>
  )
}

function NavIcon({ icon: Icon, active, onClick }) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', padding: '10px', borderRadius: '12px', backgroundColor: active ? 'rgba(255,255,255,0.05)' : 'transparent', color: active ? 'var(--color-primary)' : '#555', transition: 'all 0.2s' }}>
      <Icon size={24} />
    </div>
  )
}

// ==========================================
// 5. SECTIONS
// ==========================================
function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error: err } = isLogin ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password })
    if (err) {
      setError(err.message)
    } else if (!isLogin) {
      localStorage.setItem('athletik_onboarding_done', 'false')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px', animation: 'fadeIn 0.8s' }}>
        <Trophy size={56} color="var(--color-primary)" style={{ marginBottom: '10px' }} />
        <h1 className="bebas" style={{ margin: 0, fontSize: '48px', color: '#fff' }}>ATHLÉTIK</h1>
      </div>
      <div style={{ backgroundColor: DEFAULT_THEME.card, borderRadius: '16px', padding: '30px', animation: 'slideUp 0.5s ease-out' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '25px', color: DEFAULT_THEME.textMuted }}>{isLogin ? 'Connexion' : 'Créer un compte'}</h2>
        <form onSubmit={handleAuth}>
          <input type="email" className="input-field" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" className="input-field" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p style={{ color: 'var(--color-primary)', fontSize: '14px', marginBottom: '10px' }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={loading}>
            <Flame size={20} /> {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : 'S\'inscrire')}
          </button>
        </form>
        <button style={{ width: '100%', marginTop: '20px', background: 'none', border: 'none', color: DEFAULT_THEME.textMuted, cursor: 'pointer' }} onClick={() => setIsLogin(!isLogin)} type="button">
          {isLogin ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
        </button>
      </div>
    </div>
  )
}

function Home({ seances, onNavigate }) {
  const [search, setSearch] = useState('')
  const [filterSport, setFilterSport] = useState('Tous')
  const sports = ["Tous", "MMA", "Boxe", "Muay Thaï", "Lutte", "BJJ", "Musculation", "Cardio", "Autre"]

  const filtered = seances.filter(s => {
    if (filterSport !== 'Tous' && s.sport !== filterSport) return false
    if (search && !s.titre.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="bebas title-main" style={{ margin: 0 }}>MES SÉANCES</h1>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' }}>
        {sports.map(s => (
          <button key={s} onClick={() => setFilterSport(s)} style={{ whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: '20px', border: '1px solid', borderColor: filterSport === s ? 'var(--color-primary)' : '#333', background: filterSport === s ? 'var(--color-primary)' : 'transparent', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>{s}</button>
        ))}
      </div>
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={18} color="#555" style={{ position: 'absolute', top: '14px', left: '12px' }} />
        <input type="text" placeholder="Rechercher une séance..." value={search} onChange={e => setSearch(e.target.value)} className="input-field" style={{ paddingLeft: '40px', marginBottom: 0 }} />
      </div>
      <button className="btn-primary btn-pulse" onClick={() => onNavigate('create_seance')} style={{ marginBottom: '25px' }}><Plus size={20} /> Nouvelle Séance</button>
      <div className="grid-responsive">
        {filtered.map((s, i) => (
          <div key={s.id} className="seance-card" style={{ display: 'flex', animation: `fadeInUp 0.4s ease-out forwards ${i * 0.05}s` }} onClick={() => onNavigate('seance_detail', { seance: s })}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><Dumbbell size={16} color="var(--color-primary)" /><h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', fontFamily: 'Inter' }}>{s.titre}</h3></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: DEFAULT_THEME.textMuted, fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {s.date ? new Date(s.date).toLocaleDateString() : 'Date...'}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {s.duree_minutes} min</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ backgroundColor: '#333', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><Flame size={12} color="var(--color-primary)" /> {s.sport}</span>
              <ChevronRight size={18} color={DEFAULT_THEME.textMuted} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ textAlign: 'center', color: DEFAULT_THEME.textMuted, padding: '40px 0', gridColumn: '1 / -1' }}><Dumbbell size={48} opacity={0.2} style={{ marginBottom: '10px' }} /><p>Aucune séance trouvée.</p></div>}
      </div>
    </>
  )
}

function CreateSeance({ userId, onBack, onCreated, navigate }) {
  const [titre, setTitre] = useState(''); const [sport, setSport] = useState('MMA'); const [date, setDate] = useState(new Date().toISOString().split('T')[0]); const [duree, setDuree] = useState(60); const [loading, setLoading] = useState(false)
  const sports = ["MMA", "Boxe", "Muay Thaï", "Lutte", "BJJ", "Musculation", "Cardio", "Autre"]
  const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); const { data, error } = await supabase.from('seances').insert([{ user_id: userId, titre, sport, date, duree_minutes: parseInt(duree) }]).select(); setLoading(false); if (!error && data) { onCreated(); navigate('seance_detail', { seance: data[0] }) } }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}><button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }} onClick={onBack}><ArrowLeft size={24} /></button><h2 className="bebas title-main" style={{ margin: 0 }}>CRÉER SÉANCE</h2></div>
      <form onSubmit={handleSubmit} style={{ backgroundColor: DEFAULT_THEME.card, padding: '20px', borderRadius: '12px' }}>
        <div style={{ ...getFormStaggerDelay(1), animation: 'slideInRight 0.4s forwards', opacity: 0 }}><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: DEFAULT_THEME.textMuted }}>Titre</label><input className="input-field" value={titre} onChange={e => setTitre(e.target.value)} required /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }} className="grid-responsive">
          <div style={{ animation: 'slideInRight 0.4s forwards 0.1s', opacity: 0 }}><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: DEFAULT_THEME.textMuted }}>Sport</label><select className="input-field" value={sport} onChange={e => setSport(e.target.value)}>{sports.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div style={{ animation: 'slideInRight 0.4s forwards 0.2s', opacity: 0 }}><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: DEFAULT_THEME.textMuted }}>Date</label><input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} required /></div>
        </div>
        <div style={{ animation: 'slideInRight 0.4s forwards 0.3s', opacity: 0 }}><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: DEFAULT_THEME.textMuted }}>Durée estimée (min)</label><input type="number" className="input-field" value={duree} onChange={e => setDuree(e.target.value)} required min="1" /></div>
        <button type="submit" className="btn-primary" style={{ animation: 'fadeInUp 0.4s forwards 0.4s', opacity: 0 }} disabled={loading}>{loading ? 'Création...' : 'Valider'}</button>
      </form>
    </>
  )
}

function SeanceDetail({ seance, onBack, onDelete, navigate, primaryColor }) {
  const [exercices, setExercices] = useState([]); const [note, setNote] = useState(''); const [mood, setMood] = useState(null); const [savingNote, setSavingNote] = useState(false); const [editingEx, setEditingEx] = useState(null)
  useEffect(() => {
    if (seance) {
      fetchExercices(); setNote(seance?.notes || '')
      if (seance?.notes && seance.notes.startsWith('Mood:')) { const match = seance.notes.match(/Mood:\s(\d)\s\|\s(.*)/); if (match) { setMood(parseInt(match[1])); setNote(match[2]) } }
    }
  }, [seance])
  const fetchExercices = async () => { const { data } = await supabase.from('exercices').select('*').eq('seance_id', seance.id).order('created_at', { ascending: true }); if (data) setExercices(data) }
  const handleDelete = async () => { if (confirm("Supprimer la séance ?")) { await supabase.from('seances').delete().eq('id', seance.id); onDelete(); onBack() } }
  const handleSaveNotes = async () => { setSavingNote(true); const finalNote = mood ? `Mood: ${mood} | ${note}` : note; await supabase.from('seances').update({ notes: finalNote }).eq('id', seance.id); setSavingNote(false) }

  if (!seance) return null
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }} onClick={onBack}><ArrowLeft size={24} /></button>
          <h2 className="bebas title-main" style={{ margin: 0, maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seance.titre}</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => navigate('active_session', { seance })} style={{ backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold' }}><Play size={16} /><span className="desktop-only" style={{ '@media (max-width: 480px)': { display: 'none' } }}>Start</span></button>
          <button onClick={handleDelete} style={{ background: 'rgba(255, 77, 79, 0.1)', color: '#ff4d4f', border: '1px solid #ff4d4f', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Trash2 size={16} /></button>
        </div>
      </div>
      <div style={{ backgroundColor: DEFAULT_THEME.card, padding: '16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold' }}><Flame size={16} color="var(--color-primary)" /> {seance.sport}</div>
        <div style={{ display: 'flex', gap: '15px', color: DEFAULT_THEME.textMuted, fontSize: '13px' }}><span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> {seance.date ? new Date(seance.date).toLocaleDateString() : 'Date...'}</span><span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> {seance.duree_minutes} min</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}><h3 className="bebas" style={{ margin: 0, fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Dumbbell size={18} color="var(--color-primary)" /> EXERCICES</h3><button className="btn-primary" style={{ width: 'auto', padding: '6px 12px', marginTop: 0 }} onClick={() => navigate('add_exercice', { seanceId: seance.id })}><Plus size={16} /></button></div>
      <div className="grid-responsive" style={{ marginBottom: '30px' }}>
        {exercices.map((e, index) => (
          <div key={e.id} style={{ display: 'block', animation: `fadeInUp 0.4s ease-out forwards ${index * 0.1}s` }}>
            {editingEx === e.id ? <EditExerciceForm exercice={e} onSave={() => { setEditingEx(null); fetchExercices() }} onCancel={() => setEditingEx(null)} primaryColor={primaryColor} /> :
              <div className="seance-card" style={{ display: 'block', opacity: 1, animation: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}><h4 style={{ margin: 0, fontSize: '15px', fontFamily: 'Inter' }}>{e.nom}</h4><div style={{ display: 'flex', gap: '10px' }}><button style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 0 }} onClick={() => setEditingEx(e.id)}><Pencil size={14} /></button><button style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: 0 }} onClick={async () => { await supabase.from('exercices').delete().eq('id', e.id); fetchExercices() }}><Trash2 size={14} /></button></div></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '12px', color: '#ccc' }}>
                  {e.series && <span style={{ backgroundColor: '#2a2a2a', padding: '4px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><RotateCcw size={10} /> {e.series} x {e.repetitions}</span>}
                  {e.poids_kg && <span style={{ backgroundColor: '#2a2a2a', padding: '4px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Weight size={10} /> {e.poids_kg} kg</span>}
                  {e.rounds && <span style={{ backgroundColor: '#2a2a2a', padding: '4px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><RotateCcw size={10} /> {e.rounds} rnds</span>}
                  {e.duree_secondes && <span style={{ backgroundColor: '#2a2a2a', padding: '4px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10} /> {e.duree_secondes} s</span>}
                </div>
              </div>
            }
          </div>
        ))}
        {exercices.length === 0 && <div style={{ textAlign: 'center', color: DEFAULT_THEME.textMuted, gridColumn: '1 / -1' }}><p>Aucun exercice.</p></div>}
      </div>
      <div style={{ backgroundColor: DEFAULT_THEME.card, padding: '20px', borderRadius: '12px' }}>
        <h3 className="bebas" style={{ margin: '0 0 15px 0', fontSize: '18px' }}>RESSENTI DE LA SÉANCE</h3>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '15px' }}>
          {[1, 2, 3, 4, 5].map(m => { const Icon = EMOJI_MAP[m]; return <button key={m} onClick={() => setMood(m)} style={{ background: mood === m ? 'var(--color-primary)' : '#333', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'all 0.2s', transform: mood === m ? 'scale(1.1)' : 'scale(1)', boxShadow: mood === m ? shadow(primaryColor, 0.4) : 'none' }}><Icon size={18} /></button> })}
        </div>
        <textarea className="input-field" placeholder="Notes (ex: sparring dur, bonne technique...)" style={{ minHeight: '60px', fontFamily: 'Inter' }} value={note} onChange={e => setNote(e.target.value)} />
        <button onClick={handleSaveNotes} className="btn-primary" style={{ marginTop: 0 }} disabled={savingNote}>{savingNote ? '...' : 'Sauvegarder Note'}</button>
      </div>
    </>
  )
}

function EditExerciceForm({ exercice, onSave, onCancel, primaryColor }) {
  const [formData, setFormData] = useState({ nom: exercice.nom, series: exercice.series || '', repetitions: exercice.repetitions || '', poids_kg: exercice.poids_kg || '', duree_secondes: exercice.duree_secondes || '', rounds: exercice.rounds || '' })
  const submit = async (e) => { e.preventDefault(); const payload = { ...formData, series: parseInt(formData.series) || null, repetitions: parseInt(formData.repetitions) || null, poids_kg: parseFloat(formData.poids_kg) || null, duree_secondes: parseInt(formData.duree_secondes) || null, rounds: parseInt(formData.rounds) || null }; await supabase.from('exercices').update(payload).eq('id', exercice.id); onSave() }
  return (
    <form onSubmit={submit} style={{ backgroundColor: '#222', padding: '12px', borderRadius: '12px', borderLeft: '3px solid var(--color-primary)', animation: 'slideUp 0.3s' }}>
      <input className="input-field" style={{ padding: '8px', marginBottom: '10px' }} value={formData.nom} onChange={e => setFormData({ ...formData, nom: e.target.value })} required />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <input type="number" placeholder="Séries" className="input-field" style={{ padding: '8px', marginBottom: 0 }} value={formData.series} onChange={e => setFormData({ ...formData, series: e.target.value })} />
        <input type="number" placeholder="Reps" className="input-field" style={{ padding: '8px', marginBottom: 0 }} value={formData.repetitions} onChange={e => setFormData({ ...formData, repetitions: e.target.value })} />
        <input type="number" step="0.5" placeholder="Poids" className="input-field" style={{ padding: '8px', marginBottom: 0 }} value={formData.poids_kg} onChange={e => setFormData({ ...formData, poids_kg: e.target.value })} />
        <input type="number" placeholder="Rounds" className="input-field" style={{ padding: '8px', marginBottom: 0 }} value={formData.rounds} onChange={e => setFormData({ ...formData, rounds: e.target.value })} />
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #555', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>Annule</button>
        <button type="submit" style={{ flex: 1, padding: '8px', background: 'var(--color-primary)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: shadow(primaryColor, 0.4) }}>Save</button>
      </div>
    </form>
  )
}

function AddExercice({ seanceId, onBack }) {
  const [formData, setFormData] = useState({ nom: '', series: '', repetitions: '', poids_kg: '', duree_secondes: '', rounds: '' })
  const submit = async (e) => { e.preventDefault(); const payload = { seance_id: seanceId, nom: formData.nom, series: parseInt(formData.series) || null, repetitions: parseInt(formData.repetitions) || null, poids_kg: parseFloat(formData.poids_kg) || null, duree_secondes: parseInt(formData.duree_secondes) || null, rounds: parseInt(formData.rounds) || null }; await supabase.from('exercices').insert([payload]); onBack() }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}><button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }} onClick={onBack}><ArrowLeft size={24} /></button><h2 className="bebas title-main" style={{ margin: 0 }}>AJOUTER EXERCICE</h2></div>
      <form onSubmit={submit} style={{ backgroundColor: DEFAULT_THEME.card, padding: '20px', borderRadius: '12px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: DEFAULT_THEME.textMuted }}>Nom / Technique</label>
        <input className="input-field" value={formData.nom} onChange={e => setFormData({ ...formData, nom: e.target.value })} required />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: DEFAULT_THEME.textMuted }}>Séries</label><input type="number" className="input-field" value={formData.series} onChange={e => setFormData({ ...formData, series: e.target.value })} /></div>
          <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: DEFAULT_THEME.textMuted }}>Reps</label><input type="number" className="input-field" value={formData.repetitions} onChange={e => setFormData({ ...formData, repetitions: e.target.value })} /></div>
          <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: DEFAULT_THEME.textMuted }}>Poids (kg)</label><input type="number" step="0.5" className="input-field" value={formData.poids_kg} onChange={e => setFormData({ ...formData, poids_kg: e.target.value })} /></div>
          <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: DEFAULT_THEME.textMuted }}>Rounds</label><input type="number" className="input-field" value={formData.rounds} onChange={e => setFormData({ ...formData, rounds: e.target.value })} /></div>
        </div>
        <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}><Plus size={20} /> Ajouter</button>
      </form>
    </>
  )
}

function TimerView() {
  // ---- REFS (jamais perdues entre renders) ----
  const intervalRef = useRef(null)
  const startTimeRef = useRef(0)
  const elapsedRef = useRef(0)
  const phaseRef = useRef('round')
  const roundRef = useRef(1)
  const soundEnabledRef = useRef(true)
  const bellLoopRef = useRef(null)
  const [bellRinging, setBellRinging] = useState(false)

  // Cleanup
  useEffect(() => {
    return () => stopBell()
  }, [])

  const playBell = () => {
    if (!soundEnabledRef.current) return
    try {
      const audio = new Audio('/bell.mp3')
      audio.volume = 1.0
      audio.play().catch(err => console.log('Audio error:', err))
    } catch(e) {
      console.log('Bell error:', e)
    }
  }

  const playBellLoop = () => {
    if (!soundEnabledRef.current) return
    setBellRinging(true)
    playBell()
    bellLoopRef.current = setInterval(playBell, 2500)
  }

  const stopBell = () => {
    if (bellLoopRef.current) {
      clearInterval(bellLoopRef.current)
      bellLoopRef.current = null
    }
    setBellRinging(false)
  }

  const playBeep = (type) => {
    if (!soundEnabledRef.current) return
    if (type === 'countdown') {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.frequency.setValueAtTime(880, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.1)
    } else {
      playBellLoop()
    }
  }

  // ---- STATES (seulement pour l'affichage) ----
  const [displayMs, setDisplayMs] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [chronoMode, setChronoMode] = useState('chrono')
  const [phase, setPhase] = useState('round')
  const [currentRound, setCurrentRound] = useState(1)
  const [soundEnabled, setSoundEnabled] = useState(() =>
    localStorage.getItem('athletik_sound') !== 'false'
  )
  const [roundConfig, setRoundConfig] = useState({
    round: 3, repos: 1, total: 3
  })
  const [minuteurMinutes, setMinuteurMinutes] = useState(5)

  // Sync soundEnabled → ref
  useEffect(() => {
    soundEnabledRef.current = soundEnabled
    localStorage.setItem('athletik_sound', soundEnabled)
  }, [soundEnabled])

  // ---- TICK FUNCTION ----
  const tick = useCallback(() => {
    const now = Date.now()
    const elapsed = elapsedRef.current + (now - startTimeRef.current)
    setDisplayMs(elapsed)

    if (chronoMode === 'minuteur') {
      const total = minuteurMinutes * 60 * 1000
      const remaining = total - elapsed
      const remSec = Math.ceil(remaining / 1000)

      if (remSec <= 3 && remSec > 0 && remSec !== lastBeepSecRef.current) {
        lastBeepSecRef.current = remSec
        if (soundEnabledRef.current) playBeep('countdown')
      }
      if (remaining <= 0) {
        elapsedRef.current = total
        setDisplayMs(total)
        clearInterval(intervalRef.current)
        setIsRunning(false)
        if (soundEnabledRef.current) playBeep('minuteur_end')
      }
    }

    if (chronoMode === 'rounds') {
      const phaseDuration = (phaseRef.current === 'round'
        ? roundConfig.round
        : roundConfig.repos) * 60 * 1000
      const remaining = phaseDuration - elapsed
      const remSec = Math.ceil(remaining / 1000)

      if (remSec <= 3 && remSec > 0 && remSec !== lastBeepSecRef.current) {
        lastBeepSecRef.current = remSec
        if (soundEnabledRef.current) playBeep('countdown')
      }

      if (remaining <= 0) {
        elapsedRef.current = 0
        startTimeRef.current = Date.now()
        lastBeepSecRef.current = -1

        if (phaseRef.current === 'round') {
          if (roundRef.current >= roundConfig.total) {
            clearInterval(intervalRef.current)
            setIsRunning(false)
            setDisplayMs(0)
            if (soundEnabledRef.current) playBeep('session_end')
          } else {
            phaseRef.current = 'rest'
            setPhase('rest')
            if (soundEnabledRef.current) playBeep('round_end')
          }
        } else {
          phaseRef.current = 'round'
          setPhase('round')
          roundRef.current = roundRef.current + 1
          setCurrentRound(roundRef.current)
          if (soundEnabledRef.current) playBeep('rest_end')
        }
      }
    }
  }, [chronoMode, minuteurMinutes, roundConfig])

  // ---- START / PAUSE ----
  const handleStartPause = () => {
    if (isRunning) {
      clearInterval(intervalRef.current)
      elapsedRef.current += Date.now() - startTimeRef.current
      setIsRunning(false)
    } else {
      startTimeRef.current = Date.now()
      lastBeepSecRef.current = -1
      intervalRef.current = setInterval(tick, 50)
      setIsRunning(true)
    }
  }

  // ---- RESET ----
  const handleReset = () => {
    clearInterval(intervalRef.current)
    elapsedRef.current = 0
    lastBeepSecRef.current = -1
    phaseRef.current = 'round'
    roundRef.current = 1
    setDisplayMs(0)
    setIsRunning(false)
    setPhase('round')
    setCurrentRound(1)
  }

  // Cleanup au démontage
  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  // ---- FORMATAGE AFFICHAGE ----
  const getDisplayTime = () => {
    let ms = displayMs

    if (chronoMode === 'minuteur') {
      ms = Math.max(0, minuteurMinutes * 60 * 1000 - displayMs)
    }
    if (chronoMode === 'rounds') {
      const phaseDuration = (phase === 'round'
        ? roundConfig.round
        : roundConfig.repos) * 60 * 1000
      ms = Math.max(0, phaseDuration - displayMs)
    }

    const mins = Math.floor(ms / 60000)
    const secs = Math.floor((ms % 60000) / 1000)
    const cs = Math.floor((ms % 1000) / 10)
    return {
      main: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      sub: `.${String(cs).padStart(2, '0')}`
    }
  }

  const { main, sub } = getDisplayTime()

  return (
    <div style={{ textAlign: 'center', animation: 'fadeInUp 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h1 className="bebas title-main" style={{ margin: 0 }}>CHRONOMÈTRE</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={playBell} style={{ padding: '8px 16px', background: '#1c1c1c', border: '1px solid var(--color-primary)', borderRadius: 8, color: 'var(--color-primary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold' }}><Volume2 size={14} /> TEST</button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ background: 'none', border: 'none', color: soundEnabled ? 'var(--color-primary)' : '#555', cursor: 'pointer' }}>
            {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '10px' }}>
        {['chrono', 'minuteur', 'rounds'].map(mod => (
          <button key={mod} onClick={() => { setChronoMode(mod); handleReset() }} style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--color-primary)', background: chronoMode === mod ? 'var(--color-primary)' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>{mod}</button>
        ))}
        {chronoMode === 'chrono' && <button onClick={() => playBeep('countdown')} style={{ padding: '6px 14px', borderRadius: '20px', background: '#333', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px' }}><Bell size={14} /></button>}
      </div>

      {chronoMode === 'minuteur' && (
        <div style={{ backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '12px', display: 'flex', justifyContent: 'center', gap: '10px', maxWidth: '300px', margin: '0 auto 20px', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', color: '#999' }}>Durée (min) :</label><input type="number" className="input-field" style={{ width: '80px', marginBottom: 0, padding: '8px', textAlign: 'center' }} value={minuteurMinutes} onChange={e => setMinuteurMinutes(e.target.value)} disabled={isRunning} />
        </div>
      )}

      {chronoMode === 'rounds' && (
        <div style={{ backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '400px', margin: '0 auto 20px' }}>
          <div><label style={{ fontSize: '12px', color: '#999', display: 'block', marginBottom: '5px' }}>Round</label><input type="number" className="input-field" style={{ width: '100%', marginBottom: 0, textAlign: 'center', padding: '8px' }} value={roundConfig.round} onChange={e => setRoundConfig({ ...roundConfig, round: e.target.value })} disabled={isRunning} /></div>
          <div><label style={{ fontSize: '12px', color: '#999', display: 'block', marginBottom: '5px' }}>Repos</label><input type="number" className="input-field" style={{ width: '100%', marginBottom: 0, textAlign: 'center', padding: '8px' }} value={roundConfig.repos} onChange={e => setRoundConfig({ ...roundConfig, repos: e.target.value })} disabled={isRunning} /></div>
          <div><label style={{ fontSize: '12px', color: '#999', display: 'block', marginBottom: '5px' }}>Total</label><input type="number" className="input-field" style={{ width: '100%', marginBottom: 0, textAlign: 'center', padding: '8px' }} value={roundConfig.total} onChange={e => setRoundConfig({ ...roundConfig, total: e.target.value })} disabled={isRunning} /></div>
        </div>
      )}

      {chronoMode === 'rounds' && (
        <h2 className="bebas" style={{ fontSize: '28px', margin: 0, color: phase === 'rest' ? '#2dc653' : 'var(--color-primary)' }}>
          {phase === 'rest' ? 'REPOS' : `ROUND ${currentRound} / ${roundConfig.total}`}
        </h2>
      )}

      <div className={`timer-circle ${isRunning && phase !== 'rest' ? 'running' : ''}`}>
        <div className="bebas timer-text" style={{ lineHeight: '1' }}>{main}</div>
        <div className="bebas" style={{ fontSize: '28px', color: 'var(--color-primary)' }}>{sub}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px' }}>
        {!isRunning ? (
          <button onClick={handleStartPause} style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#2dc653', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(45,198,83,0.4)' }}><Play size={28} /></button>
        ) : (
          <button onClick={handleStartPause} style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#ff6b35', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(255,107,53,0.4)' }}><Pause size={28} /></button>
        )}
        <button onClick={handleReset} style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#333', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Square size={22} /></button>
      </div>

      {bellRinging && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ fontSize: 80, animation: 'bellShake 0.5s infinite' }}>🔔</div>
          <p style={{ color: '#fff', fontFamily: 'Bebas Neue, sans-serif', fontSize: 32, margin: 0, letterSpacing: 2 }}>{chronoMode === 'rounds' ? 'FIN DU ROUND' : 'TEMPS ÉCOULÉ'}</p>
          <button onClick={stopBell} style={{ padding: '16px 48px', background: 'linear-gradient(135deg, var(--color-primary), #ff6b35)', border: 'none', borderRadius: 12, color: '#fff', fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: 2, cursor: 'pointer', boxShadow: '0 4px 24px rgba(230,57,70,0.5)', marginTop: 8 }}>ARRÊTER</button>
          <p style={{ color: '#888', fontSize: 13, margin: 0 }}>Appuie pour continuer</p>
        </div>
      )}
    </div>
  )
}

function Profile({
  profile, seances, badges, onUpdate, primaryColor,
  remindersEnabled, setRemindersEnabled, reminderTime, setReminderTime,
  reminderDays, setReminderDays, requestNotificationPermission
}) {
  const [formData, setFormData] = useState(profile || {})
  const [saving, setSaving] = useState(false)
  const sports = ["MMA", "Boxe", "Muay Thaï", "Lutte", "BJJ", "Musculation", "Cardio", "Autre"]
  const niveaux = ["Débutant", "Intermédiaire", "Avancé", "Compétiteur"]
  const handleSubmit = async (e) => { e.preventDefault(); setSaving(true); await supabase.from('profils').update(formData).eq('id', profile.id); document.documentElement.style.setProperty('--color-primary', formData.couleur_principale); onUpdate(); setSaving(false) }
  const AvatarIcon = ICONS_MAP[formData.avatar] || Dumbbell
  return (
    <div style={{ animation: 'fadeInUp 0.4s ease-out' }}>
      <h1 className="bebas title-main" style={{ margin: '0 0 25px 0' }}>MON PROFIL</h1>
      <div className="grid-responsive">
        <form onSubmit={handleSubmit} style={{ backgroundColor: DEFAULT_THEME.card, padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#222', border: '2px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: shadow(primaryColor, 0.4) }}><AvatarIcon size={30} color="var(--color-primary)" /></div>
            <div style={{ flex: 1 }}><input className="input-field" style={{ marginBottom: 0, fontSize: '18px', fontWeight: 'bold' }} placeholder="Pseudo" value={formData.pseudo || ''} onChange={e => setFormData({ ...formData, pseudo: e.target.value })} required /></div>
          </div>
          <label style={{ display: 'block', margin: '15px 0 10px', fontSize: '13px', color: DEFAULT_THEME.textMuted }}>Avatar</label>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px' }}>
            {Object.keys(ICONS_MAP).map(key => { const Icon = ICONS_MAP[key]; const sel = formData.avatar === key; return <div key={key} onClick={() => setFormData({ ...formData, avatar: key })} style={{ padding: '8px', borderRadius: '8px', backgroundColor: sel ? 'var(--color-primary)' : '#333', cursor: 'pointer', transition: '0.2s', minWidth: '40px', display: 'flex', justifyContent: 'center' }}><Icon size={20} color={sel ? '#fff' : '#aaa'} /></div> })}
          </div>
          <label style={{ display: 'block', margin: '15px 0 10px', fontSize: '13px', color: DEFAULT_THEME.textMuted }}>Couleur Principale</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            {COLORS_MAP.map(c => <div key={c} onClick={() => setFormData({ ...formData, couleur_principale: c })} style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: c, border: formData.couleur_principale === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', transform: formData.couleur_principale === c ? 'scale(1.15)' : 'scale(1)', transition: '0.2s', boxShadow: formData.couleur_principale === c ? shadow(c, 0.6) : 'none' }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
            <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: DEFAULT_THEME.textMuted }}>Sport Principal</label><select className="input-field" style={{ padding: '10px' }} value={formData.sport_principal || ''} onChange={e => setFormData({ ...formData, sport_principal: e.target.value })}><option value="">-</option>{sports.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: DEFAULT_THEME.textMuted }}>Niveau</label><select className="input-field" style={{ padding: '10px' }} value={formData.niveau || ''} onChange={e => setFormData({ ...formData, niveau: e.target.value })}><option value="">-</option>{niveaux.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: DEFAULT_THEME.textMuted }}>Âge</label><input type="number" className="input-field" style={{ padding: '10px' }} value={formData.age || ''} onChange={e => setFormData({ ...formData, age: e.target.value })} /></div>
            <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: DEFAULT_THEME.textMuted }}>Poids (kg)</label><input type="number" className="input-field" style={{ padding: '10px' }} value={formData.poids || ''} onChange={e => setFormData({ ...formData, poids: e.target.value })} /></div>
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '15px' }} disabled={saving}>{saving ? '...' : 'Sauvegarder'}</button>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ backgroundColor: DEFAULT_THEME.card, padding: '20px', borderRadius: '12px' }}><h3 className="bebas" style={{ margin: '0 0 15px 0', fontSize: '20px' }}>MES BADGES</h3><div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>{badges.length === 0 ? <p style={{ color: DEFAULT_THEME.textMuted, fontSize: '13px', margin: 0 }}>Aucun badge.</p> : badges.map(b => <div key={b} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', backgroundColor: '#333', padding: '10px', borderRadius: '10px', width: '70px', boxShadow: shadow(primaryColor, 0.2) }}><Medal size={24} color="var(--color-primary)" /><span style={{ fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>{b}</span></div>)}</div></div>
          <div style={{ backgroundColor: DEFAULT_THEME.card, padding: '20px', borderRadius: '12px' }}><h3 className="bebas" style={{ margin: '0 0 15px 0', fontSize: '20px' }}>STATS EXPRESS</h3><div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333', fontSize: '14px' }}><span>Séances</span><strong>{seances.length}</strong></div><div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333', fontSize: '14px' }}><span>Minutes</span><strong>{seances.reduce((acc, s) => acc + s.duree_minutes, 0)}</strong></div><div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px' }}><span>Streak max (est.)</span><strong>{badges.includes("Régularité") ? "7 jrs" : "1 jr"}</strong></div></div>

          <div style={{ backgroundColor: DEFAULT_THEME.card, padding: '20px', borderRadius: '12px', border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 className="bebas" style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Bell size={20} color="var(--color-primary)" /> RAPPELS</h3>
              <div
                onClick={async () => {
                  const val = !remindersEnabled
                  if (val) {
                    const granted = await requestNotificationPermission()
                    if (!granted) return
                  }
                  setRemindersEnabled(val)
                  localStorage.setItem('athletik_reminders', val)
                }}
                style={{ width: '40px', height: '22px', backgroundColor: remindersEnabled ? 'var(--color-primary)' : '#333', borderRadius: '11px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
              >
                <div style={{ width: '16px', height: '16px', backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: remindersEnabled ? '21px' : '3px', transition: '0.3s shadow, 0.3s left' }} />
              </div>
            </div>
            {remindersEnabled && (
              <div style={{ animation: 'fadeInUp 0.3s' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: DEFAULT_THEME.textMuted }}>Heure de rappel</label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={e => { setReminderTime(e.target.value); localStorage.setItem('athletik_reminder_time', e.target.value) }}
                  className="input-field"
                  style={{ padding: '8px', marginBottom: '15px' }}
                />
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: DEFAULT_THEME.textMuted }}>Jours sélectionnés</label>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
                  {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => {
                    const sel = reminderDays.includes(i)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          const newDays = sel ? reminderDays.filter(day => day !== i) : [...reminderDays, i]
                          setReminderDays(newDays)
                          localStorage.setItem('athletik_reminder_days', JSON.stringify(newDays))
                        }}
                        style={{ flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', backgroundColor: sel ? 'var(--color-primary)' : '#333', color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (Notification.permission === 'granted') {
                      new Notification('Athlétik 💪', { body: 'C\'est l\'heure de t\'entraîner !', icon: '/icon.svg', badge: '/icon.svg' })
                    } else {
                      alert('Veuillez autoriser les notifications dans votre navigateur.')
                    }
                  }}
                  style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: '#fff', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}
                >
                  <Zap size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Tester la notification
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          width: '100%',
          padding: '14px',
          marginTop: '32px',
          background: 'transparent',
          border: '1px solid #e63946',
          borderRadius: '12px',
          color: '#e63946',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <LogOut size={18} />
        Se déconnecter
      </button>
    </div>
  )
}

function Stats({ seances }) {
  if (seances.length === 0) return <div style={{ textAlign: 'center', marginTop: '50px', color: '#aaa' }}>Pas assez de données pour les statistiques.</div>
  const sportsCount = {}; seances.forEach(s => { sportsCount[s.sport] = (sportsCount[s.sport] || 0) + 1 }); const maxSportCount = Math.max(...Object.values(sportsCount))
  return (
    <div style={{ animation: 'slideInRight 0.4s ease-out' }}>
      <h1 className="bebas title-main" style={{ margin: '0 0 25px 0' }}>STATISTIQUES</h1>
      <div className="grid-responsive">
        <div style={{ backgroundColor: DEFAULT_THEME.card, padding: '20px', borderRadius: '12px' }}>
          <h3 className="bebas" style={{ margin: '0 0 20px 0', fontSize: '20px' }}>SPORTS</h3>
          {Object.entries(sportsCount).map(([sport, count]) => {
            const percent = (count / maxSportCount) * 100
            return (
              <div key={sport} style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}><span>{sport}</span><span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{count}</span></div>
                <div className="stat-bar-container"><div className="stat-bar-fill" style={{ width: `${percent}%` }} /></div>
              </div>
            )
          })}
        </div>
        <div style={{ backgroundColor: DEFAULT_THEME.card, padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 className="bebas" style={{ margin: '0 0 5px 0', fontSize: '20px' }}>RECORDS</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ padding: '10px', background: '#3a86ff22', borderRadius: '10px', color: '#3a86ff' }}><Target size={24} /></div><div><div style={{ fontSize: '12px', color: '#999' }}>Plus longue séance</div><div style={{ fontSize: '18px', fontWeight: 'bold' }}>{Math.max(...seances.map(s => s.duree_minutes))} min</div></div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ padding: '10px', background: '#ff6b3522', borderRadius: '10px', color: '#ff6b35' }}><Zap size={24} /></div><div><div style={{ fontSize: '12px', color: '#999' }}>Calories estimées</div><div style={{ fontSize: '18px', fontWeight: 'bold' }}>{~~(seances.reduce((acc, s) => acc + s.duree_minutes, 0) * 12)} kcal</div></div></div>
        </div>
      </div>
    </div>
  )
}

function ActiveSession({ seance, onFinish, primaryColor }) {
  const [exercices, setExercices] = useState([]); const [currentIndex, setCurrentIndex] = useState(0)
  useEffect(() => { supabase.from('exercices').select('*').eq('seance_id', seance.id).order('created_at').then(({ data }) => { if (data) setExercices(data) }) }, [seance.id])
  if (exercices.length === 0) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Chargement... <br /><button onClick={onFinish} className="btn-primary" style={{ marginTop: '20px' }}>Retour</button></div>
  const ex = exercices[currentIndex]; const isLast = currentIndex === exercices.length - 1
  return (
    <div style={{ animation: 'fadeIn 0.5s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}><h2 className="bebas" style={{ margin: 0, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-primary)', animation: 'pulseTimer 1s infinite' }} /> SÉANCE EN COURS</h2><span style={{ fontSize: '14px', fontWeight: 'bold', color: '#aaa' }}>{currentIndex + 1} / {exercices.length}</span></div>
      <div style={{ backgroundColor: DEFAULT_THEME.card, padding: '30px 20px', borderRadius: '16px', textAlign: 'center', boxShadow: shadow(primaryColor, 0.4), border: '2px solid var(--color-primary)' }}>
        <h1 className="bebas" style={{ fontSize: '36px', margin: '0 0 20px 0' }}>{ex.nom}</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {ex.series && <div style={{ fontSize: '16px' }}><strong>{ex.series}</strong> séries</div>}
          {ex.repetitions && <div style={{ fontSize: '16px' }}><strong>{ex.repetitions}</strong> reps</div>}
          {ex.poids_kg && <div style={{ fontSize: '16px' }}><strong>{ex.poids_kg}</strong> kg</div>}
          {ex.duree_secondes && <div style={{ fontSize: '16px' }}><strong>{ex.duree_secondes}</strong> sec</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        {currentIndex > 0 && <button onClick={() => setCurrentIndex(c => c - 1)} style={{ flex: 0.3, padding: '14px', background: '#333', border: 'none', color: '#fff', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Précédent</button>}
        <button onClick={() => isLast ? onFinish() : setCurrentIndex(c => c + 1)} style={{ flex: 1, padding: '14px', background: 'var(--color-primary)', border: 'none', color: '#fff', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: shadow(primaryColor, 0.4) }}>{isLast ? "Terminer !" : "Suivant"}</button>
      </div>
    </div>
  )
}

function Onboarding({ onClose, pseudo }) {
  const [step, setStep] = useState(1); const name = pseudo || 'Champion'
  const steps = [{ title: `Bienvenue, ${name}!`, text: "Ton nouveau hub pour traquer tes entraînements." }, { title: "Crée ta séance", text: "Ajoute des séances détaillées pour garder une trace." }, { title: "Le Chronomètre", text: "Utilise le Timer avec module audio context inédit." }, { title: "Ton Profil", text: "Personnalise couleurs et avatar dans l'espace Profile." }]
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: DEFAULT_THEME.card, padding: '25px', borderRadius: '16px', maxWidth: '350px', width: '100%', animation: 'slideUp 0.5s ease-out' }}>
        <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>{[1, 2, 3, 4].map(i => <div key={i} style={{ flex: 1, height: '4px', backgroundColor: i <= step ? 'var(--color-primary)' : '#333', borderRadius: '2px', transition: 'background-color 0.3s' }} />)}</div>
        <h2 style={{ fontSize: '20px', margin: '0 0 10px 0' }}>{steps[step - 1].title}</h2><p style={{ color: DEFAULT_THEME.textMuted, fontSize: '14px', lineHeight: '1.4', marginBottom: '25px' }}>{steps[step - 1].text}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          {step < 4 ? <><button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #333', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>Passer</button><button onClick={() => setStep(s => s + 1)} style={{ flex: 1, padding: '10px', background: 'var(--color-primary)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Suivant</button></> : <button onClick={onClose} style={{ width: '100%', padding: '12px', background: 'var(--color-primary)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>C'est parti !</button>}
        </div>
      </div>
    </div>
  )
}
