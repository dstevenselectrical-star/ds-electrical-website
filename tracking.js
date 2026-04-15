// DS Electrical — Tracking + Exit Intent Popup
// Include on every page: <script src="tracking.js"></script>

(function() {
  // ============================
  // EXIT INTENT POPUP
  // ============================
  var shown = sessionStorage.getItem('ds-exit-shown')

  if (!shown) {
    // Build popup using safe DOM methods
    var style = document.createElement('style')
    style.textContent = '#ds-exit-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;align-items:center;justify-content:center;backdrop-filter:blur(4px)}#ds-exit-overlay.active{display:flex}#ds-exit-modal{background:#0f172a;border:2px solid #facc15;border-radius:16px;padding:36px;max-width:420px;width:90%;position:relative;box-shadow:0 25px 60px rgba(0,0,0,0.5)}#ds-exit-close{position:absolute;top:12px;right:16px;background:none;border:none;color:#64748b;font-size:1.8rem;cursor:pointer;line-height:1}#ds-exit-close:hover{color:#f1f5f9}#ds-exit-form input::placeholder{color:#64748b}'
    document.head.appendChild(style)

    var overlay = document.createElement('div')
    overlay.id = 'ds-exit-overlay'

    var modal = document.createElement('div')
    modal.id = 'ds-exit-modal'

    var closeBtn = document.createElement('button')
    closeBtn.id = 'ds-exit-close'
    closeBtn.setAttribute('aria-label', 'Close')
    closeBtn.textContent = '\u00d7'

    var iconDiv = document.createElement('div')
    iconDiv.style.cssText = 'text-align:center;margin-bottom:20px'
    var iconSpan = document.createElement('span')
    iconSpan.style.fontSize = '2.5rem'
    iconSpan.textContent = '\u26a1'
    iconDiv.appendChild(iconSpan)

    var heading = document.createElement('h2')
    heading.style.cssText = 'color:#f1f5f9;font-size:1.5rem;font-weight:800;margin-bottom:8px;text-align:center'
    heading.textContent = 'Wait \u2014 Get a Free Quote First'

    var subtitle = document.createElement('p')
    subtitle.style.cssText = 'color:#94a3b8;font-size:0.95rem;text-align:center;margin-bottom:24px'
    subtitle.textContent = 'No obligation. We reply within 2 hours.'

    // Build form
    var form = document.createElement('form')
    form.id = 'ds-exit-form'
    form.setAttribute('name', 'exit-intent-lead')
    form.setAttribute('method', 'POST')
    form.setAttribute('data-netlify', 'true')
    form.setAttribute('netlify-honeypot', 'bot-field')

    var hiddenFormName = document.createElement('input')
    hiddenFormName.type = 'hidden'
    hiddenFormName.name = 'form-name'
    hiddenFormName.value = 'exit-intent-lead'

    var hiddenBot = document.createElement('input')
    hiddenBot.type = 'hidden'
    hiddenBot.name = 'bot-field'

    var hiddenSource = document.createElement('input')
    hiddenSource.type = 'hidden'
    hiddenSource.name = 'source-page'
    hiddenSource.value = window.location.pathname

    var inputStyle = 'width:100%;padding:12px 14px;border:1px solid #334155;border-radius:8px;background:#1e293b;color:#f1f5f9;font-size:0.95rem;margin-bottom:12px;box-sizing:border-box'

    var nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.name = 'name'
    nameInput.required = true
    nameInput.placeholder = 'Your name'
    nameInput.style.cssText = inputStyle

    var phoneInput = document.createElement('input')
    phoneInput.type = 'tel'
    phoneInput.name = 'phone'
    phoneInput.required = true
    phoneInput.placeholder = 'Phone number'
    phoneInput.style.cssText = inputStyle

    var emailInput = document.createElement('input')
    emailInput.type = 'email'
    emailInput.name = 'email'
    emailInput.placeholder = 'Email (optional)'
    emailInput.style.cssText = inputStyle.replace('margin-bottom:12px', 'margin-bottom:16px')

    var submitBtn = document.createElement('button')
    submitBtn.type = 'submit'
    submitBtn.style.cssText = 'width:100%;background:#facc15;color:#1e293b;font-weight:700;font-size:1rem;padding:14px;border:none;border-radius:8px;cursor:pointer'
    submitBtn.textContent = 'Get My Free Quote'

    form.appendChild(hiddenFormName)
    form.appendChild(hiddenBot)
    form.appendChild(hiddenSource)
    form.appendChild(nameInput)
    form.appendChild(phoneInput)
    form.appendChild(emailInput)
    form.appendChild(submitBtn)

    // Success div
    var successDiv = document.createElement('div')
    successDiv.id = 'ds-exit-success'
    successDiv.style.cssText = 'display:none;text-align:center;padding:20px 0'
    var successCheck = document.createElement('p')
    successCheck.style.fontSize = '1.5rem'
    successCheck.style.marginBottom = '12px'
    successCheck.textContent = '\u2713'
    var successH = document.createElement('h3')
    successH.style.cssText = 'color:#f1f5f9;font-size:1.2rem;margin-bottom:8px'
    successH.textContent = "Got it! We'll be in touch shortly."
    var successP = document.createElement('p')
    successP.style.color = '#94a3b8'
    var successA = document.createElement('a')
    successA.href = 'tel:+447889334849'
    successA.style.cssText = 'color:#facc15;font-weight:700'
    successA.textContent = '07889 334849'
    successP.textContent = 'Or call now: '
    successP.appendChild(successA)
    successDiv.appendChild(successCheck)
    successDiv.appendChild(successH)
    successDiv.appendChild(successP)

    // Call link at bottom
    var callNote = document.createElement('p')
    callNote.style.cssText = 'color:#475569;font-size:0.8rem;text-align:center;margin-top:12px'
    var callLink = document.createElement('a')
    callLink.href = 'tel:+447889334849'
    callLink.style.color = '#facc15'
    callLink.textContent = '07889 334849'
    callNote.textContent = 'Or call direct: '
    callNote.appendChild(callLink)

    // Assemble modal
    modal.appendChild(closeBtn)
    modal.appendChild(iconDiv)
    modal.appendChild(heading)
    modal.appendChild(subtitle)
    modal.appendChild(form)
    modal.appendChild(successDiv)
    modal.appendChild(callNote)
    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    // Show on exit intent (mouse leaves viewport top) - desktop
    document.addEventListener('mouseout', function(e) {
      if (e.clientY < 10 && !shown) {
        overlay.classList.add('active')
        sessionStorage.setItem('ds-exit-shown', '1')
        shown = true
      }
    })

    // Show after 30s on mobile
    if ('ontouchstart' in window) {
      setTimeout(function() {
        if (!shown) {
          overlay.classList.add('active')
          sessionStorage.setItem('ds-exit-shown', '1')
          shown = true
        }
      }, 30000)
    }

    // Close handlers
    closeBtn.addEventListener('click', function() { overlay.classList.remove('active') })
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('active')
    })

    // Form submit
    form.addEventListener('submit', function(e) {
      e.preventDefault()
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      }).then(function() {
        form.style.display = 'none'
        successDiv.style.display = 'block'
        setTimeout(function() { overlay.classList.remove('active') }, 3000)
      }).catch(function() {
        form.style.display = 'none'
        successDiv.style.display = 'block'
        setTimeout(function() { overlay.classList.remove('active') }, 3000)
      })
    })
  }

  // ============================
  // GOOGLE ANALYTICS 4
  // ============================
  // Replace G-XXXXXXXXXX with your GA4 Measurement ID
  var GA_ID = 'G-XXXXXXXXXX'
  if (GA_ID !== 'G-XXXXXXXXXX') {
    var gs = document.createElement('script')
    gs.async = true
    gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID
    document.head.appendChild(gs)
    window.dataLayer = window.dataLayer || []
    function gtag(){dataLayer.push(arguments)}
    gtag('js', new Date())
    gtag('config', GA_ID)
  }

  // ============================
  // META PIXEL
  // ============================
  // Replace YOUR_PIXEL_ID with your Meta Pixel ID
  var META_PIXEL = 'YOUR_PIXEL_ID'
  if (META_PIXEL !== 'YOUR_PIXEL_ID') {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js')
    fbq('init', META_PIXEL)
    fbq('track', 'PageView')
  }

  // ============================
  // TRACK CONVERSIONS
  // ============================
  document.addEventListener('submit', function(e) {
    var form = e.target
    if (form.hasAttribute('data-netlify')) {
      if (typeof gtag === 'function') {
        gtag('event', 'generate_lead', { event_category: 'form', event_label: form.getAttribute('name') || 'unknown' })
      }
      if (typeof fbq === 'function') {
        fbq('track', 'Lead', { content_name: form.getAttribute('name') || 'unknown' })
      }
    }
  })

  // Track phone clicks
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href^="tel:"]')
    if (link) {
      if (typeof gtag === 'function') gtag('event', 'click_to_call', { event_category: 'engagement' })
      if (typeof fbq === 'function') fbq('track', 'Contact')
    }
  })

  // Track WhatsApp clicks
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href*="wa.me"]')
    if (link) {
      if (typeof gtag === 'function') gtag('event', 'whatsapp_click', { event_category: 'engagement' })
      if (typeof fbq === 'function') fbq('track', 'Contact', { content_name: 'whatsapp' })
    }
  })
})()
