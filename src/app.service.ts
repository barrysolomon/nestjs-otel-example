import { Injectable } from '@nestjs/common';
import { trace, context } from '@opentelemetry/api';
import { log } from './logger.config';
import { URLSearchParams } from 'url';

@Injectable()
export class AppService {
  private traceInterval: NodeJS.Timeout | null = null;

  generateTrace(message: string, customTag: string, operation: string, eventMessage: string) {
    log.info(`Generating trace with message: ${message}`);

    const tracer = trace.getTracer('default');
    const activeSpan = tracer.startSpan(operation, {
      attributes: {
        'custom-tag': customTag,
        'operation': operation,
        'response': message
      }
    });

    // Add event to the span
    activeSpan.addEvent(eventMessage);

    log.info(`📌 Active Span Created - Trace ID: ${activeSpan.spanContext().traceId}`);

    activeSpan.end();
    return activeSpan;
  }

  getHello(queryString?: string): string {
    // Parse query parameters from the URL
    const queryParams = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};

    // Extract values with fallback defaults
    const message = queryParams?.message || 'Goodbye Cruel World!';
    const customTag = queryParams?.customTag || 'tag-value';
    const operation = queryParams?.operation || 'getHello';
    const eventMessage = queryParams?.event || 'CustomEvent: Start returning message';
    const interval = queryParams?.interval ? parseInt(queryParams.interval) : 0;
    const autoGenerate = queryParams?.autoGenerate === 'true';

    // Generate initial trace
    const activeSpan = this.generateTrace(message, customTag, operation, eventMessage);

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
              .auto-generate { margin-top: 20px; padding: 15px; background: #e8f4ff; border-radius: 5px; }
              .auto-generate h3 { margin-top: 0; }
              .status { margin-top: 10px; padding: 10px; border-radius: 5px; }
              .status.active { background: #d4edda; color: #155724; }
              .status.inactive { background: #f8d7da; color: #721c24; }
              .trace-counter { margin-top: 10px; font-weight: bold; }
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

                  <div class="auto-generate">
                      <h3>Auto Generate Traces</h3>
                      <div class="form-group">
                          <label for="interval">Interval (milliseconds):</label>
                          <input type="number" id="interval" value="${interval}" min="100" step="100" />
                      </div>
                      <div class="form-group">
                          <label>
                              <input type="checkbox" id="autoGenerate" ${autoGenerate ? 'checked' : ''} />
                              Enable Auto Generation
                          </label>
                      </div>
                      <div id="status" class="status ${autoGenerate ? 'active' : 'inactive'}">
                          Status: ${autoGenerate ? 'Generating traces every ' + interval + 'ms' : 'Not generating traces'}
                      </div>
                      <div class="trace-counter">
                          Traces Generated: <span id="traceCount">0</span>
                      </div>
                  </div>
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
    let currentInterval = null;
    let traceCount = 0;

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

    async function sendTrace() {
        // Get all the current values
        const message = document.getElementById("message").value;
        const customTag = document.getElementById("customTag").value;
        const operation = document.getElementById("operation").value;
        const event = document.getElementById("event").value;

        // Build the query string
        const queryString = \`message=\${encodeURIComponent(message)}&customTag=\${encodeURIComponent(customTag)}&operation=\${encodeURIComponent(operation)}&event=\${encodeURIComponent(event)}\`;

        try {
            // Make an AJAX call to generate the trace
            const response = await fetch(\`/?\${queryString}\`);
            const html = await response.text();
            
            // Parse the response to get the new trace details
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Update the trace details
            const newTraceId = doc.getElementById("traceId").textContent;
            const newSpanId = doc.getElementById("spanId").textContent;
            const newAttributes = doc.getElementById("attributes").textContent;
            const newEvents = doc.getElementById("events").textContent;
            
            // Update the UI with new values
            document.getElementById("traceId").textContent = newTraceId;
            document.getElementById("spanId").textContent = newSpanId;
            document.getElementById("attributes").textContent = newAttributes;
            document.getElementById("events").textContent = newEvents;
            
            // Update the message display
            document.querySelector('.trace-json').textContent = message;
            
            // Increment and update the trace counter
            traceCount++;
            document.getElementById("traceCount").textContent = traceCount;

            // Log the new trace details
            console.log('New trace generated:', {
                traceId: newTraceId,
                spanId: newSpanId,
                attributes: JSON.parse(newAttributes),
                events: JSON.parse(newEvents)
            });
        } catch (error) {
            console.error('Error generating trace:', error);
        }
    }

    function startAutoGeneration(interval) {
        if (currentInterval) {
            clearInterval(currentInterval);
        }
        currentInterval = setInterval(sendTrace, interval);
    }

    function stopAutoGeneration() {
        if (currentInterval) {
            clearInterval(currentInterval);
            currentInterval = null;
        }
    }

    // Set up auto-generation if enabled
    const autoGenerate = ${autoGenerate};
    const interval = Math.max(${interval}, 30000); // Enforce minimum 30 seconds
    
    if (autoGenerate && interval > 0) {
        startAutoGeneration(interval);
    }

    // Update status when checkbox or interval changes
    document.getElementById("autoGenerate").addEventListener("change", function(e) {
        const status = document.getElementById("status");
        const intervalInput = document.getElementById("interval");
        let interval = parseInt(intervalInput.value);
        
        // Enforce minimum interval of 30 seconds
        if (interval < 30000) {
            interval = 30000;
            intervalInput.value = interval;
            alert("Minimum interval is 30 seconds to prevent excessive trace generation.");
        }
        
        if (e.target.checked && interval > 0) {
            startAutoGeneration(interval);
            status.textContent = \`Status: Generating traces every \${interval/1000} seconds\`;
            status.className = "status active";
        } else {
            stopAutoGeneration();
            status.textContent = "Status: Not generating traces";
            status.className = "status inactive";
        }
    });

    document.getElementById("interval").addEventListener("change", function(e) {
        const status = document.getElementById("status");
        const autoGenerate = document.getElementById("autoGenerate").checked;
        let interval = parseInt(e.target.value);
        
        // Enforce minimum interval of 30 seconds
        if (interval < 30000) {
            interval = 30000;
            e.target.value = interval;
            alert("Minimum interval is 30 seconds to prevent excessive trace generation.");
        }
        
        if (autoGenerate && interval > 0) {
            startAutoGeneration(interval);
            status.textContent = \`Status: Generating traces every \${interval/1000} seconds\`;
        }
    });
</script>

      </body>
      </html>
    `;
  }
}