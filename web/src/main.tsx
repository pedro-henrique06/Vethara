import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Fontes auto-hospedadas, empacotadas junto do site. Nao ha requisicao a CDN
// nenhuma em runtime: o jogador nao espera o Google responder para o titulo
// aparecer, e nada do que ele faz aqui vaza para terceiros.
//
// So os pesos e o subconjunto latino que usamos — importar o pacote inteiro
// traria cirilico e grego que ninguem le, e triplicaria o peso.
import '@fontsource/cinzel/latin-500.css'
import '@fontsource/cinzel/latin-600.css'
import '@fontsource/cinzel/latin-700.css'
import '@fontsource/eb-garamond/latin-400.css'
import '@fontsource/eb-garamond/latin-500.css'
import '@fontsource/eb-garamond/latin-400-italic.css'
import '@fontsource/unifrakturmaguntia/latin-400.css'

import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
