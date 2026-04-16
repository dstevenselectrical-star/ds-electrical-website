(function(){
 var FORMSUBMIT = 'https://formsubmit.co/ajax/info@dselectricalinstallations.co.uk';
 var shown = false;
 var dismissed = sessionStorage.getItem('ep_dismissed');
 var subscribed = localStorage.getItem('ep_subscribed');

 if(dismissed || subscribed) return;

 function show(){
  if(shown) return;
  shown = true;

  var css = document.createElement('style');
  css.textContent = [
   '.ep-overlay{position:fixed;inset:0;z-index:9000;background:rgba(10,9,8,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1.5rem;animation:epFadeIn .3s ease}',
   '@keyframes epFadeIn{from{opacity:0}to{opacity:1}}',
   '.ep-card{background:#fff;border-radius:16px;max-width:440px;width:100%;padding:2.5rem;position:relative;box-shadow:0 24px 80px rgba(0,0,0,.2);animation:epSlideUp .35s ease}',
   '@keyframes epSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}',
   '.ep-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.3rem;color:#6b6560;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:.2s}',
   '.ep-close:hover{background:#f0ebe3;color:#1a1714}',
   '.ep-tag{font-size:.6rem;font-weight:700;letter-spacing:.25em;text-transform:uppercase;color:#b8944f;margin-bottom:.75rem}',
   '.ep-card h2{font-size:1.5rem;font-weight:900;color:#1a1714;line-height:1.15;margin-bottom:.5rem;letter-spacing:-.02em}',
   '.ep-card p{font-size:.9rem;color:#6b6560;line-height:1.6;margin-bottom:1.5rem}',
   '.ep-form{display:flex;flex-direction:column;gap:.6rem}',
   '.ep-input{border:1.5px solid #e2dbd0;border-radius:8px;padding:.7rem .9rem;font-family:Outfit,sans-serif;font-size:.9rem;color:#1a1714;outline:none;transition:.2s}',
   '.ep-input:focus{border-color:#d4a44a}',
   '.ep-btn{background:#d4a44a;color:#0a0908;border:none;border-radius:8px;padding:.85rem;font-family:Outfit,sans-serif;font-weight:800;font-size:.9rem;cursor:pointer;transition:.25s}',
   '.ep-btn:hover{background:#b8944f}',
   '.ep-small{font-size:.72rem;color:#6b6560;text-align:center;margin-top:.5rem}',
   '.ep-success{text-align:center;padding:1rem 0}',
   '.ep-success h3{font-size:1.3rem;font-weight:900;color:#1a1714;margin-bottom:.5rem}',
   '.ep-success p{font-size:.9rem;color:#6b6560}'
  ].join('\n');
  document.head.appendChild(css);

  var overlay = document.createElement('div');
  overlay.className = 'ep-overlay';

  var card = document.createElement('div');
  card.className = 'ep-card';

  var closeBtn = document.createElement('button');
  closeBtn.className = 'ep-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.onclick = dismiss;
  card.appendChild(closeBtn);

  var tag = document.createElement('div');
  tag.className = 'ep-tag';
  tag.textContent = 'Free Guide';
  card.appendChild(tag);

  var h2 = document.createElement('h2');
  h2.textContent = 'Is Your Wiring Safe?';
  card.appendChild(h2);

  var p = document.createElement('p');
  p.textContent = 'Get our free guide: "10 Signs Your House Needs Rewiring" \u2014 written by NAPIT approved electricians. Covers warning signs, typical costs, and what to expect.';
  card.appendChild(p);

  var form = document.createElement('div');
  form.className = 'ep-form';
  form.id = 'epForm';

  var nameInput = document.createElement('input');
  nameInput.className = 'ep-input';
  nameInput.placeholder = 'Your name';
  nameInput.id = 'epName';
  form.appendChild(nameInput);

  var emailInput = document.createElement('input');
  emailInput.className = 'ep-input';
  emailInput.type = 'email';
  emailInput.placeholder = 'Your email';
  emailInput.id = 'epEmail';
  form.appendChild(emailInput);

  var btn = document.createElement('button');
  btn.className = 'ep-btn';
  btn.textContent = 'Send Me the Free Guide';
  btn.onclick = submit;
  form.appendChild(btn);

  var small = document.createElement('div');
  small.className = 'ep-small';
  small.textContent = 'No spam. Unsubscribe any time. We just send useful electrical advice.';
  form.appendChild(small);

  card.appendChild(form);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  overlay.onclick = function(e){
   if(e.target === overlay) dismiss();
  };
 }

 function dismiss(){
  var overlay = document.querySelector('.ep-overlay');
  if(overlay) overlay.remove();
  sessionStorage.setItem('ep_dismissed','1');
 }

 function submit(){
  var name = document.getElementById('epName').value.trim();
  var email = document.getElementById('epEmail').value.trim();
  if(!name || !email || email.indexOf('@') === -1) return;

  var data = new FormData();
  data.append('name', name);
  data.append('email', email);
  data.append('source', 'Email popup - rewiring guide');
  data.append('page', location.pathname);
  data.append('_subject', 'Guide Download: ' + name + ' \u2014 ' + email);
  data.append('_template', 'table');
  data.append('_captcha', 'false');

  fetch(FORMSUBMIT, {
   method:'POST',
   body:data,
   headers:{'Accept':'application/json'}
  }).catch(function(){});

  localStorage.setItem('ep_subscribed','1');

  var form = document.getElementById('epForm');
  while(form.firstChild) form.removeChild(form.firstChild);

  var success = document.createElement('div');
  success.className = 'ep-success';

  var h3 = document.createElement('h3');
  h3.textContent = 'Guide on its way!';
  success.appendChild(h3);

  var p = document.createElement('p');
  p.textContent = 'Check your inbox. If you have any questions, call Dan on 07889 334849.';
  success.appendChild(p);

  form.appendChild(success);
 }

 // Trigger after 30 seconds
 setTimeout(function(){
  if(!shown && !dismissed && !subscribed) show();
 }, 30000);

 // Or on scroll to 70% of page
 var scrollTriggered = false;
 window.addEventListener('scroll', function(){
  if(scrollTriggered || shown) return;
  var scrollPct = (window.scrollY + window.innerHeight) / document.body.scrollHeight;
  if(scrollPct > 0.7){
   scrollTriggered = true;
   show();
  }
 });
})();
