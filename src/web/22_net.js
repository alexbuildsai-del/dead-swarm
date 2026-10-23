'use strict';
/* ==========================================================================
   web/22_net.js — online co-op transport: two browsers talk directly (WebRTC data channel), no server.
   Host:  host() → a code to send the friend; accept(reply) once the friend sends theirs back.
   Join:  join(code) → a reply code to send back.
   The codes carry only what the connection needs (ICE user/password, the DTLS fingerprint, the candidate addresses)
   plus the build id: two different builds would drift apart, so they refuse each other.
   On the same Wi-Fi the browsers find each other directly; across the internet the public STUN servers below tell
   each browser its outside address. This is the only time the game uses the network, and only after Host or Join.
   Messages are JSON on one ordered, reliable channel. A ping every second measures the round trip; 8 s of silence or
   a failed connection is a drop.
   ========================================================================== */
(function () {
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  window.addEventListener('pagehide', () => { if (DS.Net && DS.Net.open) DS.Net.send({ k: 'bye' }); });   // closing the page: tell the friend at once
  const N = DS.Net = {
    pc: null, ch: null, role: null, state: 'idle', rtt: 0, lastRx: 0, error: '',
    onMessage: null, onState: null,
    available() { return typeof RTCPeerConnection === 'function'; },
    setState(s, err) { this.state = s; if (err) this.error = err; const f = this.onState || (DS.UI && DS.UI.netOnState); if (f) try { f(s, err); } catch (e) { console.error(e); } },
    reset() {
      clearInterval(this._ping); this._ping = 0;
      if (this.ch) try { this.ch.onclose = null; this.ch.close(); } catch (e) { }
      if (this.pc) try { this.pc.onconnectionstatechange = null; this.pc.close(); } catch (e) { }
      this.pc = this.ch = null; this.role = null; this.rtt = 0; this.error = ''; this.state = 'idle';
    },
    /* ---------- host ---------- */
    async host() {
      this.reset(); this.role = 'host'; this.setState('gathering');
      const pc = this.newPc();
      this.wire(pc.createDataChannel('ds', { ordered: true }));
      await pc.setLocalDescription(await pc.createOffer());
      await this.gathered(pc);
      this.setState('waiting');
      return this.pack(pc.localDescription.sdp, 'o');
    },
    async accept(code) {
      if (this.role !== 'host' || !this.pc) throw new Error('Press Host first.');
      const d = this.unpack(code, 'a');
      this.setState('connecting');
      await this.pc.setRemoteDescription({ type: 'answer', sdp: this.sdp(d) });
    },
    /* ---------- join ---------- */
    async join(code) {
      const d = this.unpack(code, 'o');
      this.reset(); this.role = 'join'; this.setState('gathering');
      const pc = this.newPc();
      pc.ondatachannel = e => this.wire(e.channel);
      await pc.setRemoteDescription({ type: 'offer', sdp: this.sdp(d) });
      await pc.setLocalDescription(await pc.createAnswer());
      await this.gathered(pc);
      this.setState('connecting');
      return this.pack(pc.localDescription.sdp, 'a');
    },
    newPc() {
      const pc = this.pc = new RTCPeerConnection({ iceServers: ICE });
      pc.onconnectionstatechange = () => { const s = pc.connectionState; if ((s === 'failed' || s === 'closed') && this.pc === pc) this.drop(s === 'failed' ? 'The connection failed.' : 'The connection closed.'); };
      return pc;
    },
    /* all candidates in (or 4 s: an unreachable STUN server must not hang Host / Join) */
    gathered(pc) {
      return new Promise(res => {
        if (pc.iceGatheringState === 'complete') return res();
        const t = setTimeout(res, 4000);
        pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
      });
    },
    wire(ch) {
      this.ch = ch;
      ch.onopen = () => {
        this.lastRx = performance.now(); this.setState('open');
        clearInterval(this._ping);
        this._ping = setInterval(() => {
          if (performance.now() - this.lastRx > 8000) { this.drop('Your friend stopped answering.'); return; }
          this.send({ k: 'ping', t: performance.now() });
        }, 1000);
      };
      ch.onclose = () => { if (this.ch === ch) this.drop('The connection closed.'); };
      ch.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        this.lastRx = performance.now();
        if (m.k === 'ping') { this.send({ k: 'pong', t: m.t }); return; }
        if (m.k === 'pong') { this.rtt = performance.now() - m.t; return; }
        const f = this.onMessage || (DS.UI && DS.UI.netOnMessage); if (f) try { f(m); } catch (err) { console.error(err); }
      };
    },
    send(m) { const ch = this.ch; if (ch && ch.readyState === 'open') try { ch.send(JSON.stringify(m)); return true; } catch (e) { } return false; },
    drop(why) { if (this.state === 'dropped' || this.state === 'idle') return; clearInterval(this._ping); this._ping = 0; this.setState('dropped', why); },
    close() { this.send({ k: 'bye' }); this.reset(); },
    get open() { return !!(this.ch && this.ch.readyState === 'open'); },
    /* ---------- codes ---------- */
    pack(sdp, t) {
      const line = k => { const m = sdp.match(new RegExp('^a=' + k + ':(.*)$', 'm')); return m ? m[1].trim() : ''; };
      const fp = line('fingerprint').split(' '), c = [];
      for (const m of sdp.matchAll(/^a=candidate:(\S+) (\d) (\S+) (\d+) (\S+) (\d+) typ (\S+)/gm)) {
        if (m[2] !== '1' || m[3].toLowerCase() !== 'udp' || c.length >= 8) continue;
        c.push([m[5], +m[6], m[7], +m[4]]);
      }
      const o = { v: 1, b: DS_BUILD_ID, t, s: line('setup'), u: line('ice-ufrag'), p: line('ice-pwd'), h: fp[0], f: (fp[1] || '').replace(/:/g, ''), c };
      return 'DS1.' + b64u(JSON.stringify(o));
    },
    unpack(code, want) {
      code = String(code || '').replace(/\s+/g, '');
      const at = code.indexOf('DS1.'); if (at < 0) throw new Error('That is not a Dead Swarm code. Copy the whole thing, starting with DS1.');
      let o; try { o = JSON.parse(unb64u(code.slice(at + 4))); } catch (e) { throw new Error('That code is cut off or changed. Copy it again, all of it.'); }
      if (!o || o.v !== 1 || !o.u || !o.p || !o.f) throw new Error('That code is cut off or changed. Copy it again, all of it.');
      if (o.t !== want) throw new Error(want === 'a' ? 'That is your own code. Paste the reply your friend sent back.' : 'That is a reply code. Paste the code from the friend who is hosting.');
      if (o.b !== DS_BUILD_ID) throw new Error('Your friend has a different version of the game. Both of you reload the page from the same link, then try again.');
      if (!o.c || !o.c.length) throw new Error('That code has no address in it. The other browser may be blocking connections.');
      return o;
    },
    sdp(o) {
      const fp = o.f.match(/.{2}/g).join(':').toUpperCase();
      const L = ['v=0', 'o=- ' + (Date.now() % 1e9) + ' 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', 'a=ice-ufrag:' + o.u, 'a=ice-pwd:' + o.p, 'a=ice-options:trickle',
        'a=fingerprint:' + (o.h || 'sha-256') + ' ' + fp, 'a=setup:' + (o.s || (o.t === 'o' ? 'actpass' : 'active')), 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144'];
      o.c.forEach((c, i) => L.push('a=candidate:' + (i + 1) + ' 1 udp ' + c[3] + ' ' + c[0] + ' ' + c[1] + ' typ ' + c[2] + (c[2] === 'host' ? '' : ' raddr 0.0.0.0 rport 0')));
      L.push('a=end-of-candidates');
      return L.join('\r\n') + '\r\n';
    }
  };
})();
