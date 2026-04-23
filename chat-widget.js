(function(){
 var PHONE = '07889 334849';
 var FORMSUBMIT = 'https://formsubmit.co/ajax/info@dselectricalinstallations.co.uk';
 // Set after first `wrangler deploy`. Until then, AI fallback stays inactive and widget runs FAQ-only.
 var CHAT_WORKER_URL = '';
 var aiHistory = []; // conversation history sent to worker

 var FAQ = [
  {keys:['price','cost','how much','quote','estimate','rewire cost','rewire price'],
   answer:'We provide free, fixed-price quotes with no obligation. A typical 3-bed rewire starts from around \u00a33,500. Consumer unit upgrades from \u00a3650. EV chargers from \u00a3850 installed. Want a quote for your specific job?',
   followUp:'quote'},
  {keys:['eicr','electrical test','landlord','rental','inspection','condition report','testing'],
   answer:'EICRs start from \u00a3150 for a small property. Landlords need one every 5 years by law. We can usually book within a week and issue the report within 5 working days.',
   followUp:'quote'},
  {keys:['ev charger','ev','electric car','charger','charging','hypervolt','zappi','ohme','easee'],
   answer:'We install Hypervolt 3, Fastamps, Easee, Ohme, Zappi and Andersen. Prices from \u00a3850 fully installed including the dedicated circuit. We handle the DNO notification and all paperwork.',
   followUp:'quote'},
  {keys:['cctv','camera','security','hikvision','intruder','alarm','access control'],
   answer:'We install Hikvision 4K AcuSense CCTV systems and AX PRO wireless intruder alarms. A 4-camera domestic system starts from around \u00a31,200 installed. Remote viewing via Hik-Connect app included.',
   followUp:'quote'},
  {keys:['fire alarm','emergency lighting','bs 5839','bs 5266','smoke detector'],
   answer:'We design, install and maintain fire alarm systems to BS 5839 and emergency lighting to BS 5266. We also provide annual testing contracts for commercial premises.',
   followUp:'quote'},
  {keys:['area','cover','wells','bath','shepton','frome','glastonbury','somerset','midsomer','where'],
   answer:'We\u2019re based in Glastonbury and cover all of Mid Somerset \u2014 Wells, Shepton Mallet, Bath, Frome, Midsomer Norton, Street, Bruton, Castle Cary, Radstock and Wedmore.'},
  {keys:['commercial','three phase','3 phase','industrial','warehouse','office','fit out','data'],
   answer:'We handle full commercial electrical \u2014 three-phase installations, distribution boards, warehouse lighting, control panels, data cabling, office fit-outs. CHAS accredited.',
   followUp:'quote'},
  {keys:['rewire','consumer unit','fuse board','fuse box','wiring','sockets','circuits'],
   answer:'Full and partial rewires, consumer unit upgrades with RCBOs, additional sockets and circuits. All work BS 7671 certified and NAPIT notified. We leave the site clean.',
   followUp:'quote'},
  {keys:['emergency','urgent','callout','power out','no power','trip','tripping'],
   answer:'For emergencies, call Dan directly on '+PHONE+'. We aim to respond within 2 hours across Mid Somerset.'},
  {keys:['accredit','napit','chas','trustmark','qualified','insured','insurance','certified'],
   answer:'NAPIT approved, CHAS accredited, TrustMark endorsed, \u00a32M public liability insurance. All work BS 7671 certified with NAPIT Part P notification.'},
  {keys:['book','appointment','available','when','schedule','diary','slot'],
   answer:'We usually have availability within 1\u20132 weeks for standard work. Emergency callouts within 2 hours. Leave your details and Dan will call you back.',
   followUp:'quote'},
  {keys:['solar','battery','storage','panels','pv','givenergy','tesla','powerwall','mcs'],
   answer:'We don\u2019t do solar panels or battery storage — but we do handle everything electrical around them: EV chargers, consumer unit upgrades, EICR testing, full and partial rewires. Happy to quote for any of those?',
   followUp:'quote'},
  {keys:['payment','pay','deposit','invoice','bank transfer'],
   answer:'Payment by bank transfer within 30 days of invoice. For larger projects we may ask for a 25\u201350% deposit. No day rates \u2014 always fixed-price quotes.'},
  {keys:['lighting','pendant','downlight','led','strip light','garden light','outdoor'],
   answer:'Residential and commercial lighting design \u2014 pendants, downlights, LED strip, track lighting, smart controls. Heritage and listed building specialists.',
   followUp:'quote'},
  {keys:['hello','hi','hey','morning','afternoon','evening','help'],
   answer:'Hello! I\u2019m the DS Electrical assistant. I can answer questions about our services, pricing, and coverage area. What can I help you with?'}
 ];

 var state = 'closed';
 var lead = {name:'',email:'',phone:'',page:location.pathname};
 var captureStep = 0;

 function el(tag, cls, text){
  var d = document.createElement(tag);
  if(cls) d.className = cls;
  if(text) d.textContent = text;
  return d;
 }

 function createWidget(){
  var css = document.createElement('style');
  css.textContent = [
   '.cw-toggle{position:fixed;bottom:5.5rem;right:1.25rem;z-index:97;width:56px;height:56px;border-radius:50%;background:#d4a44a;color:#0a0908;border:none;cursor:pointer;box-shadow:0 4px 24px rgba(212,164,74,.4);display:flex;align-items:center;justify-content:center;transition:.25s}',
   '.cw-toggle:hover{transform:scale(1.08)}',
   '.cw-toggle.open .cw-ico-chat{display:none}',
   '.cw-toggle:not(.open) .cw-ico-close{display:none}',
   '.cw-badge{position:absolute;top:-2px;right:-2px;width:18px;height:18px;background:#ef4444;border-radius:50%;border:2px solid #0a0908;display:none}',
   '.cw-toggle.has-badge .cw-badge{display:block}',
   '.cw-box{position:fixed;bottom:8.5rem;right:1.25rem;z-index:97;width:360px;max-height:520px;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;font-family:Outfit,sans-serif}',
   '.cw-box.open{display:flex}',
   '.cw-head{background:#0a0908;padding:1rem 1.2rem;display:flex;align-items:center;gap:.75rem}',
   '.cw-head-dot{width:10px;height:10px;background:#5a9e6f;border-radius:50%;flex-shrink:0}',
   '.cw-head-text{color:#fff;font-size:.85rem;font-weight:700}',
   '.cw-head-sub{color:rgba(240,232,218,.5);font-size:.7rem;font-weight:500}',
   '.cw-msgs{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.6rem;min-height:200px;max-height:340px}',
   '.cw-msg{max-width:85%;padding:.7rem 1rem;border-radius:12px;font-size:.88rem;line-height:1.5;animation:cwFade .25s ease}',
   '@keyframes cwFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
   '.cw-msg.bot{background:#f0ebe3;color:#1a1714;align-self:flex-start;border-bottom-left-radius:4px}',
   '.cw-msg.user{background:#d4a44a;color:#0a0908;align-self:flex-end;border-bottom-right-radius:4px;font-weight:600}',
   '.cw-input-wrap{border-top:1px solid #e2dbd0;padding:.6rem .8rem;display:flex;gap:.5rem;align-items:center}',
   '.cw-input{flex:1;border:1.5px solid #e2dbd0;border-radius:8px;padding:.6rem .8rem;font-family:Outfit,sans-serif;font-size:.88rem;outline:none;transition:.2s}',
   '.cw-input:focus{border-color:#d4a44a}',
   '.cw-send{width:36px;height:36px;border-radius:50%;background:#d4a44a;color:#0a0908;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
   '.cw-send:hover{background:#b8944f}',
   '.cw-quick{display:flex;flex-wrap:wrap;gap:.4rem;padding:0 1rem .8rem}',
   '.cw-qbtn{background:#f8f5f0;border:1px solid #e2dbd0;border-radius:100px;padding:.35rem .8rem;font-family:Outfit,sans-serif;font-size:.75rem;font-weight:600;color:#6b6560;cursor:pointer;transition:.2s}',
   '.cw-qbtn:hover{border-color:#d4a44a;color:#d4a44a;background:rgba(212,164,74,.06)}',
   '@media(max-width:768px){.cw-box{right:0;bottom:0;left:0;width:100%;max-height:100vh;border-radius:16px 16px 0 0}.cw-toggle{bottom:5rem;right:1rem}}'
  ].join('\n');
  document.head.appendChild(css);

  // Toggle button
  var toggle = el('button','cw-toggle has-badge');
  toggle.setAttribute('aria-label','Chat with us');
  var chatIcon = document.createElementNS('http://www.w3.org/2000/svg','svg');
  chatIcon.setAttribute('viewBox','0 0 24 24');
  chatIcon.setAttribute('fill','currentColor');
  chatIcon.setAttribute('width','26');
  chatIcon.setAttribute('height','26');
  chatIcon.classList.add('cw-ico-chat');
  var p1 = document.createElementNS('http://www.w3.org/2000/svg','path');
  p1.setAttribute('d','M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z');
  var p1b = document.createElementNS('http://www.w3.org/2000/svg','path');
  p1b.setAttribute('d','M7 9h10v2H7zm0-3h10v2H7z');
  chatIcon.appendChild(p1);
  chatIcon.appendChild(p1b);
  toggle.appendChild(chatIcon);

  var closeIcon = document.createElementNS('http://www.w3.org/2000/svg','svg');
  closeIcon.setAttribute('viewBox','0 0 24 24');
  closeIcon.setAttribute('fill','currentColor');
  closeIcon.setAttribute('width','26');
  closeIcon.setAttribute('height','26');
  closeIcon.classList.add('cw-ico-close');
  var p2 = document.createElementNS('http://www.w3.org/2000/svg','path');
  p2.setAttribute('d','M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
  closeIcon.appendChild(p2);
  toggle.appendChild(closeIcon);

  var badge = el('span','cw-badge');
  toggle.appendChild(badge);
  document.body.appendChild(toggle);

  // Chat box
  var box = el('div','cw-box');

  var head = el('div','cw-head');
  var dot = el('span','cw-head-dot');
  var headInfo = el('div');
  var headText = el('div','cw-head-text','DS Electrical');
  var headSub = el('div','cw-head-sub','Usually replies in minutes');
  headInfo.appendChild(headText);
  headInfo.appendChild(headSub);
  head.appendChild(dot);
  head.appendChild(headInfo);
  box.appendChild(head);

  var msgs = el('div','cw-msgs');
  msgs.id = 'cwMsgs';
  box.appendChild(msgs);

  var quick = el('div','cw-quick');
  quick.id = 'cwQuick';
  box.appendChild(quick);

  var inputWrap = el('div','cw-input-wrap');
  var input = document.createElement('input');
  input.className = 'cw-input';
  input.id = 'cwInput';
  input.placeholder = 'Type a message...';
  input.autocomplete = 'off';
  inputWrap.appendChild(input);

  var sendBtn = el('button','cw-send');
  sendBtn.id = 'cwSend';
  var sendIcon = document.createElementNS('http://www.w3.org/2000/svg','svg');
  sendIcon.setAttribute('viewBox','0 0 24 24');
  sendIcon.setAttribute('fill','currentColor');
  sendIcon.setAttribute('width','16');
  sendIcon.setAttribute('height','16');
  var p3 = document.createElementNS('http://www.w3.org/2000/svg','path');
  p3.setAttribute('d','M2.01 21L23 12 2.01 3 2 10l15 2-15 2z');
  sendIcon.appendChild(p3);
  sendBtn.appendChild(sendIcon);
  inputWrap.appendChild(sendBtn);
  box.appendChild(inputWrap);
  document.body.appendChild(box);

  // Events
  toggle.onclick = function(){
   if(state === 'closed'){
    state = 'greeting';
    toggle.classList.add('open');
    toggle.classList.remove('has-badge');
    box.classList.add('open');
    startGreeting();
   } else {
    state = 'closed';
    toggle.classList.remove('open');
    box.classList.remove('open');
   }
  };

  sendBtn.onclick = sendMessage;
  input.onkeydown = function(e){if(e.key==='Enter')sendMessage()};

  // Show badge after 20s to draw attention
  setTimeout(function(){
   if(state === 'closed') toggle.classList.add('has-badge');
  }, 20000);
 }

 function addMsg(text, from){
  var msgs = document.getElementById('cwMsgs');
  var div = el('div','cw-msg ' + from, text);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
 }

 function showQuickReplies(options){
  var wrap = document.getElementById('cwQuick');
  while(wrap.firstChild) wrap.removeChild(wrap.firstChild);
  options.forEach(function(opt){
   var btn = el('button','cw-qbtn',opt.label);
   btn.onclick = function(){
    addMsg(opt.label, 'user');
    while(wrap.firstChild) wrap.removeChild(wrap.firstChild);
    if(opt.action) opt.action();
    else if(opt.value) handleInput(opt.value);
   };
   wrap.appendChild(btn);
  });
 }

 function startGreeting(){
  addMsg("Hi there! I\u2019m the DS Electrical assistant. I can help with pricing, services, and booking.", 'bot');
  setTimeout(function(){
   addMsg("What can I help you with today?", 'bot');
   showQuickReplies([
    {label:'Get a quote', action:startCapture},
    {label:'Pricing info', value:'how much'},
    {label:'Services', value:'what services'},
    {label:'Coverage area', value:'area'},
    {label:'Emergency', value:'emergency'}
   ]);
  }, 600);
 }

 function startCapture(){
  state = 'capture';
  captureStep = 0;
  addMsg("I\u2019d love to help with a quote. Let me grab a few details so Dan can get back to you.", 'bot');
  setTimeout(function(){
   addMsg("What\u2019s your name?", 'bot');
   var inp = document.getElementById('cwInput');
   inp.placeholder = 'Your name...';
   inp.focus();
  }, 400);
 }

 function handleCapture(input){
  var inp = document.getElementById('cwInput');
  if(captureStep === 0){
   lead.name = input;
   captureStep = 1;
   addMsg("Nice to meet you, " + input + "! What\u2019s your email address?", 'bot');
   inp.placeholder = 'Your email...';
   inp.type = 'email';
  } else if(captureStep === 1){
   if(input.indexOf('@') === -1){
    addMsg("That doesn\u2019t look like an email. Could you try again?", 'bot');
    return;
   }
   lead.email = input;
   captureStep = 2;
   addMsg("And your phone number? (So Dan can call you back)", 'bot');
   inp.placeholder = 'Your phone number...';
   inp.type = 'tel';
  } else if(captureStep === 2){
   lead.phone = input;
   state = 'chat';
   inp.placeholder = 'Type a message...';
   inp.type = 'text';
   submitLead();
   addMsg("Thanks " + lead.name + "! Dan will be in touch within 24 hours.", 'bot');
   setTimeout(function(){
    addMsg("In the meantime, feel free to ask me anything about our services.", 'bot');
    showQuickReplies([
     {label:'Pricing', value:'cost'},
     {label:'EV chargers', value:'ev charger'},
     {label:'CCTV', value:'cctv'},
     {label:'Rewires', value:'rewire'}
    ]);
   }, 500);
  }
 }

 function submitLead(){
  var data = new FormData();
  data.append('name', lead.name);
  data.append('email', lead.email);
  data.append('phone', lead.phone);
  data.append('source', 'Chat widget');
  data.append('page', lead.page);
  data.append('_subject', 'Chat Lead: ' + lead.name + ' \u2014 ' + lead.phone);
  data.append('_template', 'table');
  data.append('_captcha', 'false');

  fetch(FORMSUBMIT, {
   method:'POST',
   body:data,
   headers:{'Accept':'application/json'}
  }).catch(function(){});
 }

 function findAnswer(input){
  var lower = input.toLowerCase();
  for(var i = 0; i < FAQ.length; i++){
   for(var j = 0; j < FAQ[i].keys.length; j++){
    if(lower.indexOf(FAQ[i].keys[j]) !== -1){
     return FAQ[i];
    }
   }
  }
  return null;
 }

 function handleInput(input){
  var match = findAnswer(input);
  if(match){
   setTimeout(function(){
    addMsg(match.answer, 'bot');
    aiHistory.push({role:'user', content:input});
    aiHistory.push({role:'assistant', content:match.answer});
    if(match.followUp === 'quote' && !lead.email){
     setTimeout(function(){
      addMsg("Want a quote? I just need a few details and Dan will call you back.", 'bot');
      showQuickReplies([
       {label:'Yes, get a quote', action:startCapture},
       {label:'Just browsing', value:'hello'}
      ]);
     }, 600);
    }
   }, 400);
   return;
  }
  // No FAQ match — try AI fallback if worker URL is configured, else static fallback
  if(CHAT_WORKER_URL){
   askAI(input);
  } else {
   setTimeout(function(){
    addMsg("I\u2019m not sure about that one. For anything specific, call Dan directly on " + PHONE + " or ask me about:", 'bot');
    showQuickReplies([
     {label:'Pricing', value:'cost'},
     {label:'Services', value:'what services'},
     {label:'Book a quote', action:startCapture},
     {label:'Coverage area', value:'area'}
    ]);
   }, 400);
  }
 }

 function askAI(input){
  aiHistory.push({role:'user', content:input});
  // Cap history to last 10 messages to keep the payload and token cost small
  var payload = aiHistory.slice(-10);

  var thinkingMsg = el('div', 'cw-msg bot', 'Thinking...');
  document.getElementById('cwMsgs').appendChild(thinkingMsg);

  fetch(CHAT_WORKER_URL, {
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({messages: payload})
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
   thinkingMsg.remove();
   if(data && data.reply){
    addMsg(data.reply, 'bot');
    aiHistory.push({role:'assistant', content:data.reply});
    if(!lead.email && /quote|price|cost|book/i.test(data.reply + ' ' + input)){
     setTimeout(function(){
      showQuickReplies([
       {label:'Get a quote', action:startCapture},
       {label:'Call now', action:function(){window.location.href='tel:07889334849'}}
      ]);
     }, 400);
    }
   } else {
    aiFailFallback();
   }
  })
  .catch(function(){
   thinkingMsg.remove();
   aiFailFallback();
  });
 }

 function aiFailFallback(){
  addMsg("Sorry, I\u2019m having trouble just now. Call Dan directly on " + PHONE + " or I can grab your details and he\u2019ll call back.", 'bot');
  showQuickReplies([
   {label:'Get a callback', action:startCapture},
   {label:'Call ' + PHONE, action:function(){window.location.href='tel:07889334849'}}
  ]);
 }

 function sendMessage(){
  var inp = document.getElementById('cwInput');
  var text = inp.value.trim();
  if(!text) return;
  addMsg(text, 'user');
  inp.value = '';
  var wrap = document.getElementById('cwQuick');
  while(wrap.firstChild) wrap.removeChild(wrap.firstChild);

  if(state === 'capture'){
   handleCapture(text);
  } else {
   var lower = text.toLowerCase();
   if(!lead.email && (lower.indexOf('quote') !== -1 || lower.indexOf('book') !== -1)){
    startCapture();
   } else {
    handleInput(text);
   }
  }
 }

 if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', createWidget);
 } else {
  createWidget();
 }
})();
