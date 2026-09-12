import React from 'react'
import ReactDOM from 'react-dom/client'
import OverviewApp from './overview-app'

const rootElement = document.getElementById('root')

if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <OverviewApp />
        </React.StrictMode>
    )
}
