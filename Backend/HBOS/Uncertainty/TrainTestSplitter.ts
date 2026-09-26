/**
 * Stage 07-F - Train/Test Splitter
 *
 * Strict chronological split. The first `ratio` fraction of the
 * chronologically-sorted data is training; the remainder is test.
 *
 * NO-FUTURE-LEAKAGE PROPERTY:
 *   - The training set ALWAYS precedes the test set in time.
 *   - The split is verified to be chronologically non-decreasing.
 *   - Random shuffling is explicitly forbidden.
 *
 * IMPORTANT:
 *   - Caller is responsible for passing chronologically sorted data.
 *   - Unsorted data is rejected with a clear error.
 *   - The split is deterministic.
 *   - Tenant + metric names must be consistent across all points.
 */

import { TrainingDataPoint, TrainTestSplit } from "./MLTypes";

const MIN_TRAINING_SAMPLES = 1;

export const TrainTestSplitter = {
    splitChronological(data: ReadonlyArray<TrainingDataPoint>, ratio: number): TrainTestSplit {
        if (!data || data.length === 0) {
            throw new Error("invalid_request: data is empty");
        }
        if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) {
            throw new Error(`invalid_request: ratio must satisfy 0 < ratio < 1; got ${ratio}`);
        }

        for (let i = 1; i < data.length; i++) {
            const prev = new Date(data[i - 1].timestamp).getTime();
            const curr = new Date(data[i].timestamp).getTime();
            if (Number.isNaN(prev) || Number.isNaN(curr)) {
                throw new Error(`invalid_request: non-parseable timestamp at index ${i}`);
            }
            if (curr < prev) {
                throw new Error(
                    `invalid_request: data is not chronologically sorted at index ${i} ` +
                    `(prev=${data[i - 1].timestamp}, curr=${data[i].timestamp}). ` +
                    `Random shuffling is not supported by chronological split.`
                );
            }
        }

        const tenant = data[0].tenantId;
        const metric = data[0].metricName;
        for (let i = 0; i < data.length; i++) {
            const p = data[i];
            if (p.tenantId !== tenant) {
                throw new Error(`invalid_request: tenant mismatch (${p.tenantId} vs ${tenant}) at index ${i}`);
            }
            if (p.metricName !== metric) {
                throw new Error(`invalid_request: metric mismatch (${p.metricName} vs ${metric}) at index ${i}`);
            }
        }

        const n = data.length;
        const nTrain = Math.max(MIN_TRAINING_SAMPLES, Math.floor(n * ratio));
        const nTest = n - nTrain;
        if (nTest < 1) {
            throw new Error(
                `invalid_request: ratio=${ratio} produces n_test=0 on n=${n}; ` +
                `use a smaller ratio or supply more data`
            );
        }

        const trainingData = data.slice(0, nTrain);
        const testData = data.slice(nTrain, n);
        const boundaryTimestamp = trainingData[trainingData.length - 1].timestamp;

        const firstTestTs = new Date(testData[0].timestamp).getTime();
        const lastTrainTs = new Date(boundaryTimestamp).getTime();
        const noFutureLeakage = firstTestTs >= lastTrainTs;

        return Object.freeze({
            trainingData: Object.freeze(trainingData.slice()),
            testData: Object.freeze(testData.slice()),
            splitRatio: ratio,
            trainingCount: nTrain,
            testCount: nTest,
            boundaryTimestamp,
            noFutureLeakage
        });
    }
};
