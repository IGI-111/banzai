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

  const tasksInFlight = [];

  receiver.on('message', async (msg) => {
    const task = JSON.parse(msg);
    try {
      let res = runTask(task, notifyProgress);
      tasksInFlight.push([task.pipeline, task.task]);
      res = await res;

      sender.send(JSON.stringify({
        pipeline: task.pipeline,
        task: task.task,
        type: 'result',
        res
      }));
      tasksInFlight.splice(
        tasksInFlight.findIndex(
          ([pipeline, task]) => pipeline === task.pipeline && task === task.task),
        1);
    } catch (e) {
      console.error(e);
      notifyError(task.pipeline, task.task, e.message);
    }
  });

  function notifyProgress (pipeline, task, progress) {
    sender.send(JSON.stringify({
      pipeline,
      task,
      type: 'progress',
      progress
    }));
  }

  function notifyError (pipeline, task, message) {
    sender.send(JSON.stringify({
      pipeline,
      task,
      type: 'error',
      message: message
    }));
  }

  process.on('SIGINT', function () {
    for (const [pipeline, task] of tasksInFlight) {
      notifyError(pipeline, task, 'Process shut down unexpectedly.');
    }

    receiver.close();
    sender.close();
    process.exit();
  });
});
