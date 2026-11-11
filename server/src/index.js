// The crew relay: a Cloudflare Worker with one Durable Object per room code. It holds no game
// state. The first socket to open a room is the host (the crew chief, whose browser runs the
// Session); everyone after that is crew. Crew messages go to the host, tagged with who sent
// them; the host's messages go to the crew (all of them, or one by `to`).
//
//   GET /room/ABCD?role=host   open room ABCD and be its host
//   GET /room/ABCD             join room ABCD as crew
//
// Messages are JSON text. The relay adds { t: 'joined' | 'left', pid } for the host, and
// { t: 'hello', pid } / { t: 'hostLeft' } / { t: 'refused', why } for the crew.

const MAX_CREW = 4;
const CODE = /^[A-Z]{4}$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/room\/([A-Za-z]{4})$/);
    if (!m) return new Response('Night Receivers crew relay. Connect to /room/CODE.', { status: url.pathname === '/' ? 200 : 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426 });
    const code = m[1].toUpperCase();
    if (!CODE.test(code)) return new Response('bad code', { status: 400 });
    const stub = env.LOBBY.get(env.LOBBY.idFromName(code));
    return stub.fetch(req);
  },
};

export class Lobby {
  constructor(state) {
    this.state = state;
    this.host = null; // WebSocket
    this.crew = new Map(); // pid -> WebSocket
  }

  async fetch(req) {
    const url = new URL(req.url);
    const role = url.searchParams.get('role') === 'host' ? 'host' : 'crew';
    const pair = new WebSocketPair();
    const [client, ws] = Object.values(pair);
    ws.accept();

    const refuse = (why) => {
      ws.send(JSON.stringify({ t: 'refused', why }));
      ws.close(4000, why);
      return new Response(null, { status: 101, webSocket: client });
    };

    if (role === 'host') {
      if (this.host) return refuse('taken');
      this.host = ws;
      ws.addEventListener('message', (e) => this.fromHost(e.data));
      const bye = () => {
        if (this.host !== ws) return;
        this.host = null;
        for (const c of this.crew.values()) {
          try {
            c.send(JSON.stringify({ t: 'hostLeft' }));
            c.close(4001, 'host left');
          } catch {
            /* already gone */
          }
        }
        this.crew.clear();
      };
      ws.addEventListener('close', bye);
      ws.addEventListener('error', bye);
      ws.send(JSON.stringify({ t: 'hello', pid: 'p1', host: true }));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (!this.host) return refuse('noRoom');
    if (this.crew.size >= MAX_CREW - 1) return refuse('full');
    let pid = null;
    for (let k = 2; k <= MAX_CREW && !pid; k++) if (!this.crew.has(`p${k}`)) pid = `p${k}`;
    this.crew.set(pid, ws);
    ws.addEventListener('message', (e) => this.toHost({ t: 'from', pid, m: e.data }));
    const bye = () => {
      if (this.crew.get(pid) !== ws) return;
      this.crew.delete(pid);
      this.toHost({ t: 'left', pid });
    };
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
    ws.send(JSON.stringify({ t: 'hello', pid, host: false }));
    this.toHost({ t: 'joined', pid, name: (url.searchParams.get('name') || '').slice(0, 24) });
    return new Response(null, { status: 101, webSocket: client });
  }

  toHost(msg) {
    try {
      // crew messages are passed through as text inside the envelope (the host parses them)
      this.host?.send(JSON.stringify(msg));
    } catch {
      /* host gone; its close handler tidies up */
    }
  }

  fromHost(data) {
    // the host addresses one crew member with { to: pid, ... }; otherwise it is for everyone
    let to = null;
    if (data.startsWith('{"to":"')) to = data.slice(7, data.indexOf('"', 7));
    for (const [pid, c] of this.crew) {
      if (to && pid !== to) continue;
      try {
        c.send(data);
      } catch {
        /* closed */
      }
    }
  }
}
