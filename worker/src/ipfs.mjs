import IPFS from 'ipfs';

export const ipfs = new IPFS({
  EXPERIMENTAL: {
    pubsub: true,
    sharding: true,
    dht: true
  },
  repo: `./repo-${Math.random().toString(36).substr(2, 5)}`,
  config: {
    Addresses: {
      Swarm: [
        '/ip4/0.0.0.0/tcp/0',
        '/ip4/127.0.0.1/tcp/0/ws',
        '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
      ]
    }
  }
});
