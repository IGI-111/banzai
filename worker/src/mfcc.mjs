import SPE from 'sound-parameters-extractor';
import wav from 'node-wav';
import fft from 'fft-js';

const {
  modulusFFT,
  zeroCrossingRateClipping,
  spectralRollOffPoint,
  spectralCentroid,
  spectralCentroidSRF,
  remarkableEnergyRate
} = SPE.parameters;
const framer = SPE.framer;
const mfcc = SPE.mfcc;

const computeMFCC_ = (signal, config, mfccSize) => {
  const mfccCust = mfcc.construct(config, mfccSize);
  return signal.map(frame => {
    const phasors = fft.fft(frame);
    return mfccCust(fft.util.fftMag(phasors));
  });
};

const computeFFT_ = signal => {
  return signal.map(frame => {
    return modulusFFT(fft.fft(frame), true);
  });
};

export function getParamsFromBuffer (buffer, config, mfccSize, cfgParam = {}) {
  cfgParam = {
    overlap: cfgParam.overlap || '50%',
    cutoff: cfgParam.cutoff || '85%'
  };
  const params = {};
  const decoded = wav.decode(buffer);
  params.arrayDecoded = Array.from(decoded.channelData[0]);
  params.framedSound = framer(params.arrayDecoded, config.fftSize * 2,
    cfgParam.overlap);

  params.rer =
    remarkableEnergyRate(params.arrayDecoded, params.framedSound);
  params.zcr =
    params.framedSound.map(frame => zeroCrossingRateClipping(frame));
  params.mfcc = computeMFCC_(params.framedSound, config, mfccSize);
  params.fft = computeFFT_(params.framedSound);
  params.sc = params.fft.map(frame => spectralCentroid(frame));
  params.sc2 =
    params.fft.map(frame => spectralCentroidSRF(frame, config.sampleRate));
  params.srf =
    params.fft.map(
      frame => spectralRollOffPoint(frame, config.sampleRate,
        cfgParam.cutoff));
  return params;
}
