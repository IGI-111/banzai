import IPFS from 'ipfs';
import process from 'process';

export const ipfs = new IPFS({
  repo: `./repo-${process.pid}`,
  config: {
    Addresses: {
      Swarm: [ '/ip4/0.0.0.0/tcp/0' ]
    }
  }
});
