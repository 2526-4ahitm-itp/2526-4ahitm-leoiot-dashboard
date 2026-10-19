import './styles/tokens.css';
import './styles/dashboard.css';

// Grundgerüst: das Theme folgt dem System, bis die Ansichten mit Umschalter kommen.
const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.dataset.theme = dark ? 'dark' : 'light';
