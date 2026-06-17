import React from 'react';

// Sprite SVG injecté une seule fois dans le DOM (dans App.jsx au montage),
// contient tous les symboles d'icônes utilisés par l'application.
// Repris du même système que les maquettes HTML statiques, pour garder
// une cohérence visuelle exacte et zéro dépendance externe (pas de CDN).
const spriteMarkup = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
<defs>

<symbol id="ic-layout-dashboard" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="9" rx="1"/><rect x="13" y="4" width="7" height="5" rx="1"/><rect x="13" y="11" width="7" height="9" rx="1"/><rect x="4" y="15" width="7" height="5" rx="1"/></symbol>

<symbol id="ic-plus" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></symbol>

<symbol id="ic-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="20" y2="20"/></symbol>

<symbol id="ic-file-text" viewBox="0 0 24 24"><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v4h4"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></symbol>

<symbol id="ic-folder" viewBox="0 0 24 24"><path d="M4 6a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/></symbol>

<symbol id="ic-building" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="1"/><line x1="9" y1="7" x2="9" y2="7.01"/><line x1="15" y1="7" x2="15" y2="7.01"/><line x1="9" y1="11" x2="9" y2="11.01"/><line x1="15" y1="11" x2="15" y2="11.01"/><line x1="9" y1="15" x2="9" y2="15.01"/><line x1="15" y1="15" x2="15" y2="15.01"/><path d="M9 21v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></symbol>

<symbol id="ic-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V19a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.6V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.6 1H20a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1z"/></symbol>

<symbol id="ic-bell" viewBox="0 0 24 24"><path d="M9 17v1a3 3 0 0 0 6 0v-1"/><path d="M6 9a6 6 0 1 1 12 0c0 3 1 4.5 1.5 5.5a1 1 0 0 1-.9 1.5H5.4a1 1 0 0 1-.9-1.5C5 13.5 6 12 6 9z"/></symbol>

<symbol id="ic-bell-ringing" viewBox="0 0 24 24"><path d="M9 17v1a3 3 0 0 0 6 0v-1"/><path d="M6 9a6 6 0 1 1 12 0c0 3 1 4.5 1.5 5.5a1 1 0 0 1-.9 1.5H5.4a1 1 0 0 1-.9-1.5C5 13.5 6 12 6 9z"/><path d="M4 4l1.5 1.5M20 4l-1.5 1.5"/></symbol>

<symbol id="ic-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></symbol>

<symbol id="ic-alert-triangle" viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="12" y1="17" x2="12" y2="17.01"/></symbol>

<symbol id="ic-circle-check" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 16 9.5"/></symbol>

<symbol id="ic-package" viewBox="0 0 24 24"><path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v9l9 5 9-5V8"/><line x1="12" y1="13" x2="12" y2="22"/></symbol>

<symbol id="ic-receipt" viewBox="0 0 24 24"><path d="M6 3h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/></symbol>

<symbol id="ic-arrow-left" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="11 6 5 12 11 18"/></symbol>

<symbol id="ic-upload" viewBox="0 0 24 24"><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/><polyline points="7 9 12 4 17 9"/><line x1="12" y1="4" x2="12" y2="16"/></symbol>

<symbol id="ic-edit" viewBox="0 0 24 24"><path d="M11 4h-5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8l-8.4 8.4-4 1 1-4z"/></symbol>

<symbol id="ic-camera" viewBox="0 0 24 24"><path d="M4 8a1 1 0 0 1 1-1h2l1.2-2h7.6L17 7h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><circle cx="12" cy="13" r="3.5"/></symbol>

<symbol id="ic-check" viewBox="0 0 24 24"><polyline points="5 12 10 17 19 7"/></symbol>

<symbol id="ic-x" viewBox="0 0 24 24"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></symbol>

<symbol id="ic-calendar-check" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="1"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="8" y1="3" x2="8" y2="6"/><line x1="16" y1="3" x2="16" y2="6"/><polyline points="9 15 11 17 15 13"/></symbol>

<symbol id="ic-calendar" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="1"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="8" y1="3" x2="8" y2="6"/><line x1="16" y1="3" x2="16" y2="6"/></symbol>

<symbol id="ic-device-laptop" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="11" rx="1"/><line x1="2" y1="19" x2="22" y2="19"/></symbol>

<symbol id="ic-device-mobile" viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></symbol>

<symbol id="ic-wash-machine" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="6" y1="6" x2="9" y2="6"/><circle cx="12" cy="14" r="5"/><path d="M9.5 14a2.5 2.5 0 0 1 5 0"/></symbol>

<symbol id="ic-iron-3" viewBox="0 0 24 24"><path d="M5 18c0-5 3-9 8-9 4 0 7 2.5 7 5.5 0 2-1.5 3.5-3.5 3.5z"/><line x1="5" y1="18" x2="20" y2="18"/><circle cx="9" cy="9" r="1.3"/></symbol>

<symbol id="ic-droplet" viewBox="0 0 24 24"><path d="M12 3c4 5 7 8.5 7 12a7 7 0 1 1-14 0c0-3.5 3-7 7-12z"/></symbol>

<symbol id="ic-scooter-electric" viewBox="0 0 24 24"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M6 18h6l5-10h3"/><path d="M9 8h4"/></symbol>

<symbol id="ic-bolt" viewBox="0 0 24 24"><polygon points="13 2 4 14 11 14 10 22 20 9 13 9"/></symbol>

<symbol id="ic-wifi" viewBox="0 0 24 24"><path d="M3 9a14 14 0 0 1 18 0"/><path d="M6.5 12.5a9 9 0 0 1 11 0"/><path d="M10 16a4 4 0 0 1 4 0"/><line x1="12" y1="19" x2="12" y2="19.01"/></symbol>

<symbol id="ic-home" viewBox="0 0 24 24"><path d="M4 11l8-7 8 7"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/><line x1="10" y1="20" x2="10" y2="14"/><line x1="14" y1="20" x2="14" y2="14"/></symbol>

<symbol id="ic-car" viewBox="0 0 24 24"><path d="M4 16l1.5-5a2 2 0 0 1 2-1.5h9a2 2 0 0 1 2 1.5L20 16"/><rect x="3" y="16" width="18" height="3" rx="1"/><circle cx="7.5" cy="19.5" r="1.3"/><circle cx="16.5" cy="19.5" r="1.3"/></symbol>

<symbol id="ic-school" viewBox="0 0 24 24"><polygon points="12 4 22 9 12 14 2 9 12 4"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></symbol>

<symbol id="ic-cash" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.5"/><line x1="6.5" y1="9" x2="6.5" y2="9.01"/><line x1="17.5" y1="15" x2="17.5" y2="15.01"/></symbol>

<symbol id="ic-id" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><circle cx="9" cy="11" r="2"/><path d="M6 16c0-1.5 1.3-2.5 3-2.5s3 1 3 2.5"/><line x1="15" y1="9" x2="18" y2="9"/><line x1="15" y1="13" x2="18" y2="13"/></symbol>

<symbol id="ic-id-badge-2" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><circle cx="12" cy="11" r="2.3"/><path d="M8.5 17c0-1.5 1.5-2.5 3.5-2.5s3.5 1 3.5 2.5"/></symbol>

<symbol id="ic-shield-check" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><polyline points="9 12 11 14 15 9.5"/></symbol>

<symbol id="ic-shield-half" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><line x1="12" y1="3" x2="12" y2="21"/></symbol>

<symbol id="ic-paperclip" viewBox="0 0 24 24"><path d="M19 12l-7.5 7.5a4 4 0 0 1-5.5-5.5L14 6a2.7 2.7 0 0 1 3.8 3.8L10.5 17"/></symbol>

<symbol id="ic-book" viewBox="0 0 24 24"><path d="M5 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H5z"/><path d="M19 4h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h6z"/></symbol>

<symbol id="ic-photo" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-3 3-2-2-7 6"/></symbol>

<symbol id="ic-pdf" viewBox="0 0 24 24"><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v4h4"/><text x="6.3" y="16.5" font-size="6.5" stroke="none" fill="currentColor" font-family="Arial">PDF</text></symbol>

<symbol id="ic-chevron-down" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></symbol>

<symbol id="ic-chevron-left" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></symbol>

<symbol id="ic-chevron-up" viewBox="0 0 24 24"><polyline points="6 15 12 9 18 15"/></symbol>

<symbol id="ic-dots" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></symbol>

<symbol id="ic-download" viewBox="0 0 24 24"><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/><polyline points="7 11 12 16 17 11"/><line x1="12" y1="4" x2="12" y2="16"/></symbol>

<symbol id="ic-eye" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></symbol>

<symbol id="ic-file-export" viewBox="0 0 24 24"><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v4h4"/><polyline points="9.5 15 12 17.5 14.5 15"/><line x1="12" y1="11" x2="12" y2="17.5"/></symbol>

<symbol id="ic-file-spreadsheet" viewBox="0 0 24 24"><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v4h4"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="11" y1="11" x2="11" y2="19"/></symbol>

<symbol id="ic-file-type-pdf" viewBox="0 0 24 24"><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v4h4"/></symbol>

<symbol id="ic-hand-finger" viewBox="0 0 24 24"><path d="M9 12V5a1.5 1.5 0 0 1 3 0v6"/><path d="M12 11V4a1.5 1.5 0 0 1 3 0v7"/><path d="M15 11.5V6a1.5 1.5 0 0 1 3 0v8"/><path d="M6 13l1-2a1.5 1.5 0 0 1 2.8 1l-.3 1"/><path d="M6 13c0 4 2.5 7 7 7s6-3 6-6v-3"/></symbol>

<symbol id="ic-heart-handshake" viewBox="0 0 24 24"><path d="M12 8s-2-3-5-3-5 2.2-5 5c0 4 5 7.5 10 11 5-3.5 10-7 10-11 0-2.8-2-5-5-5s-5 3-5 3"/></symbol>

<symbol id="ic-info-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12" y2="8.01"/></symbol>

<symbol id="ic-list" viewBox="0 0 24 24"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><line x1="5" y1="6" x2="5" y2="6.01"/><line x1="5" y1="12" x2="5" y2="12.01"/><line x1="5" y1="18" x2="5" y2="18.01"/></symbol>

<symbol id="ic-list-search" viewBox="0 0 24 24"><line x1="4" y1="6" x2="14" y2="6"/><line x1="4" y1="12" x2="12" y2="12"/><line x1="4" y1="18" x2="10" y2="18"/><circle cx="16.5" cy="16.5" r="3"/><line x1="19" y1="19" x2="21" y2="21"/></symbol>

<symbol id="ic-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></symbol>

<symbol id="ic-logout" viewBox="0 0 24 24"><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><polyline points="14 8 18 12 14 16"/><line x1="18" y1="12" x2="9" y2="12"/></symbol>

<symbol id="ic-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="1.5"/><polyline points="3 6.5 12 13 21 6.5"/></symbol>

<symbol id="ic-menu-2" viewBox="0 0 24 24"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></symbol>

<symbol id="ic-mood-smile" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/></symbol>

<symbol id="ic-rocket" viewBox="0 0 24 24"><path d="M12 2c3 1 5 4 5 8 0 3-1.5 6-5 9-3.5-3-5-6-5-9 0-4 2-7 5-8z"/><circle cx="12" cy="9" r="1.6"/><path d="M9 16l-3 4 1-4.5"/><path d="M15 16l3 4-1-4.5"/></symbol>

<symbol id="ic-scale" viewBox="0 0 24 24"><line x1="12" y1="3" x2="12" y2="21"/><line x1="6" y1="21" x2="18" y2="21"/><path d="M4 7l4-1 4 1-4 8-4-8z"/><path d="M16 7l-4-1 4 8 4-8-4 1z"/></symbol>

<symbol id="ic-scan" viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><line x1="4" y1="12" x2="20" y2="12"/></symbol>

<symbol id="ic-sparkles" viewBox="0 0 24 24"><path d="M12 3l1.3 4 4 1.3-4 1.3-1.3 4-1.3-4-4-1.3 4-1.3z"/><path d="M19 14l.6 2 2 .6-2 .6-.6 2-.6-2-2-.6 2-.6z"/></symbol>

<symbol id="ic-star-filled" viewBox="0 0 24 24"><polygon points="12 3 14.6 9 21 9.5 16 13.8 17.6 20 12 16.6 6.4 20 8 13.8 3 9.5 9.4 9" stroke="none" fill="currentColor"/></symbol>

<symbol id="ic-tag" viewBox="0 0 24 24"><path d="M11 3h-5a2 2 0 0 0-2 2v5l9 9 7-7-9-9z"/><line x1="7.5" y1="7.5" x2="7.5" y2="7.51"/></symbol>

<symbol id="ic-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></symbol>

<symbol id="ic-user-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="2.5"/><path d="M7 18c0-2.5 2-4 5-4s5 1.5 5 4"/></symbol>

<symbol id="ic-category" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></symbol>

<symbol id="ic-building-store" viewBox="0 0 24 24"><path d="M4 8l1-4h14l1 4"/><path d="M4 8h16v3a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1-2 2 2 2 0 0 1-2-2z"/><path d="M6 13v7h12v-7"/></symbol>

<symbol id="ic-cloud" viewBox="0 0 24 24"><path d="M7 17a4 4 0 0 1-1-7.9A5 5 0 0 1 16 8a4.5 4.5 0 0 1 1 9z"/></symbol>

<symbol id="ic-credit-card" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="15" x2="10" y2="15"/></symbol>

<symbol id="ic-receipt-2" viewBox="0 0 24 24"><path d="M6 3h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z"/><line x1="9" y1="7" x2="15" y2="7"/></symbol>

<symbol id="ic-receipt-off" viewBox="0 0 24 24"><path d="M6 3h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" opacity="0.35"/><line x1="4" y1="4" x2="20" y2="20"/></symbol>

<symbol id="ic-brand-google" viewBox="0 0 24 24"><path d="M21 12.2c0-.7-.1-1.4-.2-2H12v4h5c-.2 1.2-.9 2.2-2 2.9v2.4h3.4A9.9 9.9 0 0 0 21 12.2z" stroke="none" fill="currentColor"/><path d="M12 21c2.4 0 4.5-.8 6.4-2.5l-3.4-2.4c-.9.6-2 .9-3 .9-2.3 0-4.3-1.6-5-3.7H4.4v2.5A9.9 9.9 0 0 0 12 21z" stroke="none" fill="currentColor"/><path d="M7 13.3a5.7 5.7 0 0 1 0-3.6V7.2H4.4a9.9 9.9 0 0 0 0 9.1z" stroke="none" fill="currentColor"/><path d="M12 6.4c1.3 0 2.5.5 3.4 1.3l3-3A9.7 9.7 0 0 0 12 2.5 9.9 9.9 0 0 0 4.4 7.2L7 9.7c.7-2 2.7-3.6 5-3.6z" stroke="none" fill="currentColor"/></symbol>

<symbol id="ic-brand-google-drive" viewBox="0 0 24 24"><path d="M8 3h8l6 10-4 7H6l-4-7z"/><line x1="8" y1="3" x2="16" y2="17"/><line x1="3.5" y1="13.5" x2="20.5" y2="13.5"/></symbol>

<symbol id="ic-brand-dropbox" viewBox="0 0 24 24"><polygon points="12 3 6 7 12 11 6 15 12 19 18 15 12 11 18 7" /></symbol>

</defs>
</svg>
`;

export default function IconSprite() {
  return <div dangerouslySetInnerHTML={{ __html: spriteMarkup }} />;
}
