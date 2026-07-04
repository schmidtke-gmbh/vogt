/* WordsPullUp: split headline words, keep gold spans, staggered reveal */
(function(){
  document.querySelectorAll('[data-pull]').forEach(function(el){
    var frag=document.createDocumentFragment();
    var nodes=Array.prototype.slice.call(el.childNodes);
    nodes.forEach(function(node){
      if(node.nodeType===3){ // text
        node.textContent.split(/(\s+)/).forEach(function(tok){
          if(tok.trim()===''){ frag.appendChild(document.createTextNode(tok)); }
          else{ var s=document.createElement('span'); s.className='w'; s.textContent=tok; frag.appendChild(s); }
        });
      } else if(node.nodeType===1){
        // element (e.g. <span class="gold">Schütze</span>) -> wrap as one word
        node.classList.add('w'); frag.appendChild(node);
      }
    });
    el.innerHTML=''; el.appendChild(frag);
    var ws=el.querySelectorAll('.w');
    ws.forEach(function(w,i){ w.style.transitionDelay=(i*0.08)+'s'; });
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('in'); }); });
  });
  /* fade-up with optional delay */
  document.querySelectorAll('.fade-up').forEach(function(el){
    var d=parseFloat(el.getAttribute('data-delay')||'0.2');
    el.style.transitionDelay=d+'s';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('in'); }); });
  });
  /* scroll reveal */
  var io=new IntersectionObserver(function(ents){
    ents.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} });
  },{threshold:0.18});
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  document.querySelectorAll('.reveal-stagger').forEach(function(el){
    Array.prototype.forEach.call(el.children,function(c,i){ c.style.transitionDelay=(i*0.12)+'s'; });
    io.observe(el);
  });
  /* active nav on scroll */
  var links=[].slice.call(document.querySelectorAll('.nav-menu a[data-nav]'));
  var map={},secs=[];
  links.forEach(function(a){var h=a.getAttribute('href')||'';if(h.charAt(0)!=='#')return;var id=h.slice(1);var el=document.getElementById(id);if(el){map[id]=a;secs.push(el);}});
  if(!secs.length) return; // Seiten mit Seiten-Links: statische .active beibehalten
  function onScroll(){var pos=window.scrollY+160,cur=null;secs.forEach(function(s){if(s.offsetTop<=pos)cur=s.id;});links.forEach(function(a){a.classList.remove('active');});if(cur&&map[cur])map[cur].classList.add('active');}
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
})();

/* FAQ accordion */
(function(){
  document.querySelectorAll('.faq-item .faq-q').forEach(function(q){
    q.addEventListener('click',function(){
      var item=q.closest('.faq-item');var a=item.querySelector('.faq-a');var open=item.classList.toggle('open');
      a.style.maxHeight=open?(a.scrollHeight+'px'):'0';
    });
  });
})();

/* Probetraining step-modal */
(function(){
  var modal=document.getElementById('probeModal');
  if(!modal) return;
  var bar=document.getElementById('pmBar'),back=document.getElementById('pmBack'),next=document.getElementById('pmNext'),nav=document.getElementById('pmNav');
  var steps=modal.querySelectorAll('.mstep');
  var cur=1,lastFocus=null;
  var data={};
  function show(n){
    cur=n;
    steps.forEach(function(s){s.classList.toggle('active',+s.getAttribute('data-step')===n);});
    bar.style.width=Math.min(n,4)/4*100+'%';
    back.style.visibility=(n>1&&n<5)?'visible':'hidden';
    if(n>=5){nav.style.display='none';return;} else {nav.style.display='flex';}
    next.textContent=(n===4)?'Anfrage senden':'Weiter';
    refreshNext();
  }
  function refreshNext(){
    if(cur<=3){
      var g=['','standort','interesse','level'][cur];
      next.disabled=!data[g];
    } else { next.disabled=false; }
  }
  function open(){
    lastFocus=document.activeElement;
    modal.classList.add('open');document.body.style.overflow='hidden';
    cur=1;data={};
    modal.querySelectorAll('.mopt').forEach(function(o){o.classList.remove('sel');});
    show(1);
    setTimeout(function(){var f=modal.querySelector('.mopt');if(f)f.focus();},60);
  }
  function close(){
    modal.classList.remove('open');document.body.style.overflow='';
    if(lastFocus)lastFocus.focus();
  }
  // (Popup deaktiviert – CTAs navigieren zur Probetraining-Seite, siehe unten)
  // close triggers
  modal.querySelectorAll('[data-close]').forEach(function(el){el.addEventListener('click',close);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&modal.classList.contains('open'))close();});
  // option select
  modal.querySelectorAll('.mopt').forEach(function(o){
    o.addEventListener('click',function(){
      var g=o.getAttribute('data-group');
      modal.querySelectorAll('.mopt[data-group="'+g+'"]').forEach(function(x){x.classList.remove('sel');});
      o.classList.add('sel');data[g]=o.getAttribute('data-value');
      refreshNext();
    });
  });
  next.addEventListener('click',function(){
    if(cur===4){
      var name=document.getElementById('pmName').value.trim();
      var mail=document.getElementById('pmMail').value.trim();
      var tel=document.getElementById('pmTel').value.trim();
      if(!name||(!mail&&!tel)){
        if(!name)document.getElementById('pmName').focus();
        else document.getElementById('pmMail').focus();
        document.getElementById('pmName').style.borderColor=name?'':'#c0392b';
        return;
      }
      data.name=name;data.mail=mail;data.tel=tel;
      show(5);
      return;
    }
    show(cur+1);
  });
  back.addEventListener('click',function(){if(cur>1)show(cur-1);});
})();

/* Spotlight glow: track pointer globally for CI-gold tile borders */
(function(){
  var root=document.documentElement;
  window.addEventListener('pointermove',function(e){
    root.style.setProperty('--mx', e.clientX+'px');
    root.style.setProperty('--my', e.clientY+'px');
  },{passive:true});
})();

/* Footer watermark PUNCHROCKS reveal */
(function(){
  var svg=document.getElementById('footWord'); if(!svg) return;
  var grad=document.getElementById('pwReveal'); if(!grad) return;
  window.addEventListener('pointermove',function(e){
    var r=svg.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){
      grad.setAttribute('cx','-30%');grad.setAttribute('cy','-30%');return;
    }
    grad.setAttribute('cx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');
    grad.setAttribute('cy',((e.clientY-r.top)/r.height*100).toFixed(1)+'%');
  },{passive:true});
})();

/* Kursplan location tabs */
(function(){
  document.querySelectorAll('.kurstabs').forEach(function(group){
    var scope=group.closest('section')||document;
    var tabs=group.querySelectorAll('.kurstab');
    tabs.forEach(function(t){
      t.addEventListener('click',function(){
        tabs.forEach(function(x){x.classList.remove('active');});
        scope.querySelectorAll('.kurspanel').forEach(function(p){p.classList.remove('active');});
        t.classList.add('active');
        var pan=scope.querySelector('#'+t.getAttribute('data-target'))||document.getElementById(t.getAttribute('data-target'));
        if(pan)pan.classList.add('active');
      });
    });
  });
})();

/* Mobile menu toggle */
(function(){
  var burger=document.querySelector('.nav-burger');
  var menu=document.getElementById('mobMenu');
  if(!burger||!menu) return;
  burger.addEventListener('click',function(e){e.stopPropagation();menu.classList.toggle('open');});
  menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){menu.classList.remove('open');});});
  document.addEventListener('click',function(e){if(menu.classList.contains('open')&&!menu.contains(e.target)&&!burger.contains(e.target))menu.classList.remove('open');});
})();

/* ===== Parallax CTA band (multi-layer, vanilla GSAP-free) ===== */
(function(){
  var secs=document.querySelectorAll('.px-cta'); if(!secs.length) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var items=[];
  secs.forEach(function(sec){
    items.push({sec:sec,bg:sec.querySelector('[data-px="1"]'),word:sec.querySelector('[data-px="2"]'),front:sec.querySelector('[data-px="3"]')});
  });
  var ticking=false;
  function upd(){
    var vh=window.innerHeight||document.documentElement.clientHeight;
    items.forEach(function(it){
      var r=it.sec.getBoundingClientRect();
      var prog=(vh - r.top)/(vh + r.height); prog=Math.max(0,Math.min(1,prog));
      var p=(prog-0.5)*2;
      if(it.bg)   it.bg.style.transform   = 'translate3d(0,'+(p*9)+'%,0) scale(1.14)';
      if(it.word) it.word.style.transform = 'translate(-50%,-50%) translateY('+(p*-46)+'px)';
      if(it.front)it.front.style.transform= 'translateY('+(p*-20)+'px)';
    });
    ticking=false;
  }
  function onScroll(){ if(!ticking){ requestAnimationFrame(upd); ticking=true; } }
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onScroll);
  upd();
})();


/* ===== CTAs -> eigene Probetraining-Seite (kein Popup) ===== */
(function(){
  var sel='.nav-cta,.nav-arrow,.hcta--solid,.ang-cta,.km-cta,.lk-cta,.pb-cta,[data-probe]';
  document.querySelectorAll(sel).forEach(function(el){
    if(el.closest('#probePage')||el.closest('#bwPage')) return;
    var href=el.getAttribute&&el.getAttribute('href');
    if(href&&href.indexOf('bewerbung')>-1) return;
    el.addEventListener('click',function(e){e.preventDefault();window.location.href='probetraining.html';});
  });
})();

/* ===== Probetraining-Seite: Step-Formular ===== */
(function(){
  var form=document.getElementById('probePage'); if(!form) return;
  var bar=document.getElementById('ppBar'),back=document.getElementById('ppBack'),next=document.getElementById('ppNext'),nav=document.getElementById('ppNav');
  var steps=form.querySelectorAll('.mstep'); var cur=1,data={};
  function refreshNext(){ if(cur<=3){var g=['','standort','interesse','level'][cur];next.disabled=!data[g];} else {next.disabled=false;} }
  function show(n){
    cur=n;
    steps.forEach(function(s){s.classList.toggle('active',+s.getAttribute('data-step')===n);});
    bar.style.width=Math.min(n,4)/4*100+'%';
    back.style.visibility=(n>1&&n<5)?'visible':'hidden';
    if(n>=5){nav.style.display='none';} else {nav.style.display='flex';next.textContent=(n===4)?'Anfrage senden':'Weiter';refreshNext();}
  }
  form.querySelectorAll('.mopt').forEach(function(o){
    o.addEventListener('click',function(){
      var g=o.getAttribute('data-group');
      form.querySelectorAll('.mopt[data-group="'+g+'"]').forEach(function(x){x.classList.remove('sel');});
      o.classList.add('sel');data[g]=o.getAttribute('data-value');refreshNext();
    });
  });
  next.addEventListener('click',function(){
    if(cur===4){
      var name=document.getElementById('ppName').value.trim();
      var mail=document.getElementById('ppMail').value.trim();
      var tel=document.getElementById('ppTel').value.trim();
      if(!name||(!mail&&!tel)){
        if(!name)document.getElementById('ppName').focus(); else document.getElementById('ppMail').focus();
        document.getElementById('ppName').style.borderColor=name?'':'#c0392b';
        return;
      }
      data.name=name;data.mail=mail;data.tel=tel;show(5);return;
    }
    show(cur+1);
  });
  back.addEventListener('click',function(){if(cur>1)show(cur-1);});
  show(1);
})();

/* ===== Video-Lightbox (Interview) ===== */
(function(){
  var triggers=document.querySelectorAll('[data-video-trigger]'); if(!triggers.length) return;
  var box=document.getElementById('vLight'); if(!box) return;
  var frame=document.getElementById('vFrame');
  function urlFor(t){ var s=t.closest('[data-interview]'); return (s&&s.getAttribute('data-interview').trim())||''; }
  function open(u){
    if(u){ frame.innerHTML='<iframe src="'+u+(u.indexOf('?')>-1?'&':'?')+'autoplay=1" title="Interview Bernfried Vogt" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>'; }
    else { frame.innerHTML='<div class="vlight-soon">Das Interview-Video folgt in Kürze.<br>Sobald der Link da ist, wird er hier eingebunden.</div>'; }
    box.hidden=false; document.body.style.overflow='hidden';
  }
  function close(){ box.hidden=true; frame.innerHTML=''; document.body.style.overflow=''; }
  triggers.forEach(function(t){ t.addEventListener('click',function(e){e.preventDefault();open(urlFor(t));}); });
  box.querySelectorAll('[data-vclose]').forEach(function(el){ el.addEventListener('click',close); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!box.hidden) close(); });
})();

/* ===== Footer-Watermark: Scroll-Choreografie ===== */
(function(){
  var els=document.querySelectorAll('.foot-watermark'); if(!els.length) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var ticking=false;
  function upd(){
    var vh=window.innerHeight||document.documentElement.clientHeight;
    els.forEach(function(w){
      var f=w.closest('.footer')||w.parentElement;
      var r=f.getBoundingClientRect();
      var p=(vh - r.top)/(vh + r.height); p=Math.max(0,Math.min(1,p));
      var scale=0.7+p*0.42, op=0.12+p*0.42, sx=(p-0.5)*30;
      w.style.transform='translateX(calc(-50% + '+sx.toFixed(1)+'px)) scale('+scale.toFixed(3)+')';
      w.style.opacity=op.toFixed(3);
    });
    ticking=false;
  }
  function on(){ if(!ticking){ requestAnimationFrame(upd); ticking=true; } }
  window.addEventListener('scroll',on,{passive:true});
  window.addEventListener('resize',on);
  upd();
})();

/* ===== Instagram-Row: Pfeil-Navigation ===== */
(function(){
  var row=document.getElementById('igRow'); if(!row) return;
  function step(){var card=row.querySelector('.ig-card');return card?card.getBoundingClientRect().width+22:320;}
  var prev=document.querySelector('[data-ig-prev]'),next=document.querySelector('[data-ig-next]');
  if(prev)prev.addEventListener('click',function(){row.scrollBy({left:-step(),behavior:'smooth'});});
  if(next)next.addEventListener('click',function(){row.scrollBy({left:step(),behavior:'smooth'});});
})();

/* ===== V2: Über-uns Bildslider ===== */
(function(){
  var sl=document.getElementById('amSlider'); if(!sl) return;
  var imgs=sl.querySelectorAll('img'), dots=document.querySelectorAll('#amDots button'), cur=0, t;
  function go(n){
    imgs[cur].classList.remove('on'); dots[cur].classList.remove('on');
    cur=(n+imgs.length)%imgs.length;
    imgs[cur].classList.add('on'); dots[cur].classList.add('on');
  }
  function auto(){ t=setInterval(function(){go(cur+1);},4500); }
  dots.forEach(function(d,i){ d.addEventListener('click',function(){clearInterval(t);go(i);auto();}); });
  auto();
})();

/* ===== V2: Instagram-Interviews (Direkt-Embed) ===== */
(function(){
  if(!document.querySelector('.iv-embed .instagram-media')) return;
  if(!document.getElementById('igEmbedJs')){
    var s=document.createElement('script');s.id='igEmbedJs';s.async=true;s.src='https://www.instagram.com/embed.js';
    document.body.appendChild(s);
  }
})();

/* ===== Bewerbungs-Seite: Step-Formular (Auto-Weiter) ===== */
(function(){
  var form=document.getElementById('bwPage'); if(!form) return;
  var bar=document.getElementById('bwBar'),back=document.getElementById('bwBack'),next=document.getElementById('bwNext'),nav=document.getElementById('bwNav');
  var steps=form.querySelectorAll('.mstep'); var cur=1,data={};
  function show(n){
    cur=n;
    steps.forEach(function(s){s.classList.toggle('active',+s.getAttribute('data-step')===n);});
    bar.style.width=Math.min(n,3)/3*100+'%';
    back.style.visibility=(n>1&&n<4)?'visible':'hidden';
    if(n>=4){nav.style.display='none';}
    else{
      nav.style.display='flex';
      next.style.display=(n===3)?'inline-flex':'none';
      next.textContent='Bewerbung senden';next.disabled=false;
    }
  }
  form.querySelectorAll('.mopt').forEach(function(o){
    o.addEventListener('click',function(){
      var g=o.getAttribute('data-group');
      form.querySelectorAll('.mopt[data-group="'+g+'"]').forEach(function(x){x.classList.remove('sel');});
      o.classList.add('sel');data[g]=o.getAttribute('data-value');
      setTimeout(function(){show(cur+1);},220);
    });
  });
  next.addEventListener('click',function(){
    if(cur===3){
      var name=document.getElementById('bwName').value.trim();
      var mail=document.getElementById('bwMail').value.trim();
      var tel=document.getElementById('bwTel').value.trim();
      if(!name||(!mail&&!tel)){
        if(!name)document.getElementById('bwName').focus(); else document.getElementById('bwMail').focus();
        document.getElementById('bwName').style.borderColor=name?'':'#c0392b';
        return;
      }
      data.name=name;data.mail=mail;data.tel=tel;
      data.ort=document.getElementById('bwOrt').value.trim();
      data.msg=document.getElementById('bwMsg').value.trim();
      show(4);return;
    }
    show(cur+1);
  });
  back.addEventListener('click',function(){if(cur>1)show(cur-1);});
  show(1);
})();

/* ===== Karriere: Nav erst nach dem Hero einblenden ===== */
(function(){
  var hero=document.querySelector('.khero--big'); if(!hero) return;
  var nav=document.getElementById('nav'); if(!nav) return;
  var img=hero.querySelector('.khero-bigimg');
  function upd(){
    var limit=img?img.getBoundingClientRect().bottom:200;
    if(limit<70){nav.classList.add('nav--shown');nav.classList.remove('nav--hidden');}
    else{nav.classList.add('nav--hidden');nav.classList.remove('nav--shown');}
  }
  window.addEventListener('scroll',upd,{passive:true});
  window.addEventListener('resize',upd);
  upd();
})();

/* ===== Firmen: Anfrage-Formular ===== */
(function(){
  var form=document.getElementById('firmenForm'); if(!form) return;
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var firma=document.getElementById('fiFirma'), name=document.getElementById('fiName'), mail=document.getElementById('fiMail');
    var ok=true;
    [firma,name,mail].forEach(function(el){
      if(!el.value.trim()){el.style.borderColor='#c0392b';ok=false;} else {el.style.borderColor='';}
    });
    if(!ok) return;
    form.querySelectorAll('input,textarea,button').forEach(function(el){el.disabled=true;});
    document.getElementById('fiSuccess').hidden=false;
  });
})();
