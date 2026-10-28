import { createRoot } from 'react-dom/client';
import Page from '../../page.jsx';

window.__pageRoot = createRoot(document.getElementById('app'));
window.__pageRoot.render(<Page />);
