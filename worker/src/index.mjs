import { runTask } from './pipeline';
import zmq from 'zeromq';
import { ipfs } from './ipfs';

console.log('Starting worker...');

ipfs.on('ready', () => {
  const sender = zmq.socket('push');
  const receiver = zmq.socket('pull');

  receiver.connect('tcp://127.0.0.1:4445');
  sender.connect('tcp://127.0.0.1:4444');
  console.log('Worker started');

  /* Task message:
   *  {
   *    id: 3213
   *    call: 'SOME_CALL',
   *    args: ['arg1', 2],
   *  }
   */

  const running = new Set();

  receiver.on('message', async (msg) => {
    const task = JSON.parse(msg);
    try {
      let res = runTask(task, notifyProgress);
      running.add(task.id);
      res = await res;

      sender.send(JSON.stringify({
        id: task.id,
        type: 'result',
        res
      }));
    } catch (e) {
      sender.send(JSON.stringify({
        id: task.id,
        type: 'error',
        message: e.message
      }));
      console.error(e);
    }
  });

  function notifyProgress (id, progress) {
    sender.send(JSON.stringify({
      id,
      type: 'progress',
      progress
    }));
  }

  process.on('SIGINT', function () {
    receiver.close();
    sender.close();
    process.exit();
  });
});
