import { createRoot } from 'react-dom/client';
import Directory from './directory';
import './index.css';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<Directory />);
