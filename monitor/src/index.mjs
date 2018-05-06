import express from 'express';
import bodyParser from 'body-parser';
import { Pipeline, listPipelines } from './io';
import cors from 'cors';
import expressWS from 'express-ws';

const app = express();
app.use(bodyParser.json());
app.use(cors());
const wsInstance = expressWS(app);

// Create new pipeline
app.post('/pipeline', (req, res) => {
  // FIXME: do input validation of tasks
  try {
    const tasks = req.body;
    const pipeline = new Pipeline(tasks);
    pipeline.sendNext();
    res.json(pipeline.getId());
  } catch (e) {
    res.status(400);
    res.send(e);
  }
});

// List existing pipelines
app.get('/pipeline', (req, res) => {
  const out = listPipelines().map(formatPipeline);
  res.json(out);
});

// Websocket to notify of updates
app.ws('/live/pipeline', (ws, req) => {
  ws.send(JSON.stringify(listPipelines().map(formatPipeline)));
});

export function notifyUpdate (payload) {
  for (const client of wsInstance.getWss().clients) {
    client.send(payload);
  }
}

export function formatPipeline (pipeline) {
  return {
    id: pipeline.getId(),
    tasks: pipeline.getTasks().map(
      (task, i) => Object.assign(task, {
        progress: pipeline.getTaskProgress(i),
        error: pipeline.getTaskError(i),
        result: pipeline.getTaskResult(i),
        active: pipeline.getCurrentTask() === i,
        start: pipeline.getTaskStart(i),
        end: pipeline.getTaskEnd(i)
      }))
  };
}

const APIPort = 4000;
app.listen(APIPort, () => console.log(`API Listening on port ${APIPort}`));

// [{"call":"FETCH_FESTVOX","args":["http://festvox.org/cmu_arctic/cmu_arctic/packed/cmu_us_awb_arctic-0.90-release.zip"]},{"call":"FILTER_LONGER","args":[5]},{"call":"EXTRACT_MFCC","args":[32,24,1,8000,16000]},{"call":"LEARN","args":[]}]
