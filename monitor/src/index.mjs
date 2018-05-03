import express from 'express';
import bodyParser from 'body-parser';
import { Pipeline, listPipelines } from './io';
import cors from 'cors';

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Create new pipeline
app.post('/pipeline', (req, res) => {
  // FIXME: do input validation of tasks
  const tasks = req.body;
  const pipeline = new Pipeline(tasks);
  pipeline.sendNext();
  res.json(pipeline.getId());
});

// List existing pipelines
app.get('/pipeline', (req, res) => {
  const pipelines = listPipelines();
  const out = pipelines.map(pipeline => {
    return {
      id: pipeline.getId(),
      tasks: pipeline.getTasks().map(
        (task, i) => Object.assign(task, {
          progress: pipeline.getTaskProgress(i),
          result: pipeline.getTaskResult(i),
          active: pipeline.getCurrentTask() === i
        }))
    };
  });
  res.json(out);
});

// List possible tasks
app.get('/taskTemplate', (req, res) => {

});

const APIPort = 4000;
app.listen(APIPort, () => console.log(`API Listening on port ${APIPort}`));

// [{"call":"FETCH_FESTVOX","args":["http://festvox.org/cmu_arctic/cmu_arctic/packed/cmu_us_awb_arctic-0.90-release.zip"]},{"call":"FILTER_LONGER","args":[5]},{"call":"EXTRACT_MFCC","args":[32,24,1,8000,16000]},{"call":"LEARN","args":[]}]
