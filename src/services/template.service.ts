import { Injectable } from '@nestjs/common';

@Injectable()
export class TemplateService {
  /**
   * Generates the HTML UI for the trace editor
   */
  generateTraceEditorUI(
    traceId: string,
    spanId: string,
    message: string, 
    customTag: string, 
    operation: string, 
    eventMessage: string,
    attributes: string,
    events: string,
    interval: number,
    autoGenerate: boolean,
    logMessage: string,
    logSeverity: string
  ): string {
    return '<html>' +
      '<head>' +
          '<title>Trace Editor</title>' +
          '<style>' +
              'body { font-family: Arial, sans-serif; margin: 0; padding: 0; display: flex; height: 100vh; }' +
              '.split-container { display: flex; width: 100%; height: 100%; }' +
              '.left-pane { width: 30%; background: #f0f0f0; padding: 20px; overflow-y: auto; border-right: 2px solid #ccc; }' +
              '.right-pane { width: 70%; padding: 20px; overflow-y: auto; background: white; }' +
              '.form-group { margin-bottom: 15px; }' +
              '.form-group label { font-weight: bold; display: block; }' +
              '.trace-json { font-family: monospace; background: #eef; padding: 10px; border-radius: 5px; white-space: pre-wrap; }' +
              'button { padding: 8px 12px; background: #007bff; color: white; border: none; cursor: pointer; margin-right: 10px; }' +
              'button:hover { background: #0056b3; }' +
              '.auto-generate { margin-top: 20px; padding: 15px; background: #e8f4ff; border-radius: 5px; }' +
              '.auto-generate h3 { margin-top: 0; }' +
              '.status { margin-top: 10px; padding: 10px; border-radius: 5px; }' +
              '.status.active { background: #d4edda; color: #155724; }' +
              '.status.inactive { background: #f8d7da; color: #721c24; }' +
              '.trace-counter { margin-top: 10px; font-weight: bold; }' +
          '</style>' +
      '</head>' +
      '<body>' +
          '<div class="split-container">' +
              '<!-- Left Panel: Form Inputs -->' +
              '<div class="left-pane">' +
                  '<h2>Modify Trace Data</h2>' +
                  '<div class="form-group">' +
                      '<label for="message">Message:</label>' +
                      '<input type="text" id="message" value="' + message + '" />' +
                  '</div>' +
                  '<div class="form-group">' +
                      '<label for="customTag">Custom Tag:</label>' +
                      '<input type="text" id="customTag" value="' + customTag + '" />' +
                  '</div>' +
                  '<div class="form-group">' +
                      '<label for="operation">Operation:</label>' +
                      '<input type="text" id="operation" value="' + operation + '" />' +
                  '</div>' +
                  '<div class="form-group">' +
                      '<label for="event">Event Message:</label>' +
                      '<input type="text" id="event" value="' + eventMessage + '" />' +
                  '</div>' +
                  '<button onclick="updateTraceUI()">Update Trace</button>' +
                  '<button onclick="sendTrace()">Send Trace</button>' +
                  '<div class="auto-generate">' +
                      '<h3>Auto Generate Traces</h3>' +
                      '<div class="form-group">' +
                          '<label for="interval">Interval (milliseconds):</label>' +
                          '<input type="number" id="interval" value="' + interval + '" min="100" step="100" />' +
                      '</div>' +
                      '<div class="form-group">' +
                          '<label>' +
                              '<input type="checkbox" id="autoGenerate" ' + (autoGenerate ? 'checked' : '') + ' />' +
                              'Enable Auto Generation' +
                          '</label>' +
                      '</div>' +
                      '<div id="status" class="status ' + (autoGenerate ? 'active' : 'inactive') + '">' +
                          'Status: ' + (autoGenerate ? 'Generating traces every ' + interval + 'ms' : 'Not generating traces') +
                      '</div>' +
                      '<div class="trace-counter">' +
                          'Traces Generated: <span id="traceCount">0</span>' +
                      '</div>' +
                  '</div>' +
                  '<div class="log-section">' +
                      '<h3>Send Logs</h3>' +
                      '<div class="form-group">' +
                          '<label for="logMessage">Log Message (JSON):</label>' +
                          '<textarea id="logMessage" rows="8" style="width: 100%; font-family: monospace;">' + logMessage + '</textarea>' +
                      '</div>' +
                      '<div class="form-group">' +
                          '<label for="logSeverity">Severity:</label>' +
                          '<select id="logSeverity">' +
                              '<option value="debug" ' + (logSeverity === 'debug' ? 'selected' : '') + '>Debug</option>' +
                              '<option value="info" ' + (logSeverity === 'info' ? 'selected' : '') + '>Info</option>' +
                              '<option value="warn" ' + (logSeverity === 'warn' ? 'selected' : '') + '>Warn</option>' +
                              '<option value="error" ' + (logSeverity === 'error' ? 'selected' : '') + '>Error</option>' +
                          '</select>' +
                      '</div>' +
                      '<button onclick="sendLog()">Send Log</button>' +
                  '</div>' +
              '</div>' +
              '<!-- Right Panel: Trace Details -->' +
              '<div class="right-pane">' +
                  '<h2>OpenTelemetry Trace Details</h2>' +
                  '<div>' +
                      '<strong>Trace ID:</strong> <span id="traceId">' + traceId + '</span>' +
                  '</div>' +
                  '<div>' +
                      '<strong>Span ID:</strong> <span id="spanId">' + spanId + '</span>' +
                  '</div>' +
                  '<div>' +
                      '<strong>Message:</strong>' +
                      '<pre id="messageDisplay" class="trace-json">' + message + '</pre>' +
                  '</div>' +
                  '<div>' +
                      '<strong>Attributes:</strong>' +
                      '<pre id="attributes" class="trace-json">' + attributes + '</pre>' +
                  '</div>' +
                  '<div>' +
                      '<strong>Event:</strong>' +
                      '<pre id="events" class="trace-json">' + events + '</pre>' +
                  '</div>' +
              '</div>' +
          '</div>' +
          '<script>' +
              'var currentInterval = null;' +
              'var traceCount = 0;' +
              'function updateTraceUI(newMessage, newCustomTag, newOperation, newEvent) {' +
                  'var message = newMessage || document.getElementById("message").value;' +
                  'var customTag = newCustomTag || document.getElementById("customTag").value;' +
                  'var operation = newOperation || document.getElementById("operation").value;' +
                  'var event = newEvent || document.getElementById("event").value;' +
                  'document.getElementById("messageDisplay").textContent = message;' +
                  'var url = new URL(window.location.href);' +
                  'url.searchParams.set("message", message);' +
                  'url.searchParams.set("customTag", customTag);' +
                  'url.searchParams.set("operation", operation);' +
                  'url.searchParams.set("event", event);' +
                  'window.history.replaceState({}, "", url.toString());' +
              '}' +
              'async function sendTrace() {' +
                  'var message = document.getElementById("message").value;' +
                  'var customTag = document.getElementById("customTag").value;' +
                  'var operation = document.getElementById("operation").value;' +
                  'var event = document.getElementById("event").value;' +
                  'var attributes = {' +
                      '"custom-tag": customTag,' +
                      '"operation": operation,' +
                      '"response": message' +
                  '};' +
                  'var events = [{ name: event }];' +
                  'try {' +
                      'var response = await fetch("/?message=" + encodeURIComponent(message) + "&customTag=" + encodeURIComponent(customTag) + "&operation=" + encodeURIComponent(operation) + "&event=" + encodeURIComponent(event));' +
                      'var data = await response.json();' +
                      'updateTraceUI(data.message, data.customTag, data.operation, data.event);' +
                      'document.getElementById("attributes").textContent = JSON.stringify(attributes, null, 2);' +
                      'document.getElementById("events").textContent = JSON.stringify(events, null, 2);' +
                      'traceCount++;' +
                      'document.getElementById("traceCount").textContent = traceCount;' +
                  '} catch (error) {' +
                      'console.error("Error sending trace:", error);' +
                  '}' +
              '}' +
              'function startAutoGeneration(interval) {' +
                  'if (currentInterval) {' +
                      'clearInterval(currentInterval);' +
                  '}' +
                  'currentInterval = setInterval(sendTrace, interval);' +
              '}' +
              'function stopAutoGeneration() {' +
                  'if (currentInterval) {' +
                      'clearInterval(currentInterval);' +
                      'currentInterval = null;' +
                  '}' +
              '}' +
              'var autoGenerate = ' + autoGenerate + ';' +
              'var interval = Math.max(' + interval + ', 30000);' +
              'if (autoGenerate && interval > 0) {' +
                  'startAutoGeneration(interval);' +
              '}' +
              'document.getElementById("autoGenerate").addEventListener("change", function(e) {' +
                  'var status = document.getElementById("status");' +
                  'var intervalInput = document.getElementById("interval");' +
                  'var interval = parseInt(intervalInput.value);' +
                  'if (interval < 1000) {' +
                      'interval = 1000;' +
                      'intervalInput.value = interval;' +
                      'alert("Minimum interval is 1 second to prevent excessive trace generation.");' +
                  '}' +
                  'if (e.target.checked && interval > 0) {' +
                      'startAutoGeneration(interval);' +
                      'status.textContent = "Status: Generating traces every " + interval/1000 + " seconds";' +
                      'status.className = "status active";' +
                  '} else {' +
                      'stopAutoGeneration();' +
                      'status.textContent = "Status: Not generating traces";' +
                      'status.className = "status inactive";' +
                  '}' +
              '});' +
              'document.getElementById("interval").addEventListener("change", function(e) {' +
                  'var status = document.getElementById("status");' +
                  'var autoGenerate = document.getElementById("autoGenerate").checked;' +
                  'var interval = parseInt(e.target.value);' +
                  'if (interval < 1000) {' +
                      'interval = 1000;' +
                      'e.target.value = interval;' +
                      'alert("Minimum interval is 1 second to prevent excessive trace generation.");' +
                  '}' +
                  'if (autoGenerate && interval > 0) {' +
                      'startAutoGeneration(interval);' +
                      'status.textContent = "Status: Generating traces every " + interval/1000 + " seconds";' +
                  '}' +
              '});' +
              'document.getElementById("updateTrace").addEventListener("click", function() {' +
                  'var newMessage = document.getElementById("message").value;' +
                  'var newCustomTag = document.getElementById("customTag").value;' +
                  'var newOperation = document.getElementById("operation").value;' +
                  'var newEvent = document.getElementById("event").value;' +
                  'updateTraceUI(newMessage, newCustomTag, newOperation, newEvent);' +
                  'var attributes = {' +
                      '"custom-tag": newCustomTag,' +
                      '"operation": newOperation,' +
                      '"response": newMessage' +
                  '};' +
                  'var events = [{ name: newEvent }];' +
                  'document.getElementById("attributes").textContent = JSON.stringify(attributes, null, 2);' +
                  'document.getElementById("events").textContent = JSON.stringify(events, null, 2);' +
              '});' +
              'async function sendLog() {' +
                  'var logMessage = document.getElementById("logMessage").value;' +
                  'var logSeverity = document.getElementById("logSeverity").value;' +
                  'try {' +
                      'var response = await fetch("/log?message=" + encodeURIComponent(logMessage) + "&severity=" + encodeURIComponent(logSeverity));' +
                      'var data = await response.json();' +
                      'console.log("Log sent successfully:", data);' +
                  '} catch (error) {' +
                      'console.error("Error sending log:", error);' +
                  '}' +
              '}' +
          '</script>' +
      '</body>' +
      '</html>';
  }
} 