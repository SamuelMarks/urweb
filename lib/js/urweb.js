// Lists

function cons(v, ls) {
  return { next : ls, data : v };
}
function concat(ls1, ls2) {
  return (ls1 ? cons(ls1.data, concat(ls1.next, ls2)) : ls2);
}
function member(x, ls) {
  for (; ls; ls = ls.next)
    if (ls.data == x)
      return true;
  return false;
}
function remove(x, ls) {
  return (ls ? (ls.data == x ? ls.next : cons(ls.data, remove(x, ls.next))) : null);
}
function union(ls1, ls2) {
  return (ls1 ? (member(ls1.data, ls2) ? union(ls1.next, ls2) : cons(ls1.data, union(ls1.next, ls2))) : ls2);
}


// Embedding closures in XML strings

function cat(s1, s2) {
  if (s1.length && s2.length)
    return s1 + s2;
  else
    return {_1: s1, _2: s2};
}

var closures = [];

function newClosure(f) {
  var n = closures.length;
  closures[n] = f;
  return n;
}

function cr(n) {
  return closures[n]();
}

function flatten(tr) {
  if (tr.length)
    return tr;
  else if (tr._1)
    return cs(tr._1) + cs(tr._2);
  else
    return "cr(" + newClosure(tr) + ")";
}

function clearClosures() {
  closures = [];
}


// Dynamic tree management

function populate(node) {
  var s = node.signal;
  var oldSources = node.sources;
  var sr = s();
  var newSources = sr.sources;

  for (var sp = oldSources; sp; sp = sp.next)
    if (!member(sp.data, newSources))
      sp.data.dyns = remove(node, sp.data.dyns);

  for (var sp = newSources; sp; sp = sp.next)
    if (!member(sp.data, oldSources))
      sp.data.dyns = cons(node, sp.data.dyns);

  node.sources = newSources;
  node.recreate(sr.data);
}

function sc(v) {
  return {data : v, dyns : null};
}
function sv(s, v) {
  s.data = v;
  for (var ls = s.dyns; ls; ls = ls.next)
    if (!ls.dead)
      populate(ls.data);
}
function sg(s) {
  return s.data;
}

function ss(s) {
  return function() { return {sources : cons(s, null), data : s.data } };
}
function sr(v) {
  return function() { return {sources : null, data : v } };
}
function sb(x,y) {
  return function() {
    var xr = x();
    var yr = y(xr.data)();
    return {sources : union(xr.sources, yr.sources), data : yr.data};
  };
}

function lastParent() {
  var pos = document;

  while (pos.lastChild && pos.lastChild.nodeType == 1)
    pos = pos.lastChild;

  return pos.parentNode;
}

function addNode(node) {
  if (thisScript) {
    thisScript.parentNode.appendChild(node);
    thisScript.parentNode.removeChild(thisScript);
  } else
    lastParent().appendChild(node);
}

var thisScript = null;

function runScripts(node) {
  var savedScript = thisScript;

  var scripts = node.getElementsByTagName("script"), scriptsCopy = [];
  var len = scripts.length;
  for (var i = 0; i < len; ++i)
    scriptsCopy[i] = scripts[i];
  for (var i = 0; i < len; ++i) {
    thisScript = scriptsCopy[i];
    eval(thisScript.textContent);
  }

  thisScript = savedScript;
}


// Dynamic tree entry points

var dynDepth = 0;

function dyn(s) {
  var x = document.createElement("span");
  x.dead = false;
  x.signal = s;
  x.sources = null;
  x.recreate = function(v) {
    ++dynDepth;

    var spans = x.getElementsByTagName("span");
    for (var i = 0; i < spans.length; ++i) {
      var span = spans[i];
      span.dead = true;
      for (var ls = span.sources; ls; ls = ls.next)
        ls.data.dyns = remove(span, ls.data.dyns);
    }

    x.innerHTML = v;
    runScripts(x);

    if (--dynDepth == 0)
      clearClosures();
  };
  populate(x);
  addNode(x);
}

function inp(t, s) {
  var x = document.createElement(t);
  x.dead = false;
  x.signal = ss(s);
  x.sources = null;
  x.recreate = function(v) { if (x.value != v) x.value = v; };
  populate(x);
  addNode(x);
  x.onkeyup = function() { sv(s, x.value) };
  return x;
}


// Basic string operations

function eh(x) {
  return x.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;");
}

function ts(x) { return x.toString() }
function bs(b) { return (b ? "True" : "False") }

function pi(s) {
  var r = parseInt(s);
  if (r.toString() == s)
    return r;
  else
    throw "Can't parse int: " + s;
}

function pfl(s) {
  var r = parseFloat(s);
  if (r.toString() == s)
    return r;
  else
    throw "Can't parse float: " + s;
}

function uf(s) {
  return escape(s).replace(new RegExp ("/", "g"), "%2F");
}

function uu(s) {
  return unescape(s).replace(new RegExp ("\\+", "g"), " ");
}


// Error handling

function whine(msg) {
  alert(msg);
  throw msg;
}

function pf() {
  whine("Pattern match failure");
}


// Remote calls

var client_id = 0;
var client_pass = 0;
var url_prefix = "/";
var timeout = 60;

function getXHR(uri)
{
  try {
    return new XMLHttpRequest();
  } catch (e) {
    try {
     return new ActiveXObject("Msxml2.XMLHTTP");
    } catch (e) {
      try {
        return new ActiveXObject("Microsoft.XMLHTTP");
      } catch (e) {
        throw "Your browser doesn't seem to support AJAX.";
      }
    }
  }
}

function requestUri(xhr, uri) {
  xhr.open("GET", uri, true);

  if (client_id != 0) {
    xhr.setRequestHeader("UrWeb-Client", client_id.toString());
    xhr.setRequestHeader("UrWeb-Pass", client_pass.toString());
  }

  xhr.send(null);
}

function rc(uri, parse, k) {
  var xhr = getXHR();

  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      var isok = false;

      try {
        if (xhr.status == 200)
          isok = true;
      } catch (e) { }

      if (isok)
        k(parse(xhr.responseText));
      else {
        whine("Error querying remote server!");
      }
    }
  };

  requestUri(xhr, uri);
}

function path_join(s1, s2) {
  if (s1.length > 0 && s1[s1.length-1] == '/')
    return s1 + s2;
  else
    return s1 + "/" + s2;
}

var channels = [];

function newQueue() {
  return { front : null, back : null };
}
function enqueue(q, v) {
  if (q.front == null) {
    q.front = cons(v, null);
    q.back = q.front;
  } else {
    var node = cons(v, null);
    q.back.next = node;
    q.back = node;
  }
}
function dequeue(q) {
  if (q.front == null)
    return null;
  else {
    var r = q.front.data;
    q.front = q.front.next;
    if (q.front == null)
      q.back = null;
    return r;
  }
}

function newChannel() {
  return { msgs : newQueue(), listeners : newQueue() };
}

function listener() {
  var uri = path_join(url_prefix, ".msgs");
  var xhr = getXHR();
  var tid, orsc, onTimeout;

  var connect = function () {
    xhr.onreadystatechange = orsc;
    tid = window.setTimeout(onTimeout, timeout * 500);
    requestUri(xhr, uri);
  }

  orsc = function() {
    if (xhr.readyState == 4) {
      window.clearTimeout(tid);

      var isok = false;

      try {
        if (xhr.status == 200)
          isok = true;
      } catch (e) { }

      if (isok) {
        var lines = xhr.responseText.split("\n");
        if (lines.length < 2) 
          return; // throw "Empty message from remote server";

        for (var i = 0; i+1 < lines.length; i += 2) {
          var chn = lines[i];
          var msg = lines[i+1];

          if (chn < 0)
            whine("Out-of-bounds channel in message from remote server");

          var ch;

          if (chn >= channels.length || channels[chn] == null) {
            ch = newChannel();
            channels[chn] = ch;
          } else
            ch = channels[chn];

          var listener = dequeue(ch.listeners);
          if (listener == null) {
            enqueue(ch.msgs, msg);
          } else {
            listener(msg);
          }
        }

        connect();
      }
      else {
        /*try {
          whine("Error querying remote server for messages! " + xhr.status);
        } catch (e) { }*/
      }
    }
  };

  onTimeout = function() {
    xhr.abort();
    connect();
  };

  connect();
}

function rv(chn, parse, k) {
  if (chn == null)
    return;

  if (chn < 0)
    whine("Out-of-bounds channel receive");

  var ch;

  if (chn >= channels.length || channels[chn] == null) {
    ch = newChannel();
    channels[chn] = ch;
  } else
    ch = channels[chn];

  var msg = dequeue(ch.msgs);
  if (msg == null) {
    enqueue(ch.listeners, function(msg) { k(parse(msg))(null); });
  } else {
    k(parse(msg))(null);
  }
}