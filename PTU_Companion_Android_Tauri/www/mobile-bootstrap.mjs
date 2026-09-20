import {installMobileApi} from './mobile-api.mjs';
await installMobileApi();
const script=document.createElement('script');
script.src='app.js';
script.onload=()=>document.documentElement.classList.add('ptu-android-ready');
script.onerror=()=>{document.body.innerHTML='<main style="padding:24px;font-family:sans-serif"><h1>PTU Companion</h1><p>Unable to start the Android player UI.</p></main>';};
document.body.appendChild(script);
