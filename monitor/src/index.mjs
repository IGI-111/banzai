import zmq from 'zeromq';

const sender = zmq.socket('push');
const receiver = zmq.socket('pull');

receiver.bindSync('tcp://127.0.0.1:4444');
sender.bindSync('tcp://127.0.0.1:4445');

process.on('SIGINT', function () {
  receiver.close();
  sender.close();
  process.exit();
});

console.log('Monitor started');

class Pipeline {
  constructor (tasks) {
    this.tasks = tasks;
    this.next = 0;
  }
  sendFirst () {
    const task = this.tasks[this.next];
    console.log(`Sending ${task.id} ${task.call}`);
    sender.send(JSON.stringify(task));
    ++this.next;
  }
  sendNext (input) {
    const task = this.tasks[this.next];
    task.input = input;
    console.log(`Sending ${task.id} ${task.call}`);
    sender.send(JSON.stringify(task));
    ++this.next;
  }
  isFinished () {
    return this.tasks.length <= this.next;
  }
}

const pipeline = new Pipeline([
  // { id: 0, call: 'TEST_FETCH', args: [] },
  { id: 0, call: 'FETCH_FESTVOX', args: [ 'http://festvox.org/cmu_arctic/cmu_arctic/packed/cmu_us_awb_arctic-0.90-release.zip' ] },
  { id: 1, call: 'FILTER_LONGER', args: [5] },
  { id: 2, call: 'EXTRACT_MFCC', args: [ 32, 24, 1, 8000, 16000 ] },
  { id: 3, call: 'LEARN', args: [] }
]);
pipeline.sendFirst();

receiver.on('message', (msg) => {
  const message = JSON.parse(msg);
  switch (message.type) {
    case 'result':
      if (pipeline.isFinished()) {
        console.log(`Pipeline finished: ${message.res}`);
      } else {
        pipeline.sendNext(message.res);
      }
      break;
    case 'error':
      console.error(`Error on task ${message.id}: ${message.message}`);
      break;
    case 'progress':
      console.log(`Progress on task ${message.id}: ${message.progress}`);
      break;
    default:
      console.error(`Unknown message type: ${message.type}`);
  }
});
