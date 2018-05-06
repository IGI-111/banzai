import zmq from 'zeromq';
import { notifyUpdate, formatPipeline } from './index';
import { getCacheValue, setCacheValue } from './cache';

const sender = zmq.socket('push');
const receiver = zmq.socket('pull');

receiver.bindSync('tcp://127.0.0.1:4444');
sender.bindSync('tcp://127.0.0.1:4445');
process.on('SIGINT', function () {
  receiver.close();
  sender.close();
  process.exit();
});
console.log('IO started');

let nextUniqueId = 0;
const pipelinesInFlight = {};

export function listPipelines () {
  return Object.values(pipelinesInFlight);
}

export class Pipeline {
  constructor (tasks) {
    this.tasks = tasks;
    this.next = 0;
    this.progress = new Array(tasks.length).fill(0);
    this.results = new Array(tasks.length);
    this.starts = new Array(tasks.length);
    this.ends = new Array(tasks.length);
    this.errors = new Array(tasks.length);
    this.id = nextUniqueId++;
    pipelinesInFlight[this.id] = this;
  }

  sendNext (input) {
    this.starts[this.next] = new Date();
    this.tasks[this.next].input = input;
    const task = Object.assign({}, this.tasks[this.next]);
    task.pipeline = this.id;
    task.task = this.next;

    const cachedResult = getCacheValue(this.tasks[this.next]);
    if (cachedResult === undefined) {
      console.log(`Sending (pipeline ${this.id}, task ${this.next}): ${task.call}`);
      sender.send(JSON.stringify(task));
      ++this.next;
    } else {
      console.log(`Reusing cached value (pipeline ${this.id}, task ${this.next}): ${task.call}`);
      this.setTaskProgress(this.next, 1);
      this.setTaskResult(this.next, cachedResult);
      ++this.next;
      if (this.isFinished()) {
        console.log(`Pipeline ${this.id} finished: ${cachedResult}`);
      } else {
        this.sendNext(cachedResult);
      }
      notifyUpdate(JSON.stringify(listPipelines().map(formatPipeline)));
    }
  }

  getTasks () {
    return this.tasks;
  }

  getId () {
    return this.id;
  }

  getCurrentTask () {
    return this.next - 1;
  }

  getTaskProgress (task) {
    return this.progress[task];
  }

  getTaskStart (task) {
    return this.starts[task];
  }

  getTaskEnd (task) {
    return this.ends[task];
  }

  setTaskProgress (task, progress) {
    this.progress[task] = progress;
  }

  getTaskResult (task) {
    return this.results[task];
  }

  setTaskResult (task, result) {
    this.ends[task] = new Date();
    this.results[task] = result;
  }

  setTaskError (task, error) {
    this.errors[task] = error;
  }

  getTaskError (task) {
    return this.errors[task];
  }

  isFinished () {
    return this.tasks.length <= this.next;
  }
}

let lastUpdate = new Date();

receiver.on('message', (msg) => {
  const message = JSON.parse(msg);
  const pipeline = pipelinesInFlight[message.pipeline];

  if (pipeline === undefined) {
    console.error(`Unknown pipeline: ${message.pipeline}`);
    return;
  }

  switch (message.type) {
    case 'result':
      pipeline.setTaskProgress(message.task, 1);
      pipeline.setTaskResult(message.task, message.res);
      setCacheValue(pipeline.getTasks()[message.task], message.res);
      if (pipeline.isFinished()) {
        console.log(`Pipeline ${pipeline.id} finished: ${message.res}`);
      } else {
        pipeline.sendNext(message.res);
      }
      break;
    case 'error':
      pipeline.setTaskError(message.task, message.message);
      console.error(`Error on (pipeline ${message.pipeline}, task ${message.task}): ${message.message}`);
      break;
    case 'progress':
      // console.log(`Progress on (pipeline ${message.pipeline}, task ${message.task}): ${message.progress}`);
      pipeline.setTaskProgress(message.task, message.progress);
      break;
    default:
      console.error(`Unknown message type: ${message.type}`);
  }

  // rate limit progress updates to one per second
  if (!(message.type === 'progress' && (new Date() - lastUpdate) < 1000)) {
    notifyUpdate(JSON.stringify(listPipelines().map(formatPipeline)));
    lastUpdate = new Date();
  }
});
