// Dev-only entry: run `npm run dev` and open /navigation-preview.html
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import NavigationFlow from '../features/navigation/NavigationFlow.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NavigationFlow onBackToMap={() => window.alert('Back to dashboard map')} onNavSelect={(id) => console.log('nav', id)} />
  </StrictMode>,
);
