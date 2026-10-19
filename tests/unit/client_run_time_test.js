import { expect } from 'chai';
import JsonCycle from 'json-cycle';
import merge from 'lodash.merge';
import TestomatioClient from '../../src/client.js';

describe('Client run_time', () => {
  let client;
  let pipeCalls;

  beforeEach(() => {
    client = new TestomatioClient();
    client.runId = 'test-run-123';
    pipeCalls = [];
    client.pipes = [
      {
        isEnabled: true,
        toString: () => 'FakePipe',
        addTest: async data => {
          pipeCalls.push(data);
        },
      },
    ];
    client.uploader.isEnabled = true;
    client.uploader.uploadFileByPath = async (filePath, s3Path) => `https://bucket.example/${s3Path.join('/')}`;
  });

  it('reports the test duration as run_time', async () => {
    await client.addTestRun('passed', { rid: 'test-rid', title: 'Test', suite_title: 'Suite', time: 1234 });

    expect(pipeCalls).to.have.length(1);
    expect(pipeCalls[0].run_time).to.equal(1234);
  });

  it('parses a string duration', async () => {
    await client.addTestRun('passed', { rid: 'test-rid', title: 'Test', suite_title: 'Suite', time: '12.5' });

    expect(pipeCalls[0].run_time).to.equal(12.5);
  });

  it('keeps a zero duration', async () => {
    await client.addTestRun('passed', { rid: 'test-rid', title: 'Test', suite_title: 'Suite', time: 0 });

    expect(pipeCalls[0].run_time).to.equal(0);
  });

  // Playwright's onEnd (and the codecept / upload-artifacts paths) re-send a test run only to attach
  // artifacts, without a time. Sending run_time: 0 there overwrote the duration of the result.
  it('does not send run_time for an artifacts-only follow-up', async () => {
    await client.addTestRun('passed', { rid: 'test-rid', title: 'Test', suite_title: 'Suite', time: 1234 });
    await client.addTestRun(undefined, {
      rid: 'test-rid',
      title: 'Test',
      files: [{ path: 'output/video.webm', type: 'video/webm' }],
    });

    expect(pipeCalls).to.have.length(2);
    expect(pipeCalls[1].run_time).to.be.undefined;
    expect(JsonCycle.stringify(pipeCalls[1])).not.to.include('run_time');
    expect(merge({}, pipeCalls[0], pipeCalls[1]).run_time).to.equal(1234);
  });
});
