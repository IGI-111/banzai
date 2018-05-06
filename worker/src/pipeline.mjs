import unzipper from 'unzipper';
import sleep from 'sleep';
import request from 'request';
import fs from 'fs';
import promisePipe from 'promisepipe';
// import progressStream from 'progress-stream';
import progressRequest from 'request-progress';
import { ipfs } from './ipfs';
import { getParamsFromBuffer } from './mfcc';

const calls = {
  'FETCH_FESTVOX': async ({ notifyProgress }, url) => {
    const tmpDir = '/tmp/banzai/';
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir);
    }

    const filename = url.substring(url.lastIndexOf('/') + 1);
    const setname = filename.substring(0, filename.indexOf('-'));
    await promisePipe(
      progressRequest(request(url)).on('progress', (progress) => notifyProgress(progress.percent)),
      fs.createWriteStream(`${tmpDir}${filename}`)
    );
    await promisePipe(
      fs.createReadStream(`${tmpDir}${filename}`),
      unzipper.Extract({ path: `${tmpDir}${filename}-extracted` })
    );
    const wavs = fs.readdirSync(`${tmpDir}${filename}-extracted/${setname}/wav`)
      .map(f => `${tmpDir}${filename}-extracted/${setname}/wav/${f}`);

    return Promise.all(wavs.map(async (path, i) => {
      const hash = await ipfsAddFile(path);
      return hash;
    }));
  },

  'FILTER_LONGER': async ({ notifyProgress, input }, threshold) => {
    const wavhashes = await input;
    let done = 0;
    return (await Promise.all(wavhashes.map(wavhash => new Promise(async (resolve, reject) => {
      const filebuf = await ipfsCatHash(wavhash);
      const duration = wavDuration(filebuf);
      notifyProgress(done++ / wavhashes.length);
      resolve(duration >= threshold ? wavhash : undefined);
    })))).filter(h => h !== undefined);
  },

  'FILTER_SHORTER': async ({ notifyProgress, input }, threshold) => {
    const wavhashes = await input;
    let done = 0;
    return (await Promise.all(wavhashes.map(wavhash => new Promise(async (resolve, reject) => {
      const filebuf = await ipfsCatHash(wavhash);
      const duration = wavDuration(filebuf);
      notifyProgress(done++ / wavhashes.length);
      resolve(duration <= threshold ? wavhash : undefined);
    })))).filter(h => h !== undefined);
  },

  'EXTRACT_MFCC': async ({ input, notifyProgress }, fftSize, bankCount, lowFrequency, highFrequency, sampleRate) => {
    const wavhashes = await input;
    const config = {
      fftSize,
      bankCount,
      lowFrequency,
      highFrequency, // samplerate/2 here
      sampleRate
    };

    let done = 0;
    const result = [];
    // FIXME: do one at a time to get linear progress, ideally this should be parallel
    for (const wavhash of wavhashes) {
      const filebuf = await ipfsCatHash(wavhash);
      const params = await getParamsFromBuffer(filebuf, config, 16);
      const mfccBuf = arrayToBuf(params.mfcc);
      const mfccHash = await ipfsAddBuffer(mfccBuf);
      result.push(mfccHash);
      notifyProgress(++done / wavhashes.length);
    }
    return result;
  },

  'LEARN': async ({input, notifyProgress}) => {
    const mfccHashes = await input;

    // do some bogus work
    let done = 0;
    for (const mfccHash of mfccHashes) {
      const mfccBuf = await ipfsCatHash(mfccHash);
      const mfcc = bufToArray(mfccBuf);
      mfcc.forEach(() => {});
      sleep.msleep(1);
      notifyProgress(++done / mfccHashes.length);
    }
    return [];
  }
};

function wavDuration (buffer) {
  const header = buffer.slice(0, 44);

  const subChunkSize = header.slice(40, 44).readUInt32LE();
  const sampleRate = header.slice(24, 28).readUInt32LE();
  const numChannels = header.slice(22, 24).readUInt16LE();
  const bitsPerSample = header.slice(34, 36).readUInt16LE();

  const duration = (subChunkSize / (sampleRate * numChannels * (bitsPerSample / 8)));
  return duration;
}

function arrayToBuf (array) {
  const arr = new Float32Array(array.reduce((a, b) => a.concat(b)));
  const buff = Buffer.alloc(4 * arr.length);
  arr.forEach((value, idx) => {
    buff.writeFloatLE(value, idx * 4);
  });
  return buff;
}

function bufToArray (buf) {
  const res = [];
  for (let i = 0; i < buf.length; i += 4) {
    res.push(buf.readFloatLE(i));
  }
  return res;
}

async function ipfsCatHash (hash) {
  return new Promise((resolve, reject) => {
    ipfs.files.cat(hash, (err, file) => {
      if (err) reject(err);
      resolve(file);
    });
  });
}

async function ipfsAddBuffer (buffer) {
  return new Promise((resolve, reject) => {
    ipfs.files.add(buffer,
      (err, res) => {
        if (err) reject(err);
        resolve(res[0].hash);
      });
  });
}

async function ipfsAddFile (path) {
  const filename = path.substring(path.lastIndexOf('/') + 1);
  return new Promise((resolve, reject) => {
    ipfs.files.add({ path: filename, content: fs.createReadStream(path) },
      (err, res) => {
        if (err) reject(err);
        resolve(res[0].hash);
      });
  });
}

export async function runTask (task, notifyProgress) {
  // FIXME: check task validity
  console.log(`Running (pipeline ${task.pipeline}, task ${task.task}): ${task.call}`);
  const call = calls[task.call];
  const res = await call({
    input: task.input,
    notifyProgress: notifyProgress.bind(undefined, task.pipeline, task.task)
  }, ...task.args);
  console.log(`Finished (pipeline ${task.pipeline}, task ${task.task}): ${task.call}`);
  return res;
}
