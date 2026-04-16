(function(){
 try {
  var x = new XMLHttpRequest();
  x.open('POST', '/analytics/hit', true);
  x.setRequestHeader('Content-Type', 'application/json');
  x.send(JSON.stringify({p: location.pathname, r: document.referrer}));
 } catch(e) {}
})();
