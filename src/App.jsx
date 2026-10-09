import { useEffect } from 'react'
import { NavLink, Link, Route, Routes, useLocation } from 'react-router-dom'
import Gallery from './pages/Gallery'
import Submit from './pages/Submit'
import Staff from './pages/Staff'
import QrSign from './pages/QrSign'
import { isDemo } from './data/store'
import { EventsProvider } from './events'

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <EventsProvider>
      <div className="prototype-banner">
        Student prototype for the Historic South-View Preservation Foundation · LMC 3403 · Not the official site
      </div>
      <header className="site-header">
        <Link to="/" className="wordmark">
          <span className="wordmark-top">Historic</span>
          <span className="wordmark-main">South-View</span>
          <span className="wordmark-sub">Community Gallery</span>
        </Link>
        <nav>
          <NavLink to="/" end>Gallery</NavLink>
          <NavLink to="/qr">QR Sign</NavLink>
          <NavLink to="/staff">Staff</NavLink>
        </nav>
        <Link to="/submit" className="button">Share a Photo</Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Gallery />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/qr" element={<QrSign />} />
          <Route path="*" element={<Gallery />} />
        </Routes>
      </main>
      <footer className="site-footer">
        {isDemo
          ? 'Sample photos are from southviewpreservation.com, used for a class prototype. New submissions are stored only in this browser.'
          : 'Photos are shared by visitors and reviewed by South-View staff before they appear here.'}
      </footer>
    </EventsProvider>
  )
}
