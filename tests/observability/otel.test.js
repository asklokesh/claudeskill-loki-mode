'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('otel.js - OpenTelemetry core module', () => {
  let otel;
  const ORIGINAL_ENV = process.env.LOKI_OTEL_ENDPOINT;

  beforeEach(() => {
    // Clear module cache so each test gets a fresh module
    delete require.cache[require.resolve('../../src/observability/otel')];
    delete require.cache[require.resolve('../../src/observability/index')];
    // Set endpoint for tests that need it
    process.env.LOKI_OTEL_ENDPOINT = 'http://localhost:4318';
  });

  afterEach(() => {
    if (otel && otel.isInitialized()) {
      otel.shutdown();
    }
    // Restore original env
    if (ORIGINAL_ENV) {
      process.env.LOKI_OTEL_ENDPOINT = ORIGINAL_ENV;
    } else {
      delete process.env.LOKI_OTEL_ENDPOINT;
    }
  });

  describe('initialization', () => {
    it('should initialize when LOKI_OTEL_ENDPOINT is set', () => {
      otel = require('../../src/observability/otel');
      otel.initialize();
      assert.equal(otel.isInitialized(), true);
      assert.ok(otel.tracerProvider, 'tracerProvider should be set');
      assert.ok(otel.meterProvider, 'meterProvider should be set');
    });

    it('should throw when LOKI_OTEL_ENDPOINT is not set', () => {
      delete process.env.LOKI_OTEL_ENDPOINT;
      otel = require('../../src/observability/otel');
      assert.throws(() => otel.initialize(), /LOKI_OTEL_ENDPOINT is not set/);
    });

    it('should not double-initialize', () => {
      otel = require('../../src/observability/otel');
      otel.initialize();
      // Second call should be a no-op, not throw
      otel.initialize();
      assert.equal(otel.isInitialized(), true);
    });

    it('should shutdown cleanly', () => {
      otel = require('../../src/observability/otel');
      otel.initialize();
      otel.shutdown();
      assert.equal(otel.isInitialized(), false);
      assert.equal(otel.tracerProvider, null);
      assert.equal(otel.meterProvider, null);
    });
  });

  describe('lazy loading - zero overhead when disabled', () => {
    it('should have zero overhead when importing index.js without endpoint', () => {
      delete process.env.LOKI_OTEL_ENDPOINT;
      delete require.cache[require.resolve('../../src/observability/index')];
      delete require.cache[require.resolve('../../src/observability/otel')];
      delete require.cache[require.resolve('../../src/observability/spans')];
      delete require.cache[require.resolve('../../src/observability/metrics')];

      const start = process.hrtime.bigint();
      const obs = require('../../src/observability/index');
      const end = process.hrtime.bigint();
      const importTimeMs = Number(end - start) / 1_000_000;

      assert.equal(obs.isEnabled(), false);
      assert.equal(typeof obs.trace.startProjectSpan, 'function');

      // Verify otel.js was NOT loaded (not in require.cache)
      const otelCached = require.cache[require.resolve('../../src/observability/otel')];
      assert.equal(otelCached, undefined, 'otel.js should not be loaded when OTEL is disabled');

      console.log(`  Import time without OTEL: ${importTimeMs.toFixed(2)}ms`);
    });

    it('should return no-op span from trace functions when disabled', () => {
      delete process.env.LOKI_OTEL_ENDPOINT;
      delete require.cache[require.resolve('../../src/observability/index')];

      const obs = require('../../src/observability/index');
      const span = obs.trace.startProjectSpan('test');

      assert.equal(span.traceId, '00000000000000000000000000000000');
      assert.equal(typeof span.end, 'function');
      assert.equal(typeof span.setAttribute, 'function');

      // Calling no-op methods should not throw
      span.setAttribute('key', 'value');
      span.setStatus(1);
      span.end();
    });

    it('should return no-op metrics functions when disabled', () => {
      delete process.env.LOKI_OTEL_ENDPOINT;
      delete require.cache[require.resolve('../../src/observability/index')];

      const obs = require('../../src/observability/index');

      // All metric functions should be callable without error
      obs.metrics.recordTaskDuration(1.5);
      obs.metrics.recordQualityGateResult('test', true);
      obs.metrics.setActiveAgents(5);
      obs.metrics.recordTokensConsumed(100, 'opus', 'review');
      obs.metrics.setCouncilApprovalRate(0.9);
      obs.metrics.flushMetrics();
    });
  });

  describe('Span', () => {
    it('should generate valid trace and span IDs', () => {
      otel = require('../../src/observability/otel');
      const traceId = otel.generateTraceId();
      const spanId = otel.generateSpanId();

      assert.equal(traceId.length, 32, 'traceId should be 32 hex chars');
      assert.equal(spanId.length, 16, 'spanId should be 16 hex chars');
      assert.match(traceId, /^[0-9a-f]{32}$/);
      assert.match(spanId, /^[0-9a-f]{16}$/);
    });

    it('should create a span with attributes', () => {
      otel = require('../../src/observability/otel');
      const span = new otel.Span('test-span', null, null, { 'test.key': 'value' });

      assert.equal(span.name, 'test-span');
      assert.equal(span.attributes['test.key'], 'value');
      assert.ok(span.traceId, 'should have a traceId');
      assert.ok(span.spanId, 'should have a spanId');
      assert.equal(span.parentSpanId, '');
    });

    it('should generate valid traceparent header', () => {
      otel = require('../../src/observability/otel');
      const span = new otel.Span('test-span');
      const traceparent = span.traceparent();

      assert.match(
        traceparent,
        /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/,
        'traceparent should follow W3C Trace Context format'
      );
    });

    it('should set status correctly', () => {
      otel = require('../../src/observability/otel');
      const span = new otel.Span('test-span');

      span.setStatus(otel.SpanStatusCode.ERROR, 'Something went wrong');
      assert.equal(span.status.code, otel.SpanStatusCode.ERROR);
      assert.equal(span.status.message, 'Something went wrong');
    });

    it('should serialize to valid OTLP JSON', () => {
      otel = require('../../src/observability/otel');
      const span = new otel.Span('test-span', null, null, {
        'string.attr': 'hello',
        'int.attr': 42,
        'double.attr': 3.14,
        'bool.attr': true,
      });
      span.end();

      const otlp = span.toOTLP();

      assert.equal(otlp.name, 'test-span');
      assert.ok(otlp.traceId);
      assert.ok(otlp.spanId);
      assert.ok(otlp.startTimeUnixNano);
      assert.ok(otlp.endTimeUnixNano);
      assert.equal(otlp.kind, 1); // INTERNAL

      // Check attributes
      const attrs = {};
      for (const a of otlp.attributes) {
        if (a.value.stringValue !== undefined) attrs[a.key] = a.value.stringValue;
        else if (a.value.intValue !== undefined) attrs[a.key] = a.value.intValue;
        else if (a.value.doubleValue !== undefined) attrs[a.key] = a.value.doubleValue;
        else if (a.value.boolValue !== undefined) attrs[a.key] = a.value.boolValue;
      }
      assert.equal(attrs['string.attr'], 'hello');
      assert.equal(attrs['int.attr'], '42');
      assert.equal(attrs['double.attr'], 3.14);
      assert.equal(attrs['bool.attr'], true);
    });

    it('should not end twice', () => {
      otel = require('../../src/observability/otel');
      otel.initialize();
      const span = new otel.Span('test-span');
      span.end();
      const firstEnd = span.endTimeUnixNano;
      span.end();
      assert.equal(span.endTimeUnixNano, firstEnd, 'endTimeUnixNano should not change on double end');
    });
  });

  describe('Counter', () => {
    it('should increment correctly', () => {
      otel = require('../../src/observability/otel');
      const counter = new otel.Counter('test_counter', 'test', '{count}');
      counter.add(5);
      counter.add(3);
      assert.equal(counter.get(), 8);
    });

    it('should support labeled values', () => {
      otel = require('../../src/observability/otel');
      const counter = new otel.Counter('test_counter');
      counter.add(2, { method: 'GET' });
      counter.add(3, { method: 'POST' });
      counter.add(1, { method: 'GET' });
      assert.equal(counter.get({ method: 'GET' }), 3);
      assert.equal(counter.get({ method: 'POST' }), 3);
    });

    it('should not accept negative values', () => {
      otel = require('../../src/observability/otel');
      const counter = new otel.Counter('test_counter');
      counter.add(5);
      counter.add(-3);
      assert.equal(counter.get(), 5);
    });

    it('should serialize to OTLP format', () => {
      otel = require('../../src/observability/otel');
      const counter = new otel.Counter('test_counter', 'A test', '{count}');
      counter.add(10);
      const otlp = counter.toOTLP();
      assert.equal(otlp.name, 'test_counter');
      assert.equal(otlp.description, 'A test');
      assert.ok(otlp.sum);
      assert.equal(otlp.sum.isMonotonic, true);
      assert.equal(otlp.sum.aggregationTemporality, 2);
    });
  });

  describe('Gauge', () => {
    it('should set and get values', () => {
      otel = require('../../src/observability/otel');
      const gauge = new otel.Gauge('test_gauge');
      gauge.set(42);
      assert.equal(gauge.get(), 42);
      gauge.set(10);
      assert.equal(gauge.get(), 10);
    });

    it('should support labeled values', () => {
      otel = require('../../src/observability/otel');
      const gauge = new otel.Gauge('test_gauge');
      gauge.set(5, { host: 'a' });
      gauge.set(10, { host: 'b' });
      assert.equal(gauge.get({ host: 'a' }), 5);
      assert.equal(gauge.get({ host: 'b' }), 10);
    });
  });

  describe('Histogram', () => {
    it('should record values and compute buckets', () => {
      otel = require('../../src/observability/otel');
      const hist = new otel.Histogram('test_hist', 'test', 's', [1, 5, 10]);
      hist.record(0.5);
      hist.record(3);
      hist.record(7);
      hist.record(15);

      const values = hist.get();
      assert.equal(values.length, 4);

      const otlp = hist.toOTLP();
      assert.ok(otlp.histogram);
      const dp = otlp.histogram.dataPoints[0];
      // Bucket counts: [<=1, <=5, <=10, >10] = [1, 1, 1, 1]
      assert.deepEqual(dp.bucketCounts, ['1', '1', '1', '1']);
      assert.equal(dp.count, '4');
      assert.equal(dp.sum, 0.5 + 3 + 7 + 15);
    });

    it('should support labeled values', () => {
      otel = require('../../src/observability/otel');
      const hist = new otel.Histogram('test_hist', 'test', 's', [1, 5]);
      hist.record(0.5, { method: 'GET' });
      hist.record(3, { method: 'POST' });

      assert.equal(hist.get({ method: 'GET' }).length, 1);
      assert.equal(hist.get({ method: 'POST' }).length, 1);
    });
  });

  describe('OTLPExporter', () => {
    it('should collect spans and prepare payload on flush', () => {
      otel = require('../../src/observability/otel');
      const exporter = new otel.OTLPExporter('http://localhost:4318');

      const span = new otel.Span('test-span');
      span.end();
      exporter.addSpan(span);

      const payload = exporter.flush();
      assert.ok(payload);
      assert.ok(payload.resourceSpans);
      assert.equal(payload.resourceSpans[0].scopeSpans[0].spans.length, 1);
      assert.equal(payload.resourceSpans[0].scopeSpans[0].spans[0].name, 'test-span');

      exporter.shutdown();
    });

    it('should prepare metrics payload', () => {
      otel = require('../../src/observability/otel');
      const exporter = new otel.OTLPExporter('http://localhost:4318');
      const counter = new otel.Counter('test_counter', 'test');
      counter.add(5);

      const payload = exporter.flushMetrics([counter]);
      assert.ok(payload);
      assert.ok(payload.resourceMetrics);
      assert.equal(payload.resourceMetrics[0].scopeMetrics[0].metrics.length, 1);

      exporter.shutdown();
    });

    it('should not fail on flush with no spans', () => {
      otel = require('../../src/observability/otel');
      const exporter = new otel.OTLPExporter('http://localhost:4318');
      // Should not throw
      exporter.flush();
      exporter.shutdown();
    });
  });
});
