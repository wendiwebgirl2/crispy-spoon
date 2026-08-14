import { StrictMode } from 'react'
import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PortalApp from './portal.jsx'
import { api } from './api.js'

// Decide which surface to render from the signed-in account's role: client
// accounts get the client portal; everyone else (admin/editor) gets the studio
// dashboard. The auth cookie is already required by the server, so /api/me
// resolves as soon as we're past the login page.
function Root() {
  const [me, setMe] = React.useState(undefined); // undefined = still loading
  React.useEffect(() => { api.me().then(setMe).catch(() => setMe(null)); }, []);
  if (me === undefined) return null; // brief blank while resolving — avoids a flash of the wrong shell
  if (me && me.role === 'client') return <PortalApp me={me} />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
