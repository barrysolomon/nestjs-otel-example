import { Injectable } from '@nestjs/common';
import { trace, context } from '@opentelemetry/api';
import { log } from './logger.config';
import { URLSearchParams } from 'url';

@Injectable()
export class AppService {

  getHello(queryString?: string): string {
    // Parse query parameters from the URL
    const queryParams = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};

    // Extract values with fallback defaults
    const message = queryParams?.message || 'Goodbye Cruel World!';
    const customTag = queryParams?.customTag || 'tag-value';
    const operation = queryParams?.operation || 'getHello';
    const eventMessage = queryParams?.event || 'CustomEvent: Start returning message';

    log.info(`getHello() called with message: ${message}`);

    const tracer = trace.getTracer('default');
    const activeSpan = tracer.startSpan(operation);

    // Set attributes and events on the span
    activeSpan.setAttribute('custom-tag', customTag);
    activeSpan.setAttribute('operation', operation);
    activeSpan.setAttribute('response', message);
    activeSpan.addEvent(eventMessage);

    log.info(`📌 Active Span Created - Trace ID: ${activeSpan.spanContext().traceId}`);

    activeSpan.end();

    // Function to retrieve span attributes and events safely
    const getAttributes = (span: any) => (span?.attributes ? JSON.stringify(span.attributes, null, 2) : '{}');
    const getEvents = (span: any) => (span?.events ? JSON.stringify(span.events, null, 2) : '[]');

    // ✅ Generate HTML response with UI
    return `
      <html>
      <head>
          <title>Trace Editor</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; display: flex; height: 100vh; }
              .split-container { display: flex; width: 100%; height: 100%; }
              .left-pane { width: 30%; background: #f0f0f0; padding: 20px; overflow-y: auto; border-right: 2px solid #ccc; }
              .right-pane { width: 70%; padding: 20px; overflow-y: auto; background: white; }
              .form-group { margin-bottom: 15px; }
              .form-group label { font-weight: bold; display: block; }
              .trace-json { font-family: monospace; background: #eef; padding: 10px; border-radius: 5px; white-space: pre-wrap; }
              button { padding: 8px 12px; background: #007bff; color: white; border: none; cursor: pointer; margin-right: 10px; }
              button:hover { background: #0056b3; }
          </style>
      </head>
      <body>
          <div class="split-container">
              <!-- Left Panel: Form Inputs -->
              <div class="left-pane">
                  <h2>Modify Trace Data</h2>
                  <div class="form-group">
                      <label for="message">Message:</label>
                      <input type="text" id="message" value="${message}" />
                  </div>
                  <div class="form-group">
                      <label for="customTag">Custom Tag:</label>
                      <input type="text" id="customTag" value="${customTag}" />
                  </div>
                  <div class="form-group">
                      <label for="operation">Operation:</label>
                      <input type="text" id="operation" value="${operation}" />
                  </div>
                  <div class="form-group">
                      <label for="event">Event Message:</label>
                      <input type="text" id="event" value="${eventMessage}" />
                  </div>
                  <button onclick="updateTraceUI()">Update Trace</button>
                  <button onclick="sendTrace()">Send Trace</button>
              </div>

              <!-- Right Panel: Trace Details -->
              <div class="right-pane">
                  <h2>OpenTelemetry Trace Details</h2>
                  <div>
                      <strong>Trace ID:</strong> <span id="traceId">${activeSpan.spanContext().traceId}</span>
                  </div>
                  <div>
                      <strong>Span ID:</strong> <span id="spanId">${activeSpan.spanContext().spanId}</span>
                  </div>
                  <div>
                      <strong>Message:</strong> <pre class="trace-json">${message}</pre>
                  </div>
                  <div>
                      <strong>Attributes:</strong>
                      <pre id="attributes" class="trace-json">${getAttributes(activeSpan)}</pre>
                  </div>
                  <div>
                      <strong>Event:</strong>
                      <pre id="events" class="trace-json">${getEvents(activeSpan)}</pre>
                  </div>
              </div>
          </div>

<script>
    function updateTraceUI() {
        const newMessage = document.getElementById("message").value;
        const newCustomTag = document.getElementById("customTag").value;
        const newOperation = document.getElementById("operation").value;
        const newEvent = document.getElementById("event").value;

        const attributes = {
            "custom-tag": newCustomTag,
            "operation": newOperation,
            "response": newMessage
        };

        const events = [{ name: newEvent }];

        document.getElementById("attributes").textContent = JSON.stringify(attributes, null, 2);
        document.getElementById("events").textContent = JSON.stringify(events, null, 2);
    }

    function sendTrace() {
        // Get the user-modified values
        const message = encodeURIComponent(document.getElementById("message").value);
        const customTag = encodeURIComponent(document.getElementById("customTag").value);
        const operation = encodeURIComponent(document.getElementById("operation").value);
        const event = encodeURIComponent(document.getElementById("event").value);

        // Preserve modified values in the URL to avoid resetting
        const newUrl = \`/?message=${message}&customTag=${customTag}&operation=${operation}\`;
        
        // Reload with updated query parameters
        window.location.href = newUrl;
    }
</script>

      </body>
      </html>
    `;
  }
}