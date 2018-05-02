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
  'TEST_FETCH': async ({ notifyProgress }) => {
    return new Promise(async (resolve, reject) => {
      const filename = 'cmu_us_awb_arctic-0.90-release.zip';
      const setname = filename.substring(0, filename.indexOf('-'));
      const wavs = fs.readdirSync(`tmp/${filename}-extracted/${setname}/wav`)
        .map(f => `tmp/${filename}-extracted/${setname}/wav/${f}`);

      let done = 0;
      resolve(await Promise.all(wavs.map((path, i) => {
        return new Promise((resolve, reject) => {
          while (true) {
            try {
              ipfs.files.add({ path: filename, content: fs.createReadStream(path) },
                (err, res) => {
                  if (err) reject(err);
                  notifyProgress(++done / wavs.length);
                  resolve(res[0].hash);
                });
              break;
            } catch (e) {
              console.log(e);
            }
          }
        });
      })));
    });
  },

  'FETCH_FESTVOX': async ({ notifyProgress }, url) => {
    return new Promise(async (resolve, reject) => {
      const filename = url.substring(url.lastIndexOf('/') + 1);
      const setname = filename.substring(0, filename.indexOf('-'));
      await promisePipe(
        progressRequest(request(url)).on('progress', (progress) => notifyProgress(0.6 * progress.percent)),
        fs.createWriteStream(`tmp/${filename}`)
      );
      await promisePipe(
        fs.createReadStream(`tmp/${filename}`),
        unzipper.Extract({ path: `tmp/${filename}-extracted` })
      );
      const wavs = fs.readdirSync(`tmp/${filename}-extracted/${setname}/wav`)
        .map(f => `tmp/${filename}-extracted/${setname}/wav/${f}`);

      let done = 0;
      resolve(await Promise.all(wavs.map((path, i) => {
        return new Promise((resolve, reject) => {
          while (true) {
            try {
              ipfs.files.add({ path: filename, content: fs.createReadStream(path) },
                (err, res) => {
                  if (err) reject(err);
                  notifyProgress(0.6 + 0.3 * (++done / wavs.length));
                  resolve(res[0].hash);
                });
              break;
            } catch (e) {
              console.log(e);
            }
          }
        });
      })));
    });
  },

  'FILTER_LONGER': async ({ notifyProgress, input }, threshold) => {
    const wavhashes = await input;
    let done = 0;
    return (await Promise.all(wavhashes.map(wavhash => new Promise(async (resolve, reject) => {
      const file = await getSingleHashFile(wavhash);
      const duration = wavDuration(file.content);
      notifyProgress(done++ / wavhashes.length);
      resolve(duration >= threshold ? wavhash : undefined);
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
    const result = {};
    // FIXME: do one at a time to get linear progress, ideally this should be parallel
    for (const wavhash of wavhashes) {
      const file = await getSingleHashFile(wavhash);
      const params = await getParamsFromBuffer(file.content, config, 16);
      notifyProgress(++done / wavhashes.length);
      result[wavhash] = params.mfcc;
    }
    return result;
  },
  'LEARN': async ({input}) => {
    const mfccs = await input;

    // do some bogus work
    let count = 0;
    for (const wavhash in mfccs) {
      for (const vals of mfccs[wavhash]) {
        vals.forEach(() => ++count);
      }
    }

    sleep.sleep(1);

    return count;
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

async function getSingleHashFile (hash) {
  return new Promise((resolve, reject) => {
    while (true) {
      try {
        ipfs.files.get(hash, (err, files) => {
          if (err) reject(err);
          resolve(files[0]);
        });
        break;
      } catch (e) {
        console.log(e);
      }
    }
  });
}

export async function runTask (task, notifyProgress) {
  // FIXME: check task validity
  console.log(`Running ${task.id} ${task.call}`);
  const call = calls[task.call];
  const res = await call({
    input: task.input,
    notifyProgress: notifyProgress.bind(undefined, task.id)
  }, ...task.args);
  console.log(`Finished ${task.id} ${task.call}`);
  return res;
}
